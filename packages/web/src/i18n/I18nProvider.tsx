import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyLang,
  initLang,
  langDir,
  setLang as persistLang,
  LANG_STORAGE_KEY,
} from './lang';
import type { Lang, TranslateFn } from './types';
import { createTranslator } from './lookup';
import { fa } from './locales/fa';
import { en } from './locales/en';

const DICTS = { fa, en } as const;

type I18nValue = {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: TranslateFn;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    typeof document !== 'undefined' ? initLang() : 'fa'
  );

  useEffect(() => {
    applyLang(lang);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY && (e.newValue === 'fa' || e.newValue === 'en')) {
        setLangState(e.newValue);
        applyLang(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(persistLang(next));
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((cur) => persistLang(cur === 'fa' ? 'en' : 'fa'));
  }, []);

  const t = useMemo(() => createTranslator(DICTS[lang], fa), [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: langDir(lang),
      t,
      setLang,
      toggleLang,
    }),
    [lang, t, setLang, toggleLang]
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside provider (tests). */
export function useI18nOptional(): I18nValue | null {
  return useContext(I18nContext);
}
