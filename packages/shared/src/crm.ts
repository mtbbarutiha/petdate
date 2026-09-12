/**
 * باشگاه مشتریان / امور مشتریان (Customer Affairs) — shared types.
 * Single-tenant Pet Date; no business-line switching.
 */

export const CRM_PRIORITIES = ['بحرانی', 'بالا', 'متوسط', 'پایین'] as const;
export type CrmPriority = (typeof CRM_PRIORITIES)[number];

export const CRM_CHANNELS = [
  'call_in', 'call_out', 'sms', 'email', 'whatsapp', 'telegram', 'chat', 'manual',
] as const;
export type CrmChannel = (typeof CRM_CHANNELS)[number];

export const CRM_CHANNEL_LABELS: Record<CrmChannel, string> = {
  call_in: 'تماس ورودی',
  call_out: 'تماس خروجی',
  sms: 'پیامک',
  email: 'ایمیل',
  whatsapp: 'واتساپ',
  telegram: 'تلگرام',
  chat: 'چت',
  manual: 'دستی',
};

export const CRM_OUTCOMES = [
  'حل‌شده', 'پاسخ داده‌شده', 'نیازمند پیگیری', 'تیکت ایجاد شد',
  'ارجاع به مالی', 'ارجاع به فروش', 'ارجاع به سطح بالاتر',
  'در انتظار مشتری', 'تماس مجدد', 'قطع شده', 'شماره اشتباه', 'بدون پاسخ',
] as const;

export const CRM_TICKET_STATUSES = [
  'جدید', 'تخصیص‌یافته', 'در حال بررسی', 'در انتظار مشتری', 'در انتظار داخلی',
  'حل‌شده', 'بسته‌شده', 'بازگشایی‌شده', 'ارجاع به سطح بالاتر',
] as const;

/** Open statuses — SLA resolution clock runs (except pause statuses). */
export const CRM_TICKET_OPEN_STATUSES = [
  'جدید', 'تخصیص‌یافته', 'در حال بررسی', 'در انتظار مشتری', 'در انتظار داخلی',
  'ارجاع به سطح بالاتر', 'بازگشایی‌شده',
] as const;

/** Pause resolution SLA timer (awaiting customer). */
export const CRM_TICKET_PAUSE_STATUSES = ['در انتظار مشتری'] as const;

export const CRM_TICKET_CHANNELS = {
  call_in: 'تماس ورودی',
  call_out: 'تماس خروجی',
  sms: 'پیامک',
  email: 'ایمیل',
  whatsapp: 'واتساپ',
  telegram: 'تلگرام',
  chat: 'چت سایت',
  portal: 'پنل مشتری',
  web: 'فرم وب سایت',
  manual: 'ثبت دستی',
} as const;

export const CRM_TICKET_TYPES = [
  'پشتیبانی', 'شکایت', 'درخواست', 'حادثه', 'مالی', 'بازگشت وجه',
  'فروش', 'فنی', 'دسترسی', 'منابع انسانی', 'درخواست داخلی', 'تجربه مشتری', 'سایر',
] as const;

/** Type → category → subcategory (Pet Date operational taxonomy). */
export const CRM_TICKET_TAXONOMY: Record<string, Record<string, string[]>> = {
  'پشتیبانی': {
    'همبازی': ['عدم تطابق', 'لغو قرار', 'مشکل چت'],
    'پت پروفایل': ['عکس', 'ویرایش مشخصات', 'حذف'],
  },
  'شکایت': {
    'فروش': ['اطلاعات نادرست', 'عدم تماس مجدد'],
    'پشتیبانی': ['کیفیت پاسخگویی', 'تاخیر در رسیدگی'],
    'کارمند': ['برخورد نامناسب'],
  },
  'مالی': {
    'پرداخت': ['تایید تراکنش', 'تراکنش یافت نشد', 'کیف پول'],
    'فاکتور': ['درخواست فاکتور', 'اصلاح فاکتور'],
    'مغایرت': ['کسر دوباره وجه'],
  },
  'بازگشت وجه': {
    'انصراف': ['انصراف از سفارش', 'انصراف از مشاوره'],
    'خرید اشتباه': ['سفارش تکراری'],
  },
  'فروش': {
    'خرید جدید': ['محصول فروشگاه', 'اشتراک'],
    'ارتقا': ['ارتقای پلن'],
  },
  'فنی': {
    'اختلال سرویس': ['قطعی سیستم', 'کندی پنل'],
    'باگ': ['خطای نرم‌افزاری', 'نقشه همبازی'],
  },
  'دسترسی': {
    'رمز عبور': ['فراموشی رمز', 'قفل حساب'],
    'حساب کاربری': ['احراز هویت', 'تغییر نقش'],
  },
  'منابع انسانی': {
    'مرخصی': ['اصلاح کارکرد'],
    'حقوق و دستمزد': ['سوال فیش حقوقی'],
  },
  'درخواست داخلی': {
    'تجهیزات': ['درخواست تجهیزات'],
    'IT': ['دسترسی سیستم داخلی'],
  },
  'تجربه مشتری': {
    'نظرسنجی': ['نارضایتی رضایت‌سنجی'],
  },
  'حادثه': {
    'قطعی سراسری': ['عدم دسترسی همه کاربران'],
  },
  'سایر': {
    'عمومی': ['سایر موارد'],
  },
};

