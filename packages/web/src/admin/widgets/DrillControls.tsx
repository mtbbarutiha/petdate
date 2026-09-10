import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  aggregateByGrain,
  canDrillDown,
  canDrillUp,
  categoryDrillDetail,
  detectTimeGrain,
  drillDownGrain,
  drillUpGrain,
} from './drill';
import type { ChartPoint, TimeGrain } from './types';

const GRAIN_LABEL: Record<TimeGrain, string> = {
  day: 'روز',
  week: 'هفته',
  month: 'ماه',
};

export function DrillToolbar({
  mode,
  grain,
  baseGrain,
  selectedCategory,
  onDrillUp,
  onDrillDown,
  onClearCategory,
}: {
  mode: 'time' | 'category' | 'none';
  grain?: TimeGrain;
  baseGrain?: TimeGrain;
  selectedCategory?: string | null;
  onDrillUp?: () => void;
  onDrillDown?: () => void;
  onClearCategory?: () => void;
}) {
  if (mode === 'none') return null;

  if (mode === 'time' && grain && baseGrain) {
    const up = canDrillUp(grain);
    const down = canDrillDown(grain, baseGrain);
    return (
      <div className="wdg-drill" role="group" aria-label="دریل نمودار">
        <span className="wdg-drill-grain">{GRAIN_LABEL[grain]}</span>
        <button
          type="button"
          className="wdg-drill-btn"
          disabled={!up}
          onClick={onDrillUp}
          title="تجمیع درشت‌تر (هفته / ماه)"
        >
          دریل‌آپ
        </button>
        <button
          type="button"
          className="wdg-drill-btn"
          disabled={!down}
          onClick={onDrillDown}
          title="جزئی‌تر (روز)"
        >
          دریل‌دان
        </button>
      </div>
    );
  }

  if (mode === 'category') {
    return (
      <div className="wdg-drill" role="group" aria-label="دریل دسته">
        {selectedCategory ? (
          <>
            <span className="wdg-drill-grain">{selectedCategory}</span>
            <button type="button" className="wdg-drill-btn" onClick={onClearCategory}>
              دریل‌آپ
            </button>
          </>
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
  const [grain, setGrain] = useState<TimeGrain>(baseGrain);

  useEffect(() => {
    setGrain((g) => (canDrillDown(g, baseGrain) || g === baseGrain ? g : baseGrain));
  }, [baseGrain]);

  const effectiveGrain =
    canDrillDown(grain, baseGrain) || grain === baseGrain ? grain : baseGrain;
  const view = useMemo(
    () => aggregateByGrain(points, effectiveGrain, baseGrain),
    [points, effectiveGrain, baseGrain]
  );

  return {
    baseGrain,
    grain: effectiveGrain,
    view,
    drillUp: () => setGrain((g) => drillUpGrain(g)),
    drillDown: () => setGrain((g) => drillDownGrain(g, baseGrain)),
  };
}

export function useCategoryDrill(points: ChartPoint[]) {
  const [selected, setSelected] = useState<string | null>(null);
  const { view, detail } = useMemo(
    () => categoryDrillDetail(points, selected),
    [points, selected]
  );
  return {
    selected,
    view,
    detail,
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
