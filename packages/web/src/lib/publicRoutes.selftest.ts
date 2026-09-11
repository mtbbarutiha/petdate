/**
 * Public marketing routes must stay reachable without login.
 * Run: npx tsx packages/web/src/lib/publicRoutes.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const guard = readFileSync(join(webSrc, 'components/AuthGuard.tsx'), 'utf8');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');
const welcome = readFileSync(join(webSrc, 'pages/WelcomePage.tsx'), 'utf8');
const landing = readFileSync(join(webSrc, 'pages/VetConsultLandingPage.tsx'), 'utf8');
const route = readFileSync(join(webSrc, 'pages/VetConsultRoute.tsx'), 'utf8');

assert.match(guard, /PUBLIC_EXACT[\s\S]*\/vet-consult/, 'AuthGuard treats /vet-consult as public');
assert.match(guard, /PUBLIC_PREFIXES[\s\S]*\/magazine/, 'AuthGuard treats /magazine as public');
assert.match(guard, /\/adoption/, 'AuthGuard treats /adoption as public');
assert.match(app, /path="adoption"\s+element=\{<AdoptionListPage/, 'App registers /adoption listing');
assert.match(
  app,
  /path="vet-consult"\s+element=\{<VetConsultRoute/,
  'App registers /vet-consult as VetConsultRoute'
);
assert.doesNotMatch(
  app,
  /element=\{<Layout[\s\S]*path="vet-consult"/,
  'guest /vet-consult is not nested under the Layout route'
);
assert.match(route, /VetConsultLandingPage/, 'logged-out vet-consult uses marketing landing');
assert.match(route, /<Layout>/, 'logged-in vet-consult keeps app shell');
assert.match(landing, /LandingChrome/, 'vet landing uses marketing chrome');
assert.match(landing, /loginPath\('\/vet-consult'\)/, 'vet landing login returns to consult');
assert.doesNotMatch(landing, /pepito-app-rail/, 'vet landing has no app sidebar');
assert.match(welcome, /<Link to="\/adoption">پذیرش<\/Link>/, 'homepage پذیرش CTA goes to /adoption');
assert.doesNotMatch(welcome, /href="#pets">پذیرش/, 'homepage پذیرش no longer uses #pets');

// Marketing hero: fixed role order همبازی → دامپزشک → مربی → بدون پت
const playmateIdx = welcome.indexOf("role: 'playmate'");
const vetIdx = welcome.indexOf("role: 'vet'");
const trainerIdx = welcome.indexOf("role: 'trainer'");
const noPetIdx = welcome.indexOf("role: 'no_pet'");
assert.ok(playmateIdx > 0 && vetIdx > playmateIdx, 'hero playmate before vet');
assert.ok(trainerIdx > vetIdx, 'hero vet before trainer');
assert.ok(noPetIdx > trainerIdx, 'hero trainer before no_pet');
assert.match(welcome, /hero-playmate-cta/, 'hero playmate CTA testid');
assert.match(welcome, /hero-vet-consult-cta/, 'hero vet CTA testid');
assert.match(welcome, /hero-trainer-cta/, 'hero trainer CTA testid');
assert.match(welcome, /hero-no-pet-cta/, 'hero no-pet CTA testid');
assert.match(welcome, /to: '\/chats'/, 'playmate deep-links to /chats');
assert.match(welcome, /to: '\/vet-consult'/, 'vet deep-links to /vet-consult');
assert.match(welcome, /to: '\/trainer-consult'/, 'trainer deep-links to /trainer-consult');
assert.match(welcome, /to: '\/onboarding\/role'/, 'no-pet deep-links to role onboarding');
assert.doesNotMatch(welcome, /پیدا کردن پرستار|مراقبت شبانه|نگهداری پت/, 'no sitter leftover CTAs on welcome');

console.log('publicRoutes.selftest: ok');
