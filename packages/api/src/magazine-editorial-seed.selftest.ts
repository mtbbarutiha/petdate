/**
 * Editorial magazine seed — idempotent upsert, public visibility, no scripts.
 * Run: npx tsx src/magazine-editorial-seed.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-mag-editorial-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = '';

async function main() {
  const { getDb } = await import('./db');
  getDb();

  const seed = await import('./magazine-editorial-seed');
  const mag = await import('./magazine-service');

  const first = seed.seedMagazineEditorial();
  const second = seed.seedMagazineEditorial();
  assert.equal(first, seed.EDITORIAL_ARTICLES.length, 'seed count');
  assert.equal(second, first, 'idempotent count');

  const { articles, total } = mag.listMagazineArticles({
    publicOnly: true,
    limit: 200,
  });
  assert.equal(total, seed.EDITORIAL_ARTICLES.length, 'public total');
  assert.equal(articles.length, seed.EDITORIAL_ARTICLES.length, 'public list');

  const warning = mag.getMagazineArticleBySlug('علائم-هشدار-سگ-و-گربه', {
    publicOnly: true,
  });
  assert.ok(warning, 'warning article public');
  assert.match(warning!.bodyHtml, /جایگزین معاینه/);
  assert.match(warning!.bodyHtml, /\/vet-consult/);
  assert.equal(warning!.bodyHtml.includes('<script'), false, 'no script');
  assert.ok(warning!.coverImage.startsWith('/pepito/'), 'cover is site photo');
  assert.equal(warning!.featured, true);

  const dental = mag.getMagazineArticleBySlug('مراقبت-از-دندان-پت', { publicOnly: true });
  assert.ok(dental && dental.bodyHtml.length > 200, 'dental stub replaced');

  const featured = mag.listFeaturedMagazineArticles(6);
  assert.ok(featured.length >= 3, 'featured carousel');
  assert.ok(
    featured.some((a) => a.slug === 'علائم-هشدار-سگ-و-گربه'),
    'featured includes warning signs'
  );

  for (const a of seed.EDITORIAL_ARTICLES) {
    assert.ok(a.slug, 'slug');
    const body = a.bodyHtml || '';
    const cover = a.coverImage || '';
    assert.ok(body.includes('<h2>'), `${a.slug} has headings`);
    assert.ok(cover.startsWith('/pepito/'), `${a.slug} cover`);
  }

  console.log(`magazine-editorial-seed.selftest: ok (${first} articles)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });
