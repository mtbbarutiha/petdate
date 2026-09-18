/**
 * Admin ops rules shared by API + UI.
 * Pure functions — no I/O. Persisted workflows live in the API.
 */

export type DrillGrain = 'day' | 'week' | 'month';

export const DRILL_GRAINS: readonly DrillGrain[] = ['day', 'week', 'month'];

export type DashboardDrillState = {
  grain: DrillGrain;
  /** Finest grain the board can return to. */
  baseGrain: DrillGrain;
  focusStack: string[];
  category: string | null;
};

export type DashboardDrillAction =
  | { type: 'reset' }
  | { type: 'drillUp' }
  | { type: 'drillDown' }
  | { type: 'drillInto'; label: string }
  | { type: 'crumb'; index: number }
  | { type: 'selectCategory'; label: string | null };

export function initialDashboardDrill(baseGrain: DrillGrain = 'day'): DashboardDrillState {
  return { grain: baseGrain, baseGrain, focusStack: [], category: null };
}

export function isDashboardDrillInitial(state: DashboardDrillState): boolean {
  return state.grain === state.baseGrain && state.focusStack.length === 0 && !state.category;
}

function grainIndex(grain: DrillGrain): number {
  return DRILL_GRAINS.indexOf(grain);
}

function coarsen(grain: DrillGrain): DrillGrain {
  const i = grainIndex(grain);
  return DRILL_GRAINS[Math.min(DRILL_GRAINS.length - 1, i + 1)]!;
}

function refine(grain: DrillGrain, base: DrillGrain): DrillGrain {
  const i = grainIndex(grain);
  const b = grainIndex(base);
  return DRILL_GRAINS[Math.max(b, i - 1)]!;
}

/**
 * One drill state for the whole board.
 * Reset always returns to the initial grain with an empty focus — even after
 * drill-up with no breadcrumb (the previous per-widget reset bug).
 * Drill-into still records a focus when already at the finest grain so every
 * widget filters to that bucket.
 */
export function reduceDashboardDrill(
  state: DashboardDrillState,
  action: DashboardDrillAction
): DashboardDrillState {
  switch (action.type) {
    case 'reset':
      return initialDashboardDrill(state.baseGrain);
    case 'selectCategory':
      return { ...state, category: action.label };
    case 'drillDown': {
      if (grainIndex(state.grain) <= grainIndex(state.baseGrain)) return state;
      return { ...state, grain: refine(state.grain, state.baseGrain) };
    }
    case 'drillUp': {
      if (state.category) return { ...state, category: null };
      if (state.focusStack.length) {
        const canCoarsen = grainIndex(state.grain) > grainIndex(state.baseGrain);
        return {
          ...state,
          grain: canCoarsen ? coarsen(state.grain) : state.grain,
          focusStack: state.focusStack.slice(0, -1),
        };
      }
      if (grainIndex(state.grain) >= DRILL_GRAINS.length - 1) return state;
      return { ...state, grain: coarsen(state.grain) };
    }
    case 'drillInto': {
      const label = action.label.trim();
      if (!label) return state;
      const canRefine = grainIndex(state.grain) > grainIndex(state.baseGrain);
      return {
        ...state,
        grain: canRefine ? refine(state.grain, state.baseGrain) : state.grain,
        focusStack: [...state.focusStack, label],
        category: null,
      };
    }
    case 'crumb': {
      if (action.index < 0) return initialDashboardDrill(state.baseGrain);
      const targetLen = Math.min(action.index + 1, state.focusStack.length);
      const remove = state.focusStack.length - targetLen;
      let grain = state.grain;
      for (let i = 0; i < remove; i++) grain = coarsen(grain);
      return { ...state, grain, focusStack: state.focusStack.slice(0, targetLen) };
    }
    default:
      return state;
  }
}

export type CustomerConversionInput = {
  /** Gateway (or wallet) payment captured — not a finance-desk approval. */
  paidViaGateway?: boolean;
  /** Finance approval alone must not create a customer. */
  financeApproved?: boolean;
  agentSavedFirstName?: boolean;
  agentSavedLastName?: boolean;
  selfRegistered?: boolean;
};

export type CustomerConversionPath = 'پرداخت' | 'تکمیل نام توسط کارشناس' | 'ثبت‌نام';

/** Customer status does not depend on finance approval. */
export function customerConversionPath(input: CustomerConversionInput): CustomerConversionPath | null {
  if (input.paidViaGateway) return 'پرداخت';
  if (input.agentSavedFirstName && input.agentSavedLastName) return 'تکمیل نام توسط کارشناس';
  if (input.selfRegistered) return 'ثبت‌نام';
  return null;
}

export type PersonnelContractInput = {
  hasEmployee: boolean;
  contractStart?: string | null;
  contractEnd?: string | null;
  accessStatus?: string | null;
  /** YYYY-MM-DD */
  today?: string;
};

