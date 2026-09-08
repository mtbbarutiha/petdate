/**
 * Run: npx tsx packages/shared/src/pet-public-id.selftest.ts
 */
import {
  makePetPublicId,
  normalizePetPublicId,
  parsePetIdFromPublicId,
  petPublicIdOf,
} from './petdate';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(makePetPublicId(25) === 'PD-P00025', 'makePetPublicId pads');
assert(petPublicIdOf({ id: 7 }) === 'PD-P00007', 'derive from id');
assert(petPublicIdOf({ id: 7, publicId: 'PD-P7' }) === 'PD-P00007', 're-pad stored');
assert(petPublicIdOf({ id: 7, publicId: 'p00007' }) === 'PD-P00007', 'normalize bare');
assert(normalizePetPublicId('PD-P42') === 'PD-P00042', 'normalize short PD-P');
assert(normalizePetPublicId('p_00009') === 'PD-P00009', 'normalize p_');
assert(parsePetIdFromPublicId('PD-P00042') === 42, 'parse PD-P');
assert(parsePetIdFromPublicId('p00003') === 3, 'parse bare p');
assert(parsePetIdFromPublicId('nope') === null, 'parse invalid');

console.log('pet-public-id.selftest: ok');
