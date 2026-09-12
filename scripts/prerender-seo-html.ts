#!/usr/bin/env npx tsx
/**
 * After Vite emits dist/index.html, write per-route HTML shells so nginx
 * try_files $uri $uri/ serves distinct title/canonical/JSON-LD/noscript.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeoToHtml, distFileForPath, listPrerenderPaths } from '../packages/web/src/lib/pageSeo.ts';
import { parseMagazineSeo } from './magazine-seo.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'packages/web/dist');

function main() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('prerender-seo: dist/index.html missing — run vite build first');
    process.exit(1);
  }
  const shell = fs.readFileSync(indexPath, 'utf8');
  const articles = parseMagazineSeo();
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));
  const paths = listPrerenderPaths(articles.map((a) => a.slug));

  let wrote = 0;
  for (const route of paths) {
    const slug = route.startsWith('/magazine/') ? decodeURIComponent(route.slice('/magazine/'.length)) : '';
    const article = slug ? articleBySlug.get(slug) : undefined;
    const html = applySeoToHtml(shell, route, article ? { article } : {});
    const rel = distFileForPath(route);
    const dest = path.join(DIST, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, html);
    wrote += 1;
  }

  // Home shell itself must carry home SEO (sameAs without www, noscript text).
  fs.writeFileSync(indexPath, applySeoToHtml(shell, '/'));
  console.log(`prerender-seo: wrote ${wrote} route HTML files under ${path.relative(ROOT, DIST)}`);
}

main();
