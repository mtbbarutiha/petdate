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
assert.match(darkCss, /\.tg-request-card-photo\b/, 'playmate request counterpart photo remapped');
assert.match(darkCss, /\.tg-request-card-owner\b/, 'playmate request owner thumb remapped');
assert.match(
  darkCss,
  /\.tg-request-card-cover:not\(\.is-placeholder\)::after/,
  'dark request cover scrim remapped for full-bleed photo'
);
assert.match(darkCss, /\.tg-ended-bar\b/, 'end-of-chat wipe bar remapped');
assert.match(darkCss, /\.tg-chat-wallpaper/, 'chat message wallpaper remapped for dark');
assert.match(darkCss, /--tg-wall-a:\s*#171a24/, 'chat wall token remapped off light #eef2f6');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,120}\.tg-chat-wallpaper[\s\S]{0,280}#(eef3f7|e7eef4|eef2f6|ecf2f6|f7f8fb)\b/i,
  'dark wallpaper must not keep light canvas stops'
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,160}\.tg-chat-wallpaper[\s\S]{0,900}data:image\/svg\+xml/,
  'dark chat wallpaper uses SVG paw-print tile'
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,160}\.tg-chat-wallpaper[\s\S]{0,900}radial-gradient\([^)]*1px,\s*transparent\s*1px\)/,
  'dark chat wallpaper must not keep 1px dot grid'
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
assert.match(darkCss, /\.tk-msg--public/, 'ticket public bubble remapped');
assert.match(darkCss, /\.tk-msg--internal/, 'ticket internal bubble remapped');
assert.match(darkCss, /--admin-msg-public-bg:/, 'ticket public bubble token remapped');
assert.match(darkCss, /--admin-msg-internal-bg:/, 'ticket internal bubble token remapped');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.admin-app[\s\S]{0,400}--admin-msg-internal-bg:\s*#(fff8eb|fff7e8|fff8f0)/i,
  'dark internal ticket bubble must not stay cream #fff8eb'
);
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
assert.match(darkCss, /\.pepito-support-hub/, 'support hub remapped');
assert.match(darkCss, /\.pepito-support-choice/, 'support chooser remapped');
assert.match(darkCss, /\.pepito-support-ticket-form input/, 'support ticket form remapped');
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

/* Earn / withdraw («کسب درآمد») — cream/white cards must not survive dark */
assert.match(darkCss, /\.pepito-earn-hero\b/, 'earn hero remapped for dark');
assert.match(darkCss, /\.pepito-earn-balance-main\b/, 'earn balance card remapped');
assert.match(darkCss, /\.pepito-earn-meta\b/, 'earn rates meta remapped');
assert.match(darkCss, /\.pepito-earn-how\b/, 'earn process steps remapped');
assert.match(darkCss, /\.pepito-earn-form-wrap\b/, 'earn withdraw form remapped');
assert.match(darkCss, /\.pepito-earn-field input/, 'earn inputs remapped for dark');
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.pepito-earn-(hero|balance-main|meta|how|form-wrap|history-item)[\s\S]{0,220}#(fff8f0|fff7ee|fff7ed|fafafa|f5f5f5|ffffff)\b/i,
  'dark earn surfaces must not keep cream/white hardcodes'
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.pepito-earn-balance-main[\s\S]{0,280}var\(--pd-surface/,
  'dark earn balance paints --pd-surface tokens'
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.pepito-earn-field input[\s\S]{0,120}var\(--pd-surface-2\)/,
  'dark earn inputs use elevated --pd-surface-2'
);

/* Edit profile (ویرایش پروفایل) — no orphan white section cards / light sticky fog */
assert.match(darkCss, /\.pepito-profile-edit-section\b/, 'edit profile sections remapped for dark');
assert.match(darkCss, /\.pepito-profile-edit-section-title\b/, 'edit section titles remapped for dark');
assert.match(darkCss, /\.pepito-profile-edit-actions\b/, 'edit sticky save bar remapped for dark');
assert.match(pepitoCss, /\.pepito-profile-edit-section\s*\{[\s\S]*?var\(--pd-surface\)/, 'edit sections use --pd-surface');
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-profile-edit-section\s*\{[^}]*rgba\(255,\s*255,\s*255/,
  'edit sections must not hardcode white rgba cards'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-field\s*>\s*span\s*\{[^}]*#4a3d78/,
  'edit field labels must not hardcode navy #4a3d78'
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-profile-edit-actions\s*\{[^}]*rgba\(244,\s*244,\s*247/,
  'edit sticky bar must not hardcode light #f4f4f7 fade'
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.pepito-profile-edit-section[\s\S]{0,160}var\(--pd-surface\)/,
  'dark edit sections paint --pd-surface'
);

/* Help / FAQ (/faq + /help) — no leftover #fff cards or hardcoded dark ink */
assert.match(darkCss, /\.pepito-faq-item\b/, 'FAQ accordion remapped for dark');
assert.match(darkCss, /\.pepito-help-card\b/, 'help role cards remapped for dark');
assert.match(darkCss, /\.pepito-help-topic\b/, 'help topic chips remapped for dark');
assert.match(darkCss, /\.pepito-help-toc a\b/, 'help TOC chips remapped for dark');
assert.match(pepitoCss, /--pepito-card:\s*var\(--pepito-white\)/, 'pepito-card tracks white token');
assert.match(pepitoCss, /--pepito-ink:\s*var\(--pepito-dark\)/, 'pepito-ink tracks dark token');
assert.match(
  pepitoCss,
  /\.pepito-help-card,\s*\.pepito-help-section\s*\{[\s\S]{0,220}var\(--pd-surface/,
  'help cards use --pd-surface (not hardcoded #fff)',
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-help-card,\s*\.pepito-help-section\s*\{[^}]*#fff\b/,
  'help cards must not hardcode #fff',
);
assert.doesNotMatch(
  pepitoCss,
  /\.pepito-help-dl dd\s*\{[^}]*#2b2440/,
  'help answers must not hardcode light-only ink #2b2440',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,200}\.pepito-help-card[\s\S]{0,220}var\(--pd-surface\)/,
  'dark help cards paint --pd-surface',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,200}\.pepito-faq-q[\s\S]{0,280}var\(--pd-ink\)/,
  'dark FAQ questions use --pd-ink',
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.pepito-(faq-item|help-card|help-section|help-topic)[\s\S]{0,160}#(fff|ffffff|faf9fc)\b/i,
  'dark FAQ/help surfaces must not keep white fills',
);

/* Chat profile tools + sheets (پروفایل پت / پروفایل صاحب پت) — no white strip / white field cards */
const chatCss = readFileSync(join(root, 'src/styles/chat.css'), 'utf8');
assert.match(darkCss, /\.tg-vet-tools\b/, 'vet/profile toolbar remapped for dark');
assert.match(darkCss, /\.tg-vet-sheet\b/, 'vet/profile sheet remapped for dark');
assert.match(darkCss, /\.tg-vet-pet-card dl > div/, 'pet/owner profile field cards remapped');
assert.match(darkCss, /\.tg-vet-pet-card dt\b/, 'profile field labels remapped');
assert.match(darkCss, /\.tg-vet-pet-card dd\b/, 'profile field values remapped');
assert.match(darkCss, /\.tg-vet-sheet-close\b/, 'sheet close button remapped');
assert.match(darkCss, /\.tg-info-card\b/, 'playmate info card remapped for dark');
assert.match(chatCss, /\.tg-vet-tools[\s\S]{0,280}var\(--pd-surface-muted/, 'toolbar uses --pd-surface-muted');
assert.match(chatCss, /\.tg-vet-sheet\s*\{[\s\S]{0,420}var\(--pd-surface/, 'sheet uses --pd-surface');
assert.match(chatCss, /\.tg-vet-pet-card dl > div[\s\S]{0,180}var\(--pd-surface-2/, 'field cards use --pd-surface-2');
assert.doesNotMatch(
  chatCss,
  /\.tg-vet-tools[\s\S]{0,220}rgba\(\s*247\s*,\s*249\s*,\s*252/,
  'toolbar must not hardcode light rgba(247,249,252)',
);
assert.doesNotMatch(
  chatCss,
  /\.tg-vet-pet-card dl > div[\s\S]{0,160}#f7f8fb\b/,
  'field cards must not hardcode #f7f8fb',
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-vet-tools[\s\S]{0,160}#(f7f9fc|f7f8fb|fff|ffffff)\b/i,
  'dark profile toolbar must not keep light strip stops',
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-vet-pet-card dl > div[\s\S]{0,160}#(f7f8fb|faf9fc|fff|ffffff)\b/i,
  'dark profile field cards must not keep white fills',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-vet-pet-card dt[\s\S]{0,80}var\(--pd-muted\)/,
  'dark field labels use muted-light --pd-muted',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.tg-vet-pet-card dd[\s\S]{0,80}var\(--pd-ink\)/,
  'dark field values use high-contrast --pd-ink',
);

const toggle = readFileSync(join(root, 'src/components/ThemeToggle.tsx'), 'utf8');
assert.match(toggle, /toggleTheme|setTheme/, 'ThemeToggle mutates theme');
assert.match(toggle, /aria-label/, 'ThemeToggle accessible');
assert.match(toggle, /title=\{aria\}/, 'ThemeToggle title for tooltip/a11y');
assert.doesNotMatch(toggle, /pd-theme-toggle-label|theme\.toLight|theme\.toDark/, 'ThemeToggle is icon-only (no روشن/خاموش / Light/Dark)');
assert.match(toggle, /Sun|Moon/, 'ThemeToggle renders sun/moon icon');

const landing = readFileSync(join(root, 'src/components/LandingChrome.tsx'), 'utf8');
assert.match(landing, /SiteHeader/, 'landing chrome uses shared header');

const siteHeader = readFileSync(join(root, 'src/components/SiteHeader.tsx'), 'utf8');
assert.match(siteHeader, /ThemeToggle/, 'shared header exposes toggle');

const welcome = readFileSync(join(root, 'src/pages/WelcomePage.tsx'), 'utf8');
assert.match(welcome, /SiteHeader/, 'welcome header uses shared chrome');

const adminLayout = readFileSync(join(root, 'src/admin/AdminLayout.tsx'), 'utf8');
assert.match(adminLayout, /ThemeToggle/, 'admin topbar exposes toggle');

const adminLogin = readFileSync(join(root, 'src/admin/pages/AdminLoginPage.tsx'), 'utf8');
assert.match(adminLogin, /ThemeToggle/, 'admin login exposes toggle');

/* Chip / metric wells — frozen white fills + remapped pale ink = unreadable dark pills */
const adminCss = readFileSync(join(root, 'src/styles/admin.css'), 'utf8');
assert.match(adminCss, /\.tk-msg--public[\s\S]{0,80}var\(--admin-msg-public-bg\)/, 'public bubble uses token');
assert.match(adminCss, /\.tk-msg--internal[\s\S]{0,80}var\(--admin-msg-internal-bg\)/, 'internal bubble uses token');
assert.match(adminCss, /--admin-chip-bg:/, 'admin chip fill token present');
assert.match(adminCss, /--admin-chip-well:/, 'admin chip well token present');
assert.match(adminCss, /--admin-chip-label:/, 'admin chip label token present');
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.admin-app[\s\S]{0,900}--admin-chip-bg:/,
  'dark remaps --admin-chip-bg',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.admin-app[\s\S]{0,900}--admin-chip-well:/,
  'dark remaps --admin-chip-well',
);
assert.match(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.admin-app[\s\S]{0,900}--admin-chip-label:/,
  'dark remaps --admin-chip-label',
);
assert.doesNotMatch(
  darkCss,
  /html\[data-theme=['"]dark['"]\][\s\S]{0,80}\.admin-app[\s\S]{0,900}--admin-chip-bg:\s*(#f[0-9a-fA-F]{5}|rgba\(\s*255)/,
  'dark --admin-chip-bg must not stay a light wash',
);
assert.match(darkCss, /--pd-chip-bg:\s*var\(--pd-surface-2\)/, 'public chip token remapped');
assert.match(pepitoCss, /\.pepito-home-action[\s\S]{0,280}var\(--pd-chip-bg/, 'home action uses --pd-chip-bg');
assert.match(pepitoCss, /\.pd-shop-cart-link[\s\S]{0,280}var\(--pd-chip-bg/, 'shop cart chip uses --pd-chip-bg');

const chipTokenSelectors: Array<{ name: string; re: RegExp }> = [
  { name: '.sales-commission-side div', re: /\.sales-commission-side div\s*\{[^}]*var\(--admin-chip-bg\)/ },
  { name: '.crm-report-counters / .crm-report-stat-tile', re: /\.crm-report-stat-tile[\s\S]{0,220}var\(--admin-chip-bg\)/ },
  { name: '.admin-stat-icon', re: /\.admin-stat--slate \.admin-stat-icon[\s\S]{0,80}var\(--admin-chip-bg\)/ },
  { name: '.admin-dash-kpi-icon', re: /\.admin-dash-kpi-icon[\s\S]{0,200}var\(--admin-chip-bg\)/ },
  { name: '.tk-tag--muted', re: /\.tk-tag--muted[\s\S]{0,160}var\(--admin-chip-(well|bg)\)/ },
  { name: '.wdg-catalog', re: /\.wdg-catalog\s*\{[\s\S]{0,220}var\(--admin-chip-well\)/ },
  { name: '.wdg-drill-detail', re: /\.wdg-drill-detail\s*\{[\s\S]{0,280}var\(--admin-chip-well\)/ },
  { name: '.admin-widget-picker-group li', re: /\.admin-widget-picker-group li\s*\{[\s\S]{0,280}var\(--admin-chip-well\)/ },
  { name: '.sales-pipe-col', re: /\.sales-pipe-col\s*\{[\s\S]{0,400}var\(--admin-chip-well\)/ },
  { name: '.admin-pill--slate', re: /\.admin-pill--slate\s*\{[\s\S]{0,160}var\(--admin-chip-well\)/ },
];
for (const { name, re } of chipTokenSelectors) {
  assert.match(adminCss, re, `${name} uses chip theme tokens`);
}

assert.match(darkCss, /\.sales-commission-side div/, 'dark remaps sales commission chips');
assert.doesNotMatch(
  adminCss,
  /\.sales-commission-side div\s*\{[^}]*rgba\(\s*255\s*,\s*255\s*,\s*255/,
  'commission chips must not hardcode white wash',
);

const leftoverLightFills = [
  ...adminCss.matchAll(
    /\.(sales-commission-side|crm-report-counters|crm-report-stat-tile|admin-stat-icon|admin-dash-kpi-icon|tk-tag--muted|wdg-catalog|wdg-drill-detail|admin-chip|admin-pill--slate)[^{]*\{[^}]*background:\s*(rgba\(\s*255\s*,\s*255\s*,\s*255|#f7f8fb|#fafbfc|#f4f6f8)/gi,
  ),
];
assert.equal(
  leftoverLightFills.length,
  0,
  `known chip/stat selectors must not hardcode light fills: ${leftoverLightFills.map((m) => m[0].slice(0, 80)).join(' | ')}`,
);

console.log('theme.selftest: ok');
