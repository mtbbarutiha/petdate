/**
 * Idempotent demo seed linking پیوند HR ↔ فروش (additive, never wipe).
 * Marker: employee personnel_code SEED-HR-01 — if present, skip full re-seed.
 */
import {
  createAdminAccount,
  createCandidate,
  createContract,
  createEmployee,
  createJobOpening,
  getEmployee,
  listEmployees,
  listJobOpenings,
  updateEmployee,
} from './hr-service';
import {
  createOnboarding,
  createRequest,
  createServiceEntry,
  pushNotification,
  upsertCostEntry,
} from './hr-modules';
import { listSalesProducts } from './sales-service';
import { getDb } from './db';
import { ADMIN_ROLE_PERMISSIONS } from '@petdate/shared';

const SEED_MARKER = 'SEED-HR-01';

/** Distinct demo avatars for SEED personnel (Dicebear — stable per code). */
const SEED_AVATARS: Record<string, string> = {
  'SEED-HR-01':
    'https://api.dicebear.com/9.x/notionists/svg?seed=SEED-HR-01&backgroundColor=b6e3f4',
  'SEED-HR-02':
    'https://api.dicebear.com/9.x/notionists/svg?seed=SEED-HR-02&backgroundColor=c0aede',
  'SEED-HR-03':
    'https://api.dicebear.com/9.x/notionists/svg?seed=SEED-HR-03&backgroundColor=d1f4d7',
  'SEED-HR-04':
    'https://api.dicebear.com/9.x/notionists/svg?seed=SEED-HR-04&backgroundColor=ffd5dc',
  'SEED-HR-05':
    'https://api.dicebear.com/9.x/notionists/svg?seed=SEED-HR-05&backgroundColor=ffdfba',
};

