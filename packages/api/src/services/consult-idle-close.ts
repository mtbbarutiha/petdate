/**
 * Server-side idle handling for active vet/trainer consultation chats.
 *
 * Policy:
 * - Human ↔ human: never auto-nudge / never auto-close.
 * - AI (team agent) chats: after each VET_CONSULT_IDLE_CLOSE_MS of patient idle,
 *   send an «آنلاین نیستی» nudge (up to VET_CONSULT_IDLE_NUDGE_MAX), then close.
 */
import {
  VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
  VET_CONSULT_IDLE_CLOSE_MS,
  VET_CONSULT_IDLE_NUDGE_MAX,
  VET_CONSULT_IDLE_NUDGE_MESSAGE_FA,
} from '@petdate/shared';
import { dbService } from '../db';
import { clearBotVetChatSessions } from './bot-vet-chat-session';
import { resolveTeamAgentForUserId } from './team-agents';
import {
  notifyVetChatEndedTelegram,
  notifyVetChatTelegram,
} from './telegram-chat-notify';
import { normalizeTelegramId } from './telegram-id';
import { notifyVetMessage, notifyVetThread } from '../ws/chatHub';

export {
  VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
  VET_CONSULT_IDLE_CLOSE_MS,
  VET_CONSULT_IDLE_NUDGE_MAX,
  VET_CONSULT_IDLE_NUDGE_MESSAGE_FA,
};

function consultTelegramIds(
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>
): string[] {
  const ids: string[] = [];
  for (const userId of [consult.vetUserId, consult.patientUserId]) {
    const user = dbService.getUserById(userId);
    const tg = normalizeTelegramId(user?.telegramId);
    if (tg) ids.push(tg);
  }
  return ids;
}

/** True when the consult peer is a synthetic team AI agent (not a human provider). */
export function isAiAgentConsult(
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>
): boolean {
  return Boolean(resolveTeamAgentForUserId(consult.vetUserId));
}

function nudgeIsFresh(
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>,
  idleMs: number
): boolean {
  const at = String(consult.idleNudgeAt || '').trim();
  if (!at) return false;
  const ts = Date.parse(at.includes('T') ? at : at.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < idleMs;
}

function postAgentLine(
  consult: NonNullable<ReturnType<typeof dbService.getVetConsultation>>,
  text: string
): ReturnType<typeof dbService.createVetConsultChatMessage> | null {
  try {
    const message = dbService.createVetConsultChatMessage({
      consultId: consult.id,
      senderUserId: consult.vetUserId,
      text,
    });
    notifyVetMessage(consult.id, message, [
      consult.vetUserId,
      consult.patientUserId,
    ]);
    const patient = dbService.getUserById(consult.patientUserId);
    const patientTg = normalizeTelegramId(patient?.telegramId);
    if (patientTg) {
      void notifyVetChatTelegram({
        toTelegramId: patientTg,
        peerRole: 'patient',
        text,
        protectContent: false,
        serviceKind: consult.serviceKind ?? 'vet',
      });
    }
    return message;
  } catch (err) {
    console.warn('consult idle line failed:', (err as Error).message);
    return null;
  }
}

/**
 * Handle one idle consult:
 * - human provider → skip (never auto-close)
 * - AI agent → nudge or close after max nudges
 * Returns true when a nudge was sent or the consult was closed.
 */
export function processOneIdleConsult(
  consultId: number,
  idleMs: number = VET_CONSULT_IDLE_CLOSE_MS
): boolean {
  const consult = dbService.getVetConsultation(consultId);
  if (!consult || consult.status !== 'active' || consult.chatEnded) return false;

  // Human ↔ human chats must never auto-close.
  if (!isAiAgentConsult(consult)) return false;

  const count = Math.max(0, Math.floor(Number(consult.idleNudgeCount || 0)));
  if (count > 0 && nudgeIsFresh(consult, idleMs)) return false;

  if (count < VET_CONSULT_IDLE_NUDGE_MAX) {
    postAgentLine(consult, VET_CONSULT_IDLE_NUDGE_MESSAGE_FA);
    dbService.bumpVetConsultIdleNudge(consultId);
    const after = dbService.getVetConsultation(consultId);
    const next = Math.max(0, Math.floor(Number(after?.idleNudgeCount || count + 1)));
    // After the Nth nudge, close in the same pass.
    if (next < VET_CONSULT_IDLE_NUDGE_MAX) return true;
  }

  return closeOneIdleConsult(consultId);
}

/**
 * Close one idle AI consult: final notice → completed/ended → notify peers.
 * Returns true when a consult was actually closed.
 */
export function closeOneIdleConsult(consultId: number): boolean {
  const consult = dbService.getVetConsultation(consultId);
  if (!consult || consult.status !== 'active' || consult.chatEnded) return false;
  if (!isAiAgentConsult(consult)) return false;

  postAgentLine(consult, VET_CONSULT_IDLE_CLOSE_MESSAGE_FA);

  const closed = dbService.closeVetConsultForIdle(consultId);
  if (!closed || closed.status !== 'completed' || !closed.chatEnded) {
    return false;
  }

  const telegramIds = consultTelegramIds(consult);
  void clearBotVetChatSessions({
    consultId,
    telegramIds,
  });
  for (const telegramId of telegramIds) {
    void notifyVetChatEndedTelegram({
      toTelegramId: telegramId,
      wasSecure: Boolean(consult.chatSecure),
      consultId,
    });
  }

  notifyVetThread(consultId, [consult.vetUserId, consult.patientUserId], {
    chatEnded: true,
    chatSecure: false,
    status: 'completed',
    reason: 'idle_close',
  });

  return true;
}

/** Sweep active consults idle longer than the configured window. */
export function sweepIdleConsultClosures(
  idleMs: number = VET_CONSULT_IDLE_CLOSE_MS
): number {
  const ids = dbService.listIdleActiveVetConsultIds(idleMs);
  let acted = 0;
  for (const id of ids) {
    try {
      if (processOneIdleConsult(id, idleMs)) acted += 1;
    } catch (err) {
      console.warn(
        `consult idle-close failed for #${id}:`,
        (err as Error).message
      );
    }
  }
  return acted;
}
