/**
 * Bot find-playmate asks preferred owner gender (short labels, like web).
 * Run: cd packages/bot && npx tsx src/handlers/explore-owner-gender.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_OWNER_GENDER_FEMALE,
  EXPLORE_OWNER_GENDER_MALE,
  EXPLORE_OWNER_GENDER_TITLE,
  exploreOwnerGenderKeyboard,
} from '../keyboards.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const explore = readFileSync(join(dir, 'explore.ts'), 'utf8');
const index = readFileSync(join(dir, 'index.ts'), 'utf8');
const api = readFileSync(join(dir, '../api-client.ts'), 'utf8');
const fa = readFileSync(
  join(dir, '../../../web/src/i18n/locales/fa.ts'),
  'utf8'
);

assert.equal(EXPLORE_OWNER_GENDER_TITLE, 'صاحب همبازی چه جنسیتی باشد؟');
assert.equal(EXPLORE_OWNER_GENDER_FEMALE, 'همبازی برای پتم با صاحب خانم');
assert.equal(EXPLORE_OWNER_GENDER_MALE, 'همبازی برای پتم با صاحب آقا');
assert.doesNotMatch(EXPLORE_OWNER_GENDER_FEMALE, /دنبال|هستم/);
assert.doesNotMatch(EXPLORE_OWNER_GENDER_MALE, /دنبال|هستم/);

assert.match(
  fa,
  /findOwnerGenderFemale:\s*'همبازی برای پتم با صاحب خانم'/,
  'bot short labels stay aligned with web FA copy'
);
assert.match(
  fa,
  /findOwnerGenderMale:\s*'همبازی برای پتم با صاحب آقا'/,
  'bot short male label stays aligned with web FA copy'
);

const kb = exploreOwnerGenderKeyboard(42);
const payload = JSON.stringify(kb);
assert.match(payload, /explore:gender:female:42/);
assert.match(payload, /explore:gender:male:42/);
assert.match(payload, /همبازی برای پتم با صاحب خانم/);
assert.match(payload, /همبازی برای پتم با صاحب آقا/);
assert.doesNotMatch(payload, /دنبال همبازی برای پتم/);

assert.match(explore, /handleExploreOwnerGender/, 'explore exports gender handler');
assert.match(
  explore,
  /exploreOwnerGenderKeyboard\(petId\)/,
  'pet pick opens gender keyboard before find'
);
assert.match(
  explore,
  /findPlaymates\(\{[\s\S]*ownerGender/,
  'findPlaymates receives ownerGender'
);
assert.match(
  api,
  /ownerGender\?:\s*'female'\s*\|\s*'male'/,
  'api-client accepts ownerGender'
);
assert.match(
  index,
  /explore:gender:\(female\|male\):\(\\d\+\)/,
  'callback routes gender pick'
);
assert.match(index, /handleExploreOwnerGender/, 'index wires gender handler');

console.log('explore-owner-gender.selftest: ok');
