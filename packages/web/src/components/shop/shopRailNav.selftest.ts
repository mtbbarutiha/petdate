/**
 * Shop rail L/R controls: physical left/right, visual-left scroll in RTL.
 * Run: npx tsx packages/web/src/components/shop/shopRailNav.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const buttons = readFileSync(join(here, 'ShopRailNavButtons.tsx'), 'utf8');
const hook = readFileSync(join(here, 'useShopRailNav.ts'), 'utf8');
const css = readFileSync(join(here, '../../styles/pepito.css'), 'utf8');
const home = readFileSync(join(here, '../../pages/shop/ShopHomePage.tsx'), 'utf8');
const rail = readFileSync(join(here, 'ShopHomeRail.tsx'), 'utf8');
const similar = readFileSync(join(here, 'ShopSimilarProducts.tsx'), 'utf8');
const brands = readFileSync(join(here, 'ShopTopBrands.tsx'), 'utf8');
const ci = readFileSync(join(here, '../../../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(buttons, /pd-shop-rail-btn--left/, 'left button class');
assert.match(buttons, /pd-shop-rail-btn--right/, 'right button class');
assert.match(
  buttons,
  /pd-shop-rail-btn--left[\s\S]*?<ChevronLeft[\s\S]*?pd-shop-rail-btn--right[\s\S]*?<ChevronRight/,
  'left chevron on physical left, right chevron on physical right'
);
assert.doesNotMatch(
  buttons,
  /pd-shop-rail-btn--left[\s\S]*?<ChevronRight[\s\S]*?pd-shop-rail-btn--right[\s\S]*?<ChevronLeft/,
  'chevrons are not swapped inward'
);

assert.match(hook, /scrollBySide/, 'hook exposes visual-side scroll');
assert.match(hook, /canLeft/, 'hook exposes canLeft');
assert.match(hook, /isRtl \? 'next' : 'prev'/, 'RTL left button scrolls next (visual left)');

assert.match(
  css,
  /\.pd-shop-rail-btn--left[\s\S]{0,90}left:\s*0\.2rem/,
  'left control uses physical left, not inset-inline-start'
);
assert.doesNotMatch(
  css,
  /\.pd-shop-rail-btn--next\s*\{[\s\S]{0,80}inset-inline-start/,
  'next/left is not mirrored by logical insets'
);

for (const [src, name] of [
  [home, 'categories'],
  [rail, 'home rails'],
  [similar, 'similar products'],
  [brands, 'top brands'],
] as const) {
  assert.match(src, /scrollBySide\('left'\)/, `${name} left button scrolls visual-left`);
  assert.match(src, /scrollBySide\('right'\)/, `${name} right button scrolls visual-right`);
}

assert.match(ci, /shopRailNav\.selftest/, 'CI runs shop rail nav selftest');

console.log('shopRailNav.selftest: ok');
