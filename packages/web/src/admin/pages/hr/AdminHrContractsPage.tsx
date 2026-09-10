import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HrContract, HrEmployee } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';

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

  const nameOf = (id: number) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : `#${id}`;
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>قراردادها</h1>
          <p>{formatNumFa(contracts.length)} قرارداد · نسخه‌بندی بدون بازنویسی</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>کد</th>
              <th>همکار</th>
              <th>شروع</th>
              <th>پایان</th>
              <th>حقوق</th>
              <th>عیدی</th>
              <th>سنوات</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty">
                  قراردادی ثبت نشده — از پرونده همکار اضافه کنید
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id}>
                  <td className="admin-mono">{c.contractCode}</td>
                  <td>
                    <Link to={`/admin/hr/employees/${c.employeeId}`} className="admin-link">
                      {nameOf(c.employeeId)}
                    </Link>
                  </td>
                  <td>{c.startDate || '—'}</td>
                  <td>{c.endDate || 'باز'}</td>
                  <td>{formatNumFa(c.salary)}</td>
                  <td>{formatNumFa(c.eidi)}</td>
                  <td>{formatNumFa(c.sanavat)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
