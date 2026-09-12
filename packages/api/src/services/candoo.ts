/**
 * Candoo SMS REST client (api.candoosms.com v3.0.1)
 *
 * Auth: header `x-api-key` (docs also mention `key-api-x`; send/balance work with x-api-key)
 * Send: POST /api/v3.0.1/send  body = JSON array of messages
 * Balance: POST /api/v3.0.1/balance (GET returns HTTP 500 on the live API; body unused)
 * OTP messages should use type=1 (رمز یکبار مصرف)
 */

export type CandooSendItem = {
  srcNum: string;
  recipient: string;
  body: string;
  customerId?: number;
  type?: number;
  retryCount?: number;
  validityPeriod?: number;
};

export type CandooSendResult = {
  ok: boolean;
  status: number;
  raw: unknown;
  error?: string;
};

function apiBase(): string {
  const base = (process.env.CANDOO_API_URL || 'https://api.candoosms.com').replace(/\/$/, '');
  return base;
}

function apiKey(): string {
  return (process.env.CANDOO_API_KEY || '').trim();
}

/** Admin SMS panel polls balance on every page load — keep this short so nginx never 502s. */
export const CANDOO_BALANCE_TIMEOUT_MS = 4_000;
/** Send/OTP can wait a bit longer, but must not hang for minutes on a dead provider. */
export const CANDOO_SEND_TIMEOUT_MS = 15_000;

async function candooFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError')
  );
}

function srcNumbers(): string[] {
  const raw = process.env.CANDOO_SRC_NUMBERS || '';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/^\+/, ''))
    .filter(Boolean);
}

let srcRoundRobin = 0;

/** انتخاب شماره فرستنده — round-robin بین CANDOO_SRC_NUMBERS */
export function nextSrcNumber(): string {
  const nums = srcNumbers();
  if (!nums.length) {
    throw new Error('CANDOO_SRC_NUMBERS خالی است');
  }
  const n = nums[srcRoundRobin % nums.length]!;
  srcRoundRobin += 1;
  return n;
}

export function isCandooConfigured(): boolean {
  return Boolean(apiKey() && srcNumbers().length);
}

/** ساخت بدنهٔ درخواست ارسال — برای تست واحد / اعتبارسنجی شکل */
export function buildSendPayload(items: CandooSendItem[]): CandooSendItem[] {
  return items.map((item) => ({
    srcNum: String(item.srcNum),
    recipient: String(item.recipient),
    body: String(item.body),
    ...(item.customerId != null ? { customerId: item.customerId } : {}),
    ...(item.type != null ? { type: item.type } : {}),
    ...(item.retryCount != null ? { retryCount: item.retryCount } : {}),
    ...(item.validityPeriod != null ? { validityPeriod: item.validityPeriod } : {}),
  }));
}

function describeStatusCode(code: number): string | null {
  // Candoo docs / observed: negative codes are provider-side rejects
  if (code === -4) return 'شماره فرستنده پیامک نامعتبر یا غیرفعال است';
  if (code === -1) return 'اعتبار پیامک کافی نیست';
  if (code < 0) return `سرویس پیامک ارسال را رد کرد (کد ${code})`;
  return null;
}

function firstSendRow(raw: unknown): { status?: string; statusCode?: number; message?: string } | null {
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === 'object') {
    return raw[0] as { status?: string; statusCode?: number; message?: string };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as { status?: string; statusCode?: number; message?: string };
  }
  return null;
}

function extractCandooErrorMessage(raw: unknown, fallback: string): string {
  const row = firstSendRow(raw);
  if (row) {
    if (typeof row.message === 'string' && row.message.trim()) return row.message.trim();
    if (typeof row.statusCode === 'number') {
      const mapped = describeStatusCode(row.statusCode);
      if (mapped) return mapped;
    }
    if (typeof row.status === 'string' && row.status.toUpperCase() === 'REJECTED') {
      return 'سرویس پیامک ارسال را رد کرد';
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const msg = (raw as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      if (parsed?.message) return String(parsed.message);
    } catch {
      /* keep fallback */
    }
  }
  return fallback;
}

/** آیا پاسخ send آرایه‌ای با ACCEPTED است؟ */
export function isCandooSendAccepted(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as { status?: string; statusCode?: number };
    if (typeof row.status === 'string' && row.status.toUpperCase() === 'ACCEPTED') return true;
    if (typeof row.statusCode === 'number' && row.statusCode >= 200 && row.statusCode < 300) {
      return true;
    }
    return false;
  });
}

