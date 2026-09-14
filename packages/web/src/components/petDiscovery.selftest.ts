/**
 * Pet discovery chips (nearby / same-breed / same-province) — bot parity on web.
 * Run: npx tsx packages/web/src/components/petDiscovery.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, 'PetDiscoveryPanel.tsx'), 'utf8');
const find = readFileSync(join(here, 'FindPlaymatePanel.tsx'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');
const fa = readFileSync(join(here, '../i18n/locales/fa.ts'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(panel, /pet-discovery-\$\{id\}/, 'discovery chip test ids');
assert.match(panel, /id: 'nearby'/, 'nearby chip');
assert.match(panel, /id: 'samebreed'/, 'same-breed chip');
assert.match(panel, /id: 'sameprovince'/, 'same-province chip');
assert.match(panel, /listNearbyPets/, 'calls nearby API');
assert.match(api, /export async function listNearbyPets/, 'listNearbyPets exported');
assert.match(api, /province/, 'listPets supports province');
assert.match(api, /breeds/, 'listPets supports breeds');
assert.match(find, /PetDiscoveryPanel/, 'wired into find-playmate panel');
assert.match(fa, /discoveryNearby:\s*'پت‌های نزدیک من'/, 'fa nearby label');
assert.match(fa, /discoverySameBreed:\s*'هم‌نژاد'/, 'fa same-breed label');
assert.match(fa, /discoverySameProvince:\s*'هم‌استان'/, 'fa same-province label');
assert.match(ci, /petDiscovery\.selftest/, 'CI runs pet discovery selftest');

console.log('petDiscovery.selftest: ok');
