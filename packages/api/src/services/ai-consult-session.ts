import type { ConsultServiceKind, User, VetConsultation } from '@petdate/shared';
import { dbService } from '../db';
import {
  AI_TRAINER_DISPLAY_NAME,
  aiAssistantTelegramId,
  buildTrainerOpeningGreeting,
  generateAiConsultAdvice,
  trainerTypingDelayMs,
} from './ai-consult';
import {
  inferUserToneFromMessages,
  mergeUserTone,
  parseStoredTone,
} from './pasha-user-tone';
import { notifyInbox, notifyVetMessage, notifyVetThread } from '../ws/chatHub';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function ensureAiAssistantUser(): User {
  const tg = aiAssistantTelegramId();
  const existing = dbService.getUserByTelegramId(tg);
  if (existing) {
    if (existing.name !== 'دستیار هوشمند پت‌دیت') {
      dbService.updateUserProfile(existing.id, { name: 'دستیار هوشمند پت‌دیت' });
    }
    return dbService.getUserById(existing.id) ?? existing;
  }
  const { user } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'دستیار هوشمند پت‌دیت',
    username: 'petdate_ai',
  });
  dbService.setUserRoles(user.id, ['vet', 'trainer']);
  return dbService.getUserById(user.id) ?? user;
}

export function isAiAssistantUserId(userId: number): boolean {
  const u = dbService.getUserById(userId);
  return Boolean(u?.telegramId && u.telegramId === aiAssistantTelegramId());
}

/** نام نمایشی مربی/پزشک در چت وقتی طرف AI است */
export function decorateAiConsultDisplay(consult: VetConsultation): VetConsultation {
  if (!isAiAssistantUserId(consult.vetUserId)) return consult;
  if (consult.serviceKind === 'trainer') {
    return { ...consult, vetName: AI_TRAINER_DISPLAY_NAME };
  }
  return { ...consult, vetName: consult.vetName?.trim() || 'دستیار هوشمند پت‌دیت' };
}

function toAiKind(kind: ConsultServiceKind): 'vet' | 'trainer' | null {
  if (kind === 'vet' || kind === 'trainer') return kind;
  return null;
}

function petPromptFields(pet: ReturnType<typeof dbService.getPet> | null | undefined) {
  return {
    petName: pet?.name,
    petSpecies: pet?.species,
    petBreed: pet?.breed,
    petImageUrl: pet?.imageUrl,
    petAgeMonths: pet?.ageMonths,
  };
}

export async function startAiFallbackConsult(opts: {
  patient: User;
  serviceKind: ConsultServiceKind;
  petId?: number;
  userMessage?: string;
}): Promise<{
  consult: VetConsultation;
  advice: string;
  source: 'llm' | 'offline';
} | null> {
  const aiKind = toAiKind(opts.serviceKind);
  if (!aiKind) return null;

  const ai = ensureAiAssistantUser();
  if (ai.id === opts.patient.id) return null;

  const pet =
    opts.petId != null
      ? dbService.getPet(opts.petId)
      : dbService.listPets({ ownerId: opts.patient.id })[0];

  const petFields = petPromptFields(pet);
  const userMessage = opts.userMessage?.trim();

  let adviceText: string;
  let source: 'llm' | 'offline';

  if (aiKind === 'trainer' && !userMessage) {
    // Greeting-first: no curriculum dump on session open.
    adviceText = buildTrainerOpeningGreeting({
      patientName: opts.patient.name,
      ...petFields,
    });
    source = 'offline';
  } else {
    const generated = await generateAiConsultAdvice({
      kind: aiKind,
      patientName: opts.patient.name,
      ...petFields,
      userMessage,
    });
    adviceText = generated.text;
    source = generated.source;
  }

  const consult = dbService.createVetConsultation({
    vetUserId: ai.id,
    patientUserId: opts.patient.id,
    petId: pet?.id,
    status: 'active',
    notes:
      aiKind === 'trainer'
        ? `مشاوره آنلاین با ${AI_TRAINER_DISPLAY_NAME}`
        : 'مشاوره هوشمند دامپزشکی (پزشک انسانی آنلاین نبود)',
    feeCoins: 0,
    serviceKind: aiKind,
    providerShareCoins: 0,
  });

  const messageText =
    aiKind === 'trainer'
      ? adviceText
      : `دامپزشک انسانی آنلاین نبود — چت با دستیار هوشمند شروع شد.\n\n${adviceText}`;

  dbService.createVetConsultChatMessage({
    consultId: consult.id,
    senderUserId: ai.id,
    text: messageText,
  });

  notifyVetThread(consult.id, [opts.patient.id, ai.id], {
    reason: 'accepted',
    status: 'active',
  });
  notifyInbox([opts.patient.id, ai.id], {
    kind: 'vet',
    reason: 'accepted',
    id: consult.id,
  });

  return { consult, advice: adviceText, source };
}

