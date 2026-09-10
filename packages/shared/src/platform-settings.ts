/**
 * Platform Settings — modular dropdown catalogs + per-module goal metrics.
 * Defaults bootstrap DB rows; inactive (soft-deleted) options stay for reports.
 */

import {
  HR_ACCESS_STATUSES,
  HR_CALL_OUTCOMES,
  HR_CANDIDATE_STAGES,
  HR_CONTRACT_STATUSES,
  HR_COOPERATION_TYPES,
  HR_JOB_BOARDS,
  HR_JOB_OPENING_STATUSES,
  HR_LOCATIONS,
  HR_REQUEST_STATUSES,
  HR_REQUEST_TYPES,
} from './hr';
import {
  SALES_CALL_RESULTS,
  SALES_CUSTOMER_LEVELS,
  SALES_FOLLOWUP_TYPES,
  SALES_LEAD_SOURCES,
  SALES_LOST_REASONS,
  SALES_MESSAGE_CHANNELS,
  SALES_PAYMENT_TYPES,
  SALES_PAY_STATUSES,
  SALES_PRIORITIES,
  SALES_STAGES,
  SALES_TICKET_CATEGORIES,
  SALES_TICKET_DEPTS,
  SALES_TICKET_STATUSES,
} from './sales';
import {
  CRM_CHANNELS,
  CRM_CHANNEL_LABELS,
  CRM_OUTCOMES,
  CRM_PENDING_REASONS,
  CRM_PRIORITIES,
  CRM_RESOLUTION_CODES,
  CRM_REOPEN_REASONS,
  CRM_ROOT_CAUSES,
  CRM_TICKET_SEVERITIES,
  CRM_TICKET_STATUSES,
  CRM_TICKET_TYPES,
} from './crm';
import { PET_SPECIES } from './catalog';
import { VERIFICATION_STATUS_LABELS, VERIFICATION_STATUSES } from './petdate';

export const PLATFORM_MODULE_KEYS = [
  'ats',
  'hr',
  'platform',
  'sales',
  'upgrade',
] as const;
export type PlatformModuleKey = (typeof PLATFORM_MODULE_KEYS)[number];

export const PLATFORM_MODULE_LABELS: Record<PlatformModuleKey, string> = {
  ats: 'جذب و استخدام',
  hr: 'منابع انسانی',
  platform: 'پلتفرم',
  sales: 'فروش',
  upgrade: 'آپگرید',
};

export type PlatformGoalPeriod = 'weekly' | 'monthly';

export type PlatformGoalMetricDef = {
  key: string;
  label: string;
  period: PlatformGoalPeriod;
  unit?: string;
};

export type PlatformDropdownFieldDef = {
  fieldKey: string;
  label: string;
  /** Default bootstrap options: value = stable key, label = Persian display */
  defaults: Array<{ value: string; label: string }>;
};

export type PlatformModuleCatalog = {
  key: PlatformModuleKey;
  label: string;
  dropdowns: PlatformDropdownFieldDef[];
  goals: PlatformGoalMetricDef[];
};

function fromList(items: readonly string[]): Array<{ value: string; label: string }> {
  return items.map((s) => ({ value: s, label: s }));
}

function fromLabeled(
  values: readonly string[],
  labels: Record<string, string>
): Array<{ value: string; label: string }> {
  return values.map((v) => ({ value: v, label: labels[v] ?? v }));
}

