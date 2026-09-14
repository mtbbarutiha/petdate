/**
 * Live shop catalog is exactly p221–p259. Demo p1–p220 must purge and never re-seed.
 * Run: npx tsx src/data/shop-live-catalog.selftest.ts
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_SHOP_PRODUCT_IDS, ZERO_MARGIN_SHOP_SLUGS } from './shop-zero-margin-slugs.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-live-catalog-'));
process.env.DATABASE_PATH = join(tmpDir, 'test.db');
process.env.DATABASE_URL = '';

const KEEP_PRICES: Record<string, number> = {
  p221: 8_881_000,
  p222: 8_294_000,
  p223: 2_742_000,
  p224: 8_294_000,
  p225: 7_841_000,
  p226: 8_881_000,
  p227: 7_826_000,
  p228: 7_841_000,
  p229: 4_004_000,
  p230: 3_900_000,
  p231: 2_742_000,
  p232: 2_742_000,
  p233: 10_217_000,
  p234: 2_742_000,
  p235: 4_004_000,
  p236: 10_217_000,
  p237: 4_004_000,
  p238: 4_004_000,
  p239: 10_395_000,
  p240: 9_450_000,
  p241: 9_415_000,
  p242: 12_100_000,
  p243: 12_100_000,
  p244: 9_623_000,
  p245: 14_821_000,
  p246: 14_821_000,
  p247: 14_820_000,
  p248: 14_820_000,
  p249: 11_702_000,
  p250: 502_000,
  p251: 449_000,
  p252: 424_000,
  p253: 414_000,
  p254: 369_000,
  p255: 229_000,
  p256: 1_790_000,
  p257: 760_000,
  p258: 760_000,
  p259: 660_000,
};

async function main() {
  assert.equal(LIVE_SHOP_PRODUCT_IDS.length, 39, '39 live ids');
  assert.equal(ZERO_MARGIN_SHOP_SLUGS.length, 39, '39 live slugs');

  const catalog = readFileSync(join(repoRoot, 'packages/web/src/data/shopCatalog.ts'), 'utf8');
  const batch2 = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatch2Products.ts'), 'utf8');
  const batch3 = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatch3Products.ts'), 'utf8');
  const batchMulti = readFileSync(join(repoRoot, 'packages/web/src/data/shopBatchMultiProducts.ts'), 'utf8');
  assert.match(catalog, /Live shop catalog — 3 Royal Canin pilots/);
  assert.doesNotMatch(catalog, /id: 'p1'/);
  assert.doesNotMatch(catalog, /dog-food-1-p1/);
  assert.match(catalog, /id: 'p221'/);
  assert.match(catalog, /SHOP_BATCH2_PRODUCTS/);
  assert.match(catalog, /SHOP_BATCH3_PRODUCTS/);
  assert.match(catalog, /SHOP_BATCH_MULTI_PRODUCTS/);
  assert.match(batch2, /id: 'p235'/);
  assert.match(batch2, /cat-food-josera-kitten-2kg/);
  assert.match(batch3, /id: 'p236'/);
  assert.match(batch3, /id: 'p249'/);
  assert.match(batch3, /cat-food-josera-marinesse-2kg/);
  assert.match(batchMulti, /id: "p250"/);
  assert.match(batchMulti, /id: "p259"/);
  assert.doesNotMatch(batchMulti, /id: "p260"/);

  const priceJson = JSON.parse(
    readFileSync(join(repoRoot, 'packages/api/src/data/shop-price-index.json'), 'utf8')
  ) as Array<{ id: string; slug: string; priceToman: number }>;
  assert.equal(priceJson.length, 39, 'price index JSON is 39 SKUs');
  assert.ok(!priceJson.some((e) => e.id === 'p1'), 'price index has no demo p1');
  for (const id of LIVE_SHOP_PRODUCT_IDS) {
    const row = priceJson.find((e) => e.id === id);
    assert.ok(row, `price index has ${id}`);
    assert.equal(row!.priceToman, KEEP_PRICES[id], `${id} price index unchanged`);
  }

  const { lookupShopPrice, shopPriceIndexSize } = await import('../services/shop-price-index');
  assert.equal(shopPriceIndexSize(), 39, 'runtime price index size is 39');
  assert.equal(lookupShopPrice('p1'), null, 'p1 is not checkout-priceable');
  assert.equal(lookupShopPrice('dog-food-1-p1'), null);
  assert.equal(lookupShopPrice('p221')?.priceToman, 8_881_000);
  assert.equal(lookupShopPrice('p222')?.priceToman, 8_294_000);
  assert.equal(lookupShopPrice('p235')?.priceToman, 4_004_000);
  assert.equal(lookupShopPrice('p236')?.priceToman, 10_217_000);
  assert.equal(lookupShopPrice('p249')?.priceToman, 11_702_000);
  assert.equal(lookupShopPrice('p250')?.priceToman, 502_000);
  assert.equal(lookupShopPrice('p257')?.priceToman, 760_000);
  assert.equal(lookupShopPrice('p259')?.priceToman, 660_000);

  const { getDb } = await import('../db');
  const d = getDb();
  const { seedRoyalCaninPilotProducts } = await import('./shop-pilot-products');
  const { seedShopBatch2Products } = await import('./shop-batch2-products');
  const { seedShopBatch3Products } = await import('./shop-batch3-products');
  const { seedShopBatchMultiProducts } = await import('./shop-batch-multi-products');
  const { purgeDemoShopProducts, isLiveShopProductIdOrSlug } = await import('./shop-live-catalog');
  const { adminPlatform } = await import('../admin-platform');

  seedRoyalCaninPilotProducts();
  seedShopBatch2Products();
  seedShopBatch3Products();
  seedShopBatchMultiProducts();

  d.prepare(`UPDATE shop_products SET stock_qty = 11 WHERE id = 'p221'`).run();
  d.prepare(`UPDATE shop_products SET stock_qty = 9 WHERE id = 'p235'`).run();
  d.prepare(`UPDATE shop_products SET stock_qty = 7 WHERE id = 'p249'`).run();
  d.prepare(`UPDATE shop_products SET stock_qty = 5 WHERE id = 'p259'`).run();

  d.prepare(
    `INSERT INTO shop_products (
      id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
      image, in_stock, stock_qty, params, description, featured, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 40, '{}', 'demo', 0, datetime('now'))`
  ).run(
    'p1',
    'dog-food-1-p1',
    'غذای خشک سگ بالغ رویال کنین Medium Adult',
    'royal-canin',
    'dog-food',
    '["dog"]',
    4_850_000,
    3_000_000,
    '/pepito/uploads/01-1.png'
  );
  d.prepare(
    `INSERT INTO shop_products (
      id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
      in_stock, stock_qty, description, featured, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 40, 'demo finance', 1, datetime('now'))`
  ).run('pd-kong-classic', 'kong-classic-m', 'کنگ کلاسیک سایز M', 'kong', 'dog-toys', '["dog"]', 890000, 520000);

  const before = d.prepare(`SELECT COUNT(*) AS c FROM shop_products`).get() as { c: number };
  assert.equal(Number(before.c), 41, '39 live + 2 demo before purge');

  const first = purgeDemoShopProducts();
  const second = purgeDemoShopProducts();
  assert.equal(first.products, 2, 'purge deletes only demo rows');
  assert.equal(second.products, 0, 'purge is idempotent');

  const rows = d
    .prepare(`SELECT id, slug, price_toman, image, stock_qty FROM shop_products ORDER BY id`)
    .all() as Array<{
    id: string;
    slug: string;
    price_toman: number;
    image: string | null;
    stock_qty: number;
  }>;
  assert.equal(rows.length, 39, 'exactly 39 live SKUs remain');
  assert.deepEqual(
    rows.map((r) => r.id),
    [...LIVE_SHOP_PRODUCT_IDS],
    'remaining ids are p221–p259'
  );
  for (const row of rows) {
    assert.ok(isLiveShopProductIdOrSlug(row.id), `${row.id} is live`);
    assert.ok(isLiveShopProductIdOrSlug(row.slug), `${row.slug} is live`);
    assert.equal(Number(row.price_toman), KEEP_PRICES[row.id], `${row.id} price unchanged`);
  }
  const p221 = rows.find((r) => r.id === 'p221')!;
  const p235 = rows.find((r) => r.id === 'p235')!;
  const p249 = rows.find((r) => r.id === 'p249')!;
  const p259 = rows.find((r) => r.id === 'p259')!;
  assert.equal(Number(p221.stock_qty), 11, 'p221 stock preserved');
  assert.equal(Number(p235.stock_qty), 9, 'p235 stock preserved');
  assert.equal(Number(p249.stock_qty), 7, 'p249 stock preserved');
  assert.equal(Number(p259.stock_qty), 5, 'p259 stock preserved');
  assert.match(String(p221.image), /royal-canin-mini-adult-2kg\.jpg\?v=gallery-v1$/);
  assert.match(String(p235.image), /cat-food-josera-kitten-2kg\.jpg\?v=batch2-v1$/);
  assert.match(String(p249.image), /dog-food-royal-canin-hypoallergenic-2kg\.jpg\?v=batch3-v2$/);
  assert.match(String(p259.image), /dog-treats-wanpy-toothbrush-chews-100g\.jpg\?v=batch-multi-w1-v1$/);

  assert.equal(adminPlatform.deleteShopProduct('p221'), false, 'cannot delete pilot');
  assert.equal(adminPlatform.deleteShopProduct('p235'), false, 'cannot delete batch 2');
  assert.equal(adminPlatform.deleteShopProduct('p249'), false, 'cannot delete batch 3');
  assert.equal(adminPlatform.deleteShopProduct('p259'), false, 'cannot delete batch-multi wave 1');
  assert.ok(adminPlatform.getShopProduct('p221'), 'p221 still present after refused delete');

  adminPlatform.replaceShopCatalog({
    products: [
      {
        id: 'p1',
        slug: 'dog-food-1-p1',
        title: 'should not come back',
        brandId: 'royal-canin',
        categorySlug: 'dog-food',
        petTypes: ['dog'],
        priceToman: 1,
      },
      {
        id: 'p221',
        slug: 'dog-food-royal-canin-mini-adult-2kg',
        title: 'overwrite attempt',
        brandId: 'royal-canin',
        categorySlug: 'dog-food',
        petTypes: ['dog'],
        priceToman: 1,
        stockQty: 99,
      },
    ],
  });
  const afterSync = adminPlatform.getShopProduct('p221')!;
  assert.equal(afterSync.priceToman, 8_881_000, 'catalog sync must not change p221 price');
  assert.equal(afterSync.stockQty, 11, 'catalog sync must not reset p221 stock');
  assert.equal(adminPlatform.getShopProduct('p1'), null, 'catalog sync must not re-seed p1');
  assert.equal(adminPlatform.listShopProducts().length, 39, 'sync leaves 39 live SKUs');

  console.log('shop-live-catalog.selftest: ok', LIVE_SHOP_PRODUCT_IDS.join(','));
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
