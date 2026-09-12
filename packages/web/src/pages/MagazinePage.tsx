import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingChrome } from '../components/LandingChrome';
import { resolvePublicMediaUrl } from '../lib/api';
import { formatAdminFaDate } from '../admin/jalaliDate';
import { useI18n } from '../i18n';
import {
  fetchMagazineList,
  type MagazineCard,
} from '../lib/magazineApi';

export type { MagazineCard } from '../lib/magazineApi';
export { fetchMagazineFeatured, fetchMagazineList } from '../lib/magazineApi';

const PAGE_SIZE = 3;

export function MagazineCardView({ article }: { article: MagazineCard }) {
  const { t } = useI18n();
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
            <p className="pepito-news-meta">{formatAdminFaDate(article.publishAt)}</p>
            <p className="pepito-news-meta">
              {article.author ? (
                <>
                  {t('magazine.byAuthor')} <span className="pepito-news-author-name">{article.author}</span>
                </>
              ) : (
                t('magazine.brand')
              )}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MagazinePage() {
  const { t, dir } = useI18n();
  const [articles, setArticles] = useState<MagazineCard[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchMagazineList({
      q: q.trim() || undefined,
      limit: 48,
      offset: 0,
    })
      .then((result) => {
        if (!cancelled) {
          setArticles(result.articles);
          setTotal(result.total);
          setPage(0);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('magazine.error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, t]);

  const pageCount = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const pageArticles = useMemo(() => {
    const start = page * PAGE_SIZE;
    return articles.slice(start, start + PAGE_SIZE);
  }, [articles, page]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  return (
    <LandingChrome
      bannerTitle={t('magazine.title')}
      bannerLead={t('magazine.lead')}
      actionLabel={t('magazine.home')}
      actionTo="/"
      ctaLabel={t('magazine.allNews')}
      ctaTo="/magazine"
    >
      <section className="pepito-section pepito-news pepito-magazine-page" dir={dir}>
        <div className="pepito-section-head pepito-section-head--center pepito-news-head">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('magazine.newsEyebrow')}
          </p>
          <h1>
            {t('magazine.newsHeading')}.
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
          <input
            name="q"
            defaultValue={q}
            placeholder={t('magazine.searchPh')}
            aria-label={t('magazine.search')}
          />
          <button type="submit" className="pepito-btn button-1">
            {t('magazine.search')}
          </button>
        </form>

        {error ? <p className="pepito-magazine-error">{error}</p> : null}
        {loading ? <p className="pepito-muted">{t('common.loading')}</p> : null}

        {!loading && articles.length === 0 ? (
          <p className="pepito-muted" style={{ textAlign: 'center' }}>
            {t('magazine.empty')}
          </p>
        ) : (
          <>
            <div className="pepito-magazine-grid">
              {pageArticles.map((a) => (
                <MagazineCardView key={a.id} article={a} />
              ))}
            </div>
            {pageCount > 1 ? (
              <div className="pepito-news-dots" role="group" aria-label={t('magazine.pages')}>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`pepito-news-dot${i === page ? ' is-active' : ''}`}
                    onClick={() => setPage(i)}
                    aria-label={t('magazine.pageN', { n: i + 1 })}
                    aria-current={i === page ? 'true' : undefined}
                  />
                ))}
              </div>
            ) : null}
            {total > 0 ? (
              <p className="pepito-muted" style={{ textAlign: 'center', marginTop: 12 }}>
                {t('magazine.articlesCount', { n: total })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </LandingChrome>
  );
}
