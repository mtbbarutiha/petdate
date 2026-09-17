/**
 * Site + admin language (Persian / English).
 * Persists to localStorage; default is fa (RTL).
 */

import type { Lang } from './types';

export const LANG_STORAGE_KEY = 'petdate-lang';
export const DEFAULT_LANG: Lang = 'fa';

export function isLang(value: unknown): value is Lang {
  return value === 'fa' || value === 'en';
}

export function resolveLang(stored: string | null | undefined): Lang {
  return isLang(stored) ? stored : DEFAULT_LANG;
}

export function readStoredLang(): Lang | null {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* private mode / quota */
  }
}

export function langDir(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'en' ? 'ltr' : 'rtl';
}

export function langHtmlLang(lang: Lang): string {
  return lang === 'en' ? 'en' : 'fa';
}

/** Apply language to <html> (lang + dir). Skip no-op writes to avoid CLS on html. */
export function applyLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const nextLang = langHtmlLang(lang);
  const nextDir = langDir(lang);
  if (root.getAttribute('lang') !== nextLang) root.setAttribute('lang', nextLang);
  if (root.getAttribute('dir') !== nextDir) root.setAttribute('dir', nextDir);
}

export function initLang(): Lang {
  const lang = resolveLang(readStoredLang());
  applyLang(lang);
  return lang;
}

export function setLang(lang: Lang): Lang {
  writeStoredLang(lang);
  applyLang(lang);
  return lang;
}

export function toggleLang(current?: Lang | null): Lang {
  const cur = current ?? resolveLang(readStoredLang());
  return setLang(cur === 'fa' ? 'en' : 'fa');
}
