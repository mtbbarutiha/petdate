/**
 * Guard: EN dictionary values for public/admin chrome must not contain Persian letters.
 * Also ensures FA/EN key parity and key chrome files use useI18n.
 * Run: npx tsx packages/web/src/i18n/enChrome.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTranslator, enDict, faDict } from './index.ts';

const PERSIAN = /[\u0600-\u06FF]/;

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

const faKeys = collectKeys(faDict as Record<string, unknown>).sort();
const enKeys = collectKeys(enDict as Record<string, unknown>).sort();
assert.deepEqual(enKeys, faKeys, 'EN and FA dictionaries must share the same key set');

const tEn = createTranslator(enDict, faDict);
const offenders: string[] = [];
for (const key of enKeys) {
  if (key === 'lang.fa' || key === 'lang.switchToFa') continue;
  const val = tEn(key);
  if (PERSIAN.test(val)) offenders.push(`${key}=${val}`);
}
assert.equal(
  offenders.length,
  0,
  `EN dictionary has Persian UI strings:\n${offenders.slice(0, 40).join('\n')}`
);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chromeFiles = [
  'pages/WelcomePage.tsx',
  'pages/HomePage.tsx',
  'pages/AdoptionListPage.tsx',
  'pages/AdoptionDetailPage.tsx',
  'pages/MyPetsPage.tsx',
  'components/LandingMobileDock.tsx',
  'components/shop/ShopChrome.tsx',
  'components/AdoptionPurchaseCta.tsx',
  'components/SiteFooter.tsx',
  'components/LandingChrome.tsx',
  'admin/AdminLayout.tsx',
  'main.tsx',
];

for (const rel of chromeFiles) {
  const text = readFileSync(join(root, rel), 'utf8');
  assert.match(text, /useI18n/, `${rel} must use useI18n`);
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const litRe = /(['"`])((?:(?!\1)(?:\\.|.)*?)[\u0600-\u06FF](?:(?!\1)(?:\\.|.)*?))\1/g;
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = litRe.exec(code))) {
    const s = m[2];
    if (/^[۰-۹٠-٩]+$/.test(s)) continue;
    hits.push(s.slice(0, 80));
  }
  assert.equal(hits.length, 0, `${rel} still has Persian string literals: ${hits.slice(0, 8).join(' | ')}`);
}

const main = readFileSync(join(root, 'main.tsx'), 'utf8');
assert.match(main, /LangKeyedApp|key=\{lang\}/, 'language toggle remounts app chrome');

console.log(`enChrome.selftest: ok (${enKeys.length} keys, ${chromeFiles.length} chrome files)`);
