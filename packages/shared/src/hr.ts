/**
 * پیوند (People/HR) — shared types & helpers for Pet Date admin.
 * No businessLine / بیزنس‌لاین fields (stripped from prototype).
 */

export const EMPLOYEE_PUBLIC_ID_PREFIX = 'PD-E';
export const CONTRACT_CODE_PREFIX = 'CT-';

export function makeEmployeePublicId(internalId: number): string {
  return `${EMPLOYEE_PUBLIC_ID_PREFIX}${String(Math.trunc(internalId)).padStart(5, '0')}`;
}

export function makeContractCode(internalId: number): string {
  return `${CONTRACT_CODE_PREFIX}${String(Math.trunc(internalId)).padStart(4, '0')}`;
}

export function employeePublicIdOf(row: { id: number; publicId?: string | null }): string {
  const raw = row.publicId != null ? String(row.publicId).trim() : '';
  if (raw) return raw;
  return makeEmployeePublicId(row.id);
}

/** Built-in panel roles — custom roles live in admin_roles */
export const ADMIN_PANEL_ROLES = ['admin', 'support'] as const;
export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];

/** Role keys that cannot be deleted from the UI */
export const ADMIN_SYSTEM_ROLE_KEYS = ['admin'] as const;

export const ADMIN_PANEL_ROLE_LABELS: Record<string, string> = {
  admin: 'مدیر کامل',
  support: 'پشتیبانی',
  hr_admin: 'مدیر منابع انسانی',
  recruiter: 'استخدام‌کننده',
};

/** Permission claims — add new keys as modules grow */
export const ADMIN_PERMISSIONS = [
  'admin.full',
  'hr.read',
  'hr.write',
  'support.inbox',
  'platform.read',
  'platform.write',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  'admin.full': 'مدیر کامل (همهٔ دسترسی‌ها)',
  'hr.read': 'منابع انسانی — خواندن',
  'hr.write': 'منابع انسانی — نوشتن',
  'support.inbox': 'صندوق پشتیبانی',
  'platform.read': 'پلتفرم — خواندن',
  'platform.write': 'پلتفرم — نوشتن',
};

export const ADMIN_ROLE_PERMISSIONS: Record<AdminPanelRole, readonly AdminPermission[]> = {
  admin: [
    'admin.full',
    'hr.read',
    'hr.write',
    'support.inbox',
    'platform.read',
    'platform.write',
  ],
  support: ['support.inbox', 'platform.read', 'hr.read'],
};

