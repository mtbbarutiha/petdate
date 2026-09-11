/**
 * Guard: /admin/magazine must stay registered (sidebar + React routes).
 * Run: npx tsx packages/web/src/admin/adminMagazineRoute.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const app = readFileSync(join(webRoot, 'src/App.tsx'), 'utf8');
const layout = readFileSync(join(webRoot, 'src/admin/AdminLayout.tsx'), 'utf8');
const page = readFileSync(join(webRoot, 'src/admin/pages/AdminMagazinePage.tsx'), 'utf8');
const form = readFileSync(join(webRoot, 'src/admin/pages/AdminMagazineFormPage.tsx'), 'utf8');
const editor = readFileSync(join(webRoot, 'src/admin/MagazineRichTextEditor.tsx'), 'utf8');

assert.match(app, /path="magazine"\s+element=\{<AdminMagazinePage\s*\/>\}/, 'App registers /admin/magazine');
assert.match(app, /path="magazine\/new"/, 'App registers /admin/magazine/new');
assert.match(app, /path="magazine\/:id"/, 'App registers /admin/magazine/:id');
assert.match(app, /path="magazine"\s+element=\{<MagazinePage\s*\/>\}/, 'App registers public /magazine');
assert.match(app, /path="magazine\/:slug"/, 'App registers public /magazine/:slug');
assert.match(layout, /to:\s*'\/admin\/magazine'/, 'sidebar links to /admin/magazine');
assert.match(layout, /label:\s*'مجله و اخبار'/, 'sidebar label مجله و اخبار');
assert.match(page, /AdminMagazinePage/, 'list page exists');
assert.match(form, /MagazineRichTextEditor/, 'form uses TipTap editor');
assert.match(editor, /@tiptap\/react/, 'TipTap editor wired');

console.log('adminMagazineRoute.selftest: ok');
