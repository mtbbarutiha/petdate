/**
 * Run: npx tsx packages/shared/src/entity-public-id.selftest.ts
 */
import {
  consultPublicIdOf,
  makeConsultPublicId,
  makePaymentPublicId,
  makePlaydatePublicId,
  normalizeConsultPublicId,
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

console.log('entity-public-id.selftest: ok');
