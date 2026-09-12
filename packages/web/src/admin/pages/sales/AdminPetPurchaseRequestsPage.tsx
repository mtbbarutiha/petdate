import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PetPurchaseLead, PetPurchaseLeadStatus } from '@petdate/shared';
import { PET_PURCHASE_LEAD_STATUSES, formatIranMobileDisplay } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDateTime } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { tr } from '../../../i18n';

function statusBadgeClass(status: PetPurchaseLeadStatus): string {
  switch (status) {
    case 'جدید':
      return 'admin-badge admin-badge--info';
    case 'در حال پیگیری':
      return 'admin-badge admin-badge--warn';
    case 'ارجاع‌شده به فروش':
      return 'admin-badge admin-badge--ok';
    case 'بسته':
      return 'admin-badge';
    default:
      return 'admin-badge';
  }
}

export function AdminPetPurchaseRequestsPage() {
  const [items, setItems] = useState<PetPurchaseLead[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PetPurchaseLead | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState('');
  const [assignOwnerName, setAssignOwnerName] = useState('');
  const [busy, setBusy] = useState(false);
  const canWrite = adminCan('sales.write');
  const canAssign = adminCan('sales.admin');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ limit: '100' });
      if (q.trim()) qs.set('q', q.trim());
      if (status) qs.set('status', status);
      const data = await adminFetch<{ total: number; items: PetPurchaseLead[] }>(
        `/api/admin/sales/pet-purchase-requests?${qs}`
      );
      setItems(data.items);
      setTotal(data.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    }
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchStatus = async (id: number, next: PetPurchaseLeadStatus) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/pet-purchase-requests/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
      if (selected?.id === id) {
        const d = await adminFetch<{ item: PetPurchaseLead }>(
          `/api/admin/sales/pet-purchase-requests/${id}`
        );
        setSelected(d.item);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const claim = async (id: number) => {
    setBusy(true);
    try {
      const d = await adminFetch<{ item: PetPurchaseLead }>(
        `/api/admin/sales/pet-purchase-requests/${id}/claim`,
        { method: 'POST', body: '{}' }
      );
      setSelected(d.item);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const assign = async (id: number) => {
    if (!assignOwnerId.trim()) return;
    setBusy(true);
    try {
      const d = await adminFetch<{ item: PetPurchaseLead }>(
        `/api/admin/sales/pet-purchase-requests/${id}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({
            ownerId: assignOwnerId.trim(),
            ownerName: assignOwnerName.trim() || assignOwnerId.trim(),
          }),
        }
      );
      setSelected(d.item);
      setAssignOwnerId('');
      setAssignOwnerName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('درخواست‌های خرید پت')}</h1>
          <p>{formatNumFa(total)} {tr('درخواست · ارجاع به تیم فروش')}</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-toolbar">
        <input
          placeholder={tr("جستجو نام / موبایل")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tr('همه وضعیت‌ها')}</option>
          {PET_PURCHASE_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          {tr('بروزرسانی')}
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('شناسه')}</th>
              <th>{tr('نام')}</th>
              <th>{tr('موبایل')}</th>
              <th>{tr('وضعیت')}</th>
              <th>{tr('مسئول')}</th>
              <th>{tr('لید فروش')}</th>
              <th>{tr('زمان')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.publicId}</td>
                <td>
                  {i.firstName} {i.lastName}
                </td>
                <td dir="ltr">{formatIranMobileDisplay(i.mobile)}</td>
                <td>{i.status}</td>
                <td>{i.assigneeName || '—'}</td>
                <td>
                  {i.salesItemId ? (
                    <Link to={`/admin/sales/leads/${i.salesItemId}`}>LD-{String(i.salesItemId).padStart(4, '0')}</Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{formatAdminFaDateTime(i.createdAt)}</td>
                <td>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setSelected(i)}>
                    {tr('جزئیات')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${tr('درخواست ')}${selected.publicId}` : tr('درخواست')}
        size="md"
        busy={busy}
      >
        {selected ? (
          <div className="pp-req-detail">
            <header className="pp-req-detail__hero">
              <div className="pp-req-detail__identity">
                <strong className="pp-req-detail__name">
                  {selected.firstName} {selected.lastName}
                </strong>
                <span className="pp-req-detail__mobile" dir="ltr">
                  {formatIranMobileDisplay(selected.mobile)}
                </span>
              </div>
              <span className={statusBadgeClass(selected.status)}>{selected.status}</span>
            </header>

            <p className="pp-req-detail__meta admin-muted">
              {tr('منبع:')} {selected.sourcePage || '—'} {tr('· ثبت:')} {formatAdminFaDateTime(selected.createdAt)}
            </p>

            <div className="pp-req-detail__grid">
              <div>
                <span className="form-label">{tr('وضعیت')}</span>
                <select
                  className="admin-select"
                  value={selected.status}
                  disabled={!canWrite || busy}
                  aria-label={tr("وضعیت")}
                  onChange={(e) => void patchStatus(selected.id, e.target.value as PetPurchaseLeadStatus)}
                >
                  {PET_PURCHASE_LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="form-label">{tr('مسئول')}</span>
                <div className="pp-req-detail__value">
                  {selected.assigneeName || tr('تخصیص‌نیافته')}
                </div>
              </div>
              {selected.salesItemId ? (
                <div className="pp-req-detail__span">
                  <span className="form-label">{tr('لید CRM')}</span>
                  <div className="pp-req-detail__value">
                    <Link to={`/admin/sales/leads/${selected.salesItemId}`}>{tr('مشاهده در فروش')}</Link>
                  </div>
                </div>
              ) : null}
            </div>

            {canWrite ? (
              <div className="pp-req-detail__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={busy}
                  onClick={() => void claim(selected.id)}
                >
                  {tr('برداشتن / پیگیری توسط من')}
                </button>
              </div>
            ) : null}

            {canAssign ? (
              <section className="pp-req-detail__refer" aria-labelledby="pp-req-refer-title">
                <h4 id="pp-req-refer-title" className="admin-subsection-title">
                  {tr('ارجاع به تیم فروش')}
                </h4>
                <p className="admin-hint admin-muted">
                  {tr('شناسه کارشناس فروش را وارد کنید تا درخواست به او منتقل شود.')}
                </p>
                <div className="pp-req-detail__refer-fields">
                  <label>
                    <span className="form-label">{tr('شناسه کارشناس')}</span>
                    <input
                      className="form-input"
                      placeholder={tr("username یا کد پرسنلی")}
                      value={assignOwnerId}
                      onChange={(e) => setAssignOwnerId(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    <span className="form-label">{tr('نام نمایشی')}</span>
                    <input
                      className="form-input"
                      placeholder={tr("نام نمایشی کارشناس")}
                      value={assignOwnerName}
                      onChange={(e) => setAssignOwnerName(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busy || !assignOwnerId.trim()}
                  onClick={() => void assign(selected.id)}
                >
                  {tr('ارجاع به فروش')}
                </button>
              </section>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
