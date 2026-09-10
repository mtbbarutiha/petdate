import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { HrCareerLayer, HrContract, HrEmployee, HrIncomeModel } from '@petdate/shared';
import {
  HR_ACCESS_STATUSES,
  HR_CONTRACT_STATUSES,
  HR_COOPERATION_TYPES,
  HR_EDUCATION_LEVELS,
  HR_FIELDS_OF_STUDY,
  HR_LOCATIONS,
  HR_MILITARY_STATUSES,
  IRAN_PROVINCES,
  citiesForProvince,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { AdminIdChip } from '../../AdminIds';
import { AdminThumb } from '../../AdminThumb';
import { JalaliDateSelect, formatJalaliSlash, parseJalaliSlash } from '../../JalaliDateSelect';

export function AdminHrEmployeeDetailPage() {
  const { id } = useParams();
  const empId = Number(id);
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);
  const [contractForm, setContractForm] = useState({ startDate: '', endDate: '', salary: '0' });
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

  const cityOptions = useMemo(
    () => (employee ? citiesForProvince(employee.province) : []),
    [employee?.province]
  );

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

  const addContract = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!employee || !canWrite) return;
    const startDate = contractForm.startDate.trim();
    const endDate = contractForm.endDate.trim();
    if (!startDate || !endDate) {
      setError('تاریخ شروع و پایان قرارداد الزامی است');
      return;
    }
    const salary = Number(String(contractForm.salary || '0').replace(/[^0-9]/g, '')) || 0;
    setContractBusy(true);
    try {
      await adminFetch<{ contract: HrContract }>(`/api/admin/hr/employees/${employee.id}/contracts`, {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate, salary }),
      });
      setContractOpen(false);
      await load();
      setTab('contracts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setContractBusy(false);
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

  const fullName = `${employee.firstName} ${employee.lastName}`.trim();

  const uploadAvatar = async (file: File | null) => {
    if (!file || !canWrite) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await adminFetch<{ employee: HrEmployee }>(
        `/api/admin/hr/employees/${employee.id}/avatar`,
        { method: 'POST', body: fd }
      );
      setEmployee(data.employee);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <AdminThumb src={employee.avatarUrl} label={fullName} kind="user" size={56} alt={fullName} />
          <div>
            <p className="admin-muted">
              <Link to="/admin/hr/employees" className="admin-link">
                ← همکاران
              </Link>
            </p>
            <h1>{fullName}</h1>
            <p>
              <AdminIdChip publicId={employee.publicId} /> · {employee.personnelCode}
            </p>
          </div>
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
          <label className="admin-span-2">
            <span className="form-label">آدرس عکس (URL)</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              placeholder="https://… یا /api/admin/hr/avatars/…"
              value={employee.avatarUrl || ''}
              onChange={(e) => patch('avatarUrl', e.target.value)}
            />
          </label>
          {canWrite ? (
            <label className="admin-span-2">
              <span className="form-label">آپلود عکس</span>
              <input
                className="form-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => void uploadAvatar(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
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
              onChange={(e) => {
                const gender = e.target.value;
                patch('gender', gender);
                if (gender !== 'آقا') patch('militaryStatus', '');
              }}
            >
              <option value="">—</option>
              <option value="آقا">آقا</option>
              <option value="خانم">خانم</option>
            </select>
          </label>
          <div>
            <span className="form-label">تاریخ تولد</span>
            <JalaliDateSelect
              value={parseJalaliSlash(employee.birthDate || '')}
              disabled={!canWrite}
              onChange={(v) => patch('birthDate', formatJalaliSlash(v))}
            />
          </div>
          {employee.gender === 'آقا' ? (
            <label>
              <span className="form-label">وضعیت نظام وظیفه</span>
              <select
                className="form-input"
                disabled={!canWrite}
                value={employee.militaryStatus || ''}
                onChange={(e) => patch('militaryStatus', e.target.value)}
              >
                <option value="">—</option>
                {HR_MILITARY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
            <span className="form-label">نام کاربری</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              value={employee.username || ''}
              onChange={(e) =>
                patch(
                  'username',
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]/g, '')
                    .slice(0, 64)
                )
              }
            />
          </label>
          <label>
            <span className="form-label">موبایل</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              value={employee.mobile || ''}
              onChange={(e) => patch('mobile', e.target.value)}
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
            <span className="form-label">مدرک تحصیلی</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.educationLevel || ''}
              onChange={(e) => patch('educationLevel', e.target.value)}
            >
              <option value="">—</option>
              {HR_EDUCATION_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">رشته تحصیلی</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.fieldOfStudy || ''}
              onChange={(e) => patch('fieldOfStudy', e.target.value)}
            >
              <option value="">—</option>
              {HR_FIELDS_OF_STUDY.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">استان</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.province || ''}
              onChange={(e) => {
                patch('province', e.target.value);
                patch('city', '');
              }}
            >
              <option value="">—</option>
              {IRAN_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">شهر</span>
            <select
              className="form-input"
              disabled={!canWrite || !employee.province}
              value={employee.city || ''}
              onChange={(e) => patch('city', e.target.value)}
            >
              <option value="">—</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setContractForm({ startDate: '', endDate: '', salary: '0' });
                  setContractOpen(true);
                }}
              >
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
          {(employee.contracts || []).length > 0 ? (
            <>
              <h3 className="admin-subsection-title">قراردادها در تاریخچه</h3>
              <ul className="admin-log-list">
                {(employee.contracts || []).map((c) => (
                  <li key={`c-${c.id}`}>
                    شروع: {c.startDate || '—'} · پایان: {c.endDate || 'باز'} · {c.contractCode}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <AdminModal
        open={contractOpen}
        title="قرارداد جدید"
        onClose={() => !contractBusy && setContractOpen(false)}
        size="sm"
        as="form"
        onSubmit={(e) => void addContract(e)}
        busy={contractBusy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={contractBusy}>
              ذخیره
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={contractBusy}
              onClick={() => setContractOpen(false)}
            >
              انصراف
            </button>
          </>
        }
      >
        <div>
          <span className="form-label">تاریخ شروع *</span>
          <JalaliDateSelect
            value={parseJalaliSlash(contractForm.startDate)}
            onChange={(v) => setContractForm({ ...contractForm, startDate: formatJalaliSlash(v) })}
          />
        </div>
        <div>
          <span className="form-label">تاریخ پایان *</span>
          <JalaliDateSelect
            value={parseJalaliSlash(contractForm.endDate)}
            onChange={(v) => setContractForm({ ...contractForm, endDate: formatJalaliSlash(v) })}
          />
        </div>
        <label>
          <span className="form-label">حقوق ماهانه (تومان)</span>
          <input
            className="form-input"
            type="number"
            value={contractForm.salary}
            onChange={(e) => setContractForm({ ...contractForm, salary: e.target.value })}
          />
        </label>
      </AdminModal>
    </div>
  );
}
