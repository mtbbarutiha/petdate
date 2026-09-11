/**
 * i18n + default-dark theme contract.
 * Run: npx tsx packages/web/src/i18n/i18n.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  isLang,
  resolveLang,
  langDir,
  createTranslator,
  faDict,
  enDict,
} from './index.ts';
import { DEFAULT_THEME, resolveTheme, THEME_STORAGE_KEY } from '../lib/theme.ts';

assert.equal(LANG_STORAGE_KEY, 'petdate-lang');
assert.equal(DEFAULT_LANG, 'fa');
assert.equal(isLang('fa'), true);
assert.equal(isLang('en'), true);
assert.equal(isLang('de'), false);
assert.equal(resolveLang(null), 'fa');
assert.equal(resolveLang('en'), 'en');
assert.equal(resolveLang('weird'), 'fa');
assert.equal(langDir('fa'), 'rtl');
assert.equal(langDir('en'), 'ltr');

assert.equal(THEME_STORAGE_KEY, 'petdate-theme');
assert.equal(DEFAULT_THEME, 'dark');
assert.equal(resolveTheme(null), 'dark');
assert.equal(resolveTheme(undefined, false), 'dark');
assert.equal(resolveTheme(undefined, true), 'dark');
assert.equal(resolveTheme('light', true), 'light');
assert.equal(resolveTheme('dark', false), 'dark');

const tFa = createTranslator(faDict);
const tEn = createTranslator(enDict, faDict);
assert.equal(tFa('common.home'), 'خانه');
assert.equal(tEn('common.home'), 'Home');
assert.equal(tFa('wallet.title'), 'کیف پول');
assert.equal(tEn('wallet.title'), 'Wallet');
assert.equal(tFa('admin.users'), 'کاربران');
assert.equal(tEn('admin.users'), 'Users');
assert.equal(tEn('admin.signedInAs', { name: 'Ali' }), 'Signed in: Ali');
assert.equal(tEn('missing.key.fallback'), 'missing.key.fallback');

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

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(html, /petdate-lang/, 'FOUC script sets language');
assert.match(html, /petdate-theme/, 'FOUC script uses theme key');
assert.match(html, /stored === 'light' \|\| stored === 'dark' \? stored : 'dark'/, 'default theme is dark');
assert.doesNotMatch(
  html,
  /prefers-color-scheme: dark[\s\S]{0,80}\? 'dark'[\s\S]{0,40}: 'light'/,
  'FOUC must not prefer OS light over product dark default'
);

const landing = readFileSync(join(root, 'src/components/LandingChrome.tsx'), 'utf8');
assert.match(landing, /LanguageToggle/, 'landing chrome exposes language toggle');
assert.match(landing, /useI18n/, 'landing chrome uses i18n');

const welcome = readFileSync(join(root, 'src/pages/WelcomePage.tsx'), 'utf8');
assert.match(welcome, /LanguageToggle/, 'welcome header exposes language toggle');

const adminLayout = readFileSync(join(root, 'src/admin/AdminLayout.tsx'), 'utf8');
assert.match(adminLayout, /LanguageToggle/, 'admin topbar exposes language toggle');
assert.match(adminLayout, /admin\./, 'admin nav uses translation keys');

const adminLogin = readFileSync(join(root, 'src/admin/pages/AdminLoginPage.tsx'), 'utf8');
assert.match(adminLogin, /LanguageToggle/, 'admin login exposes language toggle');

const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');
assert.match(main, /I18nProvider/, 'app wrapped in I18nProvider');
assert.match(main, /initLang/, 'lang initialized early');
assert.match(main, /LangKeyedApp|key=\{lang\}/, 'language toggle remounts app chrome');

console.log('i18n.selftest: ok');
