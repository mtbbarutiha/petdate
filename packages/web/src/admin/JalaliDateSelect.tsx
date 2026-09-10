import { useMemo } from 'react';
import { formatNumFa } from './api';

const JALALI_MONTHS = [
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

/** Compact Jalali → Gregorian (day-level). */
export function jalaliToGregorianYmd(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  let jy2 = jy <= 979 ? jy : jy - 979;
  let days =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = days > 79 ? 1600 : 621;
  days = days > 79 ? days - 79 : days - (-19 + 365);
  const gy2 = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += gy2 + 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && days >= sal_a[gm]!; gm++) days -= sal_a[gm]!;
  return { gy, gm, gd: days + 1 };
}

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

export type JalaliDateValue = { year: number; month: number; day: number } | null;

type Props = {
  value: JalaliDateValue;
  onChange: (next: JalaliDateValue) => void;
  label?: string;
  /** Allow clearing to empty */
  allowEmpty?: boolean;
  className?: string;
};

/**
 * Minimal Jalali year/month/day selects for admin filters.
 * Emits Jalali parts; callers convert to Gregorian YYYY-MM-DD for API.
 */
export function JalaliDateSelect({
  value,
  onChange,
  label,
  allowEmpty = true,
  className = '',
}: Props) {
  const cur = useMemo(() => currentJalaliParts(), []);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = cur.year - 3; y <= cur.year + 1; y++) list.push(y);
    return list;
  }, [cur.year]);

  const year = value?.year ?? 0;
  const month = value?.month ?? 0;
  const day = value?.day ?? 0;
  const maxDay = month <= 6 ? 31 : month <= 11 ? 30 : 29;

  const setPart = (part: 'year' | 'month' | 'day', raw: string) => {
    if (!raw) {
      if (allowEmpty) onChange(null);
      return;
    }
    const n = Number(raw);
    const next = {
      year: part === 'year' ? n : year || cur.year,
      month: part === 'month' ? n : month || 1,
      day: part === 'day' ? n : day || 1,
    };
    if (part !== 'day' && next.day > (next.month <= 6 ? 31 : next.month <= 11 ? 30 : 29)) {
      next.day = next.month <= 6 ? 31 : next.month <= 11 ? 30 : 29;
    }
    onChange(next);
  };

  return (
    <label className={`admin-jalali-date ${className}`.trim()}>
      {label ? <span className="form-label">{label}</span> : null}
      <div className="admin-jalali-date-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select
          className="admin-select"
          aria-label="روز"
          value={day || ''}
          onChange={(e) => setPart('day', e.target.value)}
        >
          {allowEmpty ? <option value="">روز</option> : null}
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {formatNumFa(d)}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          aria-label="ماه"
          value={month || ''}
          onChange={(e) => setPart('month', e.target.value)}
        >
          {allowEmpty ? <option value="">ماه</option> : null}
          {JALALI_MONTHS.map((m) => (
            <option key={m.v} value={m.v}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          aria-label="سال"
          value={year || ''}
          onChange={(e) => setPart('year', e.target.value)}
        >
          {allowEmpty ? <option value="">سال</option> : null}
          {years.map((y) => (
            <option key={y} value={y}>
              {formatNumFa(y)}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export { JALALI_MONTHS };
