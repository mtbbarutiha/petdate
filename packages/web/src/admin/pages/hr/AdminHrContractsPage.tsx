import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HrContract, HrEmployee } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { tr } from '../../../i18n';

export function AdminHrContractsPage() {
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        adminFetch<{ contracts: HrContract[] }>('/api/admin/hr/contracts'),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=500'),
      ]);
      setContracts(c.contracts);
      setEmployees(e.employees);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empOf = (id: number) => employees.find((x) => x.id === id);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('قراردادها')}</h1>
          <p>{formatNumFa(contracts.length)} {tr('قرارداد · نسخه‌بندی بدون بازنویسی')}</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>{tr('کد')}</th>
              <th>{tr('همکار')}</th>
              <th>{tr('شروع')}</th>
              <th>{tr('پایان')}</th>
              <th>{tr('حقوق')}</th>
              <th>{tr('عیدی')}</th>
              <th>{tr('سنوات')}</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty">
                  {tr('قراردادی ثبت نشده — از پرونده همکار اضافه کنید')}
                </td>
              </tr>
            ) : (
              contracts.map((c) => {
                const e = empOf(c.employeeId);
                const name = e ? `${e.firstName} ${e.lastName}` : `#${c.employeeId}`;
                return (
                  <tr key={c.id}>
                    <td className="admin-mono">{c.contractCode}</td>
                    <td>
                      <AdminEntityCell
                        thumb={<AdminThumb src={e?.avatarUrl} label={name} kind="user" size={32} />}
                        title={
                          <Link to={`/admin/hr/employees/${c.employeeId}`} className="admin-link">
                            {name}
                          </Link>
                        }
                      />
                    </td>
                    <td>{c.startDate || '—'}</td>
                    <td>{c.endDate || tr('باز')}</td>
                    <td>{formatNumFa(c.salary)}</td>
                    <td>{formatNumFa(c.eidi)}</td>
                    <td>{formatNumFa(c.sanavat)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
