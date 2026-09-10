import { Check, Trash2, X } from 'lucide-react';
import { usePetStore } from '../../hooks/usePetStore';
import { MATCH_STATUS_LABELS } from '../../types';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { formatAdminFaDate } from '../JalaliDateSelect';

export function AdminMatchesPage() {
  const { matches, updateMatchStatus, deleteMatch } = usePetStore();

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>درخواست‌های همبازی</h1>
          <p>{matches.length} درخواست</p>
        </div>
      </header>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>از</th>
              <th>پیام</th>
              <th>وضعیت</th>
              <th>زمان</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>
                  <AdminEntityCell
                    thumb={
                      <AdminThumb
                        src={m.fromPet.imageUrl}
                        petId={Number(m.fromPet.id) || undefined}
                        kind="pet"
                        label={m.fromPet.name}
                        alt={m.fromPet.name}
                      />
                    }
                    title={<strong>{m.fromPet.name}</strong>}
                    subtitle={m.fromPet.breed}
                  />
                </td>
                <td>{m.message || '—'}</td>
                <td>
                  <span className={`admin-status admin-status--${m.status}`}>
                    {MATCH_STATUS_LABELS[m.status]}
                  </span>
                </td>
                <td>{formatAdminFaDate(m.createdAt)}</td>
                <td>
                  <div className="admin-row-actions">
                    {m.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="admin-btn admin-btn--success"
                          onClick={() => updateMatchStatus(m.id, 'accepted')}
                          title="✅ قبول"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          onClick={() => updateMatchStatus(m.id, 'rejected')}
                          title="❌ رد"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => deleteMatch(m.id)}
                      title="🗑 حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
