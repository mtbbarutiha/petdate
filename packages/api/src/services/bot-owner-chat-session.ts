/**
 * Activate Telegram bot owner_chat sessions in Redis after a playdate is accepted.
 * Keys: petdate:bot:session:{telegramId} (see packages/bot/src/session.ts).
 *
 * RMW stays on the primary (getRedisWrite) for read-after-write consistency.
 */
import type { User } from '@petdate/shared';
import { getRedisWrite } from '../redis-client';
import { normalizeTelegramId } from './telegram-id';

const KEY_PREFIX = 'petdate:bot:session:';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionLike = {
  telegramId?: string;
  step?: string;
  userId?: number;
  ownerChatPlaydateId?: number;
  ownerChatPeerTelegramId?: string;
  ownerChatPeerUserId?: number;
  ownerChatMyPetId?: number;
  ownerChatPeerPetId?: number;
  ownerChatSecure?: boolean;
  ownerChatWebHintSent?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
};

async function getRedis() {
  return getRedisWrite();
}

function sessionKey(telegramId: string): string {
  return `${KEY_PREFIX}${telegramId}`;
}

async function upsertOwnerChatSession(opts: {
  telegramId: string;
  userId?: number;
  playdateId: number;
  peerTelegramId: string;
  peerUserId: number;
  myPetId?: number;
  peerPetId?: number;
}): Promise<boolean> {
  const client = await getRedis();
  if (!client) return false;
  const key = sessionKey(opts.telegramId);
  let existing: SessionLike = { telegramId: opts.telegramId, step: 'ready' };
  try {
    const raw = await client.get(key);
    if (raw) existing = JSON.parse(raw) as SessionLike;
  } catch {
    /* start fresh */
  }
  const next: SessionLike = {
    ...existing,
    telegramId: opts.telegramId,
    userId: opts.userId ?? existing.userId,
    step: 'owner_chat',
    ownerChatPlaydateId: opts.playdateId,
    ownerChatPeerTelegramId: String(opts.peerTelegramId),
    ownerChatPeerUserId: opts.peerUserId,
    ownerChatMyPetId: opts.myPetId,
    ownerChatPeerPetId: opts.peerPetId,
    ownerChatSecure: false,
    ownerChatWebHintSent: false,
    updatedAt: new Date().toISOString(),
  };
  await client.set(key, JSON.stringify(next), 'EX', SESSION_TTL_SECONDS);
  return true;
}

/** Put both playdate participants into bot owner_chat immediately after accept. */
export async function activateBotOwnerChatSessions(opts: {
  playdateId: number;
  accepter: User;
  requester: User;
  fromPetId?: number;
  toPetId?: number;
}): Promise<{ accepter: boolean; requester: boolean }> {
  const accepterTg = normalizeTelegramId(opts.accepter.telegramId);
  const requesterTg = normalizeTelegramId(opts.requester.telegramId);
  const result = { accepter: false, requester: false };
  if (accepterTg && requesterTg) {
    try {
      result.accepter = await upsertOwnerChatSession({
        telegramId: accepterTg,
        userId: opts.accepter.id,
        playdateId: opts.playdateId,
        peerTelegramId: requesterTg,
        peerUserId: opts.requester.id,
        myPetId: opts.toPetId,
        peerPetId: opts.fromPetId,
      });
    } catch (err) {
      console.warn('activate bot owner accepter session failed:', (err as Error).message);
    }
    try {
      result.requester = await upsertOwnerChatSession({
        telegramId: requesterTg,
        userId: opts.requester.id,
        playdateId: opts.playdateId,
        peerTelegramId: accepterTg,
        peerUserId: opts.accepter.id,
        myPetId: opts.fromPetId,
        peerPetId: opts.toPetId,
      });
    } catch (err) {
      console.warn('activate bot owner requester session failed:', (err as Error).message);
    }
  }
  return result;
}

function clearOwnerChatFields(existing: SessionLike): SessionLike {
  const next: SessionLike = { ...existing, step: 'ready', updatedAt: new Date().toISOString() };
  delete next.ownerChatPlaydateId;
  delete next.ownerChatPeerTelegramId;
  delete next.ownerChatPeerUserId;
  delete next.ownerChatMyPetId;
  delete next.ownerChatPeerPetId;
  delete next.ownerChatSecure;
  delete next.ownerChatWebHintSent;
  return next;
}

/**
 * Clear bot owner_chat for both peers when playdate chat ends (web or bot).
 * Prevents sticky chat keyboard / relay interference across mobile+desktop.
 */
export async function clearBotOwnerChatSessions(opts: {
  playdateId?: number;
  telegramIds: Array<string | null | undefined>;
}): Promise<number> {
  const client = await getRedis();
  if (!client) return 0;
  let cleared = 0;
  const unique = [
    ...new Set(
      opts.telegramIds
        .map((id) => normalizeTelegramId(id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  for (const telegramId of unique) {
    try {
      const key = sessionKey(telegramId);
      const raw = await client.get(key);
      if (!raw) continue;
      let existing: SessionLike;
      try {
        existing = JSON.parse(raw) as SessionLike;
      } catch {
        continue;
      }
      if (
        opts.playdateId &&
        existing.ownerChatPlaydateId &&
        existing.ownerChatPlaydateId !== opts.playdateId
      ) {
        continue;
      }
      if (existing.step !== 'owner_chat' && !existing.ownerChatPlaydateId) continue;
      const next = clearOwnerChatFields(existing);
      await client.set(key, JSON.stringify(next), 'EX', SESSION_TTL_SECONDS);
      cleared += 1;
    } catch (err) {
      console.warn('clear bot owner session failed:', telegramId, (err as Error).message);
    }
  }
  return cleared;
}
