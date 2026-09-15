/**
 * Run: npx tsx packages/shared/src/entity-public-id.selftest.ts
 */
import {
  consultPublicIdOf,
  ledgerPublicIdOf,
  makeConsultPublicId,
  makeLedgerPublicId,
  makePaymentPublicId,
  makePlaydatePublicId,
  normalizeConsultPublicId,
  normalizeLedgerPublicId,
  normalizePaymentPublicId,
  normalizePlaydatePublicId,
  paymentPublicIdOf,
  playdatePublicIdOf,
} from './petdate';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(makeConsultPublicId(31) === 'PD-C00031', 'consult pad');
assert(consultPublicIdOf({ id: 31 }) === 'PD-C00031', 'consult derive');
assert(consultPublicIdOf({ id: 31, publicId: 'PD-C31' }) === 'PD-C00031', 'consult re-pad');
assert(normalizeConsultPublicId('PD-C42') === 'PD-C00042', 'consult normalize');

assert(makePlaydatePublicId(9) === 'PD-D00009', 'playdate pad');
assert(playdatePublicIdOf({ id: 9 }) === 'PD-D00009', 'playdate derive');
assert(normalizePlaydatePublicId('PD-D7') === 'PD-D00007', 'playdate normalize');

assert(makePaymentPublicId(5) === 'PD-R00005', 'payment pad');
assert(paymentPublicIdOf({ id: 5 }) === 'PD-R00005', 'payment derive');
assert(normalizePaymentPublicId('PD-R99') === 'PD-R00099', 'payment normalize');

assert(makeLedgerPublicId(20) === 'PD-L00020', 'ledger pad');
assert(ledgerPublicIdOf({ id: 18 }) === 'PD-L00018', 'ledger derive');
assert(ledgerPublicIdOf({ id: 18, publicId: 'PD-L18' }) === 'PD-L00018', 'ledger re-pad');
assert(normalizeLedgerPublicId('PD-L42') === 'PD-L00042', 'ledger normalize');
assert(makeLedgerPublicId(20) !== makePaymentPublicId(20), 'PD-L vs PD-R stay distinct');

console.log('entity-public-id.selftest: ok');
