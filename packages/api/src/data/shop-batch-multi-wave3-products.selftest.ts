/**
 * Shop Batch-multi wave 3/5 — 10 SKUs, zero margin, 3-angle batch-multi-w3-v1 galleries.
 * Run: npx tsx src/data/shop-batch-multi-wave3-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE3_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch-multi-w3-'));
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
  'dog-toys-luna-pomegranate-felt-squeaky-dog-toy': 322_000,
  'dog-toys-luna-squeaky-watermelon-plush-dog-toy': 312_000,
  'cat-toys-petopoli-4-way-foldable-cat-play-tunnel': 2_310_000,
  'cat-toys-cat-toy-layer-tower-of-tracks': 1_520_000,
  'cat-toys-hanging-catnip-bat-toy-for-cats': 960_000,
  'cat-toys-little-yellow-cat-toy': 825_000,
  'cat-toys-play-tunnel-bag': 792_000,
  'cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats': 610_050,
  'dog-accessories-hannapet-silicone-h-harness-size-l': 4_355_000,
  'dog-accessories-hannapet-silicone-dog-leash-size-l': 3_332_000,
};

const NO_INVENTED_WEIGHT = new Set([
  'dog-toys-luna-pomegranate-felt-squeaky-dog-toy',
  'dog-toys-luna-squeaky-watermelon-plush-dog-toy',
  'cat-toys-petopoli-4-way-foldable-cat-play-tunnel',
  'cat-toys-cat-toy-layer-tower-of-tracks',
  'cat-toys-hanging-catnip-bat-toy-for-cats',
  'cat-toys-little-yellow-cat-toy',
  'cat-toys-play-tunnel-bag',
  'cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats',
  'dog-accessories-hannapet-silicone-h-harness-size-l',
  'dog-accessories-hannapet-silicone-dog-leash-size-l',
]);

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch-multi-wave3-products');

  assert.deepEqual([...seed.SHOP_BATCH_MULTI_WAVE3_SLUGS], [...SHOP_BATCH_MULTI_WAVE3_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS.length, 10, '10 wave-3 SKUs');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[0]?.id, 'p270');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS.at(-1)?.id, 'p279');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[2]?.id, 'p272');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[2]?.slug, 'cat-toys-petopoli-4-way-foldable-cat-play-tunnel');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[8]?.id, 'p278');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[8]?.slug, 'dog-accessories-hannapet-silicone-h-harness-size-l');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[9]?.id, 'p279');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS[9]?.slug, 'dog-accessories-hannapet-silicone-dog-leash-size-l');
  assert.equal(seed.SHOP_BATCH_MULTI_WAVE3_CACHE_BUST, 'batch-multi-w3-v1');
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch-multi wave 3 products'
  );
  assert.ok(
    seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS.every((p) => {
      const n = Number(p.id.slice(1));
      return n >= 270 && n <= 279;
    }),
    'wave 3 must be exactly p270–p279'
  );
  assert.ok(
    !seed.SHOP_BATCH_MULTI_WAVE3_PRODUCTS.some((p) => Number(p.id.slice(1)) < 270),
    'wave 3 must not include wave 1/2 SKUs'
  );

  const first = seed.seedShopBatchMultiWave3Products();
  const second = seed.seedShopBatchMultiWave3Products();
  assert.equal(first, 10, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH_MULTI_WAVE3_SLUGS[0]);
  seed.seedShopBatchMultiWave3Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH_MULTI_WAVE3_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const pomegranate = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('dog-toys-luna-pomegranate-felt-squeaky-dog-toy') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(pomegranate, 'Luna pomegranate felt toy slug is seeded');
  assert.equal(pomegranate!.id, 'p270');
  assert.equal(Number(pomegranate!.price_toman), 322_000);
  assert.equal(Number(pomegranate!.cost_toman), 322_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH_MULTI_WAVE3_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH_MULTI_WAVE3_SLUGS) as Array<{
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
  assert.equal(rows.length, 10, 'ten wave-3 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave3Products.ts'), 'utf8');
  const wave1Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiProducts.ts'), 'utf8');
  const wave2Catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiWave2Products.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH_MULTI_WAVE3_PRODUCTS/, 'shopCatalog spreads batch-multi wave 3');
  assert.match(catalog, /dog-toys-luna-pomegranate-felt-squeaky-dog-toy/, 'web catalog includes first SKU');
  assert.doesNotMatch(catalog, /cat-accessories-hannapet-double-wooden-bowl-stand/, 'later waves stay out of wave-3 catalog');
  assert.doesNotMatch(wave1Catalog, /dog-toys-luna-pomegranate-felt-squeaky-dog-toy/, 'wave 1 file stays wave-1 only');
  assert.doesNotMatch(wave2Catalog, /dog-toys-luna-pomegranate-felt-squeaky-dog-toy/, 'wave 2 file stays wave-2 only');
  assert.match(shopCatalog, /id: 'luna'/, 'Luna brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'petopoli'/, 'Petopoli brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'juicer'/, 'Juicer brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'hannapet'/, 'Hannapet brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'generic'/, 'generic brand is in SHOP_BRANDS');

  const liveCats = readFileSync(join(repoRoot, 'packages/api/src/data/shop-live-catalog.ts'), 'utf8');
  for (const slug of ['dog-toys', 'cat-toys', 'dog-accessories']) {
    assert.match(liveCats, new RegExp(`'${slug}'`), `LIVE_SHOP_CATEGORY_SLUGS keeps ${slug}`);
  }

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch-multi-w3-v1$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch-multi-w3-v1`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch-multi-w3-v1`), `${row.slug} angle 3`);
    assert.ok('__titleEn' in params, `${row.slug} stores titleEn key`);
    if (NO_INVENTED_WEIGHT.has(row.slug)) {
      assert.equal(params['وزن'], undefined, `${row.slug} must not invent وزن`);
    }
    if (row.slug.endsWith('-size-l')) {
      assert.equal(params['سایز'], 'L', `${row.slug} keeps size L from title`);
    }
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const cats = d
    .prepare(`SELECT slug FROM shop_categories WHERE slug IN ('dog-toys','cat-toys','dog-accessories')`)
    .all() as Array<{ slug: string }>;
  assert.equal(cats.length, 3, 'wave-3 categories are seeded');

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch-multi-w3-v1'), 'utf8');
  assert.match(bust, /batch-multi-w3-v1/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH_MULTI_WAVE3_SLUGS.flatMap((slug) => [
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
      'shop-batch-multi-wave3-products.selftest: 30 packshots not on disk yet — URL pattern is wired; re-attach JPEGs before merge'
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

  console.log('shop-batch-multi-wave3-products.selftest: ok', SHOP_BATCH_MULTI_WAVE3_SLUGS.join(','));
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
