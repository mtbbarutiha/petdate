/** Power-BI-inspired admin widget dashboard types. */

export type ChartPoint = { label: string; value: number };

export type TimeGrain = 'day' | 'week' | 'month';

export const TIME_GRAINS: TimeGrain[] = ['day', 'week', 'month'];

export type WidgetColSpan = 1 | 2 | 3 | 4;
export type WidgetRowSpan = 1 | 2 | 3;

export type WidgetLayoutItem = {
  /** Catalog widget id — stable per-user layout slot (resize / reorder key). */
  id: string;
  w: WidgetColSpan;
  h: WidgetRowSpan;
  order: number;
};

export type WidgetCatalogItem = {
  id: string;
  title: string;
  group: string;
  description?: string;
  defaultW?: WidgetColSpan;
  defaultH?: WidgetRowSpan;
  drill?: 'time' | 'category' | 'none';
};

export type WidgetBoardState = {
  version: 1;
  items: WidgetLayoutItem[];
  removed: string[];
};

export type WidgetRenderContext = {
  w: WidgetColSpan;
  h: WidgetRowSpan;
  chartHeight: number;
  donutSize: number;
};
