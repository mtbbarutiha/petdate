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
  'جدید', 'تخصیص‌یافته', 'در حال بررسی', 'در انتظار مشتری',
  'حل‌شده', 'بسته‌شده', 'بازگشایی‌شده', 'ارجاع به سطح بالاتر',
] as const;

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
  'after_purchase', 'ticket_created', 'ticket_resolved', 'survey_done', 'sla_breach', 'manual',
] as const;

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
  customerId: number;
  customerName?: string;
  interactionId: number | null;
  title: string;
  description: string;
  type: string;
  category: string;
  subCategory: string;
  priority: CrmPriority | string;
  severity: string;
  status: string;
  agentId: string | null;
  agentName: string | null;
  supervisorId: string;
  firstResponseAt: string | null;
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
  slaState?: 'breached' | 'at_risk' | 'ok' | 'closed';
  borderColor?: string;
}

export interface CrmTicketActivity {
  id: number;
  ticketId: number;
  userId: string;
  text: string;
  at: string;
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

export interface CrmDashboard {
  greetingName: string;
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
  inboxPreview: CrmInboxRow[];
  myTasks: CrmTask[];
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
}

export interface CrmSettings {
  slaPolicy: Record<string, [number, number]>;
  reasonTree: Record<string, Record<string, string[]>>;
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

export function crmSlaDueIso(priority: string, createdAt: string | Date): string {
  const hours = (CRM_SLA_POLICY[priority as CrmPriority] || CRM_SLA_POLICY['متوسط'])[1];
  const base = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Date(base.getTime() + hours * 3600_000).toISOString();
}

export function crmSlaState(opts: {
  status: string;
  slaDue: string;
  now?: Date;
}): 'breached' | 'at_risk' | 'ok' | 'closed' {
  if (['حل‌شده', 'بسته‌شده'].includes(opts.status)) return 'closed';
  const due = new Date(opts.slaDue).getTime();
  const now = (opts.now || new Date()).getTime();
  if (now > due) return 'breached';
  const hoursLeft = (due - now) / 3600_000;
  if (hoursLeft <= 4) return 'at_risk';
  return 'ok';
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

export function crmQaTotal(scores: Record<string, number>, critical: string[]): number {
  if (critical.length > 0) return 0;
  let sum = 0;
  let weightSum = 0;
  for (const item of CRM_SCORECARD) {
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