export function requirePersonnelContract(input: PersonnelContractInput): { ok: boolean; reason: string } {
  if (!input.hasEmployee) {
    return { ok: false, reason: 'بدون پرونده پرسنلی دسترسی پنل ندارید' };
  }
  const start = String(input.contractStart || '').trim();
  const end = String(input.contractEnd || '').trim();
  if (!start || !end) {
    return { ok: false, reason: 'بدون تاریخ شروع و پایان قرارداد دسترسی ندارید' };
  }
  const status = String(input.accessStatus || '').trim();
  if (status === 'غیر فعال' || status === 'inactive') {
    return { ok: false, reason: 'دسترسی پرسنل غیرفعال است' };
  }
  const today = input.today || new Date().toISOString().slice(0, 10);
  const endIso = contractEndToIso(end);
  if (endIso && endIso < today) {
    return { ok: false, reason: 'قرارداد منقضی شده است' };
  }
  return { ok: true, reason: '' };
}

function contractEndToIso(raw: string): string | null {
  const greg = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (greg) return `${greg[1]}-${greg[2]}-${greg[3]}`;
  return null;
}

export type VerificationQueueUser = {
  verificationStatus?: string | null;
  phoneVerified?: boolean | number | null;
};

/** Pending face-verify OR phone-unverified users belong in the OTP/verification queue. */
export function userInVerificationQueue(user: VerificationQueueUser): boolean {
  const status = String(user.verificationStatus || 'none').trim() || 'none';
  if (status === 'rejected') return false;
  if (status === 'pending') return true;
  if (status === 'verified') return false;
  const phoneOk = user.phoneVerified === true || user.phoneVerified === 1;
  return !phoneOk;
}

export type ShopCategoryRef = {
  slug: string;
  parentSlug?: string | null;
  labelFa?: string;
};

/** Two levels only: a child cannot itself be a parent, and cannot point at itself. */
export function categoryParentAllowed(
  categories: readonly ShopCategoryRef[],
  childSlug: string,
  parentSlug: string | null | undefined
): { ok: boolean; reason: string } {
  const parent = String(parentSlug || '').trim();
  if (!parent) return { ok: true, reason: '' };
  if (parent === childSlug) return { ok: false, reason: 'دسته نمی‌تواند والد خودش باشد' };
  const parentRow = categories.find((c) => c.slug === parent);
  if (parentRow?.parentSlug) {
    return { ok: false, reason: 'فقط دو سطح مجاز است — والد نباید خودش فرزند باشد' };
  }
  const childIsParent = categories.some((c) => c.parentSlug === childSlug);
  if (childIsParent) return { ok: false, reason: 'دسته‌ای که فرزند دارد نمی‌تواند زیرمجموعه شود' };
  return { ok: true, reason: '' };
}

/** Keep public URLs: unknown slug falls through; explicit redirect map wins. */
export function categoryPublicSlug(
  slug: string,
  redirects: Readonly<Record<string, string>> = {}
): string {
  const next = redirects[slug];
  if (next && next !== slug) return next;
  return slug;
}

export function childCategorySlugs(
  categories: readonly ShopCategoryRef[],
  parentSlug: string
): string[] {
  return categories.filter((c) => c.parentSlug === parentSlug).map((c) => c.slug);
}

export const SHOP_ORDER_STATUSES = [
  'awaiting_confirm',
  'pending',
  'paid',
  'shipping',
  'shipped',
  'completed',
  'cancelled',
  'refunded',
  'returned',
] as const;

export type ShopOrderStatus = (typeof SHOP_ORDER_STATUSES)[number];

export const SHOP_ORDER_STATUS_FA: Record<ShopOrderStatus, string> = {
  awaiting_confirm: 'در انتظار تایید',
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  shipping: 'در حال ارسال',
  shipped: 'ارسال شده',
  completed: 'سفارش تکمیل شده',
  cancelled: 'لغو شده',
  refunded: 'عودت وجه',
  returned: 'مرجوعی',
};

export function isShopOrderStatus(value: string): value is ShopOrderStatus {
  return (SHOP_ORDER_STATUSES as readonly string[]).includes(value);
}

/** Legacy English statuses still stored on old rows. */
export function normalizeShopOrderStatus(raw: string): ShopOrderStatus | string {
  const v = String(raw || '').trim();
  if (v === 'pending_payment') return 'pending';
  if (isShopOrderStatus(v)) return v;
  return v;
}

export type CalendarDayCounts = { orders?: number; registrations?: number; emails?: number };

export type CalendarEventCode = {
  code: 'or' | 're' | 'em';
  text: string;
  href: string;
};

export function calendarEventCodes(isoDay: string, counts: CalendarDayCounts): CalendarEventCode[] {
  const day = isoDay.slice(0, 10);
  const out: CalendarEventCode[] = [];
  const orders = Math.max(0, Math.floor(Number(counts.orders) || 0));
  const regs = Math.max(0, Math.floor(Number(counts.registrations) || 0));
  const emails = Math.max(0, Math.floor(Number(counts.emails) || 0));
  if (orders > 0) {
    out.push({ code: 'or', text: `or=${orders}`, href: `/admin/shop/orders?day=${day}` });
  }
  if (regs > 0) {
    out.push({ code: 're', text: `re=${regs}`, href: `/admin/users?day=${day}` });
  }
  if (emails > 0) {
    out.push({ code: 'em', text: `em=${emails}`, href: `/admin/mail?day=${day}` });
  }
  return out;
}

