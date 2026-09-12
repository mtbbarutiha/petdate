/**
 * Language-aware UI translator for admin (and any surface that still has
 * Persian source copy). Looks up official dotted keys first, then the
 * gettext-style FA→EN map so English mode never falls back to Persian.
 *
 * FA mode also reverse-maps unique English chrome values so leftover
 * `tr('Page View')` / hardcoded EN passed through tr() still renders Persian.
 */
import type { Lang } from './types';
import { createTranslator } from './lookup';
import { fa } from './locales/fa';
import { en } from './locales/en';
import { ADMIN_FA_EN } from './locales/adminFaEn';

const DICTS = { fa, en } as const;

/** Test-only override so selftests can exercise both directions without a DOM. */
let langOverride: Lang | null = null;

export function setUiLangOverride(lang: Lang | null): void {
  langOverride = lang;
}

export function uiLang(): Lang {
  if (langOverride) return langOverride;
  if (typeof document === 'undefined') return 'fa';
  return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fa';
}

const EN_TO_FA: Record<string, string> = (() => {
  const counts = new Map<string, number>();
  for (const english of Object.values(ADMIN_FA_EN)) {
    counts.set(english, (counts.get(english) || 0) + 1);
  }
  const out: Record<string, string> = {};
  for (const [persian, english] of Object.entries(ADMIN_FA_EN)) {
    if (counts.get(english) === 1) out[english] = persian;
  }
  return out;
})();

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

export function tr(keyOrFa: string, vars?: Record<string, string | number>): string {
  const lang = uiLang();
  const fromDict = createTranslator(DICTS[lang], fa)(keyOrFa, vars);
  if (fromDict !== keyOrFa) return fromDict;
  if (lang === 'en') {
    const mapped = ADMIN_FA_EN[keyOrFa];
    if (typeof mapped === 'string') return interpolate(mapped, vars);
    return interpolate(keyOrFa, vars);
  }
  const faFromEn = EN_TO_FA[keyOrFa];
  if (typeof faFromEn === 'string') return interpolate(faFromEn, vars);
  return interpolate(keyOrFa, vars);
}

/** Translate a shared FA label map value (or the raw key if missing). */
export function trLabel(faOrKey: string | null | undefined): string {
  if (faOrKey == null || faOrKey === '') return '—';
  return tr(faOrKey);
}

export function hasAdminEn(fa: string): boolean {
  return Object.prototype.hasOwnProperty.call(ADMIN_FA_EN, fa);
}
