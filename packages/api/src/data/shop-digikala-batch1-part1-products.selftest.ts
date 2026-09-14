/**
 * Shop Digikala batch1 Part1 — 10 SKUs, zero margin, 3-angle digikala-b1-p1-v1 galleries.
 * Packshots may be absent on disk (warn) until the follow-up JPEG commit.
 * Run: npx tsx src/data/shop-digikala-batch1-part1-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART1_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-digikala-b1-p1-'));
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
  'cat-food-dkp-21263751': 1_549_000,
  'cat-food-dkp-10928475': 249_000,
  'dog-food-dkp-15589693': 186_000,
  'cat-treats-dkp-9520987': 480_000,
  'cat-treats-dkp-3333058': 200_000,
  'cat-toys-dkp-17977789': 1_222_000,
  'cat-toys-dkp-17292457': 590_000,
  'cat-toys-dkp-17411871': 489_450,
  'cat-toys-dkp-5570618': 390_000,
  'cat-toys-dkp-17412089': 380_000,
};

const KNOWN_WEIGHT: Record<string, string> = {
  'cat-food-dkp-10928475': '۸۵ گرم',
  'dog-food-dkp-15589693': '۹۰ گرم',
  'cat-toys-dkp-17412089': '۴۰ گرم',
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-digikala-batch1-part1-products');

  assert.deepEqual(
    [...seed.SHOP_DIGIKALA_BATCH1_PART1_SLUGS],
    [...SHOP_DIGIKALA_BATCH1_PART1_SLUGS],
    'slug export'
  );
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.length, 10, '10 Part1 SKUs');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[0]?.id, 'p300');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.at(-1)?.id, 'p309');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[0]?.slug, 'cat-food-dkp-21263751');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[1]?.slug, 'cat-food-dkp-10928475');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[2]?.id, 'p302');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[2]?.slug, 'dog-food-dkp-15589693');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[3]?.id, 'p303');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[3]?.slug, 'cat-treats-dkp-9520987');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[4]?.id, 'p304');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[4]?.slug, 'cat-treats-dkp-3333058');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[5]?.slug, 'cat-toys-dkp-17977789');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[9]?.id, 'p309');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[9]?.slug, 'cat-toys-dkp-17412089');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_CACHE_BUST, 'digikala-b1-p1-v1');
  assert.ok(
    !seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.some((p) =>
      (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)
    ),
    'no held slugs remain in Digikala Part1 products'
  );
  assert.ok(
    seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.every((p) => {
      const n = Number(p.id.slice(1));
      return n >= 300 && n <= 309;
    }),
    'Part1 must be exactly p300–p309'
  );
  assert.ok(
    !seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.some((p) => Number(p.id.slice(1)) < 300),
    'Part1 must not include batch-multi wave SKUs'
  );

  const first = seed.seedShopDigikalaBatch1Part1Products();
  const second = seed.seedShopDigikalaBatch1Part1Products();
  assert.equal(first, 10, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(
    SHOP_DIGIKALA_BATCH1_PART1_SLUGS[0]
  );
  seed.seedShopDigikalaBatch1Part1Products();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_DIGIKALA_BATCH1_PART1_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const gourmet = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('cat-food-dkp-21263751') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(gourmet, 'Gourmet 6-pack slug is seeded');
  assert.equal(gourmet!.id, 'p300');
  assert.equal(Number(gourmet!.price_toman), 1_549_000);
  assert.equal(Number(gourmet!.cost_toman), 1_549_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_DIGIKALA_BATCH1_PART1_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_DIGIKALA_BATCH1_PART1_SLUGS) as Array<{
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
  assert.equal(rows.length, 10, 'ten Part1 rows');

  const catalog = readFileSync(
    join(repoRoot, 'packages/web/src/data/shopDigikalaBatch1Part1Products.ts'),
    'utf8'
  );
  const wave5Catalog = readFileSync(
    join(repoRoot, 'packages/web/src/data/shopBatchMultiWave5Products.ts'),
    'utf8'
  );
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(
    shopCatalog,
    /SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS/,
    'shopCatalog spreads Digikala batch1 Part1'
  );
  assert.match(catalog, /cat-food-dkp-21263751/, 'web catalog includes first SKU');
  assert.doesNotMatch(catalog, /id: "p290"/, 'wave 5 SKUs stay out of Part1 catalog');
  assert.doesNotMatch(catalog, /id: 'p290'/, 'wave 5 SKUs stay out of Part1 catalog');
  assert.doesNotMatch(wave5Catalog, /cat-food-dkp-21263751/, 'wave 5 file stays wave-5 only');
  assert.match(shopCatalog, /id: 'gourmet'/, 'Gourmet brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'wanpy'/, 'Wanpy brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'biodop'/, 'Biodop brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'generic'/, 'generic brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /slug: 'cat-food'/, 'cat-food category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'dog-food'/, 'dog-food category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'cat-treats'/, 'cat-treats category is in SHOP_CATEGORIES');
  assert.match(shopCatalog, /slug: 'cat-toys'/, 'cat-toys category is in SHOP_CATEGORIES');

  const liveCats = readFileSync(join(repoRoot, 'packages/api/src/data/shop-live-catalog.ts'), 'utf8');
  for (const slug of ['cat-food', 'dog-food', 'cat-treats', 'cat-toys']) {
    assert.match(liveCats, new RegExp(`'${slug}'`), `LIVE_SHOP_CATEGORY_SLUGS keeps ${slug}`);
  }

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact Digikala PDP price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=digikala-b1-p1-v1$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=digikala-b1-p1-v1`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=digikala-b1-p1-v1`), `${row.slug} angle 3`);
    assert.ok('__titleEn' in params, `${row.slug} stores titleEn key`);
    if (KNOWN_WEIGHT[row.slug]) {
      assert.equal(params['وزن'], KNOWN_WEIGHT[row.slug], `${row.slug} keeps title weight`);
    } else {
      assert.equal(params['وزن'], undefined, `${row.slug} must not invent وزن`);
    }
    if (row.slug === 'cat-toys-dkp-17977789') {
      assert.equal(params['مدل'], 'LP20', `${row.slug} keeps model from title`);
    }
    if (row.slug === 'cat-toys-dkp-5570618') {
      assert.equal(params['مدل'], 'Bell', `${row.slug} keeps model from title`);
    }
    if (row.slug === 'cat-toys-dkp-17412089') {
      assert.equal(params['مدل'], 'Worm', `${row.slug} keeps model from title`);
    }
    if (row.slug === 'cat-treats-dkp-9520987') {
      assert.match(row.description, /انگل‌کشی خودسرانه نکن/);
      assert.match(row.description, /دامپزشک تعیین می‌کند/);
      assert.equal(params['مناسب_برای'], 'سگ', `${row.slug} dog suitable_for`);
    }
    if (row.slug === 'cat-treats-dkp-3333058') {
      assert.match(row.description, /طبق نظر دامپزشک مصرف کن/);
      assert.match(row.description, /جایگزین درمان نیست/);
      assert.equal(params['مناسب_برای'], 'سگ و گربه', `${row.slug} dog+cat suitable_for`);
    }
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const cats = d
    .prepare(`SELECT slug FROM shop_categories WHERE slug IN ('cat-food','dog-food','cat-treats','cat-toys')`)
    .all() as Array<{ slug: string }>;
  assert.equal(cats.length, 4, 'Part1 categories are seeded');

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-digikala-b1-p1-v1'), 'utf8');
  assert.match(bust, /digikala-b1-p1-v1/, 'cache-bust marker present');

  const imageNames = SHOP_DIGIKALA_BATCH1_PART1_SLUGS.flatMap((slug) => [
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
      'shop-digikala-batch1-part1-products.selftest: 30 packshots not on disk yet — URL pattern is wired; re-attach JPEGs before merge'
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

  console.log(
    'shop-digikala-batch1-part1-products.selftest: ok',
    SHOP_DIGIKALA_BATCH1_PART1_SLUGS.join(',')
  );
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