export const CALL_QA_OUTBOUND = [
  'سلام و خوشامدگویی',
  'معرفی خود و سازمان',
  'کشف نیاز',
  'دانش محصول',
  'گوش دادن فعال',
  'همدلی',
  'صحت اطلاعات',
  'رعایت قوانین',
  'جمع‌بندی و بستن تماس',
  'رسیدگی به رضایت (CSAT)',
] as const;

export const CALL_QA_INBOUND = [
  'سلام و خوشامدگویی',
  'احراز هویت تماس‌گیرنده',
  'کشف نیاز',
  'دانش محصول',
  'گوش دادن فعال',
  'همدلی',
  'صحت اطلاعات',
  'رعایت قوانین',
  'جمع‌بندی و بستن تماس',
  'رسیدگی به رضایت (CSAT)',
] as const;

export function callQaIndicatorSet(dir: 'call_in' | 'call_out'): readonly string[] {
  return dir === 'call_in' ? CALL_QA_INBOUND : CALL_QA_OUTBOUND;
}

export function callQaTotal(scores: readonly number[]): number | null {
  const nums = scores.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const avg = nums.reduce((s, n) => s + Math.max(0, Math.min(10, n)), 0) / nums.length;
  return Math.round(avg * 10);
}

export const LEAD_FAILURE_REASONS = [
  'فعالسازی کاربر انجام شد',
  'کاربر صاحب پت نیست',
  'عدم امکان برقراری ارتباط',
] as const;

export const SALES_TICKET_REASONS = [
  'استعلام مالی',
  'مشکل فنی',
  'تاخیر تحویل',
  'انصراف مشتری',
  'اطلاعات ناقص',
  'سایر',
] as const;

export type LoginEvent = { at: string; ip: string; ok: boolean; username?: string };

/** Same IP, many attempts in a short window. */
export function detectFrequentLogin(
  events: readonly LoginEvent[],
  opts?: { windowMinutes?: number; threshold?: number; now?: number }
): { flagged: boolean; ip: string; count: number }[] {
  const windowMs = (opts?.windowMinutes ?? 15) * 60_000;
  const threshold = opts?.threshold ?? 8;
  const now = opts?.now ?? Date.now();
  const buckets = new Map<string, number>();
  for (const ev of events) {
    const t = new Date(ev.at).getTime();
    if (!Number.isFinite(t) || now - t > windowMs) continue;
    buckets.set(ev.ip, (buckets.get(ev.ip) || 0) + 1);
  }
  return [...buckets.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([ip, count]) => ({ flagged: true, ip, count }));
}

const BOT_UA = /bot|crawler|spider|curl|wget|python-requests|headless|scrapy/i;

export function detectBot(input: { userAgent?: string; failStreak?: number }): {
  bot: boolean;
  reason: string;
} {
  const ua = String(input.userAgent || '');
  if (BOT_UA.test(ua)) return { bot: true, reason: 'user-agent مشکوک به ربات' };
  if ((input.failStreak || 0) >= 12) return { bot: true, reason: 'توالی شکست ورود' };
  return { bot: false, reason: '' };
}

export function countArticleLinks(
  html: string,
  siteHosts: readonly string[] = ['petdate.ir', 'www.petdate.ir']
): { internal: number; external: number } {
  const hosts = new Set(siteHosts.map((h) => h.toLowerCase()));
  let internal = 0;
  let external = 0;
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1] || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      internal += 1;
      continue;
    }
    try {
      const host = new URL(href).hostname.toLowerCase();
      if (hosts.has(host)) internal += 1;
      else external += 1;
    } catch {
      internal += 1;
    }
  }
  return { internal, external };
}

export function brandServesCategory(
  brandCategorySlugs: readonly string[] | null | undefined,
  categorySlug: string
): boolean {
  if (!brandCategorySlugs || brandCategorySlugs.length === 0) return true;
  return brandCategorySlugs.includes(categorySlug);
}

export type GoalAudience = {
  teams: string[];
  jobs: string[];
  people: Array<{ id: string; name: string; team: string; job: string }>;
};

export function goalTargetsFromHr(audience: GoalAudience): {
  teams: string[];
  jobs: string[];
  people: GoalAudience['people'];
} {
  return {
    teams: [...new Set(audience.teams.map((t) => t.trim()).filter(Boolean))],
    jobs: [...new Set(audience.jobs.map((t) => t.trim()).filter(Boolean))],
    people: audience.people.filter((p) => p.name.trim()),
  };
}

export const RBAC_DELETE_KEYS = [
  'ats.delete',
  'hr.delete',
  'platform.delete',
  'sales.delete',
  'upgrade.delete',
  'crm.delete',
  'loyalty.delete',
  'support.delete',
  'finance.delete',
  'shop.delete',
  'content.delete',
  'security.delete',
  'mail.delete',
  'reports.delete',
  'monitoring.delete',
  'verification.delete',
  'magazine.delete',
] as const;
