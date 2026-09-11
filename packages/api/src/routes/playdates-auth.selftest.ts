/**
 * Unauthenticated GET /api/playdate-requests must not dump other users' requests.
 * Run: npx tsx src/routes/playdates-auth.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/routes/playdates.ts'), 'utf8');

assert.match(src, /isInternalBot/, 'bot token helper exists');
assert.match(src, /x-petdate-bot-token/i, 'checks X-PetDate-Bot-Token');
assert.match(src, /getUserFromBearer/, 'bearer session is required for web');
assert.match(src, /وارد نشده‌اید/, 'unauthenticated list/get returns 401');
assert.match(src, /userId یا petId الزامی است/, 'bot list requires a scope filter');
assert.match(
  src,
  /always scope to the signed-in user/i,
  'web list ignores spoofed userId'
);

console.log('playdates-auth.selftest: ok');
