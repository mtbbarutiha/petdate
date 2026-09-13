/**
 * Homepage news carousel: page wrap, RTL scrollLeft, visible-count pages.
 * Run: npx tsx packages/web/src/lib/newsCarousel.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newsCarouselIndexFromScroll,
  newsCarouselPages,
  newsCarouselScrollLeft,
  newsCarouselVisibleCount,
  wrapCarouselIndex,
} from './newsCarousel';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const below = readFileSync(join(webSrc, 'pages/WelcomeBelowFold.tsx'), 'utf8');
const css = readFileSync(join(webSrc, 'styles/pepito.css'), 'utf8');

assert.equal(newsCarouselPages(3, 3), 1, '3 cards / 3 visible = 1 page (arrows would no-op)');
assert.equal(newsCarouselPages(6, 3), 4, '6 cards / 3 visible = 4 pages');
assert.equal(newsCarouselPages(6, 1), 6, '6 cards / 1 visible (mobile) = 6 pages');
assert.equal(newsCarouselPages(6, 2), 5, '6 cards / 2 visible (tablet) = 5 pages');
assert.equal(newsCarouselPages(0, 3), 1, 'empty list still has 1 page');

assert.equal(wrapCarouselIndex(1, 4), 1);
assert.equal(wrapCarouselIndex(-1, 4), 3, 'prev wraps to last page');
assert.equal(wrapCarouselIndex(4, 4), 0, 'next wraps to first page');
assert.equal(wrapCarouselIndex(1, 1), 0, 'single page is a no-op wrap');

assert.equal(newsCarouselScrollLeft(0, 320, true), 0);
assert.equal(newsCarouselScrollLeft(2, 320, true), -640, 'RTL next is negative scrollLeft');
assert.equal(newsCarouselScrollLeft(2, 320, false), 640, 'LTR next is positive scrollLeft');
assert.equal(newsCarouselScrollLeft(0, 320, false), 0, 'page 0 must still scroll to 0 (not skip)');

assert.equal(newsCarouselIndexFromScroll(-640, 320, true, 4), 2);
assert.equal(newsCarouselIndexFromScroll(640, 320, false, 4), 2);
assert.equal(newsCarouselIndexFromScroll(10, 320, false, 4), 0);

assert.equal(newsCarouselVisibleCount(980, 313.33, 20), 3);
assert.equal(newsCarouselVisibleCount(360, 300, 20), 1);

assert.match(below, /scrollNewsTo/, 'arrows call a real scroll helper, not only setState');
assert.match(below, /goNews\(newsIndex - 1\)/, 'prev button wired');
assert.match(below, /goNews\(newsIndex \+ 1\)/, 'next button wired');
assert.doesNotMatch(
  below,
  /if \(newsIndex === 0\) return/,
  'news carousel must scroll back to page 0'
);
assert.match(below, /fetchMagazineList/, 'thin featured payloads are filled from the public list');
assert.match(below, /newsCarouselPages/, 'page count uses measured visible cards');

assert.match(css, /\.pepito-news-arrow \{[\s\S]*?pointer-events:\s*auto/, 'arrows accept clicks');
assert.match(css, /\.pepito-news-nav \{[\s\S]*?z-index:\s*[5-9]/, 'nav sits above the card row');
assert.doesNotMatch(
  css,
  /@media \(max-width: 720px\) \{[\s\S]*?\.pepito-news-nav \{\s*display:\s*none/,
  'mobile must keep prev/next arrows'
);

console.log('newsCarousel.selftest: ok');
