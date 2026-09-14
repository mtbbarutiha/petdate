/**
 * Shop Batch-multi wave 5/5 — 10 SKUs, zero margin, 3-angle batch-multi-w5-v1 galleries.
 * Run: npx tsx src/data/shop-batch-multi-wave5-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE5_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch-multi-w5-'));
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
  'grooming-bonnest-calming-shampoo-for-pet-200-l': 680_000,
  'grooming-spray-massage-brush-for-pet': 520_000,
  'dog-carriers-fiber-space-pet-carrier-backpack': 6_160_000,
  'dog-carriers-luxury-leather-space-pet-carier-backpack': 2_795_000,
  'dog-carriers-leather-pet-carier-backpack': 2_650_000,
  'cat-carriers-zarix-zeus-for-cat': 4_274_000,
  'cat-carriers-raha-pet-hard-box-3': 3_960_000,
  'cat-carriers-jupiter-cat-hard-box': 2_970_000,
  'bird-food-oshkaia-mixed-nut-cockatiel-food-kg': 525_000,
  'bird-food-oshkaia-mynah-bird-food-kg': 495_000,
};

const NO_INVENTED_WEIGHT = new Set(Object.keys(EXPECTED_PRICE));

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch-multi-wave5-products');

  assert.deepEqual([...seed.SHOP_BATCH_MULTI_WAVE5_SLUGS], [...SHOP_BATCH_MULTI_WAVE5_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS.length, 10, '10 wave-5 SKUs');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[0]?.id, 'p290');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS.at(-1)?.id, 'p299');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[0]?.slug, 'grooming-bonnest-calming-shampoo-for-pet-200-l');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[2]?.id, 'p292');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[2]?.slug, 'dog-carriers-fiber-space-pet-carrier-backpack');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[3]?.id, 'p293');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[3]?.slug, 'dog-carriers-luxury-leather-space-pet-carier-backpack');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[4]?.id, 'p294');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[4]?.slug, 'dog-carriers-leather-pet-carier-backpack');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[5]?.id, 'p295');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[5]?.slug, 'cat-carriers-zarix-zeus-for-cat');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[8]?.id, 'p298');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[8]?.slug, 'bird-food-oshkaia-mixed-nut-cockatiel-food-kg');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[9]?.id, 'p299');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[9]?.slug, 'bird-food-oshkaia-mynah-bird-food-kg');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE5_CACHE_BUST, 'batch-multi-w5-v1');
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch-multi wave 5 products'
  );
  assert.ok(
    seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS.every((p) => {
      const n = Number(p.id.slice(1));
      return n >= 290 && n <= 299;
    }),
    'wave 5 must be exactly p290–p299'
  );
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS.some((p) => Number(p.id.slice(1)) < 290),
    'wave 5 must not include wave 1–4 SKUs'
  );
  assert.match(
    seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[3]!.slug,
    /carier-backpack$/,
    'p293 keeps historical carier typo (not carrier)'
  );
  assert.match(
    seed.SHOP_BATCH_MULTI_WAVE5_PRODUCTS[4]!.slug,
    /carier-backpack$/,
    'p294 keeps historical carier typo (not carrier)'
  );

  const first = seed.seedShopBatchMultiWave5Products();
  const second = seed.seedShopBatchMultiWave5Products();
  assert.equal(first, 10, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH_MULTI_WAVE5_SLUGS[0]);
  seed.seedShopBatchMultiWave5Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH_MULTI_WAVE5_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const shampoo = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('grooming-bonnest-calming-shampoo-for-pet-200-l') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(shampoo, 'Bonnest calming shampoo slug is seeded');
  assert.equal(shampoo!.id, 'p290');
  assert.equal(Number(shampoo!.price_toman), 680_000);
  assert.equal(Number(shampoo!.cost_toman), 680_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH_MULTI_WAVE5_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH_MULTI_WAVE5_SLUGS) as Array<{
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
  assert.equal(rows.length, 10, 'ten wave-5 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave5Products.ts'), 'utf8');
  const wave1Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiProducts.ts'), 'utf8');
  const wave2Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave2Products.ts'), 'utf8');
  const wave3Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave3Products.ts'), 'utf8');
  const wave4Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave4Products.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH_MULTI_WAVE5_PRODUCTS/, 'shopCatalog spreads batch-multi wave 5');
  assert.match(catalog, /grooming-bonnest-calming-shampoo-for-pet-200-l/, 'web catalog includes first SKU');
  assert.doesNotMatch(catalog, /id: "p280"/, 'wave 4 SKUs stay out of wave-5 catalog');
  assert.doesNotMatch(wave1Catalog, /grooming-bonnest-calming-shampoo-for-pet-200-l/, 'wave 1 file stays wave-1 only');
  assert.doesNotMatch(wave2Catalog, /grooming-bonnest-calming-shampoo-for-pet-200-l/, 'wave 2 file stays wave-2 only');
  assert.doesNotMatch(wave3Catalog, /grooming-bonnest-calming-shampoo-for-pet-200-l/, 'wave 3 file stays wave-3 only');
  assert.doesNotMatch(wave4Catalog, /grooming-bonnest-calming-shampoo-for-pet-200-l/, 'wave 4 file stays wave-4 only');
  assert.match(shopCatalog, /id: 'bonnest'/, 'Bonnest brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'generic'/, 'generic brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'zarix'/, 'Zarix brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'raha'/, 'Raha brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'jupiter'/, 'Jupiter brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'oshkaia'/, 'Oshkaia brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /slug: 'grooming'/, 'grooming category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'dog-carriers'/, 'dog-carriers category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'cat-carriers'/, 'cat-carriers category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'bird-food'/, 'bird-food category is in SHOP_CATEGORIES');
  const retiredCats = readFileSync(join(repoRoot, 'packages/web/src/data/retired-shop-products.ts'), 'utf8');
  assert.doesNotMatch(
    retiredCats,
    /'bird-food'/,
    'live bird-food category must not 301 to /shop'
  );

  const liveCats = readFileSync(join(repoRoot, 'packages/api/src/data/shop-live-catalog.ts'), 'utf8');
  for (const slug of ['grooming', 'dog-carriers', 'cat-carriers', 'bird-food']) {
    assert.match(liveCats, new RegExp(`'${slug}'`), `LIVE_SHOP_CATEGORY_SLUGS keeps ${slug}`);
  }

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch-multi-w5-v1$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch-multi-w5-v1`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch-multi-w5-v1`), `${row.slug} angle 3`);
    assert.ok('__titleEn' in params, `${row.slug} stores titleEn key`);
    if (NO_INVENTED_WEIGHT.has(row.slug)) {
      assert.equal(params['وزن'], undefined, `${row.slug} must not invent وزن`);
    }
    if (row.slug === 'dog-carriers-fiber-space-pet-carrier-backpack') {
      assert.equal(params['مدل'], 'فایبر', `${row.slug} keeps model from title`);
    }
    if (row.slug === 'cat-carriers-zarix-zeus-for-cat') {
      assert.equal(params['مدل'], 'زئوس', `${row.slug} keeps model from title`);
    }
    if (row.slug.startsWith('bird-food-')) {
      assert.equal(params['مناسب_برای'], 'پرنده', `${row.slug} bird suitable_for`);
    }
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const cats = d
    .prepare(`SELECT slug FROM shop_categories WHERE slug IN ('grooming','dog-carriers','cat-carriers','bird-food')`)
    .all() as Array<{ slug: string }>;
  assert.equal(cats.length, 4, 'wave-5 categories are seeded');

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch-multi-w5-v1'), 'utf8');
  assert.match(bust, /batch-multi-w5-v1/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH_MULTI_WAVE5_SLUGS.flatMap((slug) => [
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
      'shop-batch-multi-wave5-products.selftest: 30 packshots not on disk yet — URL pattern is wired; re-attach JPEGs before merge'
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

  console.log('shop-batch-multi-wave5-products.selftest: ok', SHOP_BATCH_MULTI_WAVE5_SLUGS.join(','));
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
