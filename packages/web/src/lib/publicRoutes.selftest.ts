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
const footer = readFileSync(join(webSrc, 'components/SiteFooter.tsx'), 'utf8');
const faq = readFileSync(join(webSrc, 'pages/FaqPage.tsx'), 'utf8');
const chrome = readFileSync(join(webSrc, 'components/LandingChrome.tsx'), 'utf8');
const hashRedirect = readFileSync(join(webSrc, 'components/LegacyAdoptionHashRedirect.tsx'), 'utf8');
const dock = readFileSync(join(webSrc, 'components/LandingMobileDock.tsx'), 'utf8');

assert.match(guard, /PUBLIC_EXACT[\s\S]*\/vet-consult/, 'AuthGuard treats /vet-consult as public');
assert.match(guard, /PUBLIC_PREFIXES[\s\S]*\/magazine/, 'AuthGuard treats /magazine as public');
assert.match(guard, /\/adoption/, 'AuthGuard treats /adoption as public');
assert.match(guard, /\/pet/, 'AuthGuard treats /pet as public');
assert.match(app, /path="adoption"\s+element=\{<AdoptionListPage/, 'App registers /adoption listing');
assert.match(app, /path="pet\/:slugOrId"\s+element=\{<PublicPetPage/, 'App registers public /pet/:slug');
assert.doesNotMatch(
  app,
  /element=\{<Layout[\s\S]*path="pet\/:slugOrId"/,
  'public /pet/:slug is not nested under the Layout route'
);
assert.match(app, /import \{ VetConsultRoute \}/, 'guest vet landing is in the main bundle (not a lazy chunk)');
assert.match(
  app,
  /path="vet-consult"\s+element=\{<VetConsultRoute/,
  'App registers /vet-consult as VetConsultRoute'
);
assert.doesNotMatch(
  app,
  /const VetConsultRoute = lazy/,
  'VetConsultRoute is not a lazy import that can 404 behind an old SW'
);
assert.doesNotMatch(
  app,
  /element=\{<Layout[\s\S]*path="vet-consult"/,
  'guest /vet-consult is not nested under the Layout route'
);
assert.match(app, /<LegacyAdoptionHashRedirect/, 'App mounts /#pets → /adoption redirect');
assert.match(route, /VetConsultLandingPage/, 'logged-out vet-consult uses marketing landing');
assert.match(route, /<Layout>/, 'logged-in vet-consult keeps app shell');
assert.match(route, /hasRole/, 'app shell requires a role — guests and incomplete sessions stay on landing');
assert.match(landing, /LandingChrome/, 'vet landing uses marketing chrome');
assert.match(landing, /loginPath\('\/vet-consult'\)/, 'vet landing login returns to consult');
assert.doesNotMatch(landing, /pepito-app-rail/, 'vet landing has no app sidebar');
assert.match(
  welcome,
  /<Link to="\/adoption"[^>]*>\{t\('nav\.adoption'\)\}<\/Link>/,
  'homepage پذیرش CTA goes to /adoption'
);
assert.match(welcome, /data-testid="nav-adoption"/, 'homepage پذیرش is testable');
assert.doesNotMatch(welcome, /href="#pets">پذیرش/, 'homepage پذیرش no longer uses #pets');
assert.doesNotMatch(welcome, /id="pets"/, 'homepage adoption section is not id=pets');
assert.match(
  chrome,
  /<Link to="\/adoption"[^>]*>\{t\('nav\.adoption'\)\}<\/Link>/,
  'LandingChrome پذیرش goes to /adoption'
);
assert.match(chrome, /data-testid="nav-adoption"/, 'LandingChrome پذیرش is testable');
assert.match(footer, /to: '\/adoption',\s*label: t\('nav\.adoption'\)/, 'footer پذیرش goes to /adoption');
assert.match(footer, /to: '\/adoption',\s*label: t\('footer\.adoptPet'\)/, 'footer پذیرش پت goes to /adoption');
assert.doesNotMatch(footer, /\/#pets/, 'footer has no leftover /#pets links');
assert.match(faq, /<Link to="\/adoption"/, 'FAQ پذیرش CTA goes to /adoption');
assert.doesNotMatch(faq, /\/#pets/, 'FAQ has no leftover /#pets links');
assert.match(hashRedirect, /location\.hash !== '#pets'/, 'legacy hash redirect watches #pets');
assert.match(hashRedirect, /pathname: '\/adoption'/, 'legacy hash redirect navigates to /adoption');
assert.match(dock, /pathname === '\/vet-consult'/, 'mobile dock hidden on guest vet landing');
assert.match(chrome, /appNav \? ' pepito-nav--app'/, 'LandingChrome app header only when appNav');
assert.doesNotMatch(chrome, /appNav \|\| isLoggedIn/, 'logged-in guests keep marketing chrome on landing');

// Marketing hero: fixed role order همبازی → دامپزشک → مربی → بدون پت, then پذیرش
const playmateIdx = welcome.indexOf("role: 'playmate'");
const vetIdx = welcome.indexOf("role: 'vet'");
const trainerIdx = welcome.indexOf("role: 'trainer'");
const noPetIdx = welcome.indexOf("role: 'no_pet'");
const adoptionIdx = welcome.indexOf("role: 'adoption'");
assert.ok(playmateIdx > 0 && vetIdx > playmateIdx, 'hero playmate before vet');
assert.ok(trainerIdx > vetIdx, 'hero vet before trainer');
assert.ok(noPetIdx > trainerIdx, 'hero trainer before no_pet');
assert.ok(adoptionIdx > noPetIdx, 'hero adoption after role slides');
assert.match(welcome, /hero-playmate-cta/, 'hero playmate CTA testid');
assert.match(welcome, /hero-vet-consult-cta/, 'hero vet CTA testid');
assert.match(welcome, /hero-trainer-cta/, 'hero trainer CTA testid');
assert.match(welcome, /hero-no-pet-cta/, 'hero no-pet CTA testid');
assert.match(welcome, /hero-adoption-cta/, 'hero adoption CTA testid');
assert.match(welcome, /to: '\/chats'/, 'playmate deep-links to /chats');
assert.match(welcome, /to: '\/vet-consult'/, 'vet deep-links to /vet-consult');
assert.match(welcome, /to: '\/trainer-consult'/, 'trainer deep-links to /trainer-consult');
assert.match(welcome, /to: '\/onboarding\/role'/, 'no-pet deep-links to role onboarding');
assert.match(welcome, /href: '#adoption'/, 'adoption hero CTA anchors to #adoption');
assert.match(welcome, /id="adoption"/, 'welcome adoption section has id=adoption');
assert.match(welcome, /\/2\.jpg/, 'adoption hero restores removed 2.jpg slide');
assert.match(welcome, /landing\.heroAdoptionTitle/, 'adoption hero title key present');
assert.doesNotMatch(welcome, /پیدا کردن پرستار|مراقبت شبانه|نگهداری پت/, 'no sitter leftover CTAs on welcome');


// Services section — PetDate core product lines (not generic pet-care filler)
assert.match(welcome, /landing\.servicesTitle/, 'services title uses i18n key');
assert.doesNotMatch(welcome, /خدمات مراقبت از پت ما/, 'generic care H2 removed');
assert.match(welcome, /to: '\/chats',\s*titleKey: 'landing\.svcPlaymateTitle'/, 'services playmate → /chats');
assert.match(welcome, /to: '\/vet-consult',\s*titleKey: 'landing\.svcVetTitle'/, 'services vet → /vet-consult');
assert.match(welcome, /to: '\/trainer-consult',\s*titleKey: 'landing\.svcTrainerTitle'/, 'services trainer → /trainer-consult');
assert.match(welcome, /to: '\/onboarding\/role',\s*titleKey: 'landing\.svcNoPetTitle'/, 'services no-pet → onboarding');
assert.match(welcome, /to: '\/adoption',\s*titleKey: 'landing\.svcAdoptionTitle'/, 'services adoption → /adoption');
assert.doesNotMatch(
  welcome,
  /title: 'بازی و پیاده‌روی'|title: 'واکسیناسیون و درمان'|title: 'پرونده سلامت'|title: 'گفتگوی امن'/,
  'filler service cards removed'
);
assert.match(welcome, /pepito-service-icon--proto/, 'services use larger prototype icons');
assert.doesNotMatch(welcome, /پیدا کردن پرستار|مراقبت شبانه|نگهداری پت/, 'no sitter leftover in welcome services');

// Rely / “why trust us” strip removed — avoid gray|white|gray sandwich collapse
assert.doesNotMatch(welcome, /id="rely"|pepito-rely|چرا به ما اعتماد کنید/, 'welcome rely/trust section removed');
assert.doesNotMatch(welcome, /href="#rely"/, 'nav trust anchor removed');

// FAQ stays on desktop + /faq deep links; mobile hides landing FAQ section/nav CTAs
assert.match(welcome, /id="faq"/, 'welcome FAQ section kept for desktop');
assert.match(welcome, /pepito-faq-section/, 'welcome FAQ marked for mobile hide');
assert.match(welcome, /pepito-nav-faq/, 'welcome FAQ nav marked for mobile hide');
assert.match(app, /path="faq"\s+element=\{<FaqPage/, 'App keeps /faq route for deep links');
const pepitoCss = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');
assert.match(
  pepitoCss,
  /@media \(max-width: 859px\)[\s\S]{0,400}\.pepito-faq-section[\s\S]{0,120}display:\s*none/,
  'mobile CSS hides FAQ landing section'
);
assert.match(
  pepitoCss,
  /@media \(max-width: 859px\)[\s\S]{0,600}\.pepito-nav-faq[\s\S]{0,120}display:\s*none/,
  'mobile CSS hides FAQ nav/CTA chips'
);

console.log('publicRoutes.selftest: ok');
