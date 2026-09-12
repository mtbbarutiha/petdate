/**
 * Guard: web cart badge uses resolved views; login merges guest→server.
 * Run: npx tsx src/hooks/useShopCart.selftest.ts
 * (CI may invoke this with cwd=packages/api — resolve paths from this file.)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'useShopCart.tsx'), 'utf8');
const api = readFileSync(join(here, '../lib/api.ts'), 'utf8');

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

assert.match(api, /\/api\/shop\/cart\/merge/, 'merge endpoint client');
assert.match(api, /export async function fetchShopCart/, 'fetchShopCart client');

console.log('useShopCart.selftest: ok');
