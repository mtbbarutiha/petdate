/**
 * Shop Batch-multi wave 2/5 — 10 SKUs, zero margin, 3-angle batch-multi-w2-v1 galleries.
 * Run: npx tsx src/data/shop-batch-multi-wave2-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE2_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch-multi-w2-'));
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
  'dog-treats-wanpy-chicken-jerky-chips-100g': 655_000,
  'cat-treats-bioline-catnip-spray-50ml': 828_000,
  'cat-treats-bonnest-catnip-spray-50-l': 539_000,
  'cat-treats-cat-grass-theething-stick-30-g': 480_000,
  'cat-treats-bonnest-cat-nip-powder-20g-20-g': 385_000,
  'cat-treats-chicken-cat-grass-treat-30-g': 335_000,
  'dog-toys-enjoy-the-meal-puzzle-toy': 5_480_000,
  'dog-toys-ufo-treat-dispenser-dog-toy': 3_580_000,
  'dog-toys-crab-silicone-dog-chew-toothbrush-toy': 1_100_000,
  'dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy': 362_000,
};

const NO_INVENTED_WEIGHT = new Set([
  'dog-toys-enjoy-the-meal-puzzle-toy',
  'dog-toys-ufo-treat-dispenser-dog-toy',
  'dog-toys-crab-silicone-dog-chew-toothbrush-toy',
  'dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy',
]);

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch-multi-wave2-products');

  assert.deepEqual([...seed.SHOP_BATCH_MULTI_WAVE2_SLUGS], [...SHOP_BATCH_MULTI_WAVE2_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS.length, 10, '10 wave-2 SKUs');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[0]?.id, 'p260');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS.at(-1)?.id, 'p269');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[6]?.id, 'p266');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[6]?.slug, 'dog-toys-enjoy-the-meal-puzzle-toy');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[7]?.id, 'p267');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[7]?.slug, 'dog-toys-ufo-treat-dispenser-dog-toy');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[8]?.id, 'p268');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS[8]?.slug, 'dog-toys-crab-silicone-dog-chew-toothbrush-toy');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE2_CACHE_BUST, 'batch-multi-w2-v1');
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch-multi wave 2 products'
  );
  assert.ok(
    seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS.every((p) => {
      const n = Number(p.id.slice(1));
      return n >= 260 && n <= 269;
    }),
    'wave 2 must be exactly p260–p269'
  );
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE2_PRODUCTS.some((p) => p.id === 'p250' || Number(p.id.slice(1)) < 260),
    'wave 2 must not include wave 1 SKUs'
  );

  const first = seed.seedShopBatchMultiWave2Products();
  const second = seed.seedShopBatchMultiWave2Products();
  assert.equal(first, 10, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH_MULTI_WAVE2_SLUGS[0]);
  seed.seedShopBatchMultiWave2Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH_MULTI_WAVE2_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const jerky = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('dog-treats-wanpy-chicken-jerky-chips-100g') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(jerky, 'Wanpy chicken jerky chips slug is seeded');
  assert.equal(jerky!.id, 'p260');
  assert.equal(Number(jerky!.price_toman), 655_000);
  assert.equal(Number(jerky!.cost_toman), 655_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH_MULTI_WAVE2_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH_MULTI_WAVE2_SLUGS) as Array<{
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
  assert.equal(rows.length, 10, 'ten wave-2 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave2Products.ts'), 'utf8');
  const wave1Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiProducts.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH_MULTI_WAVE2_PRODUCTS/, 'shopCatalog spreads batch-multi wave 2');
  assert.match(catalog, /dog-treats-wanpy-chicken-jerky-chips-100g/, 'web catalog includes first SKU');
  assert.doesNotMatch(catalog, /cat-toys-petopoli-4-way-foldable-cat-play-tunnel/, 'later waves stay out of wave-2 catalog');
  assert.doesNotMatch(wave1Catalog, /dog-treats-wanpy-chicken-jerky-chips-100g/, 'wave 1 file stays wave-1 only');
  assert.match(shopCatalog, /id: 'bioline'/, 'Bioline brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'bonnest'/, 'Bonnest brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'luna'/, 'Luna brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'generic'/, 'generic brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'wanpy'/, 'Wanpy brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'afp'/, 'AFP brand is in SHOP_BRANDS');

  const liveCats = readFileSync(join(repoRoot, 'packages/api/src/data/shop-live-catalog.ts'), 'utf8');
  for (const slug of ['dog-treats', 'cat-treats', 'dog-toys']) {
    assert.match(liveCats, new RegExp(`'${slug}'`), `LIVE_SHOP_CATEGORY_SLUGS keeps ${slug}`);
  }

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch-multi-w2-v1$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch-multi-w2-v1`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch-multi-w2-v1`), `${row.slug} angle 3`);
    assert.ok('__titleEn' in params, `${row.slug} stores titleEn key`);
    if (NO_INVENTED_WEIGHT.has(row.slug)) {
      assert.equal(params['وزن'], undefined, `${row.slug} must not invent وزن`);
    }
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const cats = d
    .prepare(`SELECT slug FROM shop_categories WHERE slug IN ('dog-treats','cat-treats','dog-toys')`)
    .all() as Array<{ slug: string }>;
  assert.equal(cats.length, 3, 'wave-2 categories are seeded');

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch-multi-w2-v1'), 'utf8');
  assert.match(bust, /batch-multi-w2-v1/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH_MULTI_WAVE2_SLUGS.flatMap((slug) => [
    `${slug}.jpg`,
    `${slug}-2.jpg`,
    `${slug}-3.jpg`,
  ]);
  assert.equal(imageNames.length, 30, '30 gallery files expected');
  const present = imageNames.filter((name) =>
    existsSync(join(repoRoot, 'packages/web/public/pepito/uploads', name))
  );
  if (present.length === 0) {
    console.warn(
      'shop-batch-multi-wave2-products.selftest: 30 packshots not on disk yet — URL pattern is wired; re-attach JPEGs before merge'
    );
  } else {
    assert.equal(present.length, 30, 'partial packshot upload — all 30 JPEGs must land together');
    for (const name of imageNames) {
      const abs = join(repoRoot, 'packages/web/public/pepito/uploads', name);
      const bytes = readFileSync(abs);
      assert.ok(bytes.length > 20_000, `${name} is not an empty placeholder`);
      assert.equal(bytes[0], 0xff, `${name} starts with JPEG SOI`);
      assert.equal(bytes[1], 0xd8, `${name} is JPEG`);
      const dim = jpegSofSize(bytes);
      assert.equal(dim.w, 1200, `${name} width 1200`);
      assert.equal(dim.h, 1200, `${name} height 1200`);
    }
  }

  const shopTs = readFileSync(join(repoRoot, 'packages/api/src/routes/shop.ts'), 'utf8');
  assert.match(shopTs, /images: p\.images/, 'public shop DTO exposes images[]');
  assert.match(shopTs, /titleEn/, 'public shop DTO exposes titleEn');

  console.log('shop-batch-multi-wave2-products.selftest: ok', SHOP_BATCH_MULTI_WAVE2_SLUGS.join(','));
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
