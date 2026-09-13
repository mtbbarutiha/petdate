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

const IMAGES = [
  'royal-canin-mini-adult-2kg.jpg',
  'royal-canin-mini-adult-2kg-2.jpg',
  'royal-canin-mini-adult-2kg-3.jpg',
  'royal-canin-xsmall-puppy-1.5kg.jpg',
  'royal-canin-xsmall-puppy-1.5kg-2.jpg',
  'royal-canin-xsmall-puppy-1.5kg-3.jpg',
  'royal-canin-persian-adult-400g.jpg',
  'royal-canin-persian-adult-400g-2.jpg',
  'royal-canin-persian-adult-400g-3.jpg',
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
    assert.match(row.image, /\?v=gallery-v1$/, `${row.slug} image is cache-busted gallery-v1`);
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
  const galleryBust = readFileSync(join(repoRoot, 'tmp/cache-bust-royal-canin-gallery-v1'), 'utf8');
  assert.match(galleryBust, /royal-canin-gallery-v1/, '3-angle gallery cache-bust marker present');

  const p221 = rows.find((r) => r.slug === SLUGS[0]);
  assert.ok(p221, 'p221 row');
  assert.match(p221!.image, /royal-canin-mini-adult-2kg\.jpg\?v=gallery-v1$/, 'p221 image is cache-busted gallery-v1');
  assert.doesNotMatch(p221!.image, /purple|5c4d91|بنفش/i, 'p221 must not be a purple cutout');
  assert.match(
    catalog,
    /royal-canin-mini-adult-2kg\.jpg\?v=gallery-v1[\s\S]{0,180}royal-canin-mini-adult-2kg-2\.jpg\?v=gallery-v1[\s\S]{0,120}royal-canin-mini-adult-2kg-3\.jpg\?v=gallery-v1/,
    'p221 catalog images[] is 3-angle gallery-v1'
  );
  assert.match(
    catalog,
    /royal-canin-xsmall-puppy-1\.5kg\.jpg\?v=gallery-v1[\s\S]{0,180}royal-canin-xsmall-puppy-1\.5kg-2\.jpg\?v=gallery-v1[\s\S]{0,120}royal-canin-xsmall-puppy-1\.5kg-3\.jpg\?v=gallery-v1/,
    'p222 catalog images[] is 3-angle gallery-v1'
  );
  assert.match(
    catalog,
    /royal-canin-persian-adult-400g\.jpg\?v=gallery-v1[\s\S]{0,180}royal-canin-persian-adult-400g-2\.jpg\?v=gallery-v1[\s\S]{0,120}royal-canin-persian-adult-400g-3\.jpg\?v=gallery-v1/,
    'p223 catalog images[] is 3-angle gallery-v1'
  );
  assert.equal(seed.ROYAL_CANIN_PILOT_PRODUCTS.length, 3, 'no extra purple test SKU');
  assert.ok(
    !seed.ROYAL_CANIN_PILOT_SLUGS.some((s) => /purple|bg-purple/i.test(s)),
    'no purple-bg test slug'
  );

  const pepitoCss = readFileSync(join(repoRoot, 'packages/web/src/styles/pepito.css'), 'utf8');
  assert.match(
    pepitoCss,
    /\.pd-shop-card-media\s*\{[^}]*background:\s*#ffffff/,
    'listing card photo well is #ffffff, not brand purple'
  );
  assert.match(
    pepitoCss,
    /\.pd-shop-card-media\s*\{[^}]*border-radius:\s*inherit/,
    'listing photo well rounds via inherit, card chrome untouched'
  );
  assert.match(
    pepitoCss,
    /\.pd-shop-card-media img\s*\{[^}]*border-radius:\s*inherit/,
    'listing packshot img has inherited radius'
  );
  assert.match(
    pepitoCss,
    /\.pd-dk-gallery-main\s*\{[^}]*background:\s*#ffffff/,
    'PDP gallery well is #ffffff'
  );
  assert.match(
    pepitoCss,
    /\.pd-shop-cart-thumb\s*\{[^}]*background:\s*#ffffff/,
    'cart thumb well is #ffffff'
  );

  for (const name of IMAGES) {
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
