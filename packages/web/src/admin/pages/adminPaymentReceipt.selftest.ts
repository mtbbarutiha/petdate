/**
 * Admin finance deposit receipt preview must show the file (not only «رسید دارد»).
 * Run: npx tsx packages/web/src/admin/pages/adminPaymentReceipt.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = fs.readFileSync(path.join(here, 'AdminPaymentsPage.tsx'), 'utf8');
const adminRoutes = fs.readFileSync(
  path.resolve(here, '../../../../api/src/routes/admin.ts'),
  'utf8'
);

assert.match(page, /AdminPaymentReceiptAttachment/, 'attachment component present');
assert.match(page, /پیوست — رسید ارسالی کاربر/, 'details has attachments section');
assert.match(page, /مشاهده رسید/, 'row offers view-receipt instead of text-only');
assert.doesNotMatch(page, /رسید دارد/, 'must not only say رسید دارد');
assert.match(
  page,
  /\/api\/admin\/payments\/\$\{order\.id\}\/receipt/,
  'loads receipt via authenticated admin endpoint'
);
assert.match(page, /createObjectURL/, 'uses blob URL like wallet #270');
assert.match(page, /status: 'pdf'/, 'supports PDF download path');
assert.match(page, /admin-payment-receipt/, 'receipt CSS class hooks present');

assert.match(
  adminRoutes,
  /fetchTelegramFileBytes/,
  'admin receipt proxies Telegram bytes (bot-sourced)'
);
assert.doesNotMatch(
  adminRoutes,
  /res\.redirect\(302,\s*`\/api\/media\/telegram/,
  'admin receipt must not 302-redirect (breaks auth blob fetch)'
);
assert.match(
  adminRoutes,
  /\/api\/payments\/receipts\//,
  'admin receipt still serves web disk receipts'
);

console.log('adminPaymentReceipt.selftest: ok');
