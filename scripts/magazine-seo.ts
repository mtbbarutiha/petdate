import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function magazineEditorialSlugs(
  src = fs.readFileSync(path.join(ROOT, 'packages/api/src/magazine-editorial-seed.ts'), 'utf8')
): string[] {
  return [...src.matchAll(/^\s+slug:\s*'([^']+)'/gm)].map((m) => m[1]);
}

export function parseMagazineSeo(
  src = fs.readFileSync(path.join(ROOT, 'packages/api/src/magazine-editorial-seed.ts'), 'utf8')
): Array<{ slug: string; title: string; description: string }> {
  const articles: Array<{ slug: string; title: string; description: string }> = [];
  const chunks = src.split(/\n\s*\{\s*\n\s*slug:/).slice(1);
  for (const chunk of chunks) {
    const slug = chunk.match(/^\s*'([^']+)'/)?.[1];
    if (!slug) continue;
    const title = chunk.match(/\btitle:\s*'((?:\\'|[^'])*)'/)?.[1];
    const metaTitle = chunk.match(/\bmetaTitle:\s*'((?:\\'|[^'])*)'/)?.[1];
    const excerpt = chunk.match(/\bexcerpt:\s*'((?:\\'|[^'])*)'/)?.[1];
    const metaDescription = chunk.match(/\bmetaDescription:\s*'((?:\\'|[^'])*)'/)?.[1];
    articles.push({
      slug,
      title: (metaTitle || title || slug).replace(/\\'/g, "'"),
      description: (metaDescription || excerpt || 'مقاله مجله پت‌دیت').replace(/\\'/g, "'"),
    });
  }
  return articles;
}