export const CRM_TICKET_SEVERITIES = ['بحرانی S1', 'عمده S2', 'متوسط S3', 'جزئی S4'] as const;

export const CRM_TICKET_QUEUES = [
  { id: 'q_support', name: 'پشتیبانی عمومی', team: 'امور مشتریان' },
  { id: 'q_billing', name: 'صورت‌حساب و مالی', team: 'واحد مالی' },
  { id: 'q_refund', name: 'بازگشت وجه', team: 'واحد مالی' },
  { id: 'q_tech', name: 'فنی', team: 'تیم فنی' },
  { id: 'q_vip', name: 'VIP', team: 'امور مشتریان' },
  { id: 'q_complaints', name: 'شکایات', team: 'سرپرستی امور مشتریان' },
  { id: 'q_sales', name: 'ارجاعات فروش', team: 'تیم فروش' },
] as const;

export const CRM_PENDING_REASONS = [
  'در انتظار پاسخ مشتری', 'در انتظار مالی', 'در انتظار فروش', 'در انتظار فنی',
  'در انتظار تایید مدیر', 'در انتظار مدارک', 'سایر',
] as const;

export const CRM_RESOLUTION_CODES = [
  'راهنمایی تلفنی', 'رفع فنی', 'اصلاح دسترسی', 'ارجاع و رفع مالی',
  'جایگزینی سرویس', 'آموزش مشتری', 'بدون نیاز به اقدام', 'سایر',
] as const;

export const CRM_ROOT_CAUSES = [
  'خطای کاربر', 'نقص سیستم', 'خطای فرآیند', 'خطای کارشناس', 'مشکل تامین‌کننده', 'نامشخص',
] as const;

export const CRM_REOPEN_REASONS = [
  'مشکل رفع نشده', 'بازگشت مشکل', 'راه‌حل ناقص', 'عدم موافقت مشتری', 'اطلاعات جدید',
] as const;

export function crmTicketCatsOf(type: string): string[] {
  return Object.keys(CRM_TICKET_TAXONOMY[type] || { 'عمومی': [] });
}

export function crmTicketSubsOf(type: string, cat: string): string[] {
  return (CRM_TICKET_TAXONOMY[type] || {})[cat] || ['عمومی'];
}

export function crmQueueOf(id: string | null | undefined): (typeof CRM_TICKET_QUEUES)[number] | undefined {
  return CRM_TICKET_QUEUES.find((q) => q.id === id);
}

export const CRM_CUSTOMER_LEVELS = ['عادی', 'نقره‌ای', 'طلایی', 'ویژه'] as const;
export const CRM_CUSTOMER_STATUSES = ['فعال', 'غیرفعال', 'مسدود'] as const;

export const CRM_FOLLOWUP_KINDS = ['تماس', 'پیامک', 'ایمیل', 'داخلی'] as const;
export const CRM_FOLLOWUP_STATUSES = ['باز', 'انجام‌شده', 'لغو'] as const;

export const CRM_COMPLAINT_STATUSES = ['جدید', 'در حال رسیدگی', 'حل‌شده', 'بسته‌شده'] as const;
export const CRM_REFERRAL_TYPES = ['finance', 'sales'] as const;
export const CRM_REFERRAL_STATUSES = ['باز', 'پاسخ داده‌شده', 'تایید', 'رد شد'] as const;

