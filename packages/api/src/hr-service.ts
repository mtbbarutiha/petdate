/**
 * پیوند HR persistence — separate from db.ts to limit merge conflicts.
 * Schema ensured via ensureHrSchema() from migrateSchema (no wipe).
 */
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import {
  ADMIN_ROLE_PERMISSIONS,
  ADMIN_SYSTEM_ROLE_KEYS,
  defaultHrBenefits,
  emptyCandidateFollowup,
  employeePublicIdOf,
  HR_CALL_CONNECTED,
  HR_REJECTED_NO_CONTACT,
  makeContractCode,
  makeEmployeePublicId,
  normalizeAdminPermissions,
  type AdminAccount,
  type AdminRoleDef,
  type HrBenefitDef,
  type HrCandidate,
  type HrCandidateFollowup,
  type HrCareerLayer,
  type HrContract,
  type HrEmployee,
  type HrEmployeeBenefits,
  type HrEmployeeLog,
  type HrIncomeModel,
  type HrJobOpening,
  type HrRequest,
} from '@petdate/shared';
import { getDb } from './db';

function db() {
  return getDb();
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function hashPassword(password: string, salt?: string): string {
  const s = salt || randomBytes(16).toString('hex');
  const hash = scryptSync(password, s, 32).toString('hex');
  return `${s}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function ensureHrSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS hr_career_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      unlocks TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_income_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'متغیر',
      variable_amount INTEGER NOT NULL DEFAULT 0,
      variable_percent REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_benefit_defs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      career_layer_id INTEGER,
      job_title TEXT,
      cost INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT,
      uuid TEXT NOT NULL,
      personnel_code TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      birth_cert_no TEXT NOT NULL DEFAULT '',
      national_id TEXT NOT NULL DEFAULT '',
      father_name TEXT NOT NULL DEFAULT '',
      province TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      marital_status TEXT NOT NULL DEFAULT '',
      children_count TEXT NOT NULL DEFAULT '',
      military_status TEXT NOT NULL DEFAULT '',
      gmail TEXT NOT NULL DEFAULT '',
      education_level TEXT NOT NULL DEFAULT '',
      field_of_study TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      reporting_manager_title TEXT NOT NULL DEFAULT '',
      reporting_manager_person_id TEXT NOT NULL DEFAULT '',
      cooperation_type TEXT NOT NULL DEFAULT 'تمام وقت',
      benefits_json TEXT NOT NULL DEFAULT '{}',
      extension TEXT NOT NULL DEFAULT '',
      org_email TEXT NOT NULL DEFAULT '',
      contract_status TEXT NOT NULL DEFAULT 'در حال همکاری',
      access_status TEXT NOT NULL DEFAULT 'فعال',
      username TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      income_model_id INTEGER,
      career_layer_id INTEGER,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_code TEXT,
      employee_id INTEGER NOT NULL,
      start_date TEXT NOT NULL DEFAULT '',
      end_date TEXT NOT NULL DEFAULT '',
      salary INTEGER NOT NULL DEFAULT 0,
      eidi INTEGER NOT NULL DEFAULT 0,
      sanavat INTEGER NOT NULL DEFAULT 0,
      commission_percent REAL NOT NULL DEFAULT 0,
      insurance_no TEXT NOT NULL DEFAULT '',
      bank_account_no TEXT NOT NULL DEFAULT '',
      sheba TEXT NOT NULL DEFAULT '',
      card_no TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      sales_affects_payout TEXT NOT NULL DEFAULT 'نامشخص',
      contract_file_name TEXT NOT NULL DEFAULT '',
      nda_file_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS hr_employee_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      field TEXT NOT NULL,
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS hr_job_openings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'باز',
      openings INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      mobile TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      job_board TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      job_opening_id INTEGER,
      application_date TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'متقاضی جدید',
      resume TEXT NOT NULL DEFAULT '',
      logs_json TEXT NOT NULL DEFAULT '[]',
      followup_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      days REAL NOT NULL DEFAULT 0,
      from_date TEXT NOT NULL DEFAULT '',
      to_date TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ثبت‌شده',
      result TEXT NOT NULL DEFAULT '',
      log_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name_fa TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_key TEXT NOT NULL DEFAULT 'support',
      display_name TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureAdminRbacColumns();
  ensureHrEmployeeColumns();
  ensureHrCandidateColumns();
  ensureHrRequestColumns();

  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_employees_code ON hr_employees(personnel_code)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_contracts_employee ON hr_contracts(employee_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_candidates_opening ON hr_candidates(job_opening_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_requests_employee ON hr_requests(employee_id)`);

  // Expanded modules (onboarding / cost / service / notifications) — additive only
  const { ensureHrModuleTables } = require('./hr-modules') as typeof import('./hr-modules');
  ensureHrModuleTables();

  seedHrDefaults();
  backfillHrPublicIds();
}

