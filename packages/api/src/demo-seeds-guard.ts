/**
 * HR / CRM demo graph seeds (SEED-HR-01, 09120006001, ADMIN_SEED_PASSWORD accounts).
 * Production skips unless ALLOW_DEMO_SEEDS=1 (ALLOW_DEMO_SEED=1 accepted as alias).
 * Magazine / migrateSchema / catalog seeds are unrelated and must keep running.
 */
export function allowDemoSeeds(): boolean {
  const explicit =
    process.env.ALLOW_DEMO_SEEDS === '1' || process.env.ALLOW_DEMO_SEED === '1';
  if (process.env.NODE_ENV === 'production') {
    return explicit;
  }
  return true;
}
