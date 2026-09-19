import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, RefreshCw, Star, Trash2, X } from 'lucide-react';
import type { PetLoverReview } from '@petdate/shared';
import { adminFetch } from '../api';
import { resolvePublicMediaUrl } from '../../lib/api';
import { appConfirm, appPrompt } from '../../components/AppDialog';
import { tr } from '../../i18n';
import { AdminBrandLoader } from '../AdminBrandLoader';
import { formatAdminFaDate } from '../jalaliDate';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<PetLoverReview['status'], string> = {
  pending: 'در انتظار',
  approved: 'تأیید شده',
  rejected: 'رد شده',
};

export function AdminPetLoversReviewsPage() {
  const [reviews, setReviews] = useState<PetLoverReview[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      params.set('limit', '100');
      const data = await adminFetch<{
        reviews: PetLoverReview[];
        total: number;
        counts?: { pending: number; approved: number; rejected: number; all: number };
      }>(`/api/admin/pet-lover-reviews?${params}`);
      setReviews(data.reviews);
      setTotal(data.total);
      if (data.counts) setCounts(data.counts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: number) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/pet-lover-reviews/${id}/approve`, {
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

  const reject = async (id: number) => {
    const note = await appPrompt(tr('دلیل رد (اختیاری)'), { optional: true, variant: 'admin' });
    if (note === null) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/pet-lover-reviews/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ note: note || undefined }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!(await appConfirm(tr('حذف این نظر؟'), { danger: true, variant: 'admin' }))) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/pet-lover-reviews/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <h1>{tr('نظرات عاشقان پت')}</h1>
          <p className="muted">
            {tr('همه نظرات اینجاست — نمونه‌ها تأییدشده‌اند. صف «در انتظار» فقط عکس‌های تازه کاربران است.')}
          </p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-btn ghost" to="/reviews" target="_blank" rel="noreferrer">
            {tr('مشاهده صفحه عمومی')}
          </Link>
          <button
            type="button"
            className="admin-btn ghost"
            onClick={() => void load()}
            disabled={busy || loading}
          >
            <RefreshCw size={16} aria-hidden />
            {tr('بروزرسانی')}
          </button>
        </div>
      </header>

      <div className="admin-filter-row" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-chip${status === s ? ' active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s === 'all'
              ? tr('همه')
              : s === 'pending'
                ? tr('در انتظار')
                : s === 'approved'
                  ? tr('تأیید شده')
                  : tr('رد شده')}
            {` (${counts[s]})`}
          </button>
        ))}
        <span className="muted" style={{ alignSelf: 'center' }}>
          {total} {tr('مورد')}
        </span>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {loading ? <AdminBrandLoader size="page" /> : null}

      {!loading && reviews.length === 0 ? (
        <p className="muted">{tr('موردی در این فیلتر نیست.')}</p>
      ) : null}

      <div className="admin-plr-list">
        {reviews.map((r) => {
          const img = resolvePublicMediaUrl(r.photoUrl) || r.photoUrl;
          return (
            <article key={r.id} className="admin-card admin-plr-card">
              <div>
                <img src={img} alt={r.displayHandle} />
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{r.displayHandle}</strong>
                  <span className={`admin-badge status-${r.status}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.isSeed ? <span className="admin-badge">{tr('نمونه')}</span> : null}
                  <span className="muted" style={{ display: 'inline-flex', gap: 2 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < r.rating ? 'currentColor' : 'none'}
                        strokeWidth={i < r.rating ? 0 : 1.5}
                        aria-hidden
                      />
                    ))}
                  </span>
                </div>
                <p style={{ margin: '8px 0' }}>{r.body}</p>
                <p className="muted" style={{ fontSize: 13 }}>
                  {formatAdminFaDate(r.createdAt)}
                  {r.userId != null ? ` · user #${r.userId}` : ''}
                  {r.reviewedBy ? ` · ${tr('بررسی')}: ${r.reviewedBy}` : ''}
                </p>
                {r.adminNote ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    {tr('یادداشت')}: {r.adminNote}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {r.status !== 'approved' ? (
                    <button
                      type="button"
                      className="admin-btn primary"
                      disabled={busy}
                      onClick={() => void approve(r.id)}
                    >
                      <Check size={16} aria-hidden />
                      {tr('تأیید')}
                    </button>
                  ) : null}
                  {r.status !== 'rejected' ? (
                    <button
                      type="button"
                      className="admin-btn ghost"
                      disabled={busy}
                      onClick={() => void reject(r.id)}
                    >
                      <X size={16} aria-hidden />
                      {tr('رد')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="admin-btn danger"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                    {tr('حذف')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
