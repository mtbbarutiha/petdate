/**
 * Owner-panel pending-photo banner wiring.
 * Run: npx tsx packages/web/src/components/photoPendingBanner.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const banner = readFileSync(join(root, 'components/PhotoPendingBanner.tsx'), 'utf8');
const layout = readFileSync(join(root, 'components/Layout.tsx'), 'utf8');
const pets = readFileSync(join(root, 'pages/MyPetsPage.tsx'), 'utf8');
const profile = readFileSync(join(root, 'pages/ProfilePage.tsx'), 'utf8');
const publicPet = readFileSync(join(root, 'pages/PublicPetPage.tsx'), 'utf8');
const petDetail = readFileSync(join(root, 'pages/PetDetailPage.tsx'), 'utf8');
const guard = readFileSync(join(root, 'components/OnboardingGuard.tsx'), 'utf8');
const fa = readFileSync(join(root, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(root, 'i18n/locales/en.ts'), 'utf8');

assert.match(banner, /PhotoPendingBanner/, 'banner component');
assert.match(banner, /pendingPhotoApprovalMessage/, 'uses shared FA/EN copy');
assert.match(layout, /PhotoPendingBanner/, 'owner panel layout shows banner');
assert.match(pets, /moderation\.chipPending/, 'my-pets shows pending chip');
assert.match(profile, /در انتظار تأیید ادمین/, 'profile pending copy');
assert.match(publicPet, /moderation\.bannerPet/, 'public pet surface');
assert.match(petDetail, /moderation\.bannerPet/, 'owner pet profile surface');
assert.doesNotMatch(
  guard,
  /Navigate to="\/onboarding\/pet"/,
  'incomplete pet registration must not redirect away from features'
);
assert.match(fa, /moderation:/, 'FA moderation keys');
assert.match(en, /moderation:/, 'EN moderation keys');
assert.match(fa, /در انتظار تأیید ادمین/, 'FA pending copy');
assert.match(en, /awaiting admin approval/, 'EN pending copy');

console.log('photoPendingBanner.selftest: ok');
