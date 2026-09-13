/**
 * Shop Batch 3 — 14 SKUs, zero margin, 3-angle batch3-v2 galleries.
 * Run: npx tsx src/data/shop-batch3-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH3_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch3-'));
process.env.DATABASE_PATH = join(tmpDir, 'test.db');
process.env.DATABASE_URL = '';

function jpegSofSize(bytes: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: bytes.readUInt16BE(i + 5), w: bytes.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = bytes.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error('JPEG SOF not found');
}

const EXPECTED_PRICE: Record<string, number> = {
  'cat-food-royal-canin-sensible-2kg': 10_217_000,
  'cat-food-josera-marinesse-2kg': 4_004_000,
  'cat-food-josera-sensicat-2kg': 4_004_000,
  'cat-food-royal-canin-mother-babycat-2kg': 10_395_000,
  'cat-food-royal-canin-dental-1-5kg': 9_450_000,
  'cat-food-royal-canin-light-weight-1-5kg': 9_415_000,
  'cat-food-royal-canin-hairball-2kg': 12_100_000,
  'cat-food-royal-canin-hair-skin-2kg': 12_100_000,
  'cat-food-royal-canin-urinary-so-1-5kg': 9_623_000,
  'dog-food-royal-canin-mini-sterilised-3kg': 14_821_000,
  'dog-food-royal-canin-mini-light-weight-3kg': 14_821_000,
  'dog-food-royal-canin-poodle-adult-3kg': 14_820_000,
  'dog-food-royal-canin-poodle-puppy-3kg': 14_820_000,
  'dog-food-royal-canin-hypoallergenic-2kg': 11_702_000,
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch3-products');

  assert.deepEqual([...seed.SHOP_BATCH3_SLUGS], [...SHOP_BATCH3_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH3_PRODUCTS.length, 14, '14 batch 3 SKUs');
  assert.ok(
    seed.SHOP_BATCH3_PRODUCTS.some((p) => p.slug === 'cat-food-josera-marinesse-2kg'),
    'Josera Marinesse is in batch 3 products'
  );
  assert.ok(
    !seed.SHOP_BATCH3_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch 3 products'
  );

  const first = seed.seedShopBatch3Products();
  const second = seed.seedShopBatch3Products();
  assert.equal(first, 14, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH3_SLUGS[0]);
  seed.seedShopBatch3Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH3_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const sensible = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('cat-food-royal-canin-sensible-2kg') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(sensible, 'Sensible slug is seeded');
  assert.equal(sensible!.id, 'p236');
  assert.equal(Number(sensible!.price_toman), 10_217_000);
  assert.equal(Number(sensible!.cost_toman), 10_217_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH3_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH3_SLUGS) as Array<{
    slug: string;
    title: string;
    price_toman: number;
    cost_toman: number;
    image: string;
    badge: string;
    featured: number;
    in_stock: number;
    description: string;
    params: string;
  }>;
  assert.equal(rows.length, 14, 'fourteen batch 3 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatch3Products.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH3_PRODUCTS/, 'shopCatalog spreads batch 3');
  assert.match(catalog, /cat-food-josera-marinesse-2kg/, 'batch 3 catalog file includes Marinesse');
  assert.match(shopCatalog, /id: 'josera'/, 'Josera brand stays in SHOP_BRANDS');

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch3-v2$`));
    assert.equal(row.badge, 'new');
    assert.equal(Number(row.featured), 1);
    assert.equal(Number(row.in_stock), 1);
    assert.match(row.description, /— پت دیت شاپ/);
    assert.doesNotMatch(row.description, /ژیوان|Zivan/i);
    assert.equal(tomanToShopCoins(row.price_toman), tomanToShopCoins(EXPECTED_PRICE[row.slug]));
    const params = JSON.parse(row.params || '{}') as Record<string, string>;
    const gallery = String(params.__images || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    assert.equal(gallery.length, 3, `${row.slug} stores 3 gallery URLs`);
    assert.equal(gallery[0], row.image, `${row.slug} first gallery src is cover`);
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch3-v2`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch3-v2`), `${row.slug} angle 3`);
    assert.ok(params.__titleEn, `${row.slug} stores titleEn`);
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const livePrices = d
    .prepare(`SELECT slug, price_toman FROM shop_products WHERE slug IN (?, ?, ?)`)
    .all(
      'dog-food-royal-canin-mini-adult-2kg',
      'cat-food-josera-kitten-2kg',
      'cat-food-royal-canin-fit-2kg'
    ) as Array<{ slug: string; price_toman: number }>;
  for (const row of livePrices) {
    const expected: Record<string, number> = {
      'dog-food-royal-canin-mini-adult-2kg': 8_881_000,
      'cat-food-josera-kitten-2kg': 4_004_000,
      'cat-food-royal-canin-fit-2kg': 10_217_000,
    };
    assert.equal(row.price_toman, expected[row.slug], `${row.slug} live price unchanged`);
  }

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch3-v2'), 'utf8');
  assert.match(bust, /batch3-v2/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH3_SLUGS.flatMap((slug) => [
    `${slug}.jpg`,
    `${slug}-2.jpg`,
    `${slug}-3.jpg`,
  ]);
  assert.equal(imageNames.length, 42, '42 gallery files');
  for (const name of imageNames) {
    const abs = join(repoRoot, 'packages/web/public/pepito/uploads', name);
    assert.ok(existsSync(abs), `missing ${name}`);
    const bytes = readFileSync(abs);
    assert.ok(bytes.length > 20_000, `${name} is not an empty placeholder`);
    assert.equal(bytes[0], 0xff, `${name} starts with JPEG SOI`);
    assert.equal(bytes[1], 0xd8, `${name} is JPEG`);
    const dim = jpegSofSize(bytes);
    assert.equal(dim.w, 1200, `${name} width 1200`);
    assert.equal(dim.h, 1200, `${name} height 1200`);
  }

  const shopTs = readFileSync(join(repoRoot, 'packages/api/src/routes/shop.ts'), 'utf8');
  assert.match(shopTs, /images: p\.images/, 'public shop DTO exposes images[]');
  assert.match(shopTs, /titleEn/, 'public shop DTO exposes titleEn');

  console.log('shop-batch3-products.selftest: ok', SHOP_BATCH3_SLUGS.join(','));
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
