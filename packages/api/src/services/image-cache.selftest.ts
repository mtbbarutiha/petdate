/**
 * Image cache selftest — temp dirs only.
 * Run: npx tsx packages/api/src/services/image-cache.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-img-cache-'));
const dbPath = path.join(tmp, 'test.db');
const publicDir = path.join(tmp, 'public');
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = '';
process.env.WEB_PUBLIC_DIR = publicDir;

async function main() {
  fs.mkdirSync(path.join(publicDir, 'pepito', 'uploads'), { recursive: true });
  const srcJpg = path.join(publicDir, 'pepito', 'uploads', 'sample.jpg');
  const jpeg = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 40, g: 120, b: 200 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  fs.writeFileSync(srcJpg, jpeg);

  const {
    normalizeImageSrcPath,
    resolveImageSourcePath,
    getOrCreateCachedWebp,
    imageCacheRoot,
  } = await import('./image-cache');

  assert.equal(normalizeImageSrcPath('/pepito/uploads/sample.jpg'), '/pepito/uploads/sample.jpg');
  assert.equal(
    normalizeImageSrcPath('/pepito/uploads/sample.jpg?v=batch1'),
    '/pepito/uploads/sample.jpg'
  );
  assert.equal(normalizeImageSrcPath('https://evil.com/x.jpg'), null);
  assert.equal(normalizeImageSrcPath('/etc/passwd'), null);
  assert.equal(normalizeImageSrcPath('/pepito/../etc/passwd'), null);

  const abs = resolveImageSourcePath('/pepito/uploads/sample.jpg');
  assert.ok(abs && abs.endsWith('sample.jpg'), 'resolves under WEB_PUBLIC_DIR');

  const first = await getOrCreateCachedWebp(abs!, { maxEdge: 200, quality: 75 });
  assert.equal(first.contentType, 'image/webp');
  assert.equal(first.fromCache, false);
  assert.ok(first.buffer.toString('ascii', 0, 4) === 'RIFF');
  const meta = await sharp(first.buffer).metadata();
  assert.ok((meta.width || 0) <= 200);

  const second = await getOrCreateCachedWebp(abs!, { maxEdge: 200, quality: 75 });
  assert.equal(second.fromCache, true);
  assert.equal(second.cacheKey, first.cacheKey);

  assert.ok(fs.existsSync(imageCacheRoot()), 'cache root created');

  console.log('image-cache.selftest: OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
