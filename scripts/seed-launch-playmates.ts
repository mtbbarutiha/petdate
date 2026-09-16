#!/usr/bin/env npx tsx
/**
 * Populate 15 playmate users + pets per Iranian province.
 *
 *   npx tsx scripts/seed-launch-playmates.ts
 */
import { seedLaunchPlaymates } from '../packages/api/src/launch-playmates-seed.ts';

async function main() {
  const result = await seedLaunchPlaymates();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
