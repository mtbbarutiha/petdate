/**
 * Shared Telegram HTTP for API notify/sync paths.
 * Force IPv4 + keep-alive pool + short retries (VPS IPv6 to api.telegram.org times out).
 */
import dns from 'node:dns';
import { Agent, fetch as undiciFetch, type RequestInfo, type RequestInit } from 'undici';

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
  connections: 24,
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
      if (!isRetryableTelegramNetworkError(err) || attempt === MAX_ATTEMPTS) break;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
      console.warn(
        `[tg-http] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed (${errText(err)}); retry in ${delay}ms`
      );
      await sleep(delay);
    }
  }
  throw last instanceof Error ? last : new Error(errText(last));
}

/** Accept DOM/Node FormData bodies used by sendPhoto/sendDocument helpers. */
export type TelegramRequestInit = Omit<RequestInit, 'body'> & {
  body?: RequestInit['body'] | FormData | Blob | Buffer | string | null;
};

export async function telegramFetch(input: RequestInfo, init?: TelegramRequestInit): Promise<Response> {
  return withTelegramRetry(async () => {
    const res = await undiciFetch(input, {
      ...(init as RequestInit | undefined),
      dispatcher: telegramDispatcher,
    });
    return res as unknown as Response;
  }, typeof input === 'string' ? input.replace(/bot[^/]+/, 'bot***') : 'fetch');
}

export async function telegramApiJson<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  init?: Omit<RequestInit, 'method' | 'body' | 'dispatcher'>
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await telegramFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      },
      body: JSON.stringify(body ?? {}),
      ...init,
    });
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: errText(err) };
  }
}
