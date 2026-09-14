/**
 * Shop Batch-multi wave 1/5 — 10 SKUs, zero margin, 3-angle batch-multi-w1-v4 galleries.
 * Run: npx tsx src/data/shop-batch-multi-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-batch-multi-'));
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
  'cat-litter-mr-cat-cat-litter-10-l-carbon': 502_000,
  'cat-litter-mr-cat-baby-powder-scented-cat-litter-10l-10-kg': 449_000,
  'cat-litter-meocat-activated-carbon-cat-litter-economy': 424_000,
  'cat-litter-mr-cat-oxygen-cat-litter-10-l-10-kg': 414_000,
  'cat-litter-meocat-super-clump-cat-litter-economy': 369_000,
  'cat-litter-mr-cat-kitten-cat-litter-7l-7-kg': 229_000,
  'dog-treats-afp-chill-out-ice-bone': 1_790_000,
  'dog-treats-dr-clauders-pork-filet-strips-80-g': 760_000,
  'dog-treats-rabbit-fillet-dr-clauders-80-g': 760_000,
  'dog-treats-wanpy-toothbrush-chews-100g': 660_000,
};

const NO_INVENTED_WEIGHT = new Set([
  'cat-litter-meocat-activated-carbon-cat-litter-economy',
  'cat-litter-meocat-super-clump-cat-litter-economy',
  'dog-treats-afp-chill-out-ice-bone',
]);

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-batch-multi-products');

  assert.deepEqual([...seed.SHOP_BATCH_MULTI_SLUGS], [...SHOP_BATCH_MULTI_SLUGS], 'slug export');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS.length, 10, '10 wave-1 SKUs');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS[0]?.id, 'p250');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS.at(-1)?.id, 'p259');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS[7]?.id, 'p257');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS[7]?.slug, 'dog-treats-dr-clauders-pork-filet-strips-80-g');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS[8]?.id, 'p258');
  assert.equal(seed.SHOP_BATCH_MULTI_PRODUCTS[8]?.slug, 'dog-treats-rabbit-fillet-dr-clauders-80-g');
  assert.equal(seed.SHOP_BATCH_MULTI_CACHE_BUST, 'batch-multi-w1-v4');
  assert.ok(
    !seed.SHOP_BATCH_MULTI_PRODUCTS.some((p) => (HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)),
    'no held slugs remain in batch-multi products'
  );
  assert.ok(
    !seed.SHOP_BATCH_MULTI_PRODUCTS.some((p) => p.id > 'p259' || Number(p.id.slice(1)) > 259),
    'wave 1 must not include later-wave SKUs'
  );

  const first = seed.seedShopBatchMultiProducts();
  const second = seed.seedShopBatchMultiProducts();
  assert.equal(first, 10, 'seed count');
  assert.equal(second, first, 'idempotent count');

  d.prepare(`UPDATE shop_products SET stock_qty = 4 WHERE slug = ?`).run(SHOP_BATCH_MULTI_SLUGS[0]);
  seed.seedShopBatchMultiProducts();
  const afterStock = d
    .prepare(`SELECT stock_qty FROM shop_products WHERE slug = ?`)
    .get(SHOP_BATCH_MULTI_SLUGS[0]) as { stock_qty: number };
  assert.equal(Number(afterStock.stock_qty), 4, 're-seed must not reset live stock');

  const carbon = d
    .prepare(`SELECT id, price_toman, cost_toman FROM shop_products WHERE slug = ?`)
    .get('cat-litter-mr-cat-cat-litter-10-l-carbon') as
    | { id: string; price_toman: number; cost_toman: number }
    | undefined;
  assert.ok(carbon, 'MR.CAT carbon litter slug is seeded');
  assert.equal(carbon!.id, 'p250');
  assert.equal(Number(carbon!.price_toman), 502_000);
  assert.equal(Number(carbon!.cost_toman), 502_000);

  const rows = d
    .prepare(
      `SELECT slug, title, price_toman, cost_toman, image, badge, featured, in_stock, description, params
       FROM shop_products WHERE slug IN (${SHOP_BATCH_MULTI_SLUGS.map(() => '?').join(',')})`
    )
    .all(...SHOP_BATCH_MULTI_SLUGS) as Array<{
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
  assert.equal(rows.length, 10, 'ten wave-1 rows');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiProducts.ts'), 'utf8');
  const shopCatalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  assert.match(shopCatalog, /SHOP_BATCH_MULTI_PRODUCTS/, 'shopCatalog spreads batch-multi');
  assert.match(catalog, /cat-litter-mr-cat-cat-litter-10-l-carbon/, 'web catalog includes first SKU');
  assert.doesNotMatch(catalog, /dog-treats-wanpy-chicken-jerky-chips-100g/, 'later waves stay out of web catalog');
  assert.match(shopCatalog, /id: 'mr-cat'/, 'MR.CAT brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'meocat'/, 'Meocat brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'afp'/, 'AFP brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'dr-clauders'/, 'Dr.Clauder brand is in SHOP_BRANDS');
  assert.match(shopCatalog, /id: 'wanpy'/, 'Wanpy brand is in SHOP_BRANDS');

  const liveCats = readFileSync(join(repoRoot, 'packages/api/src/data/shop-live-catalog.ts'), 'utf8');
  for (const slug of ['cat-litter', 'dog-treats']) {
    assert.match(liveCats, new RegExp(`'${slug}'`), `LIVE_SHOP_CATEGORY_SLUGS keeps ${slug}`);
  }

  for (const row of rows) {
    assert.equal(row.price_toman, EXPECTED_PRICE[row.slug], `${row.slug} exact MANIFEST price`);
    assert.equal(row.cost_toman, row.price_toman, `${row.slug} margin 0`);
    assert.match(row.image, new RegExp(`/pepito/uploads/${row.slug}\\.jpg\\?v=batch-multi-w1-v4$`));
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
    assert.ok(gallery[1]?.includes(`${row.slug}-2.jpg?v=batch-multi-w1-v4`), `${row.slug} angle 2`);
    assert.ok(gallery[2]?.includes(`${row.slug}-3.jpg?v=batch-multi-w1-v4`), `${row.slug} angle 3`);
    assert.ok('__titleEn' in params, `${row.slug} stores titleEn key`);
    if (NO_INVENTED_WEIGHT.has(row.slug)) {
      assert.equal(params['وزن'], undefined, `${row.slug} must not invent وزن`);
    }
    assert.match(catalog, new RegExp(row.slug.replace(/-/g, '\\-')), `web catalog has ${row.slug}`);
  }

  const cats = d
    .prepare(`SELECT slug FROM shop_categories WHERE slug IN ('cat-litter','dog-treats')`)
    .all() as Array<{ slug: string }>;
  assert.equal(cats.length, 2, 'wave-1 categories are seeded');

  const bust = readFileSync(join(repoRoot, 'tmp/cache-bust-shop-batch-multi-w1-v4'), 'utf8');
  assert.match(bust, /batch-multi-w1-v4/, 'cache-bust marker present');

  const imageNames = SHOP_BATCH_MULTI_SLUGS.flatMap((slug) => [
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
      'shop-batch-multi-products.selftest: 30 packshots not on disk yet — URL pattern is wired; re-attach JPEGs before merge'
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

  console.log('shop-batch-multi-products.selftest: ok', SHOP_BATCH_MULTI_SLUGS.join(','));
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
