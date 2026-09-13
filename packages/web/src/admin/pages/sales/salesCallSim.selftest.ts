/**
 * Guard: inbound call simulator docks at the visual bottom-left via a
 * body portal so `.admin-app` overflow-x:clip / 100dvh cannot stretch
 * the admin chrome. Clicking «شبیه‌سازی تماس ورودی» starts a ringing
 * session (POST /simulate-incoming), then answer flips to connected.
 * Run: npx tsx packages/web/src/admin/pages/sales/salesCallSim.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const sim = readFileSync(join(webRoot, 'admin/pages/sales/SalesCallSim.tsx'), 'utf8');
const page = readFileSync(join(webRoot, 'admin/pages/sales/AdminSalesPages.tsx'), 'utf8');
const layout = readFileSync(join(webRoot, 'admin/AdminLayout.tsx'), 'utf8');
const css = readFileSync(join(webRoot, 'styles/admin.css'), 'utf8');
const ci = readFileSync(join(webRoot, '../../../scripts/ci-selftest.sh'), 'utf8');

assert.match(layout, /SalesCallSimProvider/, 'layout still mounts the call-sim provider');
assert.match(page, /sim\.simulateIncoming\(\)/, 'call-center page still triggers the simulator');
assert.match(page, /useSalesCallSimOptional/, 'call-center page reads the shared sim context');

assert.match(sim, /createPortal/, 'call chrome portals out of the admin shell');
assert.match(sim, /document\.body/, 'portal target is document.body');
assert.match(sim, /display:\s*['"]contents['"]/, 'host is display:contents (no second admin canvas)');
assert.match(sim, /admin-sales-call-host/, 'portaled host class');
assert.match(sim, /admin-sales-call-dock/, 'bottom-left dock class');
assert.match(sim, /data-testid="admin-sales-call-dock"/, 'dock has a test id');
assert.match(sim, /\/api\/admin\/sales\/simulate-incoming/, 'simulate starts a real session via API');
assert.match(sim, /phase:\s*'ringing'/, 'POST success enters ringing');
assert.match(sim, /phase:\s*'active'/, 'answer connects the session');
assert.match(sim, /در حال مکالمه/, 'connected UI copy');
assert.doesNotMatch(sim, /admin-sales-call-overlay/, 'full-bleed overlay sibling is gone');

const dockBlock = css.match(/\.admin-app\s+\.admin-sales-call-dock\s*\{([^}]*)\}/)?.[1] ?? '';
assert.match(dockBlock, /position:\s*fixed/, 'dock is viewport-fixed');
assert.match(dockBlock, /left:\s*max\(16px/, 'dock pins to physical left');
assert.match(dockBlock, /bottom:\s*max\(16px/, 'dock pins to physical bottom');
assert.doesNotMatch(dockBlock, /inset:\s*0/, 'dock is not a full-viewport overlay');
assert.match(css, /admin-sales-call-slide-up/, 'slide-up enter motion');
assert.doesNotMatch(css, /\.admin-app\s+\.admin-sales-call-overlay\s*\{/, 'old overlay rule removed');

assert.match(ci, /salesCallSim\.selftest\.ts/, 'CI runs the inbound-call dock selftest');

console.log('salesCallSim.selftest: ok');
