/**
 * پیوند HR expanded modules — onboarding, requests write, cost, service,
 * notifications, dashboards, settings CRUD, Armita stub.
 * Additive schema only (CREATE IF NOT EXISTS). No businessLine fields.
 */
import { randomUUID } from 'crypto';
import {
  HR_ANNUAL_LEAVE_DAYS,
  effectiveCommissionPercent,
  incomeModelFixedAddon,
  isSalesJobTitle,
  makeDefaultOnboardingAccessItems,
  makeDefaultOnboardingEquipmentItems,
  makeDefaultOnboardingTasks,
  nextRequestStatus,
  onboardingDurationFor,
  type HrBenefitDef,
  type HrCareerLayer,
  type HrCockpitTask,
  type HrCostEntry,
  type HrIncomeModel,
  type HrMonthlyCostBreakdown,
  type HrNotification,
  type HrOnboardingAccessItem,
  type HrOnboardingEquipmentItem,
  type HrOnboardingRecord,
  type HrOnboardingTask,
  type HrRequest,
  type HrServiceEntry,
} from '@petdate/shared';
import { getDb } from './db';
import {
  createEmployee,
  getEmployee,
  listCandidates,
  listCareerLayers,
  listContracts,
  listEmployees,
  listIncomeModels,
  listJobOpenings,
  listBenefitDefs,
  updateCandidateStage,
} from './hr-service';

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

