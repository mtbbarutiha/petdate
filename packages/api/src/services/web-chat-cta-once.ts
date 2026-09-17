/**
 * web-cta-once-v2 — At-most-once web-chat CTA per (kind + chatId + telegramId).
 * Survives session rewrites and process restarts (Redis SET NX).
 * Relays must NEVER call this and must NEVER append a web-chat reply footer.
 *
 * SET NX is always on the primary write client.
 */
import { getRedisWrite } from '../redis-client';

/** Deploy marker — grep dist for this string to confirm v2 is live. */
export const WEB_CTA_ONCE_MARKER = 'web-cta-once-v2';

const KEY_PREFIX = 'petdate:web-cta:';
/** Keep long enough that a consult/playdate cannot re-prompt mid-thread. */
const TTL_SECONDS = 60 * 60 * 24 * 60;

export type WebChatCtaKind = 'vet' | 'playmate';

/** Process-local fallback when Redis is down — still blocks repeat in this process. */
const memoryClaimed = new Set<string>();

async function getRedis() {
  return getRedisWrite();
}

function ctaKey(kind: WebChatCtaKind, chatId: number, telegramId: string): string {
  return `${KEY_PREFIX}${kind}:${chatId}:${String(telegramId).trim()}`;
}

/**
 * Claim the right to send the web CTA.
 * @returns true → caller may send CTA now; false → already sent for this chat+user.
 */
export async function claimWebChatCtaOnce(
  kind: WebChatCtaKind,
  chatId: number,
  telegramId: string
): Promise<boolean> {
  if (!Number.isFinite(chatId) || chatId <= 0) return false;
  const tg = String(telegramId || '').trim();
  if (!tg || tg.startsWith('fake_') || tg.startsWith('demo_')) return false;

  const key = ctaKey(kind, chatId, tg);
  const client = await getRedis();
  if (client) {
    try {
      const ok = await client.set(key, '1', 'EX', TTL_SECONDS, 'NX');
      const claimed = ok === 'OK';
      if (!claimed) {
        console.log(
          `[${WEB_CTA_ONCE_MARKER}] CTA suppressed (already claimed) ${kind} chat=${chatId} tg=${tg}`
        );
      } else {
        console.log(`[${WEB_CTA_ONCE_MARKER}] claim once ${kind} chat=${chatId} tg=${tg}`);
      }
      return claimed;
    } catch (err) {
      console.warn(`[${WEB_CTA_ONCE_MARKER}] redis claim failed:`, (err as Error).message);
    }
  }

  if (memoryClaimed.has(key)) {
    console.log(
      `[${WEB_CTA_ONCE_MARKER}] CTA suppressed (memory) ${kind} chat=${chatId} tg=${tg}`
    );
    return false;
  }
  memoryClaimed.add(key);
  console.log(`[${WEB_CTA_ONCE_MARKER}] claim once (memory) ${kind} chat=${chatId} tg=${tg}`);
  return true;
}
