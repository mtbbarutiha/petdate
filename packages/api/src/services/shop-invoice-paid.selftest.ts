/**
 * Guard: wallet toman top-up packages + shop invoice SMS body shape.
 * Run: npx tsx packages/api/src/services/shop-invoice-paid.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOMAN_TOPUP_PACKAGES,
  findTomanTopupPackage,
  isWalletTomanTopupPackageId,
} from '@petdate/shared';
import { buildShopInvoiceSmsBody, shopInvoicePdfPublicPath } from './shop-invoice-pdf';

assert.ok(TOMAN_TOPUP_PACKAGES.length >= 4, 'toman top-up catalog present');
assert.ok(
  TOMAN_TOPUP_PACKAGES.every((p) => isWalletTomanTopupPackageId(p.id) && p.toman >= 50_000),
  'each package uses wtoman: prefix and positive toman'
);
assert.equal(findTomanTopupPackage('wtoman:100k')?.toman, 100_000);
assert.equal(findTomanTopupPackage('p50'), undefined);

const pdfUrl = `https://pdf.petdate.ir${shopInvoicePdfPublicPath('abc123def4567890')}`;
const sms = buildShopInvoiceSmsBody({ publicId: 'PD-O00138', pdfUrl });
assert.match(sms, /فاکتور خرید/);
assert.match(sms, /PD-O00138/);
assert.match(sms, /pdf\.petdate\.ir\/inv\//);
assert.doesNotMatch(sms, /https:\/\/petdate\.ir\/shop/, 'SMS uses PDF origin only');

const pdfSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'shop-invoice-pdf.ts'), 'utf8');
assert.match(pdfSrc, /مهر فروشگاه/, 'PDF paints shop seal');
assert.match(pdfSrc, /circle\(sealCx/, 'PDF draws circular stamp');

console.log('shop-invoice-paid.selftest: ok');
