import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Newspaper, Plus, Search, Trash2 } from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDate } from '../JalaliDateSelect';
import { resolvePublicMediaUrl } from '../../lib/api';

type Article = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  status: 'draft' | 'published' | 'scheduled';
  featured: boolean;
  publishAt: string | null;
  updatedAt: string;
};

const STATUS_LABEL: Record<Article['status'], string> = {
  draft: 'پیش‌نویس',
  published: 'منتشر شده',
  scheduled: 'زمان‌بندی',
};

export function AdminMagazinePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Article['status']>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status !== 'all') params.set('status', status);
      const qs = params.toString() ? `?${params}` : '';
      const data = await adminFetch<{ articles: Article[]; total: number }>(
        `/api/admin/magazine${qs}`
      );
      setArticles(data.articles);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const st = searchParams.get('status');
    if (st === 'draft' || st === 'published' || st === 'scheduled') setStatus(st);
  }, [searchParams]);

  const remove = async (id: number) => {
    if (!confirm('حذف مقاله؟ (نرم‌حذف)')) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/magazine/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: number) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/magazine/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (id: number) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/magazine/${id}/unpublish`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>
            <Newspaper size={22} style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
            مجله و اخبار
          </h1>
          <p>{formatNumFa(total)} مطلب — ایجاد، ویرایش و انتشار محتوای مجله</p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => navigate('/admin/magazine/new')}
          >
            <Plus size={16} /> مطلب جدید
          </button>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input
            placeholder="جستجو عنوان / اسلاگ / دسته…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ maxWidth: 160 }}
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس</option>
          <option value="published">منتشر شده</option>
          <option value="scheduled">زمان‌بندی</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          اعمال
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>کاور</th>
              <th>عنوان</th>
              <th>وضعیت</th>
              <th>دسته</th>
              <th>انتشار</th>
              <th>ویژه</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {articles.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-muted">
                  مطلبی نیست — اولین مقاله را بسازید.
                </td>
              </tr>
            ) : (
              articles.map((a) => {
                const thumb = resolvePublicMediaUrl(a.coverImage);
                return (
                  <tr key={a.id}>
                    <td>
                      {thumb ? (
                        <img className="admin-thumb" src={thumb} alt="" />
                      ) : (
                        <span className="admin-thumb admin-thumb--placeholder">—</span>
                      )}
                    </td>
                    <td>
                      <Link to={`/admin/magazine/${a.id}`} className="admin-link">
                        {a.title}
                      </Link>
                      <div className="admin-muted" dir="ltr" style={{ fontSize: 12 }}>
                        /magazine/{a.slug}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`admin-pill admin-pill--${a.status === 'published' ? 'mint' : a.status === 'scheduled' ? 'sky' : 'slate'}`}
                      >
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td>{a.category || '—'}</td>
                    <td className="admin-cell-nowrap">{formatAdminFaDate(a.publishAt)}</td>
                    <td>{a.featured ? '★' : '—'}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => navigate(`/admin/magazine/${a.id}`)}
                        >
                          ویرایش
                        </button>
                        {a.status === 'published' ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            disabled={busy}
                            onClick={() => void unpublish(a.id)}
                          >
                            لغو انتشار
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            disabled={busy}
                            onClick={() => void publish(a.id)}
                          >
                            انتشار
                          </button>
                        )}
                        {a.status === 'published' ? (
                          <a
                            className="admin-btn admin-btn--ghost"
                            href={`/magazine/${a.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink size={14} /> پیش‌نمایش
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          disabled={busy}
                          onClick={() => void remove(a.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
