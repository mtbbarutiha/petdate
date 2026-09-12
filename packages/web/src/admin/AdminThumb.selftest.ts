/**
 * AdminThumb must never invent stock pet photos (e.g. cat-in-box EMPTY_STATE_PHOTO).
 * Run: npx tsx packages/web/src/admin/AdminThumb.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const thumb = readFileSync(join(dir, 'AdminThumb.tsx'), 'utf8');
const consults = readFileSync(join(dir, 'pages/AdminConsultsPage.tsx'), 'utf8');

assert.doesNotMatch(thumb, /EMPTY_STATE_PHOTO/, 'AdminThumb must not import stock empty-state pet photo');
assert.doesNotMatch(thumb, /petImages/, 'AdminThumb must not pull bundled pet stock images');
assert.match(thumb, /admin-thumb--empty/, 'missing pet photo shows empty placeholder');
assert.match(
  consults,
  /petImageUrl\?\.trim\(\) \|\| c\.petId != null/,
  'consults pet column skips thumb when no pet linked'
);

console.log('AdminThumb.selftest: ok');
