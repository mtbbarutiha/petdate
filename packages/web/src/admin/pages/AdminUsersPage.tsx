import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Ban, List, Map, Pencil, Search, ShieldCheck, Trash2 } from 'lucide-react';
import {
  IranProvinceHeatmap,
  USERS_HEATMAP_COPY,
  type IranHeatRow,
} from '../geo';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  VERIFICATION_STATUSES,
  VERIFICATION_STATUS_LABELS,
  userPublicIdOf,
  type User,
  type UserGender,
  type UserRole,
  type VerificationStatus,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { adminCan } from '../auth';
import { AdminIdChip } from '../AdminIds';
import {
  AdminContactCell,
  AdminPetsCell,
  AdminWalletCell,
  adminUserDemographics,
  adminVerifyClass,
  adminVerifyLabel,
} from '../AdminListCells';
import { AdminEntityCell, AdminThumb } from '../AdminThumb';
import { AdminModal } from '../AdminModal';
import { tr, useI18n } from '../../i18n';

/** Soft-deleted anonymized shell left for finance FK history. */
function isDeletedUserShell(user: User): boolean {
  return user.isActive === false && String(user.name || '').startsWith('[حذف‌شده');
}

function userStatusLabel(user: User): string {
  if (isDeletedUserShell(user)) return tr('حذف‌شده');
  if (user.isActive === false) return tr('مسدود');
  return tr('فعال');
}

type UsersView = 'list' | 'heatmap';

function activeRolesOf(user: User): UserRole[] {
  const fromList = (user.roles || []).filter((r): r is UserRole => USER_ROLES.includes(r));
  if (fromList.length) return fromList;
  if (user.role && USER_ROLES.includes(user.role)) return [user.role];
  return [];
}

type EditForm = {
  name: string;
  username: string;
  phone: string;
  email: string;
  city: string;
  province: string;
  country: string;
  age: string;
  gender: '' | UserGender;
  bio: string;
  roles: UserRole[];
  role: UserRole;
  coins: string;
  toman: string;
  stars: string;
  ton: string;
  verificationStatus: VerificationStatus;
  isActive: boolean;
};

function formFromUser(user: User): EditForm {
  const roles = activeRolesOf(user);
  const primary =
    user.role && USER_ROLES.includes(user.role)
      ? user.role
      : roles[0] || 'pet_owner';
  return {
    name: user.name || '',
    username: user.username || '',
    phone: user.phone || '',
    email: user.email || '',
    city: user.city || '',
    province: user.province || '',
    country: user.country || '',
    age: user.age != null ? String(user.age) : '',
    gender: user.gender === 'male' || user.gender === 'female' ? user.gender : '',
    bio: user.bio || '',
    roles: roles.length ? roles : [primary],
    role: primary,
    coins: String(Number(user.coins) || 0),
    toman: String(Number(user.walletToman) || 0),
    stars: String(Number(user.walletStars) || 0),
    ton: String(Number(user.walletTon) || 0),
    verificationStatus:
      user.verificationStatus && VERIFICATION_STATUSES.includes(user.verificationStatus)
        ? user.verificationStatus
        : 'none',
    isActive: user.isActive !== false,
  };
}

