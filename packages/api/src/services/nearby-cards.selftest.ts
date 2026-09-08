/**
 * Selftest: nearby list collage + pet/owner profile card (no DB / network required for placeholder).
 * Verifies circular owner overlay at top-left and no «صاحب پت» label chip.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  formatDistanceFa,
  formatLastSeenFa,
  ownerOverlayPosition,
  renderNearbyListCard,
  renderPetProfileCard,
  toFaDigits,
} from './nearby-cards';
import { ensureUserAvatarsRoot, resolveUserAvatarPath } from './user-avatar-store';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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
  return p.b > 160 && p.r < 90 && p.g < 90;
}

async function main(): Promise<void> {
  assert(toFaDigits(12) === '۱۲', 'toFaDigits');
  assert(formatDistanceFa(0.05) === 'نزدیک', 'near distance');
  assert(formatDistanceFa(0.932).includes('متر'), 'meters');
  assert(formatLastSeenFa(new Date().toISOString()).includes('لحظاتی'), 'last seen recent');

  const tl = ownerOverlayPosition('tl');
  const br = ownerOverlayPosition('br');
  assert(tl.left < 80 && tl.top < 80, `tl should be top-left, got ${JSON.stringify(tl)}`);
  assert(br.left > 500 && br.top > 500, `br should be bottom-right, got ${JSON.stringify(br)}`);

  const pets = [
    {
      id: 1,
      ownerId: 10,
      name: 'رکس',
      species: 'dog',
      breed: 'گلدن',
      gender: 'male' as const,
      ageMonths: 36,
      vaccinated: true,
      neutered: false,
      lookingForPlaymate: true,
      personality: {},
      health: {},
      ownerCity: 'تهران',
      ownerProvince: 'تهران',
      ownerName: 'علی',
      ownerVerified: true,
      distanceKm: 1.2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 2,
      ownerId: 11,
      name: 'میلو',
      species: 'cat',
      breed: 'پرشین',
      gender: 'female' as const,
      ageMonths: 18,
      vaccinated: true,
      neutered: true,
      lookingForPlaymate: true,
      personality: {},
      health: {},
      ownerCity: 'کرج',
      ownerName: 'سارا',
      distanceKm: 0.4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  ];

  const listBuf = await renderNearbyListCard({
    pets,
    radiusKm: 5,
    page: 0,
    totalCount: 2,
  });
  assert(listBuf.length > 2000, `list card too small: ${listBuf.length}`);
  assert(listBuf[0] === 0xff && listBuf[1] === 0xd8, 'list card should be jpeg');

  // Solid blue pet + solid red owner avatar → overlay must land top-left (no label chip).
  ensureUserAvatarsRoot();
  const avatarKey = '999001/selftest-owner.jpg';
  const avatarAbs = resolveUserAvatarPath(avatarKey);
  assert(avatarAbs, 'avatar path');
  fs.mkdirSync(path.dirname(avatarAbs!), { recursive: true });
  fs.writeFileSync(avatarAbs!, await solidJpeg(256, 220, 30, 30));

  const petPhotoKey = '999001/selftest-pet.jpg';
  const { resolvePetPhotoPath, ensurePetPhotosRoot } = await import('./pet-photo-store');
  ensurePetPhotosRoot();
  const petAbs = resolvePetPhotoPath(petPhotoKey);
  assert(petAbs, 'pet photo path');
  fs.mkdirSync(path.dirname(petAbs!), { recursive: true });
  fs.writeFileSync(petAbs!, await solidJpeg(800, 30, 40, 210));

  const profileBuf = await renderPetProfileCard({
    pet: {
      ...pets[0]!,
      imageUrl: `/api/pets/photos/${petPhotoKey}`,
      ownerAvatarUrl: `/api/auth/avatar/${avatarKey}`,
      ownerName: 'صاحب پت', // must NOT draw this as a chip under the avatar
    },
    corner: 'tl',
  });
  assert(profileBuf.length > 2000, `profile card too small: ${profileBuf.length}`);
  assert(profileBuf[0] === 0xff && profileBuf[1] === 0xd8, 'profile card should be jpeg');

  // Center of owner circle (tl inset + half overlay) should be reddish.
  const centerX = tl.left + 89;
  const centerY = tl.top + 89;
  const ownerSample = await sampleRgb(profileBuf, centerX, centerY);
  assert(
    isMostlyRed(ownerSample),
    `expected red owner overlay at tl (${centerX},${centerY}), got ${JSON.stringify(ownerSample)}`
  );

  // Far bottom-right of pet photo should stay blue (no owner + no green label chip).
  const brSample = await sampleRgb(profileBuf, 760, 760);
  assert(
    isMostlyBlue(brSample),
    `expected blue pet at br, got ${JSON.stringify(brSample)}`
  );

  // Region just under the old br chip slot should not be the green chip (#16a34a).
  const underOldBr = await sampleRgb(profileBuf, 650, 780);
  const looksLikeGreenChip =
    underOldBr.g > 140 && underOldBr.r < 80 && underOldBr.b < 100;
  assert(!looksLikeGreenChip, `unexpected label chip color at old br slot: ${JSON.stringify(underOldBr)}`);

  const outDir = path.join('/tmp', 'petdate-nearby-cards');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'list.jpg'), listBuf);
  fs.writeFileSync(path.join(outDir, 'profile.jpg'), profileBuf);
  console.log('nearby-cards selftest ok', {
    listBytes: listBuf.length,
    profileBytes: profileBuf.length,
    ownerSample,
    brSample,
    tl,
    outDir,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
