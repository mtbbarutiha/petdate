/**
 * Selftest: resolve playdate notify photos without hitting Telegram.
 * Relative `/api/pets/photos/...` must not be passed as bare photo URLs
 * (Telegram: "invalid file HTTP URL specified: URL host is empty").
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PetProfile } from '@petdate/shared';
import {
  petPhotoStorageKeyFromUrl,
  resolvePlaydateNotifyPhoto,
} from './telegram-playdate-notify';

const prevDb = process.env.DATABASE_PATH;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-playdate-notify-'));
const tmpDb = path.join(tmpRoot, 'petdate.db');
process.env.DATABASE_PATH = tmpDb;

const photoDir = path.join(tmpRoot, 'pet-photos', '38');
fs.mkdirSync(photoDir, { recursive: true });
const fileName = '1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg';
fs.writeFileSync(path.join(photoDir, fileName), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

function pet(partial: Partial<PetProfile> & Pick<PetProfile, 'id' | 'name' | 'species'>): PetProfile {
  return {
    ownerId: 1,
    vaccinated: true,
    neutered: false,
    lookingForPlaymate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  } as PetProfile;
}

assert.equal(
  petPhotoStorageKeyFromUrl('/api/pets/photos/38/1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg'),
  '38/1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg'
);
assert.equal(petPhotoStorageKeyFromUrl('https://example.com/x.jpg'), null);
assert.equal(petPhotoStorageKeyFromUrl('AgACAgQAAxkBAAI'), null);

const local = resolvePlaydateNotifyPhoto(
  pet({
    id: 35,
    name: 'Teddy',
    species: 'dog',
    imageUrl: '/api/pets/photos/38/1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg',
  })
);
assert.equal(local.kind, 'upload');
if (local.kind === 'upload') {
  assert.ok(local.buffer.length > 0);
  assert.match(local.filename, /\.jpg$/i);
}

const https = resolvePlaydateNotifyPhoto(
  pet({
    id: 1,
    name: 'Bella',
    species: 'dog',
    imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
  })
);
assert.equal(https.kind, 'ref');
if (https.kind === 'ref') {
  assert.match(https.value, /^https:\/\//);
}

const fileId = resolvePlaydateNotifyPhoto(
  pet({
    id: 2,
    name: 'Max',
    species: 'dog',
    imageUrl: 'AgACAgQAAxkBAAITestFileIdToken1234567890',
  })
);
assert.equal(fileId.kind, 'ref');
if (fileId.kind === 'ref') {
  assert.equal(fileId.value, 'AgACAgQAAxkBAAITestFileIdToken1234567890');
}

const missingLocal = resolvePlaydateNotifyPhoto(
  pet({
    id: 9,
    name: 'Ghost',
    species: 'cat',
    imageUrl: '/api/pets/photos/999/missing-photo.jpg',
  })
);
assert.equal(missingLocal.kind, 'ref');
if (missingLocal.kind === 'ref') {
  // No public HTTPS origin in this test → default unsplash (never bare relative)
  assert.match(missingLocal.value, /^https:\/\//);
  assert.doesNotMatch(missingLocal.value, /^\/api\//);
}

const empty = resolvePlaydateNotifyPhoto(pet({ id: 3, name: 'NoPic', species: 'dog' }));
assert.equal(empty.kind, 'ref');
if (empty.kind === 'ref') assert.match(empty.value, /^https:\/\//);

if (prevDb === undefined) delete process.env.DATABASE_PATH;
else process.env.DATABASE_PATH = prevDb;
fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log('telegram-playdate-notify.selftest: ok');
