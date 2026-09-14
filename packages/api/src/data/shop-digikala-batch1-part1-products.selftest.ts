/**
 * Shop Digikala batch1 Part1 — 10 SKUs, zero margin, 3-angle digikala-b1-p1-v1 galleries.
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
  "cat-food-dkp-21263751": 1_800_000,
  "cat-food-dkp-10928475": 249_000,
  "dog-food-dkp-15589693": 186_000,
  "cat-treats-dkp-9520987": 480_000,
  "cat-treats-dkp-3333058": 200_000,
  "cat-toys-dkp-17977789": 1_222_000,
  "cat-toys-dkp-17292457": 590_000,
  "cat-toys-dkp-17411871": 489_450,
  "cat-toys-dkp-5570618": 390_000,
  "cat-toys-dkp-17412089": 380_000,
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-digikala-batch1-part1-products');

  assert.deepEqual([...seed.SHOP_DIGIKALA_BATCH1_PART1_SLUGS], [...SHOP_DIGIKALA_BATCH1_PART1_SLUGS], 'slug export');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.length, 10, '10 part1 SKUs');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[0]?.id, 'p300');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS.at(-1)?.id, 'p309');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[0]?.id, "p300");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[0]?.slug, "cat-food-dkp-21263751");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[1]?.id, "p301");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[1]?.slug, "cat-food-dkp-10928475");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[2]?.id, "p302");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[2]?.slug, "dog-food-dkp-15589693");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[3]?.id, "p303");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[3]?.slug, "cat-treats-dkp-9520987");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[4]?.id, "p304");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[4]?.slug, "cat-treats-dkp-3333058");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[5]?.id, "p305");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[5]?.slug, "cat-toys-dkp-17977789");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[6]?.id, "p306");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[6]?.slug, "cat-toys-dkp-17292457");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[7]?.id, "p307");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[7]?.slug, "cat-toys-dkp-17411871");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[8]?.id, "p308");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[8]?.slug, "cat-toys-dkp-5570618");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[9]?.id, "p309");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS[9]?.slug, "cat-toys-dkp-17412089");

  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS) {
    assert.equal(p.costToman, p.priceToman, `${p.id} zero margin`);
    assert.equal(p.priceToman, EXPECTED_PRICE[p.slug], `${p.id} price`);
    assert.equal(p.images.length, 3, `${p.id} 3 images`);
    assert.ok(p.image.includes(`?v=digikala-b1-p1-v1`), `${p.id} cache bust`);
    assert.ok(p.description.includes('پت دیت شاپ') || p.description.includes('پت‌دیت شاپ'), `${p.id} seller`);
    assert.doesNotMatch(p.image, /purple|5c4d91/i, `${p.id} no purple`);
    for (const angle of ['', '-2', '-3']) {
      const file = join(repoRoot, `packages/web/public/pepito/uploads/${p.slug}${angle}.jpg`);
      assert.ok(existsSync(file), `missing ${file}`);
      const bytes = readFileSync(file);
      assert.equal(bytes[0], 0xff);
      assert.equal(bytes[1], 0xd8);
      const { w, h } = jpegSofSize(bytes);
      assert.ok(w >= 600 && h >= 600, `${p.slug}${angle} size ${w}x${h}`);
    }
  }

  const first = seed.seedShopDigikalaBatch1Part1Products();
  const second = seed.seedShopDigikalaBatch1Part1Products();
  assert.equal(first, 10);
  assert.equal(second, 10, 'idempotent');

  const rows = d.prepare(`SELECT id, slug, price_toman, cost_toman, image FROM shop_products WHERE id LIKE 'p30%'`).all() as any[];
  assert.equal(rows.length, 10, 'Part1 is exactly p300–p309 (p310+ is Part2)');
  for (const r of rows) {
    assert.equal(Number(r.price_toman), Number(r.cost_toman), `${r.id} db zero margin`);
    assert.ok(String(r.image).includes('digikala-b1-p1-v1'));
  }

  // coins sanity
  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS) {
    assert.ok(tomanToShopCoins(p.priceToman) >= 1);
  }

  assert.equal(HELD_SHOP_SLUGS.length, 0);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log('shop-digikala-batch1-part1-products.selftest OK');
}

main().catch((err) => {
  console.error(err);
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
