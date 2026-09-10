import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  AdminBarChart,
  AdminDonutChart,
  AdminFunnelChart,
  AdminLineChart,
  AdminMultiLineChart,
} from '../FinanceCharts';
import { aggregateByGrain, canDrillDown } from './drill';
import {
  CategoryDrillDetail,
  DrillToolbar,
  useCategoryDrill,
  useTimeDrill,
} from './DrillControls';
import type { ChartPoint, WidgetRenderContext } from './types';

type MultiSeries = Array<{ key: string; label: string; color: string; points: ChartPoint[] }>;

export function TimeLineWidget({
  points,
  color,
  ctx,
}: {
  points: ChartPoint[];
  color: string;
  ctx: WidgetRenderContext;
}) {
  const drill = useTimeDrill(points);
  return (
    <div className="wdg-chart">
      <DrillToolbar
        mode="time"
        grain={drill.grain}
        baseGrain={drill.baseGrain}
        onDrillUp={drill.drillUp}
        onDrillDown={drill.drillDown}
      />
      <AdminLineChart
        points={drill.view}
        color={color}
        height={ctx.chartHeight}
        onPointClick={() => {
          if (canDrillDown(drill.grain, drill.baseGrain)) drill.drillDown();
        }}
      />
    </div>
  );
}

export function TimeBarWidget({
  points,
  color,
  ctx,
}: {
  points: ChartPoint[];
  color: string;
  ctx: WidgetRenderContext;
}) {
  const drill = useTimeDrill(points);
  return (
    <div className="wdg-chart">
      <DrillToolbar
        mode="time"
        grain={drill.grain}
        baseGrain={drill.baseGrain}
        onDrillUp={drill.drillUp}
        onDrillDown={drill.drillDown}
      />
      <AdminBarChart
        points={drill.view}
        color={color}
        height={ctx.chartHeight}
        onSliceClick={() => {
          if (canDrillDown(drill.grain, drill.baseGrain)) drill.drillDown();
        }}
      />
    </div>
  );
}

export function TimeMultiLineWidget({
  series,
  ctx,
}: {
  series: MultiSeries;
  ctx: WidgetRenderContext;
}) {
  const longest = useMemo(() => {
    if (!series.length) return [] as ChartPoint[];
    return series.reduce((best, s) => (s.points.length > best.length ? s.points : best), series[0]!.points);
  }, [series]);
  const drill = useTimeDrill(longest);
  const aggSeries = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        points: aggregateByGrain(s.points, drill.grain, drill.baseGrain),
      })),
    [series, drill.grain, drill.baseGrain]
  );
  return (
    <div className="wdg-chart">
      <DrillToolbar
        mode="time"
        grain={drill.grain}
        baseGrain={drill.baseGrain}
        onDrillUp={drill.drillUp}
        onDrillDown={drill.drillDown}
      />
      <AdminMultiLineChart
        series={aggSeries}
        height={ctx.chartHeight}
        onPointClick={() => {
          if (canDrillDown(drill.grain, drill.baseGrain)) drill.drillDown();
        }}
      />
    </div>
  );
}

export function CategoryBarWidget({
  points,
  color,
  ctx,
  onSliceClick,
}: {
  points: ChartPoint[];
  color: string;
  ctx: WidgetRenderContext;
  onSliceClick?: (p: ChartPoint) => void;
}) {
  const drill = useCategoryDrill(points);
  return (
    <div className="wdg-chart">
      <DrillToolbar mode="category" selectedCategory={drill.selected} onClearCategory={drill.clear} />
      <AdminBarChart
        points={drill.view}
        color={color}
        height={ctx.chartHeight}
        onSliceClick={(p) => {
          if (!drill.selected) drill.select(p.label);
          onSliceClick?.(p);
        }}
      />
      <CategoryDrillDetail detail={drill.detail} />
    </div>
  );
}

export function CategoryDonutWidget({
  slices,
  ctx,
  onSliceClick,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  ctx: WidgetRenderContext;
  onSliceClick?: (s: { label: string; value: number; color: string }) => void;
}) {
  const points = slices.map((s) => ({ label: s.label, value: s.value }));
  const drill = useCategoryDrill(points);
  const viewSlices = drill.selected ? slices.filter((s) => s.label === drill.selected) : slices;
  return (
    <div className="wdg-chart">
      <DrillToolbar mode="category" selectedCategory={drill.selected} onClearCategory={drill.clear} />
      <AdminDonutChart
        slices={viewSlices}
        size={ctx.donutSize}
        onSliceClick={(s) => {
          if (!drill.selected) drill.select(s.label);
          onSliceClick?.(s);
        }}
      />
      <CategoryDrillDetail detail={drill.detail} />
    </div>
  );
}

export function CategoryFunnelWidget({
  points,
  ctx,
  onSliceClick,
}: {
  points: ChartPoint[];
  ctx: WidgetRenderContext;
  onSliceClick?: (p: ChartPoint) => void;
}) {
  const drill = useCategoryDrill(points);
  return (
    <div className="wdg-chart">
      <DrillToolbar mode="category" selectedCategory={drill.selected} onClearCategory={drill.clear} />
      <AdminFunnelChart
        points={drill.view}
        height={Math.max(ctx.chartHeight, drill.view.length * 36 + 8)}
        onSliceClick={(p) => {
          if (!drill.selected) drill.select(p.label);
          onSliceClick?.(p);
        }}
      />
      <CategoryDrillDetail detail={drill.detail} />
    </div>
  );
}

export function WidgetEmpty(): ReactNode {
  return <p className="admin-muted">داده‌ای برای نمودار نیست</p>;
}
