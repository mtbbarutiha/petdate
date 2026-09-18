/**
 * Admin batch: refund-once, event edit payload, office delete, mailbox list.
 * Run: cd packages/api && npx tsx src/admin-events-mail-guide.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEventEditPayload } from './admin-event-edit.ts';
import { filterMailboxesForActor, actorSeesAllMailboxes, type AdminMailbox } from './admin-mailboxes.ts';
import { isAlreadyRefunded, refundCredits } from './shop-refund.ts';

const root = dirname(fileURLToPath(import.meta.url));

const parsed = parseEventEditPayload({
  title: 'پت دیتینگ باغ',
  gameType: 'pet_dating',
  hostName: 'پت‌دیت',
  location: 'باغ گیاه‌شناسی',
  province: 'تهران',
  city: 'تهران',
  scheduledAt: '2026-09-21T10:00',
  maxPlayers: 16,
  services: 'سایه',
  description: 'قرار اجتماعی',
  joinFeeCoins: 50,
  photoUrl: '/events/a.jpg',
  photoStatus: 'approved',
  status: 'open',
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.value.title, 'پت دیتینگ باغ');
  assert.equal(parsed.value.gameType, 'pet_dating');
  assert.equal(parsed.value.joinFeeCoins, 50);
  assert.equal(parsed.value.maxPlayers, 16);
  assert.equal(parsed.value.status, 'open');
  assert.equal(parsed.value.hostName, 'پت‌دیت');
  assert.ok(parsed.value.scheduledAt.includes('T'));
}
assert.equal(parseEventEditPayload({ title: '' }).ok, false);

assert.equal(isAlreadyRefunded({ refundedAt: '', ledgerHits: 0 }), false);
assert.equal(isAlreadyRefunded({ refundedAt: '2026-01-01', ledgerHits: 0 }), true);
assert.equal(isAlreadyRefunded({ refundedAt: null, ledgerHits: 1 }), true);
assert.deepEqual(
  refundCredits({ status: 'paid', paymentCurrency: 'coins', paymentAmount: 190, totalToman: 0 }),
  { toman: 0, coins: 190, stars: 0 }
);
assert.deepEqual(
  refundCredits({ status: 'paid', paymentCurrency: 'toman', paymentAmount: 249000, totalToman: 249000 }),
  { toman: 249000, coins: 0, stars: 0 }
);
assert.deepEqual(
  refundCredits({ status: 'pending', paymentCurrency: 'toman', paymentAmount: 0, totalToman: 1000 }),
  { toman: 0, coins: 0, stars: 0 }
);

const boxes: AdminMailbox[] = [
  { address: 'info@petdate.ir', label: 'info', kind: 'system', active: true },
  { address: 'sara@petdate.ir', label: 'سارا', kind: 'personnel', active: true },
  { address: 'ali@petdate.ir', label: 'علی', kind: 'personnel', active: true },
];
const all = filterMailboxesForActor(boxes, { seeAll: true });
assert.equal(all.length, 3);
const staff = filterMailboxesForActor(boxes, { seeAll: false, username: 'sara' });
assert.deepEqual(staff.map((b) => b.address).sort(), ['info@petdate.ir', 'sara@petdate.ir']);
assert.equal(actorSeesAllMailboxes({ role: 'admin', permissions: [] }), true);
assert.equal(actorSeesAllMailboxes({ role: 'support', permissions: ['admin.full'], displayName: 'مدیر سیستم' }), true);
assert.equal(actorSeesAllMailboxes({ role: 'sales', permissions: ['sales.read'] }), false);

const financeRoute = readFileSync(join(root, 'routes/admin-finance-os.ts'), 'utf8');
const financeSvc = readFileSync(join(root, 'finance-os-service.ts'), 'utf8');
assert.match(financeRoute, /delete\('\/allocation\/offices\/:id'/);
assert.match(financeSvc, /function deleteFinanceOsOffice/);

const admin = readFileSync(join(root, 'routes/admin.ts'), 'utf8');
assert.match(admin, /adminRouter\.patch\('\/games\/:id'/);
assert.match(admin, /shop\/orders\/:id\/refund/);
assert.match(admin, /\/mail\/mailboxes/);

console.log('admin-events-mail-guide.selftest: ok');
