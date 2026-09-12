import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import {
  CONSULT_SERVICE_KINDS,
  QUICK_VET_COST,
  TEAM_AGENTS,
  getTeamAgentBySlug,
  vetVisitFeeCoins,
  type ConsultServiceKind,
  type VetConsultStatus,
} from '@petdate/shared';
import { consultFeeSplit, dbService } from '../db';
import { createPrescriptionWithDelivery } from '../services/prescription';
import { deliverPrescriptionToConsultChat } from '../services/prescription-chat';
import {
  publicWebOrigin,
  prescriptionWebPath,
  prescriptionPdfWebPath,
  prescriptionPdfPublicPath,
  prescriptionPublicUrl,
  prescriptionPdfPublicUrl,
  renderPrescriptionHtml,
} from '../services/prescription-html';
import { notifyVetQuickConsultTelegram } from '../services/telegram-vet-consult-notify';
import {
  maybeNotifyConsultRequesterRejected,
  planConsultRejectNotify,
} from '../services/fanout-reject-notify';
import { startVetChatFromApi } from '../services/telegram-vet-chat-start';
import { clearBotVetChatSessions } from '../services/bot-vet-chat-session';
import { AI_TRAINER_DISPLAY_NAME } from '../services/ai-consult';
import {
  decorateAiConsultDisplay,
  startAiFallbackConsult,
  startTeamAgentConsult,
  maybeReplyAsAiAssistant,
  maybeTranscribeAndReplyAsAiAssistant,
} from '../services/ai-consult-session';
import {
  notifyVetChatEndedTelegram,
  notifyVetChatSecureTelegram,
  notifyVetChatTelegram,
  resolveTelegramFile,
} from '../services/telegram-chat-notify';
import { normalizeTelegramId } from '../services/telegram-id';
import {
  MAX_UPLOAD_BYTES,
  deleteChatUpload,
  inferMediaKind,
  normalizeChatUploadFile,
  purgeChatUploadFolder,
  resolveStoragePath,
  saveChatUpload,
  sniffChatMediaContentType,
} from '../services/chat-upload-store';
import { isInternalBot } from '../internal-auth';
import { getUserFromBearer } from '../services/web-otp';
import { rejectIfFlagOff } from '../runtime-settings';
import {
  notifyInbox,
  notifyVetMessage,
  notifyVetThread,
} from '../ws/chatHub';
import type { VetConsultChatMediaKind } from '@petdate/shared';

const VALID_STATUSES: VetConsultStatus[] = [
  'requested',
  'active',
  'completed',
  'cancelled',
  'expired',
];

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function vetUploadFolder(consultId: number): string {
  return `vet-${consultId}`;
}

function purgeVetConsultUploads(consultId: number): void {
  for (const key of dbService.listVetConsultChatStorageKeys(consultId)) {
    deleteChatUpload(key);
  }
  purgeChatUploadFolder(vetUploadFolder(consultId));
}

function consultPeerTelegramIds(
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>,
  exceptUserId?: number
): string[] {
  const ids: string[] = [];
  for (const userId of [consult.vetUserId, consult.patientUserId]) {
    if (exceptUserId != null && userId === exceptUserId) continue;
    const user = dbService.getUserById(userId);
    const tg = normalizeTelegramId(user?.telegramId);
    if (tg) ids.push(tg);
  }
  return ids;
}

/**
 * Web/API → Telegram fan-out for a vet consult chat line.
 * Delivers exactly one copy to the peer's bot chat (no sender self-echo).
 * skipTelegram callers must not invoke this — bot already shows the typed line.
 */
function fanOutVetChatTelegram(opts: {
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>;
  senderUserId: number;
  text: string;
  mediaKind?: VetConsultChatMediaKind | string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}): void {
  const { consult, senderUserId } = opts;
  const peerUserId =
    consult.vetUserId === senderUserId ? consult.patientUserId : consult.vetUserId;
  const peerRole: 'vet' | 'patient' =
    peerUserId === consult.vetUserId ? 'vet' : 'patient';
  const peer = dbService.getUserById(peerUserId);
  const peerTg = normalizeTelegramId(peer?.telegramId);
  if (!peerTg) return;

  void notifyVetChatTelegram({
    toTelegramId: peerTg,
    peerRole,
    text: opts.text,
    protectContent: Boolean(consult.chatSecure),
    serviceKind: consult.serviceKind ?? 'vet',
    mediaKind: (opts.mediaKind ?? null) as VetConsultChatMediaKind | null,
    storageKey: opts.storageKey,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
  });
}

export const consultationsRouter = Router();

/** Inbox/chat status changes often — block CDN/browser stale GETs (WCDN SMART). */
consultationsRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

consultationsRouter.get('/', (req, res) => {
  const vetUserId = req.query.vetUserId ? Number(req.query.vetUserId) : undefined;
  const patientUserId = req.query.patientUserId
    ? Number(req.query.patientUserId)
    : undefined;
  const status = req.query.status as VetConsultStatus | undefined;
  const kindRaw = String(req.query.kind ?? req.query.serviceKind ?? '').trim();
  const serviceKind = CONSULT_SERVICE_KINDS.includes(kindRaw as ConsultServiceKind)
    ? (kindRaw as ConsultServiceKind)
    : undefined;

  if (
    (vetUserId == null || Number.isNaN(vetUserId)) &&
    (patientUserId == null || Number.isNaN(patientUserId))
  ) {
    res.status(400).json({ error: 'vetUserId یا patientUserId الزامی است' });
    return;
  }
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر است' });
    return;
  }

  dbService.expireStaleVetConsultRequests();
  const viewerId =
    vetUserId != null && !Number.isNaN(vetUserId)
      ? vetUserId
      : patientUserId != null && !Number.isNaN(patientUserId)
        ? patientUserId
        : undefined;
  const dismissed = viewerId
    ? new Set(
        dbService.listInboxDismissals(viewerId, 'vet').map((d) => d.entityId)
      )
    : null;
  const consultations = dbService
    .listVetConsultations({
      vetUserId:
        vetUserId != null && !Number.isNaN(vetUserId) ? vetUserId : undefined,
      patientUserId:
        patientUserId != null && !Number.isNaN(patientUserId)
          ? patientUserId
          : undefined,
      status,
      serviceKind,
    })
    .filter((c) => !dismissed?.has(c.id));
  res.json(consultations.map(decorateAiConsultDisplay));
});

