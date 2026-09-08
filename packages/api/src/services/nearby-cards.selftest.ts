/**
 * Selftest: nearby list collage + pet/owner profile card (no DB / network required for placeholder).
 */
import fs from 'fs';
import path from 'path';
import {
  formatDistanceFa,
  formatLastSeenFa,
  renderNearbyListCard,
  renderPetProfileCard,
  toFaDigits,
} from './nearby-cards';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  assert(toFaDigits(12) === '۱۲', 'toFaDigits');
  assert(formatDistanceFa(0.05) === 'نزدیک', 'near distance');
  assert(formatDistanceFa(0.932).includes('متر'), 'meters');
  assert(formatLastSeenFa(new Date().toISOString()).includes('لحظاتی'), 'last seen recent');

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

  const profileBuf = await renderPetProfileCard({ pet: pets[0]! });
  assert(profileBuf.length > 2000, `profile card too small: ${profileBuf.length}`);
  assert(profileBuf[0] === 0xff && profileBuf[1] === 0xd8, 'profile card should be jpeg');

  const outDir = path.join('/tmp', 'petdate-nearby-cards');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'list.jpg'), listBuf);
  fs.writeFileSync(path.join(outDir, 'profile.jpg'), profileBuf);
  console.log('nearby-cards selftest ok', {
    listBytes: listBuf.length,
    profileBytes: profileBuf.length,
    outDir,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
