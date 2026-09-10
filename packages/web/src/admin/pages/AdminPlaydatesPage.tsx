import { useCallback, useEffect, useState } from 'react';
import { petPublicIdOf, playdatePublicIdOf, userPublicIdOf, type PetProfile, type PlaydateRequest } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { AdminIdChip } from '../AdminIds';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار',
  accepted: 'پذیرفته',
  rejected: 'رد شده',
  cancelled: 'لغو',
  expired: 'منقضی',
};

type AdminPlaydateRow = PlaydateRequest & {
  fromUserAvatarUrl?: string;
  toUserAvatarUrl?: string;
  fromUserName?: string;
  toUserName?: string;
};

function PetCell({ pet, petId }: { pet?: PetProfile; petId: number }) {
  const id = pet?.id ?? petId;
  return (
    <AdminEntityCell
      thumb={
        <AdminThumb
          src={pet?.imageUrl}
          petId={id}
          kind="pet"
          label={pet?.name}
          alt={pet?.name || 'پت'}
        />
      }
      title={<strong>{pet?.name || '—'}</strong>}
      subtitle={<AdminIdChip publicId={petPublicIdOf(pet ?? { id })} />}
    />
  );
}

export function AdminPlaydatesPage() {
  const [items, setItems] = useState<AdminPlaydateRow[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminFetch<{ playdates: AdminPlaydateRow[] }>(`/api/admin/playdates${qs}`);
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
          <p>{formatNumFa(items.length)} مورد</p>
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">همه</option><option value="pending">در انتظار</option><option value="accepted">پذیرفته</option>
          <option value="rejected">رد شده</option><option value="cancelled">لغو</option><option value="expired">منقضی</option>
        </select>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table admin-table--dense">
        <thead>
          <tr>
            <th>آیدی</th>
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
              <td>
                <AdminIdChip publicId={playdatePublicIdOf(m)} />
              </td>
              <td><PetCell pet={m.fromPet} petId={m.fromPetId} /></td>
              <td><PetCell pet={m.toPet} petId={m.toPetId} /></td>
              <td>
                <div className="admin-party-pair">
                  <div className="admin-party-pair-row">
                    <span className="admin-party-pair-label">از</span>
                    <AdminThumb src={m.fromUserAvatarUrl} label={m.fromUserName} kind="user" size={28} />
                    <code className="admin-mono admin-id-public" dir="ltr">
                      {userPublicIdOf({ id: m.fromUserId })}
                    </code>
                  </div>
                  {m.toUserId != null ? (
                    <div className="admin-party-pair-row">
                      <span className="admin-party-pair-label">به</span>
                      <AdminThumb src={m.toUserAvatarUrl} label={m.toUserName} kind="user" size={28} />
                      <code className="admin-mono admin-id-public" dir="ltr">
                        {userPublicIdOf({ id: m.toUserId })}
                      </code>
                    </div>
                  ) : null}
                </div>
              </td>
              <td>{m.message || '—'}</td>
              <td><span className={`admin-status admin-status--${m.status}`}>{STATUS_FA[m.status] || m.status}</span></td>
              <td className="admin-cell-nowrap">{new Date(m.createdAt).toLocaleString('fa-IR')}</td>
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
