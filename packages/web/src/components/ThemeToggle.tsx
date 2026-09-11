import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  getDocumentTheme,
  initTheme,
  toggleTheme,
  type ThemeMode,
} from '../lib/theme';
import { useI18n } from '../i18n';

type ThemeToggleProps = {
  className?: string;
  /** Slightly denser size for admin chrome (still icon-only) */
  compact?: boolean;
};

/**
 * Icon-only theme switch for site header + admin header.
 * Visible label text (روشن/خاموش, Light/Dark) is omitted; aria-label/title remain for a11y.
 * Theme is applied on <html> early via index.html; this keeps UI in sync.
 */
export function ThemeToggle({ className = '', compact = false }: ThemeToggleProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof document !== 'undefined' ? getDocumentTheme() : 'dark'
  );

  useEffect(() => {
    setMode(initTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'petdate-theme') setMode(getDocumentTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const aria = mode === 'dark' ? t('theme.ariaToLight') : t('theme.ariaToDark');

  return (
    <button
      type="button"
      className={`pd-theme-toggle${compact ? ' pd-theme-toggle--compact' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => setMode(toggleTheme())}
      aria-label={aria}
      title={aria}
      data-theme-active={mode}
    >
      {mode === 'dark' ? (
        <Sun size={compact ? 16 : 18} strokeWidth={2.2} aria-hidden />
      ) : (
        <Moon size={compact ? 16 : 18} strokeWidth={2.2} aria-hidden />
      )}
    </button>
  );
}
