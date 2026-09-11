/**
 * Guard: /admin/tag-manager must stay registered (sidebar + React route).
 * Analytics hub tabs alone are not enough — bookmarks/docs use this URL.
 * Run: npx tsx packages/web/src/admin/adminTagManagerRoute.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const app = readFileSync(join(webRoot, 'src/App.tsx'), 'utf8');
const layout = readFileSync(join(webRoot, 'src/admin/AdminLayout.tsx'), 'utf8');
const page = readFileSync(join(webRoot, 'src/admin/pages/AdminTagManagerPage.tsx'), 'utf8');

assert.match(app, /AdminTagManagerPage/, 'App lazy-imports AdminTagManagerPage');
assert.match(app, /path="tag-manager"\s+element=\{<AdminTagManagerPage\s*\/>\}/, 'App registers /admin/tag-manager');
assert.match(layout, /to:\s*'\/admin\/tag-manager'/, 'sidebar links to /admin/tag-manager');
assert.match(layout, /label:\s*'تگ منیجر'/, 'sidebar label تگ منیجر');
assert.match(page, /export function AdminTagManagerPage/, 'AdminTagManagerPage export present');
assert.match(page, /\/api\/admin\/site-analytics\/tag-manager/, 'page fetches tag-manager API');

console.log('adminTagManagerRoute.selftest: ok');
