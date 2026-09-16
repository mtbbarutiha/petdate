#!/usr/bin/env npx tsx
/**
 * Delete ONLY known demo/fake panel rows:
 *   SEED-HR-*, CRM 09120006xxx, 0912SEED*, seed.* accounts,
 *   fake shop_orders (سارا م. / 091000000*), wallet_ledger ref_type=seed,
 *   Finance OS demo CoA (HYP/UPD/PD), fake_owner_*/demo_* users.
 *
 * Dry-run by default. Destructive only with --apply AND CONFIRM=DELETE_DEMO_SEEDS.
 *
 *   npx tsx scripts/cleanup-demo-seeds.ts
 *   CONFIRM=DELETE_DEMO_SEEDS npx tsx scripts/cleanup-demo-seeds.ts --apply
 *
 * Never run automatically on deploy. Does not touch real users/pets/magazine/live shop SKUs.
 */
import { runDemoSeedCleanup } from '../packages/api/src/demo-seeds-cleanup.ts';

async function main() {
  const apply = process.argv.includes('--apply');
  const confirm = String(process.env.CONFIRM || '').trim();
  if (apply && confirm !== 'DELETE_DEMO_SEEDS') {
    console.error('Refusing --apply without CONFIRM=DELETE_DEMO_SEEDS');
    process.exit(2);
  }

  const result = runDemoSeedCleanup({ apply });
  console.log(JSON.stringify(result, null, 2));
  if (result.dryRun) {
    console.log(
      'Dry-run only. To delete: CONFIRM=DELETE_DEMO_SEEDS npx tsx scripts/cleanup-demo-seeds.ts --apply'
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
