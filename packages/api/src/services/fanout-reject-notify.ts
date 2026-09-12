import {
  consultRejectedNotifyText,
  playdateRejectedNotifyText,
  shouldNotifyRequesterOnReject,
  type PlaydateRequest,
  type VetConsultation,
} from '@petdate/shared';
import { dbService } from '../db';
import { notifyPlaydateRejectedTelegram } from './telegram-playdate-notify';
import { notifyConsultRejectedTelegram } from './telegram-vet-consult-notify';

export type RequesterRejectNotifyPlan = {
  recipientCount: number;
  notifyRequester: boolean;
  /** Inbox / badge targets — recipient always; requester only when notifyRequester. */
  inboxUserIds: number[];
};

export function planPlaydateRejectNotify(
  req: Pick<PlaydateRequest, 'fromUserId' | 'fromPetId' | 'createdAt' | 'toUserId'>
): RequesterRejectNotifyPlan {
  const recipientCount = dbService.countPlaydateFanoutRecipients(req);
  const notifyRequester = shouldNotifyRequesterOnReject(recipientCount);
  const recipientId = req.toUserId;
  const inboxUserIds = [
    ...(Number.isFinite(recipientId) && (recipientId as number) > 0
      ? [recipientId as number]
      : []),
    ...(notifyRequester && req.fromUserId > 0 ? [req.fromUserId] : []),
  ];
  return { recipientCount, notifyRequester, inboxUserIds };
}

export function planConsultRejectNotify(
  consult: Pick<VetConsultation, 'patientUserId' | 'vetUserId' | 'createdAt'> & {
    serviceKind?: string | null;
  }
): RequesterRejectNotifyPlan {
  const recipientCount = dbService.countConsultFanoutRecipients(consult);
  const notifyRequester = shouldNotifyRequesterOnReject(recipientCount);
  const inboxUserIds = [
    consult.vetUserId,
    ...(notifyRequester ? [consult.patientUserId] : []),
  ].filter((id) => Number.isFinite(id) && id > 0);
  return { recipientCount, notifyRequester, inboxUserIds };
}

export function maybeNotifyPlaydateRequesterRejected(req: PlaydateRequest): void {
  const plan = planPlaydateRejectNotify(req);
  if (!plan.notifyRequester) return;
  const requester = dbService.getUserById(req.fromUserId);
  const telegramId = requester?.telegramId;
  if (!telegramId) return;
  void notifyPlaydateRejectedTelegram({
    toTelegramId: telegramId,
    text: playdateRejectedNotifyText(),
  }).catch((err) => {
    console.warn('playdate reject telegram notify failed:', (err as Error).message);
  });
}

export function maybeNotifyConsultRequesterRejected(consult: VetConsultation): void {
  const plan = planConsultRejectNotify(consult);
  if (!plan.notifyRequester) return;
  const patient = dbService.getUserById(consult.patientUserId);
  const telegramId = patient?.telegramId;
  if (!telegramId) return;
  void notifyConsultRejectedTelegram({
    toTelegramId: telegramId,
    text: consultRejectedNotifyText(consult.serviceKind),
  }).catch((err) => {
    console.warn('consult reject telegram notify failed:', (err as Error).message);
  });
}
