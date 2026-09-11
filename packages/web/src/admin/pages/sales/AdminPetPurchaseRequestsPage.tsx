import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PetPurchaseLead, PetPurchaseLeadStatus } from '@petdate/shared';
import { PET_PURCHASE_LEAD_STATUSES, formatIranMobileDisplay } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDateTime } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

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
          <h1>درخواست‌های خرید پت</h1>
          <p>{formatNumFa(total)} درخواست · ارجاع به تیم فروش</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-toolbar">
        <input
          placeholder="جستجو نام / موبایل"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {PET_PURCHASE_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          بروزرسانی
        </button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>شناسه</th>
              <th>نام</th>
              <th>موبایل</th>
              <th>وضعیت</th>
              <th>مسئول</th>
              <th>لید فروش</th>
              <th>زمان</th>
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
                    جزئیات
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
        title={selected ? `درخواست ${selected.publicId}` : 'درخواست'}
        busy={busy}
      >
        {selected ? (
          <div className="admin-stack" style={{ gap: 12 }}>
            <p>
              <strong>
                {selected.firstName} {selected.lastName}
              </strong>
              <br />
              <span dir="ltr">{formatIranMobileDisplay(selected.mobile)}</span>
            </p>
            <p className="admin-muted">
              منبع: {selected.sourcePage || '—'} · ثبت: {formatAdminFaDateTime(selected.createdAt)}
            </p>
            <label>
              وضعیت
              <select
                value={selected.status}
                disabled={!canWrite || busy}
                onChange={(e) => void patchStatus(selected.id, e.target.value as PetPurchaseLeadStatus)}
              >
                {PET_PURCHASE_LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <p>مسئول: {selected.assigneeName || 'تخصیص‌نشده'}</p>
            {selected.salesItemId ? (
              <p>
                لید CRM:{' '}
                <Link to={`/admin/sales/leads/${selected.salesItemId}`}>
                  مشاهده در فروش
                </Link>
              </p>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {canWrite ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void claim(selected.id)}>
                  برداشتن / پیگیری توسط من
                </button>
              ) : null}
            </div>
            {canAssign ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <p className="admin-muted">ارجاع به تیم فروش</p>
                <input
                  placeholder="شناسه کارشناس (username / کد پرسنلی)"
                  value={assignOwnerId}
                  onChange={(e) => setAssignOwnerId(e.target.value)}
                />
                <input
                  placeholder="نام نمایشی کارشناس"
                  value={assignOwnerName}
                  onChange={(e) => setAssignOwnerName(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busy || !assignOwnerId.trim()}
                  onClick={() => void assign(selected.id)}
                >
                  ارجاع به فروش
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
