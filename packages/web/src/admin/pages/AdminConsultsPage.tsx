import { useCallback, useEffect, useState } from 'react';
import { petPublicIdOf, userPublicIdOf, type VetConsultation } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

const STATUSES = ['requested', 'active', 'completed', 'cancelled', 'expired'] as const;
const STATUS_FA: Record<string, string> = {
  requested: 'درخواست',
  active: 'فعال',
  completed: 'تمام',
  cancelled: 'لغو',
  expired: 'منقضی',
};
const KIND_FA: Record<string, string> = {
  vet: 'دامپزشک',
  trainer: 'مربی',
  ai: 'پاشا',
  ai_trainer: 'پاشا',
  ai_vet: 'پاشا',
};

export function AdminConsultsPage() {
  const [items, setItems] = useState<VetConsultation[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminFetch<{ consultations: VetConsultation[] }>(`/api/admin/consultations${qs}`);
      setItems(data.consultations); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const patchStatus = async (id: number, next: string) => {
    try {
      await adminFetch(`/api/admin/consultations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>مشاوره‌ها</h1>
          <p>{formatNumFa(items.length)} ردیف · جدول vet_consultations</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_FA[s] || s}</option>)}
        </select>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table admin-table--dense">
        <thead>
          <tr>
            <th>بیمار</th>
            <th>پزشک / مربی</th>
            <th>پت</th>
            <th>نوع</th>
            <th>وضعیت</th>
            <th>زمان</th>
            <th>تغییر</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <AdminEntityCell
                  thumb={
                    <AdminThumb
                      src={c.patientAvatarUrl}
                      label={c.patientName}
                      kind="user"
                      alt={c.patientName || 'بیمار'}
                    />
                  }
                  title={<strong>{c.patientName || '—'}</strong>}
                  subtitle={
                    <code className="admin-mono admin-id-public" dir="ltr">
                      {userPublicIdOf({ id: c.patientUserId })}
                    </code>
                  }
                />
              </td>
              <td>
                <AdminEntityCell
                  thumb={
                    <AdminThumb
                      src={c.vetAvatarUrl}
                      label={c.vetName}
                      kind="user"
                      alt={c.vetName || 'پزشک'}
                    />
                  }
                  title={<strong>{c.vetName || '—'}</strong>}
                  subtitle={
                    <code className="admin-mono admin-id-public" dir="ltr">
                      {userPublicIdOf({ id: c.vetUserId })}
                    </code>
                  }
                />
              </td>
              <td>
                <AdminEntityCell
                  thumb={
                    <AdminThumb
                      src={c.petImageUrl}
                      petId={c.petId}
                      kind="pet"
                      label={c.petName}
                      alt={c.petName || 'پت'}
                    />
                  }
                  title={c.petName || '—'}
                  subtitle={
                    c.petId != null ? (
                      <code className="admin-mono admin-id-public" dir="ltr">
                        {petPublicIdOf({ id: c.petId })}
                      </code>
                    ) : null
                  }
                />
              </td>
              <td>
                <span className="admin-badge">
                  {KIND_FA[c.serviceKind || ''] || c.serviceKind || 'دامپزشک'}
                </span>
              </td>
              <td><span className="admin-badge">{STATUS_FA[c.status] || c.status}</span></td>
              <td className="admin-muted admin-cell-nowrap">{c.createdAt ? new Date(c.createdAt).toLocaleString('fa-IR') : '—'}</td>
              <td>
                <select
                  className="admin-select admin-select--compact"
                  value={c.status}
                  onChange={(e) => void patchStatus(c.id, e.target.value)}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_FA[s] || s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {!items.length ? <tr><td colSpan={7} className="admin-muted">مشاوره‌ای نیست</td></tr> : null}
        </tbody>
      </table></div>
    </div>
  );
}
