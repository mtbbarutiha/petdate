/**
 * فروش Pet Date — Sales CRM shared types (single product org, no business lines).
 */

export const SALES_ITEM_KINDS = ['lead', 'upgrade'] as const;
export type SalesItemKind = (typeof SALES_ITEM_KINDS)[number];

export const SALES_STAGES = [
  'جدید',
  'تخصیص‌یافته',
  'در حال تماس',
  'متصل‌شده',
  'واجد شرایط',
  'پیشنهاد ارسالی',
  'در انتظار پرداخت',
  'برنده',
] as const;

export const SALES_LEAD_SOURCES = [
  'اینستاگرام','گوگل ادز','ارگانیک','وبسایت','لندینگ‌پیج','تلگرام',
  'ریفرال','رویداد','آفلاین','پارتنر','لیست وارداتی','سایر',
] as const;

export const SALES_LOST_REASONS = [
  'قیمت','نبود بودجه','نیاز نداشتن','بدون پاسخ','رقیب','زمان‌بندی',
  'مشکل پرداخت','عدم تطابق محصول','تجربه ضعیف','مشکل پشتیبانی',
  'تصمیم به تعویق افتاد','تکراری','لید نامعتبر','سایر',
] as const;

export const SALES_CALL_RESULTS = [
  'علاقه‌مند','بی‌علاقه','تماس بعدی','نیاز به اطلاعات بیشتر','در انتظار پرداخت',
  'واجد شرایط','ازدست‌رفته','شماره اشتباه','عدم دسترسی',
] as const;

export const SALES_FOLLOWUP_TYPES = ['تماس پیگیری','پیامک','ایمیل','تلگرام','واتساپ'] as const;
export const SALES_PRIORITIES = ['بحرانی','بالا','متوسط','پایین'] as const;
export const SALES_PAYMENT_TYPES = ['لینک پرداخت کامل','لینک پرداخت پیش‌پرداخت','اسنپ‌پی','کارت به کارت'] as const;
export const SALES_PAY_STATUSES = ['بدون پرداخت','لینک ارسال‌شده','در حال بررسی مالی','پرداخت‌شده','رد شده مالی','ناموفق'] as const;
export const SALES_TICKET_DEPTS = ['مالی','پشتیبانی فنی','تحویل محصول','سایر'] as const;
export const SALES_TICKET_CATEGORIES = ['استعلام مالی','مشکل فنی','تحویل','سایر'] as const;
export const SALES_TICKET_STATUSES = ['جدید','در حال بررسی','حل‌شده','رد شده','بسته‌شده'] as const;
export const SALES_CUSTOMER_LEVELS = ['عادی','نقره‌ای','طلایی'] as const;
export const SALES_MESSAGE_CHANNELS = ['پیامک','واتساپ','تلگرام','بله','ایمیل'] as const;

export const SALES_DEFAULT_PRODUCTS = [
  { name: 'اشتراک ماهانه Pet Date', price: 490_000 },
  { name: 'اشتراک سه‌ماهه Pet Date', price: 1_290_000 },
  { name: 'اشتراک سالانه Pet Date', price: 3_900_000 },
  { name: 'بسته پرمیوم همبازی', price: 790_000 },
  { name: 'پکیج مشاوره دامپزشک', price: 1_500_000 },
  { name: 'پکیج مربیگری پت', price: 2_200_000 },
] as const;

export type SalesStage = number | 'lost';

