/** Pure Jalali date helpers for admin (no React). */

function formatNumFa(n: number): string {
  return new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(n);
}

export const JALALI_MONTHS = [
  { v: 1, label: 'فروردین' },
  { v: 2, label: 'اردیبهشت' },
  { v: 3, label: 'خرداد' },
  { v: 4, label: 'تیر' },
  { v: 5, label: 'مرداد' },
  { v: 6, label: 'شهریور' },
  { v: 7, label: 'مهر' },
  { v: 8, label: 'آبان' },
  { v: 9, label: 'آذر' },
  { v: 10, label: 'دی' },
  { v: 11, label: 'بهمن' },
  { v: 12, label: 'اسفند' },
];

export function currentJalaliParts(d = new Date()): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(d);
    const num = (t: string) =>
      Number(String(parts.find((p) => p.type === t)?.value || '').replace(/[^\d]/g, ''));
    const year = num('year');
    const month = num('month');
    const day = num('day');
    if (year > 1300 && month >= 1 && month <= 12 && day >= 1) {
      return { year, month, day };
    }
  } catch {
    /* fall through */
  }
  return { year: 1404, month: 1, day: 1 };
}

/** Compact Jalali → Gregorian (day-level), aligned with `en-u-ca-persian` Intl. */
export function jalaliToGregorianYmd(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  // Walk from an approximate Nowruz (≈ 21 March of jy+621) using Intl as source of truth.
  let d = new Date(jy + 621, 2, 21, 12, 0, 0);
  for (let i = 0; i < 400; i++) {
    const p = currentJalaliParts(d);
    if (p.year === jy && p.month === jm && p.day === jd) {
      return { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
    }
    const ahead =
      p.year < jy ||
      (p.year === jy && (p.month < jm || (p.month === jm && p.day < jd)));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (ahead ? 1 : -1), 12, 0, 0);
  }
  return { gy: d.getFullYear(), gm: d.getMonth() + 1, gd: d.getDate() };
}

export type JalaliDateValue = { year: number; month: number; day: number } | null;

export function jalaliPartsToGregorianIso(parts: {
  year: number;
  month: number;
  day: number;
} | null): string | null {
  if (!parts?.year || !parts.month || !parts.day) return null;
  const g = jalaliToGregorianYmd(parts.year, parts.month, parts.day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

/**
 * Combine Jalali day + `HH:mm` (or `HH:mm:ss`) into Gregorian local ISO-like
 * string `YYYY-MM-DDTHH:mm` for APIs that accept datetime-local style values.
 */
export function jalaliPartsAndTimeToIso(
  parts: JalaliDateValue,
  timeHhMm: string
): string | null {
  const date = jalaliPartsToGregorianIso(parts);
  if (!date) return null;
  const t = String(timeHhMm || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const pad = (n: string) => n.padStart(2, '0');
  return `${date}T${pad(m[1]!)}:${pad(m[2]!)}`;
}

/** Parse `YYYY/MM/DD` Jalali string → parts (or null). */
export function parseJalaliSlash(raw: string): JalaliDateValue {
  const m = String(raw || '').trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1) return null;
  return { year, month, day };
}

/** Format parts → `YYYY/MM/DD` (empty string when null). */
export function formatJalaliSlash(parts: JalaliDateValue): string {
  if (!parts) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
}

/** Gregorian `YYYY-MM-DD` (or Date / ISO) → Jalali parts. */
export function gregorianIsoToJalaliParts(raw?: string | Date | null): JalaliDateValue {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return currentJalaliParts(raw);
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) return parseJalaliSlash(s);
  const normalized =
    s.includes('T') || /Z$/i.test(s) || s.includes(' ')
      ? s.includes(' ') && !s.includes('T')
        ? s.replace(' ', 'T')
        : s
      : `${s}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return currentJalaliParts(d);
}

/** Jalali parts for today minus `n` calendar days. */
export function jalaliDaysAgo(n: number, from = new Date()): JalaliDateValue {
  const d = new Date(from);
  d.setDate(d.getDate() - Math.max(0, n));
  return currentJalaliParts(d);
}

function parseAdminDateInput(raw?: string | null): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const parts = parseJalaliSlash(s);
    const iso = jalaliPartsToGregorianIso(parts);
    if (!iso) return null;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized =
    s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)
      ? `${s}T12:00:00`
      : s.includes(' ') && !s.includes('T')
        ? s.replace(' ', 'T')
        : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Display helper: Gregorian ISO / Date / Jalali slash → fa-IR Jalali date. */
export function formatAdminFaDate(raw?: string | Date | null): string {
  if (raw == null || raw === '') return '—';
  if (typeof raw === 'string' && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw.trim())) {
    const p = parseJalaliSlash(raw.trim());
    if (!p) return raw.trim();
    return `${formatNumFa(p.year)}/${formatNumFa(p.month)}/${formatNumFa(p.day)}`;
  }
  const d = raw instanceof Date ? raw : parseAdminDateInput(raw);
  if (!d) return typeof raw === 'string' ? raw : '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return typeof raw === 'string' ? raw.slice(0, 10) : '—';
  }
}

/** Display helper with time (Tehran-friendly via fa-IR default). */
export function formatAdminFaDateTime(raw?: string | Date | null): string {
  if (raw == null || raw === '') return '—';
  const d = raw instanceof Date ? raw : parseAdminDateInput(raw);
  if (!d) return typeof raw === 'string' ? raw : '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return typeof raw === 'string' ? raw : '—';
  }
}


