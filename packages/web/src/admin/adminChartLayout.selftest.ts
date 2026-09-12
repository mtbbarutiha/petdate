/**
 * Guard: admin charts stay compact, 2-col on md+, labels truncated.
 * Run: npx tsx packages/web/src/admin/adminChartLayout.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_CHART_MAX_H,
  ADMIN_CHART_STANDARD_H,
  ADMIN_CHART_VIEWBOX_W,
  adminChartHBarsHeight,
  adminChartTickFormatter,
  capAdminChartHeight,
  truncateChartLabel,
} from './adminChartLayout.ts';

assert.equal(capAdminChartHeight(1200), ADMIN_CHART_MAX_H);
assert.equal(capAdminChartHeight(40), 160);
assert.equal(capAdminChartHeight(Number.NaN), ADMIN_CHART_STANDARD_H);
assert.ok(capAdminChartHeight(240) <= ADMIN_CHART_MAX_H);

assert.equal(adminChartHBarsHeight(2, 32, 160, 280), 160);
assert.equal(adminChartHBarsHeight(8, 32, 160, 280), 256);
assert.equal(adminChartHBarsHeight(40, 36, 180, 280), 280);
assert.equal(adminChartHBarsHeight(30, 40, 200, 280), 280);

assert.equal(truncateChartLabel('کوتاه'), 'کوتاه');
assert.equal(truncateChartLabel('یک برچسب خیلی خیلی طولانی برای محور', 10).endsWith('…'), true);
assert.ok(truncateChartLabel('یک برچسب خیلی خیلی طولانی برای محور', 10).length <= 10);
assert.equal(truncateChartLabel(''), '');
assert.equal(adminChartTickFormatter('2026-09-12').length <= 10, true);
assert.equal(ADMIN_CHART_VIEWBOX_W, 560);

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(join(webRoot, 'src/styles/admin.css'), 'utf8');
const finance = readFileSync(join(webRoot, 'src/admin/FinanceCharts.tsx'), 'utf8');
const card = readFileSync(join(webRoot, 'src/admin/dash/AdminChartCard.tsx'), 'utf8');
const hbars = readFileSync(join(webRoot, 'src/admin/rechartsRtlHBars.tsx'), 'utf8');
const sales = readFileSync(join(webRoot, 'src/admin/pages/sales/AdminSalesDashboardPage.tsx'), 'utf8');
const crm = readFileSync(join(webRoot, 'src/admin/pages/crm/AdminCrmDashboardPage.tsx'), 'utf8');
const hr = readFileSync(join(webRoot, 'src/admin/pages/hr/AdminHrDashboardPage.tsx'), 'utf8');
const reports = readFileSync(join(webRoot, 'src/admin/pages/AdminSiteReportsPage.tsx'), 'utf8');
const ci = readFileSync(join(webRoot, '../../scripts/ci-selftest.sh'), 'utf8');

assert.match(css, /--admin-chart-max-h:\s*280px/, 'CSS token caps chart viewport');
assert.match(css, /\.admin-chart-svg\s*\{[^}]*max-height:\s*220px/s, 'SVG charts have a fixed max-height');
assert.match(css, /\.admin-chart-svg--donut\s*\{[^}]*max-width:\s*160px/s, 'donuts do not stretch to card width');
assert.doesNotMatch(css, /\.admin-chart-svg\s*\{[^}]*min-width:\s*280px/s, 'narrow viewBox must not force 280px min-width');
assert.match(
  css,
  /@media \(min-width: 768px\)[\s\S]*admin-dash-chart-grid--2[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/,
  '2-col chart grid from md+'
);
assert.match(
  css,
  /@media \(min-width: 1100px\)[\s\S]*admin-dash-chart-grid--3[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/,
  '3-col chart grid from lg'
);
assert.match(css, /\.admin-dash-chart-body\s*\{[^}]*max-height:\s*var\(--admin-chart-max-h/s, 'chart card body is capped');
assert.match(css, /\.recharts-cartesian-axis-tick text\s*\{[^}]*font-size:\s*11px/s, 'Recharts ticks are readable');
assert.match(css, /\.admin-chart-axis\s*\{[^}]*font-size:\s*11px/s, 'SVG axis ticks are readable');

assert.match(finance, /ADMIN_CHART_VIEWBOX_W/, 'finance SVGs use a stable viewBox width');
assert.match(finance, /admin-chart-svg--donut/, 'donut uses non-stretching class');
assert.match(finance, /truncateChartLabel/, 'finance charts truncate long labels');
assert.match(card, /capAdminChartHeight/, 'chart cards cap height instead of min-height blow-up');
assert.match(hbars, /AdminRtlCategoryTick/, 'RTL h-bars truncate category ticks');
assert.match(hbars, /adminChartHBarsHeight/, 'RTL h-bar height is capped');

for (const [name, src] of [
  ['sales', sales],
  ['crm', crm],
  ['hr', hr],
] as const) {
  assert.doesNotMatch(
    src,
    /Math\.max\(\s*(200|220|240)\s*,/,
    `${name} dashboard must not use uncapped chart heights`
  );
  assert.match(src, /adminRtlHBarsHeight/, `${name} dashboard uses shared h-bar height`);
}

assert.match(reports, /admin-chart-box/, 'analytics report charts use compact box class');
assert.match(ci, /adminChartLayout\.selftest\.ts/, 'CI runs admin chart layout selftest');

console.log('adminChartLayout.selftest: ok');