/** دامپزشک‌های قبلی بیمار — قبل از /:id تا route اشتباه نشود */
consultationsRouter.get('/previous-vets', (req, res) => {
  const patientUserId = req.query.patientUserId
    ? Number(req.query.patientUserId)
    : undefined;
  if (!patientUserId || Number.isNaN(patientUserId)) {
    res.status(400).json({ error: 'patientUserId الزامی است' });
    return;
  }
  const patient = dbService.getUserById(patientUserId);
  if (!patient) {
    res.status(404).json({ error: 'بیمار پیدا نشد' });
    return;
  }
  res.json(dbService.listPreviousVetsForPatient(patientUserId));
});


consultationsRouter.get('/team-agents', (_req, res) => {
  res.json({
    agents: TEAM_AGENTS.map((a) => ({
      slug: a.slug,
      name: a.name,
      role: a.role,
      kind: a.kind,
      avatarUrl: a.avatarUrl,
      chatPath: `/team-chat/${a.slug}`,
    })),
  });
});

consultationsRouter.post('/team-agent', async (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const bodyPatientId =
    req.body?.patientUserId != null ? Number(req.body.patientUserId) : undefined;
  const patientUserId = session?.user?.id ?? bodyPatientId;
  const agentSlug = String(req.body?.agentSlug || req.body?.slug || '').trim();
  const def = getTeamAgentBySlug(agentSlug);

  if (!def) {
    res.status(400).json({ error: 'ایجنت پیدا نشد', reason: 'unknown_agent' });
    return;
  }
  if (!patientUserId || !Number.isFinite(patientUserId)) {
    res.status(400).json({ error: 'patientUserId الزامی است', reason: 'missing_patient' });
    return;
  }
  if (session?.user?.id && session.user.id !== patientUserId) {
    res.status(403).json({ error: 'اجازه دسترسی ندارید', reason: 'forbidden' });
    return;
  }

  const patient = dbService.getUserById(patientUserId);
  if (!patient) {
    res.status(404).json({ error: 'کاربر پیدا نشد', reason: 'missing_patient' });
    return;
  }

  try {
    const ai = await startTeamAgentConsult({ patient, agentSlug: def.slug });
    if (!ai) {
      res.status(500).json({ error: 'شروع گفتگو ناموفق بود', reason: 'ai_failed' });
      return;
    }
    res.status(201).json({
      ok: true,
      aiFallback: true,
      cost: 0,
      serviceKind: def.kind,
      agentSlug: def.slug,
      agentName: def.name,
      consultations: [decorateAiConsultDisplay(ai.consult)],
      advice: ai.advice,
      adviceSource: ai.source,
      reused: Boolean(ai.reused),
      message: `گفتگو با ${def.name} شروع شد.`,
      chatPath: `/vet-chats/${ai.consult.id}`,
    });
  } catch (err) {
    console.warn('team-agent consult failed:', (err as Error).message);
    res.status(500).json({ error: 'شروع گفتگو ناموفق بود', reason: 'ai_failed' });
  }
});

/**
 * اتصال سریع وب — همان سازوکار ربات:
 * پت اجباری (جز seeker_advice) → بررسی سکه → ارائه‌دهندگان آنلاین → کسر سکه → ایجاد مشاوره + نوتیف تلگرام
 * kind: vet | trainer | sitter | seeker_advice
 */
