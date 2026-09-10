import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { HrEmployee, HrRequest } from '@petdate/shared';
import { HR_REQUEST_TYPES, nextRequestStatus } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

type Balance = { employeeId: number; name: string; personnelCode: string; annual: number; used: number; remaining: number };

export function AdminHrRequestsPage() {
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'مرخصی', days: '1' });
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

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !employees.length) return;
    const employeeId = Number(form.employeeId || employees[0].id);
    if (!Number.isFinite(employeeId)) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/requests', {
        method: 'POST',
        body: JSON.stringify({ employeeId, type: form.type, days: Number(form.days) || 0 }),
      });
      setOpen(false);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>درخواست‌های کارکنان</h1><p>گردش‌کار خطی · مانده مرخصی سالانه ۲۶ روز</p></div>
        {canWrite ? <button type="button" className="admin-btn" onClick={() => {
          setForm({ employeeId: employees[0] ? String(employees[0].id) : '', type: 'مرخصی', days: '1' });
          setOpen(true);
        }}>+ درخواست</button> : null}
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

      <AdminModal open={open} title="درخواست جدید" onClose={() => setOpen(false)} as="form" onSubmit={(e) => void create(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button><button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></>}>
        <label>
          <span className="form-label">همکار</span>
          <select className="form-input" required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            {employees.map((em) => <option key={em.id} value={String(em.id)}>{em.firstName} {em.lastName}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">نوع</span>
          <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {HR_REQUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">تعداد روز</span>
          <input className="form-input" dir="ltr" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
        </label>
      </AdminModal>
    </div>
  );
}
