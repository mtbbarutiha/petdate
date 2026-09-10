import { useMemo } from 'react';
import { formatNumFa } from './api';
import {
  JALALI_MONTHS,
  currentJalaliParts,
  type JalaliDateValue,
} from './jalaliDate';

export * from './jalaliDate';

type Props = {
  value: JalaliDateValue;
  onChange: (next: JalaliDateValue) => void;
  label?: string;
  /** Allow clearing to empty */
  allowEmpty?: boolean;
  className?: string;
  disabled?: boolean;
  /** How many Jalali years before current (default 3 — filters). */
  yearsBack?: number;
  /** How many Jalali years after current (default 1). */
  yearsForward?: number;
};

/**
 * Minimal Jalali year/month/day selects for admin filters & forms.
 * Emits Jalali parts; callers convert to Gregorian YYYY-MM-DD for API.
 */
export function JalaliDateSelect({
  value,
  onChange,
  label,
  allowEmpty = true,
  className = '',
  disabled = false,
  yearsBack = 3,
  yearsForward = 1,
}: Props) {
  const cur = useMemo(() => currentJalaliParts(), []);
  const years = useMemo(() => {
    const list: number[] = [];
    const start = cur.year - Math.max(0, yearsBack);
    const end = cur.year + Math.max(0, yearsForward);
    for (let y = end; y >= start; y--) list.push(y);
    // Keep selected year visible even if outside default window
    if (value?.year && !list.includes(value.year)) {
      list.push(value.year);
      list.sort((a, b) => b - a);
    }
    return list;
  }, [cur.year, yearsBack, yearsForward, value?.year]);

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
      {label ? <span className="admin-jalali-date-label">{label}</span> : null}
      <div className="admin-jalali-date-row" dir="rtl">
        <select
          className="admin-select admin-jalali-date-day"
          aria-label={label ? `${label} — روز` : 'روز'}
          disabled={disabled}
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
          className="admin-select admin-jalali-date-month"
          aria-label={label ? `${label} — ماه` : 'ماه'}
          disabled={disabled}
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
          className="admin-select admin-jalali-date-year"
          aria-label={label ? `${label} — سال` : 'سال'}
          disabled={disabled}
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

/** Compact از / تا pair for filter bars. */
export function JalaliDateRange({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'از تاریخ',
  toLabel = 'تا تاریخ',
  className = '',
  disabled = false,
  yearsBack,
  yearsForward,
}: {
  from: JalaliDateValue;
  to: JalaliDateValue;
  onFromChange: (next: JalaliDateValue) => void;
  onToChange: (next: JalaliDateValue) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
  disabled?: boolean;
  yearsBack?: number;
  yearsForward?: number;
}) {
  return (
    <div className={`admin-date-range ${className}`.trim()} role="group" aria-label="بازه تاریخ شمسی">
      <JalaliDateSelect
        label={fromLabel}
        value={from}
        onChange={onFromChange}
        disabled={disabled}
        yearsBack={yearsBack}
        yearsForward={yearsForward}
      />
      <JalaliDateSelect
        label={toLabel}
        value={to}
        onChange={onToChange}
        disabled={disabled}
        yearsBack={yearsBack}
        yearsForward={yearsForward}
      />
    </div>
  );
}