consultationsRouter.post('/quick-connect', async (req, res) => {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const bot = isInternalBot(req);
  const bodyPatientId =
    req.body?.patientUserId != null ? Number(req.body.patientUserId) : undefined;
  if (!session?.user?.id && !bot) {
    res.status(401).json({ error: 'وارد نشده‌اید', reason: 'auth' });
    return;
  }
  const patientUserId = session?.user?.id ?? (bot ? bodyPatientId : undefined);
  /** When true, skip the «resend after expiry» confirm gate (client already confirmed). */
  const confirmResend = Boolean(req.body?.confirmResend);
  /** Always start free AI consult (لیلا کیانی) — skip human provider matching. */
  const preferAi = Boolean(req.body?.preferAi || req.body?.aiOnly);
  /** Human coach/doctor only — do not fall back to AI when nobody is online. */
  const humanOnly = Boolean(req.body?.humanOnly || req.body?.preferHuman);
  const kindRaw = String(req.body?.kind ?? 'vet').trim();
  const serviceKind: ConsultServiceKind = CONSULT_SERVICE_KINDS.includes(
    kindRaw as ConsultServiceKind
  )
    ? (kindRaw as ConsultServiceKind)
    : 'vet';

  if (serviceKind === 'vet' && rejectIfFlagOff(res, 'vetConsultEnabled')) return;

  if (serviceKind === 'sitter') {
    res.status(410).json({
      error: 'سرویس پیدا کردن پرستار حذف شده است',
      reason: 'sitter_removed',
    });
    return;
  }

  if (!patientUserId || !Number.isFinite(patientUserId)) {
    res.status(400).json({ error: 'patientUserId الزامی است', reason: 'missing_patient' });
    return;
  }
  if (session?.user?.id && session.user.id !== patientUserId) {
    res.status(403).json({ error: 'اجازه دسترسی ندارید', reason: 'forbidden' });
    return;
  }

  const patientRow = dbService.getUserById(patientUserId);
  if (!patientRow) {
    res.status(404).json({ error: 'بیمار پیدا نشد', reason: 'missing_patient' });
    return;
  }
  const patient = patientRow;

  const pets = dbService.listPets({ ownerId: patient.id });
  const purchaseAdvice = Boolean(
    req.body?.purchaseAdvice || req.body?.intent === 'purchase_advice'
  );
  if (serviceKind === 'vet' && !pets.length && !purchaseAdvice) {
    res.status(400).json({
      error: 'برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.',
      reason: 'no_pet',
    });
    return;
  }
  if (serviceKind === 'trainer' && !pets.length) {
    res.status(400).json({
      error: 'برای درخواست مربی، اول باید حداقل یک پت ثبت کنی.',
      reason: 'no_pet',
    });
    return;
  }
  if (serviceKind === 'seeker_advice') {
    // seeker may have no pet — that's fine
  }

  dbService.expireStaleVetConsultRequests();

  if (dbService.hasPendingVetConsultForPatient(patient.id, serviceKind)) {
    res.status(409).json({
      error: 'هنوز درخواست مشاوره‌ات در انتظار پاسخ است.',
      reason: 'already_pending',
      code: 'ALREADY_PENDING',
    });
    return;
  }

  // After a prior expired consult, require explicit resend confirm (same copy as playmate).
  if (!confirmResend && dbService.hasExpiredVetConsultForPatient(patient.id, serviceKind)) {
    res.status(409).json({
      error: 'میخوای مجدد درخواست بدی به اون شخص؟',
      reason: 'resend_confirm',
      code: 'RESEND_CONFIRM_REQUIRED',
      requiresResendConfirm: true,
    });
    return;
  }

  const balance = patient.coins ?? 0;
  const split = consultFeeSplit(serviceKind);

  async function respondWithAiConsult(reason: 'prefer_ai' | 'fallback') {
    const ai = await startAiFallbackConsult({
      patient,
      serviceKind,
    });
    if (!ai) return false;
    const updatedPatient = dbService.getUserById(patient.id);
    res.status(201).json({
      ok: true,
      aiFallback: true,
      preferAi: reason === 'prefer_ai',
      sent: 1,
      notifiedTelegram: 0,
      cost: 0,
      serviceKind,
      coins: updatedPatient?.coins ?? 0,
      consultations: [decorateAiConsultDisplay(ai.consult)],
      advice: ai.advice,
      adviceSource: ai.source,
      message:
        serviceKind === 'trainer'
          ? `گفتگو با ${AI_TRAINER_DISPLAY_NAME} (مربی آنلاین) شروع شد (بدون کسر سکه).`
          : reason === 'prefer_ai'
            ? `چت با ${AI_TRAINER_DISPLAY_NAME} شروع شد (بدون کسر سکه).`
            : `دامپزشک انسانی آنلاین نبود — چت با ${AI_TRAINER_DISPLAY_NAME} شروع شد (بدون کسر سکه).`,
    });
    return true;
  }

  if (preferAi && !humanOnly && (serviceKind === 'vet' || serviceKind === 'trainer')) {
    try {
      if (await respondWithAiConsult('prefer_ai')) return;
    } catch (err) {
      console.warn('prefer-ai consult failed:', (err as Error).message);
    }
    res.status(500).json({
      error: 'شروع گفتگوی هوشمند ناموفق بود',
      reason: 'ai_failed',
    });
    return;
  }

  let providers =
    serviceKind === 'vet'
      ? dbService.listOnlineVetsForQuickConnect()
      : serviceKind === 'trainer'
        ? dbService.listOnlineProvidersForQuickConnect('trainer')
        : dbService.listOwnersAcceptingSeekerAdvice();
  providers = providers.filter((v) => v.id !== patient.id);

  if (!providers.length) {
    // Vet / trainer: fall back to AI assistant instead of hard error (unless human-only).
    if (
      !humanOnly &&
      (serviceKind === 'vet' || serviceKind === 'trainer')
    ) {
      try {
        if (await respondWithAiConsult('fallback')) return;
      } catch (err) {
        console.warn('ai fallback consult failed:', (err as Error).message);
      }
    }

    const emptyMsg =
      serviceKind === 'vet'
        ? 'فعلاً دامپزشک آنلاینی (ربات یا وب) برای اتصال پیدا نشد. کمی بعد دوباره امتحان کن.'
        : serviceKind === 'trainer'
          ? 'فعلاً مربی آنلاینی برای اتصال پیدا نشد.'
          : 'فعلاً صاحب پتی برای مشورت با صاحبین آنلاین نیست.';
    res.status(409).json({
      error: emptyMsg,
      reason: 'no_online_providers',
    });
    return;
  }

  const cost =
    serviceKind === 'vet'
      ? Math.max(QUICK_VET_COST, ...providers.map((v) => vetVisitFeeCoins(v)))
      : split.cost;

  if (balance < cost) {
    res.status(400).json({
      error: `برای این اتصال حداقل ${cost} سکه لازم داری. موجودی: ${balance}`,
      reason: 'insufficient_coins',
      balance,
      cost,
    });
    return;
  }

  const debited = dbService.debitCoins(patient.id, cost, {
    reason: split.debitReason,
    refType: `${serviceKind}_consult`,
  });
  if (!debited) {
    res.status(400).json({
      error: 'سکه کافی نیست',
      reason: 'insufficient_coins',
      balance: patient.coins ?? 0,
      cost,
    });
    return;
  }

  const consultations = [];
  let notifiedTelegram = 0;
  const notesDefault =
    serviceKind === 'vet'
      ? purchaseAdvice
        ? 'مشاوره برای خرید پت (بدون پت ثبت‌شده)'
        : 'اتصال سریع آنلاین'
      : serviceKind === 'trainer'
        ? 'درخواست مشاوره مربی'
        : 'درخواست مشورت با صاحبین';

  for (const provider of providers) {
    try {
      const feeCoins = serviceKind === 'vet' ? vetVisitFeeCoins(provider) : cost;
      const consult = dbService.createVetConsultation({
        vetUserId: provider.id,
        patientUserId: patient.id,
        notes: notesDefault,
        feeCoins,
        serviceKind,
        providerShareCoins: serviceKind === 'vet' ? feeCoins : split.providerShare,
      });
      consultations.push(consult);
      if (provider.telegramId) {
        const ok = await notifyVetQuickConsultTelegram({
          consult,
          vetTelegramId: provider.telegramId,
          patient,
          visitFeeCoins: feeCoins,
          providerShareCoins:
            serviceKind === 'vet' ? feeCoins : split.providerShare,
          serviceKind,
        });
        if (ok) notifiedTelegram += 1;
      }
    } catch (err) {
      console.warn('create consult for provider failed:', provider.id, err);
    }
  }

  // اگر هیچ مشاوره‌ای ساخته نشد، سکه برگردد (چت وب بدون رکورد بی‌معنی است)
  if (consultations.length === 0) {
    dbService.creditCoins(patient.id, cost, undefined, {
      reason: 'بازگشت سکه مشاوره (ناموفق)',
      refType: `${serviceKind}_consult_refund`,
    });
    const refunded = dbService.getUserById(patient.id);
    res.status(502).json({
      error: 'ارسال درخواست ناموفق بود؛ سکه‌ات برگشت داده شد.',
      reason: 'notify_failed',
      refunded: true,
      cost,
      coins: refunded?.coins ?? 0,
      consultations,
    });
    return;
  }

  const updatedPatient = dbService.getUserById(patient.id);
  const sent = consultations.length;
  notifyInbox(
    [patient.id, ...consultations.map((c) => c.vetUserId)],
    { kind: 'vet', reason: 'request' },
  );
  for (const c of consultations) {
    notifyInbox([c.vetUserId, patient.id], { kind: 'vet', reason: 'request', id: c.id });
  }
  res.status(201).json({
    ok: true,
    sent,
    notifiedTelegram,
    cost,
    serviceKind,
    coins: updatedPatient?.coins ?? 0,
    consultations,
    message: [
      serviceKind === 'vet'
        ? 'درخواستت برای پزشک‌های آنلاین (ربات و وب) ارسال شد.'
        : serviceKind === 'trainer'
          ? 'درخواستت برای مربی‌های آنلاین ارسال شد.'
          : 'درخواست مشورت با صاحبین برای صاحبان پت ارسال شد.',
      `هدف‌ها: ${sent}`,
      notifiedTelegram > 0 ? `اعلان تلگرام: ${notifiedTelegram}` : null,
      `سکه کسر شده: ${cost}`,
      'به‌زودی در چت وب یا ربات جواب می‌گیری.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
});

consultationsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const consultation = dbService.getVetConsultation(id);
  if (!consultation) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  res.json({
    ...decorateAiConsultDisplay(consultation),
    fanoutRecipientCount: dbService.countConsultFanoutRecipients(consultation),
  });
});

consultationsRouter.post('/', (req, res) => {
  if (rejectIfFlagOff(res, 'vetConsultEnabled')) return;
  const { vetUserId, patientUserId, petId, status, notes } = req.body ?? {};

  if (!vetUserId || !patientUserId) {
    res.status(400).json({ error: 'vetUserId و patientUserId الزامی هستند' });
    return;
  }

  const vet = dbService.getUserById(Number(vetUserId));
  const patient = dbService.getUserById(Number(patientUserId));
  if (!vet || !patient) {
    res.status(404).json({ error: 'دامپزشک یا بیمار پیدا نشد' });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر است' });
    return;
  }

  if (petId != null) {
    const pet = dbService.getPet(Number(petId));
    if (!pet) {
      res.status(404).json({ error: 'پت پیدا نشد' });
      return;
    }
  }

  const consultation = dbService.createVetConsultation({
    vetUserId: Number(vetUserId),
    patientUserId: Number(patientUserId),
    petId: petId != null ? Number(petId) : undefined,
    status: status as VetConsultStatus | undefined,
    notes: typeof notes === 'string' ? notes : undefined,
    feeCoins: vetVisitFeeCoins(dbService.getUserById(Number(vetUserId))),
  });

  notifyInbox([consultation.vetUserId, consultation.patientUserId], {
    kind: 'vet',
    reason: 'request',
    id: consultation.id,
  });
  res.status(201).json(consultation);
});

consultationsRouter.patch('/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body?.status as VetConsultStatus | undefined;
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر است' });
    return;
  }
  const previous = dbService.getVetConsultation(id);
  const updated = dbService.updateVetConsultationStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }

  // Accept path: open web chat thread state; bot accept calls startVetChat itself.
  // Web POST /:id/accept is responsible for activating bot sessions + Telegram intros.
  if (status === 'active' && previous?.status === 'requested') {
    dbService.cancelSiblingVetConsultations(updated.patientUserId, updated.id);
    dbService.payVetForAcceptedConsult(updated.id);
    const existing = dbService.listVetConsultChatMessages(updated.id, { limit: 1 });
    if (!existing.length) {
      try {
        dbService.createVetConsultChatMessage({
          consultId: updated.id,
          senderUserId: updated.vetUserId,
          text: '✅ درخواست قبول شد — چت فعال است. می‌توانید پیام بفرستید.',
        });
      } catch {
        /* ignore seed message errors */
      }
    }
  }

  const participants = [updated.vetUserId, updated.patientUserId];
  const becameCancelled =
    status === 'cancelled' && previous?.status === 'requested';
  const rejectPlan = becameCancelled ? planConsultRejectNotify(updated) : null;
  notifyVetThread(updated.id, participants, { status: updated.status }, {
    inboxUserIds: rejectPlan?.inboxUserIds ?? participants,
  });
  if (becameCancelled && rejectPlan?.notifyRequester) {
    maybeNotifyConsultRequesterRejected(updated);
  }
  res.json({
    ...updated,
    fanoutRecipientCount: rejectPlan?.recipientCount,
    notifyRequesterOnReject: rejectPlan?.notifyRequester,
  });
});