export const CRM_QA_STATUSES = ['در صف', 'ارزیابی‌شده', 'نیازمند کوچینگ'] as const;
export const CRM_TASK_STATUSES = ['باز', 'انجام‌شده', 'لغو'] as const;

export const CRM_SMS_TRIGGERS = [
  'after_purchase', 'ticket_created', 'ticket_resolved', 'ticket_reply', 'survey_done', 'sla_breach', 'manual',
] as const;

export const CRM_SMS_TRIGGER_LABELS: Record<(typeof CRM_SMS_TRIGGERS)[number], string> = {
  after_purchase: 'یک روز پس از خرید',
  ticket_created: 'هنگام ثبت تیکت',
  ticket_resolved: 'پس از حل تیکت',
  ticket_reply: 'پس از پاسخ عمومی پشتیبان',
  survey_done: 'پس از نظرسنجی / توسط کارشناس',
  sla_breach: 'هنگام عبور از زمان SLA',
  manual: 'ارسال دستی توسط کارشناس',
};

/** First-response minutes, resolve hours */
export const CRM_SLA_POLICY: Record<CrmPriority, [number, number]> = {
  'بحرانی': [15, 4],
  'بالا': [60, 24],
  'متوسط': [240, 72],
  'پایین': [480, 120],
};

export const CRM_REASON_TREE: Record<string, Record<string, string[]>> = {
  'اطلاعات محصول': {
    'ویژگی‌ها': ['قیمت', 'شرایط', 'ثبت‌نام'],
    'خدمات': ['نحوه ارائه', 'زمان‌بندی'],
  },
  'استفاده': {
    'ورود': ['پنل', 'اپلیکیشن', 'فراموشی رمز'],
    'فنی': ['اختلال سرویس', 'عدم پخش ویدیو', 'خطای بارگذاری'],
  },
  'شکایت': {
    'کیفیت': ['خدمات', 'پشتیبانی'],
    'مالی': ['پرداخت', 'فاکتور', 'تسویه'],
  },
  'تجربه مشتری': {
    'نظرسنجی': ['رضایت', 'پیشنهاد'],
  },
  'سایر': {
    'عمومی': ['سایر'],
  },
};

export const CRM_SURVEY_QUESTIONS = [
  'کیفیت پاسخگویی',
  'سرعت رسیدگی',
  'وضوح توضیحات',
  'حل مشکل',
  'احتمال پیشنهاد به دیگران',
] as const;

export const CRM_SCORECARD = [
  { key: 'greeting', label: 'خوش‌آمدگویی', weight: 10 },
  { key: 'listening', label: 'گوش دادن فعال', weight: 20 },
  { key: 'knowledge', label: 'دانش محصول', weight: 25 },
  { key: 'resolution', label: 'حل مسئله', weight: 25 },
  { key: 'closing', label: 'جمع‌بندی', weight: 10 },
  { key: 'tone', label: 'لحن و ادب', weight: 10 },
] as const;

export const CRM_CRITICAL_ERRORS = [
  'اطلاعات نادرست مالی',
  'توهین به مشتری',
  'افشای داده شخصی',
  'وعده غیرمجاز',
] as const;

export interface CrmCustomer {
  id: number;
  publicId: string;
  first: string;
  last: string;
  mobile: string;
  email: string | null;
  product: string;
  level: string;
  status: string;
  salesOwner: string;
  source: string;
  csat: number | null;
  platformUserId: number | null;
  salesCustomerId: number | null;
  financeSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  orderCount?: number;
  openTickets?: number;
}

export interface CrmOrder {
  id: number;
  customerId: number;
  product: string;
  amount: number;
  orderedAt: string;
}

export interface CrmInteraction {
  id: number;
  publicId: string;
  customerId: number | null;
  customerName?: string;
  customerMobile?: string;
  channel: CrmChannel;
  direction: 'in' | 'out';
  agentId: string;
  agentName: string;
  startedAt: string;
  endedAt: string | null;
  waitSeconds: number;
  talkMinutes: number;
  reason: string;
  subReason: string;
  detailReason: string;
  outcome: string;
  summary: string;
  notes: string;
  wrapDone: boolean;
  ticketId: number | null;
  referralId: number | null;
  complaintId: number | null;
  recorded: boolean;
  qaStatus: string;
  qaScore: number | null;
}