/** رد شدن به خاطر شماره فرستنده / قابل تلاش مجدد با src دیگر */
export function isCandooSrcRejection(raw: unknown): boolean {
  const row = firstSendRow(raw);
  if (!row) return false;
  if (typeof row.status === 'string' && row.status.toUpperCase() !== 'REJECTED') return false;
  if (typeof row.statusCode === 'number' && row.statusCode === -4) return true;
  // generic REJECTED with non-2xx — try next src when multiple are configured
  if (typeof row.status === 'string' && row.status.toUpperCase() === 'REJECTED') return true;
  return false;
}

export async function candooSend(items: CandooSendItem[]): Promise<CandooSendResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, status: 0, raw: null, error: 'سرویس پیامک پیکربندی نشده (کلید API)' };
  }
  if (!items.length) {
    return { ok: false, status: 0, raw: null, error: 'لیست پیام خالی است' };
  }

  const url = `${apiBase()}/api/v3.0.1/send`;
  const payload = buildSendPayload(items);

  try {
    const res = await candooFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        body: JSON.stringify(payload),
      },
      CANDOO_SEND_TIMEOUT_MS
    );
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      const detail = extractCandooErrorMessage(
        raw,
        res.status === 401 ? 'کلید API نامعتبر است' : `خطای سرویس پیامک (HTTP ${res.status})`
      );
      return {
        ok: false,
        status: res.status,
        raw,
        error:
          res.status === 401
            ? 'کلید API پیامک نامعتبر است. با پشتیبانی تماس بگیر.'
            : res.status >= 500
              ? 'سرویس پیامک موقتاً در دسترس نیست. کمی بعد دوباره تلاش کن.'
              : detail,
      };
    }
    if (!isCandooSendAccepted(raw)) {
      return {
        ok: false,
        status: res.status,
        raw,
        error: extractCandooErrorMessage(raw, 'سرویس پیامک ارسال را تأیید نکرد'),
      };
    }
    return { ok: true, status: res.status, raw };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: isAbortError(err)
        ? 'سرویس پیامک پاسخ نداد (timeout). کمی بعد دوباره تلاش کن.'
        : 'ارتباط با سرویس پیامک برقرار نشد. کمی بعد دوباره تلاش کن.',
    };
  }
}

/**
 * ارسال با یک یا چند شماره فرستنده.
 * اگر Candoo یک src را REJECT کند (مثلاً -4)، بقیهٔ CANDOO_SRC_NUMBERS را امتحان می‌کند.
 */
export async function candooSendWithSrcFallback(
  item: Omit<CandooSendItem, 'srcNum'> & { srcNum?: string }
): Promise<CandooSendResult & { srcNum: string }> {
  const preferred = item.srcNum ? [item.srcNum] : [];
  const configured = srcNumbers();
  const candidates = [...preferred];
  for (const n of configured) {
    if (!candidates.includes(n)) candidates.push(n);
  }
  // start from round-robin position when no explicit src
  if (!item.srcNum && configured.length > 1) {
    const start = srcRoundRobin % configured.length;
    const rotated = [...configured.slice(start), ...configured.slice(0, start)];
    candidates.length = 0;
    candidates.push(...rotated);
    srcRoundRobin += 1;
  } else if (!item.srcNum && configured.length === 1) {
    srcRoundRobin += 1;
  }

  if (!candidates.length) {
    return {
      ok: false,
      status: 0,
      raw: null,
      error: 'CANDOO_SRC_NUMBERS خالی است',
      srcNum: '',
    };
  }

  let last: CandooSendResult & { srcNum: string } = {
    ok: false,
    status: 0,
    raw: null,
    error: 'ارسال پیامک ناموفق بود',
    srcNum: candidates[0]!,
  };

  for (let i = 0; i < candidates.length; i += 1) {
    const srcNum = candidates[i]!;
    const result = await candooSend([
      {
        ...item,
        srcNum,
      },
    ]);
    last = { ...result, srcNum };
    if (result.ok) return last;
    // auth / hard HTTP errors: do not burn through other numbers
    if (result.status === 401 || result.status >= 500 || result.status === 0) return last;
    const canRetry = isCandooSrcRejection(result.raw) && i < candidates.length - 1;
    if (!canRetry) return last;
    console.warn(
      `Candoo src ${srcNum} rejected; trying next sender (${i + 2}/${candidates.length})`,
      result.error
    );
  }

  return last;
}