export interface SalesProduct {
  id: number; name: string; price: number; active: boolean; createdAt: string;
}
export interface SalesItem {
  id: number; publicId: string; kind: SalesItemKind; first: string; last: string;
  mobile: string; email: string | null; product: string; source: string; score: number;
  ownerId: string | null; ownerName: string | null; stage: SalesStage; value: number;
  discount: number; createdAt: string; lastActivity: string; nextFollowup: string | null;
  lostReason: string | null; customerId: number | null; payStatus: string; payType: string | null;
}
export interface SalesActivity { id: number; itemId: number; at: string; text: string; kind: string; }
export interface SalesCall {
  id: number; refKind: SalesItemKind; refId: number; agentId: string; agentName: string | null;
  dir: 'call_out' | 'call_in'; startedAt: string; talk: number; result: string; summary: string;
  qaStatus: string; qaScore: number | null;
}
export interface SalesFollowup {
  id: number; refKind: SalesItemKind | null; refId: number | null; ownerId: string;
  type: string; at: string; priority: string; desc: string; status: 'باز' | 'انجام‌شده';
}
export interface SalesOffer {
  id: number; refKind: SalesItemKind; refId: number; product: string; price: number;
  discount: number; final: number; approvalNeeded: boolean; approvalStatus: string;
  createdBy: string; at: string;
}
export interface SalesPayment {
  id: number; refKind: SalesItemKind; refId: number; amount: number; type: string; status: string; at: string;
}
export interface SalesTicket {
  id: number; publicId: string; refKind: SalesItemKind | null; refId: number | null;
  customerId: number | null; paymentId: number | null; title: string; dept: string; cat: string;
  priority: string; status: string; createdAt: string; slaDue: string; desc: string; agentId: string;
}
export interface SalesCustomer {
  id: number; publicId: string; first: string; last: string; mobile: string; email: string | null;
  level: string; salesOwner: string; createdAt: string; csat: number | null; sourceLeadId: number | null;
  orderSum?: number; orderCount?: number; lastOrderAt?: string | null; daysSinceLastPurchase?: number | null;
  openTickets?: number; openFollowups?: number;
}
export interface SalesOrder { id: number; customerId: number; product: string; amount: number; at: string; }
export interface SalesSurvey { id: number; customerId: number; score: number; comment: string; channel: string; at: string; }
export interface SalesPattern { id: number; channel: string; name: string; text: string; active: boolean; }
export interface SalesMessage {
  id: number; refKind: SalesItemKind; refId: number; channel: string; patternId: number | null;
  patternName: string; text: string; at: string; by: string;
}
export interface SalesGoal {
  id: number; name: string; team: string; periodFrom: string | null; periodTo: string | null;
  active: boolean; createdAt: string; createdBy: string; metrics: Record<string, number>;
}
export interface SalesDashboard {
  greetingName: string; callsToday: number; callMinutesToday: number; overdueFollowups: number;
  salesTodayCount: number; salesTodayValue: number; aov: number; activeLeads: number;
  activeUpgrades: number; totalWonValue: number; pendingFinance: number; unassigned: number;
  nextActions: SalesItem[]; myFollowups: SalesFollowup[]; stageCounts: { stage: string; count: number }[];
}
export interface SalesReportSummary {
  aov: number; revenue: number; salesCount: number; callsCount: number; callMinutes: number;
  dailyRevenue: { day: string; value: number }[]; dailyCalls: { day: string; count: number }[];
  bySource: { source: string; value: number }[];
  byAgent: { agentId: string; agentName: string; calls: number; sales: number; revenue: number }[];
}
export interface SalesSettings {
  leadSources: string[]; lostReasons: string[]; discountLimits: Record<string, number>;
}

export function salesStageLabel(stage: SalesStage): string {
  if (stage === 'lost') return 'ازدست‌رفته';
  const n = Number(stage);
  if (Number.isFinite(n) && n >= 0 && n < SALES_STAGES.length) return SALES_STAGES[n];
  return String(stage);
}
export function makeSalesPublicId(kind: SalesItemKind, id: number): string {
  return `${kind === 'lead' ? 'LD' : 'UP'}-${String(Math.trunc(id)).padStart(4, '0')}`;
}
export function makeSalesCustomerPublicId(id: number): string {
  return `CU-${String(Math.trunc(id)).padStart(4, '0')}`;
}
export function makeSalesTicketPublicId(id: number): string {
  return `TK-${String(Math.trunc(id)).padStart(4, '0')}`;
}