export function isKnownAdminPermission(value: string): value is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizeAdminPermissions(raw: unknown): AdminPermission[] {
  if (!Array.isArray(raw)) return [];
  const out: AdminPermission[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = String(item || '').trim();
    if (!key || seen.has(key) || !isKnownAdminPermission(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function roleHasPermission(
  role: AdminPanelRole | string,
  permission: AdminPermission | string,
  extra?: readonly string[] | null
): boolean {
  if (role === 'admin') return true;
  const base = ADMIN_ROLE_PERMISSIONS[role as AdminPanelRole] || [];
  const set = new Set<string>([...base, ...(extra || [])]);
  return set.has('admin.full') || set.has(permission);
}

export const HR_CONTRACT_STATUSES = [
  'در حال همکاری',
  'در مرحله آزمایشی',
  'عدم تمدید',
  'اخراج',
] as const;

export const HR_ACCESS_STATUSES = ['فعال', 'غیر فعال'] as const;

export const HR_COOPERATION_TYPES = [
  'تمام وقت',
  'پاره وقت',
  'دورکار عادی',
  'دورکار بدون مزایا',
  'دورکار ساعتی بدون مزایا',
  'هیبرید',
  'پروژه‌ای',
  'مشاوره',
] as const;

export const HR_LOCATIONS = [
  'غیرحضوری',
  'یخچال 14',
  'یخچال 12',
  'قبا',
  'سعادت‌آباد',
] as const;

export const HR_CANDIDATE_STAGES = [
  'متقاضی جدید',
  'غربالگری تلفنی',
  'مصاحبه',
  'پیشنهاد شغلی',
  'استخدام‌شده',
  'رد شده',
  'بانک استعداد',
] as const;

export const HR_JOB_OPENING_STATUSES = ['باز', 'بسته'] as const;

export const HR_REQUEST_TYPES = [
  'مرخصی',
  'مرخصی استعلاجی',
  'ماموریت',
  'اصلاح تردد',
  'اضافه‌کاری',
  'تمدید قرارداد',
  'گواهی اشتغال',
  'مساعده',
  'تجهیزات',
  'آموزش',
  'جلسه با HR',
  'استعفا',
  'انتقال',
  'اصلاح اطلاعات پرسنلی',
] as const;

export const HR_REQUEST_STATUSES = [
  'ثبت‌شده',
  'بررسی مدیر',
  'بررسی HR',
  'تایید شده',
  'رد شده',
  'نیاز به اصلاح',
  'لغو شده',
] as const;

export const HR_INCOME_MODEL_TYPES = ['ثابت + متغیر', 'متغیر'] as const;

export type HrEmployeeBenefits = {
  eidi: boolean;
  sanavat: boolean;
  insurance: boolean;
  bonus: boolean;
  commission: boolean;
  training: boolean;
};

export function defaultHrBenefits(): HrEmployeeBenefits {
  return {
    eidi: true,
    sanavat: true,
    insurance: true,
    bonus: false,
    commission: false,
    training: false,
  };
}

export type HrCareerLayer = {
  id: number;
  name: string;
  sortOrder: number;
  unlocks: string;
};

export type HrIncomeModel = {
  id: number;
  name: string;
  type: string;
  variableAmount: number;
  variablePercent: number;
};

export type HrBenefitDef = {
  id: number;
  title: string;
  category: string;
  careerLayerId?: number | null;
  jobTitle?: string | null;
  cost: number;
};

export type HrContract = {
  id: number;
  contractCode: string;
  employeeId: number;
  startDate: string;
  endDate: string;
  salary: number;
  eidi: number;
  sanavat: number;
  commissionPercent: number;
  insuranceNo: string;
  bankAccountNo: string;
  sheba: string;
  cardNo: string;
  bankName: string;
  salesAffectsPayout: string;
  contractFileName: string;
  ndaFileName: string;
  createdAt: string;
};

export type HrEmployeeLog = {
  id: number;
  employeeId: number;
  loggedAt: string;
  field: string;
  oldValue: string;
  newValue: string;
};

export type HrEmployee = {
  id: number;
  publicId: string;
  uuid: string;
  personnelCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  birthCertNo: string;
  nationalId: string;
  fatherName: string;
  province: string;
  city: string;
  address: string;
  maritalStatus: string;
  childrenCount: string;
  militaryStatus: string;
  gmail: string;
  educationLevel: string;
  fieldOfStudy: string;
  jobTitle: string;
  department: string;
  location: string;
  reportingManagerTitle: string;
  reportingManagerPersonId: string;
  cooperationType: string;
  benefits: HrEmployeeBenefits;
  extension: string;
  orgEmail: string;
  contractStatus: string;
  accessStatus: string;
  username: string;
  incomeModelId?: number | null;
  careerLayerId?: number | null;
  permissions: Record<string, boolean>;
  contracts?: HrContract[];
  logs?: HrEmployeeLog[];
  createdAt: string;
  updatedAt: string;
};

export type HrJobOpening = {
  id: number;
  title: string;
  department: string;
  status: string;
  openings: number;
  createdAt: string;
};

export type HrCandidate = {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  city: string;
  source: string;
  jobBoard: string;
  jobOpeningId?: number | null;
  applicationDate: string;
  notes: string;
  stage: string;
  resume: string;
  logs: Array<{ at: string; stage: string; note?: string }>;
  createdAt: string;
};

export type HrRequest = {
  id: number;
  employeeId: number;
  type: string;
  days: number;
  fromDate: string;
  toDate: string;
  description: string;
  status: string;
  log: Array<{ at: string; status: string; note?: string }>;
  createdAt: string;
};

export type AdminRoleDef = {
  id: number;
  key: string;
  nameFa: string;
  description: string;
  permissions: string[];
  isActive: boolean;
};

export type AdminAccount = {
  id: number;
  username: string;
  roleKey: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
};

/** Linear request workflow (prototype REQUEST_FLOW) */
export const HR_REQUEST_FLOW = ['ثبت‌شده', 'بررسی مدیر', 'بررسی HR', 'تایید شده'] as const;

export const HR_ANNUAL_LEAVE_DAYS = 26;

export type HrOnboardingTask = { id: string; label: string; done: boolean };

export type HrOnboardingRecord = {
  id: number;
  candidateId?: number | null;
  employeeId?: number | null;
  name: string;
  jobTitle: string;
  startDate: string;
  durationDays: number;
  tasks: HrOnboardingTask[];
  createdAt: string;
};

export type HrCostEntry = {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  insurance: number;
  tax: number;
  bonus: number;
  sales: number;
};

export type HrServiceEntry = {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  note: string;
  createdAt: string;
};

export type HrNotification = {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn' | 'bad';
  date: string;
  read: boolean;
};

export type HrMonthlyCostBreakdown = {
  employeeId: number;
  salary: number;
  insurance: number;
  tax: number;
  bonus: number;
  commission: number;
  eidiMonthly: number;
  sanavatMonthly: number;
  total: number;
};

export type HrCockpitTask = {
  type: string;
  label: string;
  employeeId?: number;
  employeeName?: string;
  detail: string;
  daysLeft?: number;
};

export const DEFAULT_ONBOARDING_TASKS: readonly string[] = [
  'تکمیل قرارداد و NDA',
  'راه‌اندازی حساب کاربری و دسترسی‌ها',
  'تحویل تجهیزات',
  'معارفه با تیم',
  'آموزش خوش‌آمدگویی (Orientation)',
];

export function onboardingDurationFor(jobTitle: string): number {
  const t = String(jobTitle || '');
  if (t.includes('مدیر')) return 30;
  if (t.includes('سرپرست')) return 7;
  return 3;
}

export function makeDefaultOnboardingTasks(): HrOnboardingTask[] {
  return DEFAULT_ONBOARDING_TASKS.map((label, i) => ({
    id: `t${i + 1}`,
    label,
    done: false,
  }));
}

export function nextRequestStatus(current: string): string | null {
  const idx = (HR_REQUEST_FLOW as readonly string[]).indexOf(current);
  if (idx < 0 || idx >= HR_REQUEST_FLOW.length - 1) return null;
  return HR_REQUEST_FLOW[idx + 1];
}

export function isSalesJobTitle(jobTitle: string): boolean {
  return ['مدیر فروش', 'سرپرست فروش', 'کارشناس فروش'].includes(String(jobTitle || ''));
}

export function incomeModelFixedAddon(model: HrIncomeModel | null | undefined): number {
  if (!model) return 0;
  return String(model.type || '').includes('ثابت') ? Number(model.variableAmount || 0) : 0;
}

export function effectiveCommissionPercent(
  contractPercent: number,
  model: HrIncomeModel | null | undefined
): number {
  if (model && String(model.type || '').includes('متغیر')) {
    return Number(model.variablePercent || 0);
  }
  return Number(contractPercent || 0);
}
