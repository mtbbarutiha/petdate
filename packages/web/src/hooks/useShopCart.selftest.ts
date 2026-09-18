/**
 * Guard: web cart badge uses resolved views; login merges guest→server.
 * Never auto-DELETE live server cart rows from unresolved “ghost” prune
 * (only retired demo SKUs). Catalog hydrate runs in the cart provider.
 * User remove sends user-remove intent; poll skips while mutations in flight.
 * Run: npx tsx src/hooks/useShopCart.selftest.ts
 * (CI may invoke this with cwd=packages/api — resolve paths from this file.)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRetiredShopProduct } from '../data/retired-shop-products.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'useShopCart.tsx'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');
const sync = readFileSync(join(here, 'useShopCatalogSync.ts'), 'utf8');

assert.match(src, /SHOP_CART_SYNC_RULE = 'merge-then-persist'/, 'exports sync rule');
assert.match(src, /mergeShopCart/, 'login merge calls API');
assert.match(src, /fetchShopCart/, 'pulls server cart');
assert.match(
  src,
  /itemCount = useMemo\(\(\) => views\.reduce/,
  'badge counts views only (not ghost localStorage lines)'
);
assert.match(src, /visibilitychange/, 'refetches on tab focus for bot↔web sync');
assert.doesNotMatch(
  src,
  /itemCount = useMemo\(\(\) => lines\.reduce/,
  'must not count raw lines for badge'
);

assert.match(src, /hydrateShopCatalogOnce/, 'cart provider can hydrate catalog on shop routes');
assert.match(src, /isShopPath|isLandingHomePath/, 'cart skips homepage catalog hydrate');
assert.match(src, /import\('\.\.\/data\/shopCatalog'\)/, 'static seed catalog is dynamic-imported');
assert.doesNotMatch(src, /import \{ getProduct/, 'getProduct is not a static import on landing entry');
assert.match(sync, /isLandingHomePath/, 'sync exports landing-home guard');
assert.match(sync, /isShopPath/, 'sync exports shop-path guard');
assert.match(sync, /import\('\.\.\/data\/shopCatalog'\)/, 'hydrate dynamic-imports shopCatalog');
assert.doesNotMatch(sync, /scheduleAfterLoadIdle|setTimeout\(run,\s*2500\)/, 'catalog hydrate is not timer-deferred from cart');
assert.match(sync, /export async function hydrateShopCatalogOnce/, 'shared hydrate export');

assert.match(src, /applyFetchedServerLines|mergeCartLinesKeepLocal/, 'boot/focus GET merges in-flight local adds');
assert.match(src, /userClearedRef/, 'explicit clear is not restored by stale GET /cart');
assert.match(src, /shopCartMerge/, 'client merge helper is wired');
assert.match(src, /isRetiredShopProduct/, 'ghost prune limited to retired demo SKUs');
assert.match(src, /productFromServerMeta|serverMetaRef/, 'keeps server enrichment for unresolved ids');
assert.doesNotMatch(
  src,
  /Drop ghost lines that never resolve in catalog/,
  'must not DELETE any unresolved catalog id from server'
);
assert.match(src, /inflightMutationsRef/, 'skips poll refresh during cart mutations');
assert.match(
  src,
  /removeShopCartItem\(token, productId, \{ userIntent: true \}\)/,
  'user remove sends intent header'
);

assert.match(api, /\/api\/shop\/cart\/merge/, 'merge endpoint client');
assert.match(api, /export async function fetchShopCart/, 'fetchShopCart client');
assert.match(api, /clearStaleWebAuthToken/, 'cart 401 clears stale web token');
assert.match(api, /onWebAuthTokenCleared/, 'auth store can subscribe to token clear');
assert.match(api, /X-Petdate-Cart-Intent/, 'remove client sends intent header');

assert.equal(isRetiredShopProduct('p1'), true);
assert.equal(isRetiredShopProduct('dog-food-2-p2'), true);
assert.equal(isRetiredShopProduct('p225'), false);
assert.equal(isRetiredShopProduct('p243'), false);
assert.equal(isRetiredShopProduct('dog-food-royal-canin-xsmall-adult-1-5kg'), false);

console.log('useShopCart.selftest: ok');
