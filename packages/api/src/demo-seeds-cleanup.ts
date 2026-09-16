/**
 * Safe cleanup of known demo/fake panel rows.
 * Dry-run by default. Never deletes production-looking users
 * (except telegram fake_owner_* and demo_host / demo_player).
 */
import { getDb } from './db';

export const DEMO_SEED_PURGE_CONFIRM = 'DELETE_DEMO_SEEDS';

const FAKE_SHOP_NAMES = ['سارا م.', 'علی ر.', 'مریم ک.', 'رضا ن.', 'نگار پ.', 'حسین ب.'] as const;

const FINANCE_OS_TABLES = [
  'finance_os_transactions',
  'finance_os_import_log',
  'finance_os_sbg_expenses',
  'finance_os_sbg_people',
  'finance_os_invoices',
  'finance_os_commitments',
  'finance_os_equipment',
  'finance_os_accounts',
  'finance_os_people',
  'finance_os_offices',
  'finance_os_sales_teams',
  'finance_os_dims',
  'finance_os_meta',
  'finance_os_businesses',
] as const;

export type DemoSeedCleanupCounts = {
  hrEmployees: number;
  hrContracts: number;
  hrLogs: number;
  hrOnboarding: number;
  hrCost: number;
  hrService: number;
  hrRequests: number;
  hrCandidates: number;
  hrNotifications: number;
  adminAccounts: number;
  salesItems: number;
  salesActivities: number;
  salesCustomers: number;
  salesOrders: number;
  crmCustomers: number;
  crmOrders: number;
  crmInteractions: number;
  crmTickets: number;
  crmFollowups: number;
  crmComplaints: number;
  crmReferrals: number;
  crmSurveys: number;
  /** Fake shop_orders (null user + seed names/phones). */
  shopOrders: number;
  /** wallet_ledger seed rows + ledger tied to fake shop orders. */
  walletLedger: number;
  /** Fake platform users (fake_owner_*, demo_host/player). */
  fakeUsers: number;
  fakePets: number;
  /** Rows wiped across finance_os_* when demo holding CoA is present. */
  financeOsRows: number;
};

const EMPTY_COUNTS: DemoSeedCleanupCounts = {
  hrEmployees: 0,
  hrContracts: 0,
  hrLogs: 0,
  hrOnboarding: 0,
  hrCost: 0,
  hrService: 0,
  hrRequests: 0,
  hrCandidates: 0,
  hrNotifications: 0,
  adminAccounts: 0,
  salesItems: 0,
  salesActivities: 0,
  salesCustomers: 0,
  salesOrders: 0,
  crmCustomers: 0,
  crmOrders: 0,
  crmInteractions: 0,
  crmTickets: 0,
  crmFollowups: 0,
  crmComplaints: 0,
  crmReferrals: 0,
  crmSurveys: 0,
  shopOrders: 0,
  walletLedger: 0,
  fakeUsers: 0,
  fakePets: 0,
  financeOsRows: 0,
};

function idsOf(rows: Array<{ id: number }>): number[] {
  return rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
}

