import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  userPublicIdOf,
  type User,
  type UserRole,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { AdminIdChip } from '../AdminIds';
import {
  AdminContactCell,
  AdminTelegramCell,
  AdminWalletCell,
  adminUserDemographics,
  adminVerifyClass,
  adminVerifyLabel,
} from '../AdminListCells';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { AdminModal } from '../AdminModal';

function activeRolesOf(user: User): UserRole[] {
  const fromList = (user.roles || []).filter((r): r is UserRole => USER_ROLES.includes(r));
  if (fromList.length) return fromList;
  if (user.role && USER_ROLES.includes(user.role)) return [user.role];
  return [];
}

export function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  /** Honor ?q= from deep-links (e.g. pets owner → users). */
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [role, setRole] = useState('');
  /** Default active-only — soft-deleted shells must not clutter the list. */
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [credit, setCredit] = useState<{ userId: number; amount: string; currency: string } | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get('q') ?? '';
    setQ((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (role) qs.set('role', role);
      if (status === 'active') qs.set('active', '1');
      else if (status === 'inactive') qs.set('active', '0');
      qs.set('limit', '100');
      const data = await adminFetch<{ total: number; users: User[] }>(`/api/admin/users?${qs}`);
      setUsers(data.users); setTotal(data.total); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [q, role, status]);
  useEffect(() => { void load(); }, [load]);

  const toggleBan = async (user: User) => {
    setBusyId(user.id);
    try {
      await adminFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: user.isActive === false }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusyId(null); }
  };

  const setPrimaryRole = async (user: User, next: UserRole) => {
    setBusyId(user.id);
    try {
      await adminFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: next }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusyId(null); }
  };

  const submitCredit = async () => {
    if (!credit) return;
    const amount = Number(credit.amount);
    if (!Number.isFinite(amount) || amount === 0) { setError('مبلغ نامعتبر'); return; }
    setBusyId(credit.userId);
    try {
      await adminFetch('/api/admin/wallet/credit', { method: 'POST', body: JSON.stringify({ userId: credit.userId, currency: credit.currency, amount }) });
      setCredit(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>کاربران</h1>
          <p>{formatNumFa(total)} کاربر · فیلدهای مهم مدیریتی از جدول users</p>
        </div>
      </header>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={16} /><input placeholder="نام، آیدی PD-U، موبایل، تلگرام…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">همه نقش‌ها</option>
          {USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
        </select>
        <select
          className="admin-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'all')}
          aria-label="وضعیت حساب"
        >
          <option value="active">فقط فعال</option>
          <option value="inactive">مسدود / حذف‌شده</option>
          <option value="all">همه</option>
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>اعمال</button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>آیدی</th>
              <th>نام</th>
              <th>تلگرام</th>
              <th>تماس</th>
              <th>شهر</th>
              <th>نقش‌ها</th>
              <th>نقش اصلی</th>
              <th>کیف پول</th>
              <th>احراز</th>
              <th>وضعیت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const publicId = userPublicIdOf(u);
              const roles = activeRolesOf(u);
              const demo = adminUserDemographics(u);
              return (
                <tr key={u.id}>
                  <td>
                    <AdminIdChip publicId={publicId} />
                  </td>
                  <td>
                    <AdminEntityCell
                      thumb={<AdminThumb src={u.avatarUrl} label={u.name} kind="user" alt={u.name} />}
                      title={<strong>{u.name}</strong>}
                      subtitle={demo}
                    />
                  </td>
                  <td>
                    <AdminTelegramCell username={u.username} telegramId={u.telegramId} />
                  </td>
                  <td>
                    <AdminContactCell phone={u.phone} email={u.email} />
                  </td>
                  <td className="admin-cell-nowrap">{[u.city, u.province].filter(Boolean).join('، ') || '—'}</td>
                  <td>
                    <div className="admin-role-badges">
                      {roles.length
                        ? roles.map((r) => (
                            <span
                              key={r}
                              className={`admin-badge ${r === u.role ? 'admin-badge--info' : ''}`}
                              title={r === u.role ? 'نقش اصلی' : undefined}
                            >
                              {USER_ROLE_LABELS[r] || r}
                            </span>
                          ))
                        : <span className="admin-muted">بدون نقش</span>}
                    </div>
                  </td>
                  <td>
                    <select
                      className="admin-select admin-select--compact"
                      value={u.role || ''}
                      disabled={busyId === u.id}
                      onChange={(e) => void setPrimaryRole(u, e.target.value as UserRole)}
                    >
                      {USER_ROLES.map((r) => <option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <AdminWalletCell
                      coins={u.coins}
                      toman={u.walletToman}
                      stars={u.walletStars}
                      ton={u.walletTon}
                    />
                  </td>
                  <td>
                    <span className={adminVerifyClass(u.verificationStatus)}>
                      {adminVerifyLabel(u.verificationStatus)}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${u.isActive === false ? 'admin-badge--error' : 'admin-badge--info'}`}>
                      {u.isActive === false ? 'مسدود' : 'فعال'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        disabled={busyId === u.id}
                        onClick={() => setCredit({ userId: u.id, amount: '10000', currency: 'toman' })}
                      >
                        اعتبار
                      </button>
                      <button
                        type="button"
                        className={`admin-btn ${u.isActive === false ? 'admin-btn--primary' : 'admin-btn--danger'}`}
                        disabled={busyId === u.id}
                        onClick={() => void toggleBan(u)}
                      >
                        {u.isActive === false ? 'رفع مسدودی' : 'مسدود'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!users.length ? <tr><td colSpan={11} className="admin-muted">کاربری یافت نشد</td></tr> : null}
          </tbody>
        </table>
      </div>
      <AdminModal
        open={Boolean(credit)}
        title="واریز / برداشت کیف پول"
        onClose={() => setCredit(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void submitCredit()}>اعمال</button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setCredit(null)}>انصراف</button>
          </>
        }
      >
        {credit ? (
          <>
            <p className="admin-muted" dir="ltr" style={{ marginTop: 0 }}>
              {userPublicIdOf({ id: credit.userId })}
            </p>
            <label>
              <span className="form-label">ارز</span>
              <select className="admin-select" value={credit.currency} onChange={(e) => setCredit({ ...credit, currency: e.target.value })}>
                <option value="toman">تومان</option><option value="coins">سکه</option><option value="stars">Stars</option><option value="ton">TON</option>
              </select>
            </label>
            <label>
              <span className="form-label">مبلغ</span>
              <input className="form-input" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} />
            </label>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
