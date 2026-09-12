/**
 * Owner consult CTA wiring for no_pet / chats empty state.
 * Run: npx tsx packages/web/src/components/ownerConsult.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const chatPage = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');
const panel = readFileSync(join(dir, 'OwnerConsultPanel.tsx'), 'utf8');
const dark = readFileSync(join(root, 'styles/theme-dark.css'), 'utf8');
const roleSelect = readFileSync(join(root, 'pages/onboarding/RoleSelectPage.tsx'), 'utf8');
const economy = readFileSync(join(root, '../../shared/src/economy.ts'), 'utf8');

assert.match(panel, /مشورت با صاحبین/, 'panel title');
assert.match(panel, /SEEKER_ADVICE_COST/, 'uses shared cost');
assert.match(panel, /kind:\s*'seeker_advice'/, 'quick-connect kind');
assert.match(panel, /shouldShowOwnerConsultCta/, 'exports CTA gate');
assert.match(chatPage, /OwnerConsultPanel/, 'ChatPage imports panel');
assert.match(chatPage, /ownerConsult=\{ownerConsult\}/, 'passes flag to panes');
assert.match(chatPage, /shouldShowOwnerConsultCta/, 'uses CTA gate');
assert.match(economy, /SEEKER_ADVICE_COST = 6/, 'cost is 6');
assert.match(economy, /SEEKER_ADVICE_EARLY_REFUND_MS = 1000/, '1s refund window');
assert.match(dark, /pepito-auth-flow/, 'auth dark overrides present');
assert.match(dark, /role-select-actions/, 'role CTA bar dark override');
assert.match(dark, /wizard-step-rail/, 'wizard rail dark override');
assert.match(roleSelect, /مرحله ۱ از ۳/, 'role select shows progress');
assert.match(roleSelect, /wizard-step-rail/, 'role select step rail');

console.log('ownerConsult.selftest: ok');
