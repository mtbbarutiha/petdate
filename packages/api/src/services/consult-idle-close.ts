/**
 * Server-side idle close for active vet/trainer consultation chats.
 * After VET_CONSULT_IDLE_CLOSE_MS without patient typing / messages:
 * post a Persian closing notice and mark the consult completed + chat_ended.
 */
import {
  VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
  VET_CONSULT_IDLE_CLOSE_MS,
} from '@petdate/shared';
import { dbService } from '../db';
import { clearBotVetChatSessions } from './bot-vet-chat-session';
import {
  notifyVetChatEndedTelegram,
  notifyVetChatTelegram,
} from './telegram-chat-notify';
import { normalizeTelegramId } from './telegram-id';
import { notifyVetMessage, notifyVetThread } from '../ws/chatHub';

export { VET_CONSULT_IDLE_CLOSE_MESSAGE_FA, VET_CONSULT_IDLE_CLOSE_MS };

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

/**
 * Close one idle consult: notice message → completed/ended → notify peers.
 * Returns true when a consult was actually closed.
 */
export function closeOneIdleConsult(consultId: number): boolean {
  const consult = dbService.getVetConsultation(consultId);
  if (!consult || consult.status !== 'active' || consult.chatEnded) return false;

  let message: ReturnType<typeof dbService.createVetConsultChatMessage> | null =
    null;
  try {
    message = dbService.createVetConsultChatMessage({
      consultId,
      senderUserId: consult.vetUserId,
      text: VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
    });
  } catch (err) {
    console.warn(
      'consult idle-close message failed:',
      (err as Error).message
    );
  }

  const closed = dbService.closeVetConsultForIdle(consultId);
  if (!closed || closed.status !== 'completed' || !closed.chatEnded) {
    return false;
  }

  if (message) {
    notifyVetMessage(consultId, message, [
      consult.vetUserId,
      consult.patientUserId,
    ]);
    // Notify patient on Telegram (human); skip synthetic agent telegram ids.
    const patient = dbService.getUserById(consult.patientUserId);
    const patientTg = normalizeTelegramId(patient?.telegramId);
    if (patientTg) {
      void notifyVetChatTelegram({
        toTelegramId: patientTg,
        peerRole: 'patient',
        text: VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
        protectContent: false,
        serviceKind: consult.serviceKind ?? 'vet',
      });
    }
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
  let closed = 0;
  for (const id of ids) {
    try {
      if (closeOneIdleConsult(id)) closed += 1;
    } catch (err) {
      console.warn(
        `consult idle-close failed for #${id}:`,
        (err as Error).message
      );
    }
  }
  return closed;
}