function db() {
  return getDb();
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function ymNow(): { year: number; month: number } {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

/** Merge missing system permissions into existing role rows (never wipe custom extras). */
export function ensureSystemRolePermissionBackfill(): void {
  const d = db();
  const merge = (key: string, required: readonly string[]) => {
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
  merge('admin', ADMIN_ROLE_PERMISSIONS.admin);
  merge('sales_agent', ['sales.read', 'sales.write']);
  merge('sales_lead', ['sales.read', 'sales.write', 'sales.admin']);
  merge('sales_manager', ['sales.read', 'sales.write', 'sales.admin']);
  merge('hr_admin', ['hr.read', 'hr.write']);
  merge('recruiter', ['hr.read', 'hr.write']);
  merge('crm_agent', ['crm.read', 'crm.write', 'loyalty.read']);
  merge('crm_lead', ['crm.read', 'crm.write', 'crm.admin', 'loyalty.read', 'loyalty.write']);
  merge('crm_manager', ['crm.read', 'crm.write', 'crm.admin', 'loyalty.read', 'loyalty.write']);
  merge('support', ['support.inbox', 'platform.read', 'hr.read', 'crm.read', 'crm.write', 'loyalty.read']);
}

function employeeByCode(code: string) {
  return db()
    .prepare('SELECT id FROM hr_employees WHERE personnel_code = ?')
    .get(code) as { id: number } | undefined;
}

/** Fill avatar_url for SEED employees when empty — additive, never wipe custom photos. */
export function ensureSeedEmployeeAvatars(): void {
  const upd = db().prepare(
    `UPDATE hr_employees SET avatar_url = ?, updated_at = datetime('now')
     WHERE id = ? AND (avatar_url IS NULL OR avatar_url = '')`
  );
  for (const [code, url] of Object.entries(SEED_AVATARS)) {
    const row = employeeByCode(code);
    if (!row) continue;
    upd.run(url, row.id);
  }
}

function insertSalesItem(row: {
  kind: 'lead' | 'upgrade';
  first: string;
  last: string;
  mobile: string;
  email?: string | null;
  product: string;
  source: string;
  score: number;
  ownerId: string | null;
  ownerName: string | null;
  stage: string;
  value: number;
  createdAt: string;
  lastActivity: string;
  nextFollowup?: string | null;
  lostReason?: string | null;
  customerId?: number | null;
  payStatus?: string;
}): number {
  const info = db()
    .prepare(
      `INSERT INTO sales_items (
        kind, first_name, last_name, mobile, email, product, source, score,
        owner_id, owner_name, stage, value, discount, created_at, last_activity,
        next_followup, lost_reason, customer_id, pay_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.kind,
      row.first,
      row.last,
      row.mobile,
      row.email ?? null,
      row.product,
      row.source,
      row.score,
      row.ownerId,
      row.ownerName,
      row.stage,
      row.value,
      row.createdAt,
      row.lastActivity,
      row.nextFollowup ?? null,
      row.lostReason ?? null,
      row.customerId ?? null,
      row.payStatus ?? 'بدون پرداخت'
    );
  return Number(info.lastInsertRowid);
}

function seedAlreadyDone(): boolean {
  return Boolean(employeeByCode(SEED_MARKER));
}

/**
 * Additive HR↔Sales demo graph. Safe on every boot — skips when SEED-HR-01 exists.
 */
export function seedHrSalesDemoIfNeeded(): void {
  // Caller must ensure HR + Sales schemas first (migrateSchema / selftest).
  ensureSystemRolePermissionBackfill();
  // Always backfill missing SEED avatars (even if full seed already ran).
  ensureSeedEmployeeAvatars();

  const layers = db()
    .prepare('SELECT id, sort_order FROM hr_career_layers ORDER BY sort_order')
    .all() as Array<{ id: number; sort_order: number }>;
  const models = db()
    .prepare('SELECT id FROM hr_income_models ORDER BY id')
    .all() as Array<{ id: number }>;
  const layer = (n: number) => layers.find((l) => l.sort_order === n)?.id ?? layers[0]?.id ?? null;
  const modelSales = models[0]?.id ?? null;
  const modelMgr = models[1]?.id ?? models[0]?.id ?? null;

  const products = listSalesProducts({ activeOnly: true });
  const prod = (i: number) => products[i % Math.max(products.length, 1)]?.name || 'اشتراک ماهانه Pet Date';
  const prodPrice = (name: string) => products.find((p) => p.name === name)?.price ?? 490_000;

  const specs: Array<{
    code: string;
    first: string;
    last: string;
    job: string;
    dept: string;
    loc: string;
    layer: number;
    model: number | null;
    salary: number;
    commission: number;
    gender: string;
    maritalStatus: string;
    province: string;
  }> = [
    {
      code: SEED_MARKER,
      first: 'نیما',
      last: 'فروشنده',
      job: 'کارشناس فروش',
      dept: 'فروش',
      loc: 'غیرحضوری',
      layer: 1,
      model: modelSales,
      salary: 45_000_000,
      commission: 2,
      gender: 'آقا',
      maritalStatus: 'متأهل',
      province: 'تهران',
    },
    {
      code: 'SEED-HR-02',
      first: 'سارا',
      last: 'سرپرست',
      job: 'سرپرست فروش',
      dept: 'فروش',
      loc: 'سعادت‌آباد',
      layer: 2,
      model: modelSales,
      salary: 65_000_000,
      commission: 2.5,
      gender: 'خانم',
      maritalStatus: 'مجرد',
      province: 'تهران',
    },
    {
      code: 'SEED-HR-03',
      first: 'رضا',
      last: 'مدیرفروش',
      job: 'مدیر فروش',
      dept: 'فروش',
      loc: 'سعادت‌آباد',
      layer: 3,
      model: modelMgr,
      salary: 95_000_000,
      commission: 1,
      gender: 'آقا',
      maritalStatus: 'متأهل',
      province: 'اصفهان',
    },
    {
      code: 'SEED-HR-04',
      first: 'مریم',
      last: 'منابع‌انسانی',
      job: 'کارشناس منابع انسانی',
      dept: 'منابع انسانی',
      loc: 'قبا',
      layer: 1,
      model: modelMgr,
      salary: 55_000_000,
      commission: 0,
      gender: 'خانم',
      maritalStatus: 'مجرد',
      province: 'فارس',
    },
    {
      code: 'SEED-HR-05',
      first: 'کیان',
      last: 'پشتیبانی',
      job: 'کارشناس پشتیبانی',
      dept: 'عملیات',
      loc: 'غیرحضوری',
      layer: 0,
      model: modelSales,
      salary: 38_000_000,
      commission: 0,
      gender: 'آقا',
      maritalStatus: 'مجرد',
      province: 'البرز',
    },
    {
      code: 'SEED-HR-06',
      first: 'النا',
      last: 'محصول',
      job: 'کارشناس محصول',
      dept: 'محصول',
      loc: 'قبا',
      layer: 1,
      model: modelSales,
      salary: 52_000_000,
      commission: 0,
      gender: 'خانم',
      maritalStatus: 'متأهل',
      province: 'تهران',
    },
    {
      code: 'SEED-HR-07',
      first: 'هستی',
      last: 'مالی',
      job: 'کارشناس مالی',
      dept: 'مالی',
      loc: 'سعادت‌آباد',
      layer: 1,
      model: modelMgr,
      salary: 48_000_000,
      commission: 0,
      gender: 'خانم',
      maritalStatus: 'مجرد',
      province: 'تهران',
    },
  ];

  const employees: Array<{
    id: number;
    code: string;
    name: string;
    job: string;
    username: string;
  }> = [];

  for (const s of specs) {
    if (employeeByCode(s.code)) continue;
    const emp = createEmployee({
      personnelCode: s.code,
      firstName: s.first,
      lastName: s.last,
      jobTitle: s.job,
      department: s.dept,
      location: s.loc,
      gender: s.gender,
      maritalStatus: s.maritalStatus,
      city: s.province === 'تهران' ? 'تهران' : s.province,
      province: s.province,
      cooperationType: 'تمام وقت',
      contractStatus: 'در حال همکاری',
      accessStatus: 'فعال',
      orgEmail: `${s.code.toLowerCase()}@petdate.ir`,
      careerLayerId: layer(s.layer),
      incomeModelId: s.model,
      avatarUrl: SEED_AVATARS[s.code] || '',
      benefits: {
        eidi: true,
        sanavat: true,
        insurance: true,
        bonus: true,
        commission: s.commission > 0,
        training: s.layer >= 2,
      },
    });
    createContract(emp.id, {
      startDate: '2024-06-01',
      salary: s.salary,
      eidi: Math.round(s.salary / 12),
      sanavat: Math.round(s.salary / 24),
      commissionPercent: s.commission,
      bankName: 'ملت',
      salesAffectsPayout: s.commission > 0 ? 'بله' : 'خیر',
    });
    employees.push({
      id: emp.id,
      code: s.code,
      name: `${s.first} ${s.last}`,
      job: s.job,
      username: emp.username || s.code,
    });
  }

  // Backfill demographics on existing seed rows so reports heatmap/donuts stay meaningful.
  for (const s of specs) {
    const row = employeeByCode(s.code);
    if (!row) continue;
    updateEmployee(row.id, {
      gender: s.gender,
      maritalStatus: s.maritalStatus,
      province: s.province,
      city: s.province === 'تهران' ? 'تهران' : s.province,
    });
  }

  if (employees.length === 0) {
    for (const s of specs) {
      const row = employeeByCode(s.code);
      if (!row) continue;
      const emp = getEmployee(row.id);
      if (!emp) continue;
      employees.push({
        id: emp.id,
        code: s.code,
        name: `${emp.firstName} ${emp.lastName}`,
        job: emp.jobTitle,
        username: emp.username || s.code,
      });
    }
  }

  const agent = employees.find((e) => e.code === SEED_MARKER) || employees[0];
  const lead = employees.find((e) => e.code === 'SEED-HR-02') || agent;
  const manager = employees.find((e) => e.code === 'SEED-HR-03') || lead;
  const hrPerson = employees.find((e) => e.code === 'SEED-HR-04') || agent;

  const seedPass = (process.env.ADMIN_SEED_PASSWORD || 'petdate-seed').trim() || 'petdate-seed';
  const ensureAccount = (username: string, roleKey: string, displayName: string) => {
    const existing = db()
      .prepare('SELECT id FROM admin_accounts WHERE username = ?')
      .get(username) as { id: number } | undefined;
    if (existing) return;
    try {
      createAdminAccount({ username, password: seedPass, roleKey, displayName });
    } catch {
      /* role may be inactive / race */
    }
  };
  if (agent) ensureAccount('seed.sales.agent', 'sales_agent', agent.name);
  if (lead) ensureAccount('seed.sales.lead', 'sales_lead', lead.name);
  if (manager) ensureAccount('seed.sales.manager', 'sales_manager', manager.name);

  let openings = listJobOpenings();
  if (openings.length === 0) {
    createJobOpening({ title: 'کارشناس فروش Pet Date', department: 'فروش', openings: 2 });
    createJobOpening({ title: 'کارشناس پشتیبانی محصول', department: 'عملیات', openings: 1 });
    createJobOpening({ title: 'کارشناس منابع انسانی', department: 'منابع انسانی', openings: 1 });
    openings = listJobOpenings();
  }
  const salesOpening = openings.find((o) => /فروش/.test(o.title)) || openings[0];
  const supportOpening = openings.find((o) => /پشتیبانی/.test(o.title)) || openings[0];

  const candCount = Number(
    (db().prepare('SELECT COUNT(*) as c FROM hr_candidates').get() as { c: number })?.c ?? 0
  );
  if (candCount < 4) {
    const cands = [
      { first: 'آوا', last: 'کریمی', mobile: '09120001001', stage: 'مصاحبه', opening: salesOpening?.id },
      { first: 'پویا', last: 'نوری', mobile: '09120001002', stage: 'پیشنهاد شغلی', opening: salesOpening?.id },
      { first: 'هستی', last: 'راد', mobile: '09120001003', stage: 'متقاضی جدید', opening: supportOpening?.id },
      { first: 'آرمان', last: 'کاظمی', mobile: '09120001004', stage: 'بانک استعداد', opening: salesOpening?.id },
    ];
    for (const c of cands) {
      createCandidate({
        firstName: c.first,
        lastName: c.last,
        mobile: c.mobile,
        email: `${c.first}@example.com`,
        city: 'تهران',
        source: 'لینکدین',
        jobOpeningId: c.opening ?? null,
        applicationDate: daysAgo(5).slice(0, 10),
        stage: c.stage,
        notes: 'دادهٔ نمونه SEED',
      });
    }
  }

  const onboardingCount = Number(
    (db().prepare('SELECT COUNT(*) as c FROM hr_onboarding_records').get() as { c: number })?.c ?? 0
  );
  if (onboardingCount === 0 && agent) {
    createOnboarding({
      employeeId: agent.id,
      name: agent.name,
      jobTitle: agent.job,
      startDate: daysAgo(3).slice(0, 10),
    });
    if (hrPerson) {
      createOnboarding({
        employeeId: hrPerson.id,
        name: hrPerson.name,
        jobTitle: hrPerson.job,
        startDate: daysAgo(10).slice(0, 10),
      });
    }
  }

  const { year, month } = ymNow();
  const reqCount = Number(
    (db().prepare('SELECT COUNT(*) as c FROM hr_requests').get() as { c: number })?.c ?? 0
  );
  if (reqCount === 0) {
    for (const e of employees.slice(0, 3)) {
      createRequest({ employeeId: e.id, type: 'مرخصی', days: 1, description: 'نمونه SEED' });
      createRequest({ employeeId: e.id, type: 'تجهیزات', days: 0, description: 'لپ‌تاپ SEED' });
    }
  }
  for (const e of employees) {
    upsertCostEntry({
      employeeId: e.id,
      year,
      month,
      insurance: 2_000_000,
      tax: 3_500_000,
      bonus: e.code === SEED_MARKER ? 5_000_000 : 1_000_000,
      sales: /فروش/.test(e.job) ? 80_000_000 : 0,
    });
    createServiceEntry({
      employeeId: e.id,
      year,
      month,
      day: Math.min(28, new Date().getDate()),
      hours: /فروش/.test(e.job) ? 7.5 : 6,
      note: 'ثبت نمونه SEED',
    });
  }
  const notifCount = Number(
    (db().prepare('SELECT COUNT(*) as c FROM hr_notifications').get() as { c: number })?.c ?? 0
  );
  if (notifCount === 0) {
    pushNotification('قرارداد SEED-HR-01 نزدیک تمدید است', 'warn');
    pushNotification('۴ متقاضی جدید در ATS منتظر غربالگری‌اند', 'info');
    pushNotification('لیدهای بدون مالک در فروش را تخصیص دهید', 'info');
  }

  // Sample personnel change log for HR dashboard «آخرین تغییرات»
  const logCount = Number(
    (db().prepare('SELECT COUNT(*) as c FROM hr_employee_logs').get() as { c: number })?.c ?? 0
  );
  if (logCount === 0 && employees.length) {
    const samples: Array<{ code: string; field: string; oldValue: string; newValue: string }> = [
      {
        code: 'SEED-HR-01',
        field: 'حقوق خالص',
        oldValue: '۳۰٬۰۰۰٬۰۰۰',
        newValue: '۳۵٬۰۰۰٬۰۰۰',
      },
      {
        code: 'SEED-HR-02',
        field: 'وضعیت قرارداد',
        oldValue: 'در حال همکاری',
        newValue: 'تمدید شده',
      },
      {
        code: 'SEED-HR-03',
        field: 'سمت',
        oldValue: 'کارشناس فروش',
        newValue: 'مدیر فروش',
      },
      {
        code: 'SEED-HR-05',
        field: 'محل کار',
        oldValue: 'حضوری',
        newValue: 'غیرحضوری',
      },
    ];
    const insertLog = db().prepare(
      `INSERT INTO hr_employee_logs (employee_id, field, old_value, new_value, logged_at)
       VALUES (?, ?, ?, ?, datetime('now', ?))`
    );
    samples.forEach((s, i) => {
      const emp = employees.find((e) => e.code === s.code) || employees[i % employees.length];
      if (!emp) return;
      insertLog.run(emp.id, s.field, s.oldValue, s.newValue, `-${(i + 1) * 3} days`);
    });
  }

  const salesItemCount = Number(
    (db().prepare(`SELECT COUNT(*) as c FROM sales_items WHERE mobile LIKE '0912SEED%'`).get() as {
      c: number;
    })?.c ?? 0
  );
  if (salesItemCount === 0 && agent && lead && manager) {
    const owners = [
      { id: agent.username, name: agent.name },
      { id: lead.username, name: lead.name },
      { id: manager.username, name: manager.name },
    ];

    let platformUsers: Array<{ id: number; name: string; phone: string | null }> = [];
    try {
      platformUsers = db()
        .prepare(
          `SELECT id, name, phone FROM users
           WHERE (telegram_id IS NULL OR telegram_id NOT LIKE 'fake_%')
             AND (name IS NOT NULL AND name != '')
           ORDER BY id DESC LIMIT 8`
        )
        .all() as Array<{ id: number; name: string; phone: string | null }>;
    } catch {
      platformUsers = [];
    }

    const customerIds: number[] = [];
    for (let i = 0; i < 4; i++) {
      const u = platformUsers[i];
      const parts = String(u?.name || `مشتری نمونه ${i + 1}`)
        .trim()
        .split(/\s+/);
      const first = parts[0] || 'مشتری';
      const last = parts.slice(1).join(' ') || `SEED${i + 1}`;
      const mobileRaw =
        (u?.phone && String(u.phone).replace(/\D/g, '').slice(-10)) ||
        `0912SEED${100 + i}`;
      let mobileNorm = mobileRaw;
      if (mobileRaw.startsWith('9') && mobileRaw.length === 10) mobileNorm = `0${mobileRaw}`;
      if (!mobileNorm.startsWith('0') || mobileNorm.length < 10) mobileNorm = `0912SEED${100 + i}`;
      const info = db()
        .prepare(
          `INSERT INTO sales_customers (first_name, last_name, mobile, email, level, sales_owner, created_at, csat)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          first,
          last,
          mobileNorm,
          u ? `user${u.id}@petdate.ir` : `seed.customer${i + 1}@petdate.ir`,
          i === 0 ? 'طلایی' : i === 1 ? 'نقره‌ای' : 'عادی',
          owners[i % owners.length].name,
          daysAgo(20 - i),
          4 + (i % 2)
        );
      customerIds.push(Number(info.lastInsertRowid));
      db()
        .prepare(
          `INSERT INTO sales_orders (customer_id, product, amount, at) VALUES (?, ?, ?, ?)`
        )
        .run(customerIds[i], prod(i), prodPrice(prod(i)), daysAgo(15 - i));
    }

    const leadDefs: Array<{ stage: string; first: string; last: string; idx: number; owner: number }> = [
      { stage: '0', first: 'لیدا', last: 'جدید', idx: 0, owner: 0 },
      { stage: '1', first: 'بهرام', last: 'تخصیص', idx: 1, owner: 0 },
      { stage: '2', first: 'نرگس', last: 'تماس', idx: 2, owner: 1 },
      { stage: '3', first: 'سینا', last: 'متصل', idx: 3, owner: 0 },
      { stage: '4', first: 'الهام', last: 'واجد', idx: 4, owner: 1 },
      { stage: '5', first: 'فرهاد', last: 'پیشنهاد', idx: 5, owner: 0 },
      { stage: '6', first: 'مینا', last: 'پرداخت', idx: 6, owner: 1 },
      { stage: '7', first: 'کاوه', last: 'برنده', idx: 7, owner: 0 },
      { stage: 'lost', first: 'شیدا', last: 'ازدست', idx: 8, owner: 2 },
    ];
    const leadIds: number[] = [];
    for (const L of leadDefs) {
      const o = owners[L.owner % owners.length];
      const pName = prod(L.idx);
      const id = insertSalesItem({
        kind: 'lead',
        first: L.first,
        last: L.last,
        mobile: `0912SEED${200 + L.idx}`,
        email: `${L.first}@seed.petdate.ir`,
        product: pName,
        source: ['اینستاگرام', 'تلگرام', 'وبسایت', 'گوگل ادز', 'ریفرال'][L.idx % 5],
        score: 40 + L.idx * 5,
        ownerId: L.stage === '0' ? null : o.id,
        ownerName: L.stage === '0' ? null : o.name,
        stage: L.stage,
        value: prodPrice(pName),
        createdAt: daysAgo(12 - (L.idx % 10)),
        lastActivity: L.stage === '7' ? nowIso() : daysAgo(L.idx % 5),
        nextFollowup: L.stage === 'lost' || L.stage === '7' ? null : daysFromNow(1),
        lostReason: L.stage === 'lost' ? 'قیمت' : null,
        customerId: L.stage === '7' ? customerIds[0] : null,
        payStatus: L.stage === '7' ? 'پرداخت‌شده' : L.stage === '6' ? 'لینک ارسال‌شده' : 'بدون پرداخت',
      });
      leadIds.push(id);
      db()
        .prepare(`INSERT INTO sales_activities (item_id, at, text, kind) VALUES (?, ?, ?, ?)`)
        .run(id, daysAgo(1), `فعالیت نمونه SEED برای ${L.first}`, 'sys');
    }

    for (let i = 0; i < 3; i++) {
      const o = owners[i % owners.length];
      const pName = prod(i + 2);
      insertSalesItem({
        kind: 'upgrade',
        first: `ارتقاء${i + 1}`,
        last: 'SEED',
        mobile: `0912SEED${300 + i}`,
        product: pName,
        source: 'امور فروش',
        score: 70,
        ownerId: o.id,
        ownerName: o.name,
        stage: String(2 + i),
        value: prodPrice(pName),
        createdAt: daysAgo(8),
        lastActivity: daysAgo(1),
        customerId: customerIds[i] ?? null,
      });
    }

    for (let i = 0; i < 5; i++) {
      const o = owners[i % owners.length];
      const refId = leadIds[i % leadIds.length];
      db()
        .prepare(
          `INSERT INTO sales_calls (ref_kind, ref_id, agent_id, agent_name, dir, started_at, talk, result, summary, qa_status, qa_score)
           VALUES ('lead', ?, ?, ?, 'call_out', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          refId,
          o.id,
          o.name,
          nowIso(),
          4 + i,
          i % 2 === 0 ? 'علاقه‌مند' : 'تماس بعدی',
          'تماس نمونه SEED',
          i < 2 ? 'ارزیابی شد' : 'ارزیابی نشده',
          i < 2 ? 80 + i * 5 : null
        );
    }

    for (let i = 0; i < 4; i++) {
      const o = owners[i % owners.length];
      db()
        .prepare(
          `INSERT INTO sales_followups (ref_kind, ref_id, owner_id, type, at, priority, desc_text, status)
           VALUES ('lead', ?, ?, 'تماس پیگیری', ?, ?, ?, 'باز')`
        )
        .run(
          leadIds[i % leadIds.length],
          o.id,
          i < 2 ? daysAgo(2) : daysFromNow(1),
          i === 0 ? 'بالا' : 'متوسط',
          'پیگیری نمونه SEED'
        );
    }

    const payInfo = db()
      .prepare(
        `INSERT INTO sales_payments (ref_kind, ref_id, amount, type, status, at)
         VALUES ('lead', ?, ?, 'لینک پرداخت کامل', 'در حال بررسی مالی', ?)`
      )
      .run(leadIds[6], prodPrice(prod(6)), nowIso());
    const paymentId = Number(payInfo.lastInsertRowid);
    db()
      .prepare(
        `INSERT INTO sales_tickets (ref_kind, ref_id, payment_id, customer_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
         VALUES ('lead', ?, ?, ?, 'استعلام مالی SEED', 'مالی', 'استعلام مالی', 'بالا', 'جدید', ?, ?, 'تیکت نمونه', ?)`
      )
      .run(
        leadIds[6],
        paymentId,
        customerIds[0] ?? null,
        nowIso(),
        daysFromNow(1),
        agent.username
      );
    db()
      .prepare(
        `INSERT INTO sales_tickets (ref_kind, ref_id, customer_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
         VALUES ('lead', ?, ?, 'پشتیبانی تحویل SEED', 'تحویل محصول', 'تحویل', 'متوسط', 'در حال بررسی', ?, ?, 'پیگیری تحویل', ?)`
      )
      .run(leadIds[7], customerIds[0] ?? null, daysAgo(1), daysFromNow(2), lead.username);

    for (const cid of customerIds.slice(0, 2)) {
      db()
        .prepare(
          `INSERT INTO sales_surveys (customer_id, score, comment, channel, at) VALUES (?, ?, ?, 'تماس', ?)`
        )
        .run(cid, 5, 'رضایت نمونه SEED', daysAgo(1));
    }

    const goalCount = Number(
      (db().prepare('SELECT COUNT(*) as c FROM sales_goals').get() as { c: number })?.c ?? 0
    );
    if (goalCount === 0) {
      db()
        .prepare(
          `INSERT INTO sales_goals (name, team, period_from, period_to, active, created_at, created_by, metrics_json)
           VALUES (?, 'فروش Pet Date', ?, ?, 1, ?, ?, ?)`
        )
        .run(
          'هدف ماهانه اشتراک',
          `${year}-${String(month).padStart(2, '0')}-01`,
          `${year}-${String(month).padStart(2, '0')}-28`,
          nowIso(),
          manager.username,
          JSON.stringify({ revenue: 50_000_000, salesCount: 20, calls: 100 })
        );
    }
  }

  ensureSalesCrmDemoTopUp();

  const totalEmp = listEmployees({ limit: 1 }).total;
  console.log(
    `🌱 HR↔Sales demo seed ready (employees≥${totalEmp}, marker=${SEED_MARKER})`
  );
}

/** Idempotent top-up so Sales badges stay non-empty without wiping. */
export function ensureSalesCrmDemoTopUp(): void {
  try {
    // Fix legacy QA label typo
    db()
      .prepare(`UPDATE sales_calls SET qa_status = 'ارزیابی شد' WHERE qa_status = 'تایید شده' AND qa_score IS NOT NULL`)
      .run();
  } catch {
    return;
  }

  const agent = employeeByCode(SEED_MARKER);
  const agentEmp = agent ? getEmployee(agent.id) : null;
  const agentUser = agentEmp?.username || SEED_MARKER;
  const agentName = agentEmp ? `${agentEmp.firstName} ${agentEmp.lastName}` : 'نیما فروشنده';

  const anyLead = db()
    .prepare(`SELECT id FROM sales_items WHERE kind = 'lead' ORDER BY id DESC LIMIT 1`)
    .get() as { id: number } | undefined;
  if (!anyLead) return;

  const openTickets = Number(
    (db()
      .prepare(`SELECT COUNT(*) as c FROM sales_tickets WHERE status IN ('جدید','در حال بررسی')`)
      .get() as { c: number })?.c ?? 0
  );
  if (openTickets < 2) {
    db()
      .prepare(
        `INSERT INTO sales_tickets (ref_kind, ref_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
         VALUES ('lead', ?, 'تیکت تکمیلی SEED', 'سایر', 'سایر', 'متوسط', 'جدید', ?, ?, 'تکمیل badge', ?)`
      )
      .run(anyLead.id, nowIso(), daysFromNow(1), agentUser);
    db()
      .prepare(
        `INSERT INTO sales_tickets (ref_kind, ref_id, title, dept, cat, priority, status, created_at, sla_due, desc_text, agent_id)
         VALUES ('lead', ?, 'مشکل فنی اپ SEED', 'پشتیبانی فنی', 'مشکل فنی', 'بالا', 'جدید', ?, ?, 'باگ ورود', ?)`
      )
      .run(anyLead.id, nowIso(), daysFromNow(1), agentUser);
  }

  const pendingQa = Number(
    (db()
      .prepare(`SELECT COUNT(*) as c FROM sales_calls WHERE qa_status != 'ارزیابی شد'`)
      .get() as { c: number })?.c ?? 0
  );
  if (pendingQa < 3) {
    for (let i = 0; i < 3 - pendingQa; i++) {
      db()
        .prepare(
          `INSERT INTO sales_calls (ref_kind, ref_id, agent_id, agent_name, dir, started_at, talk, result, summary, qa_status, qa_score)
           VALUES ('lead', ?, ?, ?, 'call_in', ?, ?, 'تماس بعدی', 'تکمیل QA SEED', 'ارزیابی نشده', NULL)`
        )
        .run(anyLead.id, agentUser, agentName, daysAgo(i), 2 + i);
    }
  }

  const openFu = Number(
    (db().prepare(`SELECT COUNT(*) as c FROM sales_followups WHERE status = 'باز'`).get() as { c: number })?.c ?? 0
  );
  if (openFu < 2) {
    db()
      .prepare(
        `INSERT INTO sales_followups (ref_kind, ref_id, owner_id, type, at, priority, desc_text, status)
         VALUES ('lead', ?, ?, 'تماس پیگیری', ?, 'بالا', 'پیگیری تکمیلی SEED', 'باز')`
      )
      .run(anyLead.id, agentUser, daysAgo(1));
  }

  console.log('🌱 Sales CRM demo top-up ready');
}