function countByIds(table: string, column: string, ids: number[]): number {
  if (!ids.length) return 0;
  const d = getDb();
  const ph = ids.map(() => '?').join(',');
  const row = d.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE ${column} IN (${ph})`).get(...ids) as {
    c: number;
  };
  return Number(row?.c ?? 0);
}

function deleteByIds(table: string, column: string, ids: number[]): number {
  if (!ids.length) return 0;
  const d = getDb();
  const ph = ids.map(() => '?').join(',');
  const info = d.prepare(`DELETE FROM ${table} WHERE ${column} IN (${ph})`).run(...ids);
  return Number(info.changes ?? 0);
}

function tableExists(name: string): boolean {
  try {
    getDb().prepare(`SELECT 1 FROM ${name} LIMIT 1`).get();
    return true;
  } catch {
    return false;
  }
}

function collectFakeShopOrderIds(): number[] {
  const d = getDb();
  if (!tableExists('shop_orders')) return [];
  const namePh = FAKE_SHOP_NAMES.map(() => '?').join(',');
  const rows = d
    .prepare(
      `SELECT id FROM shop_orders
       WHERE user_id IS NULL
         AND (
           customer_name IN (${namePh})
           OR customer_phone LIKE '091000000%'
         )`
    )
    .all(...FAKE_SHOP_NAMES) as Array<{ id: number }>;
  return idsOf(rows);
}

function financeOsLooksLikeDemo(): boolean {
  const d = getDb();
  if (!tableExists('finance_os_businesses')) return false;
  const codes = d
    .prepare(`SELECT code FROM finance_os_businesses`)
    .all() as Array<{ code: string }>;
  const set = new Set(codes.map((c) => String(c.code)));
  // Seed inserts HYP/UPD/ART/HLD/HLD-SHR/PD together.
  return set.has('HYP') && set.has('UPD') && set.has('PD');
}

function countFinanceOsRows(): number {
  if (!financeOsLooksLikeDemo()) return 0;
  let total = 0;
  for (const t of FINANCE_OS_TABLES) {
    if (!tableExists(t)) continue;
    try {
      const row = getDb().prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
      total += Number(row?.c ?? 0);
    } catch {
      /* ignore */
    }
  }
  return total;
}

function wipeFinanceOsDemo(): number {
  if (!financeOsLooksLikeDemo()) return 0;
  let total = 0;
  for (const t of FINANCE_OS_TABLES) {
    if (!tableExists(t)) continue;
    try {
      const info = getDb().prepare(`DELETE FROM ${t}`).run();
      total += Number(info.changes ?? 0);
    } catch {
      /* ignore missing / FK order issues — tables ordered leaf→root */
    }
  }
  return total;
}

function collectFakeUserIds(): number[] {
  const d = getDb();
  if (!tableExists('users')) return [];
  const rows = d
    .prepare(
      `SELECT id FROM users
       WHERE telegram_id LIKE 'fake_owner_%'
          OR telegram_id IN ('demo_host', 'demo_player')`
    )
    .all() as Array<{ id: number }>;
  return idsOf(rows);
}

function collectTargets() {
  const d = getDb();
  const hrEmployees = d
    .prepare(`SELECT id FROM hr_employees WHERE personnel_code LIKE 'SEED-HR-%'`)
    .all() as Array<{ id: number }>;
  const hrEmpIds = idsOf(hrEmployees);

  const hrCandidates = d
    .prepare(
      `SELECT id FROM hr_candidates
       WHERE mobile IN ('09120001001','09120001002','09120001003','09120001004')
          OR notes LIKE '%نمونه SEED%'`
    )
    .all() as Array<{ id: number }>;

  const adminAccounts = d
    .prepare(`SELECT id FROM admin_accounts WHERE username LIKE 'seed.%'`)
    .all() as Array<{ id: number }>;

  const salesItems = d
    .prepare(`SELECT id FROM sales_items WHERE mobile LIKE '0912SEED%' OR email LIKE '%@seed.petdate.ir'`)
    .all() as Array<{ id: number }>;

  const salesCustomers = d
    .prepare(
      `SELECT id FROM sales_customers
       WHERE mobile LIKE '0912SEED%'
          OR email LIKE '%@seed.petdate.ir'
          OR email LIKE 'seed.customer%@petdate.ir'`
    )
    .all() as Array<{ id: number }>;

  const crmCustomers = d
    .prepare(
      `SELECT id FROM crm_customers
       WHERE mobile IN (
         '09120006001','09120006002','09120006003','09120006004','09120006005','09120006088'
       )`
    )
    .all() as Array<{ id: number }>;

  return {
    hrEmpIds,
    hrCandIds: idsOf(hrCandidates),
    accountIds: idsOf(adminAccounts),
    salesItemIds: idsOf(salesItems),
    salesCustomerIds: idsOf(salesCustomers),
    crmCustomerIds: idsOf(crmCustomers),
    shopOrderIds: collectFakeShopOrderIds(),
    fakeUserIds: collectFakeUserIds(),
  };
}

function previewCounts(): DemoSeedCleanupCounts {
  const d = getDb();
  const t = collectTargets();
  const notif = d
    .prepare(
      `SELECT COUNT(*) as c FROM hr_notifications
       WHERE text LIKE '%SEED-HR%' OR text LIKE '%نمونه SEED%'`
    )
    .get() as { c: number };

  let walletLedger = 0;
  if (tableExists('wallet_ledger')) {
    const seedOnly = Number(
      (d.prepare(`SELECT COUNT(*) as c FROM wallet_ledger WHERE ref_type = 'seed'`).get() as { c: number })
        ?.c ?? 0
    );
    let tied = 0;
    if (t.shopOrderIds.length) {
      const ph = t.shopOrderIds.map(() => '?').join(',');
      tied = Number(
        (
          d
            .prepare(
              `SELECT COUNT(*) as c FROM wallet_ledger
               WHERE ref_type = 'shop_order' AND ref_id IN (${ph})`
            )
            .get(...t.shopOrderIds.map(String)) as { c: number }
        )?.c ?? 0
      );
    }
    const nullShop = Number(
      (
        d
          .prepare(
            `SELECT COUNT(*) as c FROM wallet_ledger
             WHERE user_id IS NULL AND ref_type = 'shop_order' AND reason = 'خرید فروشگاه'`
          )
          .get() as { c: number }
      )?.c ?? 0
    );
    // nullShop overlaps tied when orders match — use max of (seedOnly+tied, seedOnly+nullShop)
    walletLedger = seedOnly + Math.max(tied, nullShop);
  }

  let fakePets = 0;
  if (t.fakeUserIds.length && tableExists('pets')) {
    fakePets = countByIds('pets', 'owner_id', t.fakeUserIds);
  }

  return {
    ...EMPTY_COUNTS,
    hrEmployees: t.hrEmpIds.length,
    hrContracts: countByIds('hr_contracts', 'employee_id', t.hrEmpIds),
    hrLogs: countByIds('hr_employee_logs', 'employee_id', t.hrEmpIds),
    hrOnboarding: countByIds('hr_onboarding_records', 'employee_id', t.hrEmpIds),
    hrCost: countByIds('hr_cost_entries', 'employee_id', t.hrEmpIds),
    hrService: countByIds('hr_service_entries', 'employee_id', t.hrEmpIds),
    hrRequests: countByIds('hr_requests', 'employee_id', t.hrEmpIds),
    hrCandidates: t.hrCandIds.length,
    hrNotifications: Number(notif?.c ?? 0),
    adminAccounts: t.accountIds.length,
    salesItems: t.salesItemIds.length,
    salesActivities: countByIds('sales_activities', 'item_id', t.salesItemIds),
    salesCustomers: t.salesCustomerIds.length,
    salesOrders: countByIds('sales_orders', 'customer_id', t.salesCustomerIds),
    crmCustomers: t.crmCustomerIds.length,
    crmOrders: countByIds('crm_orders', 'customer_id', t.crmCustomerIds),
    crmInteractions: countByIds('crm_interactions', 'customer_id', t.crmCustomerIds),
    crmTickets: countByIds('crm_tickets', 'customer_id', t.crmCustomerIds),
    crmFollowups: countByIds('crm_followups', 'customer_id', t.crmCustomerIds),
    crmComplaints: countByIds('crm_complaints', 'customer_id', t.crmCustomerIds),
    crmReferrals: countByIds('crm_referrals', 'customer_id', t.crmCustomerIds),
    crmSurveys: countByIds('crm_surveys', 'customer_id', t.crmCustomerIds),
    shopOrders: t.shopOrderIds.length,
    walletLedger,
    fakeUsers: t.fakeUserIds.length,
    fakePets,
    financeOsRows: countFinanceOsRows(),
  };
}

export function previewDemoSeedCleanup(): {
  dryRun: true;
  counts: DemoSeedCleanupCounts;
  total: number;
} {
  const counts = previewCounts();
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { dryRun: true, counts, total };
}

export function applyDemoSeedCleanup(): {
  dryRun: false;
  counts: DemoSeedCleanupCounts;
  total: number;
} {
  const d = getDb();
  const planned = previewCounts();
  const t = collectTargets();

  const deleted: DemoSeedCleanupCounts = { ...EMPTY_COUNTS };

  deleted.salesActivities = deleteByIds('sales_activities', 'item_id', t.salesItemIds);
  deleted.salesItems = deleteByIds('sales_items', 'id', t.salesItemIds);
  deleted.salesOrders = deleteByIds('sales_orders', 'customer_id', t.salesCustomerIds);
  deleted.salesCustomers = deleteByIds('sales_customers', 'id', t.salesCustomerIds);

  deleted.crmSurveys = deleteByIds('crm_surveys', 'customer_id', t.crmCustomerIds);
  deleted.crmReferrals = deleteByIds('crm_referrals', 'customer_id', t.crmCustomerIds);
  deleted.crmComplaints = deleteByIds('crm_complaints', 'customer_id', t.crmCustomerIds);
  deleted.crmFollowups = deleteByIds('crm_followups', 'customer_id', t.crmCustomerIds);
  if (t.crmCustomerIds.length) {
    const ticketIds = idsOf(
      d
        .prepare(
          `SELECT id FROM crm_tickets WHERE customer_id IN (${t.crmCustomerIds.map(() => '?').join(',')})`
        )
        .all(...t.crmCustomerIds) as Array<{ id: number }>
    );
    try {
      deleteByIds('crm_ticket_activities', 'ticket_id', ticketIds);
    } catch {
      /* table may be absent on older DBs */
    }
    deleted.crmTickets = deleteByIds('crm_tickets', 'id', ticketIds);
  }
  deleted.crmInteractions = deleteByIds('crm_interactions', 'customer_id', t.crmCustomerIds);
  deleted.crmOrders = deleteByIds('crm_orders', 'customer_id', t.crmCustomerIds);
  deleted.crmCustomers = deleteByIds('crm_customers', 'id', t.crmCustomerIds);

  deleted.hrContracts = deleteByIds('hr_contracts', 'employee_id', t.hrEmpIds);
  deleted.hrLogs = deleteByIds('hr_employee_logs', 'employee_id', t.hrEmpIds);
  deleted.hrOnboarding = deleteByIds('hr_onboarding_records', 'employee_id', t.hrEmpIds);
  deleted.hrCost = deleteByIds('hr_cost_entries', 'employee_id', t.hrEmpIds);
  deleted.hrService = deleteByIds('hr_service_entries', 'employee_id', t.hrEmpIds);
  deleted.hrRequests = deleteByIds('hr_requests', 'employee_id', t.hrEmpIds);
  deleted.hrCandidates = deleteByIds('hr_candidates', 'id', t.hrCandIds);
  const notif = d
    .prepare(
      `DELETE FROM hr_notifications
       WHERE text LIKE '%SEED-HR%' OR text LIKE '%نمونه SEED%'`
    )
    .run();
  deleted.hrNotifications = Number(notif.changes ?? 0);
  deleted.adminAccounts = deleteByIds('admin_accounts', 'id', t.accountIds);
  deleted.hrEmployees = deleteByIds('hr_employees', 'id', t.hrEmpIds);

  // Shop + wallet fake finance KPIs
  if (tableExists('wallet_ledger')) {
    const w1 = d.prepare(`DELETE FROM wallet_ledger WHERE ref_type = 'seed'`).run();
    deleted.walletLedger += Number(w1.changes ?? 0);
    if (t.shopOrderIds.length) {
      const ph = t.shopOrderIds.map(() => '?').join(',');
      const w2 = d
        .prepare(`DELETE FROM wallet_ledger WHERE ref_type = 'shop_order' AND ref_id IN (${ph})`)
        .run(...t.shopOrderIds.map(String));
      deleted.walletLedger += Number(w2.changes ?? 0);
    }
    const w3 = d
      .prepare(
        `DELETE FROM wallet_ledger
         WHERE user_id IS NULL AND ref_type = 'shop_order' AND reason = 'خرید فروشگاه'`
      )
      .run();
    deleted.walletLedger += Number(w3.changes ?? 0);
  }
  deleted.shopOrders = deleteByIds('shop_orders', 'id', t.shopOrderIds);

  // Fake platform users/pets
  if (t.fakeUserIds.length) {
    if (tableExists('pets')) {
      deleted.fakePets = deleteByIds('pets', 'owner_id', t.fakeUserIds);
    }
    deleted.fakeUsers = deleteByIds('users', 'id', t.fakeUserIds);
  }

  deleted.financeOsRows = wipeFinanceOsDemo();

  const total = Object.values(deleted).reduce((s, n) => s + n, 0);
  return { dryRun: false, counts: { ...planned, ...deleted }, total };
}

export function runDemoSeedCleanup(opts: { apply?: boolean } = {}): {
  dryRun: boolean;
  counts: DemoSeedCleanupCounts;
  total: number;
} {
  if (opts.apply) return applyDemoSeedCleanup();
  return previewDemoSeedCleanup();
}