export function ensureHrModuleTables(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS hr_onboarding_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER,
      employee_id INTEGER,
      name TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL DEFAULT '',
      duration_days INTEGER NOT NULL DEFAULT 3,
      tasks_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_cost_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      insurance INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      bonus INTEGER NOT NULL DEFAULT 0,
      sales INTEGER NOT NULL DEFAULT 0,
      UNIQUE(employee_id, year, month),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS hr_service_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL DEFAULT 1,
      hours REAL NOT NULL DEFAULT 0,
      minutes REAL NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES hr_employees(id)
    );

    CREATE TABLE IF NOT EXISTS hr_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'info',
      date TEXT NOT NULL DEFAULT (datetime('now')),
      read INTEGER NOT NULL DEFAULT 0
    );
  `);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_onboarding_emp ON hr_onboarding_records(employee_id)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_cost_ym ON hr_cost_entries(year, month)`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_hr_service_ym ON hr_service_entries(year, month)`);

  // Additive columns for access / equipment checklists — never wipe
  const onboardCols = new Set(
    (d.prepare(`PRAGMA table_info(hr_onboarding_records)`).all() as Array<{ name: string }>).map(
      (c) => c.name
    )
  );
  if (!onboardCols.has('access_json')) {
    d.exec(`ALTER TABLE hr_onboarding_records ADD COLUMN access_json TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!onboardCols.has('equipment_json')) {
    d.exec(`ALTER TABLE hr_onboarding_records ADD COLUMN equipment_json TEXT NOT NULL DEFAULT '[]'`);
  }

  // Additive result column on hr_requests
  const reqCols = new Set(
    (d.prepare(`PRAGMA table_info(hr_requests)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (reqCols.size > 0 && !reqCols.has('result')) {
    d.exec(`ALTER TABLE hr_requests ADD COLUMN result TEXT NOT NULL DEFAULT ''`);
  }
}

function normalizeAccessItems(raw: unknown): HrOnboardingAccessItem[] {
  const parsed = parseJson<HrOnboardingAccessItem[]>(raw, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return makeDefaultOnboardingAccessItems();
  return parsed.map((item, i) => ({
    id: String(item?.id || `a${i + 1}`),
    label: String(item?.label || ''),
    done: Boolean(item?.done),
  }));
}

function normalizeEquipmentItems(raw: unknown): HrOnboardingEquipmentItem[] {
  const parsed = parseJson<HrOnboardingEquipmentItem[]>(raw, []);
  if (!Array.isArray(parsed) || parsed.length === 0) return makeDefaultOnboardingEquipmentItems();
  return parsed.map((item, i) => ({
    id: String(item?.id || `e${i + 1}`),
    label: String(item?.label || ''),
    done: Boolean(item?.done),
    assetNo: String(item?.assetNo ?? ''),
  }));
}

function mapOnboarding(row: Record<string, unknown>): HrOnboardingRecord {
  return {
    id: Number(row.id),
    candidateId: row.candidate_id != null ? Number(row.candidate_id) : null,
    employeeId: row.employee_id != null ? Number(row.employee_id) : null,
    name: String(row.name || ''),
    jobTitle: String(row.job_title || ''),
    startDate: String(row.start_date || ''),
    durationDays: Number(row.duration_days || 3),
    tasks: parseJson<HrOnboardingTask[]>(row.tasks_json, makeDefaultOnboardingTasks()),
    accessItems: normalizeAccessItems(row.access_json),
    equipmentItems: normalizeEquipmentItems(row.equipment_json),
    approvedHire: row.candidate_id != null,
    createdAt: String(row.created_at || ''),
  };
}

export function listOnboarding(): HrOnboardingRecord[] {
  ensureHrModuleTables();
  // Ensure hired ATS candidates without an onboarding row get one (additive)
  const hired = listCandidates({ stage: 'استخدام‌شده' });
  const existing = (
    db()
      .prepare('SELECT * FROM hr_onboarding_records ORDER BY id DESC')
      .all() as Record<string, unknown>[]
  ).map(mapOnboarding);
  const byCand = new Set(
    existing.filter((r) => r.candidateId != null).map((r) => Number(r.candidateId))
  );
  for (const cand of hired) {
    if (byCand.has(cand.id)) continue;
    const opening = listJobOpenings().find((o) => o.id === cand.jobOpeningId);
    createOnboarding({
      candidateId: cand.id,
      name: `${cand.firstName} ${cand.lastName}`.trim(),
      jobTitle: cand.jobTitle || opening?.title || '',
      startDate: cand.followup?.startDate || cand.applicationDate || undefined,
    });
  }
  return (
    db()
      .prepare('SELECT * FROM hr_onboarding_records ORDER BY id DESC')
      .all() as Record<string, unknown>[]
  ).map(mapOnboarding);
}

export function createOnboarding(input: {
  candidateId?: number | null;
  employeeId?: number | null;
  name: string;
  jobTitle?: string;
  startDate?: string;
}): HrOnboardingRecord {
  ensureHrModuleTables();
  const jobTitle = input.jobTitle || '';
  const durationDays = onboardingDurationFor(jobTitle);
  const tasks = makeDefaultOnboardingTasks();
  const accessItems = makeDefaultOnboardingAccessItems();
  const equipmentItems = makeDefaultOnboardingEquipmentItems();
  const info = db()
    .prepare(
      `INSERT INTO hr_onboarding_records
        (candidate_id, employee_id, name, job_title, start_date, duration_days, tasks_json, access_json, equipment_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.candidateId ?? null,
      input.employeeId ?? null,
      input.name.trim(),
      jobTitle,
      input.startDate || new Date().toISOString().slice(0, 10),
      durationDays,
      JSON.stringify(tasks),
      JSON.stringify(accessItems),
      JSON.stringify(equipmentItems)
    );
  const id = Number(info.lastInsertRowid);
  return mapOnboarding(
    db().prepare('SELECT * FROM hr_onboarding_records WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function updateOnboardingTasks(
  id: number,
  tasks: HrOnboardingTask[],
  extras?: {
    accessItems?: HrOnboardingAccessItem[];
    equipmentItems?: HrOnboardingEquipmentItem[];
  }
): HrOnboardingRecord | null {
  ensureHrModuleTables();
  const row = db().prepare('SELECT * FROM hr_onboarding_records WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  db()
    .prepare('UPDATE hr_onboarding_records SET tasks_json = ? WHERE id = ?')
    .run(JSON.stringify(tasks), id);
  if (extras?.accessItems) {
    db()
      .prepare('UPDATE hr_onboarding_records SET access_json = ? WHERE id = ?')
      .run(JSON.stringify(extras.accessItems), id);
  }
  if (extras?.equipmentItems) {
    db()
      .prepare('UPDATE hr_onboarding_records SET equipment_json = ? WHERE id = ?')
      .run(JSON.stringify(extras.equipmentItems), id);
  }
  return mapOnboarding(
    db().prepare('SELECT * FROM hr_onboarding_records WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function updateOnboardingChecklists(
  id: number,
  input: {
    tasks?: HrOnboardingTask[];
    accessItems?: HrOnboardingAccessItem[];
    equipmentItems?: HrOnboardingEquipmentItem[];
  }
): HrOnboardingRecord | null {
  ensureHrModuleTables();
  const row = db().prepare('SELECT * FROM hr_onboarding_records WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  if (input.tasks) {
    db()
      .prepare('UPDATE hr_onboarding_records SET tasks_json = ? WHERE id = ?')
      .run(JSON.stringify(input.tasks), id);
  }
  if (input.accessItems) {
    db()
      .prepare('UPDATE hr_onboarding_records SET access_json = ? WHERE id = ?')
      .run(JSON.stringify(input.accessItems), id);
  }
  if (input.equipmentItems) {
    db()
      .prepare('UPDATE hr_onboarding_records SET equipment_json = ? WHERE id = ?')
      .run(JSON.stringify(input.equipmentItems), id);
  }
  return mapOnboarding(
    db().prepare('SELECT * FROM hr_onboarding_records WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function pushNotification(
  text: string,
  kind: HrNotification['kind'] = 'info'
): HrNotification {
  const info = db()
    .prepare(`INSERT INTO hr_notifications (text, kind, date, read) VALUES (?, ?, datetime('now'), 0)`)
    .run(text, kind);
  const id = Number(info.lastInsertRowid);
  return mapNotification(
    db().prepare('SELECT * FROM hr_notifications WHERE id = ?').get(id) as Record<string, unknown>
  );
}

function mapNotification(row: Record<string, unknown>): HrNotification {
  return {
    id: Number(row.id),
    text: String(row.text || ''),
    kind: (String(row.kind || 'info') as HrNotification['kind']) || 'info',
    date: String(row.date || ''),
    read: Number(row.read || 0) === 1,
  };
}

export function listNotifications(opts?: { unreadOnly?: boolean }): HrNotification[] {
  const rows = (
    opts?.unreadOnly
      ? db()
          .prepare('SELECT * FROM hr_notifications WHERE read = 0 ORDER BY id DESC LIMIT 100')
          .all()
      : db().prepare('SELECT * FROM hr_notifications ORDER BY id DESC LIMIT 100').all()
  ) as Record<string, unknown>[];
  return rows.map(mapNotification);
}

export function markNotificationRead(id: number): void {
  db().prepare('UPDATE hr_notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead(): void {
  db().prepare('UPDATE hr_notifications SET read = 1 WHERE read = 0').run();
}

export function hireCandidate(candidateId: number): {
  candidate: ReturnType<typeof updateCandidateStage>;
  onboarding: HrOnboardingRecord;
  employeeId?: number;
} | null {
  const candidates = listCandidates();
  const cand = candidates.find((c) => c.id === candidateId);
  if (!cand) return null;
  if (cand.stage === 'استخدام‌شده') {
    const updated = updateCandidateStage(candidateId, 'استخدام‌شده');
    const existing = listOnboarding().find((o) => o.candidateId === candidateId);
    return {
      candidate: updated,
      onboarding:
        existing ||
        createOnboarding({
          candidateId,
          name: `${cand.firstName} ${cand.lastName}`.trim(),
          jobTitle: listJobOpenings().find((o) => o.id === cand.jobOpeningId)?.title || '',
        }),
      employeeId: existing?.employeeId ?? undefined,
    };
  }
  const opening = listJobOpenings().find((o) => o.id === cand.jobOpeningId);
  const jobTitle = cand.jobTitle || opening?.title || '';
  const department = opening?.department || '';
  const updated = updateCandidateStage(candidateId, 'استخدام‌شده');
  if (!updated) return null;

  const draft = createEmployee({
    firstName: cand.firstName,
    lastName: cand.lastName,
    gmail: cand.email,
    jobTitle,
    department,
    contractStatus: 'در مرحله آزمایشی',
    accessStatus: 'فعال',
  });

  const onboarding = createOnboarding({
    candidateId,
    employeeId: draft.id,
    name: `${cand.firstName} ${cand.lastName}`.trim(),
    jobTitle,
    startDate: new Date().toISOString().slice(0, 10),
  });

  pushNotification(
    `استخدام: ${cand.firstName} ${cand.lastName} — فرآیند شروع به کار ایجاد شد`,
    'success'
  );

  return { candidate: updated, onboarding, employeeId: draft.id };
}

function mapRequest(r: Record<string, unknown>): HrRequest {
  return {
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
  };
}

export function createRequest(input: {
  employeeId: number;
  type: string;
  days?: number;
  fromDate?: string;
  toDate?: string;
  description?: string;
}): HrRequest {
  ensureHrModuleTables();
  const emp = getEmployee(input.employeeId);
  if (!emp) throw new Error('همکار پیدا نشد');
  const status = 'ثبت‌شده';
  const log = [{ at: new Date().toISOString(), status, note: 'ثبت اولیه' }];
  const info = db()
    .prepare(
      `INSERT INTO hr_requests
        (employee_id, type, days, from_date, to_date, description, status, result, log_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.employeeId,
      input.type,
      input.days ?? 0,
      input.fromDate || '',
      input.toDate || '',
      input.description || '',
      status,
      '',
      JSON.stringify(log)
    );
  const id = Number(info.lastInsertRowid);
  pushNotification(`درخواست جدید: ${input.type} — ${emp.firstName} ${emp.lastName}`, 'info');
  return mapRequest(
    db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function advanceRequest(id: number, opts?: { result?: string }): HrRequest | null {
  const row = db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const next = nextRequestStatus(String(row.status || ''));
  if (!next) throw new Error('درخواست در مرحله نهایی است');
  const log = parseJson<Array<{ at: string; status: string; note?: string }>>(row.log_json, []);
  log.push({ at: new Date().toISOString(), status: next });
  const result =
    opts?.result != null && String(opts.result).trim()
      ? String(opts.result).trim()
      : String(row.result || '');
  db()
    .prepare('UPDATE hr_requests SET status = ?, result = ?, log_json = ? WHERE id = ?')
    .run(next, result, JSON.stringify(log), id);
  if (next === 'تایید شده') {
    pushNotification(`درخواست #${id} تایید شد`, 'success');
  }
  return mapRequest(
    db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as Record<string, unknown>
  );
}

export function rejectRequest(id: number, note?: string): HrRequest | null {
  const row = db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const status = String(row.status || '');
  if (!['ثبت‌شده', 'بررسی مدیر', 'بررسی HR'].includes(status)) {
    throw new Error('در این مرحله رد مجاز نیست');
  }
  const log = parseJson<Array<{ at: string; status: string; note?: string }>>(row.log_json, []);
  log.push({ at: new Date().toISOString(), status: 'رد شده', note });
  db()
    .prepare('UPDATE hr_requests SET status = ?, log_json = ? WHERE id = ?')
    .run('رد شده', JSON.stringify(log), id);
  pushNotification(`درخواست #${id} رد شد`, 'bad');
  return mapRequest(
    db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as Record<string, unknown>
  );
}

/** Set نتیجه and mark ticket as تایید شده (or keep رد شده if already rejected). */
export function resolveRequest(
  id: number,
  input: { result?: string; note?: string }
): HrRequest | null {
  ensureHrModuleTables();
  const row = db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  const status = String(row.status || '');
  if (status === 'رد شده' || status === 'لغو شده') {
    throw new Error('تیکت رد/لغو شده قابل تایید نیست');
  }
  const result = String(input.result || '').trim() || 'انجام شد';
  const note = String(input.note || '').trim();
  const log = parseJson<Array<{ at: string; status: string; note?: string }>>(row.log_json, []);
  log.push({
    at: new Date().toISOString(),
    status: 'تایید شده',
    note: note || `نتیجه: ${result}`,
  });
  db()
    .prepare('UPDATE hr_requests SET status = ?, result = ?, log_json = ? WHERE id = ?')
    .run('تایید شده', result, JSON.stringify(log), id);
  pushNotification(`تیکت #${id} بسته شد — ${result}`, 'success');
  return mapRequest(
    db().prepare('SELECT * FROM hr_requests WHERE id = ?').get(id) as Record<string, unknown>
  );
}

const SAMPLE_HR_TICKET_MARKER = 'SAMPLE-HR-TICKET';

/**
 * Additive demo tickets (مرخصی / تجهیزات / گواهی اشتغال).
 * Idempotent via description marker — never wipes existing rows.
 */
export function ensureSampleHrTickets(employeeId?: number): HrRequest[] {
  ensureHrModuleTables();
  let empId = employeeId;
  if (empId == null) {
    const first = listEmployees({ limit: 1 }).employees[0];
    empId = first?.id;
  }
  if (empId == null || !Number.isFinite(empId)) return [];

  const samples: Array<{
    type: string;
    days: number;
    fromDate: string;
    toDate: string;
    description: string;
  }> = [
    {
      type: 'مرخصی',
      days: 2,
      fromDate: '1404/01/10',
      toDate: '1404/01/11',
      description: `${SAMPLE_HR_TICKET_MARKER} مرخصی`,
    },
    {
      type: 'تجهیزات',
      days: 0,
      fromDate: '',
      toDate: '',
      description: `${SAMPLE_HR_TICKET_MARKER} تجهیزات`,
    },
    {
      type: 'گواهی اشتغال',
      days: 0,
      fromDate: '',
      toDate: '',
      description: `${SAMPLE_HR_TICKET_MARKER} گواهی اشتغال`,
    },
  ];

  const existing = (
    db()
      .prepare(
        `SELECT * FROM hr_requests WHERE employee_id = ? AND description LIKE ? ORDER BY id`
      )
      .all(empId, `${SAMPLE_HR_TICKET_MARKER}%`) as Record<string, unknown>[]
  ).map(mapRequest);

  const out: HrRequest[] = [...existing];
  for (const s of samples) {
    if (existing.some((r) => r.type === s.type)) continue;
    out.push(
      createRequest({
        employeeId: empId,
        type: s.type,
        days: s.days,
        fromDate: s.fromDate,
        toDate: s.toDate,
        description: s.description,
      })
    );
  }
  return out;
}

export function leaveBalance(employeeId: number): {
  annual: number;
  used: number;
  remaining: number;
} {
  const rows = db()
    .prepare(
      `SELECT days FROM hr_requests
       WHERE employee_id = ? AND type = 'مرخصی' AND status = 'تایید شده'`
    )
    .all(employeeId) as Array<{ days: number }>;
  const used = rows.reduce((s, r) => s + Number(r.days || 0), 0);
  return {
    annual: HR_ANNUAL_LEAVE_DAYS,
    used,
    remaining: HR_ANNUAL_LEAVE_DAYS - used,
  };
}

export function leaveBalancesAll(): Array<{
  employeeId: number;
  name: string;
  personnelCode: string;
  annual: number;
  used: number;
  remaining: number;
}> {
  return listEmployees({ limit: 500 }).employees.map((e) => {
    const bal = leaveBalance(e.id);
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      personnelCode: e.personnelCode,
      ...bal,
    };
  });
}

function mapCost(row: Record<string, unknown>): HrCostEntry {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    year: Number(row.year),
    month: Number(row.month),
    insurance: Number(row.insurance || 0),
    tax: Number(row.tax || 0),
    bonus: Number(row.bonus || 0),
    sales: Number(row.sales || 0),
  };
}

export function listCostEntries(opts?: {
  year?: number;
  month?: number;
  employeeId?: number;
}): HrCostEntry[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.year) {
    where.push('year = ?');
    params.push(opts.year);
  }
  if (opts?.month) {
    where.push('month = ?');
    params.push(opts.month);
  }
  if (opts?.employeeId) {
    where.push('employee_id = ?');
    params.push(opts.employeeId);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return (
    db()
      .prepare(`SELECT * FROM hr_cost_entries ${clause} ORDER BY year DESC, month DESC, id DESC`)
      .all(...params) as Record<string, unknown>[]
  ).map(mapCost);
}

export function upsertCostEntry(input: {
  employeeId: number;
  year: number;
  month: number;
  insurance?: number;
  tax?: number;
  bonus?: number;
  sales?: number;
}): HrCostEntry {
  if (!getEmployee(input.employeeId)) throw new Error('همکار پیدا نشد');
  const existing = db()
    .prepare(
      'SELECT id FROM hr_cost_entries WHERE employee_id = ? AND year = ? AND month = ?'
    )
    .get(input.employeeId, input.year, input.month) as { id: number } | undefined;
  if (existing) {
    db()
      .prepare(
        `UPDATE hr_cost_entries
         SET insurance = ?, tax = ?, bonus = ?, sales = ?
         WHERE id = ?`
      )
      .run(
        input.insurance ?? 0,
        input.tax ?? 0,
        input.bonus ?? 0,
        input.sales ?? 0,
        existing.id
      );
    return mapCost(
      db().prepare('SELECT * FROM hr_cost_entries WHERE id = ?').get(existing.id) as Record<
        string,
        unknown
      >
    );
  }
  const info = db()
    .prepare(
      `INSERT INTO hr_cost_entries
        (employee_id, year, month, insurance, tax, bonus, sales)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.employeeId,
      input.year,
      input.month,
      input.insurance ?? 0,
      input.tax ?? 0,
      input.bonus ?? 0,
      input.sales ?? 0
    );
  return mapCost(
    db()
      .prepare('SELECT * FROM hr_cost_entries WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>
  );
}

function activeContract(employeeId: number) {
  const contracts = listContracts(employeeId);
  const today = new Date().toISOString().slice(0, 10);
  const active = contracts.find((c) => {
    if (!c.startDate) return false;
    if (c.startDate > today) return false;
    if (c.endDate && c.endDate < today) return false;
    return true;
  });
  return active || contracts[0] || null;
}

export function monthlyCostForPerson(
  employeeId: number,
  year: number,
  month: number
): HrMonthlyCostBreakdown {
  const emp = getEmployee(employeeId);
  const empty: HrMonthlyCostBreakdown = {
    employeeId,
    salary: 0,
    insurance: 0,
    tax: 0,
    bonus: 0,
    commission: 0,
    eidiMonthly: 0,
    sanavatMonthly: 0,
    total: 0,
  };
  if (!emp) return empty;
  const contract = activeContract(employeeId);
  const models = listIncomeModels();
  const model = models.find((m) => m.id === emp.incomeModelId) || null;
  const entry =
    listCostEntries({ employeeId, year, month })[0] ||
    ({
      insurance: 0,
      tax: 0,
      bonus: 0,
      sales: 0,
    } as HrCostEntry);

  const salary = Number(contract?.salary || 0) + incomeModelFixedAddon(model);
  const benefits = emp.benefits || {};
  const insurance = benefits.insurance ? Number(entry.insurance || 0) : 0;
  const tax = Number(entry.tax || 0);
  const bonus = benefits.bonus ? Number(entry.bonus || 0) : 0;
  const commission =
    benefits.commission && isSalesJobTitle(emp.jobTitle)
      ? Math.round(
          (Number(entry.sales || 0) *
            effectiveCommissionPercent(Number(contract?.commissionPercent || 0), model)) /
            100
        )
      : 0;
  const eidiMonthly = benefits.eidi ? Math.round(Number(contract?.eidi || 0) / 12) : 0;
  const sanavatMonthly = benefits.sanavat ? Math.round(Number(contract?.sanavat || 0) / 12) : 0;
  const total = salary + tax + insurance + commission + eidiMonthly + sanavatMonthly + bonus;
  return {
    employeeId,
    salary,
    insurance,
    tax,
    bonus,
    commission,
    eidiMonthly,
    sanavatMonthly,
    total,
  };
}

export function listMonthlyCosts(year: number, month: number) {
  return listEmployees({ limit: 500 }).employees.map((e) => {
    const cost = monthlyCostForPerson(e.id, year, month);
    return {
      employee: {
        id: e.id,
        publicId: e.publicId,
        personnelCode: e.personnelCode,
        name: `${e.firstName} ${e.lastName}`.trim(),
        jobTitle: e.jobTitle,
        department: e.department,
        avatarUrl: e.avatarUrl || '',
      },
      cost,
    };
  });
}

function mapService(row: Record<string, unknown>): HrServiceEntry {
  return {
    id: Number(row.id),
    employeeId: Number(row.employee_id),
    year: Number(row.year),
    month: Number(row.month),
    day: Number(row.day || 1),
    hours: Number(row.hours || 0),
    minutes: Number(row.minutes || 0),
    note: String(row.note || ''),
    createdAt: String(row.created_at || ''),
  };
}

export function listServiceEntries(opts?: {
  year?: number;
  month?: number;
  employeeId?: number;
}): HrServiceEntry[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.year) {
    where.push('year = ?');
    params.push(opts.year);
  }
  if (opts?.month) {
    where.push('month = ?');
    params.push(opts.month);
  }
  if (opts?.employeeId) {
    where.push('employee_id = ?');
    params.push(opts.employeeId);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return (
    db()
      .prepare(`SELECT * FROM hr_service_entries ${clause} ORDER BY id DESC LIMIT 500`)
      .all(...params) as Record<string, unknown>[]
  ).map(mapService);
}

export function createServiceEntry(input: {
  employeeId: number;
  year: number;
  month: number;
  day?: number;
  hours?: number;
  minutes?: number;
  note?: string;
}): HrServiceEntry {
  if (!getEmployee(input.employeeId)) throw new Error('همکار پیدا نشد');
  const info = db()
    .prepare(
      `INSERT INTO hr_service_entries
        (employee_id, year, month, day, hours, minutes, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.employeeId,
      input.year,
      input.month,
      input.day ?? 1,
      input.hours ?? 0,
      input.minutes ?? 0,
      input.note || ''
    );
  return mapService(
    db()
      .prepare('SELECT * FROM hr_service_entries WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as Record<string, unknown>
  );
}

export function deleteServiceEntry(id: number): boolean {
  const r = db().prepare('DELETE FROM hr_service_entries WHERE id = ?').run(id);
  return r.changes > 0;
}

export function totalServiceHours(year: number, month: number, employeeId?: number): number {
  const entries = listServiceEntries({ year, month, employeeId });
  return entries.reduce((s, e) => s + Number(e.hours || 0) + Number(e.minutes || 0) / 60, 0);
}

export function createCareerLayer(input: {
  name: string;
  sortOrder?: number;
  unlocks?: string;
}): HrCareerLayer {
  const info = db()
    .prepare(`INSERT INTO hr_career_layers (name, sort_order, unlocks) VALUES (?, ?, ?)`)
    .run(input.name.trim(), input.sortOrder ?? 0, input.unlocks || '');
  const id = Number(info.lastInsertRowid);
  return listCareerLayers().find((l) => l.id === id)!;
}

export function updateCareerLayer(
  id: number,
  input: { name?: string; sortOrder?: number; unlocks?: string }
): HrCareerLayer | null {
  const prev = listCareerLayers().find((l) => l.id === id);
  if (!prev) return null;
  db()
    .prepare(`UPDATE hr_career_layers SET name = ?, sort_order = ?, unlocks = ? WHERE id = ?`)
    .run(
      input.name !== undefined ? input.name.trim() : prev.name,
      input.sortOrder !== undefined ? input.sortOrder : prev.sortOrder,
      input.unlocks !== undefined ? input.unlocks : prev.unlocks,
      id
    );
  return listCareerLayers().find((l) => l.id === id) || null;
}

export function deleteCareerLayer(id: number): boolean {
  return db().prepare('DELETE FROM hr_career_layers WHERE id = ?').run(id).changes > 0;
}

export function createIncomeModel(input: {
  name: string;
  type?: string;
  variableAmount?: number;
  variablePercent?: number;
}): HrIncomeModel {
  const info = db()
    .prepare(
      `INSERT INTO hr_income_models (name, type, variable_amount, variable_percent)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      input.name.trim(),
      input.type || 'متغیر',
      input.variableAmount ?? 0,
      input.variablePercent ?? 0
    );
  const id = Number(info.lastInsertRowid);
  return listIncomeModels().find((m) => m.id === id)!;
}

export function updateIncomeModel(
  id: number,
  input: {
    name?: string;
    type?: string;
    variableAmount?: number;
    variablePercent?: number;
  }
): HrIncomeModel | null {
  const prev = listIncomeModels().find((m) => m.id === id);
  if (!prev) return null;
  db()
    .prepare(
      `UPDATE hr_income_models
       SET name = ?, type = ?, variable_amount = ?, variable_percent = ?
       WHERE id = ?`
    )
    .run(
      input.name !== undefined ? input.name.trim() : prev.name,
      input.type !== undefined ? input.type : prev.type,
      input.variableAmount !== undefined ? input.variableAmount : prev.variableAmount,
      input.variablePercent !== undefined ? input.variablePercent : prev.variablePercent,
      id
    );
  return listIncomeModels().find((m) => m.id === id) || null;
}

export function deleteIncomeModel(id: number): boolean {
  return db().prepare('DELETE FROM hr_income_models WHERE id = ?').run(id).changes > 0;
}

export function createBenefitDef(input: {
  title: string;
  category?: string;
  careerLayerId?: number | null;
  jobTitle?: string | null;
  cost?: number;
}): HrBenefitDef {
  const info = db()
    .prepare(
      `INSERT INTO hr_benefit_defs (title, category, career_layer_id, job_title, cost)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.title.trim(),
      input.category || '',
      input.careerLayerId ?? null,
      input.jobTitle ?? null,
      input.cost ?? 0
    );
  const id = Number(info.lastInsertRowid);
  return listBenefitDefs().find((b) => b.id === id)!;
}

export function updateBenefitDef(
  id: number,
  input: {
    title?: string;
    category?: string;
    careerLayerId?: number | null;
    jobTitle?: string | null;
    cost?: number;
  }
): HrBenefitDef | null {
  const prev = listBenefitDefs().find((b) => b.id === id);
  if (!prev) return null;
  db()
    .prepare(
      `UPDATE hr_benefit_defs
       SET title = ?, category = ?, career_layer_id = ?, job_title = ?, cost = ?
       WHERE id = ?`
    )
    .run(
      input.title !== undefined ? input.title.trim() : prev.title,
      input.category !== undefined ? input.category : prev.category,
      input.careerLayerId !== undefined ? input.careerLayerId : prev.careerLayerId ?? null,
      input.jobTitle !== undefined ? input.jobTitle : prev.jobTitle ?? null,
      input.cost !== undefined ? input.cost : prev.cost,
      id
    );
  return listBenefitDefs().find((b) => b.id === id) || null;
}

export function deleteBenefitDef(id: number): boolean {
  return db().prepare('DELETE FROM hr_benefit_defs WHERE id = ?').run(id).changes > 0;
}

export function cockpitTasks(): HrCockpitTask[] {
  const tasks: HrCockpitTask[] = [];
  const today = new Date();
  const { employees } = listEmployees({ limit: 500 });

  for (const e of employees) {
    if (e.birthDate) {
      const parts = e.birthDate.split('-').map(Number);
      if (parts.length >= 2) {
        const [, m, d] = parts;
        const thisYear = new Date(today.getFullYear(), (m || 1) - 1, d || 1);
        const diff = Math.round((thisYear.getTime() - today.getTime()) / 86400000);
        if (diff >= 0 && diff <= 14) {
          tasks.push({
            type: 'تولد نزدیک',
            label: 'جذب و نگهداشت',
            employeeId: e.id,
            employeeName: `${e.firstName} ${e.lastName}`.trim(),
            detail: `تولد تا ${diff} روز دیگر`,
            daysLeft: diff,
          });
        }
      }
    }
    if (e.contractStatus === 'در مرحله آزمایشی') {
      tasks.push({
        type: 'دوره آزمایشی',
        label: 'ارزیابی',
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        detail: 'وضعیت قرارداد: در مرحله آزمایشی',
      });
    }
    if (e.accessStatus === 'غیر فعال') {
      tasks.push({
        type: 'قطع دسترسی',
        label: 'امنیت',
        employeeId: e.id,
        employeeName: `${e.firstName} ${e.lastName}`.trim(),
        detail: 'دسترسی غیرفعال است',
      });
    }
    const contracts = listContracts(e.id);
    for (const c of contracts) {
      if (!c.endDate) continue;
      const end = new Date(c.endDate);
      const diff = Math.round((end.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 30) {
        tasks.push({
          type: 'تمدید قرارداد',
          label: 'قرارداد',
          employeeId: e.id,
          employeeName: `${e.firstName} ${e.lastName}`.trim(),
          detail: `پایان قرارداد ${c.contractCode || ''} تا ${diff} روز`,
          daysLeft: diff,
        });
      }
    }
  }

  const pendingReqs = (
    db()
      .prepare(
        `SELECT id, type, status, employee_id FROM hr_requests
         WHERE status IN ('ثبت‌شده','بررسی مدیر','بررسی HR') ORDER BY id DESC LIMIT 50`
      )
      .all() as Array<{ id: number; type: string; status: string; employee_id: number }>
  ).map((r) => {
    const emp = getEmployee(r.employee_id);
    return {
      type: 'درخواست باز',
      label: r.type,
      employeeId: r.employee_id,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : `#${r.employee_id}`,
      detail: `وضعیت: ${r.status}`,
    } as HrCockpitTask;
  });

  for (const o of listOnboarding()) {
    const done = o.tasks.filter((t) => t.done).length;
    if (done < o.tasks.length) {
      tasks.push({
        type: 'شروع به کار',
        label: 'آنبوردینگ',
        employeeId: o.employeeId ?? undefined,
        employeeName: o.name,
        detail: `پیشرفت ${done}/${o.tasks.length}`,
      });
    }
  }

  // Interview tasks from ATS follow-up
  for (const c of listCandidates()) {
    const at = c.followup?.interviewAt;
    if (!at || c.stage === 'استخدام‌شده' || c.stage.startsWith('رد شده')) continue;
    const when = new Date(at);
    if (Number.isNaN(when.getTime())) continue;
    const diff = Math.round((when.getTime() - today.getTime()) / 86400000);
    if (diff < -1 || diff > 30) continue;
    tasks.push({
      type: 'مصاحبه جذب',
      label: 'استخدام',
      employeeId: c.followup.interviewerEmployeeId ?? undefined,
      employeeName: c.followup.interviewerName || `${c.firstName} ${c.lastName}`.trim(),
      detail: `مصاحبه با ${c.firstName} ${c.lastName} · ${at.replace('T', ' ').slice(0, 16)}`,
      daysLeft: diff,
      refType: 'candidate',
      refId: c.id,
    });
  }

  return [...tasks, ...pendingReqs];
}

function countBy(values: string[]): Array<{ name: string; count: number }> {
  const map: Record<string, number> = {};
  for (const raw of values) {
    const key = (raw || '').trim() || 'نامشخص';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fa'));
}

/** Like countBy but drop empty / نامشخص buckets (for gender/marital charts). */
function countByKnown(values: string[]): Array<{ name: string; count: number }> {
  return countBy(values).filter((r) => r.name && r.name !== 'نامشخص');
}

export function getHrOverviewDashboard() {
  const { employees, total } = listEmployees({ limit: 500 });
  const active = employees.filter((e) => e.accessStatus === 'فعال').length;
  const inactive = total - active;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const hours = totalServiceHours(year, month);
  const costs = listMonthlyCosts(year, month);
  const orgCost = costs.reduce((s, c) => s + c.cost.total, 0);
  const tasks = cockpitTasks();
  const unread = listNotifications({ unreadOnly: true }).length;
  const recentLogs = (
    db()
      .prepare(
        `SELECT l.*, e.first_name, e.last_name, e.avatar_url FROM hr_employee_logs l
         JOIN hr_employees e ON e.id = l.employee_id
         ORDER BY l.id DESC LIMIT 8`
      )
      .all() as Array<Record<string, unknown>>
  ).map((r) => ({
    employeeId: Number(r.employee_id),
    personName: `${r.first_name} ${r.last_name}`.trim(),
    avatarUrl: String(r.avatar_url || ''),
    field: String(r.field || ''),
    oldValue: String(r.old_value || ''),
    newValue: String(r.new_value || ''),
    date: String(r.logged_at || ''),
  }));

  const byDepartment = countBy(employees.map((e) => e.department || ''));
  const byContractStatus = countBy(employees.map((e) => e.contractStatus || ''));
  const byLocation = countBy(employees.map((e) => e.location || ''));
  /** Same period as orgCostMonth — sum monthlyCostForPerson totals by employee department. */
  const costByDeptMap: Record<string, number> = {};
  for (const row of costs) {
    const key = (row.employee.department || '').trim() || 'نامشخص';
    costByDeptMap[key] = (costByDeptMap[key] || 0) + (row.cost.total || 0);
  }
  const costByDepartment = Object.entries(costByDeptMap)
    .map(([name, total]) => ({ name, total }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'fa'));
  const monthLabel = now.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' });

  return {
    generatedAt: new Date().toISOString(),
    monthLabel,
    kpis: {
      personnel: total,
      activeAccess: active,
      inactiveAccess: inactive,
      cockpitTasks: tasks.length,
      serviceHoursMonth: Math.round(hours * 10) / 10,
      orgCostMonth: orgCost,
      unreadNotifications: unread,
      openRequests: (
        db()
          .prepare(
            `SELECT COUNT(*) as c FROM hr_requests
             WHERE status IN ('ثبت‌شده','بررسی مدیر','بررسی HR')`
          )
          .get() as { c: number }
      ).c,
      openOnboarding: listOnboarding().filter(
        (o) => o.tasks.filter((t) => t.done).length < o.tasks.length
      ).length,
    },
    charts: {
      byDepartment,
      costByDepartment,
      byContractStatus,
      byLocation,
    },
    links: [
      { to: '/admin/hr/employees', label: 'اطلاعات پرسنلی' },
      { to: '/admin/hr/requests', label: 'تیکت‌های منابع انسانی' },
      { to: '/admin/hr/cost', label: 'تخصیص هزینه' },
      { to: '/admin/hr/cockpit', label: 'کارتابل فعالیت' },
      { to: '/admin/hr/recruitment', label: 'داشبورد جذب' },
      { to: '/admin/hr/reports', label: 'گزارشات' },
    ],
    recentLogs,
    cockpitPreview: tasks.slice(0, 6),
  };
}

export function getRecruitmentDashboard() {
  const openings = listJobOpenings();
  const candidates = listCandidates();
  const openJobs = openings.filter((o) => o.status === 'باز').length;
  const byStage: Record<string, number> = {};
  for (const c of candidates) {
    byStage[c.stage] = (byStage[c.stage] || 0) + 1;
  }
  const hired = byStage['استخدام‌شده'] || 0;
  const onboarding = listOnboarding();
  const funnelOrder = [
    'متقاضی جدید',
    'غربالگری تلفنی',
    'مصاحبه',
    'پیشنهاد شغلی',
    'استخدام‌شده',
    'رد شده',
    'رد شده - عدم ارتباط گیری',
    'بانک استعداد',
  ];
  const stageChart = funnelOrder
    .map((name) => ({ name, count: byStage[name] || 0 }))
    .filter((r) => r.count > 0)
    .concat(
      Object.entries(byStage)
        .filter(([name]) => !funnelOrder.includes(name))
        .map(([name, count]) => ({ name, count }))
    );
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      openJobs,
      totalOpenings: openings.length,
      candidates: candidates.length,
      hired,
      onboardingActive: onboarding.filter(
        (o) => o.tasks.filter((t) => t.done).length < o.tasks.length
      ).length,
      pipelineInterview: byStage['مصاحبه'] || 0,
      pipelineOffer: byStage['پیشنهاد شغلی'] || 0,
      talentBank: byStage['بانک استعداد'] || 0,
    },
    byStage,
    stageChart,
    funnel: stageChart,
    links: [
      { to: '/admin/hr/ats', label: 'ATS — فرصت و متقاضی' },
      { to: '/admin/hr/onboarding', label: 'شروع به کار' },
      { to: '/admin/hr/employees', label: 'پرونده پرسنلی' },
    ],
    recentCandidates: candidates.slice(0, 8),
    openings: openings.slice(0, 8),
  };
}

function normalizeGender(raw: string): string {
  const t = String(raw || '').trim();
  if (!t || t === 'نامشخص') return '';
  if (/^(آقا|مرد|male|m)$/i.test(t)) return 'آقا';
  if (/^(خانم|زن|female|f)$/i.test(t)) return 'خانم';
  return t;
}

function normalizeMarital(raw: string): string {
  const t = String(raw || '').trim();
  if (!t || t === 'نامشخص') return '';
  if (/مجرد|single/i.test(t)) return 'مجرد';
  if (/متاهل|متأهل|married/i.test(t)) return 'متأهل';
  return t;
}

function ageFromBirthDate(raw: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || '').slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || y < 1900) return null;
  let age = now.getFullYear() - y;
  const birthThisYear = new Date(now.getFullYear(), mo - 1, d);
  if (now < birthThisYear) age -= 1;
  if (age < 15 || age > 90) return null;
  return age;
}

/** Gregorian Y-M-D → Jalali Y-M-D (compact calendar convert). */
function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  let gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gy2e = gm > 2 ? gy2 + 1 : gy2;
  let days =
    365 * gy2 +
    Math.floor((gy2e + 3) / 4) -
    Math.floor((gy2e + 99) / 100) +
    Math.floor((gy2e + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function employeeJalaliParts(emp: {
  contractStartDate?: string;
  createdAt: string;
}): { jy: number; jm: number } | null {
  const raw = String(emp.contractStartDate || emp.createdAt || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const j = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  return { jy: j.jy, jm: j.jm };
}

export function getReportsSummary(opts?: {
  department?: string;
  jalaliYear?: number;
  jalaliMonth?: number;
}) {
  const { employees } = listEmployees({ limit: 500 });
  const departments = [
    ...new Set(employees.map((e) => (e.department || '').trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'fa'));

  let filtered = employees;
  if (opts?.department?.trim()) {
    const dept = opts.department.trim();
    filtered = filtered.filter((e) => (e.department || '').trim() === dept);
  }
  if (opts?.jalaliYear && Number.isFinite(opts.jalaliYear)) {
    const jy = Number(opts.jalaliYear);
    const jm = opts.jalaliMonth && Number.isFinite(opts.jalaliMonth) ? Number(opts.jalaliMonth) : 0;
    filtered = filtered.filter((e) => {
      const parts = employeeJalaliParts(e);
      if (!parts) return false;
      if (parts.jy !== jy) return false;
      if (jm >= 1 && jm <= 12 && parts.jm !== jm) return false;
      return true;
    });
  }

  const byDept = countBy(filtered.map((e) => e.department || ''));
  const byStatus = countBy(filtered.map((e) => e.contractStatus || ''));
  const byLocation = countBy(filtered.map((e) => e.location || ''));
  const provinceRaw = filtered.map((e) => (e.province || '').trim());
  const unknownProvinceCount = provinceRaw.filter((p) => !p || p === 'نامشخص').length;
  const byProvince = countByKnown(provinceRaw);
  const provinceKnownHeadcount = byProvince.reduce((s, r) => s + r.count, 0);
  const byGender = countByKnown(filtered.map((e) => normalizeGender(e.gender)));
  const byMarital = countByKnown(filtered.map((e) => normalizeMarital(e.maritalStatus)));
  const byJobTitle = countByKnown(filtered.map((e) => e.jobTitle || ''));
  const ages = filtered
    .map((e) => ageFromBirthDate(e.birthDate))
    .filter((n): n is number => n != null);
  const ageStats =
    ages.length > 0
      ? {
          min: Math.min(...ages),
          max: Math.max(...ages),
          avg: Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10,
          sample: ages.length,
        }
      : { min: null as number | null, max: null as number | null, avg: null as number | null, sample: 0 };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const topProvince = byProvince[0] || null;
  return {
    generatedAt: new Date().toISOString(),
    personnelTotal: filtered.length,
    /** Hired headcount in the selected Jalali window (same as filtered set). */
    hiredHeadcount: filtered.length,
    /** Sum of byProvince counts (excludes empty / نامشخص). */
    provinceKnownHeadcount,
    /** Hired with empty or نامشخص province — explains hiredHeadcount − provinceKnownHeadcount. */
    unknownProvinceCount,
    departments,
    filters: {
      department: opts?.department?.trim() || '',
      jalaliYear: opts?.jalaliYear || null,
      jalaliMonth: opts?.jalaliMonth || null,
    },
    byDept,
    byStatus,
    byLocation,
    byProvince,
    byGender,
    byMarital,
    byJobTitle,
    ageStats,
    topProvince,
    /** @deprecated maps — prefer chart arrays above */
    byDeptMap: Object.fromEntries(byDept.map((r) => [r.name, r.count])),
    byStatusMap: Object.fromEntries(byStatus.map((r) => [r.name, r.count])),
    byLocationMap: Object.fromEntries(byLocation.map((r) => [r.name, r.count])),
    serviceHoursMonth: totalServiceHours(year, month),
    leaveBalances: leaveBalancesAll(),
    requestsOpen: (
      db()
        .prepare(
          `SELECT COUNT(*) as c FROM hr_requests
           WHERE status IN ('ثبت‌شده','بررسی مدیر','بررسی HR')`
        )
        .get() as { c: number }
    ).c,
  };
}

export function armitaAnswer(question: string): string {
  const t = String(question || '').trim();
  if (!t) return 'سوالی نپرسیدی. می‌توانی درباره پرسنل، مرخصی، استخدام یا کارتابل بپرسی.';

  if (/مرخصی/.test(t)) {
    const { employees } = listEmployees({ limit: 500 });
    const hit = employees.find((e) => {
      const full = `${e.firstName} ${e.lastName}`.trim();
      return full && t.includes(full);
    });
    if (hit) {
      const bal = leaveBalance(hit.id);
      return `مانده مرخصی ${hit.firstName} ${hit.lastName}: ${bal.remaining} از ${bal.annual} روز (مصرف‌شده: ${bal.used}).`;
    }
    return 'برای مانده مرخصی، نام کامل همکار را هم در سوال بیاور.';
  }

  if (/چند نفر|تعداد پرسنل|پرسنل/.test(t)) {
    const { employees, total } = listEmployees({ limit: 500 });
    const active = employees.filter((e) => e.accessStatus === 'فعال').length;
    return `در حال حاضر ${total} نفر در پرونده پرسنلی ثبت شده‌اند؛ دسترسی فعال: ${active}.`;
  }

  if (/وظیفه|کارتابل/.test(t)) {
    return `در حال حاضر ${cockpitTasks().length} وظیفه در کارتابل فعالیت منابع انسانی باز است.`;
  }

  if (/استخدام|متقاضی/.test(t)) {
    const openings = listJobOpenings().filter((o) => o.status === 'باز').length;
    const candidates = listCandidates().length;
    return `فرصت‌های شغلی باز: ${openings} · متقاضیان: ${candidates}.`;
  }

  if (/مسیر شغلی|لایه/.test(t)) {
    return `در حال حاضر ${listCareerLayers().length} لایه مسیر شغلی تعریف شده است.`;
  }

  return 'من دستیار قاعده‌محور آرمیتا هستم (نه مدل زبانی واقعی). درباره تعداد پرسنل، مرخصی + نام همکار، کارتابل، استخدام یا مسیر شغلی بپرس؛ برای موارد پیچیده‌تر به HR یا مدیر مستقیم مراجعه کن.';
}

export function armitaChat(message: string): { id: string; question: string; answer: string } {
  return {
    id: randomUUID(),
    question: message,
    answer: armitaAnswer(message),
  };
}