export interface CrmTicket {
  id: number;
  publicId: string;
  /** Stable RFC UUID — used to address a ticket from web/bot/admin refs. */
  uuid: string;
  customerId: number;
  customerName?: string;
  customerMobile?: string;
  customerLevel?: string;
  customerEmail?: string | null;
  interactionId: number | null;
  title: string;
  description: string;
  type: string;
  category: string;
  subCategory: string;
  channel: string;
  queueId: string;
  teamId: string | null;
  tags: string[];
  pendingReason: string | null;
  priority: CrmPriority | string;
  severity: string;
  status: string;
  agentId: string | null;
  agentName: string | null;
  supervisorId: string;
  firstResponseAt: string | null;
  firstResponseDueAt: string | null;
  slaDue: string;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenedCount: number;
  rootCause: string | null;
  resolutionCode: string | null;
  resolutionNote: string | null;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
  slaState?: 'breached' | 'at_risk' | 'ok' | 'closed' | 'paused';
  slaLabel?: string;
  borderColor?: string;
}

export interface CrmTicketActivity {
  id: number;
  ticketId: number;
  userId: string;
  userName?: string;
  kind: string;
  visibility: 'public' | 'internal' | string;
  text: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface CrmTicketingAgent {
  id: string;
  name: string;
  team: string;
  role: string;
}

export interface CrmTicketingOverview {
  tickets: CrmTicket[];
  followups: CrmFollowup[];
  referrals: CrmReferral[];
  agents: CrmTicketingAgent[];
  audit: Array<{
    id: number;
    at: string;
    userId: string;
    category: string;
    entity: string;
    recordUuid: string;
    action: string;
    prevValue: string | null;
    newValue: string | null;
  }>;
  stats: {
    open: number;
    newToday: number;
    resolvedToday: number;
    atRisk: number;
    breached: number;
    unassigned: number;
    openFollowups: number;
    openReferrals: number;
    slaPct: number;
  };
}

export interface CrmFollowup {
  id: number;
  publicId: string;
  customerId: number;
  customerName?: string;
  ticketId: number | null;
  creatorId: string;
  ownerId: string;
  ownerName: string;
  kind: string;
  dueAt: string;
  priority: string;
  description: string;
  status: string;
  result: string | null;
  createdAt: string;
}

export interface CrmComplaint {
  id: number;
  publicId: string;
  customerId: number;
  customerName?: string;
  ticketId: number | null;
  category: string;
  subCategory: string;
  severity: string;
  description: string;
  againstTeam: string;
  againstAgentId: string | null;
  supervisorId: string;
  status: string;
  rootCause: string | null;
  correctiveAction: string | null;
  resolution: string | null;
  customerFeedback: string | null;
  createdAt: string;
}

export interface CrmReferral {
  id: number;
  publicId: string;
  type: 'finance' | 'sales' | string;
  customerId: number;
  customerName?: string;
  ticketId: number | null;
  fromAgentId: string;
  targetTeam: string;
  reason: string;
  requestedAction: string;
  priority: string;
  amount: number;
  dueAt: string;
  status: string;
  response: string | null;
  createdAt: string;
}

export interface CrmSurvey {
  id: number;
  publicId: string;
  customerId: number;
  customerName?: string;
  agentId: string;
  assignedTo: string | null;
  talkMinutes: number;
  answers: Record<string, number>;
  rating: number;
  notes: string;
  smsSent: boolean;
  createdAt: string;
}

export interface CrmQaReview {
  id: number;
  publicId: string;
  interactionId: number;
  agentId: string;
  reviewerId: string;
  reason: string;
  scores: Record<string, number>;
  total: number;
  critical: string[];
  comment: string;
  strength: string;
  improvement: string;
  coaching: boolean;
  status: string;
  createdAt: string;
}

export interface CrmTask {
  id: number;
  publicId: string;
  kind: string;
  title: string;
  description: string;
  assigneeId: string;
  aboutAgentId: string | null;
  dueAt: string;
  status: string;
  priority: string;
  sourceReviewId: number | null;
  createdAt: string;
}

export interface CrmSmsPattern {
  id: number;
  publicId: string;
  name: string;
  type: 'static' | 'dynamic' | string;
  text: string;
  trigger: string;
  auto: boolean;
  active: boolean;
}

export interface CrmKpiModel {
  id: number;
  name: string;
  scope: 'team' | 'person' | string;
  ref: string;
  active: boolean;
  items: Array<{ metric: string; target: number }>;
}

export interface CrmAuditLog {
  id: number;
  at: string;
  userId: string;
  category: string;
  entity: string;
  recordUuid: string;
  action: string;
  prevValue: string | null;
  newValue: string | null;
}

export interface CrmInboxRow {
  kind: 'ticket' | 'followup' | 'interaction' | 'task' | 'complaint' | 'referral';
  id: number;
  publicId: string;
  title: string;
  customerName: string;
  customerMobile: string;
  agentName: string;
  priority: string;
  status: string;
  dueAt: string | null;
  slaState: string;
  borderColor: string;
  createdAt: string;
}

export interface CrmKpiRing {
  key: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  pct: number;
  standing: string;
  direction: 'gte' | 'lte';
}

export interface CrmChartPoint {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface CrmDashboard {
  greetingName: string;
  roleLabel: string;
  dateLabel: string;
  openTickets: number;
  breachedSla: number;
  atRiskSla: number;
  unassigned: number;
  wrapPending: number;
  openFollowups: number;
  overdueFollowups: number;
  openComplaints: number;
  openReferrals: number;
  callsToday: number;
  callMinutesToday: number;
  avgCsat: number | null;
  qaAvg: number | null;
  qaQueue: number;
  overallAchievement: number;
  overallStanding: string;
  weakPoints: string[];
  kpis: CrmKpiRing[];
  channelDistribution: CrmChartPoint[];
  dailyInteractions: CrmChartPoint[];
  ticketStatus: CrmChartPoint[];
  myTickets: CrmTicket[];
  upcomingFollowups: CrmFollowup[];
  inboxPreview: CrmInboxRow[];
  myTasks: CrmTask[];
}

/** One agent row for باشگاه مشتریان team report. */
export interface CrmAgentReportRow {
  agentId: string;
  agentName: string;
  teamLabel: string;
  inbound: number;
  outbound: number;
  minutes: number;
  aht: number;
  fcrPct: number;
  slaPct: number;
  ticketsResolved: number;
  ticketsOpen: number;
  qaAvg: number | null;
  csatAvg: number | null;
  achievement: number;
  standing: string;
}

export interface CrmReportSummary {
  ticketsResolved: number;
  ticketsOpen: number;
  avgFirstResponseMin: number | null;
  avgResolveHours: number | null;
  csatAvg: number | null;
  qaAvg: number | null;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    tickets: number;
    calls: number;
    qaAvg: number | null;
  }>;
  byReason: Array<{ reason: string; count: number }>;
  dailyTickets: Array<{ day: string; count: number }>;
  /** Inclusive range used for the team report (ISO date YYYY-MM-DD). */
  from: string;
  to: string;
  overallAchievement: number;
  overallStanding: string;
  agents: CrmAgentReportRow[];
  callReasons: CrmChartPoint[];
  ticketAge: CrmChartPoint[];
  kpiRings: CrmKpiRing[];
  totals: {
    interactions: number;
    minutes: number;
    tickets: number;
    complaints: number;
  };
  slaPct: number;
}

/** Soft-deleted reason-tree nodes — kept for report/history integrity. */
export interface CrmDeletedReasonNode {
  /** Path segments: [L1] | [L1, L2] | [L1, L2, leaf] */
  path: string[];
  deletedAt: string;
}

export interface CrmSettings {
  slaPolicy: Record<string, [number, number]>;
  reasonTree: Record<string, Record<string, string[]>>;
  /** Soft-deleted nodes removed from the active tree but retained for reporting. */
  deletedReasons: CrmDeletedReasonNode[];
  scorecard: Array<{ key: string; label: string; weight: number }>;
  criticalErrors: string[];
  surveyQuestions: string[];
}

export function makeCrmUuid(prefix: string, id: number): string {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let n = Math.max(1, Math.trunc(id));
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix = alphabet[n % alphabet.length] + suffix;
    n = Math.floor(n / alphabet.length) + (i + 1) * 17;
  }
  return `${prefix}-${suffix}`;
}

