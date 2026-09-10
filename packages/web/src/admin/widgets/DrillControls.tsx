import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GRAIN_LABEL,
  canDrillDown,
  canDrillUp,
  categoryDrillDetail,
  detectTimeGrain,
  drillDownGrain,
  drillUpGrain,
  formatFocusLabel,
  timeDrillView,
} from './drill';
import type { ChartPoint, TimeGrain } from './types';

type TimeDrillState = {
  grain: TimeGrain;
  focusStack: string[];
};

function climbGrain(grain: TimeGrain, steps: number): TimeGrain {
  let next = grain;
  for (let i = 0; i < steps; i++) next = drillUpGrain(next);
  return next;
}

export function DrillToolbar({
  mode,
  grain,
  baseGrain,
  focusStack = [],
  selectedCategory,
  canUp,
  canDown,
  onDrillUp,
  onDrillDown,
  onClearCategory,
  onCrumbClick,
}: {
  mode: 'time' | 'category' | 'none';
  grain?: TimeGrain;
  baseGrain?: TimeGrain;
  focusStack?: string[];
  selectedCategory?: string | null;
  canUp?: boolean;
  canDown?: boolean;
  onDrillUp?: () => void;
  onDrillDown?: () => void;
  onClearCategory?: () => void;
  /** Jump to breadcrumb index (-1 = root / all). */
  onCrumbClick?: (index: number) => void;
}) {
  if (mode === 'none') return null;

  if (mode === 'time' && grain && baseGrain) {
    const up = canUp ?? (canDrillUp(grain) || focusStack.length > 0);
    const down = canDown ?? canDrillDown(grain, baseGrain);
    return (
      <div className="wdg-drill" role="group" aria-label="دریل نمودار">
        <span className="wdg-drill-grain" title="دانهٔ زمانی فعلی">
          {GRAIN_LABEL[grain]}
        </span>
        <nav className="wdg-drill-crumbs" aria-label="مسیر دریل">
          <button
            type="button"
            className={`wdg-drill-crumb${focusStack.length === 0 ? ' is-active' : ''}`}
            onClick={() => onCrumbClick?.(-1)}
            disabled={focusStack.length === 0}
            title="بازگشت به نمای کلی"
          >
            همه
          </button>
          {focusStack.map((key, i) => (
            <span key={`${key}-${i}`} className="wdg-drill-crumb-wrap">
              <span className="wdg-drill-sep" aria-hidden>
                ‹
              </span>
              <button
                type="button"
                className={`wdg-drill-crumb${i === focusStack.length - 1 ? ' is-active' : ''}`}
                onClick={() => onCrumbClick?.(i)}
                disabled={i === focusStack.length - 1}
                title={key}
              >
                {formatFocusLabel(key)}
              </button>
            </span>
          ))}
        </nav>
        <button
          type="button"
          className="wdg-drill-btn"
          disabled={!up}
          onClick={onDrillUp}
          title="بازگشت به سطح قبلی (دریل‌آپ)"
        >
          دریل‌آپ
        </button>
        <button
          type="button"
          className="wdg-drill-btn"
          disabled={!down}
          onClick={onDrillDown}
          title="یک سطح جزئی‌تر بدون فیلتر برش"
        >
          دریل‌دان
        </button>
        {down ? <span className="wdg-drill-hint">کلیک روی نقطه = دریل‌دان همان بازه</span> : null}
      </div>
    );
  }

  if (mode === 'category') {
    return (
      <div className="wdg-drill" role="group" aria-label="دریل دسته">
        <nav className="wdg-drill-crumbs" aria-label="مسیر دریل">
          <button
            type="button"
            className={`wdg-drill-crumb${!selectedCategory ? ' is-active' : ''}`}
            onClick={onClearCategory}
            disabled={!selectedCategory}
          >
            همه
          </button>
          {selectedCategory ? (
            <span className="wdg-drill-crumb-wrap">
              <span className="wdg-drill-sep" aria-hidden>
                ‹
              </span>
              <span className="wdg-drill-crumb is-active">{selectedCategory}</span>
            </span>
          ) : null}
        </nav>
        {selectedCategory ? (
          <button type="button" className="wdg-drill-btn" onClick={onClearCategory} title="بازگشت به همه دسته‌ها">
            دریل‌آپ
          </button>
        ) : (
          <span className="wdg-drill-hint">کلیک روی برش = دریل‌دان</span>
        )}
      </div>
    );
  }

  return null;
}

