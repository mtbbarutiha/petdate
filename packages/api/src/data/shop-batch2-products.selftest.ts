/**
 * Shop Batch 2 — 12 SKUs including Josera Kitten, zero margin, 3-angle batch2-v1 galleries.
 * Run: npx tsx src/data/shop-batch2-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH2_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch2-'));
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
  'dog-food-royal-canin-mini-indoor-puppy-1-5kg': 8_294_000,
  'dog-food-royal-canin-xsmall-adult-1-5kg': 7_841_000,
  'dog-food-royal-canin-mini-puppy-2kg': 8_881_000,
  'dog-food-royal-canin-pomeranian-adult-1-5kg': 7_826_000,
  'dog-food-royal-canin-shih-tzu-adult-1-5kg': 7_841_000,
  'cat-food-josera-culinesse-2kg': 4_004_000,
  'cat-food-josera-dailycat-2kg': 3_900_000,
  'cat-food-royal-canin-indoor-adult-400g': 2_742_000,
  'cat-food-royal-canin-british-shorthair-adult-400g': 2_742_000,
  'cat-food-royal-canin-fit-2kg': 10_217_000,
  'cat-food-royal-canin-sterilised-adult-400g': 2_742_000,
  'cat-food-josera-kitten-2kg': 4_004_000,
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch2-products');

  assert.deepEqual([...seed.SHOP_BATCH2_SLUGS], [...SHOP_BATCH2_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH2_PRODUCTS.length, 12, '12 batch 2 SKUs');
  assert.ok(
    seed.SHOP_BATCH2_PRODUCTS.some((p) => p.slug === 'cat-food-josera-kitten-2kg'),
    'Josera Kitten is in batch 2 products'
  );
  assert.ok(
    !seed.SHOP_BATCH2_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch 2 products'
  );

  const first = seed.seedShopBatch2Products();
  const second = seed.seedShopBatch2Products();
  assert.equal(first, 12, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH2_SLUGS[0]);
  seed.seedShopBatch2Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH2_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const kitten = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('cat-food-josera-kitten-2kg') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(kitten, 'Josera Kitten slug is seeded');
  assert.equal(kitten!.id, 'p235');
  assert.equal(Number(kitten!.price_toman), 4_004_000);
  assert.equal(Number(kitten!.cost_toman), 4_004_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH2_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH2_SLUGS) as Array<{
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
  assert.equal(rows.length, 12, 'twelve batch 2 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatch2Products.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH2_PRODUCTS/, 'shopCatalog spreads batch 2');
  assert.match(shopCatalog, /cat-food-josera-kitten-2kg/, 'catalog includes Josera Kitten');
  assert.match(catalog, /cat-food-josera-kitten-2kg/, 'batch 2 catalog file includes Kitten');
  assert.match(shopCatalog, /id: 'josera'/, 'Josera brand stays in SHOP_BRANDS');

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch2-v1$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch2-v1`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch2-v1`), `${row.slug} angle 3`);
    assert.ok(params.__titleEn, `${row.slug} stores titleEn`);
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const livePrices = d
    .prepare(
      `SELECT slug, price_toman FROM shop_products WHERE slug IN (?, ?, ?)`
    )
    .all(
      'dog-food-royal-canin-mini-adult-2kg',
      'dog-food-royal-canin-xsmall-puppy-1-5kg',
      'cat-food-royal-canin-persian-adult-400g'
    ) as Array<{ slug: string; price_toman: number }>;
  // Pilot seed is not required in this isolated DB; if present, prices must stay.
  for (const row of livePrices) {
    const expected: Record<string, number> = {
      'dog-food-royal-canin-mini-adult-2kg': 8_881_000,
      'dog-food-royal-canin-xsmall-puppy-1-5kg': 8_894_000,
      'cat-food-royal-canin-persian-adult-400g': 2_741_600,
    };
    assert.equal(row.price_toman, expected[row.slug], `${row.slug} live price unchanged`);
  }

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch2-v1'), 'utf8');
  assert.match(bust, /batch2-v1/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH2_SLUGS.flatMap((slug) => [
    `${slug}.jpg`,
    `${slug}-2.jpg`,
    `${slug}-3.jpg`,
  ]);
  assert.equal(imageNames.length, 36, '36 gallery files');
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

  console.log('shop-batch2-products.selftest: ok', SHOP_BATCH2_SLUGS.join(','));
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