/** ارسال OTP — type=1 طبق مستند Candoo */
export async function candooSendOtp(opts: {
  recipient: string;
  body: string;
  srcNum?: string;
  customerId?: number;
}): Promise<CandooSendResult & { srcNum: string }> {
  return candooSendWithSrcFallback({
    recipient: opts.recipient,
    body: opts.body,
    type: 1,
    retryCount: 2,
    validityPeriod: 300,
    ...(opts.srcNum ? { srcNum: opts.srcNum } : {}),
    ...(opts.customerId != null ? { customerId: opts.customerId } : {}),
  });
}

/** Strip API keys / opaque tokens from provider messages before returning to admin UI. */
export function sanitizeCandooPublicError(message: string): string {
  let out = String(message || '').trim() || 'خطای سرویس پیامک';
  const key = apiKey();
  if (key && out.includes(key)) {
    out = out.split(key).join('[redacted]');
  }
  // Defensive: never echo Candoo_* style secrets if a provider ever embeds them.
  out = out.replace(/\bCandoo_[A-Za-z0-9_-]{8,}\b/g, '[redacted]');
  out = out.replace(/\bx-api-key\s*[:=]\s*\S+/gi, 'x-api-key=[redacted]');
  return out;
}

/**
 * Parse Candoo balance body: plain number, quoted number, or JSON `{ balance|credit|amount }`.
 * Returns null when the body is not a finite credit value.
 */
export function parseCandooBalanceBody(text: string): number | null {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) return asNum;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
    if (typeof parsed === 'string') {
      const n = Number(parsed.trim());
      return Number.isFinite(n) ? n : null;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const row = parsed as Record<string, unknown>;
      for (const key of ['balance', 'credit', 'amount', 'value', 'rial', 'ریال']) {
        const v = row[key];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
          const n = Number(v.trim());
          if (Number.isFinite(n)) return n;
        }
      }
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** بررسی اعتبار / موجودی — بدون ارسال SMS */
export async function candooBalance(): Promise<{
  ok: boolean;
  status: number;
  balance?: number;
  error?: string;
  raw?: unknown;
}> {
  const key = apiKey();
  if (!key) {
    return { ok: false, status: 0, error: 'CANDOO_API_KEY تنظیم نشده' };
  }
  const url = `${apiBase()}/api/v3.0.1/balance`;
  try {
    // Live Candoo returns HTTP 500 for GET /balance; POST (empty JSON) returns the credit number.
    const res = await candooFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        body: '{}',
      },
      CANDOO_BALANCE_TIMEOUT_MS
    );
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: sanitizeCandooPublicError(
          res.status === 401
            ? 'کلید API نامعتبر (401)'
            : res.status >= 500
              ? 'سرویس موجودی پیامک موقتاً در دسترس نیست'
              : `Candoo HTTP ${res.status}`
        ),
        // Never return raw body to callers that might log/echo it — keep internal only.
        raw: undefined,
      };
    }
    const balance = parseCandooBalanceBody(text);
    if (balance == null) {
      return {
        ok: false,
        status: res.status,
        error: sanitizeCandooPublicError('پاسخ موجودی پیامک نامعتبر بود'),
      };
    }
    return {
      ok: true,
      status: res.status,
      balance,
    };
  } catch (err) {
    const networkMsg = isAbortError(err)
      ? `Candoo timeout (${CANDOO_BALANCE_TIMEOUT_MS}ms)`
      : err instanceof Error
        ? err.message
        : 'خطای شبکه Candoo';
    return {
      ok: false,
      status: 0,
      error: sanitizeCandooPublicError(networkMsg),
    };
  }
}