function requireConsultParticipant(consultId: number, userId: number) {
  const consult = dbService.getVetConsultation(consultId);
  if (!consult) return { error: 'not_found' as const };
  if (consult.vetUserId !== userId && consult.patientUserId !== userId) {
    return { error: 'forbidden' as const };
  }
  return { consult };
}

/** قبول درخواست توسط دامپزشک از وب → فعال‌سازی چت برای دو طرف (وب + ربات) */
consultationsRouter.post('/:id/accept', async (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const consult = dbService.getVetConsultation(id);
  if (!consult) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (consult.vetUserId !== session.user.id) {
    res.status(403).json({ error: 'فقط دامپزشک این درخواست می‌تواند قبول کند' });
    return;
  }
  if (consult.status === 'active') {
    res.json(decorateAiConsultDisplay(consult));
    return;
  }
  if (consult.status === 'expired') {
    res.status(409).json({ error: 'این درخواست منقضی شده است', code: 'EXPIRED' });
    return;
  }
  if (consult.status !== 'requested') {
    res.status(409).json({ error: 'این درخواست دیگر قابل قبول نیست' });
    return;
  }

  const updated = dbService.updateVetConsultationStatus(id, 'active');
  if (!updated) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  dbService.cancelSiblingVetConsultations(updated.patientUserId, updated.id);
  dbService.payVetForAcceptedConsult(updated.id);

  try {
    dbService.createVetConsultChatMessage({
      consultId: updated.id,
      senderUserId: session.user.id,
      text: '✅ درخواست قبول شد — چت فعال است. می‌توانید پیام بفرستید.',
    });
  } catch {
    /* ignore seed message errors */
  }

  const patient = dbService.getUserById(updated.patientUserId);
  const vet = dbService.getUserById(updated.vetUserId);
  if (patient && vet) {
    await startVetChatFromApi({
      consultId: updated.id,
      vet,
      patient,
    });
  }

  notifyVetThread(updated.id, [updated.vetUserId, updated.patientUserId], {
    status: 'active',
  });
  res.json(decorateAiConsultDisplay(updated));
});

