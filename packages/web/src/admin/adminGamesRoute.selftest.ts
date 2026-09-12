/**
 * Admin games route + sidebar + moderation API wiring.
 * Run: npx tsx packages/web/src/admin/adminGamesRoute.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webSrc, '../../..');
const layout = readFileSync(join(webSrc, 'admin/AdminLayout.tsx'), 'utf8');
const app = readFileSync(join(webSrc, 'App.tsx'), 'utf8');
const page = readFileSync(join(webSrc, 'admin/pages/AdminGamesPage.tsx'), 'utf8');
const adminRoutes = readFileSync(join(repoRoot, 'packages/api/src/routes/admin.ts'), 'utf8');
const sharedNav = readFileSync(join(repoRoot, 'packages/shared/src/admin-nav.ts'), 'utf8');
const platform = readFileSync(join(repoRoot, 'packages/api/src/admin-platform.ts'), 'utf8');

assert.match(layout, /to: '\/admin\/games'/, 'sidebar has games link');
assert.match(layout, /labelKey: 'admin\.games'/, 'sidebar games i18n key');
assert.match(layout, /platformBadgeKey: 'games'/, 'sidebar games badge');
assert.match(app, /path="games"\s+element=\{<AdminGamesPage/, 'admin route registered');
assert.match(page, /\/api\/admin\/games/, 'admin page lists games');
assert.match(page, /\/api\/admin\/games\/\$\{id\}\/status/, 'admin page can update status');
assert.match(adminRoutes, /adminRouter\.get\('\/games'/, 'GET /api/admin/games');
assert.match(adminRoutes, /adminRouter\.patch\('\/games\/:id\/status'/, 'PATCH status');
assert.match(sharedNav, /games: number/, 'PlatformNavCounts.games');
assert.match(platform, /games: q\(`SELECT COUNT\(\*\) as c FROM games WHERE status = 'open'`\)/, 'open games badge query');

console.log('adminGamesRoute.selftest: ok');
