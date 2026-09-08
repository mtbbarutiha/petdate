/**
 * Run: npx tsx packages/shared/src/user-command-id.selftest.ts
 */
import {
  makeUserPublicId,
  normalizeUserPublicId,
  parseUserIdFromCommand,
  toUserCommandId,
  userCommandIdOf,
  userPublicIdOf,
} from './petdate';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(userCommandIdOf({ id: 42 }) === '/u00042', 'userCommandIdOf 42');
assert(toUserCommandId('PD-U00042') === '/u00042', 'toUserCommandId PD');
assert(toUserCommandId('/u00042@Petdatebot') === '/u00042', 'toUserCommandId bot');
assert(parseUserIdFromCommand('/u00042') === 42, 'parse /u');
assert(parseUserIdFromCommand('u_00042') === 42, 'parse u_');
assert(parseUserIdFromCommand(makeUserPublicId(7)) === 7, 'parse PD');
assert(parseUserIdFromCommand('/user_PD-U00007') === 7, 'parse legacy');

assert(userPublicIdOf({ id: 38 }) === 'PD-U00038', 'display from id');
assert(userPublicIdOf({ id: 38, publicId: '/u00038' }) === 'PD-U00038', 'legacy /u → PD-U');
assert(userPublicIdOf({ id: 38, publicId: 'PD-U38' }) === 'PD-U00038', 're-pad PD-U');
assert(normalizeUserPublicId('u00038') === 'PD-U00038', 'normalize bare token');
assert(userCommandIdOf({ id: 38, publicId: 'PD-U00038' }) === '/u00038', 'command from public');

console.log('user-command-id.selftest: ok');
