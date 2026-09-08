/**
 * Selftest: resolve playdate notify photos + composite owner overlay.
 * Relative `/api/pets/photos/...` must not be passed as bare photo URLs
 * (Telegram: "invalid file HTTP URL specified: URL host is empty").
 * Composite must place circular owner avatar top-left (no «صاحب پت» chip).
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import type { PetProfile } from '@petdate/shared';

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

async function solidJpeg(size: number, r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r, g, b },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function sampleRgb(
  jpeg: Buffer,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sharp(jpeg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const idx = (y * info.width + x) * info.channels;
  return { r: data[idx]!, g: data[idx + 1]!, b: data[idx + 2]! };
}

function isMostlyRed(p: { r: number; g: number; b: number }): boolean {
  return p.r > 160 && p.g < 90 && p.b < 90;
}

function isMostlyBlue(p: { r: number; g: number; b: number }): boolean {
  return p.b > 160 && p.r < 90 && p.g < 100;
}

async function main() {
  const prevDb = process.env.DATABASE_PATH;
  const prevUrl = process.env.DATABASE_URL;
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-playdate-notify-'));
  const tmpDb = path.join(tmpRoot, 'petdate.db');
  process.env.DATABASE_PATH = tmpDb;
  // Force SQLite for this selftest (ignore host .env Postgres).
  // Empty string blocks dotenv from re-applying DATABASE_URL on db import.
  process.env.DATABASE_URL = '';

  const {
    petPhotoStorageKeyFromUrl,
    resolvePlaydateNotifyPhoto,
    buildPlaydateNotifyCompositePhoto,
  } = await import('./telegram-playdate-notify');
  const { ownerOverlayPosition } = await import('./nearby-cards');
  const { ensureUserAvatarsRoot, resolveUserAvatarPath } = await import('./user-avatar-store');
  const { ensurePetPhotosRoot, resolvePetPhotoPath } = await import('./pet-photo-store');

  const photoDir = path.join(tmpRoot, 'pet-photos', '38');
  fs.mkdirSync(photoDir, { recursive: true });
  const fileName = '1b686ee8-1327-4e30-b8e1-287ea5f16d29.jpg';
  fs.writeFileSync(path.join(photoDir, fileName), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

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
      imageUrl:
        'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
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
    assert.match(missingLocal.value, /^https:\/\//);
    assert.doesNotMatch(missingLocal.value, /^\/api\//);
  }

  const empty = resolvePlaydateNotifyPhoto(pet({ id: 3, name: 'NoPic', species: 'dog' }));
  assert.equal(empty.kind, 'ref');
  if (empty.kind === 'ref') assert.match(empty.value, /^https:\/\//);

  // Composite: blue pet + red owner → owner circle top-left
  const { getDb } = await import('../db');
  getDb();
  ensureUserAvatarsRoot();
  ensurePetPhotosRoot();
  const avatarKey = '38/selftest-owner.jpg';
  const avatarAbs = resolveUserAvatarPath(avatarKey);
  assert.ok(avatarAbs);
  fs.mkdirSync(path.dirname(avatarAbs!), { recursive: true });
  fs.writeFileSync(avatarAbs!, await solidJpeg(256, 220, 30, 30));

  const petPhotoKey = '38/selftest-pet.jpg';
  const petAbs = resolvePetPhotoPath(petPhotoKey);
  assert.ok(petAbs);
  fs.mkdirSync(path.dirname(petAbs!), { recursive: true });
  fs.writeFileSync(petAbs!, await solidJpeg(800, 30, 40, 210));

  const composite = await buildPlaydateNotifyCompositePhoto(
    pet({
      id: 35,
      name: 'Teddy',
      species: 'dog',
      ownerId: 999001, // missing user → ensureWebAccessibleAvatar no-ops
      imageUrl: `/api/pets/photos/${petPhotoKey}`,
      ownerAvatarUrl: `/api/auth/avatar/${avatarKey}`,
      ownerName: 'صاحب پت',
    })
  );
  assert.ok(composite, 'composite photo required');
  assert.equal(composite!.kind, 'upload');
  if (composite!.kind === 'upload') {
    assert.ok(composite.buffer.length > 2000);
    assert.equal(composite.contentType, 'image/jpeg');
    assert.match(composite.filename, /\.jpg$/i);
    assert.equal(composite.buffer[0], 0xff);
    assert.equal(composite.buffer[1], 0xd8);

    const tl = ownerOverlayPosition('tl');
    const centerX = tl.left + 89;
    const centerY = tl.top + 89;
    const ownerSample = await sampleRgb(composite.buffer, centerX, centerY);
    assert.ok(
      isMostlyRed(ownerSample),
      `expected red owner overlay at tl (${centerX},${centerY}), got ${JSON.stringify(ownerSample)}`
    );

    const brSample = await sampleRgb(composite.buffer, 760, 760);
    assert.ok(
      isMostlyBlue(brSample),
      `expected blue pet at br, got ${JSON.stringify(brSample)}`
    );

    const outDir = path.join('/tmp', 'petdate-playdate-notify');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'composite.jpg'), composite.buffer);
    console.log('telegram-playdate-notify composite ok', {
      bytes: composite.buffer.length,
      ownerSample,
      brSample,
      tl,
      outDir,
    });
  }

  if (prevDb === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = prevDb;
  if (prevUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevUrl;
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  console.log('telegram-playdate-notify.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
