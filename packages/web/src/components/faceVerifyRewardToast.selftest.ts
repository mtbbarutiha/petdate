/**
 * Web face-verify success toast + profile copy are wired.
 * Run: npx tsx packages/web/src/components/faceVerifyRewardToast.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACE_VERIFY_REWARD } from '@petdate/shared';

assert.equal(FACE_VERIFY_REWARD, 100);

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');
assert.match(app, /FaceVerifyRewardToast/, 'app mounts face-verify toast');

const toast = readFileSync(join(webSrc, 'components/FaceVerifyRewardToast.tsx'), 'utf8');
assert.match(toast, /verify\.approvedToast/, 'toast uses i18n success + coins');
assert.match(toast, /pending/, 'only fires pending → verified');

const profile = readFileSync(join(webSrc, 'pages/ProfilePage.tsx'), 'utf8');
assert.match(profile, /verify\.profileVerified/, 'verified profile mentions reward');

const fa = readFileSync(join(webSrc, 'i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(webSrc, 'i18n/locales/en.ts'), 'utf8');
assert.match(fa, /احراز چهره‌ات تأیید شد — \{n\} سکه دریافت کردی/, 'FA toast copy');
assert.match(en, /Face verification approved — you received \{n\} coins/, 'EN toast copy');

console.log('faceVerifyRewardToast.selftest: ok');
