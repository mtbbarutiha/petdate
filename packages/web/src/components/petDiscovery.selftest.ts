/**
 * Pet discovery chips (nearby / same-breed / same-province) — people list + send request.
 * Run: npx tsx packages/web/src/components/petDiscovery.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleFromDiscoveryPets } from '../lib/petDiscoveryPeople.ts';
import type { PetProfile } from '@petdate/shared';

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, 'PetDiscoveryPanel.tsx'), 'utf8');
const find = readFileSync(join(here, 'FindPlaymatePanel.tsx'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');
const actions = readFileSync(join(here, '../lib/playmateActions.ts'), 'utf8');
const peopleLib = readFileSync(join(here, '../lib/petDiscoveryPeople.ts'), 'utf8');
const fa = readFileSync(join(here, '../i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(here, '../i18n/locales/en.ts'), 'utf8');
const ci = readFileSync(join(here, '../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(panel, /pet-discovery-\$\{id\}/, 'discovery chip test ids');
assert.match(panel, /id: 'nearby'/, 'nearby chip');
assert.match(panel, /id: 'samebreed'/, 'same-breed chip');
assert.match(panel, /id: 'sameprovince'/, 'same-province chip');
assert.match(panel, /id: 'contacts'/, 'contacts chip');
assert.match(panel, /listUserContacts/, 'calls contacts API');
assert.match(panel, /pet-discovery-contacts/, 'contacts list test id');
assert.match(panel, /onOpenContact/, 'opens existing chat from contact');
assert.match(panel, /listNearbyPets/, 'calls nearby API');
assert.match(panel, /getCurrentPosition/, 'nearby calls navigator.geolocation.getCurrentPosition');
assert.match(panel, /permissions\.query/, 'reads Permissions API state');
assert.match(panel, /requestCurrentPosition\(\)/, 'starts the browser prompt in the click turn');
assert.match(panel, /discoveryGeoAllow/, 'allow button is the retry control');
assert.match(panel, /pet-discovery-geo-allow/, 'geo allow button test id');
assert.match(panel, /pet-discovery-geo-ask/, 'geo ask region test id');
assert.doesNotMatch(panel, /discoveryGeoDenied/, 'does not render the red location-denied copy');
assert.match(panel, /peopleFromDiscoveryPets/, 'dedupes to people');
assert.match(panel, /sendPlaymateRequestNow/, 'wires real playmate request');
assert.match(panel, /discoverySendRequest/, 'send-request CTA i18n');
assert.match(panel, /pet-discovery-people/, 'people list test id');
assert.match(panel, /pet-discovery-loading/, 'loading state test id');
assert.match(panel, /pet-discovery-empty/, 'empty state test id');
assert.match(panel, /pet-discovery-fee-confirm/, 'fee confirm modal');
assert.match(peopleLib, /export function peopleFromDiscoveryPets/, 'people helper exported');
assert.match(api, /export async function listNearbyPets/, 'listNearbyPets exported');
assert.match(api, /export async function listUserContacts/, 'listUserContacts exported');
assert.match(api, /province/, 'listPets supports province');
assert.match(api, /breeds/, 'listPets supports breeds');
assert.match(api, /export async function createPlaydateRequest/, 'createPlaydateRequest exported');
assert.match(actions, /createPlaydateRequest/, 'sendPlaymateRequestNow uses createPlaydateRequest');
assert.match(find, /PetDiscoveryPanel/, 'wired into find-playmate panel');
assert.match(find, /onSent=\{onSent\}/, 'discovery onSent refreshes inbox');
assert.match(find, /onOpenContact/, 'find panel forwards contact open');
assert.match(panel, /variant\?: 'panel' \| 'bar'/, 'panel supports compact bar variant');
assert.match(panel, /pepito-pet-discovery--bar/, 'bar class for mobile chat header chips');
assert.match(fa, /discoveryNearby:\s*'پت‌های نزدیک من'/, 'fa nearby label');
assert.match(fa, /discoverySameBreed:\s*'هم‌نژاد'/, 'fa same-breed label');
assert.match(fa, /discoverySameProvince:\s*'هم‌استان'/, 'fa same-province label');
assert.match(fa, /discoveryContacts:\s*'لیست مخاطبین'/, 'fa contacts label');
assert.match(fa, /discoveryOpenChat:\s*'باز کردن گفتگو'/, 'fa open-chat CTA');
assert.match(fa, /discoverySendRequest:\s*'ارسال درخواست'/, 'fa send request CTA');
assert.match(fa, /discoveryNearbyCount:\s*'\{n\} نفر/, 'fa people count nearby');
assert.match(fa, /discoveryGeoAllow:\s*'اجازه دسترسی به موقعیت'/, 'fa location allow button');
assert.match(en, /discoveryGeoAllow:\s*'Allow location access'/, 'en location allow button');
assert.match(fa, /discoveryGeoAsk:/, 'fa asks for location instead of erroring first');
assert.doesNotMatch(panel, /toastError\(msg\)[\s\S]{0,80}discoveryGeo/, 'geo denial is not toasted as an error');
assert.match(en, /discoverySendRequest:\s*'Send request'/, 'en send request CTA');
assert.match(en, /discoveryContacts:\s*'Contacts'/, 'en contacts label');
assert.match(panel, /audience\?: 'playmate' \| 'owners'/, 'panel supports owners audience');
assert.match(panel, /discoveryOwnersNearby/, 'no-pet nearby owners label');
assert.match(panel, /pet-discovery-breed-picker/, 'no-pet breed picker');
assert.match(panel, /preferredProviderId/, 'owners consult targets provider');
assert.match(fa, /discoveryOwnersNearby:\s*'مالکین نزدیک من'/, 'fa nearby owners');
assert.match(fa, /discoveryOwnersBreed:\s*'مالکین نژاد'/, 'fa breed owners');
assert.match(fa, /discoveryOwnersProvince:\s*'هم استان'/, 'fa same province owners');
assert.match(ci, /petDiscovery\.selftest/, 'CI runs pet discovery selftest');
assert.match(ci, /ownerConsult\.selftest/, 'CI runs owner consult selftest');

function stubPet(partial: Partial<PetProfile> & Pick<PetProfile, 'id' | 'ownerId' | 'name'>): PetProfile {
  return {
    species: 'dog',
    vaccinated: false,
    neutered: false,
    lookingForPlaymate: true,
    personality: {},
    health: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

const people = peopleFromDiscoveryPets([
  stubPet({ id: 1, ownerId: 10, name: 'Jimy', ownerName: 'Ali', breed: 'Husky' }),
  stubPet({ id: 2, ownerId: 10, name: 'Max', ownerName: 'Ali', breed: 'Mix' }),
  stubPet({ id: 3, ownerId: 11, name: 'لوسی', ownerName: 'Sara', breed: 'Mix' }),
  stubPet({ id: 4, ownerId: 12, name: 'Deni' }),
]);
assert.equal(people.length, 3, 'one row per owner');
assert.equal(people[0]!.ownerName, 'Ali');
assert.equal(people[0]!.pet.name, 'Jimy', 'first pet wins per owner');
assert.equal(people[1]!.ownerName, 'Sara');
assert.equal(people[2]!.ownerName, 'صاحب پت', 'fallback owner label');

const withPhoto = peopleFromDiscoveryPets([
  stubPet({
    id: 5,
    ownerId: 13,
    name: 'beni',
    ownerName: 'sarvenazgh',
    ownerAvatarUrl: '/api/auth/avatar/13/face.jpg',
  }),
]);
assert.equal(withPhoto[0]!.ownerAvatarUrl, '/api/auth/avatar/13/face.jpg', 'keeps a real owner photo');

const stockFace = peopleFromDiscoveryPets([
  stubPet({
    id: 6,
    ownerId: 14,
    name: 'میلی',
    ownerName: 'Mohammad',
    ownerAvatarUrl: '/images/defaults/avatar-female.jpg',
  }),
]);
assert.equal(stockFace[0]!.ownerAvatarUrl, undefined, 'shared gender stock is not an owner photo');

console.log('petDiscovery.selftest: ok');
