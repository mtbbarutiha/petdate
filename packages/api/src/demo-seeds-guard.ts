/**
 * Demo / fake panel seeds:
 * - HR / CRM / Sales demo graphs (SEED-HR-01, 09120006001, seed.* accounts)
 * - Fake shop_orders + wallet_ledger in seedFinanceDefaults
 * - Finance OS holding CoA / sample balances in seedFinanceOsIfEmpty
 *
 * Production skips unless ALLOW_DEMO_SEEDS=1 (ALLOW_DEMO_SEED=1 accepted as alias).
 * Magazine / migrateSchema / catalog seeds (career layers, system roles, live shop SKUs) stay ungated.
 * Existing live rows are not deleted on boot — run cleanup-demo-seeds.ts (or admin purge).
 */
export function allowDemoSeeds(): boolean {
  const explicit =
    process.env.ALLOW_DEMO_SEEDS === '1' || process.env.ALLOW_DEMO_SEED === '1';
  if (process.env.NODE_ENV === 'production') {
    return explicit;
  }
  return true;
}