export function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  /** Default active-only — soft-deleted shells must not clutter the list. */
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [credit, setCredit] = useState<{ userId: number; amount: string; currency: string } | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [geoRows, setGeoRows] = useState<IranHeatRow[]>([]);
  const [geoUnknown, setGeoUnknown] = useState(0);
  const [geoTotal, setGeoTotal] = useState(0);
  const [geoKnown, setGeoKnown] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [view, setView] = useState<UsersView>('list');
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const canManageUsers = adminCan('platform.write') || adminCan('admin.full');

  const loadGeo = useCallback(async () => {
    try {
      // Map follows the users filter: inactive filter → inactive geo; else active users.
      const qs = status === 'inactive' ? 'active=0' : 'active=1';
      const data = await adminFetch<{
        totalUsers: number;
        provinceKnownCount: number;
        unknownProvinceCount: number;
        byProvince: IranHeatRow[];
      }>(`/api/admin/users/geo?${qs}`);
      setGeoRows(data.byProvince || []);
      setGeoUnknown(data.unknownProvinceCount || 0);
      setGeoTotal(data.totalUsers || 0);
      setGeoKnown(data.provinceKnownCount || 0);
      setGeoError(null);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : tr('خطا در نقشه کاربران'));
    }
  }, [status]);

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
    } catch (err) { setError(err instanceof Error ? err.message : tr('خطا')); }
  }, [q, role, status]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (view === 'heatmap') void loadGeo();
  }, [loadGeo, view]);

  const openEdit = (user: User) => {
    setEditing(user);
    setEditForm(formFromUser(user));
    setEditError(null);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setEditing(null);
    setEditForm(null);
    setEditError(null);
  };

  const toggleEditRole = (r: UserRole) => {
    if (!editForm) return;
    const has = editForm.roles.includes(r);
    let nextRoles: UserRole[];
    if (has) {
      if (editForm.roles.length <= 1) return;
      nextRoles = editForm.roles.filter((x) => x !== r);
    } else {
      nextRoles = [...editForm.roles, r];
    }
    const nextPrimary = nextRoles.includes(editForm.role) ? editForm.role : nextRoles[0]!;
    setEditForm({ ...editForm, roles: nextRoles, role: nextPrimary });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm) return;
    if (!editForm.name.trim()) {
      setEditError(tr('نام الزامی است'));
      return;
    }
    if (!editForm.roles.length) {
      setEditError(tr('حداقل یک نقش لازم است'));
      return;
    }
    const ageTrim = editForm.age.trim();
    const ageNum = ageTrim === '' ? undefined : Number(ageTrim);
    if (ageTrim !== '' && (!Number.isFinite(ageNum) || (ageNum as number) < 0)) {
      setEditError(tr('سن نامعتبر است'));
      return;
    }
    const wallet = {
      coins: Number(editForm.coins),
      toman: Number(editForm.toman),
      stars: Number(editForm.stars),
      ton: Number(editForm.ton),
    };
    for (const [key, val] of Object.entries(wallet)) {
      if (!Number.isFinite(val) || val < 0) {
        setEditError(tr('موجودی {key} نامعتبر است', { key }));
        return;
      }
    }

    setEditBusy(true);
    setEditError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        username: editForm.username.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        city: editForm.city.trim(),
        province: editForm.province.trim(),
        country: editForm.country.trim(),
        bio: editForm.bio.trim(),
        roles: editForm.roles,
        role: editForm.roles.includes(editForm.role) ? editForm.role : editForm.roles[0],
        verificationStatus: editForm.verificationStatus,
        isActive: editForm.isActive,
        wallet,
      };
      if (ageNum !== undefined) payload.age = Math.floor(ageNum);
      if (editForm.gender) payload.gender = editForm.gender;

      await adminFetch(`/api/admin/users/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditing(null);
      setEditForm(null);
      setEditError(null);
      await load();
      await loadGeo();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : tr('خطا در ذخیره'));
    } finally {
      setEditBusy(false);
    }
  };

  const toggleBan = async (user: User) => {
    setBusyId(user.id);
    try {
      await adminFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: user.isActive === false }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : tr('خطا')); }
    finally { setBusyId(null); }
  };

  const setPrimaryRole = async (user: User, next: UserRole) => {
    setBusyId(user.id);
    try {
      await adminFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role: next }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : tr('خطا')); }
    finally { setBusyId(null); }
  };

  const submitCredit = async () => {
    if (!credit) return;
    const amount = Number(credit.amount);
    if (!Number.isFinite(amount) || amount === 0) { setError(tr('مبلغ نامعتبر')); return; }
    setBusyId(credit.userId);
    try {
      await adminFetch('/api/admin/wallet/credit', { method: 'POST', body: JSON.stringify({ userId: credit.userId, currency: credit.currency, amount }) });
      setCredit(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : tr('خطا')); }
    finally { setBusyId(null); }
  };

  const confirmDeleteUser = async () => {
    if (!deleting || !canManageUsers) return;
    setDeleteBusy(true);
    setBusyId(deleting.id);
    try {
      await adminFetch(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setError(null);
      // Default active filter drops the shell; inactive filter shows «حذف‌شده».
      setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      setTotal((t) => Math.max(0, t - 1));
      await load();
      await loadGeo();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('حذف کاربر ناموفق بود'));
    } finally {
      setDeleteBusy(false);
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{t('admin.usersTitle')}</h1>
          <p>{formatNumFa(total)} {tr('کاربر · فیلدهای مهم مدیریتی از جدول users به‌همراه نام پت')}</p>
        </div>
      </header>

      <div className="admin-tabs" role="tablist" aria-label={t('admin.usersTabsAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={`admin-tab${view === 'list' ? ' is-on' : ''}`}
          onClick={() => setView('list')}
        >
          <List size={15} aria-hidden />
          {t('admin.usersList')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'heatmap'}
          className={`admin-tab${view === 'heatmap' ? ' is-on' : ''}`}
          onClick={() => setView('heatmap')}
        >
          <Map size={15} aria-hidden />
          {t('admin.usersMap')}
        </button>
      </div>

      <div className="admin-toolbar">
        {view === 'list' ? (
          <>
            <div className="admin-search"><Search size={16} /><input placeholder={t('admin.usersSearchPh')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{t('admin.usersAllRoles')}</option>
              {USER_ROLES.map((r) => <option key={r} value={r}>{tr(USER_ROLE_LABELS[r])}</option>)}
            </select>
          </>
        ) : null}
        <select
          className="admin-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'all')}
          aria-label={t('admin.usersAccountStatus')}
        >
          <option value="active">{tr('فقط فعال')}</option>
          <option value="inactive">{t('admin.usersInactive')}</option>
          <option value="all">{tr('همه')}</option>
        </select>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            if (view === 'list') void load();
            else void loadGeo();
          }}
        >
          {tr('اعمال')}
        </button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}

      {view === 'heatmap' ? (
      <article className="admin-card users-geo-heat-card">
        <div className="admin-card-head">
          <div>
            <h2>{t('admin.usersHeatmapTitle')}</h2>
            <p className="admin-muted">
              {tr('استان‌هایی با کاربر بیشتر تیره‌تر نمایش داده می‌شوند')}
              {geoTotal
                ? ` · کاربر فعال ${formatNumFa(geoTotal)} · با استان مشخص ${formatNumFa(geoKnown)}${
                    geoUnknown > 0 ? `${tr(' · بدون استان ')}${formatNumFa(geoUnknown)}` : ''
                  }`
                : ''}
            </p>
          </div>
        </div>
        {geoError ? <p className="admin-error">{geoError}</p> : null}
        <IranProvinceHeatmap
          rows={geoRows}
          unknownCount={geoUnknown}
          copy={USERS_HEATMAP_COPY}
        />
      </article>
      ) : (
      <div className="admin-table-wrap admin-card admin-table-wrap--users">
        <table className="admin-table admin-table--dense admin-table--users">
          <thead>
            <tr>
              <th>{t('admin.colId')}</th>
              <th>{t('admin.colUser')}</th>
              <th>{t('admin.colPets')}</th>
              <th>{t('admin.colContact')}</th>
              <th>{t('admin.colRole')}</th>
              <th>{t('admin.colWallet')}</th>
              <th>{t('admin.colStatus')}</th>
              <th>{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const publicId = userPublicIdOf(u);
              const roles = activeRolesOf(u);
              const demo = adminUserDemographics(u);
              const place = [u.city, u.province].filter(Boolean).join(tr('، '));
              const displayName = String(u.name || '').trim() || '—';
              const inviteBits = [
                u.invitedCount != null && u.invitedCount > 0
                  ? `${tr('دعوت')}: ${formatNumFa(u.invitedCount)}`
                  : null,
                u.referredBy != null ? `${tr('معرف')} #${u.referredBy}` : null,
              ].filter(Boolean);
              const metaParts = [...inviteBits, demo, place || null].filter(Boolean);
              return (
                <tr key={u.id}>
                  <td>
                    <AdminIdChip publicId={publicId} />
                  </td>
                  <td>
                    <AdminEntityCell
                      thumb={<AdminThumb src={u.avatarUrl} gender={u.gender} label={displayName} kind="user" alt={displayName} size={32} />}
                      title={<strong>{displayName}</strong>}
                      subtitle={
                        metaParts.length ? (
                          <span className="admin-user-row-meta" title={metaParts.join(' · ')}>
                            {metaParts.join(' · ')}
                          </span>
                        ) : (
                          <span className="admin-muted">—</span>
                        )
                      }
                    />
                  </td>
                  <td>
                    <AdminPetsCell pets={u.pets} />
                  </td>
                  <td>
                    <AdminContactCell
                      phone={u.phone}
                      email={u.email}
                      username={u.username}
                      telegramId={u.telegramId}
                    />
                  </td>
                  <td>
                    <div className="admin-user-role-cell">
                      {roles.length > 1 ? (
                        <div className="admin-role-badges admin-role-badges--tight">
                          {roles
                            .filter((r) => r !== u.role)
                            .map((r) => (
                              <span key={r} className="admin-badge">
                                {tr(USER_ROLE_LABELS[r] || r)}
                              </span>
                            ))}
                        </div>
                      ) : null}
                      <select
                        className="admin-select admin-select--compact"
                        value={u.role || ''}
                        disabled={busyId === u.id}
                        aria-label={t('admin.primaryRole')}
                        onChange={(e) => void setPrimaryRole(u, e.target.value as UserRole)}
                      >
                        {USER_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {tr(USER_ROLE_LABELS[r])}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <AdminWalletCell
                      compact
                      coins={u.coins}
                      toman={u.walletToman}
                      stars={u.walletStars}
                      ton={u.walletTon}
                      onOpenCredit={
                        isDeletedUserShell(u)
                          ? undefined
                          : () => setCredit({ userId: u.id, amount: '10000', currency: 'toman' })
                      }
                    />
                  </td>
                  <td>
                    <div className="admin-cell-compact admin-user-status-cell">
                      <span className={adminVerifyClass(u.verificationStatus)}>
                        {adminVerifyLabel(u.verificationStatus)}
                      </span>
                      <span
                        className={`admin-badge ${
                          u.isActive === false ? 'admin-badge--error' : 'admin-badge--info'
                        }`}
                      >
                        {userStatusLabel(u)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-row-actions admin-row-actions--icon">
                      {!isDeletedUserShell(u) ? (
                        <button
                          type="button"
                          className="admin-icon-btn"
                          disabled={busyId === u.id}
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                          onClick={() => openEdit(u)}
                        >
                          <Pencil size={14} />
                        </button>
                      ) : null}
                      {!isDeletedUserShell(u) ? (
                        <button
                          type="button"
                          className={`admin-icon-btn ${
                            u.isActive === false ? 'admin-icon-btn--ok' : 'admin-icon-btn--danger'
                          }`}
                          disabled={busyId === u.id}
                          title={u.isActive === false ? tr('رفع مسدودی') : tr('مسدود')}
                          aria-label={u.isActive === false ? tr('رفع مسدودی') : tr('مسدود')}
                          onClick={() => void toggleBan(u)}
                        >
                          {u.isActive === false ? <ShieldCheck size={14} /> : <Ban size={14} />}
                        </button>
                      ) : null}
                      {canManageUsers && !isDeletedUserShell(u) ? (
                        <button
                          type="button"
                          className="admin-icon-btn admin-icon-btn--danger"
                          disabled={busyId === u.id}
                          title={t('admin.deleteUser')}
                          aria-label={t('admin.deleteUser')}
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                      {isDeletedUserShell(u) ? (
                        <span className="admin-muted">{tr('پوسته ناشناس')}</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!users.length ? <tr><td colSpan={8} className="admin-muted">{tr('کاربری یافت نشد')}</td></tr> : null}
          </tbody>
        </table>
      </div>
      )}

      <AdminModal
        open={Boolean(editing && editForm)}
        title={editing ? `${tr('ویرایش ')}${editing.name || userPublicIdOf(editing)}` : tr('ویرایش کاربر')}
        onClose={closeEdit}
        size="xl"
        as="form"
        onSubmit={(e) => void saveEdit(e)}
        busy={editBusy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={editBusy}>
              {tr('ذخیره تغییرات')}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={editBusy} onClick={closeEdit}>
              {tr('انصراف')}
            </button>
          </>
        }
      >
        {editForm && editing ? (
          <>
            {editError ? <p className="admin-error">{editError}</p> : null}
            <p className="admin-muted" dir="ltr" style={{ marginTop: 0 }}>
              {userPublicIdOf(editing)}
              {editing.telegramId ? ` · tg:${editing.telegramId}` : ''}
            </p>

            <div className="admin-form-grid">
              <div className="form-group">
                <label className="form-label">{tr('نام *')}</label>
                <input
                  className="form-input"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('تلگرام (یوزرنیم)')}</label>
                <input
                  className="form-input"
                  dir="ltr"
                  placeholder="@username"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('موبایل')}</label>
                <input
                  className="form-input"
                  dir="ltr"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('ایمیل')}</label>
                <input
                  className="form-input"
                  dir="ltr"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('شهر')}</label>
                <input
                  className="form-input"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('استان')}</label>
                <input
                  className="form-input"
                  value={editForm.province}
                  onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('کشور')}</label>
                <input
                  className="form-input"
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('سن')}</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={editForm.age}
                  onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('جنسیت')}</label>
                <select
                  className="form-select"
                  value={editForm.gender}
                  onChange={(e) =>
                    setEditForm({ ...editForm, gender: e.target.value as '' | UserGender })
                  }
                >
                  <option value="">—</option>
                  <option value="female">{tr('زن')}</option>
                  <option value="male">{tr('مرد')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('احراز هویت')}</label>
                <select
                  className="form-select"
                  value={editForm.verificationStatus}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      verificationStatus: e.target.value as VerificationStatus,
                    })
                  }
                >
                  {VERIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {tr(VERIFICATION_STATUS_LABELS[s])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('وضعیت حساب')}</label>
                <select
                  className="form-select"
                  value={editForm.isActive ? 'active' : 'blocked'}
                  onChange={(e) =>
                    setEditForm({ ...editForm, isActive: e.target.value === 'active' })
                  }
                >
                  <option value="active">{tr('فعال')}</option>
                  <option value="blocked">{tr('مسدود')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('نقش اصلی')}</label>
                <select
                  className="form-select"
                  value={editForm.role}
                  onChange={(e) => {
                    const next = e.target.value as UserRole;
                    const roles = editForm.roles.includes(next)
                      ? editForm.roles
                      : [...editForm.roles, next];
                    setEditForm({ ...editForm, role: next, roles });
                  }}
                >
                  {editForm.roles.map((r) => (
                    <option key={r} value={r}>
                      {tr(USER_ROLE_LABELS[r])}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group admin-form-full">
                <span className="form-label">{tr('نقش‌ها')}</span>
                <div className="admin-check-grid" style={{ marginTop: 6 }}>
                  {USER_ROLES.map((r) => (
                    <label key={r} className="admin-check-inline">
                      <input
                        type="checkbox"
                        checked={editForm.roles.includes(r)}
                        onChange={() => toggleEditRole(r)}
                      />
                      {tr(USER_ROLE_LABELS[r])}
                    </label>
                  ))}
                </div>
                <p className="admin-muted" style={{ marginTop: 8 }}>
                  {tr('مشورت با صاحبین:')}{' '}
                  {editing?.acceptSeekerAdvice ? tr('پذیرش روشن') : tr('پذیرش خاموش')}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">{tr('سکه')}</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={editForm.coins}
                  onChange={(e) => setEditForm({ ...editForm, coins: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('تومان')}</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={editForm.toman}
                  onChange={(e) => setEditForm({ ...editForm, toman: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('ستاره')}</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={editForm.stars}
                  onChange={(e) => setEditForm({ ...editForm, stars: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{tr('تون')}</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={editForm.ton}
                  onChange={(e) => setEditForm({ ...editForm, ton: e.target.value })}
                />
              </div>
              <div className="form-group admin-form-full">
                <label className="form-label">{tr('بیو')}</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                />
              </div>
            </div>
          </>
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(deleting)}
        title={tr("حذف کاربر")}
        onClose={() => {
          if (deleteBusy) return;
          setDeleting(null);
        }}
        size="sm"
        busy={deleteBusy}
        footer={
          <>
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteUser()}
            >
              {tr('تأیید حذف')}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              {tr('انصراف')}
            </button>
          </>
        }
      >
        {deleting ? (
          <>
            <p style={{ marginTop: 0 }}>
              {tr('آیا از حذف کاربر «')}{deleting.name || userPublicIdOf(deleting)}{tr('» مطمئن هستید؟')}
            </p>
            <p className="admin-muted" dir="ltr">
              {userPublicIdOf(deleting)}
              {deleting.telegramId ? ` · tg:${deleting.telegramId}` : ''}
            </p>
            <p className="admin-error" role="alert">
              {tr(`هشدار: حساب غیرفعال و ناشناس می‌شود، ورود مسدود می‌گردد، پت‌ها و نشست‌ها پاک می‌شوند،
              اما تاریخچه مالی/کیف‌پول برای گزارش‌ها حفظ می‌ماند. این کار برگشت‌پذیر نیست.`)}
            </p>
          </>
        ) : null}
      </AdminModal>

      <AdminModal
        open={Boolean(credit)}
        title={tr("واریز / برداشت کیف پول")}
        onClose={() => setCredit(null)}
        size="sm"
        footer={
          <>
            <button type="button" className="admin-btn admin-btn--primary" onClick={() => void submitCredit()}>{tr('اعمال')}</button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setCredit(null)}>{tr('انصراف')}</button>
          </>
        }
      >
        {credit ? (
          <>
            <p className="admin-muted" dir="ltr" style={{ marginTop: 0 }}>
              {userPublicIdOf({ id: credit.userId })}
            </p>
            <label>
              <span className="form-label">{tr('ارز')}</span>
              <select className="admin-select" value={credit.currency} onChange={(e) => setCredit({ ...credit, currency: e.target.value })}>
                <option value="toman">{tr('تومان')}</option><option value="coins">{tr('سکه')}</option><option value="stars">Stars</option><option value="ton">TON</option>
              </select>
            </label>
            <label>
              <span className="form-label">{tr('مبلغ')}</span>
              <input className="form-input" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} />
            </label>
          </>
        ) : null}
      </AdminModal>
    </div>
  );
}
