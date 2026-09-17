/**
 * Bot seeker-advice asks preferred consultant gender before charging.
 * Run: cd packages/bot && npx tsx src/handlers/seeker-advice-gender.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEEKER_ADVICE_GENDER_FEMALE,
  SEEKER_ADVICE_GENDER_MALE,
} from '../keyboards.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const marketplace = readFileSync(join(dir, 'marketplace.ts'), 'utf8');
const index = readFileSync(join(dir, 'index.ts'), 'utf8');
const api = readFileSync(join(dir, '../api-client.ts'), 'utf8');
const economy = readFileSync(join(dir, '../../../shared/src/economy.ts'), 'utf8');
const fa = readFileSync(join(dir, '../../../web/src/i18n/locales/fa.ts'), 'utf8');

assert.equal(SEEKER_ADVICE_GENDER_FEMALE, 'دنبال مشاور خانم هستم');
assert.equal(SEEKER_ADVICE_GENDER_MALE, 'دنبال مشاور آقا هستم');
assert.match(economy, /SEEKER_ADVICE_COST = 5/, 'shared cost is 5');
assert.match(
  fa,
  /consultOwnerGenderFemale:\s*'دنبال مشاور خانم هستم'/,
  'bot labels align with web FA'
);
assert.match(
  fa,
  /consultOwnerGenderMale:\s*'دنبال مشاور آقا هستم'/,
  'bot male label aligns with web FA'
);

assert.match(marketplace, /handleSeekerAdviceGender/, 'exports gender handler');
assert.match(marketplace, /seeker:gender:female/, 'female callback');
assert.match(marketplace, /seeker:gender:male/, 'male callback');
assert.match(
  marketplace,
  /runQuickConnect\(ctx, 'seeker_advice'[\s\S]*ownerGender/,
  'quick connect receives ownerGender'
);
assert.match(
  api,
  /ownerGender\?:\s*'female'\s*\|\s*'male'/,
  'api-client accepts ownerGender'
);
assert.match(index, /seeker:gender:\(female\|male\)/, 'callback routes gender pick');
assert.match(index, /handleSeekerAdviceGender/, 'index wires gender handler');

console.log('seeker-advice-gender.selftest: ok');
