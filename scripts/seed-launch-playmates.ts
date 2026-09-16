#!/usr/bin/env npx tsx
/**
 * Populate / refresh launch playmate users.
 *
 *   npx tsx scripts/seed-launch-playmates.ts
 *   npx tsx scripts/seed-launch-playmates.ts --refresh-photos
 */
import {
  refreshLaunchPlaymatePetPhotos,
  seedLaunchPlaymates,
} from '../packages/api/src/launch-playmates-seed.ts';

async function main() {
  if (process.argv.includes('--refresh-photos')) {
    const result = await refreshLaunchPlaymatePetPhotos();
    console.log(JSON.stringify(result, null, 2));
    if (result.failed) process.exitCode = 1;
    return;
  }
  const result = await seedLaunchPlaymates();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
