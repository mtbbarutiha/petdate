/**
 * Public magazine / news API — /api/magazine/*
 */
import fs from 'fs';
import { Router } from 'express';
import {
  getMagazineArticleBySlug,
  listFeaturedMagazineArticles,
  listMagazineArticles,
  listRelatedMagazineArticles,
} from '../magazine-service';
import {
  mimeFromMagazineImageKey,
  resolveMagazineImagePath,
} from '../services/magazine-image-store';

export const magazineRouter = Router();

/** Serve uploaded magazine images publicly (cover / body). */
magazineRouter.get('/images/:day/:filename', (req, res) => {
  const day = String(req.params.day || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${day}/${filename}`;
  const abs = resolveMagazineImagePath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'تصویر پیدا نشد' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type(mimeFromMagazineImageKey(storageKey));
  fs.createReadStream(abs).pipe(res);
});

/** Homepage carousel / latest news cards. */
magazineRouter.get('/featured', (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 6;
  const articles = listFeaturedMagazineArticles(Number.isFinite(limit) ? limit : 6).map(
    publicCard
  );
  res.json({ articles });
});

/** Public listing — published (and due scheduled) only. */
magazineRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 24;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const { articles, total } = listMagazineArticles({
    q,
    publicOnly: true,
    limit: Number.isFinite(limit) ? limit : 24,
    offset: Number.isFinite(offset) ? offset : 0,
  });
  let filtered = articles;
  if (category?.trim()) {
    const cat = category.trim();
    filtered = articles.filter((a) => a.category === cat);
  }
  res.json({
    articles: filtered.map(publicCard),
    total: category?.trim() ? filtered.length : total,
  });
});

magazineRouter.get('/:slug', (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug || slug === 'images' || slug === 'featured') {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  const article = getMagazineArticleBySlug(slug, { publicOnly: true });
  if (!article) {
    res.status(404).json({ error: 'مقاله پیدا نشد' });
    return;
  }
  const related = listRelatedMagazineArticles(slug, {
    category: article.category,
    limit: 3,
  }).map(publicCard);
  res.json({ article: publicDetail(article), related });
});

function publicCard(a: {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  tags: string[];
  author: string;
  publishAt: string | null;
  createdAt: string;
  featured: boolean;
}) {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverImage: a.coverImage,
    category: a.category,
    tags: a.tags,
    author: a.author,
    publishAt: a.publishAt || a.createdAt,
    featured: a.featured,
  };
}

function publicDetail(a: {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  coverImage: string;
  category: string;
  tags: string[];
  author: string;
  publishAt: string | null;
  createdAt: string;
  metaTitle: string;
  metaDescription: string;
  featured: boolean;
}) {
  return {
    ...publicCard(a),
    bodyHtml: a.bodyHtml,
    metaTitle: a.metaTitle || a.title,
    metaDescription: a.metaDescription || a.excerpt,
  };
}
