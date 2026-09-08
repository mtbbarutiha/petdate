/**
 * Run: npx tsx packages/shared/src/user-command-id.selftest.ts
 */
import {
  makeUserPublicId,
  parseUserIdFromCommand,
  toUserCommandId,
  userCommandIdOf,
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

console.log('user-command-id.selftest: ok');
