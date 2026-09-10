import { useCallback, useEffect, useState } from 'react';
import type { HrEmployee, HrRequest } from '@petdate/shared';
import { HR_REQUEST_TYPES, nextRequestStatus } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

type Balance = { employeeId: number; name: string; personnelCode: string; annual: number; used: number; remaining: number };

export function AdminHrRequestsPage() {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const [r, e, b] = await Promise.all([
        adminFetch<{ requests: HrRequest[] }>('/api/admin/hr/requests'),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
        adminFetch<{ balances: Balance[] }>('/api/admin/hr/leave-balances'),
      ]);
      setRequests(r.requests); setEmployees(e.employees); setBalances(b.balances); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : `#${id}`; };

  const create = async () => {
    if (!canWrite || !employees.length) return;
    const employeeId = Number(window.prompt(`شناسه همکار (مثلاً ${employees[0].id})`));
    if (!Number.isFinite(employeeId)) return;
    const type = window.prompt(`نوع (${HR_REQUEST_TYPES.slice(0, 3).join(' / ')}…)`, 'مرخصی');
    if (!type) return;
    const days = Number(window.prompt('تعداد روز', '1') || 0);
    try {
      await adminFetch('/api/admin/hr/requests', { method: 'POST', body: JSON.stringify({ employeeId, type, days }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>درخواست‌های کارکنان</h1><p>گردش‌کار خطی · مانده مرخصی سالانه ۲۶ روز</p></div>
        {canWrite ? <button type="button" className="admin-btn" onClick={() => void create()}>+ درخواست</button> : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>همکار</th><th>نوع</th><th>روز</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{empName(r.employeeId)}</td><td>{r.type}</td><td>{formatNumFa(r.days)}</td><td>{r.status}</td>
                <td>
                  {canWrite && nextRequestStatus(r.status) ? (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/requests/${r.id}/advance`, { method: 'POST', body: '{}' }).then(load).catch((e) => setError(String(e)))}>مرحله بعد</button>
                  ) : null}{' '}
                  {canWrite && ['ثبت‌شده', 'بررسی مدیر', 'بررسی HR'].includes(r.status) ? (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/requests/${r.id}/reject`, { method: 'POST', body: '{}' }).then(load)}>رد</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>مانده مرخصی</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>کد</th><th>نام</th><th>سقف</th><th>مصرف</th><th>مانده</th></tr></thead>
            <tbody>{balances.map((b) => (
              <tr key={b.employeeId}><td>{b.personnelCode}</td><td>{b.name}</td><td>{formatNumFa(b.annual)}</td><td>{formatNumFa(b.used)}</td><td>{formatNumFa(b.remaining)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
