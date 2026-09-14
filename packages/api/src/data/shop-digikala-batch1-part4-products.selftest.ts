/**
 * Shop Digikala batch1 Part4 — 12 SKUs, zero margin, front-only digikala-b1-p4-v1 galleries.
 * Run: npx tsx src/data/shop-digikala-batch1-part4-products.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART4_SLUGS } from './shop-zero-margin-slugs.ts';

function tomanToShopCoins(toman: number): number {
  const t = Math.max(0, Math.floor(Number(toman) || 0));
  return Math.max(1, Math.ceil(t / 2000));
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tmpDir = mkdtempSync(join(tmpdir(), 'petdate-shop-digikala-b1-p4-'));
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
  "dog-food-dkp-20949593": 195_000,
  "cat-treats-dkp-11596119": 385_000,
  "cat-treats-dkp-7929885": 195_840,
  "grooming-dkp-22460582": 1_602_000,
  "bird-food-dkp-16760701": 479_500,
  "bird-food-dkp-8471877": 478_550,
  "bird-food-dkp-11307683": 303_000,
  "bird-food-dkp-16512508": 96_000,
  "rodent-supplies-dkp-2909989": 550_000,
  "rodent-supplies-dkp-20848635": 350_860,
  "rodent-supplies-dkp-12533105": 235_000,
  "rodent-supplies-dkp-11804534": 181_000,
};

async function main() {
  const { getDb } = await import('../db');
  const d = getDb();
  const seed = await import('./shop-digikala-batch1-part4-products');

  assert.deepEqual([...seed.SHOP_DIGIKALA_BATCH1_PART4_SLUGS], [...SHOP_DIGIKALA_BATCH1_PART4_SLUGS], 'slug export');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS.length, 12, '12 part4 SKUs');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[0]?.id, 'p330');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS.at(-1)?.id, 'p341');
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[0]?.id, "p330");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[0]?.slug, "dog-food-dkp-20949593");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[1]?.id, "p331");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[1]?.slug, "cat-treats-dkp-11596119");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[2]?.id, "p332");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[2]?.slug, "cat-treats-dkp-7929885");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[3]?.id, "p333");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[3]?.slug, "grooming-dkp-22460582");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[4]?.id, "p334");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[4]?.slug, "bird-food-dkp-16760701");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[5]?.id, "p335");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[5]?.slug, "bird-food-dkp-8471877");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[6]?.id, "p336");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[6]?.slug, "bird-food-dkp-11307683");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[7]?.id, "p337");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[7]?.slug, "bird-food-dkp-16512508");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[8]?.id, "p338");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[8]?.slug, "rodent-supplies-dkp-2909989");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[9]?.id, "p339");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[9]?.slug, "rodent-supplies-dkp-20848635");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[10]?.id, "p340");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[10]?.slug, "rodent-supplies-dkp-12533105");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[11]?.id, "p341");
  assert.equal(seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS[11]?.slug, "rodent-supplies-dkp-11804534");

  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS) {
    assert.equal(p.costToman, p.priceToman, `${p.id} zero margin`);
    assert.equal(p.priceToman, EXPECTED_PRICE[p.slug], `${p.id} price`);
    assert.equal(p.images.length, 1, `${p.id} front-only gallery`);
    assert.equal(p.image, p.images[0], `${p.id} cover equals sole angle`);
    assert.ok(p.image.includes(`?v=digikala-b1-p4-v1`), `${p.id} cache bust`);
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

  const first = seed.seedShopDigikalaBatch1Part4Products();
  const second = seed.seedShopDigikalaBatch1Part4Products();
  assert.equal(first, 12);
  assert.equal(second, 12, 'idempotent');

  // Scope carefully: Part3 is p32%, Part4 is p33% + p34% — never use bare p3%
  const rows33 = d.prepare(`SELECT id, slug, price_toman, cost_toman, image FROM shop_products WHERE id LIKE 'p33%'`).all() as any[];
  const rows34 = d.prepare(`SELECT id, slug, price_toman, cost_toman, image FROM shop_products WHERE id LIKE 'p34%'`).all() as any[];
  assert.equal(rows33.length, 10, 'p330–p339');
  assert.equal(rows34.length, 2, 'p340–p341');
  for (const r of [...rows33, ...rows34]) {
    assert.equal(Number(r.price_toman), Number(r.cost_toman), `${r.id} db zero margin`);
    assert.ok(String(r.image).includes('digikala-b1-p4-v1'));
  }

  const rodent = d.prepare(`SELECT slug FROM shop_categories WHERE slug = 'rodent-supplies'`).get() as any;
  assert.ok(rodent, 'rodent-supplies category seeded');

  for (const p of seed.SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS) {
    assert.ok(tomanToShopCoins(p.priceToman) >= 1);
  }

  assert.equal(HELD_SHOP_SLUGS.length, 0);
  rmSync(tmpDir, { recursive: true, force: true });
  console.log('shop-digikala-batch1-part4-products.selftest OK');
}

main().catch((err) => {
  console.error(err);
  try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
