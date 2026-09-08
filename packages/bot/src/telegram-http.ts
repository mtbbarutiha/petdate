/**
 * Durable Telegram Bot API HTTP for this VPS:
 * - Force IPv4 (IPv6 to api.telegram.org SSL-times out ~5–10s here)
 * - Keep-alive connection pool
 * - Short exponential retries on transient disconnects (not multi-minute loops)
 */
import dns from 'node:dns';
import { Agent, fetch as undiciFetch, type RequestInfo, type RequestInit } from 'undici';
import type { ApiClientOptions } from 'grammy';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node */
}

const MAX_ATTEMPTS = Math.max(1, Math.min(6, Number(process.env.TELEGRAM_HTTP_RETRIES ?? 4)));
const BASE_DELAY_MS = Math.max(50, Number(process.env.TELEGRAM_HTTP_RETRY_MS ?? 250));

export const telegramDispatcher = new Agent({
  connect: { family: 4, timeout: 12_000 },
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 32,
  pipelining: 1,
});

function errText(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const parts = [err.message, err.name];
    if (cause instanceof Error) {
      parts.push(cause.message, cause.name, (cause as NodeJS.ErrnoException).code ?? '');
    }
    if (cause && typeof cause === 'object' && 'code' in cause) {
      parts.push(String((cause as { code?: string }).code));
    }
    return parts.filter(Boolean).join(' ');
  }
  return String(err);
}

export function isRetryableTelegramNetworkError(err: unknown): boolean {
  const t = errText(err);
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR|socket hang up|fetch failed|network|ConnectTimeout|Other side closed|TLS|EPIPE/i.test(
    t
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withTelegramRetry<T>(fn: () => Promise<T>, label = 'telegram'): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const retryable = isRetryableTelegramNetworkError(err);
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
      console.warn(
        `[tg-http] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed (${errText(err)}); retry in ${delay}ms`
      );
      await sleep(delay);
    }
  }
  throw last instanceof Error ? last : new Error(errText(last));
}

export async function telegramFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return withTelegramRetry(async () => {
    const res = await undiciFetch(input, {
      ...init,
      dispatcher: telegramDispatcher,
    });
    return res as unknown as Response;
  }, 'fetch');
}

export function grammyClientOptions(): ApiClientOptions {
  return {
    baseFetchConfig: {
      duplex: 'half',
    } as ApiClientOptions['baseFetchConfig'],
    fetch: telegramFetch as unknown as NonNullable<ApiClientOptions['fetch']>,
  };
}
