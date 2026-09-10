import fs from 'fs';
import type {
  ConsultServiceKind,
  User,
  VetConsultation,
  VetConsultChatMessage,
} from '@petdate/shared';
import { dbService, getDb } from '../db';
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
import { resolveStoragePath } from './chat-upload-store';
import {
  STT_UNAVAILABLE_FA,
  isSpeechToTextConfigured,
  transcribeAudio,
} from './speech-to-text';
import { fetchTelegramFileBytes } from './telegram-media';
import { notifyVetChatTelegram } from './telegram-chat-notify';
import { normalizeTelegramId } from './telegram-id';
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
  reused?: boolean;
} | null> {
  const aiKind = toAiKind(opts.serviceKind);
  if (!aiKind) return null;

  const ai = ensureAiAssistantUser();
  if (ai.id === opts.patient.id) return null;

  const pet =
    opts.petId != null
      ? dbService.getPet(opts.petId)
      : dbService.listPets({ ownerId: opts.patient.id })[0];

  // Reuse an ongoing AI consult so inbox does not grow a new «فعال» row each tap.
  const existing = dbService.findActiveAiConsultForPatient(opts.patient.id, aiKind, ai.id);
  if (existing && existing.status === 'active' && !existing.chatEnded) {
    // Collapse any sibling orphans left by older always-create bugs.
    dbService.closeActiveAiConsultsForPatient(opts.patient.id, aiKind, ai.id, existing.id);

    // Light refresh: attach pet when the open session had none.
    let consult = existing;
    if (pet?.id != null && existing.petId == null) {
      try {
        getDb()
          .prepare(
            `UPDATE vet_consultations SET pet_id = ? WHERE id = ? AND pet_id IS NULL`
          )
          .run(pet.id, existing.id);
        consult = dbService.getVetConsultation(existing.id) ?? existing;
      } catch {
        /* ignore refresh failures — reuse still wins */
      }
    }

    const prior = dbService.listVetConsultChatMessages(consult.id, { limit: 40 });
    const lastAi = [...prior].reverse().find((m) => m.senderUserId === ai.id);
    const adviceText =
      lastAi?.text?.trim() ||
      (aiKind === 'trainer'
        ? `گفتگو با ${AI_TRAINER_DISPLAY_NAME} از قبل باز است.`
        : 'گفتگو با دستیار هوشمند از قبل باز است.');

    notifyVetThread(consult.id, [opts.patient.id, ai.id], {
      reason: 'accepted',
      status: 'active',
    });
    notifyInbox([opts.patient.id, ai.id], {
      kind: 'vet',
      reason: 'accepted',
      id: consult.id,
    });

    return { consult, advice: adviceText, source: 'offline', reused: true };
  }

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

  // User ended a prior session (or orphans remain): close leftover actives before insert.
  dbService.closeActiveAiConsultsForPatient(opts.patient.id, aiKind, ai.id, null);

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
  fanOutAiReplyToPatientTelegram(consult, generated.text);
}

function fanOutAiReplyToPatientTelegram(
  consult: VetConsultation,
  text: string
): void {
  const patient = dbService.getUserById(consult.patientUserId);
  const peerTg = normalizeTelegramId(patient?.telegramId);
  if (!peerTg) return;
  void notifyVetChatTelegram({
    toTelegramId: peerTg,
    peerRole: 'patient',
    text,
    protectContent: Boolean(consult.chatSecure),
    serviceKind: consult.serviceKind ?? 'vet',
  });
}

function isVoiceMediaPlaceholder(text: string, mediaKind: string | null | undefined): boolean {
  const t = text.trim();
  if (!t) return true;
  if (mediaKind === 'voice' && t === '[پیام صوتی]') return true;
  if (mediaKind === 'audio' && t === '[فایل صوتی]') return true;
  return false;
}

async function loadConsultAudioBytes(
  message: VetConsultChatMessage
): Promise<{ buffer: Buffer; filename: string; mimeType: string } | null> {
  if (message.storageKey) {
    const abs = resolveStoragePath(message.storageKey);
    if (abs && fs.existsSync(abs)) {
      return {
        buffer: fs.readFileSync(abs),
        filename: message.fileName || 'voice.ogg',
        mimeType: message.mimeType || 'audio/ogg',
      };
    }
  }
  if (message.telegramFileId) {
    const file = await fetchTelegramFileBytes(message.telegramFileId);
    if (file) {
      return {
        buffer: file.buffer,
        filename: message.fileName || 'voice.ogg',
        mimeType: message.mimeType || file.contentType || 'audio/ogg',
      };
    }
  }
  return null;
}

async function postAiPlainReply(opts: {
  consult: VetConsultation;
  text: string;
}): Promise<void> {
  const message = dbService.createVetConsultChatMessage({
    consultId: opts.consult.id,
    senderUserId: opts.consult.vetUserId,
    text: opts.text,
  });
  notifyVetMessage(opts.consult.id, message, [
    opts.consult.vetUserId,
    opts.consult.patientUserId,
  ]);
  fanOutAiReplyToPatientTelegram(opts.consult, opts.text);
}

/**
 * When a patient sends voice/audio in an AI consult, transcribe then reply.
 * Human trainer/vet chats are unchanged (no auto-STT).
 */
export async function maybeTranscribeAndReplyAsAiAssistant(opts: {
  consultId: number;
  patientUserId: number;
  message: VetConsultChatMessage;
}): Promise<void> {
  const consult = dbService.getVetConsultation(opts.consultId);
  if (!consult || consult.status !== 'active' || consult.chatEnded) return;
  if (!isAiAssistantUserId(consult.vetUserId)) return;
  if (consult.patientUserId !== opts.patientUserId) return;

  const kind = opts.message.mediaKind;
  if (kind !== 'voice' && kind !== 'audio') return;

  const rawText = String(opts.message.text || '').trim();
  let patientText = isVoiceMediaPlaceholder(rawText, kind) ? '' : rawText;

  if (!patientText) {
    if (!isSpeechToTextConfigured()) {
      await postAiPlainReply({ consult, text: STT_UNAVAILABLE_FA });
      return;
    }
    const audio = await loadConsultAudioBytes(opts.message);
    if (!audio) {
      await postAiPlainReply({ consult, text: STT_UNAVAILABLE_FA });
      return;
    }
    const stt = await transcribeAudio({
      buffer: audio.buffer,
      filename: audio.filename,
      mimeType: audio.mimeType,
      language: 'fa',
    });
    if (!stt.ok) {
      await postAiPlainReply({ consult, text: STT_UNAVAILABLE_FA });
      return;
    }
    patientText = stt.text;
    const updated = dbService.updateVetConsultChatMessageText(opts.message.id, patientText);
    if (updated) {
      notifyVetMessage(opts.consultId, updated, [consult.vetUserId, consult.patientUserId]);
    }
  }

  await maybeReplyAsAiAssistant({
    consultId: opts.consultId,
    patientUserId: opts.patientUserId,
    patientText,
  });
}