export const PLATFORM_MODULE_CATALOG: PlatformModuleCatalog[] = [
  {
    key: 'ats',
    label: PLATFORM_MODULE_LABELS.ats,
    dropdowns: [
      { fieldKey: 'candidate_stages', label: 'مراحل کاندیدا', defaults: fromList(HR_CANDIDATE_STAGES) },
      { fieldKey: 'job_boards', label: 'منبع آگهی / جاب‌بورد', defaults: fromList(HR_JOB_BOARDS) },
      { fieldKey: 'call_outcomes', label: 'نتیجه تماس غربالگری', defaults: fromList(HR_CALL_OUTCOMES) },
      { fieldKey: 'job_opening_statuses', label: 'وضعیت آگهی', defaults: fromList(HR_JOB_OPENING_STATUSES) },
    ],
    goals: [
      { key: 'weekly_hires', label: 'تعداد جذب هفتگی', period: 'weekly', unit: 'نفر' },
      { key: 'ads_resume_screening', label: 'تعداد آگهی و غربالگری رزومه', period: 'weekly', unit: 'عدد' },
      { key: 'weekly_calls', label: 'تعداد تماس‌های هفته', period: 'weekly', unit: 'تماس' },
      { key: 'weekly_interviews', label: 'تعداد مصاحبه‌های هفته', period: 'weekly', unit: 'مصاحبه' },
    ],
  },
  {
    key: 'hr',
    label: PLATFORM_MODULE_LABELS.hr,
    dropdowns: [
      { fieldKey: 'contract_statuses', label: 'وضعیت قرارداد', defaults: fromList(HR_CONTRACT_STATUSES) },
      { fieldKey: 'access_statuses', label: 'وضعیت دسترسی', defaults: fromList(HR_ACCESS_STATUSES) },
      { fieldKey: 'cooperation_types', label: 'نحوه همکاری', defaults: fromList(HR_COOPERATION_TYPES) },
      { fieldKey: 'locations', label: 'محل کار', defaults: fromList(HR_LOCATIONS) },
      { fieldKey: 'request_types', label: 'نوع درخواست پرسنلی', defaults: fromList(HR_REQUEST_TYPES) },
      { fieldKey: 'request_statuses', label: 'وضعیت درخواست', defaults: fromList(HR_REQUEST_STATUSES) },
    ],
    goals: [
      { key: 'personnel_info_completion', label: 'تکمیل اطلاعات پرسنلی', period: 'monthly', unit: '٪' },
      { key: 'contract_renewal', label: 'تمدید قرارداد', period: 'monthly', unit: 'نفر' },
      { key: 'service_delivery', label: 'میزان ارائه خدمات', period: 'monthly', unit: 'ساعت' },
      { key: 'cost_allocation', label: 'تخصیص هزینه', period: 'monthly', unit: 'تومان' },
    ],
  },
  {
    key: 'platform',
    label: PLATFORM_MODULE_LABELS.platform,
    dropdowns: [
      {
        fieldKey: 'verification_statuses',
        label: 'وضعیت احراز هویت',
        defaults: fromLabeled(VERIFICATION_STATUSES, VERIFICATION_STATUS_LABELS),
      },
      {
        fieldKey: 'pet_species',
        label: 'گونه پت',
        defaults: PET_SPECIES.map((s) => ({ value: s.code, label: `${s.emoji} ${s.labelFa}` })),
      },
      {
        fieldKey: 'payment_statuses',
        label: 'وضعیت پرداخت',
        defaults: [
          { value: 'awaiting_receipt', label: 'منتظر رسید' },
          { value: 'pending', label: 'در انتظار بررسی' },
          { value: 'awaiting_stars', label: 'منتظر Stars' },
          { value: 'paid', label: 'پرداخت‌شده' },
          { value: 'approved', label: 'تأیید شده' },
          { value: 'rejected', label: 'رد شده' },
          { value: 'cancelled', label: 'لغو شده' },
        ],
      },
    ],
    goals: [
      { key: 'identity_verification_volume', label: 'میزان احراز هویت', period: 'weekly', unit: 'عدد' },
      { key: 'identity_verification_quality', label: 'کیفیت احراز هویت', period: 'weekly', unit: '٪' },
    ],
  },
  {
    key: 'sales',
    label: PLATFORM_MODULE_LABELS.sales,
    dropdowns: [
      { fieldKey: 'stages', label: 'مراحل فروش', defaults: fromList(SALES_STAGES) },
      { fieldKey: 'lead_sources', label: 'منبع لید', defaults: fromList(SALES_LEAD_SOURCES) },
      { fieldKey: 'lost_reasons', label: 'دلیل ازدست‌رفتن', defaults: fromList(SALES_LOST_REASONS) },
      { fieldKey: 'call_results', label: 'نتیجه تماس', defaults: fromList(SALES_CALL_RESULTS) },
      { fieldKey: 'followup_types', label: 'نوع پیگیری', defaults: fromList(SALES_FOLLOWUP_TYPES) },
      { fieldKey: 'priorities', label: 'اولویت', defaults: fromList(SALES_PRIORITIES) },
      { fieldKey: 'payment_types', label: 'نوع پرداخت', defaults: fromList(SALES_PAYMENT_TYPES) },
      { fieldKey: 'pay_statuses', label: 'وضعیت پرداخت فروش', defaults: fromList(SALES_PAY_STATUSES) },
      { fieldKey: 'ticket_depts', label: 'دپارتمان تیکت', defaults: fromList(SALES_TICKET_DEPTS) },
      { fieldKey: 'ticket_categories', label: 'دسته تیکت', defaults: fromList(SALES_TICKET_CATEGORIES) },
      { fieldKey: 'ticket_statuses', label: 'وضعیت تیکت فروش', defaults: fromList(SALES_TICKET_STATUSES) },
      { fieldKey: 'customer_levels', label: 'سطح مشتری', defaults: fromList(SALES_CUSTOMER_LEVELS) },
      { fieldKey: 'message_channels', label: 'کانال پیام', defaults: fromList(SALES_MESSAGE_CHANNELS) },
    ],
    goals: [
      { key: 'leads', label: 'لیدها', period: 'weekly', unit: 'لید' },
      { key: 'daily_handling', label: 'تعداد رسیدگی روزانه', period: 'weekly', unit: 'عدد' },
      { key: 'conversion_rate', label: 'نرخ تبدیل', period: 'monthly', unit: '٪' },
      { key: 'aov', label: 'AOV', period: 'monthly', unit: 'تومان' },
      { key: 'total_sales_amount', label: 'مبلغ کل فروش', period: 'monthly', unit: 'تومان' },
    ],
  },
  {
    key: 'upgrade',
    label: PLATFORM_MODULE_LABELS.upgrade,
    dropdowns: [
      { fieldKey: 'stages', label: 'مراحل آپگرید', defaults: fromList(SALES_STAGES) },
      { fieldKey: 'lost_reasons', label: 'دلیل ازدست‌رفتن آپگرید', defaults: fromList(SALES_LOST_REASONS) },
      { fieldKey: 'call_results', label: 'نتیجه تماس آپگرید', defaults: fromList(SALES_CALL_RESULTS) },
      { fieldKey: 'priorities', label: 'اولویت آپگرید', defaults: fromList(SALES_PRIORITIES) },
      { fieldKey: 'pay_statuses', label: 'وضعیت پرداخت آپگرید', defaults: fromList(SALES_PAY_STATUSES) },
    ],
    goals: [
      { key: 'weekly_upgrades', label: 'تعداد آپگرید هفتگی', period: 'weekly', unit: 'عدد' },
      { key: 'daily_handling', label: 'تعداد رسیدگی روزانه', period: 'weekly', unit: 'عدد' },
      { key: 'weekly_calls', label: 'تعداد تماس‌های هفته', period: 'weekly', unit: 'تماس' },
      { key: 'conversion_rate', label: 'نرخ تبدیل آپگرید', period: 'monthly', unit: '٪' },
      { key: 'aov', label: 'AOV آپگرید', period: 'monthly', unit: 'تومان' },
      { key: 'total_upgrade_amount', label: 'مبلغ کل آپگرید', period: 'monthly', unit: 'تومان' },
    ],
  },
];

