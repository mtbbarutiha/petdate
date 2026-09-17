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
const fa = readFileSync(join(root, 'i18n/locales/fa.ts'), 'utf8');
const discovery = readFileSync(join(dir, 'ChatDiscoveryBar.tsx'), 'utf8');
const petDiscovery = readFileSync(join(dir, 'PetDiscoveryPanel.tsx'), 'utf8');
const home = readFileSync(join(root, 'pages/HomePage.tsx'), 'utf8');

assert.match(panel, /مشورت با صاحبین/, 'panel title');
assert.match(panel, /SEEKER_ADVICE_COST/, 'uses shared cost');
assert.match(panel, /kind:\s*'seeker_advice'/, 'quick-connect kind');
assert.match(panel, /shouldShowOwnerConsultCta/, 'exports CTA gate');
assert.match(panel, /ownerGender/, 'passes preferred consultant gender');
assert.match(panel, /consultCta/, 'uses gender-pick CTA label');
assert.match(panel, /find-playmate-header-btn/, 'header uses playmate-style CTA (no tg-icon-btn clip)');
assert.doesNotMatch(
  panel,
  /شروع مشورت\s*·/,
  'must not use middle-dot before coin count (looked like ۶۰)'
);
assert.match(chatPage, /OwnerConsultPanel/, 'ChatPage imports panel');
assert.match(chatPage, /ownerConsult=\{ownerConsult\}/, 'passes flag to panes');
assert.match(chatPage, /shouldShowOwnerConsultCta/, 'uses CTA gate');
assert.match(economy, /SEEKER_ADVICE_COST = 5/, 'cost is 5');
assert.match(economy, /SEEKER_OWNER_SHARE = 3/, 'owner share 3');
assert.match(economy, /SEEKER_ADVICE_EARLY_REFUND_MS = 1000/, '1s refund window');
assert.match(fa, /consultCta:\s*'دنبال مشاور هستم'/, 'fa consult CTA');
assert.match(fa, /consultOwnerGenderFemale:\s*'دنبال مشاور خانم هستم'/, 'fa female advisor');
assert.match(fa, /consultOwnerGenderMale:\s*'دنبال مشاور آقا هستم'/, 'fa male advisor');
assert.match(fa, /discoveryOwnersNearby:\s*'مالکین نزدیک من'/, 'fa nearby owners chip');
assert.match(fa, /discoveryOwnersBreed:\s*'مالکین نژاد'/, 'fa breed owners chip');
assert.match(fa, /discoveryOwnersProvince:\s*'هم استان'/, 'fa same province chip');
assert.match(discovery, /audience=\{isNoPet \? 'owners' : 'playmate'\}/, 'no-pet discovery audience');
assert.match(petDiscovery, /audience\?: 'playmate' \| 'owners'/, 'pet discovery audience prop');
assert.match(petDiscovery, /discoveryOwnersNearby/, 'owners nearby label');
assert.match(petDiscovery, /pet-discovery-breed-picker/, 'breed picker for no-pet');
assert.match(petDiscovery, /preferredProviderId/, 'consult targets discovered owner');
assert.match(home, /HERO_IMG_NO_PET = '\/pepito\/uploads\/06-hero\.jpg'/, 'no-pet hero path');
assert.match(dark, /pepito-auth-flow/, 'auth dark overrides present');
assert.match(dark, /role-select-actions/, 'role CTA bar dark override');
assert.match(dark, /wizard-step-rail/, 'wizard rail dark override');
assert.match(roleSelect, /مرحله ۱ از ۳/, 'role select shows progress');
assert.match(roleSelect, /wizard-step-rail/, 'role select step rail');

console.log('ownerConsult.selftest: ok');
