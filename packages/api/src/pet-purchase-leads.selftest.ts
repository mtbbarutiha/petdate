/**
 * Pet-purchase lead CTA selftest — temp SQLite.
 * Run: cd packages/api && npx tsx src/pet-purchase-leads.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-pet-purchase-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { ensureHrSchema, resolveAdminActor } = await import('./hr-service');
  const { ensureSalesSchema, getSalesItem, getSalesNavCounts } = await import('./sales-service');
  const ppl = await import('./pet-purchase-leads');
  const { PET_PURCHASE_PRODUCT_NAME } = await import('@petdate/shared');

  ensureHrSchema();
  ensureSalesSchema();
  ppl.ensurePetPurchaseLeadsSchema();

  const admin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(admin, 'admin actor');

  let bad = false;
  try {
    ppl.submitPetPurchaseLead({ firstName: 'آوا', lastName: 'تست', mobile: '02188776655' });
  } catch {
    bad = true;
  }
  assert(bad, 'rejects landline / invalid mobile');

  const lead = ppl.submitPetPurchaseLead({
    firstName: 'آوا',
    lastName: 'خریدار',
    mobile: '09121234567',
    sourcePage: '/adoption',
  });
  assert(lead.status === 'جدید', 'status جدید');
  assert(lead.publicId.startsWith('PP-'), 'public id');
  assert(lead.salesItemId != null, 'sales item linked');
  assert(lead.mobile === '09121234567' || lead.mobile.includes('912'), 'mobile normalized');

  const salesItem = getSalesItem(lead.salesItemId!);
  assert(salesItem, 'sales item exists');
  assert(salesItem!.product === PET_PURCHASE_PRODUCT_NAME, 'product name');
  assert(salesItem!.ownerId == null, 'unassigned for sales team');
  assert(salesItem!.source === 'وبسایت', 'source website');

  const listed = ppl.listPetPurchaseLeads();
  assert(listed.total >= 1, 'list has items');
  assert(ppl.countOpenPetPurchaseLeads() >= 1, 'open count');

  const claimed = ppl.claimPetPurchaseLead(lead.id, admin!);
  assert(claimed.status === 'در حال پیگیری', 'claimed → در حال پیگیری');
  assert(claimed.assigneeId, 'assignee set');
  const claimedSales = getSalesItem(lead.salesItemId!);
  assert(claimedSales?.ownerId, 'sales item claimed');

  const closed = ppl.updatePetPurchaseLeadStatus(lead.id, 'بسته', admin!);
  assert(closed.status === 'بسته', 'closed');

  const counts = getSalesNavCounts();
  assert(typeof counts.petPurchaseRequests === 'number', 'nav badge field');

  console.log('pet-purchase-leads.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
