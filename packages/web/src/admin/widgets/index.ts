export type {
  ChartPoint,
  TimeGrain,
  WidgetBoardState,
  WidgetCatalogItem,
  WidgetColSpan,
  WidgetLayoutItem,
  WidgetRenderContext,
  WidgetRowSpan,
} from './types';
export { TIME_GRAINS } from './types';
export {
  aggregateByGrain,
  canDrillDown,
  canDrillUp,
  categoryDrillDetail,
  chartHeightForRow,
  detectTimeGrain,
  donutSizeForRow,
  drillDownGrain,
  drillUpGrain,
  filterPointsByFocus,
  formatFocusLabel,
  GRAIN_LABEL,
  parsePointDate,
  pointMatchesFocusKey,
  timeDrillView,
} from './drill';
export {
  addItem,
  clearBoard,
  defaultBoard,
  emptyDailyNotes,
  isDefaultBoard,
  layoutPrefKey,
  loadBoard,
  normalizeBoard,
  normalizeDailyNotes,
  parseRemoteBoard,
  removeItem,
  reorderItems,
  resetBoard,
  resolveHydratedBoard,
  resizeItem,
  saveBoard,
  setDailyNote,
  storageKeyFor,
} from './layoutStorage';
export {
  PLATFORM_WIDGET_CATALOG,
  FINANCE_WIDGET_CATALOG,
  FINANCE_SALES_WIDGET_CATALOG,
  defaultBoardItems,
  DAILY_NOTES_WIDGET_ID,
  DUAL_CALENDAR_WIDGET_ID,
} from './catalogs';
export { WidgetDashboard } from './WidgetDashboard';
export {
  CategoryDrillDetail,
  DrillToolbar,
  useCategoryDrill,
  useTimeDrill,
} from './DrillControls';
export {
  CategoryBarWidget,
  CategoryDonutWidget,
  CategoryFunnelWidget,
  TimeBarWidget,
  TimeLineWidget,
  TimeMultiLineWidget,
  WidgetEmpty,
} from './ChartWidgets';
export { CalendarWidget } from './CalendarWidget';
export { DailyNotesWidget } from './DailyNotesWidget';
export {
  DashboardSelectedDateProvider,
  useDashboardSelectedDate,
} from './DashboardSelectedDate';
export { useWidgetLayout, useWidgetUserKey } from './useWidgetLayout';

// Re-export motion primitives so all admin panels share one kit
export {
  AdminHProgress,
  AdminMotionGauge,
  AdminProgressRing,
  AdminSparkline,
  MOTION_DUR_MS,
  MOTION_PALETTE,
  MotionAreaGradientDefs,
  MotionBarGradientDefs,
  MotionChartTooltip,
  usePrefersReducedMotion,
  useRechartsMotion,
} from '../motionCharts';
