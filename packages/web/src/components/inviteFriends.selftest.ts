/**
 * Invite card + landing must use the live /invite + API stats path.
 * Run: npx tsx packages/web/src/components/inviteFriends.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const card = readFileSync(join(webSrc, 'components/InviteFriendsCard.tsx'), 'utf8');
const page = readFileSync(join(webSrc, 'pages/InvitePage.tsx'), 'utf8');
const api = readFileSync(join(webSrc, 'lib/api.ts'), 'utf8');
const auth = readFileSync(join(webSrc, 'data/authStore.ts'), 'utf8');

assert.match(card, /inviteWebLink/, 'card copies the web /invite link');
assert.match(card, /fetchReferralStats/, 'card loads live invite stats');
assert.match(card, /invite-friends-stats/, 'stats are testable');
assert.match(page, /persistReferralRef/, 'landing stores ref for later signup');
assert.match(page, /inviteTelegramLink/, 'guest can continue in the bot');
assert.match(page, /loginPath\('\/home'\)/, 'web signup uses login');
assert.match(api, /\/api\/auth\/referral/, 'stats endpoint wired');
assert.match(api, /\/api\/auth\/referral\/claim/, 'claim endpoint wired');
assert.match(auth, /claimStoredReferral/, 'login claims stored ref');
assert.match(auth, /readStoredReferralRef/, 'OTP verify sends stored ref');

console.log('inviteFriends.selftest: ok');
