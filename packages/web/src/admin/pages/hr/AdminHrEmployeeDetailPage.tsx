import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  HrCareerLayer,
  HrContract,
  HrEmployee,
  HrEmployeeBenefits,
  HrIncomeModel,
  HrRequest,
} from '@petdate/shared';
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
  defaultHrBenefits,
  nextRequestStatus,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { appPrompt } from '../../../components/AppDialog';
import { AdminIdChip } from '../../AdminIds';
import { AdminThumb } from '../../AdminThumb';
import { JalaliDateSelect, formatAdminFaDate, formatJalaliSlash, parseJalaliSlash } from '../../JalaliDateSelect';
import { tr } from '../../../i18n';

const TABS = [
  { id: 'identity', label: 'هویتی - تحصیلی' },
  { id: 'job', label: 'شغلی' },
  { id: 'contract', label: 'قرارداد' },
  { id: 'renew', label: 'ایجاد / تمدید قرارداد' },
  { id: 'comp', label: 'جبران خدمت' },
  { id: 'career', label: 'مسیر شغلی' },
  { id: 'benefits', label: 'مزایا' },
  { id: 'requests', label: 'تیکت‌های منابع انسانی' },
  { id: 'access', label: 'دسترسی' },
  { id: 'history', label: 'فعالیت / تاریخچه' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const BENEFIT_LABELS: Array<{ key: keyof HrEmployeeBenefits; label: string }> = [
  { key: 'eidi', label: 'عیدی' },
  { key: 'sanavat', label: 'سنوات' },
  { key: 'insurance', label: 'بیمه' },
  { key: 'bonus', label: 'پاداش عملکردی' },
  { key: 'commission', label: 'پورسانت' },
  { key: 'training', label: 'دوره‌های آموزشی' },
];

const JOB_SUGGESTIONS = [
  'مدیرکل',
  'مدیر منابع انسانی',
  'کارشناس فروش',
  'سرپرست فروش',
  'پشتیبانی',
  'توسعه‌دهنده',
  'طراح',
  'محتوا',
];

const DEPT_SUGGESTIONS = [
  'مدیریتی',
  'منابع انسانی',
  'فروش',
  'پشتیبانی',
  'فنی',
  'بازاریابی',
  'مالی',
];

function ticketRange(r: HrRequest): string {
  if (r.fromDate || r.toDate) {
    return `${formatAdminFaDate(r.fromDate) || '—'} ← ${formatAdminFaDate(r.toDate) || '—'}`;
  }
  if (r.days) return `${formatNumFa(r.days)}${tr(' روز')}`;
  return formatAdminFaDate(r.createdAt);
}

export function AdminHrEmployeeDetailPage() {
  const { id } = useParams();
  const empId = Number(id);
  const [employee, setEmployee] = useState<HrEmployee | null>(null);
  const [plainPassword, setPlainPassword] = useState('');
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [peers, setPeers] = useState<HrEmployee[]>([]);
  const [tickets, setTickets] = useState<HrRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractBusy, setContractBusy] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [contractForm, setContractForm] = useState({
    startDate: '',
    endDate: '',
    salary: '0',
    insuranceNo: '',
    bankName: '',
    bankAccountNo: '',
    sheba: '',
  });
  const [tab, setTab] = useState<TabId>('identity');
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    if (!Number.isFinite(empId)) return;
    try {
      const [empRes, layersRes, modelsRes, peersRes, ticketsRes] = await Promise.all([
        adminFetch<{ employee: HrEmployee; plainPassword?: string }>(
          `/api/admin/hr/employees/${empId}`
        ),
        adminFetch<{ careerLayers: HrCareerLayer[] }>('/api/admin/hr/settings/layers'),
        adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models'),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
        adminFetch<{ requests: HrRequest[] }>(
          `/api/admin/hr/requests?employeeId=${empId}`
        ),
      ]);
      setEmployee({
        ...empRes.employee,
        benefits: empRes.employee.benefits || defaultHrBenefits(),
      });
      setPlainPassword(String(empRes.plainPassword || ''));
      setLayers(layersRes.careerLayers);
      setModels(modelsRes.incomeModels);
      setPeers(peersRes.employees.filter((e) => e.id !== empId));
      setTickets(ticketsRes.requests);
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

  const jobOptions = useMemo(() => {
    const set = new Set<string>(JOB_SUGGESTIONS);
    for (const p of peers) if (p.jobTitle) set.add(p.jobTitle);
    if (employee?.jobTitle) set.add(employee.jobTitle);
    return Array.from(set);
  }, [peers, employee?.jobTitle]);

  const deptOptions = useMemo(() => {
    const set = new Set<string>(DEPT_SUGGESTIONS);
    for (const p of peers) if (p.department) set.add(p.department);
    if (employee?.department) set.add(employee.department);
    return Array.from(set);
  }, [peers, employee?.department]);

  const selectedManager = useMemo(() => {
    if (!employee?.reportingManagerPersonId) return null;
    return peers.find((p) => String(p.id) === String(employee.reportingManagerPersonId)) || null;
  }, [peers, employee?.reportingManagerPersonId]);

  const patch = <K extends keyof HrEmployee>(key: K, value: HrEmployee[K]) => {
    setEmployee((e) => (e ? { ...e, [key]: value } : e));
    setSaved(false);
  };

  const patchBenefits = (key: keyof HrEmployeeBenefits, value: boolean) => {
    setEmployee((e) =>
      e
        ? {
            ...e,
            benefits: { ...(e.benefits || defaultHrBenefits()), [key]: value },
          }
        : e
    );
    setSaved(false);
  };

  const save = async () => {
    if (!employee || !canWrite) return;
    try {
      const data = await adminFetch<{ employee: HrEmployee }>(
        `/api/admin/hr/employees/${employee.id}`,
        { method: 'PATCH', body: JSON.stringify(employee) }
      );
      setEmployee({
        ...data.employee,
        benefits: data.employee.benefits || defaultHrBenefits(),
      });
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
      setError(tr('تاریخ شروع و پایان قرارداد الزامی است'));
      return;
    }
    const salary = Number(String(contractForm.salary || '0').replace(/[^0-9]/g, '')) || 0;
    setContractBusy(true);
    try {
      await adminFetch<{ contract: HrContract }>(`/api/admin/hr/employees/${employee.id}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate,
          salary,
          insuranceNo: contractForm.insuranceNo,
          bankName: contractForm.bankName,
          bankAccountNo: contractForm.bankAccountNo,
          sheba: contractForm.sheba,
        }),
      });
      setContractOpen(false);
      await load();
      setTab('contract');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setContractBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!employee || !canWrite) return;
    setPwdBusy(true);
    try {
      const data = await adminFetch<{ plainPassword: string; employee: HrEmployee }>(
        `/api/admin/hr/employees/${employee.id}/reset-password`,
        { method: 'POST', body: '{}' }
      );
      setPlainPassword(data.plainPassword);
      if (data.employee) {
        setEmployee({
          ...data.employee,
          benefits: data.employee.benefits || defaultHrBenefits(),
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setPwdBusy(false);
    }
  };

  const ticketAct = async (path: string, body?: Record<string, unknown>) => {
    try {
      await adminFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  if (!Number.isFinite(empId)) {
    return <p className="admin-error">{tr('شناسه نامعتبر')}</p>;
  }
  if (!employee && !error) {
    return <p className="admin-muted">{tr('در حال بارگذاری…')}</p>;
  }
  if (!employee) {
    return <p className="admin-error">{error}</p>;
  }

  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const benefits = employee.benefits || defaultHrBenefits();

  const uploadAvatar = async (file: File | null) => {
    if (!file || !canWrite) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await adminFetch<{ employee: HrEmployee }>(
        `/api/admin/hr/employees/${employee.id}/avatar`,
        { method: 'POST', body: fd }
      );
      setEmployee({
        ...data.employee,
        benefits: data.employee.benefits || defaultHrBenefits(),
      });
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
                {tr('← همکاران')}
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
            {tr('ذخیره پرونده')}
          </button>
        ) : (
          <span className="admin-topbar-chip">{tr('فقط خواندن')}</span>
        )}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {saved ? <p className="admin-success">{tr('ذخیره شد')}</p> : null}

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab${tab === t.id ? ' is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {tab === 'identity' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label className="admin-span-2">
            <span className="form-label">{tr('آدرس عکس (URL)')}</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              placeholder={tr("https://… یا /api/admin/hr/avatars/…")}
              value={employee.avatarUrl || ''}
              onChange={(e) => patch('avatarUrl', e.target.value)}
            />
          </label>
          {canWrite ? (
            <label className="admin-span-2">
              <span className="form-label">{tr('آپلود عکس')}</span>
              <input
                className="form-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => void uploadAvatar(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
          <label>
            <span className="form-label">{tr('نام')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.firstName}
              onChange={(e) => patch('firstName', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('نام خانوادگی')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.lastName}
              onChange={(e) => patch('lastName', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('جنسیت')}</span>
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
              <option value="آقا">{tr('آقا')}</option>
              <option value="خانم">{tr('خانم')}</option>
            </select>
          </label>
          <div>
            <span className="form-label">{tr('تاریخ تولد')}</span>
            <JalaliDateSelect
              value={parseJalaliSlash(employee.birthDate || '')}
              disabled={!canWrite}
              yearsBack={80}
              yearsForward={0}
              onChange={(v) => patch('birthDate', formatJalaliSlash(v))}
            />
          </div>
          <label>
            <span className="form-label">{tr('شماره شناسنامه')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.birthCertNo || ''}
              onChange={(e) => patch('birthCertNo', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('کد ملی')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.nationalId}
              onChange={(e) => patch('nationalId', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('نام پدر')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.fatherName || ''}
              onChange={(e) => patch('fatherName', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('وضعیت تأهل')}</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.maritalStatus || ''}
              onChange={(e) => patch('maritalStatus', e.target.value)}
            >
              <option value="">—</option>
              <option value="مجرد">{tr('مجرد')}</option>
              <option value="متأهل">{tr('متأهل')}</option>
            </select>
          </label>
          <label>
            <span className="form-label">{tr('تعداد فرزند')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.childrenCount || ''}
              onChange={(e) => patch('childrenCount', e.target.value)}
            />
          </label>
          {employee.gender === 'آقا' ? (
            <label>
              <span className="form-label">{tr('وضعیت نظام وظیفه')}</span>
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
            <span className="form-label">{tr('استان')}</span>
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
            <span className="form-label">{tr('شهر')}</span>
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
          <label className="admin-span-2">
            <span className="form-label">{tr('آدرس')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.address}
              onChange={(e) => patch('address', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('مدرک تحصیلی')}</span>
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
            <span className="form-label">{tr('رشته تحصیلی')}</span>
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
            <span className="form-label">Gmail</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.gmail}
              onChange={(e) => patch('gmail', e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {tab === 'job' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label>
            <span className="form-label">{tr('شغل')}</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.jobTitle}
              onChange={(e) => patch('jobTitle', e.target.value)}
            >
              <option value="">—</option>
              {jobOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">{tr('بخش')}</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.department}
              onChange={(e) => patch('department', e.target.value)}
            >
              <option value="">—</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">{tr('محل حضور')}</span>
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
            <span className="form-label">{tr('مدیر مربوطه (سمت شغلی)')}</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.reportingManagerTitle || ''}
              onChange={(e) => patch('reportingManagerTitle', e.target.value)}
            >
              <option value="">—</option>
              {jobOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">{tr('نام مدیر / سرپرست')}</span>
            <select
              className="form-input"
              disabled={!canWrite}
              value={employee.reportingManagerPersonId || ''}
              onChange={(e) => patch('reportingManagerPersonId', e.target.value)}
            >
              <option value="">—</option>
              {peers.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.firstName} {p.lastName}
                  {p.jobTitle ? ` · ${p.jobTitle}` : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedManager ? (
            <p className="admin-muted admin-span-2">
              {tr('مدیر انتخاب‌شده:')} {selectedManager.firstName} {selectedManager.lastName}
              {selectedManager.jobTitle ? ` (${selectedManager.jobTitle})` : ''}
            </p>
          ) : null}
          <label>
            <span className="form-label">{tr('نحوه همکاری')}</span>
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
            <span className="form-label">{tr('داخلی')}</span>
            <input
              className="form-input"
              disabled={!canWrite}
              value={employee.extension || ''}
              onChange={(e) => patch('extension', e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {tab === 'contract' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <div className="admin-form-grid" style={{ marginBottom: 16 }}>
            <label>
              <span className="form-label">{tr('وضعیت قرارداد')}</span>
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
              <span className="form-label">{tr('نحوه همکاری')}</span>
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
          </div>
          <div className="admin-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{tr('قراردادها')}</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('کد')}</th>
                  <th>{tr('شروع')}</th>
                  <th>{tr('پایان')}</th>
                  <th>{tr('حقوق')}</th>
                  <th>{tr('بیمه')}</th>
                  <th>{tr('بانک')}</th>
                </tr>
              </thead>
              <tbody>
                {(employee.contracts || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="admin-empty">
                      {tr('قراردادی نیست')}
                    </td>
                  </tr>
                ) : (
                  (employee.contracts || []).map((c) => (
                    <tr key={c.id}>
                      <td className="admin-mono">{c.contractCode}</td>
                      <td>{c.startDate || '—'}</td>
                      <td>{c.endDate || tr('باز')}</td>
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

      {tab === 'renew' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <div className="admin-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{tr('ایجاد / تمدید قرارداد')}</h2>
            {canWrite ? (
              <button
                type="button"
                className="admin-btn"
                onClick={() => {
                  setContractForm({
                    startDate: '',
                    endDate: '',
                    salary: '0',
                    insuranceNo: '',
                    bankName: '',
                    bankAccountNo: '',
                    sheba: '',
                  });
                  setContractOpen(true);
                }}
              >
                {tr('تمدید / قرارداد جدید')}
              </button>
            ) : null}
          </div>
          <p className="admin-muted">
            {tr('تاریخ شروع و پایان جلالی الزامی است. آخرین قرارداد در تب «قرارداد» و تاریخچه نمایش داده می‌شود.')}
          </p>
          {(employee.contracts || []).length > 0 ? (
            <ul className="admin-log-list">
              {(employee.contracts || []).slice(0, 3).map((c) => (
                <li key={c.id}>
                  {c.contractCode}{tr(': شروع')} {c.startDate || '—'} {tr('· پایان')} {c.endDate || tr('باز')}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">{tr('هنوز قراردادی ثبت نشده است.')}</p>
          )}
        </div>
      ) : null}

      {tab === 'comp' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label>
            <span className="form-label">{tr('مدل درآمدی')}</span>
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
          <p className="admin-muted admin-span-2">{tr('مدل‌های درآمدی از بخش جبران خدمت مدیریت می‌شوند.')}</p>
        </div>
      ) : null}

      {tab === 'career' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label>
            <span className="form-label">{tr('لایه مسیر شغلی')}</span>
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
        </div>
      ) : null}

      {tab === 'benefits' ? (
        <div className="admin-card admin-benefit-block" style={{ padding: 16 }}>
          <h4 className="admin-subsection-title">{tr('مزایا')}</h4>
          <div className="admin-check-grid">
            {BENEFIT_LABELS.map(({ key, label }) => (
              <label key={key} className="admin-check-inline">
                <input
                  type="checkbox"
                  disabled={!canWrite}
                  checked={Boolean(benefits[key])}
                  onChange={(e) => patchBenefits(key, e.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="admin-muted admin-hint">
            {tr('در صورت عدم انتخاب هر مزیت، آن آیتم در محاسبات هزینه نیروی انسانی لحاظ نمی‌شود.')}
          </p>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{tr('تیکت‌های منابع انسانی')}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('نوع')}</th>
                  <th>{tr('بازه / تاریخ')}</th>
                  <th>{tr('وضعیت')}</th>
                  <th>{tr('نتیجه / اکشن')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="admin-empty">
                      {tr('تیکتی برای این همکار نیست')}
                    </td>
                  </tr>
                ) : (
                  tickets.map((r) => (
                    <tr key={r.id}>
                      <td>{r.type}</td>
                      <td>{ticketRange(r)}</td>
                      <td>{r.status}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <span>{r.result || '—'}</span>
                          {canWrite && nextRequestStatus(r.status) ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => void ticketAct(`/api/admin/hr/requests/${r.id}/advance`)}
                            >
                              {tr('مرحله بعد')}
                            </button>
                          ) : null}
                          {canWrite && [tr('ثبت‌شده'), tr('بررسی مدیر'), tr('بررسی HR')].includes(r.status) ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              onClick={() => void ticketAct(`/api/admin/hr/requests/${r.id}/reject`)}
                            >
                              {tr('رد')}
                            </button>
                          ) : null}
                          {canWrite &&
                          r.status !== 'تایید شده' &&
                          r.status !== 'رد شده' &&
                          r.status !== 'لغو شده' ? (
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
                                  void ticketAct(`/api/admin/hr/requests/${r.id}/resolve`, { result: result.trim() });
                                })();
                              }}
                            >
                              {tr('ثبت نتیجه')}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === 'access' ? (
        <div className="admin-card admin-form-grid" style={{ padding: 16 }}>
          <label>
            <span className="form-label">{tr('وضعیت دسترسی')}</span>
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
            <span className="form-label">{tr('نام کاربری')}</span>
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
            <span className="form-label">{tr('ایمیل سازمانی')}</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              value={employee.orgEmail}
              onChange={(e) => patch('orgEmail', e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">{tr('موبایل')}</span>
            <input
              className="form-input"
              dir="ltr"
              disabled={!canWrite}
              value={employee.mobile || ''}
              onChange={(e) => patch('mobile', e.target.value)}
            />
          </label>
          <div className="admin-span-2">
            <span className="form-label">{tr('رمز عبور (برای راهنمایی همکار توسط HR)')}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                dir="ltr"
                readOnly
                value={plainPassword || '—'}
                style={{ flex: 1 }}
              />
              {canWrite ? (
                <button
                  type="button"
                  className="admin-btn"
                  disabled={pwdBusy}
                  onClick={() => void resetPassword()}
                >
                  {pwdBusy ? '…' : tr('بازنشانی رمز')}
                </button>
              ) : null}
            </div>
            <p className="admin-muted admin-hint">
              {tr('رمز فعلی برای راهنمایی ورود همکار نمایش داده می‌شود. بازنشانی، رمز جدید تولید می‌کند.')}
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{tr('تاریخچه تغییرات')}</h2>
          <ul className="admin-log-list">
            {(employee.logs || []).length === 0 ? (
              <li className="admin-muted">{tr('هنوز تغییری ثبت نشده')}</li>
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
              <h3 className="admin-subsection-title">{tr('قراردادها در تاریخچه')}</h3>
              <ul className="admin-log-list">
                {(employee.contracts || []).map((c) => (
                  <li key={`c-${c.id}`}>
                    {tr('شروع:')} {c.startDate || '—'} {tr('· پایان:')} {c.endDate || tr('باز')} · {c.contractCode}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <AdminModal
        open={contractOpen}
        title={tr("قرارداد جدید")}
        onClose={() => !contractBusy && setContractOpen(false)}
        size="sm"
        as="form"
        onSubmit={(e) => void addContract(e)}
        busy={contractBusy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={contractBusy}>
              {tr('ذخیره')}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={contractBusy}
              onClick={() => setContractOpen(false)}
            >
              {tr('انصراف')}
            </button>
          </>
        }
      >
        <div>
          <span className="form-label">{tr('تاریخ شروع *')}</span>
          <JalaliDateSelect
            value={parseJalaliSlash(contractForm.startDate)}
            yearsBack={15}
            yearsForward={5}
            onChange={(v) => setContractForm({ ...contractForm, startDate: formatJalaliSlash(v) })}
          />
        </div>
        <div>
          <span className="form-label">{tr('تاریخ پایان *')}</span>
          <JalaliDateSelect
            value={parseJalaliSlash(contractForm.endDate)}
            yearsBack={15}
            yearsForward={5}
            onChange={(v) => setContractForm({ ...contractForm, endDate: formatJalaliSlash(v) })}
          />
        </div>
        <label>
          <span className="form-label">{tr('حقوق ماهانه (تومان)')}</span>
          <input
            className="form-input"
            type="number"
            value={contractForm.salary}
            onChange={(e) => setContractForm({ ...contractForm, salary: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('شماره بیمه')}</span>
          <input
            className="form-input"
            value={contractForm.insuranceNo}
            onChange={(e) => setContractForm({ ...contractForm, insuranceNo: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('بانک')}</span>
          <input
            className="form-input"
            value={contractForm.bankName}
            onChange={(e) => setContractForm({ ...contractForm, bankName: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('شماره حساب')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={contractForm.bankAccountNo}
            onChange={(e) => setContractForm({ ...contractForm, bankAccountNo: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('شبا')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={contractForm.sheba}
            onChange={(e) => setContractForm({ ...contractForm, sheba: e.target.value })}
          />
        </label>
      </AdminModal>
    </div>
  );
}
