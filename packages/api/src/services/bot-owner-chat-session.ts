/**
 * Activate Telegram bot owner_chat sessions in Redis after a playdate is accepted.
 * Keys: petdate:bot:session:{telegramId} (see packages/bot/src/session.ts).
 */
import Redis from 'ioredis';
import type { User } from '@petdate/shared';
import { infra, hasRedisConfig } from '../config/infra';
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

let redis: Redis | null = null;
let redisFailed = false;

async function getRedis(): Promise<Redis | null> {
  if (!hasRedisConfig() || redisFailed) return null;
  if (redis) return redis;
  try {
    const client = new Redis(infra.redis.url!, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });
    client.on('error', () => {
      /* suppressed */
    });
    await client.connect();
    await client.ping();
    redis = client;
    return client;
  } catch {
    redisFailed = true;
    return null;
  }
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
