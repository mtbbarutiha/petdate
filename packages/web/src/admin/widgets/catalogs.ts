import type { WidgetCatalogItem, WidgetLayoutItem } from './types';

export const PLATFORM_WIDGET_CATALOG: WidgetCatalogItem[] = [
  { id: 'moduleMix', title: 'ترکیب بار ماژول‌ها', group: 'گزارش تجمیعی', drill: 'category', defaultW: 1, defaultH: 1 },
  { id: 'volume14d', title: 'حجم تعامل ۱۴ روز اخیر', group: 'گزارش تجمیعی', drill: 'time', defaultW: 2, defaultH: 1 },
  { id: 'activityBreakdown', title: 'توزیع فعالیت‌ها', group: 'گزارش تجمیعی', drill: 'category', defaultW: 1, defaultH: 1 },
  { id: 'revenueTrend', title: 'درآمد فروشگاه (ماه)', group: 'فروش / مالی', drill: 'time', defaultW: 2, defaultH: 1 },
  { id: 'salesFunnel', title: 'قیف فروش', group: 'فروش / مالی', drill: 'category', defaultW: 1, defaultH: 1 },
  { id: 'paymentMix', title: 'ترکیب پرداخت', group: 'فروش / مالی', drill: 'category', defaultW: 1, defaultH: 1 },
  { id: 'crmTickets', title: 'تیکت‌های باشگاه مشتریان', group: 'پشتیبانی', drill: 'time', defaultW: 2, defaultH: 1 },
  { id: 'crmReasons', title: 'دلایل تماس / تعامل CRM', group: 'پشتیبانی', drill: 'category', defaultW: 2, defaultH: 1 },
  { id: 'salesDailyRevenue', title: 'درآمد روزانهٔ فروش CRM', group: 'فروش CRM', drill: 'time', defaultW: 2, defaultH: 1 },
  { id: 'salesDailyCalls', title: 'تماس‌های فروش (۱۴ روز)', group: 'فروش CRM', drill: 'time', defaultW: 2, defaultH: 1 },
  {
    id: 'dualCalendar',
    title: 'تقویم شمسی / میلادی',
    group: 'ابزارها',
    description: 'تقویم دوگانه با جابه‌جایی شمسی و میلادی',
    drill: 'none',
    defaultW: 2,
    defaultH: 2,
  },
];

export const FINANCE_WIDGET_CATALOG: WidgetCatalogItem[] = [
  { id: 'salesTrend', title: 'روند فروش', group: 'مالی', drill: 'time', defaultW: 2, defaultH: 1 },
  { id: 'pnlCompare', title: 'سود و زیان', group: 'مالی', drill: 'category', defaultW: 2, defaultH: 1 },
  { id: 'categories', title: 'فروش بر اساس دسته', group: 'مالی', drill: 'category', defaultW: 2, defaultH: 1 },
  { id: 'revenueMix', title: 'ترکیب درآمد / پرداخت', group: 'مالی', drill: 'category', defaultW: 2, defaultH: 1 },
];

export const FINANCE_SALES_WIDGET_CATALOG: WidgetCatalogItem[] = [
  { id: 'dailyOrMonthly', title: 'فروش زمانی', group: 'نمودار فروش', drill: 'time', defaultW: 4, defaultH: 1 },
  { id: 'salesCategories', title: 'فروش بر اساس دسته', group: 'نمودار فروش', drill: 'category', defaultW: 2, defaultH: 1 },
  { id: 'salesPaymentMix', title: 'ترکیب روش پرداخت', group: 'نمودار فروش', drill: 'category', defaultW: 2, defaultH: 1 },
];

export function defaultBoardItems(catalog: WidgetCatalogItem[] = PLATFORM_WIDGET_CATALOG): WidgetLayoutItem[] {
  return catalog.map((c, i) => ({
    id: c.id,
    w: c.defaultW ?? 2,
    h: c.defaultH ?? 1,
    order: i,
  }));
}
