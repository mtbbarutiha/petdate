/**
 * SW bust generation must move when guest marketing routes change.
 * v14 cacheId stayed active after later bust *keys*, so #213's new shell
 * never replaced the controlling worker (live still showed Layout + /#pets).
 * Run: npx tsx packages/web/src/lib/swCache.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(webSrc, '..');
const sw = readFileSync(join(webSrc, 'lib/swRegister.ts'), 'utf8');
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');

assert.match(sw, /petdate-sw-20260918-above-fold-pad-v57/, 'swRegister bust generation is v57');
assert.match(sw, /petdate-web-v57-above-fold-pad/, 'swRegister active cacheId is v57');
assert.match(vite, /cacheId:\s*'petdate-web-v57-above-fold-pad'/, 'vite PWA cacheId is v57');
assert.match(
  vite,
  /navigateFallbackDenylist:[\s\S]*?\/\^\\\/t/,
  'SW navigation denylist includes /t ticket HTML routes',
);
assert.doesNotMatch(sw, /petdate-web-v56-landmark-js-images/, 'old v56-landmark-js-images cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260918-landmark-js-images-v56/, 'old v56 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v55-cls-a11y/, 'old v55-cls-a11y cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260917-cls-a11y-v55/, 'old v55 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v54-defer-shop/, 'old v54-defer-shop cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260917-defer-shop-v54/, 'old v54 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v53-cwv-seo/, 'old v53-cwv-seo cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260917-cwv-seo-v53/, 'old v53 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v52-lighthouse-followup/, 'old v52-lighthouse-followup cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260917-lighthouse-followup-v52/, 'old v52 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v51-event-tickets/, 'old v51-event-tickets cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260917-event-tickets-v51/, 'old v51 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v50-hero-api-lcp/, 'old v50-hero-api-lcp cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-hero-api-lcp-v50/, 'old v50 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v49-hero-focus/, 'old v49-hero-focus cacheId is retired');
assert.doesNotMatch(sw, /petdate-web-v48-team-personas-four/, 'old v48-team-personas-four cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-persona-roles-v47/, 'old v47 persona-roles bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v46-sara-noori-vet/, 'old v46-sara-noori-vet cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-sara-noori-vet-v46/, 'old v46-sara-noori-vet bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v45-staff-roles/, 'old v45-staff-roles cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-staff-roles-v45/, 'old v45-staff-roles bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v44-persona-avatars/, 'old v44-persona-avatars cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-persona-avatars-v44/, 'old v44-persona-avatars bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v43-yalda-avatar/, 'old v43-yalda-avatar cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-yalda-avatar-v43/, 'old v43-yalda-avatar bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v42-team-chat/, 'old v42-team-chat cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-team-chat-v42/, 'old v42-team-chat bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v41-hero-hq/, 'old v41-hero-hq cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-hero-hq-v41/, 'old v41-hero-hq bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v40-hero-images/, 'old v40-hero-images cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-hero-images-v40/, 'old v40-hero-images bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v39-girl-avatar/, 'old v39-girl-avatar cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-girl-avatar-v39/, 'old v39-girl-avatar bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v38-blog-carousel/, 'old v38-blog-carousel cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-blog-carousel-v38/, 'old v38-blog-carousel bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v37-donut-rtl/, 'old v37-donut-rtl cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-donut-rtl-v37/, 'old v37-donut-rtl bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v36-rbac-badge/, 'old v36-rbac-badge cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-rbac-badge-v36/, 'old v36-rbac-badge bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v35-footer-blurb/, 'old v35-footer-blurb cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-footer-blurb-v35/, 'old v35-footer-blurb bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v35-rbac-badge/, 'old v35-rbac-badge cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-rbac-badge-v35/, 'old v35-rbac-badge bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v34-header-dedupe/, 'old v34-header-dedupe cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-header-dedupe-v34/, 'old v34-header-dedupe bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v33-hero-dots/, 'old v33-hero-dots cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-hero-dots-v33/, 'old v33-hero-dots bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v33-header-dedupe/, 'old v33-header-dedupe cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-header-dedupe-v33/, 'old v33-header-dedupe bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v32-login-icon/, 'old v32-login-icon cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-login-icon-v32/, 'old v32-login-icon bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v31-dock-clear/, 'old v31-dock-clear cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260913-dock-clear-v31/, 'old v31-dock-clear bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v30-news-short/, 'old v30-news-short cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-news-short-v30/, 'old v30-news-short bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v29-hero-dock/, 'old v29-hero-dock cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-hero-dock-v29/, 'old v29-hero-dock bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v28-hero-photo/, 'old v28-hero-photo cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-hero-photo-v28/, 'old v28-hero-photo bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v27-short-cards/, 'old v27-short-cards cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-short-cards-v27/, 'old v27-short-cards bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v26-css-restore/, 'old v26-css-restore cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-css-restore-v26/, 'old v26-css-restore bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v25-short-cards/, 'old v25-short-cards cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-short-cards-v25/, 'old v25-short-cards bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v25-lh-pass/, 'old v25-lh-pass cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lh-pass-v25/, 'old v25-lh-pass bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v24-lh-pass/, 'old v24-lh-pass cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lh-pass-v24/, 'old v24-lh-pass bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v24-vazirmatn/, 'old v24-vazirmatn cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-vazirmatn-v24/, 'old v24-vazirmatn bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-hero-compact/, 'old v23-hero-compact cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-hero-compact-v23/, 'old v23-hero-compact bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-lh-pass/, 'old v23 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lh-pass-v23/, 'old v23 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v23-vazirmatn/, 'old v23 vazirmatn cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-vazirmatn-v23/, 'old v23 vazirmatn bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v22-cls-agentic/, 'old v22 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-cls-agentic-v22/, 'old v22 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v21-faq-dark/, 'old v21 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-faq-dark-v21/, 'old v21 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v20-agentic/, 'old v20 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-agentic-v20/, 'old v20 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v19-mobile/, 'old v19 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-mobile-v19/, 'old v19 bust key is retired');
assert.doesNotMatch(sw, /petdate-web-v14-pets-sync/, 'old v14 cacheId is no longer active');
assert.doesNotMatch(sw, /petdate-web-v15-vet-landing/, 'unshipped v15 cacheId is not active');
assert.doesNotMatch(sw, /petdate-web-v17-seo/, 'old v17 cacheId is retired');
assert.doesNotMatch(sw, /petdate-web-v18-lighthouse/, 'old v18 cacheId is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-lighthouse-v18/, 'old v18 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-seo-v17/, 'old v17 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260908-profile-pets-v14/, 'old v14 bust key is retired');
assert.doesNotMatch(sw, /petdate-sw-20260912-profile-about-pets-v2/, 'v14-cacheId bust key is retired');

console.log('swCache.selftest: ok');