function ensureAdminRbacColumns(): void {
  const d = db();
  const roleCols = new Set(
    (d.prepare(`PRAGMA table_info(admin_roles)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!roleCols.has('is_active')) {
    d.exec(`ALTER TABLE admin_roles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
  }
}

/** Additive columns for existing hr_employees DBs — never wipe. */
function ensureHrEmployeeColumns(): void {
  const d = db();
  const cols = new Set(
    (d.prepare(`PRAGMA table_info(hr_employees)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!cols.has('avatar_url')) {
    d.exec(`ALTER TABLE hr_employees ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''`);
  }
  if (!cols.has('mobile')) {
    d.exec(`ALTER TABLE hr_employees ADD COLUMN mobile TEXT NOT NULL DEFAULT ''`);
  }
}

/** Additive columns for hr_requests — never wipe. */
export function ensureHrRequestColumns(): void {
  const d = db();
  const cols = new Set(
    (d.prepare(`PRAGMA table_info(hr_requests)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!cols.has('result')) {
    d.exec(`ALTER TABLE hr_requests ADD COLUMN result TEXT NOT NULL DEFAULT ''`);
  }
}

/** Throws if trimmed nationalId is non-empty and already used by another employee. */
export function assertNationalIdUnique(nationalId: string, excludeId?: number): void {
  const nid = String(nationalId || '').trim();
  if (!nid) return;
  const row =
    excludeId != null
      ? (db()
          .prepare(
            `SELECT id FROM hr_employees WHERE TRIM(national_id) = ? AND id != ? LIMIT 1`
          )
          .get(nid, excludeId) as { id: number } | undefined)
      : (db()
          .prepare(`SELECT id FROM hr_employees WHERE TRIM(national_id) = ? LIMIT 1`)
          .get(nid) as { id: number } | undefined);
  if (row) throw new Error('کد ملی تکراری است');
}

/** Additive columns for ATS candidates / follow-up workflow — never wipe. */
function ensureHrCandidateColumns(): void {
  const d = db();
  const cols = new Set(
    (d.prepare(`PRAGMA table_info(hr_candidates)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!cols.has('job_title')) {
    d.exec(`ALTER TABLE hr_candidates ADD COLUMN job_title TEXT NOT NULL DEFAULT ''`);
  }
  if (!cols.has('followup_json')) {
    d.exec(`ALTER TABLE hr_candidates ADD COLUMN followup_json TEXT NOT NULL DEFAULT '{}'`);
  }
}

function seedHrDefaults(): void {
  const d = db();
  const layerCount = Number(
    (d.prepare('SELECT COUNT(*) as c FROM hr_career_layers').get() as { c: number })?.c ?? 0
  );
  if (layerCount === 0) {
    const ins = d.prepare(
      `INSERT INTO hr_career_layers (name, sort_order, unlocks) VALUES (?, ?, ?)`
    );
    ins.run('دوره آزمایشی', 0, 'دسترسی پایه، تجهیزات اولیه');
    ins.run('تثبیت‌شده', 1, 'مزایای استاندارد کارکنان، بودجه آموزشی پایه');
    ins.run('حرفه‌ای / عملکرد بالا', 2, 'واجد شرایط بازبینی حقوق، پاداش بالاتر، آموزش پیشرفته');
    ins.run('رهبری / رشد', 3, 'کاندیدای سرپرستی/مدیریت، مسئولیت پروژه');
  }

  const modelCount = Number(
    (d.prepare('SELECT COUNT(*) as c FROM hr_income_models').get() as { c: number })?.c ?? 0
  );
  if (modelCount === 0) {
    const ins = d.prepare(
      `INSERT INTO hr_income_models (name, type, variable_amount, variable_percent) VALUES (?, ?, ?, ?)`
    );
    ins.run('مدل استاندارد فروش', 'متغیر', 0, 2);
    ins.run('مدل ثابت مدیریتی', 'ثابت + متغیر', 5000000, 1);
  }

  const benefitCount = Number(
    (d.prepare('SELECT COUNT(*) as c FROM hr_benefit_defs').get() as { c: number })?.c ?? 0
  );
  if (benefitCount === 0) {
    const layers = d
      .prepare('SELECT id, sort_order FROM hr_career_layers ORDER BY sort_order')
      .all() as Array<{ id: number; sort_order: number }>;
    const byOrder = (n: number) => layers.find((l) => l.sort_order === n)?.id ?? null;
    const ins = d.prepare(
      `INSERT INTO hr_benefit_defs (title, category, career_layer_id, job_title, cost) VALUES (?, ?, ?, ?, ?)`
    );
    ins.run('بیمه تکمیلی', 'درمانی', byOrder(1), null, 2000000);
    ins.run('کارت هدیه تولد', 'رفاهی', null, null, 1000000);
    ins.run('بودجه آموزش پیشرفته', 'آموزشی', byOrder(2), null, 5000000);
  }

  // Seed defaults only when missing — never overwrite UI edits on restart
  const seedRoleIfMissing = (
    key: string,
    nameFa: string,
    description: string,
    permissions: readonly string[]
  ) => {
    const existing = d.prepare('SELECT id FROM admin_roles WHERE key = ?').get(key) as
      | { id: number }
      | undefined;
    if (existing) return;
    d.prepare(
      `INSERT INTO admin_roles (key, name_fa, description, permissions_json, is_active)
       VALUES (?, ?, ?, ?, 1)`
    ).run(key, nameFa, description, JSON.stringify(permissions));
  };
  seedRoleIfMissing(
    'admin',
    'مدیر کامل',
    'دسترسی کامل به پنل ادمین و منابع انسانی',
    ADMIN_ROLE_PERMISSIONS.admin
  );
  seedRoleIfMissing(
    'support',
    'پشتیبانی',
    'دسترسی محدود — خواندن پلتفرم و HR؛ آمادهٔ گسترش نقش‌های بعدی',
    ADMIN_ROLE_PERMISSIONS.support
  );
  seedRoleIfMissing(
    'hr_admin',
    'مدیر منابع انسانی',
    'دسترسی کامل به همه ماژول‌های منابع انسانی',
    ['hr.read', 'hr.write']
  );
  seedRoleIfMissing(
    'recruiter',
    'استخدام‌کننده',
    'مدیریت استخدام و جذب',
    ['hr.read', 'hr.write']
  );

  // Backfill sales.* onto existing admin role (roles seeded before Sales CRM landed)
  const mergeRolePerms = (key: string, required: readonly string[]) => {
    const row = d.prepare('SELECT id, permissions_json FROM admin_roles WHERE key = ?').get(key) as
      | { id: number; permissions_json: string }
      | undefined;
    if (!row) return;
    let perms: string[] = [];
    try {
      perms = JSON.parse(String(row.permissions_json || '[]')) as string[];
    } catch {
      perms = [];
    }
    const set = new Set(perms.map(String));
    let changed = false;
    for (const p of required) {
      if (!set.has(p)) {
        set.add(p);
        changed = true;
      }
    }
    if (changed) {
      d.prepare('UPDATE admin_roles SET permissions_json = ? WHERE id = ?').run(
        JSON.stringify([...set]),
        row.id
      );
    }
  };
  mergeRolePerms('admin', ADMIN_ROLE_PERMISSIONS.admin);

  // Optional support account from env — never overwrite existing hash if user changed password
  const supportUser = (process.env.ADMIN_SUPPORT_USER || 'support').trim();
  const supportPass = (process.env.ADMIN_SUPPORT_PASSWORD || '').trim();
  if (supportPass) {
    const existing = d
      .prepare('SELECT id FROM admin_accounts WHERE username = ?')
      .get(supportUser) as { id: number } | undefined;
    if (!existing) {
      d.prepare(
        `INSERT INTO admin_accounts (username, password_hash, role_key, display_name, is_active)
         VALUES (?, ?, 'support', 'پشتیبانی', 1)`
      ).run(supportUser, hashPassword(supportPass));
    }
  }
}

function backfillHrPublicIds(): void {
  const d = db();
  const rows = d
    .prepare(`SELECT id, public_id FROM hr_employees WHERE public_id IS NULL OR public_id = ''`)
    .all() as Array<{ id: number; public_id: string | null }>;
  const upd = d.prepare('UPDATE hr_employees SET public_id = ? WHERE id = ?');
  for (const row of rows) {
    upd.run(makeEmployeePublicId(row.id), row.id);
  }
  const contracts = d
    .prepare(`SELECT id, contract_code FROM hr_contracts WHERE contract_code IS NULL OR contract_code = ''`)
    .all() as Array<{ id: number; contract_code: string | null }>;
  const cupd = d.prepare('UPDATE hr_contracts SET contract_code = ? WHERE id = ?');
  for (const row of contracts) {
    cupd.run(makeContractCode(row.id), row.id);
  }
}

function mapBenefits(raw: unknown): HrEmployeeBenefits {
  const o = parseJson<Partial<HrEmployeeBenefits>>(raw, {});
  return { ...defaultHrBenefits(), ...o };
}

function mapContract(row: Record<string, unknown>): HrContract {
  const id = Number(row.id);
  return {
    id,
    contractCode: String(row.contract_code || makeContractCode(id)),
    employeeId: Number(row.employee_id),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    salary: Number(row.salary || 0),
    eidi: Number(row.eidi || 0),
    sanavat: Number(row.sanavat || 0),
    commissionPercent: Number(row.commission_percent || 0),
    insuranceNo: String(row.insurance_no || ''),
    bankAccountNo: String(row.bank_account_no || ''),
    sheba: String(row.sheba || ''),
    cardNo: String(row.card_no || ''),
    bankName: String(row.bank_name || ''),
    salesAffectsPayout: String(row.sales_affects_payout || 'نامشخص'),
    contractFileName: String(row.contract_file_name || ''),
    ndaFileName: String(row.nda_file_name || ''),
    createdAt: String(row.created_at || ''),
  };
}

function mapEmployee(row: Record<string, unknown>, withRelated = false): HrEmployee {
  const id = Number(row.id);
  const emp: HrEmployee = {
    id,
    publicId: employeePublicIdOf({ id, publicId: row.public_id as string | undefined }),
    uuid: String(row.uuid || ''),
    personnelCode: String(row.personnel_code || ''),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    gender: String(row.gender || ''),
    birthDate: String(row.birth_date || ''),
    birthCertNo: String(row.birth_cert_no || ''),
    nationalId: String(row.national_id || ''),
    fatherName: String(row.father_name || ''),
    province: String(row.province || ''),
    city: String(row.city || ''),
    address: String(row.address || ''),
    maritalStatus: String(row.marital_status || ''),
    childrenCount: String(row.children_count || ''),
    militaryStatus: String(row.military_status || ''),
    gmail: String(row.gmail || ''),
    educationLevel: String(row.education_level || ''),
    fieldOfStudy: String(row.field_of_study || ''),
    jobTitle: String(row.job_title || ''),
    department: String(row.department || ''),
    location: String(row.location || ''),
    reportingManagerTitle: String(row.reporting_manager_title || ''),
    reportingManagerPersonId: String(row.reporting_manager_person_id || ''),
    cooperationType: String(row.cooperation_type || ''),
    benefits: mapBenefits(row.benefits_json),
    extension: String(row.extension || ''),
    orgEmail: String(row.org_email || ''),
    contractStatus: String(row.contract_status || ''),
    accessStatus: String(row.access_status || ''),
    username: String(row.username || row.personnel_code || ''),
    mobile: String(row.mobile || ''),
    avatarUrl: String(row.avatar_url || ''),
    incomeModelId: row.income_model_id != null ? Number(row.income_model_id) : null,
    careerLayerId: row.career_layer_id != null ? Number(row.career_layer_id) : null,
    permissions: parseJson<Record<string, boolean>>(row.permissions_json, {}),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
  if (row.contract_start_date != null || row.contract_end_date != null) {
    emp.contractStartDate = String(row.contract_start_date || '');
    emp.contractEndDate = String(row.contract_end_date || '');
  }
  if (withRelated) {
    emp.contracts = listContracts(id);
    emp.logs = listEmployeeLogs(id);
    const latest = emp.contracts?.[0];
    if (latest) {
      emp.contractStartDate = latest.startDate;
      emp.contractEndDate = latest.endDate;
    }
  }
  return emp;
}

export type HrEmployeeInput = Partial<HrEmployee> & {
  firstName: string;
  lastName: string;
  password?: string;
};

function nextPersonnelCode(): string {
  const d = db();
  const row = d.prepare('SELECT COUNT(*) as c FROM hr_employees').get() as { c: number };
  const n = Number(row?.c || 0) + 1;
  return `PD-HR-${String(n).padStart(3, '0')}`;
}

function genHrPassword(): string {
  const rand = randomBytes(3).toString('hex');
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `Hr${rand}${num}`;
}

/** Sanitize Latin username like admin accounts. Returns '' if invalid. */
export function sanitizeHrUsername(raw: string): string {
  const u = String(raw || '')
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9._-]{2,64}$/.test(u)) return '';
  return u;
}

/** Jalali → Gregorian for contract expiry checks. */
function jalaliToGregorianParts(jy: number, jm: number, jd: number): {
  gy: number;
  gm: number;
  gd: number;
} {
  const jy2 = jy <= 979 ? jy : jy - 979;
  let days =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 1600 + 400 * Math.floor(days / 146097);
  days %= 146097;
  let leap = true;
  if (days >= 36525) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
    else leap = false;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days >= 366) {
    leap = false;
    days--;
    gy += Math.floor(days / 365);
    days %= 365;
  }
  const sal_a = [
    0,
    31,
    leap || (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && days >= sal_a[gm]; gm++) days -= sal_a[gm];
  return { gy, gm, gd: days + 1 };
}

/** True when endDate is strictly before today (Jalali YYYY/MM/DD or Gregorian YYYY-MM-DD). */
export function isHrContractEndPast(endDate: string, now = new Date()): boolean {
  const raw = String(endDate || '').trim();
  if (!raw) return false;
  const jalali = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (jalali) {
    const { gy, gm, gd } = jalaliToGregorianParts(
      Number(jalali[1]),
      Number(jalali[2]),
      Number(jalali[3])
    );
    const end = new Date(gy, gm - 1, gd, 23, 59, 59);
    return end.getTime() < now.getTime();
  }
  const greg = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (greg) {
    const end = new Date(Number(greg[1]), Number(greg[2]) - 1, Number(greg[3]), 23, 59, 59);
    return end.getTime() < now.getTime();
  }
  return false;
}

/**
 * Disable panel access for employees whose latest contract end date has passed.
 * Also deactivates matching admin_accounts. Logs once per transition.
 */
export function enforceExpiredContractAccess(): number {
  const d = db();
  ensureHrEmployeeColumns();
  const rows = d
    .prepare(
      `SELECT e.id AS employee_id, e.username, e.access_status, c.end_date
       FROM hr_employees e
       INNER JOIN hr_contracts c ON c.id = (
         SELECT c2.id FROM hr_contracts c2
         WHERE c2.employee_id = e.id
         ORDER BY c2.start_date DESC, c2.id DESC
         LIMIT 1
       )
       WHERE e.access_status != 'غیر فعال'`
    )
    .all() as Array<{
    employee_id: number;
    username: string;
    access_status: string;
    end_date: string;
  }>;
  let disabled = 0;
  for (const row of rows) {
    if (!isHrContractEndPast(row.end_date)) continue;
    d.prepare(
      `UPDATE hr_employees SET access_status = 'غیر فعال', updated_at = datetime('now') WHERE id = ?`
    ).run(row.employee_id);
    appendLog(row.employee_id, 'accessStatus', row.access_status || 'فعال', 'غیر فعال');
    appendLog(row.employee_id, 'پایان اعتبار قرارداد', row.end_date || '', 'دسترسی غیرفعال شد');
    const uname = String(row.username || '').trim().toLowerCase();
    if (uname) {
      d.prepare(`UPDATE admin_accounts SET is_active = 0 WHERE username = ? AND is_active = 1`).run(
        uname
      );
    }
    disabled += 1;
  }
  return disabled;
}

const TRACKED_FIELDS: Array<keyof HrEmployee> = [
  'jobTitle',
  'department',
  'location',
  'contractStatus',
  'accessStatus',
];

function appendLog(employeeId: number, field: string, oldValue: string, newValue: string): void {
  if (oldValue === newValue) return;
  db()
    .prepare(
      `INSERT INTO hr_employee_logs (employee_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`
    )
    .run(employeeId, field, oldValue, newValue);
}

export function listEmployees(opts?: {
  q?: string;
  contractStatus?: string;
  accessStatus?: string;
  department?: string;
  jobTitle?: string;
  limit?: number;
  offset?: number;
}): { total: number; employees: HrEmployee[] } {
  try {
    enforceExpiredContractAccess();
  } catch {
    /* non-fatal */
  }
  const d = db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    where.push(
      `(e.first_name LIKE ? OR e.last_name LIKE ? OR e.personnel_code LIKE ? OR e.public_id LIKE ? OR e.org_email LIKE ? OR e.job_title LIKE ?)`
    );
    params.push(q, q, q, q, q, q);
  }
  if (opts?.contractStatus) {
    where.push('e.contract_status = ?');
    params.push(opts.contractStatus);
  }
  if (opts?.accessStatus) {
    where.push('e.access_status = ?');
    params.push(opts.accessStatus);
  }
  if (opts?.department?.trim()) {
    where.push('e.department = ?');
    params.push(opts.department.trim());
  }
  if (opts?.jobTitle?.trim()) {
    where.push('e.job_title = ?');
    params.push(opts.jobTitle.trim());
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(
    (
      d.prepare(`SELECT COUNT(*) as c FROM hr_employees e ${clause}`).get(...params) as {
        c: number;
      }
    )?.c ?? 0
  );
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const offset = Math.max(opts?.offset ?? 0, 0);
  /** Latest contract per employee by start_date, then id. */
  const rows = d
    .prepare(
      `SELECT e.*,
        lc.start_date AS contract_start_date,
        lc.end_date AS contract_end_date
       FROM hr_employees e
       LEFT JOIN hr_contracts lc ON lc.id = (
         SELECT c.id FROM hr_contracts c
         WHERE c.employee_id = e.id
         ORDER BY c.start_date DESC, c.id DESC
         LIMIT 1
       )
       ${clause}
       ORDER BY e.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Record<string, unknown>[];
  return { total, employees: rows.map((r) => mapEmployee(r)) };
}

export function getEmployee(id: number): HrEmployee | null {
  const row = db().prepare('SELECT * FROM hr_employees WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return mapEmployee(row, true);
}

/** Delete employee and related HR rows (contracts, logs, requests, modules). Never wipes DB. */
export function deleteEmployee(id: number): boolean {
  const d = db();
  const exists = d.prepare('SELECT id FROM hr_employees WHERE id = ?').get(id) as
    | { id: number }
    | undefined;
  if (!exists) return false;

  const run = d.transaction(() => {
    d.prepare('DELETE FROM hr_contracts WHERE employee_id = ?').run(id);
    d.prepare('DELETE FROM hr_employee_logs WHERE employee_id = ?').run(id);
    d.prepare('DELETE FROM hr_requests WHERE employee_id = ?').run(id);
    try {
      d.prepare('DELETE FROM hr_onboarding_records WHERE employee_id = ?').run(id);
    } catch {
      /* table may be absent on older DBs before module ensure */
    }
    try {
      d.prepare('DELETE FROM hr_cost_entries WHERE employee_id = ?').run(id);
    } catch {
      /* optional module table */
    }
    try {
      d.prepare('DELETE FROM hr_service_entries WHERE employee_id = ?').run(id);
    } catch {
      /* optional module table */
    }
    d.prepare('DELETE FROM hr_employees WHERE id = ?').run(id);
  });
  run();
  return true;
}

export function createEmployee(input: HrEmployeeInput): HrEmployee {
  const d = db();
  ensureHrEmployeeColumns();
  const nationalId = String(input.nationalId || '').trim();
  assertNationalIdUnique(nationalId);
  const personnelCode = (input.personnelCode || nextPersonnelCode()).trim();
  const fromInput = sanitizeHrUsername(String(input.username || ''));
  const fromCode = sanitizeHrUsername(personnelCode.toLowerCase().replace(/[^a-z0-9._-]/g, '-'));
  const username = fromInput || fromCode || sanitizeHrUsername(`u${Date.now().toString(36)}`);
  const password = input.password?.trim() || genHrPassword();
  const orgEmail =
    String(input.orgEmail || '').trim() || (username ? `${username}@petdate.ir` : '');
  const mobile = String(input.mobile || '').trim();
  let contractStatus = input.contractStatus || 'در حال همکاری';
  let accessStatus = input.accessStatus || 'فعال';
  if (contractStatus === 'عدم تمدید' || contractStatus === 'اخراج') {
    accessStatus = 'غیر فعال';
  }
  const benefits = input.benefits || defaultHrBenefits();
  const info = d
    .prepare(
      `INSERT INTO hr_employees (
        uuid, personnel_code, first_name, last_name, gender, birth_date, birth_cert_no,
        national_id, father_name, province, city, address, marital_status, children_count,
        military_status, gmail, education_level, field_of_study, job_title, department,
        location, reporting_manager_title, reporting_manager_person_id, cooperation_type,
        benefits_json, extension, org_email, contract_status, access_status, username, password,
        avatar_url, income_model_id, career_layer_id, permissions_json, mobile
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )`
    )
    .run(
      randomUUID(),
      personnelCode,
      input.firstName.trim(),
      input.lastName.trim(),
      input.gender || '',
      input.birthDate || '',
      input.birthCertNo || '',
      nationalId,
      input.fatherName || '',
      input.province || '',
      input.city || '',
      input.address || '',
      input.maritalStatus || '',
      input.childrenCount || '',
      input.militaryStatus || '',
      input.gmail || '',
      input.educationLevel || '',
      input.fieldOfStudy || '',
      input.jobTitle || '',
      input.department || '',
      input.location || '',
      input.reportingManagerTitle || '',
      input.reportingManagerPersonId || '',
      input.cooperationType || 'تمام وقت',
      JSON.stringify(benefits),
      input.extension || '',
      orgEmail,
      contractStatus,
      accessStatus,
      username || personnelCode,
      password,
      String(input.avatarUrl || '').trim(),
      input.incomeModelId ?? null,
      input.careerLayerId ?? null,
      JSON.stringify(input.permissions || {}),
      mobile
    );
  const id = Number(info.lastInsertRowid);
  d.prepare('UPDATE hr_employees SET public_id = ? WHERE id = ?').run(makeEmployeePublicId(id), id);
  return getEmployee(id)!;
}

/** Plain password stored on hr_employees (used once for SMS / admin account bootstrap). */
export function getEmployeePlainPassword(id: number): string {
  const row = db().prepare('SELECT password FROM hr_employees WHERE id = ?').get(id) as
    | { password?: string }
    | undefined;
  return String(row?.password || '');
}

/** Regenerate (or set) employee plain password; syncs matching admin_accounts row. */
export function resetEmployeePassword(id: number, password?: string): string | null {
  const emp = getEmployee(id);
  if (!emp) return null;
  const next = String(password || '').trim() || genHrPassword();
  db()
    .prepare(`UPDATE hr_employees SET password = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(next, id);
  const acct = db()
    .prepare('SELECT id FROM admin_accounts WHERE username = ? LIMIT 1')
    .get(emp.username) as { id: number } | undefined;
  if (acct) {
    try {
      updateAdminAccount(acct.id, { password: next });
    } catch {
      /* role/account edge — non-fatal */
    }
  }
  return next;
}

export function updateEmployee(id: number, input: Partial<HrEmployeeInput>): HrEmployee | null {
  const prev = getEmployee(id);
  if (!prev) return null;
  const d = db();
  ensureHrEmployeeColumns();
  if (input.nationalId !== undefined) {
    assertNationalIdUnique(String(input.nationalId || ''), id);
  }
  const usernameFromInput =
    input.username !== undefined ? sanitizeHrUsername(String(input.username)) : '';
  const next: HrEmployee = {
    ...prev,
    ...input,
    id: prev.id,
    publicId: prev.publicId,
    uuid: prev.uuid,
    nationalId:
      input.nationalId !== undefined ? String(input.nationalId || '').trim() : prev.nationalId,
    username:
      usernameFromInput ||
      (input.personnelCode
        ? sanitizeHrUsername(String(input.personnelCode).toLowerCase()) || prev.username
        : prev.username),
    mobile: input.mobile !== undefined ? String(input.mobile || '').trim() : prev.mobile,
    benefits: input.benefits || prev.benefits,
    permissions: input.permissions || prev.permissions,
  };
  if (next.contractStatus === 'عدم تمدید' || next.contractStatus === 'اخراج') {
    next.accessStatus = 'غیر فعال';
  }
  d.prepare(
    `UPDATE hr_employees SET
      personnel_code=?, first_name=?, last_name=?, gender=?, birth_date=?, birth_cert_no=?,
      national_id=?, father_name=?, province=?, city=?, address=?, marital_status=?, children_count=?,
      military_status=?, gmail=?, education_level=?, field_of_study=?, job_title=?, department=?,
      location=?, reporting_manager_title=?, reporting_manager_person_id=?, cooperation_type=?,
      benefits_json=?, extension=?, org_email=?, contract_status=?, access_status=?, username=?,
      password=COALESCE(?, password), avatar_url=?, income_model_id=?, career_layer_id=?, permissions_json=?,
      mobile=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(
    next.personnelCode,
    next.firstName,
    next.lastName,
    next.gender,
    next.birthDate,
    next.birthCertNo,
    next.nationalId,
    next.fatherName,
    next.province,
    next.city,
    next.address,
    next.maritalStatus,
    next.childrenCount,
    next.militaryStatus,
    next.gmail,
    next.educationLevel,
    next.fieldOfStudy,
    next.jobTitle,
    next.department,
    next.location,
    next.reportingManagerTitle,
    next.reportingManagerPersonId,
    next.cooperationType,
    JSON.stringify(next.benefits),
    next.extension,
    next.orgEmail,
    next.contractStatus,
    next.accessStatus,
    next.username,
    input.password?.trim() || null,
    String(next.avatarUrl ?? prev.avatarUrl ?? '').trim(),
    next.incomeModelId ?? null,
    next.careerLayerId ?? null,
    JSON.stringify(next.permissions),
    next.mobile || '',
    id
  );
  for (const field of TRACKED_FIELDS) {
    appendLog(id, String(field), String(prev[field] ?? ''), String(next[field] ?? ''));
  }
  return getEmployee(id);
}

export function listContracts(employeeId?: number): HrContract[] {
  const d = db();
  const rows = (
    employeeId != null
      ? d
          .prepare('SELECT * FROM hr_contracts WHERE employee_id = ? ORDER BY start_date DESC, id DESC')
          .all(employeeId)
      : d.prepare('SELECT * FROM hr_contracts ORDER BY id DESC LIMIT 200').all()
  ) as Record<string, unknown>[];
  return rows.map(mapContract);
}

export function createContract(
  employeeId: number,
  input: Partial<HrContract> & { startDate: string; salary?: number }
): HrContract | null {
  const emp = getEmployee(employeeId);
  if (!emp) return null;
  const d = db();
  const priorCount = Number(
    (
      d.prepare('SELECT COUNT(*) as c FROM hr_contracts WHERE employee_id = ?').get(employeeId) as {
        c: number;
      }
    )?.c ?? 0
  );
  // Close previous open contracts
  if (input.startDate) {
    d.prepare(
      `UPDATE hr_contracts SET end_date = ?
       WHERE employee_id = ? AND (end_date IS NULL OR end_date = '')`
    ).run(input.startDate, employeeId);
  }
  const info = d
    .prepare(
      `INSERT INTO hr_contracts (
        employee_id, start_date, end_date, salary, eidi, sanavat, commission_percent,
        insurance_no, bank_account_no, sheba, card_no, bank_name, sales_affects_payout,
        contract_file_name, nda_file_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      employeeId,
      input.startDate,
      input.endDate || '',
      input.salary ?? 0,
      input.eidi ?? 0,
      input.sanavat ?? 0,
      input.commissionPercent ?? 0,
      input.insuranceNo || '',
      input.bankAccountNo || '',
      input.sheba || '',
      input.cardNo || '',
      input.bankName || '',
      input.salesAffectsPayout || 'نامشخص',
      input.contractFileName || '',
      input.ndaFileName || ''
    );
  const id = Number(info.lastInsertRowid);
  const code = makeContractCode(id);
  d.prepare('UPDATE hr_contracts SET contract_code = ? WHERE id = ?').run(code, id);
  if (priorCount > 0) {
    appendLog(employeeId, 'تمدید قرارداد', '', input.startDate);
  } else {
    appendLog(employeeId, 'شروع قرارداد', '', input.startDate);
  }
  if (input.endDate) {
    appendLog(employeeId, 'پایان قرارداد', '', String(input.endDate));
  }
  // Optional job fields on renew
  if (input as { jobTitle?: string }) {
    const patch = input as Partial<HrEmployee> & Partial<HrContract>;
    if (patch.jobTitle || patch.department || patch.cooperationType) {
      updateEmployee(employeeId, {
        jobTitle: (patch as HrEmployee).jobTitle,
        department: (patch as HrEmployee).department,
        cooperationType: (patch as HrEmployee).cooperationType,
        reportingManagerTitle: (patch as HrEmployee).reportingManagerTitle,
      });
    }
  }
  return mapContract(
    d.prepare('SELECT * FROM hr_contracts WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function listEmployeeLogs(employeeId: number): HrEmployeeLog[] {
  const rows = db()
    .prepare('SELECT * FROM hr_employee_logs WHERE employee_id = ? ORDER BY id DESC LIMIT 100')
    .all(employeeId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    loggedAt: String(row.logged_at || ''),
    field: String(row.field || ''),
    oldValue: String(row.old_value || ''),
    newValue: String(row.new_value || ''),
  }));
}

export function listCareerLayers(): HrCareerLayer[] {
  return (
    db().prepare('SELECT * FROM hr_career_layers ORDER BY sort_order, id').all() as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    sortOrder: Number(r.sort_order || 0),
    unlocks: String(r.unlocks || ''),
  }));
}

export function listIncomeModels(): HrIncomeModel[] {
  return (
    db().prepare('SELECT * FROM hr_income_models ORDER BY id').all() as Record<string, unknown>[]
  ).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    type: String(r.type),
    variableAmount: Number(r.variable_amount || 0),
    variablePercent: Number(r.variable_percent || 0),
  }));
}

export function listBenefitDefs(): HrBenefitDef[] {
  return (
    db().prepare('SELECT * FROM hr_benefit_defs ORDER BY id').all() as Record<string, unknown>[]
  ).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    category: String(r.category || ''),
    careerLayerId: r.career_layer_id != null ? Number(r.career_layer_id) : null,
    jobTitle: r.job_title != null ? String(r.job_title) : null,
    cost: Number(r.cost || 0),
  }));
}

export function listJobOpenings(): HrJobOpening[] {
  return (
    db().prepare('SELECT * FROM hr_job_openings ORDER BY id DESC').all() as Record<string, unknown>[]
  ).map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    department: String(r.department || ''),
    status: String(r.status || 'باز'),
    openings: Number(r.openings || 1),
    createdAt: String(r.created_at || ''),
  }));
}

export function createJobOpening(input: {
  title: string;
  department?: string;
  status?: string;
  openings?: number;
}): HrJobOpening {
  const info = db()
    .prepare(
      `INSERT INTO hr_job_openings (title, department, status, openings) VALUES (?, ?, ?, ?)`
    )
    .run(input.title.trim(), input.department || '', input.status || 'باز', input.openings ?? 1);
  const id = Number(info.lastInsertRowid);
  return listJobOpenings().find((j) => j.id === id)!;
}

export function listCandidates(opts?: { stage?: string; jobOpeningId?: number }): HrCandidate[] {
  const d = db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.stage) {
    where.push('stage = ?');
    params.push(opts.stage);
  }
  if (opts?.jobOpeningId) {
    where.push('job_opening_id = ?');
    params.push(opts.jobOpeningId);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = d
    .prepare(`SELECT * FROM hr_candidates ${clause} ORDER BY id DESC`)
    .all(...params) as Record<string, unknown>[];
  return rows.map(mapCandidate);
}

function mapCandidate(row: Record<string, unknown>): HrCandidate {
  const followupRaw = parseJson<Partial<HrCandidateFollowup>>(row.followup_json, {});
  const followup: HrCandidateFollowup = {
    ...emptyCandidateFollowup(),
    ...followupRaw,
    calls: Array.isArray(followupRaw.calls) ? followupRaw.calls : [],
    callRound: (followupRaw.callRound === 2 || followupRaw.callRound === 3
      ? followupRaw.callRound
      : 1) as 1 | 2 | 3,
  };
  return {
    id: Number(row.id),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    mobile: String(row.mobile || ''),
    email: String(row.email || ''),
    city: String(row.city || ''),
    source: String(row.source || ''),
    jobBoard: String(row.job_board || ''),
    jobTitle: String(row.job_title || ''),
    jobOpeningId: row.job_opening_id != null ? Number(row.job_opening_id) : null,
    applicationDate: String(row.application_date || ''),
    notes: String(row.notes || ''),
    stage: String(row.stage || ''),
    resume: String(row.resume || ''),
    logs: parseJson(row.logs_json, []),
    followup,
    createdAt: String(row.created_at || ''),
  };
}

export function createCandidate(input: {
  firstName: string;
  lastName: string;
  mobile?: string;
  email?: string;
  city?: string;
  source?: string;
  jobBoard?: string;
  jobTitle?: string;
  jobOpeningId?: number | null;
  applicationDate?: string;
  notes?: string;
  stage?: string;
}): { candidate: HrCandidate; duplicateMobile: boolean } {
  const d = db();
  const mobile = (input.mobile || '').trim();
  let duplicateMobile = false;
  if (mobile) {
    const dup = d
      .prepare('SELECT id FROM hr_candidates WHERE mobile = ? LIMIT 1')
      .get(mobile) as { id: number } | undefined;
    duplicateMobile = Boolean(dup);
  }
  const stage = input.stage || 'متقاضی جدید';
  const logs = [{ at: new Date().toISOString(), stage, note: 'ثبت اولیه' }];
  const followup = emptyCandidateFollowup();
  const info = d
    .prepare(
      `INSERT INTO hr_candidates (
        first_name, last_name, mobile, email, city, source, job_board, job_title, job_opening_id,
        application_date, notes, stage, logs_json, followup_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.firstName.trim(),
      input.lastName.trim(),
      mobile,
      input.email || '',
      input.city || '',
      input.source || '',
      input.jobBoard || '',
      input.jobTitle || '',
      input.jobOpeningId ?? null,
      input.applicationDate || new Date().toISOString().slice(0, 10),
      input.notes || '',
      stage,
      JSON.stringify(logs),
      JSON.stringify(followup)
    );
  const id = Number(info.lastInsertRowid);
  return {
    candidate: mapCandidate(
      d.prepare('SELECT * FROM hr_candidates WHERE id = ?').get(id) as Record<string, unknown>
    ),
    duplicateMobile,
  };
}

export function getCandidate(id: number): HrCandidate | null {
  const row = db().prepare('SELECT * FROM hr_candidates WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapCandidate(row) : null;
}

function saveCandidateFollowup(id: number, followup: HrCandidateFollowup, stage?: string): HrCandidate | null {
  const d = db();
  const row = d.prepare('SELECT * FROM hr_candidates WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  if (stage) {
    const logs = parseJson<Array<{ at: string; stage: string; note?: string }>>(row.logs_json, []);
    logs.push({ at: new Date().toISOString(), stage });
    d.prepare(
      'UPDATE hr_candidates SET stage = ?, logs_json = ?, followup_json = ? WHERE id = ?'
    ).run(stage, JSON.stringify(logs), JSON.stringify(followup), id);
  } else {
    d.prepare('UPDATE hr_candidates SET followup_json = ? WHERE id = ?').run(
      JSON.stringify(followup),
      id
    );
  }
  return getCandidate(id);
}

/** Record call1/2/3 outcome; escalate or mark no-contact after 3 fails. */
export function recordCandidateCall(
  id: number,
  input: { outcome: string; note?: string; at?: string }
): HrCandidate | null {
  const cand = getCandidate(id);
  if (!cand) return null;
  const outcome = String(input.outcome || '').trim();
  if (!outcome) return cand;
  const followup = { ...cand.followup, calls: [...cand.followup.calls] };
  const round = followup.callRound;
  const rawAt = String(input.at || '').trim();
  let at = new Date().toISOString();
  if (rawAt) {
    // Accept `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm` — store as ISO.
    const parsed = new Date(rawAt.length === 10 ? `${rawAt}T12:00:00` : rawAt);
    if (!Number.isNaN(parsed.getTime())) at = parsed.toISOString();
  }
  followup.calls.push({
    round,
    outcome,
    at,
    note: input.note || '',
  });
  let nextStage: string | undefined;
  if (outcome === HR_CALL_CONNECTED) {
    nextStage = 'غربالگری تلفنی';
  } else {
    // failed / deferred contact — escalate round
    if (round >= 3) {
      nextStage = HR_REJECTED_NO_CONTACT;
    } else {
      followup.callRound = (round + 1) as 1 | 2 | 3;
      if (cand.stage === 'متقاضی جدید') nextStage = 'غربالگری تلفنی';
    }
  }
  return saveCandidateFollowup(id, followup, nextStage);
}

export function scheduleCandidateInterview(
  id: number,
  input: {
    interviewAt: string;
    interviewerEmployeeId?: number | null;
    interviewerName?: string;
    interviewNote?: string;
  }
): HrCandidate | null {
  const cand = getCandidate(id);
  if (!cand) return null;
  const followup: HrCandidateFollowup = {
    ...cand.followup,
    interviewAt: String(input.interviewAt || '').trim(),
    interviewerEmployeeId: input.interviewerEmployeeId ?? null,
    interviewerName: String(input.interviewerName || '').trim(),
    interviewNote: String(input.interviewNote || '').trim(),
  };
  return saveCandidateFollowup(id, followup, 'مصاحبه');
}

export function setCandidateDecision(
  id: number,
  input: { decision: 'approve' | 'reject'; startDate?: string; note?: string }
): HrCandidate | null {
  const cand = getCandidate(id);
  if (!cand) return null;
  const followup: HrCandidateFollowup = {
    ...cand.followup,
    decision: input.decision,
    decisionNote: input.note || '',
    decisionAt: new Date().toISOString(),
    startDate: input.startDate || cand.followup.startDate || '',
  };
  const stage = input.decision === 'approve' ? 'پیشنهاد شغلی' : 'رد شده';
  return saveCandidateFollowup(id, followup, stage);
}

export function appendCandidateNotifyLog(
  id: number,
  entry: { channel: 'sms' | 'email'; ok: boolean; detail?: string }
): HrCandidate | null {
  const cand = getCandidate(id);
  if (!cand) return null;
  const followup: HrCandidateFollowup = {
    ...cand.followup,
    notifyLog: [
      ...(cand.followup.notifyLog || []),
      { ...entry, at: new Date().toISOString() },
    ],
  };
  return saveCandidateFollowup(id, followup);
}

export function updateCandidateStage(id: number, stage: string): HrCandidate | null {
  const d = db();
  const row = d.prepare('SELECT * FROM hr_candidates WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const logs = parseJson<Array<{ at: string; stage: string; note?: string }>>(row.logs_json, []);
  logs.push({ at: new Date().toISOString(), stage });
  d.prepare('UPDATE hr_candidates SET stage = ?, logs_json = ? WHERE id = ?').run(
    stage,
    JSON.stringify(logs),
    id
  );
  return mapCandidate(
    d.prepare('SELECT * FROM hr_candidates WHERE id = ?').get(id) as Record<string, unknown>
  );
}

/** Distinct job titles from personnel — for ATS position dropdown. */
export function listPersonnelJobTitles(): string[] {
  // Avoid `ORDER BY alias COLLATE NOCASE` — SQLite-only; Postgres treats
  // `ORDER BY t COLLATE …` as a table column ref → column "t" does not exist (ATS /meta 500).
  const rows = db()
    .prepare(
      `SELECT DISTINCT TRIM(job_title) AS t FROM hr_employees
       WHERE TRIM(COALESCE(job_title,'')) != ''
       ORDER BY TRIM(job_title)`
    )
    .all() as Array<{ t: string }>;
  return rows.map((r) => String(r.t)).filter(Boolean);
}

export function listRequests(opts?: { employeeId?: number }): HrRequest[] {
  ensureHrRequestColumns();
  const rows = (
    opts?.employeeId != null
      ? db()
          .prepare('SELECT * FROM hr_requests WHERE employee_id = ? ORDER BY id DESC LIMIT 200')
          .all(opts.employeeId)
      : db().prepare('SELECT * FROM hr_requests ORDER BY id DESC LIMIT 200').all()
  ) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    employeeId: Number(r.employee_id),
    type: String(r.type),
    days: Number(r.days || 0),
    fromDate: String(r.from_date || ''),
    toDate: String(r.to_date || ''),
    description: String(r.description || ''),
    status: String(r.status || ''),
    result: String(r.result || ''),
    log: parseJson(r.log_json, []),
    createdAt: String(r.created_at || ''),
  }));
}

export function listAdminRoles(opts?: { includeInactive?: boolean }): AdminRoleDef[] {
  const includeInactive = opts?.includeInactive === true;
  const rows = (
    includeInactive
      ? db().prepare('SELECT * FROM admin_roles ORDER BY id').all()
      : db().prepare('SELECT * FROM admin_roles WHERE is_active = 1 ORDER BY id').all()
  ) as Record<string, unknown>[];
  return rows.map(mapAdminRole);
}

function mapAdminRole(r: Record<string, unknown>): AdminRoleDef {
  return {
    id: Number(r.id),
    key: String(r.key),
    nameFa: String(r.name_fa),
    description: String(r.description || ''),
    permissions: parseJson(r.permissions_json, []),
    isActive: Number(r.is_active ?? 1) === 1,
  };
}

export function getAdminRoleById(id: number): AdminRoleDef | null {
  const row = db().prepare('SELECT * FROM admin_roles WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapAdminRole(row) : null;
}

export function getAdminRoleByKey(key: string): AdminRoleDef | null {
  const row = db().prepare('SELECT * FROM admin_roles WHERE key = ?').get(key) as
    | Record<string, unknown>
    | undefined;
  return row ? mapAdminRole(row) : null;
}

function normalizeRoleKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function createAdminRole(input: {
  key: string;
  nameFa: string;
  description?: string;
  permissions?: unknown;
}): AdminRoleDef {
  const key = normalizeRoleKey(input.key);
  const nameFa = String(input.nameFa || '').trim();
  if (!key || !/^[a-z][a-z0-9_]{1,63}$/.test(key)) {
    throw new Error('کلید نقش نامعتبر است (لاتین، با حرف شروع شود)');
  }
  if (!nameFa) throw new Error('نام نقش الزامی است');
  if (getAdminRoleByKey(key)) throw new Error('این کلید نقش از قبل وجود دارد');
  const permissions = normalizeAdminPermissions(input.permissions);
  const info = db()
    .prepare(
      `INSERT INTO admin_roles (key, name_fa, description, permissions_json, is_active)
       VALUES (?, ?, ?, ?, 1)`
    )
    .run(key, nameFa, String(input.description || '').trim(), JSON.stringify(permissions));
  const created = getAdminRoleById(Number(info.lastInsertRowid));
  if (!created) throw new Error('ایجاد نقش ناموفق بود');
  return created;
}

export function updateAdminRole(
  id: number,
  input: {
    nameFa?: string;
    description?: string;
    permissions?: unknown;
    isActive?: boolean;
  }
): AdminRoleDef | null {
  const prev = getAdminRoleById(id);
  if (!prev) return null;
  const nameFa =
    input.nameFa !== undefined ? String(input.nameFa || '').trim() : prev.nameFa;
  if (!nameFa) throw new Error('نام نقش الزامی است');
  const description =
    input.description !== undefined
      ? String(input.description || '').trim()
      : prev.description;
  const permissions =
    input.permissions !== undefined
      ? normalizeAdminPermissions(input.permissions)
      : normalizeAdminPermissions(prev.permissions);
  let isActive = prev.isActive;
  if (input.isActive !== undefined) {
    if (
      !input.isActive &&
      (ADMIN_SYSTEM_ROLE_KEYS as readonly string[]).includes(prev.key)
    ) {
      throw new Error('نقش سیستم را نمی‌توان غیرفعال کرد');
    }
    isActive = Boolean(input.isActive);
  }
  db()
    .prepare(
      `UPDATE admin_roles
       SET name_fa = ?, description = ?, permissions_json = ?, is_active = ?
       WHERE id = ?`
    )
    .run(nameFa, description, JSON.stringify(permissions), isActive ? 1 : 0, id);
  return getAdminRoleById(id);
}

export function deleteAdminRole(id: number): { ok: true } {
  const prev = getAdminRoleById(id);
  if (!prev) throw new Error('نقش پیدا نشد');
  if ((ADMIN_SYSTEM_ROLE_KEYS as readonly string[]).includes(prev.key)) {
    throw new Error('نقش سیستم را نمی‌توان حذف کرد');
  }
  const used = db()
    .prepare('SELECT COUNT(*) as c FROM admin_accounts WHERE role_key = ?')
    .get(prev.key) as { c: number };
  if (Number(used?.c || 0) > 0) {
    // Soft-deactivate when accounts still reference the role
    db().prepare('UPDATE admin_roles SET is_active = 0 WHERE id = ?').run(id);
    return { ok: true };
  }
  db().prepare('DELETE FROM admin_roles WHERE id = ?').run(id);
  return { ok: true };
}

export function listAdminAccounts(opts?: { includeInactive?: boolean }): AdminAccount[] {
  const includeInactive = opts?.includeInactive !== false;
  const rows = (
    includeInactive
      ? db().prepare('SELECT * FROM admin_accounts ORDER BY id').all()
      : db().prepare('SELECT * FROM admin_accounts WHERE is_active = 1 ORDER BY id').all()
  ) as Record<string, unknown>[];
  return rows.map(mapAdminAccount);
}

function mapAdminAccount(r: Record<string, unknown>): AdminAccount {
  return {
    id: Number(r.id),
    username: String(r.username),
    roleKey: String(r.role_key),
    displayName: String(r.display_name || ''),
    isActive: Number(r.is_active) === 1,
    createdAt: String(r.created_at || ''),
  };
}

export function getAdminAccountById(id: number): AdminAccount | null {
  const row = db().prepare('SELECT * FROM admin_accounts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapAdminAccount(row) : null;
}

export function createAdminAccount(input: {
  username: string;
  password: string;
  roleKey: string;
  displayName?: string;
  isActive?: boolean;
}): AdminAccount {
  const username = String(input.username || '')
    .trim()
    .toLowerCase();
  const password = String(input.password || '');
  const roleKey = normalizeRoleKey(input.roleKey);
  if (!username || username.length < 2) throw new Error('نام کاربری الزامی است');
  if (!/^[a-z0-9._-]{2,64}$/.test(username)) {
    throw new Error('نام کاربری فقط حروف لاتین، عدد و ._-');
  }
  if (password.length < 6) throw new Error('رمز عبور حداقل ۶ کاراکتر');
  const role = getAdminRoleByKey(roleKey);
  if (!role || !role.isActive) throw new Error('نقش انتخاب‌شده معتبر نیست');
  const existing = db()
    .prepare('SELECT id FROM admin_accounts WHERE username = ?')
    .get(username) as { id: number } | undefined;
  if (existing) throw new Error('این نام کاربری از قبل وجود دارد');
  const displayName = String(input.displayName || '').trim() || username;
  const isActive = input.isActive === false ? 0 : 1;
  const info = db()
    .prepare(
      `INSERT INTO admin_accounts (username, password_hash, role_key, display_name, is_active)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, hashPassword(password), roleKey, displayName, isActive);
  const created = getAdminAccountById(Number(info.lastInsertRowid));
  if (!created) throw new Error('ایجاد حساب ناموفق بود');
  return created;
}

export function updateAdminAccount(
  id: number,
  input: {
    password?: string;
    roleKey?: string;
    displayName?: string;
    isActive?: boolean;
  }
): AdminAccount | null {
  const prev = getAdminAccountById(id);
  if (!prev) return null;
  let roleKey = prev.roleKey;
  if (input.roleKey !== undefined) {
    roleKey = normalizeRoleKey(input.roleKey);
    const role = getAdminRoleByKey(roleKey);
    if (!role || !role.isActive) throw new Error('نقش انتخاب‌شده معتبر نیست');
  }
  const displayName =
    input.displayName !== undefined
      ? String(input.displayName || '').trim() || prev.username
      : prev.displayName;
  const isActive =
    input.isActive !== undefined ? (input.isActive ? 1 : 0) : prev.isActive ? 1 : 0;
  if (input.password !== undefined && String(input.password).length > 0) {
    if (String(input.password).length < 6) throw new Error('رمز عبور حداقل ۶ کاراکتر');
    db()
      .prepare(
        `UPDATE admin_accounts
         SET password_hash = ?, role_key = ?, display_name = ?, is_active = ?
         WHERE id = ?`
      )
      .run(hashPassword(String(input.password)), roleKey, displayName, isActive, id);
  } else {
    db()
      .prepare(
        `UPDATE admin_accounts
         SET role_key = ?, display_name = ?, is_active = ?
         WHERE id = ?`
      )
      .run(roleKey, displayName, isActive, id);
  }
  return getAdminAccountById(id);
}

export function deleteAdminAccount(id: number): { ok: true } {
  const prev = getAdminAccountById(id);
  if (!prev) throw new Error('حساب پیدا نشد');
  db().prepare('DELETE FROM admin_accounts WHERE id = ?').run(id);
  return { ok: true };
}

export type AdminAuthActor = {
  kind: 'env_admin' | 'env_support' | 'account';
  role: string;
  permissions: string[];
  displayName: string;
  username?: string;
};

function permissionsForRoleKey(roleKey: string): string[] {
  const roleRow = db()
    .prepare('SELECT permissions_json, is_active FROM admin_roles WHERE key = ?')
    .get(roleKey) as { permissions_json?: string; is_active?: number } | undefined;
  if (roleRow) {
    return parseJson<string[]>(roleRow.permissions_json, []);
  }
  return [...(ADMIN_ROLE_PERMISSIONS[roleKey as keyof typeof ADMIN_ROLE_PERMISSIONS] || [])];
}

export function resolveAdminActor(opts: {
  password?: string;
  username?: string;
}): AdminAuthActor | null {
  try {
    enforceExpiredContractAccess();
  } catch {
    /* non-fatal */
  }
  const password = (opts.password || '').trim();
  if (!password) return null;

  const adminPwd = (process.env.ADMIN_PASSWORD || 'petdate').trim() || 'petdate';
  const supportPwd = (process.env.ADMIN_SUPPORT_PASSWORD || '').trim();

  // Username+password against accounts table.
  // If username is present but no matching account (e.g. env bootstrap returns
  // username "admin" after LOGIN without a typed username), fall through to
  // ADMIN_PASSWORD / SUPPORT_PASSWORD checks instead of hard-failing.
  if (opts.username?.trim()) {
    const row = db()
      .prepare('SELECT * FROM admin_accounts WHERE username = ? AND is_active = 1')
      .get(opts.username.trim().toLowerCase()) as Record<string, unknown> | undefined;
    if (row && verifyPassword(password, String(row.password_hash || ''))) {
      const roleKey = String(row.role_key || 'support');
      return {
        kind: 'account',
        role: roleKey,
        permissions: permissionsForRoleKey(roleKey),
        displayName: String(row.display_name || row.username),
        username: String(row.username),
      };
    }
  }

  // Legacy single ADMIN_PASSWORD → full admin (bootstrap super-admin)
  if (password === adminPwd) {
    const fromDb = getAdminRoleByKey('admin');
    return {
      kind: 'env_admin',
      role: 'admin',
      permissions: fromDb?.permissions?.length
        ? fromDb.permissions
        : [...ADMIN_ROLE_PERMISSIONS.admin],
      displayName: 'مدیر سیستم',
      username: 'admin',
    };
  }

  // Optional SUPPORT_PASSWORD shortcut
  if (supportPwd && password === supportPwd) {
    const fromDb = getAdminRoleByKey('support');
    return {
      kind: 'env_support',
      role: 'support',
      permissions: fromDb?.permissions?.length
        ? fromDb.permissions
        : [...ADMIN_ROLE_PERMISSIONS.support],
      displayName: 'پشتیبانی',
      username: 'support',
    };
  }

  // Try matching any account password without username (last resort for single-field login)
  const accounts = db()
    .prepare('SELECT * FROM admin_accounts WHERE is_active = 1')
    .all() as Record<string, unknown>[];
  for (const row of accounts) {
    if (verifyPassword(password, String(row.password_hash || ''))) {
      const roleKey = String(row.role_key || 'support');
      return {
        kind: 'account',
        role: roleKey,
        permissions: permissionsForRoleKey(roleKey),
        displayName: String(row.display_name || row.username),
        username: String(row.username),
      };
    }
  }

  return null;
}

export function actorHasPermission(actor: AdminAuthActor, permission: string): boolean {
  if (actor.role === 'admin' || actor.permissions.includes('admin.full')) return true;
  return actor.permissions.includes(permission);
}

export const hrService = {
  ensureHrSchema,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listContracts,
  createContract,
  enforceExpiredContractAccess,
  sanitizeHrUsername,
  getEmployeePlainPassword,
  resetEmployeePassword,
  assertNationalIdUnique,
  ensureHrRequestColumns,
  listCareerLayers,
  listIncomeModels,
  listBenefitDefs,
  listJobOpenings,
  createJobOpening,
  listCandidates,
  createCandidate,
  updateCandidateStage,
  listRequests,
  listAdminRoles,
  listAdminAccounts,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  resolveAdminActor,
  actorHasPermission,
  hashPassword,
};
