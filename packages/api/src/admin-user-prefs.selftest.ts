/**
 * Per-admin prefs — isolation, layout serialize, size/key guards.
 * Run: cd packages/api && npx tsx src/admin-user-prefs.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-prefs-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema } = await import('./hr-service');
  const {
    ensureAdminUserPrefsSchema,
    getAdminPref,
    setAdminPref,
    deleteAdminPref,
    actorKeyForPrefs,
    layoutPrefKey,
    assertPrefKey,
  } = await import('./admin-user-prefs');

  ensureHrSchema();
  ensureAdminUserPrefsSchema();

  const admin = {
    kind: 'env_admin' as const,
    role: 'admin',
    permissions: ['admin.full'],
    displayName: 'مدیر سیستم',
    username: 'admin',
  };
  const sales = {
    kind: 'account' as const,
    role: 'sales',
    permissions: ['sales.read'],
    displayName: 'فروشنده',
    username: 'sara.sales',
  };

  assert(actorKeyForPrefs(admin) === 'admin', 'env admin key');
  assert(actorKeyForPrefs(sales) === 'sara.sales', 'account key uses username');
  assert(layoutPrefKey('platform') === 'widget-layout:platform', 'layout key');
  assert(layoutPrefKey('finance-sales') === 'widget-layout:finance-sales', 'dash id kept');
  assert(assertPrefKey('widget-layout:platform') === 'widget-layout:platform', 'valid key');

  let bad = false;
  try {
    assertPrefKey('../etc/passwd');
  } catch {
    bad = true;
  }
  assert(bad, 'rejects path-like keys');

  const board = {
    version: 1,
    removed: ['crmTickets'],
    items: [
      { id: 'dualCalendar', w: 2, h: 2, order: 0 },
      { id: 'dailyNotes', w: 2, h: 2, order: 1 },
    ],
  };

  assert(getAdminPref(admin, layoutPrefKey('platform')) == null, 'empty before set');
  setAdminPref(admin, layoutPrefKey('platform'), board);
  const loaded = getAdminPref(admin, layoutPrefKey('platform')) as typeof board;
  assert(loaded?.version === 1, 'round-trip version');
  assert(loaded.items[0]?.id === 'dualCalendar', 'round-trip calendar');
  assert(loaded.removed.includes('crmTickets'), 'round-trip removed');

  setAdminPref(sales, layoutPrefKey('platform'), {
    version: 1,
    removed: [],
    items: [{ id: 'moduleMix', w: 4, h: 1, order: 0 }],
  });
  const adminAgain = getAdminPref(admin, layoutPrefKey('platform')) as typeof board;
  assert(adminAgain.items[0]?.id === 'dualCalendar', 'prefs isolated by actor');
  const salesBoard = getAdminPref(sales, layoutPrefKey('platform')) as { items: Array<{ w: number }> };
  assert(salesBoard.items[0]?.w === 4, 'other actor has own layout');

  setAdminPref(admin, 'daily-notes', {
    version: 1,
    notes: { '2026-09-12': 'جلسه فروش' },
  });
  const notes = getAdminPref(admin, 'daily-notes') as { notes: Record<string, string> };
  assert(notes.notes['2026-09-12'] === 'جلسه فروش', 'daily notes persist');
  assert(getAdminPref(sales, 'daily-notes') == null, 'notes isolated');

  assert(deleteAdminPref(admin, layoutPrefKey('platform')) === true, 'delete existing');
  assert(getAdminPref(admin, layoutPrefKey('platform')) == null, 'gone after reset');
  assert(deleteAdminPref(admin, layoutPrefKey('platform')) === false, 'delete missing');

  let oversized = false;
  try {
    setAdminPref(admin, 'daily-notes', { pad: 'x'.repeat(70 * 1024) });
  } catch (err) {
    oversized = /حجم/.test((err as Error).message);
  }
  assert(oversized, 'rejects oversized pref');

  console.log('admin-user-prefs.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