/** CRM dropdowns live under platform module picker as an extra catalog slice for ops. */
export const PLATFORM_CRM_DROPDOWNS: PlatformDropdownFieldDef[] = [
  {
    fieldKey: 'crm_channels',
    label: 'کانال ارتباط CRM',
    defaults: (CRM_CHANNELS as readonly string[]).map((c) => ({
      value: c,
      label: CRM_CHANNEL_LABELS[c as keyof typeof CRM_CHANNEL_LABELS] ?? c,
    })),
  },
  { fieldKey: 'crm_outcomes', label: 'نتیجه تعامل CRM', defaults: fromList(CRM_OUTCOMES) },
  { fieldKey: 'crm_priorities', label: 'اولویت CRM', defaults: fromList(CRM_PRIORITIES) },
  { fieldKey: 'crm_ticket_statuses', label: 'وضعیت تیکت CRM', defaults: fromList(CRM_TICKET_STATUSES) },
  { fieldKey: 'crm_ticket_types', label: 'نوع تیکت CRM', defaults: fromList(CRM_TICKET_TYPES) },
  { fieldKey: 'crm_severities', label: 'شدت تیکت', defaults: fromList(CRM_TICKET_SEVERITIES) },
  { fieldKey: 'crm_pending_reasons', label: 'دلیل انتظار', defaults: fromList(CRM_PENDING_REASONS) },
  { fieldKey: 'crm_resolution_codes', label: 'کد حل', defaults: fromList(CRM_RESOLUTION_CODES) },
  { fieldKey: 'crm_root_causes', label: 'علت ریشه‌ای', defaults: fromList(CRM_ROOT_CAUSES) },
  { fieldKey: 'crm_reopen_reasons', label: 'دلیل بازگشایی', defaults: fromList(CRM_REOPEN_REASONS) },
];

export function getPlatformModule(key: string): PlatformModuleCatalog | undefined {
  return PLATFORM_MODULE_CATALOG.find((m) => m.key === key);
}

export function listPlatformDropdownFields(moduleKey: string): PlatformDropdownFieldDef[] {
  const mod = getPlatformModule(moduleKey);
  if (!mod) return [];
  if (moduleKey === 'platform') {
    return [...mod.dropdowns, ...PLATFORM_CRM_DROPDOWNS];
  }
  return mod.dropdowns;
}

export function getPlatformDropdownField(
  moduleKey: string,
  fieldKey: string
): PlatformDropdownFieldDef | undefined {
  return listPlatformDropdownFields(moduleKey).find((f) => f.fieldKey === fieldKey);
}

export function getPlatformGoalMetrics(moduleKey: string): PlatformGoalMetricDef[] {
  return getPlatformModule(moduleKey)?.goals ?? [];
}

export type PlatformDropdownOption = {
  id: number;
  moduleKey: string;
  fieldKey: string;
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PlatformDropdownAuditEntry = {
  id: number;
  optionId: number | null;
  moduleKey: string;
  fieldKey: string;
  action: 'create' | 'update' | 'soft_delete' | 'restore' | 'seed';
  actor: string;
  detail: string;
  createdAt: string;
};

export type PlatformModuleGoals = {
  moduleKey: PlatformModuleKey | string;
  period: PlatformGoalPeriod;
  /** metricKey → target number */
  targets: Record<string, number>;
  updatedAt: string | null;
  updatedBy: string | null;
};
