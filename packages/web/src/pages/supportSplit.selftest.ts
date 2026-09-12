/**
 * Support hub split: chooser → ticket + agent chat routes.
 * Run: npx tsx packages/web/src/pages/supportSplit.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'App.tsx'), 'utf8');
const hub = readFileSync(join(root, 'pages/SupportHubPage.tsx'), 'utf8');
const ticket = readFileSync(join(root, 'pages/SupportTicketPage.tsx'), 'utf8');
const chat = readFileSync(join(root, 'pages/SupportChatPage.tsx'), 'utf8');
const agent = readFileSync(join(root, 'pages/supportAgent.ts'), 'utf8');

assert.match(app, /SupportHubPage/, 'hub page registered');
assert.match(app, /path="support"/, 'support hub route');
assert.match(app, /path="support\/ticket"/, 'ticket route');
assert.match(app, /path="support\/chat"/, 'agent chat route');
assert.match(hub, /ثبت تیکت/, 'hub ticket CTA');
assert.match(hub, /صحبت با بات پشتیبانی/, 'hub agent CTA');
assert.match(hub, /\/support\/ticket/, 'hub links ticket');
assert.match(hub, /\/support\/chat/, 'hub links chat');
assert.match(ticket, /createSupportTicket/, 'ticket page posts ticket');
assert.match(chat, /لیلا کیانی|AI_ASSISTANT_DISPLAY_NAME/, 'chat uses support agent name');
assert.match(agent, /لیلا کیانی/, 'canonical agent name');

console.log('supportSplit.selftest: ok');
