/**
 * Admin guide covers every sidebar route, with a screenshot and real steps.
 * Run: npx tsx packages/web/src/admin/adminGuide.selftest.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const adminRoot = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(adminRoot, '..');
const webPkg = join(adminRoot, '..', '..');
const layout = readFileSync(join(adminRoot, 'AdminLayout.tsx'), 'utf8');
const page = readFileSync(join(adminRoot, 'pages/AdminGuidePage.tsx'), 'utf8');
const guide = [
  readFileSync(join(adminRoot, 'pages/adminGuideCore.ts'), 'utf8'),
  readFileSync(join(adminRoot, 'pages/adminGuideRest.ts'), 'utf8'),
].join('\n');
const css = readFileSync(join(srcRoot, 'styles/admin.css'), 'utf8');

assert.match(layout, /to="\/admin\/guide"/, 'header guide link stays');
assert.match(page, /ADMIN_GUIDE/, 'guide page renders lessons');
assert.match(css, /admin-guide-lesson/, 'guide layout styles exist');
assert.doesNotMatch(guide + page, /11361|m1m2m3m/, 'guide must not contain a password');

const nav = [...layout.matchAll(/to: '(\/admin\/[^']+)'/g)].map((m) => m[1]);
const paths = [...guide.matchAll(/path: '(\/admin\/[^']+)'/g)].map((m) => m[1]);
const pathSet = new Set(paths);
assert.equal(paths.length, pathSet.size, 'guide paths are unique');
for (const route of new Set(nav)) {
  assert.ok(pathSet.has(route), `missing lesson for ${route}`);
}
assert.ok(pathSet.has('/admin/shop/suppliers'), 'suppliers path is documented even if absent from nav');

const blocks = guide.split(/\n  \{\n/).slice(1);
assert.ok(blocks.length >= nav.length, 'one block per lesson');
for (const block of blocks) {
  const steps = block.split('steps: [')[1]?.split('],')[0] ?? '';
  const mistakes = block.split('mistakes: [')[1]?.split('],')[0] ?? '';
  const stepCount = [...steps.matchAll(/^\s+'/gm)].length;
  const mistakeCount = [...mistakes.matchAll(/^\s+'/gm)].length;
  assert.ok(stepCount >= 3, `lesson needs steps:\n${block.slice(0, 80)}`);
  assert.ok(mistakeCount >= 2, `lesson needs mistakes:\n${block.slice(0, 80)}`);
}

const shots = [...guide.matchAll(/shot\('([^']+)'\)/g)].map((m) => m[1]);
assert.equal(shots.length, paths.length, 'each lesson has one screenshot');
for (const slug of shots) {
  const file = join(webPkg, 'public/admin-guide', `${slug}.webp`);
  assert.ok(existsSync(file), `missing screenshot ${slug}`);
}

console.log(`adminGuide.selftest: ok lessons=${paths.length} shots=${shots.length}`);
