/**
 * Admin + owner native prompt/confirm/alert must use the shared AppDialog.
 * Run: npx tsx packages/web/src/components/appDialog.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(dir, '..');

const dialog = readFileSync(join(dir, 'AppDialog.tsx'), 'utf8');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');

assert.match(dialog, /export function appAlert/, 'appAlert helper');
assert.match(dialog, /export function appConfirm/, 'appConfirm helper');
assert.match(dialog, /export function appPrompt/, 'appPrompt helper');
assert.match(dialog, /export function AppDialogHost/, 'AppDialogHost exported');
assert.match(dialog, /role="dialog"/, 'dialog role');
assert.match(dialog, /aria-modal="true"/, 'aria-modal');
assert.match(dialog, /Escape/, 'closes on Escape');
assert.match(dialog, /createPortal/, 'portals to body / admin-app');
assert.match(dialog, /data-app-dialog-field/, 'prompt focuses input');
assert.match(app, /AppDialogHost/, 'App mounts AppDialogHost');

const nativeRe = /\bwindow\.(prompt|confirm|alert)\s*\(|(?<![\w.])(prompt|confirm|alert)\s*\(/;

const mustUseDialog = [
  'admin/pages/AdminCoinSellsPage.tsx',
  'admin/pages/AdminPaymentsPage.tsx',
  'admin/pages/AdminVerificationPage.tsx',
  'admin/pages/AdminShopCategoriesPage.tsx',
  'admin/pages/AdminShopProductsPage.tsx',
  'admin/pages/AdminContentPage.tsx',
  'admin/pages/AdminMagazinePage.tsx',
  'admin/pages/AdminLogsPage.tsx',
  'admin/pages/AdminSettingsPage.tsx',
  'admin/pages/AdminFinanceDashboardPage.tsx',
  'admin/pages/AdminFinanceSalesPage.tsx',
  'admin/pages/AdminFinancePnLPage.tsx',
  'admin/pages/finance/AdminFinanceTransactionsPage.tsx',
  'admin/pages/finance/AdminFinanceAllocationPage.tsx',
  'admin/pages/hr/AdminHrRbacPage.tsx',
  'admin/pages/hr/AdminHrEmployeesPage.tsx',
  'admin/pages/hr/AdminHrRequestsPage.tsx',
  'admin/pages/hr/AdminHrEmployeeDetailPage.tsx',
  'admin/pages/crm/AdminCrmSmsPage.tsx',
  'admin/MagazineRichTextEditor.tsx',
  'pages/ProfilePage.tsx',
  'pages/VetConsultPage.tsx',
  'pages/VetChatPage.tsx',
  'lib/playmateActions.ts',
];

for (const rel of mustUseDialog) {
  const src = readFileSync(join(webSrc, rel), 'utf8');
  assert.match(src, /from ['"].*AppDialog['"]/, `${rel} imports AppDialog`);
  assert.doesNotMatch(src, nativeRe, `${rel} has no native prompt/confirm/alert`);
}

assert.match(
  readFileSync(join(webSrc, 'admin/pages/AdminCoinSellsPage.tsx'), 'utf8'),
  /یادداشت واریز/,
  'coin-sell payout note uses in-app prompt'
);
assert.match(
  readFileSync(join(webSrc, 'admin/pages/AdminPaymentsPage.tsx'), 'utf8'),
  /دلیل رد/,
  'payment reject note uses in-app prompt'
);

function walkTsx(root: string, acc: string[] = []): string[] {
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules') continue;
      walkTsx(p, acc);
    } else if (name.isFile() && /\.(ts|tsx)$/.test(name.name) && !name.name.includes('.selftest.')) {
      acc.push(p);
    }
  }
  return acc;
}

const skip = new Set([
  join(dir, 'AppDialog.tsx'),
  join(dir, 'ConfirmModal.tsx'),
]);

for (const file of [...walkTsx(join(webSrc, 'admin')), ...walkTsx(join(webSrc, 'pages')), join(webSrc, 'lib/playmateActions.ts')]) {
  if (skip.has(file)) continue;
  const src = readFileSync(file, 'utf8');
  assert.doesNotMatch(src, /\bwindow\.(prompt|confirm|alert)\s*\(/, `${file} must not call window.prompt/confirm/alert`);
}

console.log('appDialog.selftest: ok');
