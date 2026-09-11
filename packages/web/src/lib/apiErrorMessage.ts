/**
 * Map API error bodies to short UI messages (FA/EN via optional lang).
 * www.petdate.ir (WCDN) often replaces 4xx/5xx JSON with HTML "Upstream Error" pages;
 * never surface raw `Unexpected token '<' ... is not valid JSON` to the UI.
 */

import type { Lang } from '../i18n/types';
import { createTranslator } from '../i18n/lookup';
import { fa } from '../i18n/locales/fa';
import { en } from '../i18n/locales/en';

const tFa = createTranslator(fa);
const tEn = createTranslator(en, fa);

function tr(lang: Lang | undefined, key: string, vars?: Record<string, string | number>): string {
  return (lang === 'en' ? tEn : tFa)(key, vars);
}

export function apiStatusFallbackMessage(status: number, lang: Lang = 'fa'): string {
  if (status === 401) return tr(lang, 'errors.needLogin');
  if (status === 403) return tr(lang, 'errors.forbidden');
  if (status === 404) return tr(lang, 'errors.notFound');
  if (status === 408 || status === 504) return tr(lang, 'errors.timeout');
  if (status === 429) return tr(lang, 'errors.rateLimit');
  if (status >= 500) return tr(lang, 'errors.server');
  if (status >= 400) return tr(lang, 'errors.status', { status });
  return tr(lang, 'errors.invalid');
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
  fallback?: string,
  lang: Lang = 'fa'
): string {
  const resolvedFallback = fallback ?? apiStatusFallbackMessage(status, lang);
  const trimmed = (body || '').trim();
  if (!trimmed) return resolvedFallback;
  if (looksLikeHtmlBody(trimmed)) return resolvedFallback;

  try {
    const json = JSON.parse(trimmed) as {
      error?: string;
      message?: string;
      code?: string;
      requiresResendConfirm?: boolean;
    };
    const msg = (json.error || json.message || '').trim();
    return msg || resolvedFallback;
  } catch {
    if (
      /Unexpected token|is not valid JSON|JSON\.parse/i.test(trimmed) ||
      trimmed.length > 280
    ) {
      return resolvedFallback;
    }
    return trimmed;
  }
}

export function parseApiJsonBody<T>(
  status: number,
  body: string,
  lang: Lang = 'fa'
): { ok: true; data: T } | { ok: false; message: string; code?: string; requiresResendConfirm?: boolean } {
  const trimmed = (body || '').trim();
  if (!trimmed) {
    if (status >= 200 && status < 300) {
      return { ok: true, data: undefined as T };
    }
    return { ok: false, message: apiStatusFallbackMessage(status, lang) };
  }
  if (looksLikeHtmlBody(trimmed)) {
    return { ok: false, message: apiStatusFallbackMessage(status || 502, lang) };
  }
  try {
    const data = JSON.parse(trimmed) as T & {
      error?: string;
      message?: string;
      code?: string;
      requiresResendConfirm?: boolean;
    };
    if (status >= 200 && status < 300) {
      return { ok: true, data };
    }
    const msg =
      (typeof data?.error === 'string' && data.error.trim()) ||
      (typeof data?.message === 'string' && data.message.trim()) ||
      apiStatusFallbackMessage(status, lang);
    return {
      ok: false,
      message: msg,
      code: data?.code,
      requiresResendConfirm: data?.requiresResendConfirm,
    };
  } catch {
    return { ok: false, message: apiStatusFallbackMessage(status, lang) };
  }
}
