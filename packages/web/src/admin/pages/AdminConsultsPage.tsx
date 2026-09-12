import { useCallback, useEffect, useState } from 'react';
import {
  consultPublicIdOf,
  petPublicIdOf,
  userPublicIdOf,
  type VetConsultation,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { tr } from '../../i18n';

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
  seeker_advice: 'مشورت با صاحبین',
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
          <h1>{tr('مشاوره دامپزشک')}</h1>
          <p>{formatNumFa(items.length)} {tr('مشاوره')}</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{tr('همه')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_FA[s] || s}</option>)}
        </select>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table admin-table--dense">
        <thead>
          <tr>
            <th>{tr('آیدی')}</th>
            <th>{tr('بیمار')}</th>
            <th>{tr('پزشک / مربی')}</th>
            <th>{tr('پت')}</th>
            <th>{tr('نوع')}</th>
            <th>{tr('وضعیت')}</th>
            <th>{tr('زمان')}</th>
            <th>{tr('تغییر')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>
                <AdminIdChip publicId={consultPublicIdOf(c)} />
              </td>
              <td>
                <AdminEntityCell
                  thumb={
                    <AdminThumb
                      src={c.patientAvatarUrl}
                      label={c.patientName}
                      kind="user"
                      alt={c.patientName || tr('بیمار')}
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
                      alt={c.vetName || tr('پزشک')}
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
                {c.petImageUrl?.trim() || c.petId != null ? (
                  <AdminEntityCell
                    thumb={
                      <AdminThumb
                        src={c.petImageUrl}
                        petId={c.petId}
                        kind="pet"
                        label={c.petName}
                        alt={c.petName || tr('پت')}
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
                ) : (
                  <span className="admin-muted">—</span>
                )}
              </td>
              <td>
                <span className="admin-badge">
                  {KIND_FA[c.serviceKind || ''] || c.serviceKind || tr('دامپزشک')}
                </span>
              </td>
              <td><span className="admin-badge">{STATUS_FA[c.status] || c.status}</span></td>
              <td className="admin-muted admin-cell-nowrap">{formatAdminFaDateTime(c.createdAt)}</td>
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
          {!items.length ? <tr><td colSpan={8} className="admin-muted">{tr('مشاوره‌ای نیست')}</td></tr> : null}
        </tbody>
      </table></div>
    </div>
  );
}
