import { useCallback, useEffect, useState } from 'react';
import type { AdminAccount, AdminRoleDef } from '@petdate/shared';
import { ADMIN_PANEL_ROLE_LABELS } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { getAdminRole } from '../../auth';

export function AdminHrRbacPage() {
  const [roles, setRoles] = useState<AdminRoleDef[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const currentRole = getAdminRole();

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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>نقش‌ها و دسترسی</h1>
          <p>
            نقش فعلی شما:{' '}
            <b>
              {ADMIN_PANEL_ROLE_LABELS[currentRole as keyof typeof ADMIN_PANEL_ROLE_LABELS] ||
                currentRole}
            </b>{' '}
            · قابل گسترش بدون بازنویسی
          </p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>نقش‌های پنل ({formatNumFa(roles.length)})</h2>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>کلید</th>
                <th>نام</th>
                <th>شرح</th>
                <th>مجوزها</th>
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
                        پشتیبانی
                      </span>
                    ) : null}
                  </td>
                  <td>{r.description}</td>
                  <td>
                    <code className="admin-mono" style={{ fontSize: 11 }}>
                      {r.permissions.join(', ') || '—'}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-muted" style={{ marginTop: 12 }}>
          مدیر کامل با <code>ADMIN_PASSWORD</code> وارد می‌شود. نقش پشتیبانی با{' '}
          <code>ADMIN_SUPPORT_PASSWORD</code> یا حساب در <code>admin_accounts</code>. افزودن نقش
          جدید = ردیف در <code>admin_roles</code> + claim در session.
        </p>
      </section>

      <section className="admin-card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>
          حساب‌های پنل ({formatNumFa(accounts.length)})
        </h2>
        {accounts.length === 0 ? (
          <p className="admin-muted">
            هنوز حسابی در دیتابیس نیست — ورود env کافی است. برای ساخت حساب پشتیبانی،{' '}
            <code>ADMIN_SUPPORT_PASSWORD</code> را ست کنید تا در استارتاپ ساخته شود.
          </p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>کاربری</th>
                  <th>نام نمایشی</th>
                  <th>نقش</th>
                  <th>فعال</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="admin-mono">{a.username}</td>
                    <td>{a.displayName}</td>
                    <td>{a.roleKey}</td>
                    <td>{a.isActive ? 'بله' : 'خیر'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
