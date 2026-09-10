/**
 * Sales CRM MVP selftest — SQLite temp DB.
 * Run: cd packages/api && npx tsx src/sales-crm.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-sales-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const sales = await import('./sales-service');
  ensureHrSchema();
  sales.ensureSalesSchema();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');
  assert(sales.isSalesAdmin(admin!), 'admin is sales admin');

  const products = sales.listSalesProducts({ activeOnly: true });
  assert(products.length >= 1, 'products seeded');

  const lead = sales.createSalesItem(
    { kind: 'lead', first: 'آوا', last: 'تست', mobile: '09120000000', product: products[0].name, source: 'تلگرام' },
    admin!
  );
  assert(lead.stage === 0, 'new lead stage 0');

  // cannot mark won directly via advance past 6
  let cur = lead;
  for (let i = 0; i < 6; i++) cur = sales.advanceSalesStage(cur.id, admin!);
  assert(cur.stage === 6, 'stage 6 awaiting payment');
  let blocked = false;
  try { sales.advanceSalesStage(cur.id, admin!); } catch { blocked = true; }
  assert(blocked, 'cannot advance to won without finance');

  const payment = sales.sendPaymentLink({ refId: cur.id }, admin!);
  sales.sendFinanceInquiry(payment.id, admin!);
  const decided = sales.financeDecide(payment.id, true, admin!);
  assert(decided.item?.stage === 7, 'won after finance approve');
  assert(decided.item?.customerId, 'customer created');

  const customers = sales.listSalesCustomers();
  assert(customers.total >= 1, 'customer exists');
  const upgrades = sales.listSalesItems({ kind: 'upgrade' });
  assert(upgrades.total >= 1, 'auto upgrade created');

  const lost = sales.createSalesItem({ kind: 'lead', first: 'ب', mobile: '09121111111' }, admin!);
  let lostBlocked = false;
  try { sales.markSalesLost(lost.id, '', admin!); } catch { lostBlocked = true; }
  assert(lostBlocked, 'lost requires reason');
  sales.markSalesLost(lost.id, 'قیمت', admin!);

  const dash = sales.getSalesDashboard(admin!);
  assert(typeof dash.activeLeads === 'number', 'dashboard ok');

  console.log('sales-crm.selftest: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
