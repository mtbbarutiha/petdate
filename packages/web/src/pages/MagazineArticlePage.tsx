import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LandingChrome } from '../components/LandingChrome';
import { resolvePublicMediaUrl } from '../lib/api';
import { formatAdminFaDate } from '../admin/jalaliDate';
import type { MagazineCard } from './MagazinePage';

type ArticleDetail = MagazineCard & {
  bodyHtml: string;
  tags: string[];
  metaTitle?: string;
  metaDescription?: string;
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export function MagazineArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`${API_BASE}/api/magazine/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || 'مقاله پیدا نشد');
        }
        return res.json() as Promise<{ article: ArticleDetail }>;
      })
      .then((data) => {
        if (!cancelled) {
          setArticle(data.article);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setArticle(null);
          setError(err instanceof Error ? err.message : 'خطا');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!article) return;
    const title = article.metaTitle || article.title;
    const desc = article.metaDescription || article.excerpt;
    document.title = `${title} | مجله پت‌دیت`;
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? 'property' : 'name';
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('description', desc);
    setMeta('og:title', title, true);
    setMeta('og:description', desc, true);
    if (article.coverImage) {
      setMeta('og:image', resolvePublicMediaUrl(article.coverImage) || article.coverImage, true);
    }
  }, [article]);

  const cover = article
    ? resolvePublicMediaUrl(article.coverImage) || '/pepito/uploads/01.jpg'
    : '';

  return (
    <LandingChrome
      bannerTitle="مجله پت‌دیت"
      bannerLead={article?.title || 'مقاله'}
      actionLabel="مجله"
      actionTo="/magazine"
      hideBanner={!article}
    >
      <article className="pepito-magazine-article">
        {loading ? <p className="pepito-muted">در حال بارگذاری…</p> : null}
        {error ? (
          <div className="pepito-magazine-error-box">
            <p>{error}</p>
            <Link to="/magazine" className="pepito-btn button-1">
              بازگشت به مجله
            </Link>
          </div>
        ) : null}
        {article ? (
          <>
            <header className="pepito-magazine-article-head">
              {article.category ? (
                <span className="pepito-magazine-badge">{article.category}</span>
              ) : null}
              <h1>{article.title}</h1>
              <p className="pepito-magazine-meta">
                <span>{formatAdminFaDate(article.publishAt)}</span>
                {article.author ? <span> · {article.author}</span> : null}
              </p>
              {article.excerpt ? <p className="pepito-magazine-lead">{article.excerpt}</p> : null}
            </header>
            {cover ? (
              <div className="pepito-magazine-cover">
                <img src={cover} alt={article.title} />
              </div>
            ) : null}
            <div
              className="pepito-magazine-body"
              dangerouslySetInnerHTML={{ __html: article.bodyHtml || '' }}
            />
            {article.tags?.length ? (
              <ul className="pepito-magazine-tags">
                {article.tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            <p style={{ marginTop: 32 }}>
              <Link to="/magazine" className="pepito-btn button-1">
                همه مقالات
              </Link>
            </p>
          </>
        ) : null}
      </article>
    </LandingChrome>
  );
}
