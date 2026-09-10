import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HrEmployee } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { formatHrMoney } from './HrUi';

type CostRow = {
  employee: { id: number; publicId: string; personnelCode: string; name: string; jobTitle: string };
  cost: { salary: number; insurance: number; tax: number; bonus: number; commission: number; eidiMonthly: number; sanavatMonthly: number; total: number };
};

export function AdminHrCostPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        adminFetch<{ costs: CostRow[]; orgTotal: number }>(`/api/admin/hr/cost?year=${year}&month=${month}`),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
      ]);
      setCosts(c.costs); setOrgTotal(c.orgTotal); setEmployees(e.employees); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  const upsert = async () => {
    if (!canWrite || !employees.length) return;
    const employeeId = Number(window.prompt(`شناسه همکار (مثلاً ${employees[0].id})`));
    if (!Number.isFinite(employeeId)) return;
    const insurance = Number(window.prompt('بیمه', '0') || 0);
    const tax = Number(window.prompt('مالیات', '0') || 0);
    const bonus = Number(window.prompt('پاداش', '0') || 0);
    const sales = Number(window.prompt('فروش', '0') || 0);
    try {
      await adminFetch('/api/admin/hr/cost', { method: 'POST', body: JSON.stringify({ employeeId, year, month, insurance, tax, bonus, sales }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>تخصیص هزینه نیروی کار</h1><p>بدون تسهیم بیزنس‌لاین — قرارداد + مزایا + ورودی ماه</p></div>
        <div className="admin-header-actions">
          <input type="number" className="admin-input" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input type="number" className="admin-input" style={{ width: 70 }} min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          {canWrite ? <button type="button" className="admin-btn" onClick={() => void upsert()}>+ ورودی ماه</button> : null}
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <p>جمع سازمانی: <strong>{formatHrMoney(orgTotal)}</strong></p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>همکار</th><th>حقوق</th><th>بیمه</th><th>مالیات</th><th>کمیسیون</th><th>جمع</th></tr></thead>
          <tbody>
            {costs.map((row) => (
              <tr key={row.employee.id}>
                <td>{row.employee.name}<div className="admin-muted">{row.employee.personnelCode}</div></td>
                <td>{formatNumFa(row.cost.salary)}</td>
                <td>{formatNumFa(row.cost.insurance)}</td>
                <td>{formatNumFa(row.cost.tax)}</td>
                <td>{formatNumFa(row.cost.commission)}</td>
                <td><strong>{formatNumFa(row.cost.total)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
