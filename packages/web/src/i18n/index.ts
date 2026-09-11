export type { Lang, Dict, TranslateFn } from './types';
export {
  LANG_STORAGE_KEY,
  DEFAULT_LANG,
  isLang,
  resolveLang,
  readStoredLang,
  writeStoredLang,
  langDir,
  langHtmlLang,
  applyLang,
  initLang,
  setLang,
  toggleLang,
} from './lang';
export { createTranslator } from './lookup';
export { I18nProvider, useI18n, useI18nOptional } from './I18nProvider';
export { fa as faDict } from './locales/fa';
export { en as enDict } from './locales/en';
