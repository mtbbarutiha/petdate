/**
 * Finance OS selftest — SQLite temp DB.
 * Run: cd packages/api && npx tsx src/finance-os.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-finance-os-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const fos = await import('./finance-os-service');
  fos.ensureFinanceOsSchema();

  const accounts = fos.getFinanceOsAccountsBundle();
  assert(accounts.accounts.length >= 4, 'accounts seeded');
  assert(accounts.businesses.some((b) => b.code === 'PD'), 'petdate business');
  assert(accounts.incomeDims.some((d) => d.key === 'نوع فروش'), 'income dims');
  assert(accounts.categoryTree.length >= 3, 'category tree');
  assert(accounts.people.length >= 3, 'people seeded');

  const created = fos.createFinanceOsAccount({
    code: 'B-TEST-01',
    type: 'بانک رسمی',
    provider: 'تست بانک',
    line: 'پت‌دیت',
    openingBalance: 1000,
  });
  assert(created.code === 'B-TEST-01', 'create account');

  const person = fos.createFinanceOsPerson({
    name: 'تست مالی',
    role: 'حسابدار',
    dept: 'مالی',
    line: 'هلدینگ',
    sales: false,
  });
  assert(person.name === 'تست مالی', 'create person');

  const dim = fos.upsertFinanceOsDim('income', 'محصولات', ['اشتراک پت‌دیت', 'محصول تست']);
  assert(dim.items.includes('محصول تست'), 'dim upsert');

  const txBundle = fos.getFinanceOsTransactionsBundle();
  assert(txBundle.queueCount >= 1, 'queue has items');
  assert(txBundle.suspiciousCount >= 1, 'suspicious has items');
  assert(txBundle.ledgerSummary.count >= 1, 'ledger has classified');

  const queued = txBundle.transactions.find((t) => t.status === 'queued' && t.amount > 0);
  assert(queued, 'queued income exists');
  const classified = fos.classifyFinanceOsTransaction(queued!.id, {
    status: 'classified',
    saleType: 'تیم فروش',
    product: 'محصول تست',
    paymentStatus: 'پرداخت کامل',
    line: 'پت‌دیت',
  });
  assert(classified.status === 'classified', 'classified');
  assert(classified.saleType === 'تیم فروش', 'sale type set');

  const imported = fos.importFinanceOsTransactions({
    account: 'G-ZRP-01',
    fileName: 'selftest.csv',
    method: 'manual',
    rows: [
      { date: '2026-08-22', amount: 111000, desc: 'تست ایمپورت' },
      { date: '2026-08-22', amount: -22000, desc: 'تست هزینه' },
    ],
  });
  assert(imported.imported === 2, 'imported 2 rows');

  const sus = fos.getFinanceOsTransactionsBundle({ status: 'suspicious' }).transactions[0];
  assert(sus, 'suspicious row');
  fos.resolveFinanceOsSuspicious(sus.id, 'keep');
  const afterKeep = fos.getFinanceOsTransactionsBundle().transactions.find((t) => t.id === sus.id);
  assert(afterKeep?.status === 'queued', 'suspicious kept -> queued');

  const alloc = fos.getFinanceOsAllocationBundle();
  assert(alloc.offices.length >= 1, 'offices');
  assert(alloc.equipment.length >= 1, 'equipment');
  assert(alloc.pendingAllocationCount >= 1, 'pending alloc');

  const pending = alloc.expenses.find((e) => !e.allocated);
  assert(pending, 'pending expense');
  const abs = Math.abs(pending!.amount);
  const allocated = fos.allocateFinanceOsExpense(pending!.id, [
    { business: 'هایپاد', amount: Math.floor(abs / 2), basis: 'دستی' },
    { business: 'پت‌دیت', amount: abs - Math.floor(abs / 2), basis: 'دستی' },
  ]);
  assert(allocated.allocated, 'expense allocated');
  assert(allocated.splits.length === 2, 'splits');

  const inv = fos.issueFinanceOsInvoice({
    business: 'هایپاد',
    jy: 1405,
    jm: 5,
    lines: [{ desc: pending!.desc, category: pending!.category, amount: allocated.splits[0].amount }],
  });
  assert(inv.number.includes('INV-PD'), 'invoice number');
  assert(inv.total === allocated.splits[0].amount, 'invoice total');

  const balBefore = fos.getFinanceOsAllocationBundle().bankBalance;
  fos.updateFinanceOsBankBalance(balBefore + 5000);
  assert(fos.getFinanceOsAllocationBundle().bankBalance === balBefore + 5000, 'bank balance');

  const counts = fos.getFinanceOsNavCounts();
  assert(typeof counts.queue === 'number', 'nav queue');
  assert(typeof counts.suspicious === 'number', 'nav suspicious');
  assert(typeof counts.pendingAllocation === 'number', 'nav pending');
  assert(typeof counts.payments === 'number', 'nav payments');
  assert(typeof counts.transactions === 'number', 'nav transactions');
  assert(counts.transactions === counts.queue + counts.suspicious, 'transactions = queue+suspicious');

  // Simulate partial #155 scrub failure (desc column renamed → mid-pass abort).
  const { getDb } = await import('./db');
  const d = getDb();
  d.prepare(
    `UPDATE finance_os_invoices SET number = 'INV-SBG-1405-05-99' WHERE id = ?`
  ).run(inv.id);
  d.prepare(
    `UPDATE finance_os_commitments SET desc_text = 'مالیات بر درآمد سالانه SBG' WHERE id = (
       SELECT id FROM finance_os_commitments ORDER BY id LIMIT 1
     )`
  ).run();
  d.prepare(`DELETE FROM finance_os_meta WHERE key LIKE 'sbg_rebrand%'`).run();
  fos.scrubFinanceOsSbgBranding(true);
  const healed = fos.getFinanceOsAllocationBundle();
  assert(
    healed.invoices.every((i) => !String(i.number).includes('SBG')),
    'invoice SBG scrubbed'
  );
  assert(
    healed.commitments.every((c) => !String(c.desc).includes('SBG')),
    'commitment SBG scrubbed'
  );

  console.log('finance-os.selftest: ok');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
