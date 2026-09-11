/**
 * Site + admin color theme (light / dark).
 * Persists to localStorage; default template is dark when unset
 * (OS prefers-color-scheme is ignored until the user picks a theme).
 */

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'petdate-theme';

/** Default when localStorage has no valid theme. */
export const DEFAULT_THEME: ThemeMode = 'dark';

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/**
 * Resolve effective theme from stored preference.
 * `prefersDark` is kept for API compatibility / tests but is unused —
 * product default is always dark until the user toggles.
 */
export function resolveTheme(
  stored: string | null | undefined,
  _prefersDark?: boolean
): ThemeMode {
  if (isThemeMode(stored)) return stored;
  return DEFAULT_THEME;
}

export function readStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode / quota */
  }
}

export function prefersDarkScheme(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function getDocumentTheme(): ThemeMode {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isThemeMode(attr) ? attr : DEFAULT_THEME;
}

/** Apply theme to <html> (class + data-theme + color-scheme + theme-color meta). */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.classList.toggle('theme-dark', mode === 'dark');
  root.classList.toggle('theme-light', mode === 'light');
  root.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', mode === 'dark' ? '#1a1d27' : '#5c4d91');
  }
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) {
    scheme.setAttribute('content', mode);
  }
}

export function initTheme(): ThemeMode {
  const mode = resolveTheme(readStoredTheme());
  applyTheme(mode);
  return mode;
}

export function setTheme(mode: ThemeMode): ThemeMode {
  writeStoredTheme(mode);
  applyTheme(mode);
  return mode;
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getDocumentTheme() === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}
