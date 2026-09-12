/**
 * Dual Jalali / Gregorian calendar widget for admin dashboard boards.
 * Pepito light RTL — mint today, purple accent selection.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  GREGORIAN_MONTHS_FA,
  IRANIAN_WEEKDAY_LABELS,
  JALALI_MONTHS,
  currentJalaliParts,
  formatJalaliNumFa,
  gregorianDaysInMonth,
  iranianWeekdayIndex,
  jalaliDaysInMonth,
  jalaliPartsToDate,
  localDateToIso,
} from '../jalaliDate';
import { usePrefersReducedMotion } from '../motionCharts';
import type { WidgetRenderContext } from './types';
import { useDashboardSelectedDate } from './DashboardSelectedDate';
import { tr } from '../../i18n';

export type CalendarMode = 'jalali' | 'gregorian';

type DayCell = {
  key: string;
  primary: number;
  secondary: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  date: Date;
};

function buildJalaliGrid(year: number, month: number, today: Date): DayCell[] {
  const days = jalaliDaysInMonth(year, month);
  const first = jalaliPartsToDate({ year, month, day: 1 });
  const startPad = iranianWeekdayIndex(first);
  const todayJ = currentJalaliParts(today);
  const cells: DayCell[] = [];

  // Leading days from previous month
  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const prevDays = jalaliDaysInMonth(prevY, prevM);
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevDays - i;
    const date = jalaliPartsToDate({ year: prevY, month: prevM, day });
    cells.push({
      key: `p-${prevY}-${prevM}-${day}`,
      primary: day,
      secondary: date.getDate(),
      isToday: false,
      isCurrentMonth: false,
      date,
    });
  }

  for (let day = 1; day <= days; day++) {
    const date = jalaliPartsToDate({ year, month, day });
    const isToday =
      todayJ.year === year && todayJ.month === month && todayJ.day === day;
    cells.push({
      key: `c-${year}-${month}-${day}`,
      primary: day,
      secondary: date.getDate(),
      isToday,
      isCurrentMonth: true,
      date,
    });
  }

  // Trailing to complete weeks (42 or at least full weeks)
  let nextDay = 1;
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const date = jalaliPartsToDate({ year: nextY, month: nextM, day: nextDay });
    cells.push({
      key: `n-${nextY}-${nextM}-${nextDay}`,
      primary: nextDay,
      secondary: date.getDate(),
      isToday: false,
      isCurrentMonth: false,
      date,
    });
    nextDay += 1;
    if (cells.length >= 42) break;
  }
  return cells;
}

function buildGregorianGrid(year: number, month: number, today: Date): DayCell[] {
  const days = gregorianDaysInMonth(year, month);
  const first = new Date(year, month - 1, 1, 12, 0, 0);
  const startPad = iranianWeekdayIndex(first);
  const cells: DayCell[] = [];

  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const prevDays = gregorianDaysInMonth(prevY, prevM);
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevDays - i;
    const date = new Date(prevY, prevM - 1, day, 12, 0, 0);
    const j = currentJalaliParts(date);
    cells.push({
      key: `gp-${prevY}-${prevM}-${day}`,
      primary: day,
      secondary: j.day,
      isToday: false,
      isCurrentMonth: false,
      date,
    });
  }

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() + 1 === month &&
      today.getDate() === day;
    const j = currentJalaliParts(date);
    cells.push({
      key: `gc-${year}-${month}-${day}`,
      primary: day,
      secondary: j.day,
      isToday,
      isCurrentMonth: true,
      date,
    });
  }

  let nextDay = 1;
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  while (cells.length % 7 !== 0 || cells.length < 35) {
    const date = new Date(nextY, nextM - 1, nextDay, 12, 0, 0);
    const j = currentJalaliParts(date);
    cells.push({
      key: `gn-${nextY}-${nextM}-${nextDay}`,
      primary: nextDay,
      secondary: j.day,
      isToday: false,
      isCurrentMonth: false,
      date,
    });
    nextDay += 1;
    if (cells.length >= 42) break;
  }
  return cells;
}

function fmtPrimaryDay(n: number, mode: CalendarMode): string {
  return mode === 'jalali' ? formatJalaliNumFa(n) : String(n);
}

function fmtSecondaryDay(n: number, mode: CalendarMode): string {
  // Secondary is the "other" calendar
  return mode === 'jalali' ? String(n) : formatJalaliNumFa(n);
}

export function CalendarWidget({ ctx }: { ctx?: WidgetRenderContext }) {
  const reduced = usePrefersReducedMotion();
  const { selectedIso, setSelectedIso } = useDashboardSelectedDate();
  const now = useMemo(() => new Date(), []);
  const todayJ = useMemo(() => currentJalaliParts(now), [now]);
  const todayIso = useMemo(() => localDateToIso(now), [now]);

  const [mode, setMode] = useState<CalendarMode>('jalali');
  const [jy, setJy] = useState(todayJ.year);
  const [jm, setJm] = useState(todayJ.month);
  const [gy, setGy] = useState(now.getFullYear());
  const [gm, setGm] = useState(now.getMonth() + 1);

  const cells = useMemo(() => {
    if (mode === 'jalali') return buildJalaliGrid(jy, jm, now);
    return buildGregorianGrid(gy, gm, now);
  }, [mode, jy, jm, gy, gm, now]);

  const titlePrimary =
    mode === 'jalali'
      ? `${JALALI_MONTHS.find((m) => m.v === jm)?.label || ''} ${formatJalaliNumFa(jy)}`
      : `${GREGORIAN_MONTHS_FA.find((m) => m.v === gm)?.label || ''} ${gy}`;

  const titleSecondary = useMemo(() => {
    if (mode === 'jalali') {
      const mid = jalaliPartsToDate({
        year: jy,
        month: jm,
        day: Math.min(15, jalaliDaysInMonth(jy, jm)),
      });
      return `${GREGORIAN_MONTHS_FA[mid.getMonth()]!.label} ${mid.getFullYear()}`;
    }
    const mid = new Date(gy, gm - 1, 15, 12, 0, 0);
    const j = currentJalaliParts(mid);
    return `${JALALI_MONTHS.find((m) => m.v === j.month)?.label || ''} ${formatJalaliNumFa(j.year)}`;
  }, [mode, jy, jm, gy, gm]);

  const goPrev = () => {
    if (mode === 'jalali') {
      if (jm === 1) {
        setJm(12);
        setJy((y) => y - 1);
      } else setJm((m) => m - 1);
    } else if (gm === 1) {
      setGm(12);
      setGy((y) => y - 1);
    } else setGm((m) => m - 1);
  };

  const goNext = () => {
    if (mode === 'jalali') {
      if (jm === 12) {
        setJm(1);
        setJy((y) => y + 1);
      } else setJm((m) => m + 1);
    } else if (gm === 12) {
      setGm(1);
      setGy((y) => y + 1);
    } else setGm((m) => m + 1);
  };

  const goToday = () => {
    const t = new Date();
    const j = currentJalaliParts(t);
    setJy(j.year);
    setJm(j.month);
    setGy(t.getFullYear());
    setGm(t.getMonth() + 1);
    setSelectedIso(null);
  };

  const switchMode = (next: CalendarMode) => {
    if (next === mode) return;
    // Keep roughly the same visible month when switching
    if (next === 'gregorian') {
      const mid = jalaliPartsToDate({
        year: jy,
        month: jm,
        day: Math.min(15, jalaliDaysInMonth(jy, jm)),
      });
      setGy(mid.getFullYear());
      setGm(mid.getMonth() + 1);
    } else {
      const mid = new Date(gy, gm - 1, 15, 12, 0, 0);
      const j = currentJalaliParts(mid);
      setJy(j.year);
      setJm(j.month);
    }
    setMode(next);
  };

  const compact = ctx ? ctx.w <= 1 || ctx.h <= 1 : false;

  useEffect(() => {
    return () => setSelectedIso(null);
  }, [setSelectedIso]);

  return (
    <div
      className={`wdg-calendar${compact ? ' wdg-calendar--compact' : ''}${
        reduced ? ' wdg-calendar--reduced' : ''
      }`}
    >
      <div className="wdg-cal-modes" role="tablist" aria-label={tr("نوع تقویم")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'jalali'}
          className={`wdg-cal-mode${mode === 'jalali' ? ' is-on' : ''}`}
          onClick={() => switchMode('jalali')}
        >
          {tr('شمسی')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'gregorian'}
          className={`wdg-cal-mode${mode === 'gregorian' ? ' is-on' : ''}`}
          onClick={() => switchMode('gregorian')}
        >
          {tr('میلادی')}
        </button>
      </div>

      <div className="wdg-cal-nav">
        <button type="button" className="wdg-cal-nav-btn" onClick={goNext} aria-label={tr("ماه بعد")}>
          <ChevronRight size={16} />
        </button>
        <div className="wdg-cal-title">
          <strong>{titlePrimary}</strong>
          <span>{titleSecondary}</span>
        </div>
        <button type="button" className="wdg-cal-nav-btn" onClick={goPrev} aria-label={tr("ماه قبل")}>
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="wdg-cal-weekdays" aria-hidden>
        {IRANIAN_WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="wdg-cal-grid" role="grid">
        {cells.map((c) => {
          const iso = localDateToIso(c.date);
          const picked = selectedIso === iso;
          const on = picked || (!selectedIso && c.isToday);
          return (
            <button
              key={c.key}
              type="button"
              role="gridcell"
              className={[
                'wdg-cal-day',
                c.isCurrentMonth ? '' : 'is-out',
                c.isToday ? 'is-today' : '',
                picked ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={on}
              onClick={() => setSelectedIso(iso === todayIso ? null : iso)}
            >
              <span className="wdg-cal-day-primary">{fmtPrimaryDay(c.primary, mode)}</span>
              <span className="wdg-cal-day-secondary">{fmtSecondaryDay(c.secondary, mode)}</span>
            </button>
          );
        })}
      </div>

      <div className="wdg-cal-footer">
        <button type="button" className="wdg-cal-today-btn" onClick={goToday}>
          {tr('امروز')}
        </button>
        <span className="wdg-cal-hint">
          {mode === 'jalali' ? tr('اصلی شمسی · فرعی میلادی') : tr('اصلی میلادی · فرعی شمسی')}
        </span>
      </div>
    </div>
  );
}
