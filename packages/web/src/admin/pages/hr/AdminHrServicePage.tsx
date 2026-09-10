import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HrEmployee, HrServiceEntry } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

export function AdminHrServicePage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<HrServiceEntry[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        adminFetch<{ entries: HrServiceEntry[] }>(`/api/admin/hr/service?year=${year}&month=${month}`),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
      ]);
      setEntries(s.entries); setEmployees(e.employees); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [year, month]);
  useEffect(() => { void load(); }, [load]);
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : `#${id}`; };
  const totalHours = entries.reduce((s, e) => s + e.hours + e.minutes / 60, 0);

  const add = async () => {
    if (!canWrite || !employees.length) return;
    const employeeId = Number(window.prompt(`شناسه همکار (مثلاً ${employees[0].id})`));
    if (!Number.isFinite(employeeId)) return;
    const hours = Number(window.prompt('ساعت', '8') || 0);
    const note = window.prompt('یادداشت') || '';
    try {
      await adminFetch('/api/admin/hr/service', { method: 'POST', body: JSON.stringify({ employeeId, year, month, hours, minutes: 0, note }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>ارائه خدمات</h1><p>ثبت ساعت فعالیت — بدون بیزنس‌لاین</p></div>
        <div className="admin-header-actions">
          <input type="number" className="admin-input" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input type="number" className="admin-input" style={{ width: 70 }} min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          {canWrite ? <button type="button" className="admin-btn" onClick={() => void add()}>+ ثبت ساعت</button> : null}
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-muted">جمع ماه: {formatNumFa(Math.round(totalHours * 10) / 10)} ساعت</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>همکار</th><th>روز</th><th>ساعت</th><th>یادداشت</th><th></th></tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{empName(e.employeeId)}</td>
                <td>{formatNumFa(e.day)}</td>
                <td>{formatNumFa(e.hours)}:{formatNumFa(e.minutes)}</td>
                <td>{e.note || '—'}</td>
                <td>{canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/service/${e.id}`, { method: 'DELETE' }).then(load)}>حذف</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
