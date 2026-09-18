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
import { tr } from '../../i18n';
import { useDashboardDrill } from './DashboardDrillContext';

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
      <div className="wdg-drill" role="group" aria-label={tr("دریل نمودار")}>
        <span className="wdg-drill-grain" title={tr("دانهٔ زمانی فعلی")}>
          {tr(GRAIN_LABEL[grain])}
        </span>
        <nav className="wdg-drill-crumbs" aria-label={tr("مسیر دریل")}>
          <button
            type="button"
            className={`wdg-drill-crumb${focusStack.length === 0 ? ' is-active' : ''}`}
            onClick={() => onCrumbClick?.(-1)}
            disabled={focusStack.length === 0 && grain === baseGrain}
            title={tr("بازگشت به نمای کلی")}
          >
            {tr('همه')}
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
          title={tr("بازگشت به سطح قبلی (دریل‌آپ)")}
        >
          {tr('دریل‌آپ')}
        </button>
        <button
          type="button"
          className="wdg-drill-btn"
          disabled={!down}
          onClick={onDrillDown}
          title={tr("یک سطح جزئی‌تر بدون فیلتر برش")}
        >
          {tr('دریل‌دان')}
        </button>
        {down ? <span className="wdg-drill-hint">{tr('کلیک روی نقطه = دریل‌دان همان بازه')}</span> : null}
      </div>
    );
  }

  if (mode === 'category') {
    return (
      <div className="wdg-drill" role="group" aria-label={tr("دریل دسته")}>
        <nav className="wdg-drill-crumbs" aria-label={tr("مسیر دریل")}>
          <button
            type="button"
            className={`wdg-drill-crumb${!selectedCategory ? ' is-active' : ''}`}
            onClick={onClearCategory}
            disabled={!selectedCategory}
          >
            {tr('همه')}
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
          <button type="button" className="wdg-drill-btn" onClick={onClearCategory} title={tr("بازگشت به همه دسته‌ها")}>
            {tr('دریل‌آپ')}
          </button>
        ) : (
          <span className="wdg-drill-hint">{tr('کلیک روی برش = دریل‌دان')}</span>
        )}
      </div>
    );
  }

  return null;
}

export function useTimeDrill(points: ChartPoint[]) {
  const shared = useDashboardDrill();
  const baseGrain = useMemo(() => detectTimeGrain(points), [points]);
  const [state, setState] = useState<TimeDrillState>({ grain: baseGrain, focusStack: [] });

  useEffect(() => {
    setState((prev) => {
      const grain =
        canDrillDown(prev.grain, baseGrain) || prev.grain === baseGrain ? prev.grain : baseGrain;
      return { grain, focusStack: [] };
    });
  }, [baseGrain]);

  const localGrain =
    canDrillDown(state.grain, baseGrain) || state.grain === baseGrain ? state.grain : baseGrain;
  const effectiveGrain = shared ? shared.state.grain : localGrain;
  const focusStack = shared ? shared.state.focusStack : state.focusStack;

  const view = useMemo(
    () => timeDrillView(points, effectiveGrain, shared ? shared.state.baseGrain : baseGrain, focusStack),
    [points, effectiveGrain, baseGrain, focusStack, shared]
  );

  const canUp = shared
    ? !shared.isInitial
    : canDrillUp(effectiveGrain) || state.focusStack.length > 0;
  const canDown = canDrillDown(effectiveGrain, shared ? shared.state.baseGrain : baseGrain);
  const canInto = true;

  const drillUp = useCallback(() => {
    if (shared) {
      if (
        shared.state.focusStack.length === 0 &&
        shared.state.grain === 'month' &&
        !shared.state.category
      ) {
        shared.dispatch({ type: 'reset' });
        return;
      }
      shared.dispatch({ type: 'drillUp' });
      return;
    }
    setState((prev) => {
      if (prev.focusStack.length) {
        return {
          grain: drillUpGrain(prev.grain),
          focusStack: prev.focusStack.slice(0, -1),
        };
      }
      if (!canDrillUp(prev.grain)) return { grain: baseGrain, focusStack: [] };
      return { ...prev, grain: drillUpGrain(prev.grain) };
    });
  }, [shared, baseGrain]);

  const drillDown = useCallback(() => {
    if (shared) {
      shared.dispatch({ type: 'drillDown' });
      return;
    }
    setState((prev) => {
      if (!canDrillDown(prev.grain, baseGrain)) return prev;
      return { ...prev, grain: drillDownGrain(prev.grain, baseGrain) };
    });
  }, [baseGrain, shared]);

  /** Click a chart bucket: filter the whole board to that key and move one grain finer. */
  const drillInto = useCallback(
    (label: string) => {
      if (!label) return false;
      if (shared) {
        shared.dispatch({ type: 'drillInto', label });
        return true;
      }
      setState((prev) => {
        const g =
          canDrillDown(prev.grain, baseGrain) || prev.grain === baseGrain ? prev.grain : baseGrain;
        const canRefine = canDrillDown(g, baseGrain);
        return {
          grain: canRefine ? drillDownGrain(g, baseGrain) : g,
          focusStack: [...prev.focusStack, label],
        };
      });
      return true;
    },
    [baseGrain, shared]
  );

  const goToCrumb = useCallback((index: number) => {
    if (shared) {
      shared.dispatch({ type: 'crumb', index });
      return;
    }
    setState((prev) => {
      if (index < 0) return { grain: baseGrain, focusStack: [] };
      const targetLen = Math.min(index + 1, prev.focusStack.length);
      const remove = prev.focusStack.length - targetLen;
      if (remove <= 0) return prev;
      return {
        grain: climbGrain(prev.grain, remove),
        focusStack: prev.focusStack.slice(0, targetLen),
      };
    });
  }, [shared, baseGrain]);

  return {
    baseGrain: shared ? shared.state.baseGrain : baseGrain,
    grain: effectiveGrain,
    focusStack,
    view,
    canUp,
    canDown,
    canInto,
    drillUp,
    drillDown,
    drillInto,
    goToCrumb,
  };
}

export function useCategoryDrill(points: ChartPoint[]) {
  const shared = useDashboardDrill();
  const [localSelected, setSelected] = useState<string | null>(null);
  const selected = shared ? shared.state.category : localSelected;
  const { view, detail, missing } = useMemo(
    () => categoryDrillDetail(points, selected),
    [points, selected]
  );

  useEffect(() => {
    if (selected && !points.some((p) => p.label === selected)) {
      if (shared) shared.dispatch({ type: 'selectCategory', label: null });
      else setSelected(null);
    }
  }, [points, selected, shared]);

  return {
    selected,
    view,
    detail,
    missing,
    select: (label: string) => {
      if (shared) shared.dispatch({ type: 'selectCategory', label });
      else setSelected(label);
    },
    clear: () => {
      if (shared) shared.dispatch({ type: 'selectCategory', label: null });
      else setSelected(null);
    },
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
      <strong>{tr(detail.label)}</strong>
      <span>{detail.value.toLocaleString('fa-IR')}</span>
      {extra}
    </div>
  );
}
