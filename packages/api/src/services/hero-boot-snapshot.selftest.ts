/**
 * Hero boot snapshot + public cache guards.
 * Run: npx tsx packages/api/src/services/hero-boot-snapshot.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bootLcpImgOpenTag,
  renderLcpBootHtml,
  snapshotFromFirstSlide,
} from './hero-boot-snapshot';
import type { HeroSlideResolved } from './hero-slides';

const slide: HeroSlideResolved = {
  role: 'playmate',
  webp: '/api/hero/images/20260913/example-playmate-800.webp',
  srcSet:
    '/api/hero/images/20260913/example-playmate-800.webp 800w, /api/hero/images/20260913/example-playmate-1280.webp 1280w',
  fallback: '/api/hero/images/20260913/example-playmate-fallback.jpg',
  source: 'custom',
  updatedAt: '2026-09-17T00:00:00.000Z',
  posX: 50,
  posY: 90,
  scale: 1,
};

const snap = snapshotFromFirstSlide(slide);
assert.equal(snap.webp, slide.webp);
assert.equal(snap.posY, 90);

const block = renderLcpBootHtml(snap);
assert.match(block, /<!--pd-lcp-boot-->/);
assert.match(block, /data-pd-lcp="hero"/);
assert.match(block, /id="pd-hero-boot-json"/);
assert.match(block, /example-playmate-800\.webp/);

const img = bootLcpImgOpenTag(snap);
assert.match(img, /id="pd-boot-lcp"/);
assert.match(img, /data-pd-boot-hero="snapshot"/);
assert.match(img, /src="\/api\/hero\/images\/20260913\/example-playmate-800\.webp"/);
assert.match(img, /decoding="async"/, 'boot LCP decodes async so JS cannot stall paint');
assert.match(img, /position:absolute/, 'boot LCP keeps inline geometry after snapshot rewrite');
assert.match(img, /display:block/, 'boot LCP stays visible after snapshot rewrite');
assert.doesNotMatch(img, /is-parked/, 'snapshot rewrite must not park homepage LCP');
assert.match(img, /width:100%/, 'boot LCP uses width:100% (not intrinsic-ratio auto)');
assert.match(img, /left:0;right:auto/, 'boot LCP anchors to physical left for RTL');
assert.doesNotMatch(img, /width:auto;max-width:100%/, 'boot LCP must not use width:auto');
assert.match(img, /object-position:50% 90%/, 'focus position preserved');
assert.match(img, /z-index:0/, 'boot LCP stays behind isolated #root (hero UI above)');
assert.match(img, /transform:none/, 'boot LCP never inlines scale (would bleed past hero clip)');
assert.match(img, /clip-path:inset\(0\)/, 'boot LCP clips to its own hero-band box');
assert.doesNotMatch(img, /transform:scale/, 'snapshot rewrite must not scale out-of-root LCP');

const scaled = bootLcpImgOpenTag({ ...snap, scale: 1.35 });
assert.doesNotMatch(
  scaled,
  /transform:scale/,
  'admin scale must not be inlined on boot LCP (React slide media owns scale)',
);

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const heroRoute = readFileSync(join(apiRoot, 'routes/hero.ts'), 'utf8');
assert.match(heroRoute, /max-age=60/, 'public /api/hero is briefly cacheable');
assert.match(heroRoute, /getHeroSlidesCachedSync/, 'hero route uses memory/redis cache helper');

const cache = readFileSync(join(apiRoot, 'services/hero-public-cache.ts'), 'utf8');
assert.match(cache, /invalidateHeroPublicCache/, 'cache can be invalidated on admin writes');
assert.match(cache, /petdate:hero:slides:v1/, 'redis key is namespaced');

console.log('hero-boot-snapshot.selftest: ok');
