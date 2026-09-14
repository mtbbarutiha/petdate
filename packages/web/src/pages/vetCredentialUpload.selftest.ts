/**
 * Vet admission card must upload credentials in-place (not a dead /profile link).
 * Run: npx tsx packages/web/src/pages/vetCredentialUpload.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const vet = readFileSync(join(dir, 'VetConsultPage.tsx'), 'utf8');
const api = readFileSync(join(dir, '../lib/api.ts'), 'utf8');
const auth = readFileSync(join(dir, '../../../api/src/routes/auth.ts'), 'utf8');

assert.match(vet, /uploadProviderCredential/, 'vet desk posts credential via API helper');
assert.match(vet, /uploadProviderCredential\(token, 'vet'/, 'upload kind is vet');
assert.match(vet, /type="file"/, 'admission card has a file picker');
assert.match(vet, /data-testid=\{dualRole \? 'vet-credential-upload-dual' : 'vet-credential-upload'\}/, 'QA hook for vet upload');
assert.match(vet, /accept="image\/\*,application\/pdf"/, 'images and PDF are accepted');
assert.match(vet, /pepito-vet-cred-upload/, 'upload control stays in the credential pill');
assert.doesNotMatch(
  vet,
  /to="\/profile">\{t\('consultDesk\.credUpload'\)\}/,
  'آپلود مدرک must not be a dead /profile link'
);
assert.doesNotMatch(
  vet,
  /if \(vetOnline\)[\s\S]{0,80}onUploadCredential|onUploadCredential[\s\S]{0,80}if \(vetOnline\)/,
  'offline state must not gate credential upload'
);

assert.match(api, /kind: 'trainer' \| 'sitter' \| 'vet'/, 'web client accepts kind=vet');

assert.match(auth, /kindRaw === 'vet'/, 'auth route accepts kind=vet');
assert.match(auth, /submitVetCredential/, 'auth route persists vet credential');
assert.match(auth, /requiredRole = kind === 'vet' \? 'vet' : 'trainer'/, 'vet role is required for vet uploads');

console.log('vetCredentialUpload.selftest: ok');
