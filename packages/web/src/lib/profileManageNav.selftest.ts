/**
 * Guard: profile «مدیریت» actions live in the app rail / avatar menu / mobile dock sheet,
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
const dock = readFileSync(join(root, 'components/LandingMobileDock.tsx'), 'utf8');

assert.match(layout, /ProfileManageNav/, 'Layout rail includes ProfileManageNav');
assert.match(menu, /ProfileManageNav/, 'avatar menu includes ProfileManageNav');
assert.match(menu, /createPortal/, 'avatar menu is portaled so header overflow cannot eat the click');
assert.match(menu, /data-profile-menu/, 'menu marks itself so outside-click does not swallow item taps');
assert.match(dock, /toggleProfileMenu/, 'profile tap opens the shared profile menu');
assert.match(dock, /data-profile-menu-anchor/, 'dock avatar is a profile-menu anchor');
assert.doesNotMatch(dock, /setManageOpen/, 'dock does not keep a second manage sheet');
assert.match(manageNav, /'sheet'/, 'ProfileManageNav supports sheet variant');
assert.match(manageNav, /\/profile\?edit=1/, 'edit deep-link');
assert.match(manageNav, /\/profile\?panel=verify/, 'verify deep-link');
assert.match(manageNav, /\/profile\?panel=interactions/, 'interactions deep-link');
assert.match(manageNav, /\/wallet\/earn/, 'earn link');
assert.match(manageNav, /\/profile\?panel=blocked/, 'blocked deep-link');
assert.match(manageNav, /\/profile\?panel=account/, 'account deep-link');
assert.match(manageNav, /key: 'phone'/, 'phone verify sits in manage nav');
assert.match(manageNav, /phoneVerifyPath/, 'unverified phone opens the existing OTP route');
assert.match(manageNav, /status: phoneVerified/, 'verified phone is a status row, not a broken CTA');
const earnAt = manageNav.indexOf("key: 'earn'");
const phoneAt = manageNav.indexOf("key: 'phone'");
const verifyAt = manageNav.indexOf("key: 'verify'");
const accountAt = manageNav.indexOf("key: 'account'");
assert.ok(
  earnAt > 0 && phoneAt > earnAt && verifyAt > phoneAt && accountAt > verifyAt,
  'manage: everyday → finance → phone → face verify → delete last',
);
assert.match(manageNav, /tone: 'finance'/, 'earn uses finance tone');
assert.match(manageNav, /tone: 'danger'/, 'account delete uses danger tone');
assert.doesNotMatch(manageNav, /سایلنت|silent-chat|silentChat/, 'mute stays icon elsewhere');
assert.doesNotMatch(profile, /pepito-profile-manage/, 'profile page removed manage stack');
assert.match(profile, /panelParam|searchParams\.get\(['"]panel['"]\)/, 'profile panels open via ?panel=');
assert.match(profile, /RoleSwitchControl/, 'role switcher remains on profile');

console.log('profileManageNav.selftest.ts: ok');