consultationsRouter.post('/:id/reject', (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const consult = dbService.getVetConsultation(id);
  if (!consult) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (consult.vetUserId !== session.user.id) {
    res.status(403).json({ error: 'فقط دامپزشک این درخواست می‌تواند رد کند' });
    return;
  }
  if (consult.status === 'expired') {
    res.status(409).json({ error: 'این درخواست منقضی شده است', code: 'EXPIRED' });
    return;
  }
  if (consult.status !== 'requested') {
    res.status(409).json({ error: 'این درخواست دیگر قابل رد نیست' });
    return;
  }
  const updated = dbService.updateVetConsultationStatus(id, 'cancelled');
  if (updated) {
    const rejectPlan = planConsultRejectNotify(updated);
    notifyVetThread(
      updated.id,
      [updated.vetUserId, updated.patientUserId],
      { status: 'cancelled' },
      { inboxUserIds: rejectPlan.inboxUserIds },
    );
    if (rejectPlan.notifyRequester) {
      maybeNotifyConsultRequesterRejected(updated);
    }
    res.json({
      ...updated,
      fanoutRecipientCount: rejectPlan.recipientCount,
      notifyRequesterOnReject: rejectPlan.notifyRequester,
    });
    return;
  }
  res.json(updated);
});

consultationsRouter.get('/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.query.userId != null ? Number(req.query.userId) : undefined);
  if (!userId || !Number.isFinite(userId)) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const gate = requireConsultParticipant(id, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  const afterId = req.query.afterId != null ? Number(req.query.afterId) : undefined;
  res.json(
    dbService.listVetConsultChatMessages(id, {
      afterId: afterId != null && Number.isFinite(afterId) ? afterId : undefined,
    })
  );
});

consultationsRouter.post('/:id/messages', async (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const senderUserId =
    session?.user?.id ??
    (req.body?.senderUserId != null
      ? Number(req.body.senderUserId)
      : req.body?.userId != null
        ? Number(req.body.userId)
        : undefined);
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const mediaKind = typeof req.body?.mediaKind === 'string' ? req.body.mediaKind : undefined;
  const telegramFileId =
    typeof req.body?.telegramFileId === 'string' ? req.body.telegramFileId : undefined;
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined;
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : undefined;
  const storageKey =
    typeof req.body?.storageKey === 'string' ? req.body.storageKey : undefined;
  /** When true, skip Telegram fan-out (bot already delivered the line). */
  const skipTelegram = Boolean(req.body?.skipTelegram);

  if (!senderUserId || !Number.isFinite(senderUserId)) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }

  const gate = requireConsultParticipant(id, senderUserId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.consult.status !== 'active') {
    res.status(409).json({ error: 'چت فقط بعد از قبول درخواست فعال است' });
    return;
  }
  if (gate.consult.chatEnded) {
    res.status(409).json({ error: 'این چت قطع شده است' });
    return;
  }

  try {
    const message = dbService.createVetConsultChatMessage({
      consultId: id,
      senderUserId,
      text,
      mediaKind,
      telegramFileId,
      mimeType,
      fileName,
      storageKey,
    });

    // WS first — web dual-online peers must not wait on Telegram latency/failures.
    notifyVetMessage(id, message, [gate.consult.vetUserId, gate.consult.patientUserId]);
    if (!skipTelegram) {
      fanOutVetChatTelegram({
        consult: gate.consult,
        senderUserId,
        text: message.text,
        mediaKind: message.mediaKind,
        storageKey: message.storageKey,
        mimeType: message.mimeType,
        fileName: message.fileName,
      });
    }
    // AI provider auto-reply for patient messages (text or voice/audio → STT).
    if (senderUserId === gate.consult.patientUserId) {
      const voiceLike = mediaKind === 'voice' || mediaKind === 'audio';
      if (voiceLike) {
        void maybeTranscribeAndReplyAsAiAssistant({
          consultId: id,
          patientUserId: senderUserId,
          message,
        }).catch((err) => {
          console.warn('ai voice auto-reply failed:', (err as Error).message);
        });
      } else if (text.trim()) {
        void maybeReplyAsAiAssistant({
          consultId: id,
          patientUserId: senderUserId,
          patientText: text,
        }).catch((err) => {
          console.warn('ai auto-reply failed:', (err as Error).message);
        });
      }
    }

    res.status(201).json(message);
  } catch (err) {
    if (err instanceof Error && err.message === 'EMPTY_TEXT') {
      res.status(400).json({ error: 'متن پیام خالی است' });
      return;
    }
    if (err instanceof Error && err.message === 'TEXT_TOO_LONG') {
      res.status(400).json({ error: 'پیام خیلی طولانی است' });
      return;
    }
    throw err;
  }
});

