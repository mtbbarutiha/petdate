/**
 * Map API error bodies to short Persian messages.
 * www.petdate.ir (WCDN) often replaces 4xx/5xx JSON with HTML "Upstream Error" pages;
 * never surface raw `Unexpected token '<' ... is not valid JSON` to the UI.
 */

export function apiStatusFallbackMessage(status: number): string {
  if (status === 401) return 'برای ادامه وارد حساب شو.';
  if (status === 403) return 'دسترسی به این بخش را نداری.';
  if (status === 404) return 'مورد درخواستی پیدا نشد.';
  if (status === 408 || status === 504) return 'پاسخ سرور طول کشید. دوباره تلاش کن.';
  if (status === 429) return 'تعداد درخواست‌ها زیاد بود. کمی صبر کن.';
  if (status >= 500) return 'خطای سرور. لطفاً دوباره تلاش کن.';
  if (status >= 400) return `خطای ${status}`;
  return 'پاسخ سرور نامعتبر بود.';
}

export function looksLikeHtmlBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('<') ||
    /<!DOCTYPE/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed) ||
    /Upstream Error/i.test(trimmed)
  );
}

export function apiErrorMessageFromBody(
  status: number,
  body: string,
  fallback = apiStatusFallbackMessage(status)
): string {
  const trimmed = (body || '').trim();
  if (!trimmed) return fallback;
  if (looksLikeHtmlBody(trimmed)) return fallback;

  try {
    const json = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
      code?: string;
      requiresResendConfirm?: boolean;
    };
    const msg = (json.error || json.message || '').trim();
    return msg || fallback;
  } catch {
    // Plain text from origin — keep short; never dump HTML/JSON parse noise
    if (
      /Unexpected token|is not valid JSON|JSON\.parse/i.test(trimmed) ||
      trimmed.length > 280
    ) {
      return fallback;
    }
    return trimmed;
  }
}

export function parseApiJsonBody<T>(
  status: number,
  body: string
): { ok: true; data: T } | { ok: false; message: string; code?: string; requiresResendConfirm?: boolean } {
  const trimmed = (body || '').trim();
  if (!trimmed) {
    if (status >= 200 && status < 300) {
      return { ok: true, data: undefined as T };
    }
    return { ok: false, message: apiStatusFallbackMessage(status) };
  }
  if (looksLikeHtmlBody(trimmed)) {
    return { ok: false, message: apiStatusFallbackMessage(status || 502) };
  }
  try {
    const data = JSON.parse(trimmed) as T & {
      error?: string;
      message?: string;
      code?: string;
      requiresResendConfirm?: boolean;
    };
    if (status >= 200 && status < 300) {
      return { ok: true, data: data as T };
    }
    const message = apiErrorMessageFromBody(status, trimmed);
    return {
      ok: false,
      message,
      code: typeof data?.code === 'string' ? data.code : undefined,
      requiresResendConfirm: Boolean(
        data?.requiresResendConfirm || data?.code === 'RESEND_CONFIRM_REQUIRED'
      ),
    };
  } catch {
    return {
      ok: false,
      message:
        status >= 200 && status < 300
          ? 'پاسخ سرور قابل خواندن نبود.'
          : apiStatusFallbackMessage(status),
    };
  }
}
