/**
 * Bot raw fetch helpers must send X-PetDate-Bot-Token.
 * Run: npx tsx src/api-client-bot-headers.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src/api-client.ts'), 'utf8');

assert.match(src, /function botHeaders/, 'botHeaders helper exists');
assert.match(src, /X-PetDate-Bot-Token/, 'bot token header is set');
assert.match(src, /quick-connect[\s\S]{0,200}botHeaders\(\)/, 'quickVetConnect sends bot token');
assert.match(src, /payments\/\$\{orderId\}\/approve[\s\S]{0,120}botHeaders\(\)/, 'approve sends bot token');
assert.match(src, /payments\/\$\{orderId\}\/reject[\s\S]{0,120}botHeaders\(\)/, 'reject sends bot token');

console.log('api-client-bot-headers.selftest: ok');
