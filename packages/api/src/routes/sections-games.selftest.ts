/**
 * GET /api/sections/:id/games must reject non-numeric ids (no NaN → Postgres 500).
 * Run: cd packages/api && npx tsx src/routes/sections-games.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const sections = readFileSync(join(apiSrc, 'routes/sections.ts'), 'utf8');
const indexSrc = readFileSync(join(apiSrc, 'index.ts'), 'utf8');
const db = readFileSync(join(apiSrc, 'db.ts'), 'utf8');

assert.match(sections, /parsePositiveIntId/, 'sections routes parse ids');
assert.match(sections, /شناسه سکشن نامعتبر است/, 'invalid section id 400 copy');
assert.match(sections, /\/:id\/games/, 'section games route exists');
assert.doesNotMatch(
  sections,
  /getSection\(Number\(req\.params\.id\)\)/,
  'getSection no longer receives raw Number(params.id)'
);

assert.match(indexSrc, /parsePositiveIntId\(req\.params\.sectionId\)/, 'games-for-section validates id');
assert.match(indexSrc, /parsePositiveIntId\(userIdRaw\)/, 'my-section-games validates userId');

assert.match(
  db,
  /getSection\(id: number\): Section \| null \{[\s\S]{0,120}Number\.isFinite\(id\)/,
  'getSection rejects NaN before SQL'
);
assert.match(
  db,
  /Never bind NaN\/non-positive sectionId/,
  'listGames skips invalid sectionId'
);

console.log('sections-games.selftest: ok');