consultationsRouter.post('/:id/messages/upload', (req, res) => {
  chatUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)'
          : 'آپلود فایل ناموفق بود',
      });
      return;
    }

    const id = Number(req.params.id);
    const session = getUserFromBearer(req.header('authorization') ?? undefined);
    const senderUserId =
      session?.user?.id ??
      Number(
        (req.body as { senderUserId?: string; userId?: string })?.senderUserId ??
          (req.body as { userId?: string })?.userId
      );
    const caption =
      typeof (req.body as { caption?: string; text?: string })?.caption === 'string'
        ? (req.body as { caption: string }).caption
        : typeof (req.body as { text?: string })?.text === 'string'
          ? (req.body as { text: string }).text
          : '';
    const file = req.file;

    if (!senderUserId || !Number.isFinite(senderUserId)) {
      res.status(401).json({ error: 'ورود لازم است' });
      return;
    }
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'فایل الزامی است' });
      return;
    }

    const gate = requireConsultParticipant(id, senderUserId);
    if (gate.error === 'not_found') {
      res.status(404).json({ error: 'مشاوره پیدا نشد' });
      return;
    }
    if (gate.error === 'forbidden') {
      res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
      return;
    }
    if (gate.consult.status !== 'active') {
      res.status(409).json({ error: 'چت فقط بعد از قبول درخواست فعال است' });
      return;
    }
    if (gate.consult.chatEnded) {
      res.status(409).json({ error: 'این چت قطع شده است' });
      return;
    }

    try {
      const normalized = await normalizeChatUploadFile({
        buffer: file.buffer,
        mimeType: file.mimetype || 'application/octet-stream',
        originalName: file.originalname || 'file',
      });
      const originalName = normalized.originalName;
      const mimeType = normalized.mimeType;
      const mediaKind = inferMediaKind(mimeType, originalName);
      const saved = saveChatUpload({
        folderId: vetUploadFolder(id),
        originalName,
        buffer: normalized.buffer,
      });

      const message = dbService.createVetConsultChatMessage({
        consultId: id,
        senderUserId,
        text: caption,
        mediaKind,
        storageKey: saved.storageKey,
        mimeType,
        fileName: originalName,
      });

      // WS first — web dual-online peers must not wait on Telegram latency/failures.
      notifyVetMessage(id, message, [gate.consult.vetUserId, gate.consult.patientUserId]);
      fanOutVetChatTelegram({
        consult: gate.consult,
        senderUserId,
        text: message.text,
        mediaKind: message.mediaKind,
        storageKey: message.storageKey,
        mimeType: message.mimeType,
        fileName: message.fileName,
      });
      // AI provider: web voice/audio upload → Whisper STT → reply.
      if (
        senderUserId === gate.consult.patientUserId &&
        (mediaKind === 'voice' || mediaKind === 'audio')
      ) {
        void maybeTranscribeAndReplyAsAiAssistant({
          consultId: id,
          patientUserId: senderUserId,
          message,
        }).catch((err) => {
          console.warn('ai voice upload auto-reply failed:', (err as Error).message);
        });
      } else if (
        senderUserId === gate.consult.patientUserId &&
        caption.trim() &&
        mediaKind !== 'voice' &&
        mediaKind !== 'audio'
      ) {
        void maybeReplyAsAiAssistant({
          consultId: id,
          patientUserId: senderUserId,
          patientText: caption,
        }).catch((err) => {
          console.warn('ai auto-reply failed:', (err as Error).message);
        });
      }
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'EMPTY_TEXT') {
        res.status(400).json({ error: 'فایل یا متن پیام الزامی است' });
        return;
      }
      if (err instanceof Error && err.message === 'TEXT_TOO_LONG') {
        res.status(400).json({ error: 'کپشن خیلی طولانی است' });
        return;
      }
      console.warn('vet chat upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره فایل ناموفق بود' });
    }
  });
});

consultationsRouter.get('/:id/messages/:messageId/media', async (req, res) => {
  const consultId = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.query.userId != null ? Number(req.query.userId) : undefined);
  if (!Number.isFinite(consultId) || !Number.isFinite(messageId) || !userId || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه مشاوره، پیام و userId الزامی هستند' });
    return;
  }

  const gate = requireConsultParticipant(consultId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }

  const message = dbService.getVetConsultChatMessage(messageId);
  if (!message || message.consultId !== consultId) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }

  if (message.storageKey) {
    const abs = resolveStoragePath(message.storageKey);
    if (!abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'فایل پیدا نشد' });
      return;
    }
    const buf = fs.readFileSync(abs);
    const contentType = sniffChatMediaContentType(buf, message.mimeType, message.fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (message.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
      );
    }
    res.send(buf);
    return;
  }

  if (!message.telegramFileId) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }

  const file = await resolveTelegramFile(message.telegramFileId);
  if (!file) {
    res.status(502).json({ error: 'دریافت فایل از تلگرام ناموفق بود' });
    return;
  }

  try {
    const upstream = await fetch(file.downloadUrl);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: 'دانلود فایل ناموفق بود' });
      return;
    }
    const contentType =
      message.mimeType ||
      upstream.headers.get('content-type') ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (message.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.warn('proxy telegram vet file failed:', (err as Error).message);
    res.status(502).json({ error: 'پروکسی فایل ناموفق بود' });
  }
});


/** Hide this consult from my inbox (does not wipe peer history). */
consultationsRouter.delete('/:id/inbox', (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.query.userId != null ? Number(req.query.userId) : undefined) ??
    (req.body?.userId != null ? Number(req.body.userId) : undefined);
  if (!userId || !Number.isFinite(userId) || !Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه مشاوره و userId الزامی هستند' });
    return;
  }
  const gate = requireConsultParticipant(id, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی مجاز نیست' });
    return;
  }
  dbService.dismissInboxItem(userId, 'vet', id);
  notifyInbox([userId], { kind: 'vet', reason: 'dismiss', id });
  res.json({ ok: true });
});


consultationsRouter.post('/:id/end-chat', async (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.body?.userId != null ? Number(req.body.userId) : undefined);
  if (!userId || !Number.isFinite(userId)) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }

  const gate = requireConsultParticipant(id, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.consult.status !== 'active') {
    res.status(409).json({ error: 'فقط چت مشاورهٔ فعال قابل قطع است' });
    return;
  }

  const wasSecure = Boolean(gate.consult.chatSecure);
  // مشورت با صاحبین: قطع زیر ۱ ثانیه → بازگشت ۶ سکه (قبل از پاک‌کردن چت)
  const earlyRefund = dbService.refundEarlySeekerAdviceIfEligible(id);
  purgeVetConsultUploads(id);
  const updated = dbService.endVetConsultChat(id);
  const bothTelegramIds = consultPeerTelegramIds(gate.consult);
  // Clear sticky bot vet_chat for BOTH sides — stops mobile/desktop keyboard interference
  void clearBotVetChatSessions({
    consultId: id,
    telegramIds: bothTelegramIds,
  });
  // Secure chat: wipe CTA for BOTH participants. Otherwise notify peer only.
  const notifyIds = wasSecure
    ? bothTelegramIds
    : consultPeerTelegramIds(gate.consult, userId);
  for (const telegramId of notifyIds) {
    void notifyVetChatEndedTelegram({
      toTelegramId: telegramId,
      wasSecure,
      consultId: id,
    });
  }
  notifyVetThread(id, [gate.consult.vetUserId, gate.consult.patientUserId], {
    chatEnded: true,
    chatSecure: false,
    wasSecure,
  });
  const ended = updated ?? gate.consult;
  const patientAfter = dbService.getUserById(gate.consult.patientUserId);
  res.json({
    ok: true,
    consultation: decorateAiConsultDisplay(ended),
    wasSecure,
    refunded: earlyRefund.refunded,
    refundAmount: earlyRefund.refunded ? earlyRefund.amount : 0,
    coins: patientAfter?.coins ?? undefined,
  });
});

consultationsRouter.patch('/:id/chat-secure', async (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.body?.userId != null ? Number(req.body.userId) : undefined);
  const secure = Boolean(req.body?.secure);
  if (!userId || !Number.isFinite(userId)) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }

  const gate = requireConsultParticipant(id, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.consult.status !== 'active') {
    res.status(409).json({ error: 'چت امن فقط برای مشاورهٔ فعال مجاز است' });
    return;
  }
  if (gate.consult.chatEnded) {
    res.status(409).json({ error: 'این چت قطع شده است' });
    return;
  }

  const updated = dbService.setVetConsultChatSecure(id, secure);
  for (const telegramId of consultPeerTelegramIds(gate.consult, userId)) {
    void notifyVetChatSecureTelegram({ toTelegramId: telegramId, secure });
  }
  notifyVetThread(id, [gate.consult.vetUserId, gate.consult.patientUserId], {
    chatSecure: secure,
  });
  res.json(updated);
});

consultationsRouter.delete('/:id/messages', async (req, res) => {
  const id = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.query.userId != null
      ? Number(req.query.userId)
      : req.body?.userId != null
        ? Number(req.body.userId)
        : undefined);
  if (!userId || !Number.isFinite(userId)) {
    res.status(401).json({ error: 'ورود لازم است' });
    return;
  }
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }

  const gate = requireConsultParticipant(id, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }

  purgeVetConsultUploads(id);
  const cleared = dbService.clearVetConsultChatMessages(id);
  notifyVetThread(id, [gate.consult.vetUserId, gate.consult.patientUserId], {
    messagesCleared: true,
  });
  res.json({ ok: true, cleared });
});

/** ثبت امتیاز اختیاری صاحب‌پت به دامپزشک — یک امتیاز به ازای هر مشاوره */
consultationsRouter.post('/:id/rating', (req, res) => {
  const consultId = Number(req.params.id);
  const patientUserId =
    req.body?.patientUserId != null ? Number(req.body.patientUserId) : undefined;
  const rating = req.body?.rating != null ? Number(req.body.rating) : undefined;
  const comment = typeof req.body?.comment === 'string' ? req.body.comment : undefined;

  if (!Number.isFinite(consultId) || consultId <= 0) {
    res.status(400).json({ error: 'شناسه مشاوره نامعتبر' });
    return;
  }
  if (!patientUserId || !Number.isFinite(patientUserId)) {
    res.status(400).json({ error: 'patientUserId الزامی است' });
    return;
  }

  const result = dbService.upsertVetRating({
    consultId,
    patientUserId,
    rating: rating as number,
    comment,
  });

  if (!result.ok) {
    if (result.reason === 'missing_consult') {
      res.status(404).json({ error: 'مشاوره پیدا نشد' });
      return;
    }
    if (result.reason === 'forbidden') {
      res.status(403).json({ error: 'فقط صاحب پت می‌تواند امتیاز دهد' });
      return;
    }
    res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۵ باشد' });
    return;
  }

  res.status(result.created ? 201 : 200).json({
    ...result.rating,
    created: result.created,
    stats: dbService.getVetRatingStats(result.rating.vetUserId),
  });
});