export function crmSlaDueIso(
  priority: string,
  createdAt: string | Date,
  policy?: Record<string, [number, number]>
): string {
  const pol: Record<string, [number, number]> = policy || { ...CRM_SLA_POLICY };
  const hours = (pol[priority] || pol['متوسط'] || CRM_SLA_POLICY['متوسط'])[1];
  const base = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Date(base.getTime() + hours * 3600_000).toISOString();
}

export function crmFirstResponseDueIso(
  priority: string,
  createdAt: string | Date,
  policy?: Record<string, [number, number]>
): string {
  const pol: Record<string, [number, number]> = policy || { ...CRM_SLA_POLICY };
  const mins = (pol[priority] || pol['متوسط'] || CRM_SLA_POLICY['متوسط'])[0];
  const base = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Date(base.getTime() + mins * 60_000).toISOString();
}

export function crmSlaState(opts: {
  status: string;
  slaDue: string;
  now?: Date;
}): 'breached' | 'at_risk' | 'ok' | 'closed' | 'paused' {
  if (['حل‌شده', 'بسته‌شده'].includes(opts.status)) return 'closed';
  if ((CRM_TICKET_PAUSE_STATUSES as readonly string[]).includes(opts.status)) return 'paused';
  const due = new Date(opts.slaDue).getTime();
  const now = (opts.now || new Date()).getTime();
  if (now > due) return 'breached';
  const hoursLeft = (due - now) / 3600_000;
  if (hoursLeft <= 2) return 'at_risk';
  if (hoursLeft <= 6) return 'at_risk';
  return 'ok';
}

