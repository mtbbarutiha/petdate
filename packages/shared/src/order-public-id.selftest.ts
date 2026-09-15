/**
 * Run: npx tsx packages/shared/src/order-public-id.selftest.ts
 */
import {
  makeOrderPublicId,
  makePaymentPublicId,
  normalizeOrderPublicId,
  orderPublicIdOf,
  parseOrderIdFromPublicId,
  paymentPublicIdOf,
} from './petdate';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(makeOrderPublicId(54) === 'PD-O00054', 'shop order #54 → PD-O00054');
assert(makeOrderPublicId(48) === 'PD-O00048', 'makeOrderPublicId pads');
assert(orderPublicIdOf({ id: 7 }) === 'PD-O00007', 'derive from id');
assert(orderPublicIdOf({ id: 7, publicId: 'PD-O7' }) === 'PD-O00007', 're-pad stored');
assert(orderPublicIdOf({ id: 7, publicId: 'o00007' }) === 'PD-O00007', 'normalize bare');
assert(normalizeOrderPublicId('PD-O42') === 'PD-O00042', 'normalize short PD-O');
assert(normalizeOrderPublicId('o_00009') === 'PD-O00009', 'normalize o_');
assert(parseOrderIdFromPublicId('PD-O00042') === 42, 'parse PD-O');
assert(parseOrderIdFromPublicId('o00003') === 3, 'parse bare o');
assert(parseOrderIdFromPublicId('nope') === null, 'parse invalid');
assert(parseOrderIdFromPublicId('PD-U00001') === null, 'reject user prefix');
assert(makePaymentPublicId(54) === 'PD-R00054', 'payment invoice separate from shop order');
assert(paymentPublicIdOf({ id: 12 }) === 'PD-R00012', 'payment public id of');
assert(makeOrderPublicId(54) !== makePaymentPublicId(54), 'PD-O vs PD-R stay distinct');

console.log('order-public-id.selftest: ok');
