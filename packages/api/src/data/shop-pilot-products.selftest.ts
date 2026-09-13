/**
 * Royal Canin pilot SKUs — idempotent slug upsert, zero margin, no competitor names.
 * Run: npx tsx src/data/shop-pilot-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Same rule as @petdate/shared tomanToShopCoins — keep this file free of workspace imports. */
function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-rc-pilot-'));
process.env.DATABASE_PATH = join(tmpDir, 'test.db');
process.env.DATABASE_URL = '';

const SLUGS = [
  'dog-food-royal-canin-mini-adult-2kg',
  'dog-food-royal-canin-xsmall-puppy-1-5kg',
  'cat-food-royal-canin-persian-adult-400g',
] as const;

const IMAGES = [
  'royal-canin-mini-adult-2kg.jpg',
  'royal-canin-xsmall-puppy-1.5kg.jpg',
  'royal-canin-persian-adult-400g.jpg',
] as const;

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-pilot-products');

  const first = seed.seedRoyalCaninPilotProducts();
  const second = seed.seedRoyalCaninPilotProducts();
  assert.equal(first, SLUGS.length, 'seed count');
  assert.equal(second, first, 'idempotent count');
  assert.deepEqual(seed.ROYAL_CANIN_PILOT_SLUGS, [...SLUGS], 'exported slugs');

  d.prepare(`UPDATE shop_products SET stock_qty = 7 WHERE slug = ?`).run(SLUGS[0]);
  seed.seedRoyalCaninPilotProducts();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 7, 're-seed must not reset live stock');

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, stock_qty, description
       FROM shop_products WHERE slug IN (?, ?, ?)`
    )
    .all(...SLUGS) as Array<{
    slug: string;
    title: string;
    price_toman: number;
    cost_toman: number;
    image: string;
    badge: string;
    featured: number;
    in_stock: number;
    stock_qty: number;
    description: string;
  }>;
  assert.equal(rows.length, 3, 'three pilot rows');

  const expectedPrice: Record<string, number> = {
    [SLUGS[0]]: 8_881_000,
    [SLUGS[1]]: 8_894_000,
    [SLUGS[2]]: 2_741_600,
  };
  const expectedCoins: Record<string, number> = {
    [SLUGS[0]]: tomanToShopCoins(8_881_000),
    [SLUGS[1]]: tomanToShopCoins(8_894_000),
    [SLUGS[2]]: tomanToShopCoins(2_741_600),
  };

  for (const row of rows) {
    assert.equal(row.price_toman, expectedPrice[row.slug], `${row.slug} price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, /^\/pepito\/uploads\/royal-canin-/);
    assert.equal(row.badge, 'new');
    assert.equal(Number(row.featured), 1);
    assert.equal(Number(row.in_stock), 1);
    assert.match(row.description, /— پت دیت شاپ/);
    assert.doesNotMatch(row.description, /ژیوان|Zivan|ژیوان/i);
    assert.doesNotMatch(row.title, /ژیوان|Zivan/i);
    assert.equal(tomanToShopCoins(row.price_toman), expectedCoins[row.slug], `${row.slug} coins`);
  }

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  for (const slug of SLUGS) {
    assert.match(catalog, new RegExp(slug.replace(/-/g, '\\-')), `shopCatalog has ${slug}`);
  }
  assert.doesNotMatch(catalog, /ژیوان/);

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-royal-canin-pilot-3sku-v1'), 'utf8');
  assert.match(bust, /royal-canin-pilot-3sku-v1/, 'cache-bust marker present');

  for (const name of IMAGES) {
    const abs = join(repoRoot, 'packages/web/public/pepito/uploads', name);
    assert.ok(existsSync(abs), `missing ${name}`);
    const bytes = readFileSync(abs);
    assert.ok(bytes.length > 20_000, `${name} is not an empty placeholder`);
    assert.equal(bytes[0], 0xff, `${name} starts with JPEG SOI`);
    assert.equal(bytes[1], 0xd8, `${name} is JPEG`);
  }

  console.log('shop-pilot-products.selftest: ok', SLUGS.join(','));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
