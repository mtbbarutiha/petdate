/**
 * Guard: admin English coverage — FA→EN map, no Persian EN values,
 * every tr()/t() key used in admin resolves to English (not FA fallback / raw key).
 * Run: npx tsx packages/web/src/i18n/adminEn.selftest.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_FA_EN, createTranslator, enDict, faDict } from './index.ts';

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
const dictOffenders: string[] = [];
for (const key of enKeys) {
  if (key === 'lang.fa' || key === 'lang.switchToFa') continue;
  const val = tEn(key);
  if (PERSIAN.test(val)) dictOffenders.push(`${key}=${val}`);
}
assert.equal(dictOffenders.length, 0, `EN dict has Persian:\n${dictOffenders.slice(0, 20).join('\n')}`);

const mapOffenders = Object.entries(ADMIN_FA_EN).filter(([, v]) => PERSIAN.test(v));
assert.equal(
  mapOffenders.length,
  0,
  `ADMIN_FA_EN has Persian values:\n${mapOffenders.slice(0, 12).map(([k, v]) => `${k}=${v}`).join('\n')}`
);
assert.ok(Object.keys(ADMIN_FA_EN).length > 1500, 'admin FA→EN map must stay comprehensive');

const sample = [
  ['حذف کاربر', 'Delete User'],
  ['کاربران', 'Users'],
  ['صف تأیید واریز', 'Deposit Approval Queue'],
  ['ذخیره', 'Save'],
  ['انصراف', 'Cancel'],
  ['موردی نیست', 'No items'],
];
for (const [fa, en] of sample) {
  assert.equal(ADMIN_FA_EN[fa], en, `map ${fa}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !name.includes('.selftest.')) out.push(p);
  }
  return out;
}

const adminRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'admin');
const files = walk(adminRoot);
const skip = /(iranProvincePaths|provinceNamesEn|jalaliDate\.ts|catalogs\.ts|adminFaEn)/;
const usedFa = new Set<string>();
const usedKeys = new Set<string>();
const trCall = /\btr\(\s*(['"])((?:\\.|[^\\])*?)\1/g;
const tCall = /\bt\(\s*(['"])((?:admin|common|roles|errors)\.[^'"]+)\1/g;

for (const file of files) {
  if (skip.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  let m: RegExpExecArray | null;
  const trRe = new RegExp(trCall.source, 'g');
  while ((m = trRe.exec(text))) usedFa.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  const tRe = new RegExp(tCall.source, 'g');
  while ((m = tRe.exec(text))) usedKeys.add(m[2]);
}

const missingMap = [...usedFa].filter((s) => PERSIAN.test(s) && !ADMIN_FA_EN[s] && !enKeys.includes(s));
assert.equal(
  missingMap.length,
  0,
  `tr() FA strings missing from ADMIN_FA_EN:\n${missingMap.slice(0, 25).join('\n')}`
);

const missingKeys = [...usedKeys].filter((k) => !enKeys.includes(k));
assert.equal(
  missingKeys.length,
  0,
  `t() keys missing from EN dict:\n${missingKeys.join('\n')}`
);

for (const k of usedKeys) {
  if (PERSIAN.test(tEn(k))) {
    assert.fail(`admin t('${k}') is Persian in EN: ${tEn(k)}`);
  }
}

const chromeMustUseI18n = [
  'AdminLayout.tsx',
  'pages/AdminLoginPage.tsx',
  'pages/AdminUsersPage.tsx',
  'pages/AdminMarketplaceModerationPage.tsx',
  'pages/AdminPaymentsPage.tsx',
];
for (const rel of chromeMustUseI18n) {
  const text = readFileSync(join(adminRoot, rel), 'utf8');
  assert.match(text, /\b(tr|useI18n)\b/, `${rel} must use tr/useI18n`);
}

console.log(
  `adminEn.selftest: ok (map=${Object.keys(ADMIN_FA_EN).length} tr=${usedFa.size} t=${usedKeys.size})`
);
