/**
 * Guard: admin dash KPI value lines never use text-overflow ellipsis
 * (full تومان amounts must stay readable — e.g. ۶۷۷,۰۷۷ تومان).
 * Run: npx tsx packages/web/src/admin/dash/adminKpiNoEllipsis.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(join(webRoot, 'src/styles/admin.css'), 'utf8');
const strip = readFileSync(join(webRoot, 'src/admin/dash/AdminKpiStrip.tsx'), 'utf8');

assert.match(strip, /admin-dash-kpi-value/, 'AdminKpiStrip renders value class');
assert.match(strip, /export function AdminKpiStrip/, 'AdminKpiStrip exported');

const valueBlock = css.match(/\.admin-app\s+\.admin-dash-kpi-value\s*\{[^}]+\}/);
assert.ok(valueBlock, '.admin-dash-kpi-value rule present');
assert.doesNotMatch(valueBlock[0]!, /text-overflow\s*:\s*ellipsis/, 'KPI value must not ellipsis');
assert.doesNotMatch(valueBlock[0]!, /white-space\s*:\s*nowrap/, 'KPI value may wrap on narrow viewports');

assert.match(
  css,
  /\.admin-dash-kpi-strip\s*\{[^}]*minmax\(\s*min\(\s*100%\s*,\s*210px\s*\)/,
  'KPI strip min track widened to fit toman amounts'
);

console.log('adminKpiNoEllipsis.selftest: ok');
