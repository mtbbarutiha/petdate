import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingChrome } from '../components/LandingChrome';
import { resolvePublicMediaUrl } from '../lib/api';
import { formatAdminFaDate } from '../admin/jalaliDate';

export type MagazineCard = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  publishAt: string;
  featured?: boolean;
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export async function fetchMagazineList(opts?: {
  q?: string;
  limit?: number;
}): Promise<MagazineCard[]> {
  const params = new URLSearchParams();
  if (opts?.q) params.set('q', opts.q);
  params.set('limit', String(opts?.limit ?? 24));
  const res = await fetch(`${API_BASE}/api/magazine?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('بارگذاری مجله ناموفق بود');
  const data = (await res.json()) as { articles: MagazineCard[] };
  return data.articles || [];
}

export async function fetchMagazineFeatured(limit = 6): Promise<MagazineCard[]> {
  const res = await fetch(`${API_BASE}/api/magazine/featured?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('بارگذاری اخبار ناموفق بود');
  const data = (await res.json()) as { articles: MagazineCard[] };
  return data.articles || [];
}

export function MagazineCardView({ article }: { article: MagazineCard }) {
  const img = resolvePublicMediaUrl(article.coverImage) || '/pepito/uploads/01.jpg';
  return (
    <article className="pepito-news-card">
      <div className="pepito-news-img">
        <Link to={`/magazine/${article.slug}`}>
          <img src={img} alt={article.title} loading="lazy" />
        </Link>
        {article.category ? <span className="pepito-news-cat">{article.category}</span> : null}
      </div>
      <div className="pepito-news-cont">
        <h3>
          <Link to={`/magazine/${article.slug}`}>{article.title}</Link>
        </h3>
        <p>{article.excerpt}</p>
        <div className="pepito-news-author">
          <div>
            <h5>{formatAdminFaDate(article.publishAt)}</h5>
            <h5>
              {article.author ? (
                <>
                  توسط <span className="pepito-news-author-name">{article.author}</span>
                </>
              ) : (
                'پت‌دیت'
              )}
            </h5>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MagazinePage() {
  const [articles, setArticles] = useState<MagazineCard[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMagazineList({ q: q.trim() || undefined })
      .then((list) => {
        if (!cancelled) {
          setArticles(list);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'خطا');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <LandingChrome
      bannerTitle="مجله پت‌دیت"
      bannerLead="مقالات و اخبار مراقبت از پت"
      actionLabel="خانه"
      actionTo="/"
      ctaLabel="همه اخبار"
      ctaTo="/magazine"
    >
      <section className="pepito-section pepito-news pepito-magazine-page">
        <div className="pepito-section-head pepito-section-head--center pepito-news-head">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            مجله و اخبار
          </p>
          <h1>
            مقالات و اخبار را ببینید<span className="pepito-news-dot">.</span>
          </h1>
        </div>

        <form
          className="pepito-magazine-search"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setQ(String(fd.get('q') || ''));
          }}
        >
          <input name="q" defaultValue={q} placeholder="جستجو در مجله…" aria-label="جستجو" />
          <button type="submit" className="pepito-btn button-1">
            جستجو
          </button>
        </form>

        {error ? <p className="pepito-magazine-error">{error}</p> : null}
        {loading ? <p className="pepito-muted">در حال بارگذاری…</p> : null}

        {!loading && articles.length === 0 ? (
          <p className="pepito-muted" style={{ textAlign: 'center' }}>
            هنوز مطلب منتشرشده‌ای نیست.
          </p>
        ) : (
          <div className="pepito-magazine-grid">
            {articles.map((a) => (
              <MagazineCardView key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>
    </LandingChrome>
  );
}
