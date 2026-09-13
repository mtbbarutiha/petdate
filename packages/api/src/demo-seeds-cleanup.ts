/**
 * Safe cleanup of known HR/CRM/Sales demo-seed rows only.
 * Dry-run by default. Never deletes production-looking users/pets/roles.
 */
import { getDb } from './db';

export const DEMO_SEED_PURGE_CONFIRM = 'DELETE_DEMO_SEEDS';

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
