/**
 * Magazine / news CMS — additive table + CRUD.
 * Kept separate from db.ts to limit merge conflicts.
 */
import { getDb } from './db';

function db() {
  return getDb();
}

export type MagazineStatus = 'draft' | 'published' | 'scheduled';

export type MagazineArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  coverImage: string;
  category: string;
  tags: string[];
  author: string;
  status: MagazineStatus;
  featured: boolean;
  publishAt: string | null;
  metaTitle: string;
  metaDescription: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MagazineArticleInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  bodyHtml?: string;
  coverImage?: string;
  category?: string;
  tags?: string[] | string;
  author?: string;
  status?: MagazineStatus;
  featured?: boolean;
  publishAt?: string | null;
  metaTitle?: string;
  metaDescription?: string;
};

const STATUSES = new Set<MagazineStatus>(['draft', 'published', 'scheduled']);

export function ensureMagazineSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS magazine_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      author TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      featured INTEGER NOT NULL DEFAULT 0,
      publish_at TEXT,
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      deleted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  d.exec(
    `CREATE INDEX IF NOT EXISTS idx_magazine_articles_status ON magazine_articles(status)`
  );
  d.exec(`CREATE INDEX IF NOT EXISTS idx_magazine_articles_slug ON magazine_articles(slug)`);
  d.exec(
    `CREATE INDEX IF NOT EXISTS idx_magazine_articles_featured ON magazine_articles(featured)`
  );
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      /* comma / newline list */
    }
    return s
      .split(/[,،\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function mapArticle(row: Record<string, unknown>): MagazineArticle {
  const statusRaw = String(row.status || 'draft');
  const status: MagazineStatus = STATUSES.has(statusRaw as MagazineStatus)
    ? (statusRaw as MagazineStatus)
    : 'draft';
  return {
    id: Number(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    excerpt: String(row.excerpt || ''),
    bodyHtml: String(row.body_html || ''),
    coverImage: String(row.cover_image || ''),
    category: String(row.category || ''),
    tags: parseTags(row.tags),
    author: String(row.author || ''),
    status,
    featured: Boolean(Number(row.featured || 0)),
    publishAt: row.publish_at != null ? String(row.publish_at) : null,
    metaTitle: String(row.meta_title || ''),
    metaDescription: String(row.meta_description || ''),
    deletedAt: row.deleted_at != null ? String(row.deleted_at) : null,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

/** Persian/Latin slug from title — editable afterwards. */
export function slugifyMagazineTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `article-${Date.now().toString(36)}`;
}

function uniqueSlug(desired: string, excludeId?: number): string {
  let slug = desired || slugifyMagazineTitle('مقاله');
  const d = db();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const row = d
      .prepare(
        `SELECT id FROM magazine_articles WHERE slug = ?${excludeId ? ' AND id != ?' : ''}`
      )
      .get(...(excludeId ? [candidate, excludeId] : [candidate])) as { id: number } | undefined;
    if (!row) return candidate;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

function normalizeStatus(raw: unknown): MagazineStatus {
  const s = String(raw || 'draft');
  return STATUSES.has(s as MagazineStatus) ? (s as MagazineStatus) : 'draft';
}

function normalizePublishAt(status: MagazineStatus, raw: string | null | undefined): string | null {
  if (raw === null) return null;
  if (raw === undefined || raw === '') {
    return status === 'published' || status === 'scheduled' ? toSqliteDateTime(new Date()) : null;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    // Already SQLite-ish `YYYY-MM-DD HH:MM:SS`
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 19).replace('T', ' ');
    return null;
  }
  return toSqliteDateTime(d);
}

function toSqliteDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/** Public visibility: published, or scheduled with publish_at <= now; not soft-deleted. */
export function isPubliclyVisible(article: MagazineArticle, now = new Date()): boolean {
  if (article.deletedAt) return false;
  if (article.status === 'draft') return false;
  if (article.status === 'published') {
    if (!article.publishAt) return true;
    const at = new Date(article.publishAt);
    return !Number.isNaN(at.getTime()) ? at.getTime() <= now.getTime() : true;
  }
  if (article.status === 'scheduled') {
    if (!article.publishAt) return false;
    const at = new Date(article.publishAt);
    return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime();
  }
  return false;
}

export type ListMagazineOpts = {
  q?: string;
  status?: MagazineStatus | 'all';
  featured?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  /** When true, only publicly visible articles */
  publicOnly?: boolean;
};

export function listMagazineArticles(opts: ListMagazineOpts = {}): {
  articles: MagazineArticle[];
  total: number;
} {
  ensureMagazineSchema();
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!opts.includeDeleted) {
    clauses.push('deleted_at IS NULL');
  }
  if (opts.status && opts.status !== 'all') {
    clauses.push('status = ?');
    params.push(opts.status);
  }
  if (opts.featured === true) {
    clauses.push('featured = 1');
  }
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    clauses.push('(title LIKE ? OR excerpt LIKE ? OR slug LIKE ? OR category LIKE ? OR tags LIKE ?)');
    params.push(q, q, q, q, q);
  }
  if (opts.publicOnly) {
    // published (optionally past publish_at) OR scheduled with publish_at <= now
    clauses.push(
      `((status = 'published' AND (publish_at IS NULL OR publish_at <= datetime('now')))
        OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))`
    );
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const d = db();
  const totalRow = d
    .prepare(`SELECT COUNT(*) as c FROM magazine_articles ${where}`)
    .get(...params) as { c: number };
  const articles = (
    d
      .prepare(
        `SELECT * FROM magazine_articles ${where}
         ORDER BY COALESCE(publish_at, created_at) DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Record<string, unknown>[]
  ).map(mapArticle);

  return { articles, total: Number(totalRow?.c || 0) };
}

export function getMagazineArticleById(id: number, opts?: { includeDeleted?: boolean }): MagazineArticle | null {
  ensureMagazineSchema();
  const row = db()
    .prepare('SELECT * FROM magazine_articles WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const article = mapArticle(row);
  if (article.deletedAt && !opts?.includeDeleted) return null;
  return article;
}

export function getMagazineArticleBySlug(
  slug: string,
  opts?: { publicOnly?: boolean; includeDeleted?: boolean }
): MagazineArticle | null {
  ensureMagazineSchema();
  const row = db()
    .prepare('SELECT * FROM magazine_articles WHERE slug = ?')
    .get(slug) as Record<string, unknown> | undefined;
  if (!row) return null;
  const article = mapArticle(row);
  if (article.deletedAt && !opts?.includeDeleted) return null;
  if (opts?.publicOnly && !isPubliclyVisible(article)) return null;
  return article;
}

export function createMagazineArticle(input: MagazineArticleInput): MagazineArticle {
  ensureMagazineSchema();
  const title = String(input.title || '').trim();
  if (!title) throw new Error('عنوان الزامی است');
  const status = normalizeStatus(input.status);
  const slug = uniqueSlug(
    (input.slug && String(input.slug).trim()) || slugifyMagazineTitle(title)
  );
  const publishAt = normalizePublishAt(status, input.publishAt);
  const tags = parseTags(input.tags);
  const r = db()
    .prepare(
      `INSERT INTO magazine_articles (
        title, slug, excerpt, body_html, cover_image, category, tags, author,
        status, featured, publish_at, meta_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      slug,
      String(input.excerpt ?? ''),
      String(input.bodyHtml ?? ''),
      String(input.coverImage ?? ''),
      String(input.category ?? ''),
      JSON.stringify(tags),
      String(input.author ?? ''),
      status,
      input.featured ? 1 : 0,
      publishAt,
      String(input.metaTitle ?? ''),
      String(input.metaDescription ?? '')
    );
  return getMagazineArticleById(Number(r.lastInsertRowid))!;
}

export function updateMagazineArticle(
  id: number,
  input: Partial<MagazineArticleInput>
): MagazineArticle | null {
  ensureMagazineSchema();
  const existing = getMagazineArticleById(id);
  if (!existing) return null;

  const title =
    input.title !== undefined ? String(input.title).trim() : existing.title;
  if (!title) throw new Error('عنوان الزامی است');

  const status =
    input.status !== undefined ? normalizeStatus(input.status) : existing.status;
  let slug = existing.slug;
  if (input.slug !== undefined) {
    slug = uniqueSlug(String(input.slug).trim() || slugifyMagazineTitle(title), id);
  }
  const publishAt =
    input.publishAt !== undefined
      ? normalizePublishAt(status, input.publishAt)
      : existing.publishAt
        ? existing.publishAt
        : normalizePublishAt(status, undefined);

  const tags = input.tags !== undefined ? parseTags(input.tags) : existing.tags;

  db()
    .prepare(
      `UPDATE magazine_articles SET
        title = ?, slug = ?, excerpt = ?, body_html = ?, cover_image = ?,
        category = ?, tags = ?, author = ?, status = ?, featured = ?,
        publish_at = ?, meta_title = ?, meta_description = ?,
        updated_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL`
    )
    .run(
      title,
      slug,
      input.excerpt !== undefined ? String(input.excerpt) : existing.excerpt,
      input.bodyHtml !== undefined ? String(input.bodyHtml) : existing.bodyHtml,
      input.coverImage !== undefined ? String(input.coverImage) : existing.coverImage,
      input.category !== undefined ? String(input.category) : existing.category,
      JSON.stringify(tags),
      input.author !== undefined ? String(input.author) : existing.author,
      status,
      input.featured !== undefined ? (input.featured ? 1 : 0) : existing.featured ? 1 : 0,
      publishAt,
      input.metaTitle !== undefined ? String(input.metaTitle) : existing.metaTitle,
      input.metaDescription !== undefined
        ? String(input.metaDescription)
        : existing.metaDescription,
      id
    );
  return getMagazineArticleById(id);
}

export function softDeleteMagazineArticle(id: number): boolean {
  ensureMagazineSchema();
  const r = db()
    .prepare(
      `UPDATE magazine_articles
       SET deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL`
    )
    .run(id);
  return r.changes > 0;
}

export function setMagazineArticleStatus(
  id: number,
  status: MagazineStatus,
  publishAt?: string | null
): MagazineArticle | null {
  return updateMagazineArticle(id, {
    status,
    publishAt:
      publishAt !== undefined
        ? publishAt
        : status === 'published'
          ? toSqliteDateTime(new Date())
          : undefined,
  });
}

/** Featured carousel for homepage — publicly visible, featured first, then recent. */
export function listFeaturedMagazineArticles(limit = 6): MagazineArticle[] {
  const { articles } = listMagazineArticles({
    publicOnly: true,
    limit: Math.min(Math.max(limit, 1), 24),
    status: 'all',
  });
  const featured = articles.filter((a) => a.featured);
  if (featured.length >= 3) return featured.slice(0, limit);
  const rest = articles.filter((a) => !a.featured);
  return [...featured, ...rest].slice(0, limit);
}

/** Related public articles — same category first, then recent; excludes current slug. */
export function listRelatedMagazineArticles(
  slug: string,
  opts?: { category?: string; limit?: number }
): MagazineArticle[] {
  const limit = Math.min(Math.max(Number(opts?.limit) || 3, 1), 12);
  const { articles } = listMagazineArticles({
    publicOnly: true,
    limit: 48,
    status: 'all',
  });
  const others = articles.filter((a) => a.slug !== slug);
  const cat = (opts?.category || '').trim();
  if (!cat) return others.slice(0, limit);
  const same = others.filter((a) => a.category === cat);
  const rest = others.filter((a) => a.category !== cat);
  return [...same, ...rest].slice(0, limit);
}

const SAMPLE_SEED: MagazineArticleInput[] = [
  {
    title: 'مراقبت از دندان پت',
    slug: 'مراقبت-از-دندان-پت',
    excerpt: 'نکات ساده برای سلامت دهان و دندان پت‌تان در خانه.',
    bodyHtml:
      '<p>مسواک زدن منظم، جویدنی‌های مناسب و معاینه دوره‌ای دامپزشک به سلامت دهان پت کمک می‌کند.</p>',
    coverImage: '/pepito/uploads/01.jpg',
    category: 'مراقبت',
    tags: ['دندان', 'سلامت'],
    author: 'پت‌دیت',
    status: 'published',
    featured: true,
    publishAt: '2025-03-03 09:00:00',
    metaTitle: 'مراقبت از دندان پت | مجله پت‌دیت',
    metaDescription: 'نکات ساده برای سلامت دهان و دندان پت‌تان در خانه.',
  },
  {
    title: 'سبک‌های آرایش سگ',
    slug: 'سبکهای-آرایش-سگ',
    excerpt: 'انتخاب کوتاهی مو متناسب با نژاد و فصل.',
    bodyHtml:
      '<p>کوتاهی مو باید با نژاد، آب‌وهوا و سبک زندگی سگ هماهنگ باشد تا هم ظاهر و هم راحتی حفظ شود.</p>',
    coverImage: '/pepito/uploads/06.jpg',
    category: 'پت',
    tags: ['آرایش'],
    author: 'پت‌دیت',
    status: 'published',
    featured: true,
    publishAt: '2025-03-03 10:00:00',
    metaTitle: 'سبک‌های آرایش سگ | مجله پت‌دیت',
    metaDescription: 'انتخاب کوتاهی مو متناسب با نژاد و فصل.',
  },
  {
    title: 'نکات ایمنی پت',
    slug: 'نکات-ایمنی-پت',
    excerpt: 'چطور خانه را برای پت‌ها امن‌تر کنیم.',
    bodyHtml:
      '<p>مواد سمی، سیم‌های لخت و پنجره‌های باز را ایمن کنید تا خانه برای پت‌ها جای امنی باشد.</p>',
    coverImage: '/pepito/uploads/03.jpg',
    category: 'ایمنی',
    tags: ['ایمنی'],
    author: 'پت‌دیت',
    status: 'published',
    featured: true,
    publishAt: '2025-03-03 11:00:00',
    metaTitle: 'نکات ایمنی پت | مجله پت‌دیت',
    metaDescription: 'چطور خانه را برای پت‌ها امن‌تر کنیم.',
  },
];

/**
 * Seed 3 sample Persian posts only when the table has zero rows (incl. soft-deleted).
 * Never overwrites existing content.
 */
export function seedMagazineSamplesIfEmpty(): number {
  ensureMagazineSchema();
  const row = db()
    .prepare('SELECT COUNT(*) as c FROM magazine_articles')
    .get() as { c: number };
  if (Number(row?.c || 0) > 0) return 0;
  let created = 0;
  for (const sample of SAMPLE_SEED) {
    try {
      createMagazineArticle(sample);
      created += 1;
    } catch (err) {
      console.warn('magazine seed skipped:', (err as Error).message);
    }
  }
  return created;
}
