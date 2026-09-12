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
assert.equal(resolveTheme(undefined, false), 'dark');
assert.equal(resolveTheme('weird', true), 'dark');
assert.equal(resolveTheme('weird', false), 'dark');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(html, /petdate-theme/, 'FOUC script uses storage key');
assert.match(html, /data-theme/, 'FOUC script sets data-theme early');
assert.match(html, /stored === 'light' \|\| stored === 'dark' \? stored : 'dark'/, 'default theme is dark');
assert.doesNotMatch(
  html,
  /prefers-color-scheme: dark[\s\S]{0,80}\? 'dark'[\s\S]{0,40}: 'light'/,
  'FOUC must not fall back to OS light'
);
assert.match(html, /color-scheme/, 'color-scheme meta present');

const darkCss = readFileSync(join(root, 'src/styles/theme-dark.css'), 'utf8');
const pepitoCss = readFileSync(join(root, 'src/styles/pepito.css'), 'utf8');
assert.match(darkCss, /\[data-theme=['"]dark['"]\]/, 'dark token block present');
assert.match(darkCss, /--pepito-soft/, 'pepito soft remapped');
assert.match(darkCss, /--admin-bg/, 'admin tokens remapped');
assert.match(darkCss, /--tg-in/, 'chat tokens remapped');
assert.match(darkCss, /\.tg-chat-list-meta small/, 'chat list subtitle contrast remapped');
assert.match(darkCss, /\.tg-chat-list-kind\b/, 'chat kind pills remapped for dark');
assert.match(darkCss, /\.tg-chat-list-badge\.is-ended/, 'chat ended badge remapped');
assert.match(darkCss, /\.tg-thread-empty/, 'chat empty pane remapped');
assert.match(darkCss, /\.tg-request-card\b/, 'playmate request card remapped');
assert.match(darkCss, /\.tg-ended-bar\b/, 'end-of-chat wipe bar remapped');
assert.match(darkCss, /\.tg-chat-wallpaper/, 'chat message wallpaper remapped for dark');
assert.match(darkCss, /--tg-wall-a:\s*#171a24/, 'chat wall token remapped off light #eef2f6');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,120}\.tg-chat-wallpaper[\s\S]{0,280}#(eef3f7|e7eef4|eef2f6|ecf2f6|f7f8fb)\b/i,
  'dark wallpaper must not keep light canvas stops'
);
assert.match(darkCss, /\.tg-status-strip\b/, 'consult active status strip remapped for dark');
assert.match(darkCss, /\.pepito-vet-chat \.tg-status-strip\.is-wait/, 'consult wait strip remapped for dark');
assert.match(darkCss, /\.tg-composer\b/, 'chat composer dock remapped for dark');
assert.match(darkCss, /\.tg-composer textarea/, 'chat composer input remapped for dark');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-composer[\s\S]{0,120}#(f7f9fc|f7f8fb|fff|ffffff)\b/i,
  'dark composer must not keep light strip stops'
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-status-strip[\s\S]{0,160}#(eef9ff|e8fff7|e6fbf4|eef8ff)\b/i,
  'dark status strip must not keep light cyan stops'
);
assert.match(darkCss, /\.tg-chat-link-btn--outline/, 'outline secondary chat CTA remapped');
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

/* Pass 4: logged-in app shell — no leftover white canvases */
assert.match(darkCss, /\.pepito-app-main\b/, 'app main canvas remapped');
assert.match(darkCss, /\.pepito-home-action\b/, 'home action cards remapped');
assert.match(darkCss, /\.pepito-vet-hero\b/, 'vet/trainer hero remapped');
assert.match(darkCss, /\.pepito-vet-online-card\.is-online/, 'vet online card remapped');
/* No muddy mint/teal radial wash on dark vet desk surfaces */
assert.doesNotMatch(
  darkCss,
  /\.pepito-vet-hero\s*\{[^}]*radial-gradient[^}]*45,\s*212,\s*176/,
  'vet hero has no green radial wash in dark',
);
assert.doesNotMatch(
  darkCss,
  /\.pepito-vet-online-card\.is-online\s*\{[^}]*radial-gradient/,
  'vet online card has no radial wash in dark',
);
assert.match(
  darkCss,
  /\.pepito-vet-online-card\.is-online\s*\{[^}]*border-color:\s*color-mix\(in srgb,\s*var\(--pepito-mint\)/,
  'vet online keeps mint border accent in dark',
);
assert.match(darkCss, /\.pepito-invite-card\b/, 'invite friends card remapped');
assert.match(darkCss, /\.pepito-invite-card \.pepito-eyebrow/, 'invite eyebrow keeps accent in dark');
assert.match(pepitoCss, /\.pepito-invite-actions \.pepito-btn[\s\S]*?min-height:\s*36px/, 'invite buttons keep ≥36px tap target');
assert.match(pepitoCss, /\.pepito-invite-card\s*\{[\s\S]*?padding:\s*0\.65rem/, 'invite card uses compact padding');
assert.match(darkCss, /\.pepito-role-switch-item\b/, 'role switch pills remapped');
assert.match(darkCss, /\.pepito-support-bubble\.is-assistant/, 'support chat bubbles remapped');
assert.match(darkCss, /\.pepito-support-composer input/, 'support composer remapped');
assert.match(darkCss, /\.pepito-vet-inbox-panel--incoming/, 'vet inbox panels remapped');

/* Skeleton placeholders — no leftover light/white shimmer bars in dark */
assert.match(darkCss, /--pd-skeleton-from/, 'skeleton shimmer tokens present');
assert.match(darkCss, /\.tg-skeleton\b/, 'chat skeleton remapped for dark');
assert.match(darkCss, /\.pepito-my-pets-card\.is-skeleton/, 'my-pets skeleton remapped for dark');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,200}\.tg-skeleton[\s\S]{0,180}#(eceff4|f7f8fb|f3f1f7|faf9fc|fff)\b/i,
  'dark skeleton must not keep light gray / white stops'
);

/* Pet medical record (#pet-medical) — orphan #faf9fc shell must not survive dark */
assert.match(darkCss, /#pet-medical\.pepito-pet-medical/, 'medical shell uses #pet-medical id override');
assert.match(darkCss, /\.pepito-pet-medical-card\b/, 'medical info tiles remapped');
assert.match(darkCss, /\.pepito-pet-wishlist\b/, 'pet wishlist remapped');
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-pet-medical\s*\{[^}]*#faf9fc/,
  'medical shell must not hardcode #faf9fc (use --pd-surface-2)'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-pet-wishlist-grid li\s*\{[^}]*#faf9fc/,
  'wishlist tiles must not hardcode #faf9fc'
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}#pet-medical\.pepito-pet-medical[\s\S]{0,220}var\(--pd-surface\)/,
  'dark medical shell paints --pd-surface (not leftover light canvas)'
);