/** After a patient message in an AI consult, generate and store an assistant reply. */
export async function maybeReplyAsAiAssistant(opts: {
  consultId: number;
  patientUserId: number;
  patientText: string;
}): Promise<void> {
  const consult = dbService.getVetConsultation(opts.consultId);
  if (!consult || consult.status !== 'active' || consult.chatEnded) return;
  if (!isAiAssistantUserId(consult.vetUserId)) return;
  if (consult.patientUserId !== opts.patientUserId) return;

  const aiKind = toAiKind(consult.serviceKind ?? 'vet');
  if (!aiKind) return;

  const pet = consult.petId != null ? dbService.getPet(consult.petId) : null;
  const allMsgs = dbService.listVetConsultChatMessages(opts.consultId, { limit: 200 });
  // Trainer multi-turn needs a wider window so follow-ups stay on-topic and deepen.
  const historyWindow = aiKind === 'trainer' ? 24 : 12;
  const recent = allMsgs
    .slice(-historyWindow)
    .map((m) => ({
      role: (m.senderUserId === consult.vetUserId ? 'assistant' : 'user') as
        | 'assistant'
        | 'user',
      content: String(m.text || '').trim(),
    }))
    .filter((m) => m.content);

  const patient = dbService.getUserById(consult.patientUserId);
  const userMsgs = recent.filter((m) => m.role === 'user').map((m) => m.content);
  if (opts.patientText.trim()) userMsgs.push(opts.patientText.trim());

  let userTone = null as ReturnType<typeof parseStoredTone>;
  if (aiKind === 'trainer') {
    const observed = inferUserToneFromMessages(userMsgs.slice(-12));
    const previous = parseStoredTone(dbService.getUserAiToneJson(consult.patientUserId));
    userTone = mergeUserTone(previous, observed);
    try {
      dbService.setUserAiToneJson(consult.patientUserId, JSON.stringify(userTone));
    } catch (err) {
      console.warn('persist user tone failed:', (err as Error).message);
    }
  }

  const generated = await generateAiConsultAdvice({
    kind: aiKind,
    patientName: patient?.name,
    petName: pet?.name || consult.petName,
    petSpecies: pet?.species || consult.petSpecies,
    petBreed: pet?.breed || consult.petBreed,
    petImageUrl: pet?.imageUrl,
    petAgeMonths: pet?.ageMonths,
    userMessage: opts.patientText,
    history: recent.slice(0, -1),
    userTone,
  });

  // Human pacing for trainer AI only — HTTP path already fire-and-forgets this call.
  if (aiKind === 'trainer') {
    await sleep(trainerTypingDelayMs(generated.text));
  }

  const message = dbService.createVetConsultChatMessage({
    consultId: opts.consultId,
    senderUserId: consult.vetUserId,
    text: generated.text,
  });
  notifyVetMessage(opts.consultId, message, [consult.vetUserId, consult.patientUserId]);
}
