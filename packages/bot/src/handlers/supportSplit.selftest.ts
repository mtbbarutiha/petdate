/**
 * Bot support menu split: ticket wizard + agent chat.
 * Run: npx tsx packages/bot/src/handlers/supportSplit.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const support = readFileSync(join(dir, 'support.ts'), 'utf8');
const index = readFileSync(join(dir, 'index.ts'), 'utf8');

assert.match(support, /handleSupportMenu/, 'menu handler');
assert.match(support, /support:ticket/, 'ticket callback');
assert.match(support, /support:agent/, 'agent callback');
assert.match(support, /ثبت تیکت/, 'ticket label');
assert.match(support, /صحبت با بات پشتیبانی/, 'agent label');
assert.match(support, /لیلا کیانی/, 'agent name');
assert.match(support, /support_ticket_title/, 'ticket title step');
assert.match(support, /createSupportTicketAsTelegram/, 'ticket API');
assert.match(index, /handleSupportMenu/, 'index wires menu');
assert.match(index, /support:ticket/, 'index wires ticket cb');
assert.match(index, /support:agent/, 'index wires agent cb');
assert.match(index, /support_ticket_body/, 'index gates ticket body step');

console.log('supportSplit.selftest (bot): ok');