const toggle = readFileSync(join(root, 'src/components/ThemeToggle.tsx'), 'utf8');
assert.match(toggle, /toggleTheme|setTheme/, 'ThemeToggle mutates theme');
assert.match(toggle, /aria-label/, 'ThemeToggle accessible');
assert.match(toggle, /title=\{aria\}/, 'ThemeToggle title for tooltip/a11y');
assert.doesNotMatch(toggle, /pd-theme-toggle-label|theme\.toLight|theme\.toDark/, 'ThemeToggle is icon-only (no روشن/خاموش / Light/Dark)');
assert.match(toggle, /Sun|Moon/, 'ThemeToggle renders sun/moon icon');

const landing = readFileSync(join(root, 'src/components/LandingChrome.tsx'), 'utf8');
assert.match(landing, /ThemeToggle/, 'landing chrome exposes toggle');

const welcome = readFileSync(join(root, 'src/pages/WelcomePage.tsx'), 'utf8');
assert.match(welcome, /ThemeToggle/, 'welcome header exposes toggle');

const adminLayout = readFileSync(join(root, 'src/admin/AdminLayout.tsx'), 'utf8');
assert.match(adminLayout, /ThemeToggle/, 'admin topbar exposes toggle');

const adminLogin = readFileSync(join(root, 'src/admin/pages/AdminLoginPage.tsx'), 'utf8');
assert.match(adminLogin, /ThemeToggle/, 'admin login exposes toggle');

console.log('theme.selftest: ok');
