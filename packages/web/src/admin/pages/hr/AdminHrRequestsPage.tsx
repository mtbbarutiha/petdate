import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { HrEmployee, HrRequest } from '@petdate/shared';
import { HR_REQUEST_TYPES, nextRequestStatus } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDate } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { appPrompt } from '../../../components/AppDialog';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { tr } from '../../../i18n';

type Balance = {
  employeeId: number;
  name: string;
  personnelCode: string;
  annual: number;
  used: number;
  remaining: number;
};

function ticketRange(r: HrRequest): string {
  if (r.fromDate || r.toDate) {
    return `${formatAdminFaDate(r.fromDate) || '—'} ← ${formatAdminFaDate(r.toDate) || '—'}`;
  }
  if (r.days) return `${formatNumFa(r.days)}${tr(' روز')}`;
  return formatAdminFaDate(r.createdAt);
}

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
      setRequests(r.requests);
      setEmployees(e.employees);
      setBalances(b.balances);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const empOf = (id: number) => employees.find((x) => x.id === id);
  const empName = (id: number) => {
    const e = empOf(id);
    return e ? `${e.firstName} ${e.lastName}` : `#${id}`;
  };

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, body?: Record<string, unknown>) => {
    try {
      await adminFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('تیکت‌های منابع انسانی')}</h1>
          <p>{tr('گردش‌کار خطی · مانده مرخصی سالانه ۲۶ روز')}</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setForm({
                employeeId: employees[0] ? String(employees[0].id) : '',
                type: 'مرخصی',
                days: '1',
              });
              setOpen(true);
            }}
          >
            {tr('+ تیکت')}
          </button>
        ) : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('همکار')}</th>
              <th>{tr('نوع')}</th>
              <th>{tr('بازه / تاریخ')}</th>
              <th>{tr('وضعیت')}</th>
              <th>{tr('نتیجه')}</th>
              <th>{tr('عملیات')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  {tr('تیکتی نیست')}
                </td>
              </tr>
            ) : (
              requests.map((r) => {
                const emp = empOf(r.employeeId);
                const name = empName(r.employeeId);
                return (
                  <tr key={r.id}>
                    <td>
                      <AdminEntityCell
                        thumb={<AdminThumb src={emp?.avatarUrl} label={name} kind="user" size={32} />}
                        title={name}
                      />
                    </td>
                    <td>{r.type}</td>
                    <td>{ticketRange(r)}</td>
                    <td>{r.status}</td>
                    <td>{r.result || '—'}</td>
                    <td>
                      {canWrite && nextRequestStatus(r.status) ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => void act(`/api/admin/hr/requests/${r.id}/advance`)}
                        >
                          {tr('مرحله بعد')}
                        </button>
                      ) : null}{' '}
                      {canWrite && [tr('ثبت‌شده'), tr('بررسی مدیر'), tr('بررسی HR')].includes(r.status) ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => void act(`/api/admin/hr/requests/${r.id}/reject`)}
                        >
                          {tr('رد')}
                        </button>
                      ) : null}{' '}
                      {canWrite && r.status !== 'تایید شده' && r.status !== 'رد شده' && r.status !== 'لغو شده' ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => {
                            void (async () => {
                              const result = await appPrompt(tr('نتیجه تیکت'), {
                                defaultValue: r.result || 'انجام شد',
                                optional: false,
                                variant: 'admin',
                              });
                              if (!result?.trim()) return;
                              void act(`/api/admin/hr/requests/${r.id}/resolve`, { result: result.trim() });
                            })();
                          }}
                        >
                          {tr('ثبت نتیجه')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{tr('مانده مرخصی')}</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{tr('کد')}</th>
                <th>{tr('نام')}</th>
                <th>{tr('سقف')}</th>
                <th>{tr('مصرف')}</th>
                <th>{tr('مانده')}</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const emp = empOf(b.employeeId);
                return (
                  <tr key={b.employeeId}>
                    <td>{b.personnelCode}</td>
                    <td>
                      <AdminEntityCell
                        thumb={<AdminThumb src={emp?.avatarUrl} label={b.name} kind="user" size={28} />}
                        title={b.name}
                      />
                    </td>
                    <td>{formatNumFa(b.annual)}</td>
                    <td>{formatNumFa(b.used)}</td>
                    <td>{formatNumFa(b.remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AdminModal
        open={open}
        title={tr("تیکت جدید")}
        onClose={() => setOpen(false)}
        as="form"
        onSubmit={(e) => void create(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              {tr('ذخیره')}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {tr('انصراف')}
            </button>
          </>
        }
      >
        <label>
          <span className="form-label">{tr('همکار')}</span>
          <select
            className="form-input"
            required
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            {employees.map((em) => (
              <option key={em.id} value={String(em.id)}>
                {em.firstName} {em.lastName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">{tr('نوع')}</span>
          <select
            className="form-input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {HR_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">{tr('تعداد روز')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
          />
        </label>
      </AdminModal>
    </div>
  );
}
