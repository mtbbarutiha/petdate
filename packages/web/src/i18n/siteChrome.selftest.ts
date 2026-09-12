/**
 * Guard: public/app chrome keys exist in FA + EN, and role rails / badges
 * go through t() — not hardcoded English or leftover Persian.
 * Run: npx tsx packages/web/src/i18n/siteChrome.selftest.ts
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

const faKeys = new Set(collectKeys(faDict as Record<string, unknown>));
const enKeys = new Set(collectKeys(enDict as Record<string, unknown>));
const tFa = createTranslator(faDict);
const tEn = createTranslator(enDict, faDict);

const REQUIRED = [
  'common.home',
  'nav.trainer_panel',
  'nav.vet_panel',
  'nav.conversations',
  'nav.petShop',
  'nav.games',
  'nav.profile',
  'nav.support',
  'nav.playmate',
  'nav.my_pets',
  'nav.chats',
  'nav.wallet',
  'nav.panel',
  'nav.faq',
  'nav.manage',
  'nav.manageEdit',
  'nav.manageInteractions',
  'nav.manageEarn',
  'nav.manageBlocked',
  'nav.manageAccount',
  'consultDesk.statusClosed',
  'consultDesk.statusExpired',
  'consultDesk.statusActive',
  'consultDesk.statusWaiting',
  'consultDesk.statusCancelled',
  'consultDesk.statusBusyWithPet',
  'consultDesk.titleTrainer',
  'consultDesk.titleVet',
  'consultDesk.chatClosedHint',
  'consultDesk.incomingTitle',
  'consultDesk.recentTitle',
  'consultDesk.online',
  'consultDesk.offline',
  'consultDesk.credVerified',
  'chats.closed',
  'chats.ended',
  'chats.expired',
  'chats.active',
  'chats.expiredBadge',
  'verify.faceVerified',
  'verify.facePending',
  'verify.faceCta',
  'roles.pet_owner',
  'roles.vet',
  'roles.trainer',
  'roles.no_pet',
  'roles.myRoles',
  'roles.addRole',
  'support.title',
  'support.ticketCta',
  'support.chatCta',
  'games.statusOpen',
  'games.statusFull',
  'profile.panelVerify',
] as const;

for (const key of REQUIRED) {
  assert.ok(faKeys.has(key), `FA catalog missing ${key}`);
  assert.ok(enKeys.has(key), `EN catalog missing ${key}`);
  const fa = tFa(key);
  const en = tEn(key);
  assert.notEqual(fa, key, `FA ${key} fell through to the key`);
  assert.notEqual(en, key, `EN ${key} fell through to the key`);
  assert.match(fa, PERSIAN, `FA ${key} must be Persian`);
  assert.doesNotMatch(en, PERSIAN, `EN ${key} must not contain Persian`);
}

assert.equal(tFa('common.home'), 'خانه');
assert.equal(tEn('common.home'), 'Home');
assert.equal(tFa('nav.trainer_panel'), 'پنل مربی');
assert.equal(tEn('nav.trainer_panel'), 'Trainer panel');
assert.equal(tFa('nav.conversations'), 'گفتگوها');
assert.equal(tEn('nav.conversations'), 'Chats');
assert.equal(tFa('consultDesk.statusClosed'), 'بسته شده');
assert.equal(tEn('consultDesk.statusClosed'), 'Closed');
assert.equal(tFa('consultDesk.statusExpired'), 'منقضی شده');
assert.equal(tEn('consultDesk.statusExpired'), 'Expired');
assert.equal(tFa('chats.closed'), 'بسته شده');
assert.equal(tEn('chats.closed'), 'Closed');
assert.equal(tFa('verify.faceVerified'), 'احراز چهره شده');
assert.equal(tEn('verify.faceVerified'), 'Face verified');
assert.equal(tFa('nav.manageEdit'), 'ویرایش پروفایل');
assert.equal(tEn('nav.manageEdit'), 'Edit profile');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'components/Layout.tsx'), 'utf8');
assert.match(layout, /labelKey: 'nav\.trainer_panel'/, 'trainer rail uses trainer_panel key');
assert.match(layout, /labelKey: 'nav\.vet_panel'/, 'vet rail uses vet_panel key');
assert.match(layout, /labelKey: 'nav\.conversations'/, 'provider rail uses conversations key');
assert.match(layout, /labelKey: 'common\.home'/, 'rails use common.home');
assert.match(layout, /t\(item\.labelKey\)/, 'rail labels go through t()');
assert.doesNotMatch(layout, /Trainer panel|Pet shop|Edit profile/, 'rail must not hardcode EN labels');

const manage = readFileSync(join(root, 'components/ProfileManageNav.tsx'), 'utf8');
assert.match(manage, /faceVerifyChromeLabel/, 'manage nav uses i18n face-verify label');
assert.match(manage, /nav\.manageEdit/, 'manage edit key');
assert.match(manage, /nav\.manageAccount/, 'manage account key');
assert.doesNotMatch(manage, /faceVerifyButtonLabel/, 'shared FA face-verify helper stays off site chrome');

const trainer = readFileSync(join(root, 'pages/ServiceConsultPage.tsx'), 'utf8');
assert.match(trainer, /consultDesk\.statusClosed/, 'trainer desk closed badge is translated');
assert.match(trainer, /consultDesk\.statusExpired/, 'trainer desk expired badge is translated');
assert.match(trainer, /consultDesk\.chatClosedHint/, 'trainer closed-chat hint is translated');
assert.match(trainer, /consultDesk\.titleTrainer/, 'trainer title is translated');
assert.match(trainer, /dir=\{dir\}/, 'trainer desk follows language direction');
assert.doesNotMatch(trainer, /['"]Closed['"]|['"]Expired['"]/, 'trainer desk must not hardcode EN badges');

const vet = readFileSync(join(root, 'pages/VetConsultPage.tsx'), 'utf8');
assert.match(vet, /consultDesk\.statusClosed/, 'vet desk closed badge is translated');
assert.match(vet, /consultDesk\.titleVet/, 'vet title is translated');
assert.match(vet, /credentialChromeLabel/, 'vet credential pill is translated');

const chats = readFileSync(join(root, 'pages/ChatPage.tsx'), 'utf8');
assert.match(chats, /chats\.closed/, 'inbox closed badge uses chats.closed');
assert.match(chats, /chats\.activeShort/, 'inbox active badge uses i18n');
assert.doesNotMatch(
  chats,
  /tg-chat-list-badge is-ended[\s\S]{0,80}بسته شده/,
  'inbox closed badge must not hardcode Persian'
);

const dock = readFileSync(join(root, 'components/LandingMobileDock.tsx'), 'utf8');
assert.match(dock, /t\(`nav\.\$\{item\.key\}`\)/, 'mobile dock labels use nav keys');

const desktop = readFileSync(join(root, 'components/SiteDesktopNav.tsx'), 'utf8');
assert.match(desktop, /t\(`nav\.\$\{item\.key\}`\)/, 'desktop shortcuts use nav keys');

const wallet = readFileSync(join(root, 'components/WalletChip.tsx'), 'utf8');
assert.match(wallet, /nav\.wallet/, 'wallet chip uses nav.wallet');

const roles = readFileSync(join(root, 'components/RoleSwitchControl.tsx'), 'utf8');
assert.match(roles, /useI18n/, 'role switcher uses i18n');
assert.match(roles, /roles\.\$\{role\}/, 'role names use catalog keys');

console.log(`siteChrome.selftest: ok (${REQUIRED.length} chrome keys)`);