export function useTimeDrill(points: ChartPoint[]) {
  const baseGrain = useMemo(() => detectTimeGrain(points), [points]);
  const [state, setState] = useState<TimeDrillState>({ grain: baseGrain, focusStack: [] });

  useEffect(() => {
    setState((prev) => {
      const grain =
        canDrillDown(prev.grain, baseGrain) || prev.grain === baseGrain ? prev.grain : baseGrain;
      return { grain, focusStack: [] };
    });
  }, [baseGrain]);

  const effectiveGrain =
    canDrillDown(state.grain, baseGrain) || state.grain === baseGrain ? state.grain : baseGrain;

  const view = useMemo(
    () => timeDrillView(points, effectiveGrain, baseGrain, state.focusStack),
    [points, effectiveGrain, baseGrain, state.focusStack]
  );

  const canUp = canDrillUp(effectiveGrain) || state.focusStack.length > 0;
  const canDown = canDrillDown(effectiveGrain, baseGrain);

  const drillUp = useCallback(() => {
    setState((prev) => {
      if (prev.focusStack.length) {
        return {
          grain: drillUpGrain(prev.grain),
          focusStack: prev.focusStack.slice(0, -1),
        };
      }
      if (!canDrillUp(prev.grain)) return prev;
      return { ...prev, grain: drillUpGrain(prev.grain) };
    });
  }, []);

  const drillDown = useCallback(() => {
    setState((prev) => {
      if (!canDrillDown(prev.grain, baseGrain)) return prev;
      return { ...prev, grain: drillDownGrain(prev.grain, baseGrain) };
    });
  }, [baseGrain]);

  /** Click a chart bucket: filter to that key and move one grain finer. */
  const drillInto = useCallback(
    (label: string) => {
      if (!label || !canDrillDown(effectiveGrain, baseGrain)) return false;
      setState((prev) => {
        const g =
          canDrillDown(prev.grain, baseGrain) || prev.grain === baseGrain ? prev.grain : baseGrain;
        if (!canDrillDown(g, baseGrain)) return prev;
        return {
          grain: drillDownGrain(g, baseGrain),
          focusStack: [...prev.focusStack, label],
        };
      });
      return true;
    },
    [effectiveGrain, baseGrain]
  );

  const goToCrumb = useCallback((index: number) => {
    setState((prev) => {
      const targetLen = index < 0 ? 0 : Math.min(index + 1, prev.focusStack.length);
      const remove = prev.focusStack.length - targetLen;
      if (remove <= 0 && index >= 0) return prev;
      return {
        grain: climbGrain(prev.grain, remove),
        focusStack: prev.focusStack.slice(0, targetLen),
      };
    });
  }, []);

  return {
    baseGrain,
    grain: effectiveGrain,
    focusStack: state.focusStack,
    view,
    canUp,
    canDown,
    drillUp,
    drillDown,
    drillInto,
    goToCrumb,
  };
}

export function useCategoryDrill(points: ChartPoint[]) {
  const [selected, setSelected] = useState<string | null>(null);
  const { view, detail, missing } = useMemo(
    () => categoryDrillDetail(points, selected),
    [points, selected]
  );

  useEffect(() => {
    if (selected && !points.some((p) => p.label === selected)) {
      setSelected(null);
    }
  }, [points, selected]);

  return {
    selected,
    view,
    detail,
    missing,
    select: (label: string) => setSelected(label),
    clear: () => setSelected(null),
  };
}

export function CategoryDrillDetail({
  detail,
  extra,
}: {
  detail: ChartPoint | null;
  extra?: ReactNode;
}) {
  if (!detail) return null;
  return (
    <div className="wdg-drill-detail">
      <strong>{detail.label}</strong>
      <span>{detail.value.toLocaleString('fa-IR')}</span>
      {extra}
    </div>
  );
}
