/**
 * Launch wipe: remove all end-users + sales/finance/panel transactional data.
 * KEEP: shop_brands, shop_products (inventory), shop_categories,
 *       admin_accounts / admin_roles, catalog breeds, magazine, settings.
 *
 * Dry-run by default. Destructive with confirm WIPE_PANEL_KEEP_CATALOG.
 */
import { getDb, dbService } from './db';

export const LAUNCH_PANEL_WIPE_CONFIRM = 'WIPE_PANEL_KEEP_CATALOG';

export type LaunchPanelWipeCounts = Record<string, number>;

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

/** Tables to fully empty (order: children before parents where possible). */
const WIPE_TABLES = [
  // Shop transactional (NOT products/brands/categories)
  'shop_carts',
  'shop_orders',
  // Wallet / payments
  'wallet_ledger',
  'coin_ledger',
  'coin_sell_requests',
  'payment_orders',
  // CRM / Sales
  'crm_ticket_activities',
  'crm_tickets',
  'crm_surveys',
  'crm_referrals',
  'crm_complaints',
  'crm_followups',
  'crm_interactions',
  'crm_orders',
  'crm_customers',
  'sales_activities',
  'sales_items',
  'sales_orders',
  'sales_customers',
  'sales_tickets',
  'sales_payments',
  'sales_surveys',
  'sales_messages',
  'sales_goals',
  'pet_purchase_leads',
  // Social / consults / games (user-generated)
  'playdate_chat_tg_refs',
  'playdate_chat_messages',
  'playdate_requests',
  'vet_consult_chat_messages',
  'vet_ratings',
  'vet_consultations',
  'support_messages',
  'support_threads',
  'game_players',
  'games',
  'pet_diary_entries',
  'pet_medical_entries',
  'pet_medical_records',
  'prescriptions',
  'pet_wishlists',
  'user_contacts',
  'user_blocks',
  'inbox_dismissals',
  'web_otps',
  'web_sessions',
  'telegram_attach_tokens',
  'telegram_login_pending',
  'phone_otps',
  // HR demo-ish + operational queues (keep STAFF-* employees separately)
  'hr_notifications',
  'hr_requests',
  'hr_cost_entries',
  'hr_service_entries',
  'hr_onboarding_records',
  'hr_employee_logs',
  'hr_contracts',
  'hr_candidates',
  'hr_timesheets',
] as const;

function tableExists(name: string): boolean {
  try {
    getDb().prepare(`SELECT 1 FROM ${name} LIMIT 1`).get();
    return true;
  } catch {
    return false;
  }
}

function countTable(name: string): number {
  if (!tableExists(name)) return 0;
  try {
    return Number((getDb().prepare(`SELECT COUNT(*) as c FROM ${name}`).get() as { c: number }).c ?? 0);
  } catch {
    return 0;
  }
}

function deleteAll(name: string): number {
  if (!tableExists(name)) return 0;
  try {
    return Number(getDb().prepare(`DELETE FROM ${name}`).run().changes ?? 0);
  } catch (err) {
    console.warn(`[launch-wipe] skip ${name}:`, (err as Error).message);
    return 0;
  }
}

function previewCounts(): LaunchPanelWipeCounts {
  const counts: LaunchPanelWipeCounts = {};
  for (const t of WIPE_TABLES) counts[t] = countTable(t);
  for (const t of FINANCE_OS_TABLES) counts[t] = countTable(t);

  counts.users_active = Number(
    (
      getDb()
        .prepare(
          `SELECT COUNT(*) as c FROM users
           WHERE COALESCE(is_active, 1) = 1
             AND (name IS NULL OR name NOT LIKE '[حذف‌شده%')`
        )
        .get() as { c: number }
    )?.c ?? 0
  );
  counts.pets = countTable('pets');
  counts.hr_employees_non_staff = Number(
    tableExists('hr_employees')
      ? (
          getDb()
            .prepare(
              `SELECT COUNT(*) as c FROM hr_employees
               WHERE personnel_code NOT LIKE 'STAFF-%'`
            )
            .get() as { c: number }
        )?.c ?? 0
      : 0
  );
  counts.admin_seed_accounts = Number(
    tableExists('admin_accounts')
      ? (
          getDb()
            .prepare(`SELECT COUNT(*) as c FROM admin_accounts WHERE username LIKE 'seed.%'`)
            .get() as { c: number }
        )?.c ?? 0
      : 0
  );

  // Kept (for visibility in dry-run)
  counts._keep_shop_products = countTable('shop_products');
  counts._keep_shop_brands = countTable('shop_brands');
  counts._keep_shop_categories = countTable('shop_categories');
  counts._keep_admin_accounts = Number(
    tableExists('admin_accounts')
      ? (
          getDb()
            .prepare(`SELECT COUNT(*) as c FROM admin_accounts WHERE username NOT LIKE 'seed.%'`)
            .get() as { c: number }
        )?.c ?? 0
      : 0
  );
  return counts;
}

function wipeHrNonStaff(): number {
  if (!tableExists('hr_employees')) return 0;
  const rows = getDb()
    .prepare(`SELECT id FROM hr_employees WHERE personnel_code NOT LIKE 'STAFF-%'`)
    .all() as Array<{ id: number }>;
  if (!rows.length) return 0;
  const ids = rows.map((r) => Number(r.id));
  const ph = ids.map(() => '?').join(',');
  for (const rel of [
    'hr_contracts',
    'hr_employee_logs',
    'hr_onboarding_records',
    'hr_cost_entries',
    'hr_service_entries',
    'hr_requests',
  ]) {
    if (!tableExists(rel)) continue;
    try {
      getDb().prepare(`DELETE FROM ${rel} WHERE employee_id IN (${ph})`).run(...ids);
    } catch {
      /* ignore */
    }
  }
  return Number(getDb().prepare(`DELETE FROM hr_employees WHERE id IN (${ph})`).run(...ids).changes ?? 0);
}

function wipeAllUsers(): number {
  const rows = getDb()
    .prepare(
      `SELECT id FROM users
       WHERE name IS NULL OR name NOT LIKE '[حذف‌شده%'`
    )
    .all() as Array<{ id: number }>;
  let n = 0;
  for (const row of rows) {
    try {
      if (dbService.deleteUserById(Number(row.id))) n += 1;
    } catch (err) {
      console.warn(`[launch-wipe] user ${row.id}:`, (err as Error).message);
    }
  }
  // Hard-clear leftover pets if any
  if (tableExists('pets')) {
    try {
      getDb().prepare('DELETE FROM pets').run();
    } catch {
      /* ignore */
    }
  }
  return n;
}

export function previewLaunchPanelWipe(): {
  dryRun: true;
  confirm: string;
  counts: LaunchPanelWipeCounts;
  total: number;
} {
  const counts = previewCounts();
  const total = Object.entries(counts)
    .filter(([k]) => !k.startsWith('_keep_'))
    .reduce((s, [, n]) => s + n, 0);
  return { dryRun: true, confirm: LAUNCH_PANEL_WIPE_CONFIRM, counts, total };
}

export function applyLaunchPanelWipe(): {
  dryRun: false;
  confirm: string;
  counts: LaunchPanelWipeCounts;
  total: number;
} {
  const planned = previewCounts();
  const deleted: LaunchPanelWipeCounts = {};

  // 1) Transactional / panel tables
  for (const t of WIPE_TABLES) {
    deleted[t] = deleteAll(t);
  }
  for (const t of FINANCE_OS_TABLES) {
    deleted[t] = deleteAll(t);
  }

  // 2) HR non-staff + seed admin accounts
  deleted.hr_employees_non_staff = wipeHrNonStaff();
  if (tableExists('admin_accounts')) {
    deleted.admin_seed_accounts = Number(
      getDb().prepare(`DELETE FROM admin_accounts WHERE username LIKE 'seed.%'`).run().changes ?? 0
    );
  }

  // 3) All end-users (admins live in admin_accounts, not users)
  deleted.users_wiped = wipeAllUsers();
  deleted.pets = countTable('pets'); // should be 0 after wipe

  // Preserve keep counts for report
  deleted._keep_shop_products = countTable('shop_products');
  deleted._keep_shop_brands = countTable('shop_brands');
  deleted._keep_shop_categories = countTable('shop_categories');
  deleted._keep_admin_accounts = Number(
    tableExists('admin_accounts')
      ? (
          getDb()
            .prepare(`SELECT COUNT(*) as c FROM admin_accounts WHERE username NOT LIKE 'seed.%'`)
            .get() as { c: number }
        )?.c ?? 0
      : 0
  );

  const total = Object.entries(deleted)
    .filter(([k]) => !k.startsWith('_keep_'))
    .reduce((s, [, n]) => s + n, 0);

  return {
    dryRun: false,
    confirm: LAUNCH_PANEL_WIPE_CONFIRM,
    counts: { ...planned, ...deleted },
    total,
  };
}

export function runLaunchPanelWipe(opts: { apply?: boolean } = {}): {
  dryRun: boolean;
  confirm: string;
  counts: LaunchPanelWipeCounts;
  total: number;
} {
  if (opts.apply) return applyLaunchPanelWipe();
  return previewLaunchPanelWipe();
}