export function crmSlaLabel(opts: {
  status: string;
  slaDue: string;
  now?: Date;
}): string {
  const state = crmSlaState(opts);
  if (state === 'closed') return 'پایان‌یافته';
  if (state === 'paused') return 'متوقف‌شده';
  const due = new Date(opts.slaDue).getTime();
  const now = (opts.now || new Date()).getTime();
  const left = due - now;
  const abs = Math.abs(left);
  const H = 3600_000;
  const D = 24 * H;
  const unit = abs < H ? [abs / 60_000, 'دقیقه'] : abs < D ? [abs / H, 'ساعت'] : [abs / D, 'روز'];
  const n = Math.max(1, Math.round(Number(unit[0])));
  const rel = left >= 0 ? `${n} ${unit[1]} دیگر` : `${n} ${unit[1]} پیش`;
  if (state === 'breached') return `نقض SLA · ${rel}`;
  if (state === 'at_risk') return left < 2 * H ? `در آستانه نقض · ${rel}` : `در معرض ریسک · ${rel}`;
  return `سالم · ${rel}`;
}

export function crmInboxBorderColor(state: string, extra?: { unassigned?: boolean; wrapPending?: boolean; internal?: boolean }): string {
  if (extra?.wrapPending) return 'rgb(176, 121, 8)';
  if (extra?.internal) return 'rgb(91, 75, 196)';
  if (extra?.unassigned) return 'rgb(29, 111, 184)';
  if (state === 'breached') return 'rgb(194, 68, 47)';
  if (state === 'at_risk') return 'rgb(176, 121, 8)';
  if (state === 'closed') return 'rgb(18, 135, 111)';
  return 'rgb(223, 229, 236)';
}

export function crmQaTotal(
  scores: Record<string, number>,
  critical: string[],
  scorecard?: ReadonlyArray<{ key: string; label: string; weight: number }>
): number {
  if (critical.length > 0) return 0;
  let sum = 0;
  let weightSum = 0;
  const items = scorecard?.length ? scorecard : CRM_SCORECARD;
  for (const item of items) {
    const score = Number(scores[item.key] ?? 0);
    sum += score * item.weight;
    weightSum += item.weight;
  }
  if (!weightSum) return 0;
  return Math.round(sum / 100);
}

export function crmSurveyRating(answers: Record<string, number>): number {
  const vals = Object.values(answers).map(Number).filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.round(mean * 10) / 10;
}

export function crmKpiAchievement(metric: string, value: number, target: number): number {
  const lowerBetter = ['wait_seconds', 'sla_breach', 'complaints'].includes(metric);
  if (!target) return 100;
  if (!lowerBetter) return Math.min(150, (value / target) * 100);
  return value <= target ? 100 : Math.max(0, 100 - ((value - target) / Math.max(1, target)) * 100);
}

export function crmKpiStanding(pct: number): string {
  if (pct >= 90) return 'در مسیر درست';
  if (pct >= 70) return 'نیازمند تلاش بیشتر';
  return 'ضعیف';
}
