import { useI18n } from '../i18n';

type LanguageToggleProps = {
  className?: string;
  /** Compact chip for dense admin chrome */
  compact?: boolean;
};

/**
 * FA / EN language switch — persists petdate-lang and updates <html lang/dir>.
 */
export function LanguageToggle({ className = '', compact = false }: LanguageToggleProps) {
  const { lang, setLang, t } = useI18n();
  const next: 'fa' | 'en' = lang === 'fa' ? 'en' : 'fa';
  const aria = next === 'en' ? t('lang.switchToEn') : t('lang.switchToFa');
  const label = next === 'en' ? t('lang.shortEn') : t('lang.shortFa');

  return (
    <button
      type="button"
      className={`pd-lang-toggle${compact ? ' pd-lang-toggle--compact' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => setLang(next)}
      aria-label={aria}
      title={aria}
      data-lang-active={lang}
    >
      <span className="pd-lang-toggle-label" aria-hidden>
        {label}
      </span>
    </button>
  );
}
