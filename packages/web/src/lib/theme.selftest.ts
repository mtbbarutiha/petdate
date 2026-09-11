/**
 * Theme resolve / toggle contract.
 * Run: npx tsx packages/web/src/lib/theme.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THEME_STORAGE_KEY,
  isThemeMode,
  resolveTheme,
} from './theme.ts';

assert.equal(THEME_STORAGE_KEY, 'petdate-theme');
assert.equal(isThemeMode('light'), true);
assert.equal(isThemeMode('dark'), true);
assert.equal(isThemeMode('auto'), false);
assert.equal(isThemeMode(null), false);

assert.equal(resolveTheme('dark', false), 'dark');
assert.equal(resolveTheme('light', true), 'light');
assert.equal(resolveTheme(null, true), 'dark');
assert.equal(resolveTheme(undefined, false), 'light');
assert.equal(resolveTheme('weird', true), 'dark');
assert.equal(resolveTheme('weird', false), 'light');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(html, /petdate-theme/, 'FOUC script uses storage key');
assert.match(html, /data-theme/, 'FOUC script sets data-theme early');
assert.match(html, /prefers-color-scheme/, 'FOUC script respects OS preference');
assert.match(html, /color-scheme/, 'color-scheme meta present');

const darkCss = readFileSync(join(root, 'src/styles/theme-dark.css'), 'utf8');
assert.match(darkCss, /\[data-theme=['"]dark['"]\]/, 'dark token block present');
assert.match(darkCss, /--pepito-soft/, 'pepito soft remapped');
assert.match(darkCss, /--admin-bg/, 'admin tokens remapped');
assert.match(darkCss, /--tg-in/, 'chat tokens remapped');
assert.doesNotMatch(darkCss, /--pepito-soft:\s*#000\b/, 'avoid pure black bg');
assert.doesNotMatch(darkCss, /box-shadow:\s*0 0 \d+px .{0,40}(purple|#[89a-fA-F][0-9a-fA-F]{5})/, 'no neon glow shadows');

/* Pass 3 screenshot hotspots must keep dark surfaces + readable ink */
assert.match(darkCss, /\.admin-app input::placeholder/, 'admin placeholders remapped');
assert.match(darkCss, /\.sales-pipe-col\b/, 'sales kanban columns remapped');
assert.match(darkCss, /\.admin-notif-panel-head/, 'notif panel head remapped');
assert.match(darkCss, /\.tk-nav\.is-on/, 'ticketing active nav remapped');
assert.match(darkCss, /\.crm-report-filters/, 'crm filter bar remapped');
assert.match(darkCss, /\.crm-report-counters div/, 'crm counter tiles remapped');
assert.match(darkCss, /\.crm-reason-node--l1/, 'crm taxonomy panels remapped');
assert.match(darkCss, /\.admin-period-filter/, 'period segmented control remapped');
assert.match(darkCss, /\.admin-mail-list/, 'mail inbox list remapped');
assert.match(darkCss, /\.pepito-nav-cart-link/, 'nav cart chip remapped');
assert.match(darkCss, /\.pepito-wallet-folio/, 'wallet folio remapped');
assert.match(darkCss, /\.pepito-my-pets-hero/, 'my-pets hero remapped');
assert.match(darkCss, /\.pd-shop-dk-cats/, 'shop categories remapped');
assert.match(darkCss, /\.pepito-reviews-section/, 'reviews section remapped');

const toggle = readFileSync(join(root, 'src/components/ThemeToggle.tsx'), 'utf8');
assert.match(toggle, /toggleTheme|setTheme/, 'ThemeToggle mutates theme');
assert.match(toggle, /aria-label/, 'ThemeToggle accessible');

const landing = readFileSync(join(root, 'src/components/LandingChrome.tsx'), 'utf8');
assert.match(landing, /ThemeToggle/, 'landing chrome exposes toggle');

const welcome = readFileSync(join(root, 'src/pages/WelcomePage.tsx'), 'utf8');
assert.match(welcome, /ThemeToggle/, 'welcome header exposes toggle');

const adminLayout = readFileSync(join(root, 'src/admin/AdminLayout.tsx'), 'utf8');
assert.match(adminLayout, /ThemeToggle/, 'admin topbar exposes toggle');

const adminLogin = readFileSync(join(root, 'src/admin/pages/AdminLoginPage.tsx'), 'utf8');
assert.match(adminLogin, /ThemeToggle/, 'admin login exposes toggle');

console.log('theme.selftest: ok');
