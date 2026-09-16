#!/usr/bin/env npx tsx
/**
 * Launch wipe — all users (admins stay in admin_accounts) + sales/finance/panel
 * transactional data. Keeps shop brands + products inventory + categories.
 *
 *   npx tsx scripts/launch-panel-wipe.ts
 *   CONFIRM=WIPE_PANEL_KEEP_CATALOG npx tsx scripts/launch-panel-wipe.ts --apply
 */
import { runLaunchPanelWipe, LAUNCH_PANEL_WIPE_CONFIRM } from '../packages/api/src/launch-panel-wipe.ts';

async function main() {
  const apply = process.argv.includes('--apply');
  const confirm = String(process.env.CONFIRM || '').trim();
  if (apply && confirm !== LAUNCH_PANEL_WIPE_CONFIRM) {
    console.error(`Refusing --apply without CONFIRM=${LAUNCH_PANEL_WIPE_CONFIRM}`);
    process.exit(2);
  }
  const result = runLaunchPanelWipe({ apply });
  console.log(JSON.stringify(result, null, 2));
  if (result.dryRun) {
    console.log(
      `Dry-run only. To wipe: CONFIRM=${LAUNCH_PANEL_WIPE_CONFIRM} npx tsx scripts/launch-panel-wipe.ts --apply`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
