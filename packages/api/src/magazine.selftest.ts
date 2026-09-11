/**
 * Magazine CMS selftest — create draft → publish → public list/detail.
 * Uses temp SQLite DB; never touches production DATABASE_PATH.
 * Run: npx tsx src/magazine.selftest.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petdate-magazine-'));
const dbPath = path.join(tmpDir, 'test.db');
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = '';

async function main() {
  const { getDb } = await import('./db');
  getDb();

  const mag = await import('./magazine-service');
  mag.ensureMagazineSchema();

  const draft = mag.createMagazineArticle({
    title: 'مراقبت از دندان پت',
    excerpt: 'نکات ساده برای سلامت دهان و دندان.',
    bodyHtml: '<p>محتوای کامل مقاله تستی.</p>',
    coverImage: '/pepito/uploads/01.jpg',
    category: 'مراقبت',
    tags: ['دندان', 'سلامت'],
    author: 'پت‌دیت',
    status: 'draft',
    featured: true,
  });
  assert.equal(draft.status, 'draft');
  assert.ok(draft.slug.includes('مراقبت') || draft.slug.length > 0, 'slug set');
  assert.equal(mag.isPubliclyVisible(draft), false, 'draft hidden publicly');

  const pub = mag.setMagazineArticleStatus(draft.id, 'published', new Date().toISOString());
  assert.ok(pub);
  assert.equal(pub!.status, 'published');
  assert.equal(mag.isPubliclyVisible(pub!), true, 'published visible');

  const featured = mag.listFeaturedMagazineArticles(6);
  assert.ok(featured.some((a) => a.id === draft.id), 'featured includes published');

  const bySlug = mag.getMagazineArticleBySlug(pub!.slug, { publicOnly: true });
  assert.ok(bySlug, 'public get by slug');
  assert.equal(bySlug!.bodyHtml.includes('محتوای کامل'), true);

  const unpublished = mag.setMagazineArticleStatus(draft.id, 'draft');
  assert.equal(mag.isPubliclyVisible(unpublished!), false);

  const scheduled = mag.updateMagazineArticle(draft.id, {
    status: 'scheduled',
    publishAt: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(mag.isPubliclyVisible(scheduled!), false, 'future scheduled hidden');

  const due = mag.updateMagazineArticle(draft.id, {
    status: 'scheduled',
    publishAt: new Date(Date.now() - 60_000).toISOString(),
  });
  assert.equal(mag.isPubliclyVisible(due!), true, 'past scheduled visible');

  assert.equal(mag.softDeleteMagazineArticle(draft.id), true);
  assert.equal(mag.getMagazineArticleById(draft.id), null, 'soft-deleted hidden');

  // Seed only when empty — wipe rows first via DELETE (isolated temp DB only; never production)
  const { getDb: gdb } = await import('./db');
  gdb().exec('DELETE FROM magazine_articles');
  assert.equal(mag.countMagazineArticles(), 0, 'temp DB empty before seed');
  const boot = mag.bootMagazineCms();
  assert.equal(boot.seeded, 3, 'boot seeds 3 samples on empty table');
  assert.equal(boot.total, 3, 'boot reports total=3');
  assert.equal(mag.seedMagazineSamplesIfEmpty(), 0, 'does not overwrite existing');
  assert.equal(mag.bootMagazineCms().seeded, 0, 'second boot does not re-seed');

  const related = mag.listRelatedMagazineArticles('مراقبت-از-دندان-پت', {
    category: 'مراقبت',
    limit: 3,
  });
  assert.ok(related.every((a) => a.slug !== 'مراقبت-از-دندان-پت'), 'related excludes self');
  assert.ok(related.length >= 1, 'related returns peers');

  console.log('magazine.selftest: ok');
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
