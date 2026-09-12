/**
 * Guard: profile «مدیریت» actions live in the app rail / avatar menu,
 * not as a duplicate stack on /profile. Silent-chat stays off this list.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'components/Layout.tsx'), 'utf8');
const manageNav = readFileSync(join(root, 'components/ProfileManageNav.tsx'), 'utf8');
const profile = readFileSync(join(root, 'pages/ProfilePage.tsx'), 'utf8');
const menu = readFileSync(join(root, 'components/ProfileMenu.tsx'), 'utf8');

assert.match(layout, /ProfileManageNav/, 'Layout rail includes ProfileManageNav');
assert.match(menu, /ProfileManageNav/, 'avatar menu includes ProfileManageNav for mobile');
assert.match(manageNav, /\/profile\?edit=1/, 'edit deep-link');
assert.match(manageNav, /\/profile\?panel=verify/, 'verify deep-link');
assert.match(manageNav, /\/profile\?panel=interactions/, 'interactions deep-link');
assert.match(manageNav, /\/wallet\/earn/, 'earn link');
assert.match(manageNav, /\/profile\?panel=blocked/, 'blocked deep-link');
assert.match(manageNav, /\/profile\?panel=account/, 'account deep-link');
assert.doesNotMatch(manageNav, /سایلنت|silent-chat|silentChat/, 'mute stays icon elsewhere');
assert.doesNotMatch(profile, /pepito-profile-manage/, 'profile page removed manage stack');
assert.match(profile, /panelParam|searchParams\.get\(['"]panel['"]\)/, 'profile panels open via ?panel=');
assert.match(profile, /RoleSwitchControl/, 'role switcher remains on profile');

console.log('profileManageNav.selftest.ts: ok');