/** دریافت امتیاز ثبت‌شده برای یک مشاوره (در صورت وجود) */
consultationsRouter.get('/:id/rating', (req, res) => {
  const consultId = Number(req.params.id);
  if (!Number.isFinite(consultId) || consultId <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const rating = dbService.getVetRatingByConsultId(consultId);
  if (!rating) {
    res.status(404).json({ error: 'امتیازی ثبت نشده' });
    return;
  }
  res.json(rating);
});

/** صدور نسخه دارویی: PDF + پرونده + پیامک (در صورت موبایل تأییدشده) */
consultationsRouter.post('/:id/prescription', async (req, res) => {
  const consultId = Number(req.params.id);
  const vetUserId = req.body?.vetUserId != null ? Number(req.body.vetUserId) : undefined;
  const petId = req.body?.petId != null ? Number(req.body.petId) : undefined;
  const text = typeof req.body?.text === 'string' ? req.body.text : '';

  if (!Number.isFinite(consultId) || consultId <= 0) {
    res.status(400).json({ error: 'شناسه مشاوره نامعتبر' });
    return;
  }
  if (!vetUserId || !Number.isFinite(vetUserId)) {
    res.status(400).json({ error: 'vetUserId الزامی است' });
    return;
  }
  if (!petId || !Number.isFinite(petId)) {
    res.status(400).json({ error: 'petId الزامی است' });
    return;
  }

  const consult = dbService.getVetConsultation(consultId);
  if (!consult) {
    res.status(404).json({ error: 'مشاوره پیدا نشد' });
    return;
  }
  if ((consult.serviceKind ?? 'vet') !== 'vet') {
    res.status(403).json({ error: 'صدور نسخه فقط برای مشاوره دامپزشکی مجاز است' });
    return;
  }

  const created = await createPrescriptionWithDelivery({
    consultId,
    vetUserId,
    petId,
    text,
  });

  if (!created.ok) {
    res.status(created.status).json({ error: created.error });
    return;
  }

  const { result } = created;
  const id = result.prescription.id;
  const host = req.get('host') || undefined;
  const webUrl =
    result.webUrl ||
    prescriptionPublicUrl(id, host) ||
    `${publicWebOrigin(host)}${prescriptionWebPath(id)}`;
  const pdfPublicUrl =
    result.pdfPublicUrl ||
    prescriptionPdfPublicUrl(id) ||
    `https://pdf.petdate.ir${prescriptionPdfPublicPath(id)}`;

  /**
   * Always deliver PDF + notice into the consult chat (web + Telegram relay).
   * When the patient has no phone, chat is the primary delivery path — SMS is optional.
   */
  let chatMessage: Awaited<
    ReturnType<typeof deliverPrescriptionToConsultChat>
  >['chatMessage'] = null;
  let telegramDelivered = false;
  let chatDeliveryNote = '';
  try {
    const delivered = await deliverPrescriptionToConsultChat({
      consultId,
      prescriptionId: id,
      pdfPath: result.pdfPath,
      pdfPublicUrl,
      webUrl,
      vetUserId: result.vet.id,
      patientUserId: result.patient.id,
      petName: result.pet.name,
      sms: result.sms,
    });
    chatMessage = delivered.chatMessage;
    telegramDelivered = delivered.telegramDelivered;
    chatDeliveryNote = delivered.note;
  } catch (err) {
    console.error('prescription chat PDF message failed:', err);
  }

  res.status(201).json({
    prescription: result.prescription,
    pdfPath: result.pdfPath,
    pdfUrl: `/api/prescriptions/${id}/pdf`,
    /** Relative path under PUBLIC_PDF_URL — e.g. /rx/12.pdf */
    pdfPathPublic: prescriptionPdfPublicPath(id),
    /** Legacy relative path on petdate.ir */
    pdfPathLegacy: prescriptionPdfWebPath(id),
    pdfPublicUrl,
    webPath: prescriptionWebPath(id),
    webUrl,
    chatMessage,
    telegramDelivered,
    chatDeliveryNote,
    sms: result.sms,
    patient: {
      id: result.patient.id,
      name: result.patient.name,
      telegramId: result.patient.telegramId,
      phoneVerified: result.patient.phoneVerified,
    },
    vet: {
      id: result.vet.id,
      name: result.vet.name,
      telegramId: result.vet.telegramId,
    },
    pet: {
      id: result.pet.id,
      name: result.pet.name,
      species: result.pet.species,
      breed: result.pet.breed,
    },
  });
});

/** دانلود PDF / مشاهده وب نسخه */
export const prescriptionsFileRouter = Router();

function sendPrescriptionHtml(req: { get(name: string): string | undefined }, res: import('express').Response, id: number) {
  const rx = dbService.getPrescription(id);
  if (!rx) {
    res.status(404).json({ error: 'نسخه پیدا نشد' });
    return;
  }
  const html = renderPrescriptionHtml({
    prescriptionId: rx.id,
    vetName: rx.vetName || '—',
    patientName: rx.patientName || '—',
    petName: rx.petName || '—',
    petSpecies: rx.petSpecies,
    petBreed: rx.petBreed,
    medicationText: rx.text,
    dateIso: rx.createdAt,
    pdfUrl: prescriptionPdfPublicUrl(rx.id),
    // logoUrl omitted → لوگو مادر embedded as data URI
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.send(html);
}

function sendPrescriptionPdf(res: import('express').Response, id: number) {
  const rx = dbService.getPrescription(id);
  if (!rx?.pdfPath || !fs.existsSync(rx.pdfPath)) {
    res.status(404).json({ error: 'فایل نسخه پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="petdate-dr-prescription-${id}.pdf"`
  );
  fs.createReadStream(rx.pdfPath).pipe(res);
}

function parsePositiveId(raw: string | undefined): number | null {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

prescriptionsFileRouter.get('/:id/pdf', (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  sendPrescriptionPdf(res, id);
});

prescriptionsFileRouter.get('/:id', (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  sendPrescriptionHtml(req, res, id);
});

/**
 * Short public URLs:
 * - /rx/:id           HTML page (petdate.ir)
 * - /rx/:id/pdf       legacy PDF path
 * - /rx/:id.pdf       SMS / pdf.petdate.ir download
 */
export const prescriptionWebRouter = Router();
prescriptionWebRouter.get(/^\/(\d+)\.pdf$/i, (req, res) => {
  const id = parsePositiveId(req.params[0]);
  if (id == null) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  sendPrescriptionPdf(res, id);
});
prescriptionWebRouter.get('/:id/pdf', (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  sendPrescriptionPdf(res, id);
});
prescriptionWebRouter.get('/:id', (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id == null) {
    res.status(400).type('html').send('<h1>شناسه نامعتبر</h1>');
    return;
  }
  sendPrescriptionHtml(req, res, id);
});
