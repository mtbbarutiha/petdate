/**
 * Guard: admin FA/EN chrome parity — screenshot analytics strings, GTM catalog
 * notes, and reverse-map so leftover English source still renders Persian.
 * Run: npx tsx packages/web/src/i18n/adminFa.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GTM_SITE_TRIGGERS,
  GTM_SITE_VARIABLES,
  GTM_UI_SETUP_CHECKLIST,
} from '../../../shared/src/gtm-contract.ts';
import {
  ADMIN_FA_EN,
  setUiLangOverride,
  tr,
} from './index.ts';

const PERSIAN = /[\u0600-\u06FF]/;

const SCREENSHOT_CHROME: Array<[string, string]> = [
  ['بازدید صفحه', 'Page View'],
  ['نشست یکتا', 'Unique Sessions'],
  ['صفحه / نشست', 'Page / Session'],
  ['نرخ پرش', 'Bounce Rate'],
  ['نرخ تعامل', 'Engagement Rate'],
  ['فعال', 'Active'],
  ['ذخیره Measurement ID', 'Save Measurement ID'],
  ['کپی', 'Copy'],
  ['گزارش کامل Tag Manager', 'Full Tag Manager Report'],
  ['ترافیک روزانه', 'Daily Traffic'],
  ['نشست روزانه', 'Daily Sessions'],
  ['باز کردن Google Analytics', 'Open Google Analytics'],
  ['باز کردن Tag Manager', 'Open Tag Manager'],
  ['باز کردن Clarity', 'Open Clarity'],
  ['کانتینر:', 'Container:'],
  ['شناسه Measurement ID:', 'Measurement ID:'],
  ['پیکربندی نشده', 'Not Configured'],
];

try {
  setUiLangOverride('fa');
  for (const [fa, en] of SCREENSHOT_CHROME) {
    assert.equal(ADMIN_FA_EN[fa], en, `map ${fa}`);
    assert.equal(tr(fa), fa, `FA mode must keep Persian: ${fa}`);
    assert.equal(tr(en), fa, `FA mode must reverse unique English "${en}" → ${fa}`);
  }
  assert.match(tr('بازدید صفحه'), PERSIAN);
  assert.match(tr('فعال'), PERSIAN);
  assert.match(tr('ترافیک روزانه'), PERSIAN);

  setUiLangOverride('en');
  for (const [fa, en] of SCREENSHOT_CHROME) {
    assert.equal(tr(fa), en, `EN mode must translate ${fa}`);
    assert.doesNotMatch(tr(fa), PERSIAN, `EN chrome leftover Persian: ${fa} → ${tr(fa)}`);
  }
  assert.equal(tr('ذخیره شد'), 'Saved');
  assert.equal(tr('شناسه کپی شد'), 'ID Copied');
} finally {
  setUiLangOverride(null);
}

function assertMapped(fa: string, label: string): void {
  if (!PERSIAN.test(fa)) return;
  assert.ok(ADMIN_FA_EN[fa], `${label} missing from ADMIN_FA_EN:\n${fa}`);
}

for (const row of [...GTM_SITE_VARIABLES, ...GTM_SITE_TRIGGERS]) {
  assertMapped(row.descriptionFa, `catalog ${row.name} description`);
  assertMapped(row.whereFired, `catalog ${row.name} whereFired`);
}
for (const item of GTM_UI_SETUP_CHECKLIST) {
  assertMapped(item.detailFa, `checklist ${item.id} detail`);
  assertMapped(item.titleFa, `checklist ${item.id} title`);
}

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'admin');
const analyticsFiles = [
  'pages/AdminSiteReportsPage.tsx',
  'pages/AdminTagManagerPage.tsx',
  'adminAnalyticsCopy.ts',
];
const mustUse = [
  "tr('بازدید صفحه')",
  "tr('نشست یکتا')",
  "tr('ترافیک روزانه')",
  "tr('نشست روزانه')",
  "tr('ذخیره Measurement ID')",
  "tr('فعال')",
];
const reports = readFileSync(join(adminRoot, 'pages/AdminSiteReportsPage.tsx'), 'utf8');
for (const needle of mustUse) {
  assert.ok(reports.includes(needle), `AdminSiteReportsPage must use ${needle}`);
}

for (const rel of analyticsFiles) {
  const text = readFileSync(join(adminRoot, rel), 'utf8');
  assert.doesNotMatch(text, /note=\{data\.(ga4|gtm|clarity)\.note\}/, `${rel} must not render raw API notes`);
  assert.doesNotMatch(text, />\s*Tag Assistant\s*</, `${rel} must wrap Tag Assistant in tr()`);
  assert.doesNotMatch(text, /configured \? 'detected' : 'missing'/, `${rel} must not use English detected/missing badges`);
}

assert.match(reports, /ga4StatusNote|gtmStatusNote|clarityStatusNote/, 'overview cards must use client-side notes');

console.log(
  `adminFa.selftest: ok (screenshot=${SCREENSHOT_CHROME.length} catalog=${GTM_SITE_VARIABLES.length + GTM_SITE_TRIGGERS.length} checklist=${GTM_UI_SETUP_CHECKLIST.length})`,
);
