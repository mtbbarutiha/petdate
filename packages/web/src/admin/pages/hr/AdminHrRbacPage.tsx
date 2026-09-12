import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminAccount, AdminPermission, AdminRoleDef } from '@petdate/shared';
import {
  ADMIN_PANEL_ROLE_LABELS,
  ADMIN_PERMISSION_ACTION_LABELS,
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_PERMISSION_MODULES,
  ADMIN_PERMISSIONS,
  ADMIN_SYSTEM_ROLE_KEYS,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan, getAdminRole } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { appConfirm } from '../../../components/AppDialog';
import { tr } from '../../../i18n';

type RoleForm = {
  id?: number;
  key: string;
  nameFa: string;
  description: string;
  permissions: AdminPermission[];
  isActive: boolean;
};

type AccountForm = {
  id?: number;
  username: string;
  password: string;
  roleKey: string;
  displayName: string;
  isActive: boolean;
};

const emptyRole = (): RoleForm => ({
  key: '',
  nameFa: '',
  description: '',
  permissions: ['hr.read'],
  isActive: true,
});

const emptyAccount = (defaultRole = 'support'): AccountForm => ({
  username: '',
  password: '',
  roleKey: defaultRole,
  displayName: '',
  isActive: true,
});

export function AdminHrRbacPage() {
  const [roles, setRoles] = useState<AdminRoleDef[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm | null>(null);
  const currentRole = getAdminRole();
  const canMutate = adminCan('admin.full');

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ roles: AdminRoleDef[]; accounts: AdminAccount[] }>(
        '/api/admin/hr/rbac/roles'
      );
      setRoles(data.roles);
      setAccounts(data.accounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive), [roles]);

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm || !canMutate) return;
    setBusy(true);
    setError(null);
    try {
      if (roleForm.id) {
        await adminFetch(`/api/admin/hr/rbac/roles/${roleForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nameFa: roleForm.nameFa,
            description: roleForm.description,
            permissions: roleForm.permissions,
            isActive: roleForm.isActive,
          }),
        });
      } else {
        await adminFetch('/api/admin/hr/rbac/roles', {
          method: 'POST',
          body: JSON.stringify({
            key: roleForm.key,
            nameFa: roleForm.nameFa,
            description: roleForm.description,
            permissions: roleForm.permissions,
          }),
        });
      }
      setRoleForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const removeRole = async (role: AdminRoleDef) => {
    if (!canMutate) return;
    if ((ADMIN_SYSTEM_ROLE_KEYS as readonly string[]).includes(role.key)) {
      setError(tr('نقش سیستم را نمی‌توان حذف کرد'));
      return;
    }
    if (!(await appConfirm(`${tr('حذف یا غیرفعال‌سازی نقش «')}${role.nameFa}${tr('»؟')}`, { danger: true, variant: 'admin' }))) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/hr/rbac/roles/${role.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm || !canMutate) return;
    setBusy(true);
    setError(null);
    try {
      if (accountForm.id) {
        await adminFetch(`/api/admin/hr/rbac/accounts/${accountForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            roleKey: accountForm.roleKey,
            displayName: accountForm.displayName,
            isActive: accountForm.isActive,
            ...(accountForm.password.trim() ? { password: accountForm.password } : {}),
          }),
        });
      } else {
        await adminFetch('/api/admin/hr/rbac/accounts', {
          method: 'POST',
          body: JSON.stringify({
            username: accountForm.username,
            password: accountForm.password,
            roleKey: accountForm.roleKey,
            displayName: accountForm.displayName,
            isActive: accountForm.isActive,
          }),
        });
      }
      setAccountForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async (account: AdminAccount) => {
    if (!canMutate) return;
    if (!(await appConfirm(`${tr('حذف حساب «')}${account.username}${tr('»؟')}`, { danger: true, variant: 'admin' }))) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/hr/rbac/accounts/${account.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const togglePerm = (key: AdminPermission) => {
    if (!roleForm) return;
    const has = roleForm.permissions.includes(key);
    setRoleForm({
      ...roleForm,
      permissions: has
        ? roleForm.permissions.filter((p) => p !== key)
        : [...roleForm.permissions, key],
    });
  };

  const hasFullAdmin = Boolean(roleForm?.permissions.includes('admin.full'));

  const compactPermLabel = (p: string) => {
    const known = ADMIN_PERMISSION_LABELS[p as AdminPermission];
    if (!known) return p;
    if (p === 'admin.full') return known;
    const mod = ADMIN_PERMISSION_MODULES.find(
      (m) => m.view === p || m.edit === p || m.create === p
    );
    if (!mod) return known;
    if (mod.view === p) return `${mod.labelFa}${tr(' · دیدن')}`;
    if (mod.edit === p) return `${mod.labelFa}${tr(' · ویرایش')}`;
    return `${mod.labelFa}${tr(' · ایجاد')}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('نقش‌ها و دسترسی')}</h1>
          <p>
            {tr('نقش فعلی شما:')}{' '}
            <b>
              {tr(ADMIN_PANEL_ROLE_LABELS[currentRole] || currentRole)}
            </b>{' '}
            {tr('· تعریف سطح دسترسی و حساب‌های پنل از همین صفحه')}
          </p>
        </div>
        {canMutate ? (
          <div className="admin-row-actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setRoleForm(emptyRole())}
            >
              {tr('نقش جدید')}
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() =>
                setAccountForm(emptyAccount(activeRoles[0]?.key || 'support'))
              }
            >
              {tr('حساب پنل جدید')}
            </button>
          </div>
        ) : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>
          {tr('نقش‌های پنل (')}{formatNumFa(roles.length)})
        </h2>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('کلید')}</th>
                <th>{tr('نام')}</th>
                <th>{tr('شرح')}</th>
                <th>{tr('مجوزها')}</th>
                <th>{tr('وضعیت')}</th>
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className="admin-mono">{r.key}</td>
                  <td>
                    <b>{r.nameFa}</b>
                    {r.key === 'support' ? (
                      <span className="admin-pill admin-pill--mint" style={{ marginInlineStart: 8 }}>
                        {tr('پشتیبانی')}
                      </span>
                    ) : null}
                  </td>
                  <td>{tr(r.description || '—')}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {r.permissions.length ? (
                        r.permissions.map((p) => (
                          <span key={p} className="admin-pill" title={p}>
                            {compactPermLabel(p)}
                          </span>
                        ))
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td>{r.isActive ? tr('فعال') : tr('غیرفعال')}</td>
                  {canMutate ? (
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          disabled={busy}
                          onClick={() =>
                            setRoleForm({
                              id: r.id,
                              key: r.key,
                              nameFa: r.nameFa,
                              description: r.description,
                              permissions: r.permissions.filter((p): p is AdminPermission =>
                                (ADMIN_PERMISSIONS as readonly string[]).includes(p)
                              ),
                              isActive: r.isActive,
                            })
                          }
                        >
                          {tr('ویرایش')}
                        </button>
                        {!(ADMIN_SYSTEM_ROLE_KEYS as readonly string[]).includes(r.key) ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={busy}
                            onClick={() => void removeRole(r)}
                          >
                            {tr('حذف')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!roles.length ? (
                <tr>
                  <td colSpan={canMutate ? 6 : 5} className="admin-muted">
                    {tr('نقشی ثبت نشده')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="admin-muted" style={{ marginTop: 12 }}>
          {tr('bootstrap مدیر کامل همچنان با')} <code>ADMIN_PASSWORD</code> {tr('کار می‌کند.')}
          <code>ADMIN_SUPPORT_PASSWORD</code> {tr(`فقط برای seed اختیاری حساب پشتیبانی است — بقیهٔ
          حساب‌ها را از همین صفحه بسازید.`)}
        </p>
      </section>

      <section className="admin-card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>
          {tr('حساب‌های پنل (')}{formatNumFa(accounts.length)})
        </h2>
        {accounts.length === 0 ? (
          <p className="admin-muted">
            {tr('هنوز حسابی در دیتابیس نیست. برای افزودن کاربر پشتیبانی / HR روی «حساب پنل جدید» بزنید.')}
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('کاربری')}</th>
                  <th>{tr('نام نمایشی')}</th>
                  <th>{tr('نقش')}</th>
                  <th>{tr('فعال')}</th>
                  {canMutate ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="admin-mono">{a.username}</td>
                    <td>{a.displayName}</td>
                    <td>
                      {tr(
                        ADMIN_PANEL_ROLE_LABELS[a.roleKey] ||
                          roles.find((r) => r.key === a.roleKey)?.nameFa ||
                          a.roleKey,
                      )}
                    </td>
                    <td>{a.isActive ? tr('بله') : tr('خیر')}</td>
                    {canMutate ? (
                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            disabled={busy}
                            onClick={() =>
                              setAccountForm({
                                id: a.id,
                                username: a.username,
                                password: '',
                                roleKey: a.roleKey,
                                displayName: a.displayName,
                                isActive: a.isActive,
                              })
                            }
                          >
                            {tr('ویرایش')}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={busy}
                            onClick={() => void removeAccount(a)}
                          >
                            {tr('حذف')}
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {roleForm ? (
        <AdminModal
          open
          title={roleForm.id ? tr('ویرایش نقش') : tr('نقش جدید')}
          onClose={() => !busy && setRoleForm(null)}
          size="full"
          as="form"
          onSubmit={(e) => void saveRole(e)}
          busy={busy}
          footer={
            <>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setRoleForm(null)}>{tr('انصراف')}</button>
            </>
          }
        >
            {!roleForm.id ? (
              <label>
                <span className="form-label">{tr('کلید (لاتین)')}</span>
                <input
                  className="form-input"
                  required
                  dir="ltr"
                  placeholder={tr("مثلاً content_ops")}
                  value={roleForm.key}
                  onChange={(e) => setRoleForm({ ...roleForm, key: e.target.value })}
                />
              </label>
            ) : (
              <p className="admin-muted">
                {tr('کلید:')} <code className="admin-mono">{roleForm.key}</code>
              </p>
            )}
            <label>
              <span className="form-label">{tr('نام فارسی')}</span>
              <input
                className="form-input"
                required
                value={roleForm.nameFa}
                onChange={(e) => setRoleForm({ ...roleForm, nameFa: e.target.value })}
              />
            </label>
            <label>
              <span className="form-label">{tr('شرح')}</span>
              <input
                className="form-input"
                value={tr(roleForm.description)}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              />
            </label>
            <fieldset style={{ border: 'none', padding: 0, margin: '12px 0' }}>
              <legend className="form-label">{tr('مجوزها')}</legend>
              <label className="admin-perm-master">
                <input
                  type="checkbox"
                  checked={hasFullAdmin}
                  onChange={() => togglePerm('admin.full')}
                />
                <span>
                  {tr(ADMIN_PERMISSION_LABELS['admin.full'])}
                  <span className="admin-muted" style={{ marginInlineStart: 6 }} dir="ltr">
                    admin.full
                  </span>
                </span>
              </label>
              <div className="admin-perm-matrix-wrap">
                <table className="admin-perm-matrix">
                  <thead>
                    <tr>
                      <th scope="col">{tr('ماژول')}</th>
                      {ADMIN_PERMISSION_ACTIONS.map((action) => (
                        <th key={action} scope="col">
                          {tr(ADMIN_PERMISSION_ACTION_LABELS[action])}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ADMIN_PERMISSION_MODULES.map((mod) => (
                      <tr key={mod.id}>
                        <th scope="row">
                          {mod.labelFa}
                          <span className="admin-muted" dir="ltr">
                            {mod.id}
                          </span>
                        </th>
                        {ADMIN_PERMISSION_ACTIONS.map((action) => {
                          const key = mod[action];
                          return (
                            <td key={action}>
                              <input
                                type="checkbox"
                                aria-label={`${mod.labelFa} — ${ADMIN_PERMISSION_ACTION_LABELS[action]}`}
                                title={key}
                                disabled={hasFullAdmin}
                                checked={hasFullAdmin || roleForm.permissions.includes(key)}
                                onChange={() => togglePerm(key)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="admin-hint admin-muted">
                {tr(`ستون‌ها: دیدن = خواندن، ویرایش = نوشتن، ایجاد = ساختن یا مدیریت سطح بالا
                (برای فروش و امور مشتریان همان کلید`)} <code dir="ltr">*.admin</code>).
              </p>
            </fieldset>
            {roleForm.id &&
            !(ADMIN_SYSTEM_ROLE_KEYS as readonly string[]).includes(roleForm.key) ? (
              <label className="admin-check-inline">
                <input
                  type="checkbox"
                  checked={roleForm.isActive}
                  onChange={(e) => setRoleForm({ ...roleForm, isActive: e.target.checked })}
                />
                <span>{tr('فعال')}</span>
              </label>
            ) : null}
        </AdminModal>
      ) : null}

      {accountForm ? (
        <AdminModal
          open
          title={accountForm.id ? tr('ویرایش حساب پنل') : tr('حساب پنل جدید')}
          onClose={() => !busy && setAccountForm(null)}
          size="md"
          as="form"
          onSubmit={(e) => void saveAccount(e)}
          busy={busy}
          footer={
            <>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setAccountForm(null)}>{tr('انصراف')}</button>
            </>
          }
        >
            {accountForm.id ? (
              <p className="admin-muted">
                {tr('کاربری:')} <code className="admin-mono">{accountForm.username}</code>
              </p>
            ) : (
              <label>
                <span className="form-label">{tr('نام کاربری')}</span>
                <input
                  className="form-input"
                  required
                  dir="ltr"
                  autoComplete="off"
                  value={accountForm.username}
                  onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                />
              </label>
            )}
            <label>
              <span className="form-label">{tr('نام نمایشی')}</span>
              <input
                className="form-input"
                value={accountForm.displayName}
                onChange={(e) => setAccountForm({ ...accountForm, displayName: e.target.value })}
              />
            </label>
            <label>
              <span className="form-label">
                {tr('رمز عبور')}{accountForm.id ? tr(' (خالی = بدون تغییر)') : ''}
              </span>
              <input
                className="form-input"
                type="password"
                dir="ltr"
                required={!accountForm.id}
                autoComplete="new-password"
                value={accountForm.password}
                onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
              />
            </label>
            <label>
              <span className="form-label">{tr('نقش')}</span>
              <select
                className="admin-select"
                value={accountForm.roleKey}
                onChange={(e) => setAccountForm({ ...accountForm, roleKey: e.target.value })}
              >
                {(accountForm.id
                  ? roles
                  : activeRoles.length
                    ? activeRoles
                    : roles
                ).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.nameFa} ({r.key})
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-check-inline" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={accountForm.isActive}
                onChange={(e) => setAccountForm({ ...accountForm, isActive: e.target.checked })}
              />
              <span>{tr('فعال')}</span>
            </label>
        </AdminModal>
      ) : null}
    </div>
  );
}
