import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { HrCareerLayer, HrContract, HrEmployee, HrIncomeModel } from '@petdate/shared';
import {
  HR_ACCESS_STATUSES,
  HR_CONTRACT_STATUSES,
  HR_COOPERATION_TYPES,
  HR_LOCATIONS,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminIdChip } from '../../AdminIds';

export function AdminHrEmployeeDetailPage() {
  const { id } = useParams();
  const empId = Number(id);
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'profile' | 'contracts' | 'logs'>('profile');
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    if (!Number.isFinite(empId)) return;
    try {
      const [empRes, layersRes, modelsRes] = await Promise.all([
        adminFetch<{ employee: HrEmployee }>(`/api/admin/hr/employees/${empId}`),
        adminFetch<{ careerLayers: HrCareerLayer[] }>('/api/admin/hr/settings/layers'),
        adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models'),
      ]);
      setEmployee(empRes.employee);
      setLayers(layersRes.careerLayers);
      setModels(modelsRes.incomeModels);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [empId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = <K extends keyof HrEmployee>(key: K, value: HrEmployee[K]) => {
    setEmployee((e) => (e ? { ...e, [key]: value } : e));
    setSaved(false);
  };

  const save = async () => {
    if (!employee || !canWrite) return;
    try {
      const data = await adminFetch<{ employee: HrEmployee }>(
        `/api/admin/hr/employees/${employee.id}`,
        { method: 'PATCH', body: JSON.stringify(employee) }
      );
      setEmployee(data.employee);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const addContract = async () => {
    if (!employee || !canWrite) return;
    const startDate = window.prompt('تاریخ شروع (مثلاً 1403/01/01)');
    if (!startDate?.trim()) return;
    const salaryRaw = window.prompt('حقوق ماهانه (تومان)', '0');
    const salary = Number(String(salaryRaw || '0').replace(/[^0-9]/g, '')) || 0;
    try {
      await adminFetch<{ contract: HrContract }>(`/api/admin/hr/employees/${employee.id}/contracts`, {
        method: 'POST',
        body: JSON.stringify({ startDate: startDate.trim(), salary }),
      });
      await load();
      setTab('contracts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  if (!Number.isFinite(empId)) {
    return <p className="admin-error">شناسه نامعتبر</p>;
  }
  if (!employee && !error) {
    return <p className="admin-muted">در حال بارگذاری…</p>;
  }
  if (!employee) {
    return <p className="admin-error">{error}</p>;
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-muted">
            <Link to="/admin/hr/employees" className="admin-link">
              ← همکاران
            </Link>
          </p>
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p>
            <AdminIdChip publicId={employee.publicId} /> · {employee.personnelCode}
          </p>
        </div>
        {canWrite ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => void save()}>
            ذخیره پرونده
          </button>
        ) : (
          <span className="admin-topbar-chip">فقط خواندن</span>
        )}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {saved ? <p className="admin-success">ذخیره شد</p> : null}

      <div className="admin-tabs">
        {(
          [
            ['profile', 'پرونده'],
            ['contracts', 'قراردادها'],
            ['logs', 'تاریخچه'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`admin-tab${tab === k ? ' is-on' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label>
            <span className="form-label">نام</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.firstName}
              onChange={(e) => patch('firstName', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">نام خانوادگی</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.lastName}
              onChange={(e) => patch('lastName', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">جنسیت</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.gender}
              onChange={(e) => patch('gender', e.target.value)}
            >
              <option value="">—</option>
              <option value="آقا">آقا</option>
              <option value="خانم">خانم</option>
            </select>
          </label>
          <label>
            <span className="form-label">کد ملی</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.nationalId}
              onChange={(e) => patch('nationalId', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">عنوان شغل</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.jobTitle}
              onChange={(e) => patch('jobTitle', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">دپارتمان</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.department}
              onChange={(e) => patch('department', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">محل کار</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.location}
              onChange={(e) => patch('location', e.target.value)}
            >
              <option value="">—</option>
              {HR_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">نحوه همکاری</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.cooperationType}
              onChange={(e) => patch('cooperationType', e.target.value)}
            >
              {HR_COOPERATION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">وضعیت قرارداد</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.contractStatus}
              onChange={(e) => patch('contractStatus', e.target.value)}
            >
              {HR_CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">وضعیت دسترسی</span>
            <select
              className="form-input"
              disabled={
                !canWrite ||
                employee.contractStatus === 'عدم تمدید' ||
                employee.contractStatus === 'اخراج'
              }
              value={employee.accessStatus}
              onChange={(e) => patch('accessStatus', e.target.value)}
            >
              {HR_ACCESS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">ایمیل سازمانی</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.orgEmail}
              onChange={(e) => patch('orgEmail', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">Gmail</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.gmail}
              onChange={(e) => patch('gmail', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">لایه مسیر شغلی</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.careerLayerId ?? ''}
              onChange={(e) =>
                patch('careerLayerId', e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">—</option>
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">مدل درآمدی</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.incomeModelId ?? ''}
              onChange={(e) =>
                patch('incomeModelId', e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">—</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">شهر</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.city}
              onChange={(e) => patch('city', e.target.value)}
            />
          </label>
          <label className="admin-span-2">
            <span className="form-label">آدرس</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.address}
              onChange={(e) => patch('address', e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {tab === 'contracts' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <div className="admin-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>قراردادها</h2>
            {canWrite ? (
              <button type="button" className="admin-btn" onClick={() => void addContract()}>
                تمدید / قرارداد جدید
              </button>
            ) : null}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>کد</th>
                  <th>شروع</th>
                  <th>پایان</th>
                  <th>حقوق</th>
                  <th>بیمه</th>
                  <th>بانک</th>
                </tr>
              </thead>
              <tbody>
                {(employee.contracts || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      قراردادی نیست
                    </td>
                  </tr>
                ) : (
                  (employee.contracts || []).map((c) => (
                    <tr key={c.id}>
                      <td className="admin-mono">{c.contractCode}</td>
                      <td>{c.startDate || '—'}</td>
                      <td>{c.endDate || 'باز'}</td>
                      <td>{formatNumFa(c.salary)}</td>
                      <td>{c.insuranceNo || '—'}</td>
                      <td>{c.bankName || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'logs' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>تاریخچه تغییرات</h2>
          <ul className="admin-log-list">
            {(employee.logs || []).length === 0 ? (
              <li className="admin-muted">هنوز تغییری ثبت نشده</li>
            ) : (
              (employee.logs || []).map((l) => (
                <li key={l.id}>
                  <span className="admin-mono">{l.loggedAt}</span> · <b>{l.field}</b>:{' '}
                  {l.oldValue || '∅'} → {l.newValue || '∅'}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
