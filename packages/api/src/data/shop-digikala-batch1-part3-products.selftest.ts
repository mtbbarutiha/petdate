/**
 * Shop Digikala batch1 Part3 — 10 SKUs, zero margin, front-only digikala-b1-p3-v1 galleries.
 * Run: npx tsx src/data/shop-digikala-batch1-part3-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART3_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-digikala-b1-p3-'));
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
  "cat-food-dkp-21258454": 828_000,,
  "cat-food-dkp-20696007": 275_000,,
  "cat-food-dkp-20696405": 275_000,,
  "cat-food-dkp-19887269": 175_000,,
  "cat-food-dkp-20695998": 175_000,,
  "cat-food-dkp-21930259": 158_000,,
  "dog-food-dkp-6236417": 366_700,,
  "dog-food-dkp-20620037": 270_000,,
  "dog-food-dkp-20949467": 195_000,,
  "dog-food-dkp-20949492": 195_000,
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-digikala-batch1-part3-products');

  assert.deepEqual([...seed.SHOP_DIGIKALA_BATCH1_PART3_SLUGS], [...SHOP_DIGIKALA_BATCH1_PART3_SLUGS], 'slug export');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS.length, 10, '10 part3 SKUs');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[0]?.id, 'p320');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS.at(-1)?.id, 'p329');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[0]?.id, "p320");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[0]?.slug, "cat-food-dkp-21258454");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[1]?.id, "p321");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[1]?.slug, "cat-food-dkp-20696007");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[2]?.id, "p322");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[2]?.slug, "cat-food-dkp-20696405");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[3]?.id, "p323");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[3]?.slug, "cat-food-dkp-19887269");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[4]?.id, "p324");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[4]?.slug, "cat-food-dkp-20695998");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[5]?.id, "p325");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[5]?.slug, "cat-food-dkp-21930259");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[6]?.id, "p326");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[6]?.slug, "dog-food-dkp-6236417");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[7]?.id, "p327");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[7]?.slug, "dog-food-dkp-20620037");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[8]?.id, "p328");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[8]?.slug, "dog-food-dkp-20949467");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[9]?.id, "p329");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS[9]?.slug, "dog-food-dkp-20949492");

  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS) {
    assert.equal(p.costToman, p.priceToman, `${p.id} zero margin`);
    assert.equal(p.priceToman, EXPECTED_PRICE[p.slug], `${p.id} price`);
    assert.equal(p.images.length, 1, `${p.id} front-only gallery`);
    assert.equal(p.image, p.images[0], `${p.id} cover equals sole angle`);
    assert.ok(p.image.includes(`?v=digikala-b1-p3-v1`), `${p.id} cache bust`);
    assert.ok(!p.image.includes('-2.jpg') && !p.image.includes('-3.jpg'), `${p.id} no fake angles`);
    assert.ok(p.description.includes('پت دیت شاپ') || p.description.includes('پت‌دیت شاپ'), `${p.id} seller`);
    assert.doesNotMatch(p.image, /purple|5c4d91/i, `${p.id} no purple`);
    const file = join(repoRoot, `packages/web/public/pepito/uploads/${p.slug}.jpg`);
    assert.ok(existsSync(file), `missing ${file}`);
    assert.ok(!existsSync(join(repoRoot, `packages/web/public/pepito/uploads/${p.slug}-2.jpg`)), `${p.slug} must not invent -2`);
    assert.ok(!existsSync(join(repoRoot, `packages/web/public/pepito/uploads/${p.slug}-3.jpg`)), `${p.slug} must not invent -3`);
    const bytes = readFileSync(file);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    const { w, h } = jpegSofSize(bytes);
    assert.ok(w >= 600 && h >= 600, `${p.slug} size ${w}x${h}`);
  }

  const first = seed.seedShopDigikalaBatch1Part3Products();
  const second = seed.seedShopDigikalaBatch1Part3Products();
  assert.equal(first, 10);
  assert.equal(second, 10, 'idempotent');

  // Scope carefully: Part2 is p31%, Part3 is p32% — never use bare p3%
  const rows = d.prepare(`SELECT id, slug, price_toman, cost_toman, image FROM shop_products WHERE id LIKE 'p32%'`).all() as any[];
  assert.equal(rows.length, 10);
  for (const r of rows) {
    assert.equal(Number(r.price_toman), Number(r.cost_toman), `${r.id} db zero margin`);
    assert.ok(String(r.image).includes('digikala-b1-p3-v1'));
  }

  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS) {
    assert.ok(tomanToShopCoins(p.priceToman) >= 1);
  }

  assert.equal(HELD_SHOP_SLUGS.length, 0);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log('shop-digikala-batch1-part3-products.selftest OK');
}

main().catch((err) => {
  console.error(err);
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
