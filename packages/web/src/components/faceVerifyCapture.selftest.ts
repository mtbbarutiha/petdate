/**
 * Web face-verify panel records selfie video via camera (MediaRecorder) and
 * requires a profile photo before submit.
 * Run: npx tsx packages/web/src/components/faceVerifyCapture.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const capture = fs.readFileSync(path.join(here, 'FaceVerifyCapture.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(here, '../pages/ProfilePage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(here, '../lib/api.ts'), 'utf8');
const auth = fs.readFileSync(
  path.resolve(here, '../../../api/src/routes/auth.ts'),
  'utf8'
);

assert.match(capture, /getUserMedia/, 'opens live camera');
assert.match(capture, /facingMode:\s*\{\s*ideal:\s*'user'\s*\}/, 'prefers front camera');
assert.match(capture, /MediaRecorder/, 'records with MediaRecorder');
assert.match(capture, /FACE_VERIFY_MAX_SECONDS/, 'caps short selfie length');
assert.match(capture, /accept="video\/\*/, 'file fallback accepts video');
assert.match(capture, /mediaPermissionErrorMessage/, 'shows FA camera permission errors');
assert.match(capture, /hasProfilePhoto/, 'gates on profile photo');
assert.match(capture, /chatMediaRecorder/, 'reuses chat recorder helpers');

assert.match(profile, /FaceVerifyCapture/, 'profile verify panel mounts capture UI');
assert.match(profile, /isStoredCustomProfilePhoto/, 'checks custom profile photo');
assert.doesNotMatch(profile, /useAvatar:\s*true/, 'no longer submits avatar as KYC shortcut');
assert.doesNotMatch(
  profile,
  /accept="image\/\*/,
  'verify panel no longer image-only file picker'
);

assert.match(api, /ویدیوی سلفی/, 'api client requires selfie video');
assert.doesNotMatch(
  api,
  /JSON\.stringify\(\{\s*photoUrl/,
  'web client no longer posts photoUrl-only verify'
);

assert.match(auth, /saveFaceVerifyMedia/, 'server stores video/image verify media');
assert.match(auth, /video_required/, 'rejects non-video web shortcuts');
assert.match(auth, /no_profile_photo/, 'rejects when profile photo missing');

console.log('faceVerifyCapture.selftest: ok');
