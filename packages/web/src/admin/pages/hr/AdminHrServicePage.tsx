import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { HrEmployee, HrServiceEntry } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';

export function AdminHrServicePage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<HrServiceEntry[]>([]);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ employeeId: '', hours: '8', note: '' });
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
  const empOf = (id: number) => employees.find((x) => x.id === id);
  const empName = (id: number) => {
    const e = empOf(id);
    return e ? `${e.firstName} ${e.lastName}` : `#${id}`;
  };
  const totalHours = entries.reduce((s, e) => s + e.hours + e.minutes / 60, 0);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !employees.length) return;
    const employeeId = Number(form.employeeId || employees[0].id);
    if (!Number.isFinite(employeeId)) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/service', {
        method: 'POST',
        body: JSON.stringify({ employeeId, year, month, hours: Number(form.hours) || 0, minutes: 0, note: form.note }),
      });
      setOpen(false);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>ارائه خدمات</h1><p>ثبت ساعت فعالیت — بدون بیزنس‌لاین</p></div>
        <div className="admin-header-actions">
          <input type="number" className="admin-input" style={{ width: 90 }} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <input type="number" className="admin-input" style={{ width: 70 }} min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          {canWrite ? <button type="button" className="admin-btn" onClick={() => {
            setForm({ employeeId: employees[0] ? String(employees[0].id) : '', hours: '8', note: '' });
            setOpen(true);
          }}>+ ثبت ساعت</button> : null}
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-muted">جمع ماه: {formatNumFa(Math.round(totalHours * 10) / 10)} ساعت</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>همکار</th><th>روز</th><th>ساعت</th><th>یادداشت</th><th></th></tr></thead>
          <tbody>
            {entries.map((e) => {
              const emp = empOf(e.employeeId);
              const name = empName(e.employeeId);
              return (
                <tr key={e.id}>
                  <td>
                    <AdminEntityCell
                      thumb={<AdminThumb src={emp?.avatarUrl} label={name} kind="user" size={32} />}
                      title={name}
                    />
                  </td>
                  <td>{formatNumFa(e.day)}</td>
                  <td>{formatNumFa(e.hours)}:{formatNumFa(e.minutes)}</td>
                  <td>{e.note || '—'}</td>
                  <td>{canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/service/${e.id}`, { method: 'DELETE' }).then(load)}>حذف</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AdminModal open={open} title="ثبت ساعت" onClose={() => setOpen(false)} as="form" onSubmit={(e) => void add(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button><button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></>}>
        <label>
          <span className="form-label">همکار</span>
          <select className="form-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
            {employees.map((em) => <option key={em.id} value={String(em.id)}>{em.firstName} {em.lastName}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">ساعت</span>
          <input className="form-input" dir="ltr" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
        </label>
        <label>
          <span className="form-label">یادداشت</span>
          <input className="form-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
      </AdminModal>
    </div>
  );
}
