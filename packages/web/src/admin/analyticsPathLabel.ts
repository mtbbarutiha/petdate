import { tr } from '../i18n';
/**
 * Display helpers for admin analytics path buckets (صفحات پربازدید).
 * Mirrors API formatAnalyticsPathLabel so charts stay readable even if
 * older telemetry stored junk like `/profile|` or empty paths.
 */

function emptyPathLabel(): string {
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('lang') === 'en') {
    return '(empty)';
  }
  return tr('(خالی)');
}

/** Normalize / clean a path for chart axis labels. */
export function formatAnalyticsPathLabel(raw: unknown): string {
  const original = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!original || original === 'undefined' || original === 'null' || original === '(null)' || original === 'نامشخص') {
    return emptyPathLabel();
  }
  if (/^[|\\/\s]+$/.test(original) && !/^\/+$/.test(original)) {
    return emptyPathLabel();
  }
  let s = original;
  try {
    if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s);
  } catch {
    /* keep */
  }
  s = s.replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, '').trim();
  const pathOnly = s.split('?')[0]?.split('#')[0] || '';
  let cleaned = pathOnly.replace(/[|\\]+$/g, '').replace(/\/{2,}/g, '/').trim();
  if (!cleaned || cleaned === 'undefined' || cleaned === 'null') return emptyPathLabel();
  if (/^[|\\]+$/.test(pathOnly.trim())) return emptyPathLabel();
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  if (cleaned.length > 1) cleaned = cleaned.replace(/\/+$/, '');
  cleaned = cleaned.slice(0, 512) || emptyPathLabel();
  if (cleaned === '/' && /^[|\\]+$/.test(original.replace(/\s/g, ''))) return emptyPathLabel();
  return cleaned;
}

/** Shorten long paths for the Y-axis; keep full string for tooltip/`title`. */
export function shortenAnalyticsPathLabel(label: string, maxChars = 28): string {
  const s = String(label || '').trim() || emptyPathLabel();
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(1, maxChars - 1))}…`;
}

export type PathBarRow = { label: string; fullLabel: string; value: number };

/** Map API buckets → chart rows with cleaned + shortened labels. */
export function mapPathBars(rows: Array<{ label: string; value: number }>): PathBarRow[] {
  const merged = new Map<string, number>();
  for (const r of rows || []) {
    const full = formatAnalyticsPathLabel(r.label);
    merged.set(full, (merged.get(full) || 0) + (Number(r.value) || 0));
  }
  return [...merged.entries()]
    .map(([fullLabel, value]) => ({
      fullLabel,
      label: shortenAnalyticsPathLabel(fullLabel),
      value,
    }))
    .sort((a, b) => b.value - a.value || a.fullLabel.localeCompare(b.fullLabel));
}
