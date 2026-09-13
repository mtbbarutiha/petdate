/**
 * Hero slide store + settings overlay selftest.
 * Run: cd packages/api && npx tsx src/services/hero-slide-store.selftest.ts
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

export {};

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-hero-'));
const dbPath = path.join(tmpRoot, 'petdate.db');
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = dbPath;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

async function main() {
  const { getDb } = await import('../db');
  getDb();

  const store = await import('./hero-slide-store');
  const slides = await import('./hero-slides');

  assert.equal(store.isHeroRole('playmate'), true);
  assert.equal(store.isHeroRole('nope'), false);
  assert.equal(store.heroSlidesRoot(), path.join(tmpRoot, 'hero-slides'));

  const resolved0 = slides.listResolvedHeroSlides();
  assert.equal(resolved0.length, 5);
  assert.equal(resolved0[0]!.role, 'playmate');
  assert.equal(resolved0[0]!.source, 'default');
  assert.equal(resolved0[0]!.posX, 50);
  assert.equal(resolved0[0]!.posY, 0);
  assert.equal(resolved0[0]!.scale, 1);
  assert.match(resolved0[0]!.webp, /hero-playmate-800\.webp/);

  const src = await sharp({
    create: { width: 3200, height: 1800, channels: 3, background: { r: 40, g: 90, b: 140 } },
  })
    .jpeg()
    .toBuffer();

  const assets = await store.processAndSaveHeroSlide({
    role: 'playmate',
    originalName: 'custom-hero.jpg',
    mimeType: 'image/jpeg',
    buffer: src,
  });

  assert.match(assets.webp800, /^\/api\/hero\/images\/\d{8}\/[0-9a-f-]+-playmate-800\.webp$/);
  assert.match(assets.jpeg, /^\/api\/hero\/images\/\d{8}\/[0-9a-f-]+-playmate-fallback\.jpg$/);

  for (const url of [assets.webp800, assets.webp1280, assets.webp1920, assets.jpeg]) {
    const key = url.replace('/api/hero/images/', '');
    const abs = store.resolveHeroImagePath(key);
    assert.ok(abs && fs.existsSync(abs), `missing file for ${url}`);
  }

  const meta800 = await sharp(
    store.resolveHeroImagePath(assets.webp800.replace('/api/hero/images/', ''))!,
  ).metadata();
  assert.equal(meta800.format, 'webp');
  assert.equal(meta800.width, 800);
  assert.equal(meta800.height, 450);

  const saved = slides.setCustomHeroSlide('playmate', assets);
  assert.equal(saved.source, 'custom');
  assert.equal(saved.webp, assets.webp800);

  const resolved1 = slides.listResolvedHeroSlides();
  assert.equal(resolved1.find((s) => s.role === 'playmate')!.source, 'custom');

  slides.resetCustomHeroSlide('playmate');
  assert.equal(slides.getResolvedHeroSlide('playmate').source, 'default');

  assert.equal(store.resolveHeroImagePath('../etc/passwd'), null);
  assert.equal(store.resolveHeroImagePath('/abs/path'), null);

  let threw = false;
  try {
    await store.processAndSaveHeroSlide({
      role: 'vet',
      originalName: 'x.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not-an-image'),
    });
  } catch (err) {
    threw = true;
    assert.equal((err as Error).message, 'INVALID_MIME');
  }
  assert.ok(threw);

  console.log('hero-slide-store.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
