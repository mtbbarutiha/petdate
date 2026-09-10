import { useCallback, useEffect, useState } from 'react';
import { petPublicIdOf, type PlaydateRequest } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { AdminIdChip } from '../AdminIds';

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  accepted: 'پذیرفته',
  rejected: 'رد شده',
  cancelled: 'لغو',
  expired: 'منقضی',
};

export function AdminPlaydatesPage() {
  const [items, setItems] = useState<PlaydateRequest[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminFetch<{ playdates: PlaydateRequest[] }>(`/api/admin/playdates${qs}`);
      setItems(data.playdates); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const setItemStatus = async (id: number, next: string) => {
    try {
      await adminFetch(`/api/admin/playdates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>درخواست‌های همبازی</h1>
          <p>{formatNumFa(items.length)} مورد · جدول playdate_requests</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه</option><option value="pending">در انتظار</option><option value="accepted">پذیرفته</option>
          <option value="rejected">رد شده</option><option value="cancelled">لغو</option><option value="expired">منقضی</option>
        </select>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table">
        <thead>
          <tr>
            <th>آیدی درخواست</th>
            <th>از پت</th>
            <th>به پت</th>
            <th>کاربران</th>
            <th>پیام</th>
            <th>وضعیت</th>
            <th>زمان</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}>
              <td><code className="admin-mono" dir="ltr">#{m.id}</code></td>
              <td>
                <AdminIdChip
                  publicId={petPublicIdOf({ id: m.fromPetId })}
                  numericId={m.fromPetId}
                />
              </td>
              <td>
                <AdminIdChip
                  publicId={petPublicIdOf({ id: m.toPetId })}
                  numericId={m.toPetId}
                />
              </td>
              <td className="admin-mono" dir="ltr">
                #{m.fromUserId}
                {m.toUserId != null ? ` → #${m.toUserId}` : ''}
              </td>
              <td>{m.message || '—'}</td>
              <td><span className={`admin-status admin-status--${m.status}`}>{STATUS_FA[m.status] || m.status}</span></td>
              <td>{new Date(m.createdAt).toLocaleString('fa-IR')}</td>
              <td>
                <div className="admin-row-actions">
                  {m.status === 'pending' ? (
                    <>
                      <button type="button" className="admin-btn admin-btn--primary" onClick={() => void setItemStatus(m.id, 'accepted')}>قبول</button>
                      <button type="button" className="admin-btn admin-btn--danger" onClick={() => void setItemStatus(m.id, 'rejected')}>رد</button>
                    </>
                  ) : (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void setItemStatus(m.id, 'cancelled')}>لغو</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!items.length ? <tr><td colSpan={8} className="admin-muted">درخواستی نیست</td></tr> : null}
        </tbody>
      </table></div>
    </div>
  );
}
