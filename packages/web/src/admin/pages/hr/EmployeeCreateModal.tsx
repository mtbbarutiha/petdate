import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  HrCareerLayer,
  HrEmployee,
  HrEmployeeBenefits,
  HrIncomeModel,
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
} from '@petdate/shared';
import { adminFetch } from '../../api';
import { AdminModal } from '../../AdminModal';
import { AdminThumb } from '../../AdminThumb';
import { JalaliDateSelect, formatJalaliSlash, parseJalaliSlash } from '../../JalaliDateSelect';

const TABS = [
  { id: 'identity', label: 'هویتی - تحصیلی' },
  { id: 'job', label: 'شغلی' },
  { id: 'contract', label: 'قرارداد' },
  { id: 'renew', label: 'ایجاد / تمدید قرارداد' },
  { id: 'comp', label: 'جبران خدمت' },
  { id: 'career', label: 'مسیر شغلی' },
  { id: 'benefits', label: 'مزایا' },
  { id: 'requests', label: 'درخواست‌ها' },
  { id: 'access', label: 'دسترسی' },
  { id: 'history', label: 'فعالیت / تاریخچه' },
] as const;

type TabId = (typeof TABS)[number]['id'];

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

const BENEFIT_LABELS: Array<{ key: keyof HrEmployeeBenefits; label: string }> = [
  { key: 'eidi', label: 'عیدی' },
  { key: 'sanavat', label: 'سنوات' },
  { key: 'insurance', label: 'بیمه' },
  { key: 'bonus', label: 'پاداش عملکردی' },
  { key: 'commission', label: 'پورسانت' },
  { key: 'training', label: 'دوره‌های آموزشی' },
];

function genReadablePassword(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `Hr${rand}${num}`;
}

function sanitizeUsernameInput(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 64);
}

type Draft = {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  birthCertNo: string;
  nationalId: string;
  fatherName: string;
  province: string;
  city: string;
  address: string;
  maritalStatus: string;
  childrenCount: string;
  militaryStatus: string;
  gmail: string;
  educationLevel: string;
  fieldOfStudy: string;
  jobTitle: string;
  department: string;
  location: string;
  reportingManagerTitle: string;
  reportingManagerPersonId: string;
  cooperationType: string;
  extension: string;
  orgEmail: string;
  contractStatus: string;
  accessStatus: string;
  incomeModelId: string;
  careerLayerId: string;
  benefits: HrEmployeeBenefits;
  username: string;
  password: string;
  mobile: string;
  avatarUrl: string;
  contractStart: string;
  contractEnd: string;
  salary: string;
  insuranceNo: string;
  bankName: string;
  bankAccountNo: string;
  sheba: string;
};

function emptyDraft(): Draft {
  return {
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    birthCertNo: '',
    nationalId: '',
    fatherName: '',
    province: '',
    city: '',
    address: '',
    maritalStatus: '',
    childrenCount: '',
    militaryStatus: '',
    gmail: '',
    educationLevel: '',
    fieldOfStudy: '',
    jobTitle: '',
    department: '',
    location: HR_LOCATIONS[0],
    reportingManagerTitle: '',
    reportingManagerPersonId: '',
    cooperationType: HR_COOPERATION_TYPES[0],
    extension: '',
    orgEmail: '',
    contractStatus: HR_CONTRACT_STATUSES[0],
    accessStatus: HR_ACCESS_STATUSES[0],
    incomeModelId: '',
    careerLayerId: '',
    benefits: defaultHrBenefits(),
    username: '',
    password: genReadablePassword(),
    mobile: '',
    avatarUrl: '',
    contractStart: '',
    contractEnd: '',
    salary: '',
    insuranceNo: '',
    bankName: '',
    bankAccountNo: '',
    sheba: '',
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (employee: HrEmployee) => void;
};

export function EmployeeCreateModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('identity');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [peers, setPeers] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [orgEmailDirty, setOrgEmailDirty] = useState(false);

  const patch = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab('identity');
    setDraft(emptyDraft());
    setAvatarFile(null);
    setError(null);
    setOrgEmailDirty(false);
    void Promise.all([
      adminFetch<{ careerLayers: HrCareerLayer[] }>('/api/admin/hr/settings/layers'),
      adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models'),
      adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
    ])
      .then(([l, m, e]) => {
        setLayers(l.careerLayers);
        setModels(m.incomeModels);
        setPeers(e.employees);
      })
      .catch(() => undefined);
  }, [open]);

  const jobOptions = useMemo(() => {
    const fromPeers = peers.map((p) => p.jobTitle).filter(Boolean);
    return [...new Set([...JOB_SUGGESTIONS, ...fromPeers])];
  }, [peers]);

  const deptOptions = useMemo(() => {
    const fromPeers = peers.map((p) => p.department).filter(Boolean);
    return [...new Set([...DEPT_SUGGESTIONS, ...fromPeers])];
  }, [peers]);

  const cityOptions = useMemo(() => citiesForProvince(draft.province), [draft.province]);

  const selectedManager = useMemo(() => {
    if (!draft.reportingManagerPersonId) return null;
    return peers.find((p) => String(p.id) === draft.reportingManagerPersonId) || null;
  }, [draft.reportingManagerPersonId, peers]);

  const setUsername = (raw: string) => {
    const username = sanitizeUsernameInput(raw);
    setDraft((d) => ({
      ...d,
      username,
      orgEmail: orgEmailDirty ? d.orgEmail : username ? `${username}@petdate.ir` : '',
    }));
  };

  const setManagerPerson = (personId: string) => {
    const peer = peers.find((p) => String(p.id) === personId);
    setDraft((d) => ({
      ...d,
      reportingManagerPersonId: personId,
      reportingManagerTitle: peer?.jobTitle || d.reportingManagerTitle,
    }));
  };

  const setManagerTitle = (title: string) => {
    const matches = peers.filter((p) => p.jobTitle === title);
    setDraft((d) => ({
      ...d,
      reportingManagerTitle: title,
      reportingManagerPersonId:
        matches.length === 1 ? String(matches[0].id) : d.reportingManagerPersonId,
    }));
  };

  const setGender = (gender: string) => {
    setDraft((d) => ({
      ...d,
      gender,
      militaryStatus: gender === 'آقا' ? d.militaryStatus : '',
    }));
  };

  const setProvince = (province: string) => {
    setDraft((d) => ({ ...d, province, city: '' }));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setTab('identity');
      setError('نام و نام خانوادگی الزامی است');
      return;
    }
    if (draft.contractStart.trim() && !draft.contractEnd.trim()) {
      setTab('renew');
      setError('تاریخ پایان قرارداد الزامی است');
      return;
    }
    if (draft.username && !/^[a-z0-9._-]{2,64}$/.test(draft.username)) {
      setTab('access');
      setError('نام کاربری فقط حروف لاتین کوچک، عدد و ._- (۲ تا ۶۴ کاراکتر)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        gender: draft.gender,
        birthDate: draft.birthDate,
        birthCertNo: draft.birthCertNo,
        nationalId: draft.nationalId,
        fatherName: draft.fatherName,
        province: draft.province,
        city: draft.city,
        address: draft.address,
        maritalStatus: draft.maritalStatus,
        childrenCount: draft.childrenCount,
        militaryStatus: draft.gender === 'آقا' ? draft.militaryStatus : '',
        gmail: draft.gmail,
        educationLevel: draft.educationLevel,
        fieldOfStudy: draft.fieldOfStudy,
        jobTitle: draft.jobTitle,
        department: draft.department,
        location: draft.location,
        reportingManagerTitle: draft.reportingManagerTitle,
        reportingManagerPersonId: draft.reportingManagerPersonId,
        cooperationType: draft.cooperationType,
        extension: draft.extension,
        orgEmail: draft.orgEmail,
        contractStatus: draft.contractStatus,
        accessStatus: draft.accessStatus,
        benefits: draft.benefits,
        incomeModelId: draft.incomeModelId ? Number(draft.incomeModelId) : null,
        careerLayerId: draft.careerLayerId ? Number(draft.careerLayerId) : null,
        username: draft.username.trim() || undefined,
        password: draft.password.trim() || undefined,
        mobile: draft.mobile.trim() || undefined,
        avatarUrl: draft.avatarUrl.trim() || undefined,
      };
      const data = await adminFetch<{
        employee: HrEmployee;
        generatedPassword?: string;
        credentialsSmsSent?: boolean;
      }>('/api/admin/hr/employees', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        await adminFetch<{ employee: HrEmployee }>(
          `/api/admin/hr/employees/${data.employee.id}/avatar`,
          { method: 'POST', body: fd }
        );
      }
      if (draft.contractStart.trim()) {
        const salary = Number(String(draft.salary || '0').replace(/[^0-9]/g, '')) || 0;
        await adminFetch(`/api/admin/hr/employees/${data.employee.id}/contracts`, {
          method: 'POST',
          body: JSON.stringify({
            startDate: draft.contractStart.trim(),
            endDate: draft.contractEnd.trim(),
            salary,
            insuranceNo: draft.insuranceNo,
            bankName: draft.bankName,
            bankAccountNo: draft.bankAccountNo,
            sheba: draft.sheba,
          }),
        });
      }
      onCreated?.(data.employee);
      onClose();
      navigate(`/admin/hr/employees/${data.employee.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={open}
      title="افزودن همکار جدید"
      onClose={onClose}
      size="xl"
      as="form"
      onSubmit={(e) => void save(e)}
      busy={busy}
      className="admin-modal-card--employee"
      footer={
        <>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
            {busy ? '…' : 'ذخیره پرونده'}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-tabs admin-tabs--modal" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? ' is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' ? (
        <div className="admin-form-grid">
          <div className="admin-span-2" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <AdminThumb
              src={avatarFile ? URL.createObjectURL(avatarFile) : draft.avatarUrl || null}
              label={`${draft.firstName} ${draft.lastName}`.trim() || 'همکار'}
              kind="user"
              size={56}
            />
            <div style={{ flex: 1, display: 'grid', gap: 8 }}>
              <label>
                <span className="form-label">آدرس عکس (URL)</span>
                <input
                  className="form-input"
                  dir="ltr"
                  placeholder="https://… یا /pepito/uploads/…"
                  value={draft.avatarUrl}
                  onChange={(e) => patch('avatarUrl', e.target.value)}
                />
              </label>
              <label>
                <span className="form-label">آپلود عکس</span>
                <input
                  className="form-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <label>
            <span className="form-label">نام *</span>
            <input className="form-input" required value={draft.firstName} onChange={(e) => patch('firstName', e.target.value)} />
          </label>
          <label>
            <span className="form-label">نام خانوادگی *</span>
            <input className="form-input" required value={draft.lastName} onChange={(e) => patch('lastName', e.target.value)} />
          </label>
          <label>
            <span className="form-label">جنسیت</span>
            <select className="form-input" value={draft.gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              <option value="آقا">آقا</option>
              <option value="خانم">خانم</option>
            </select>
          </label>
          <div>
            <span className="form-label">تاریخ تولد</span>
            <JalaliDateSelect
              value={parseJalaliSlash(draft.birthDate)}
              onChange={(v) => patch('birthDate', formatJalaliSlash(v))}
            />
          </div>
          <label>
            <span className="form-label">شماره شناسنامه</span>
            <input className="form-input" value={draft.birthCertNo} onChange={(e) => patch('birthCertNo', e.target.value)} />
          </label>
          <label>
            <span className="form-label">کد ملی</span>
            <input className="form-input" value={draft.nationalId} onChange={(e) => patch('nationalId', e.target.value)} />
          </label>
          <label>
            <span className="form-label">نام پدر</span>
            <input className="form-input" value={draft.fatherName} onChange={(e) => patch('fatherName', e.target.value)} />
          </label>
          <label>
            <span className="form-label">وضعیت تأهل</span>
            <select className="form-input" value={draft.maritalStatus} onChange={(e) => patch('maritalStatus', e.target.value)}>
              <option value="">—</option>
              <option value="مجرد">مجرد</option>
              <option value="متأهل">متأهل</option>
            </select>
          </label>
          <label>
            <span className="form-label">تعداد فرزند</span>
            <input className="form-input" value={draft.childrenCount} onChange={(e) => patch('childrenCount', e.target.value)} />
          </label>
          {draft.gender === 'آقا' ? (
            <label>
              <span className="form-label">وضعیت نظام وظیفه</span>
              <select
                className="form-input"
                value={draft.militaryStatus}
                onChange={(e) => patch('militaryStatus', e.target.value)}
              >
                <option value="">— انتخاب کنید —</option>
                {HR_MILITARY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span className="form-label">استان</span>
            <select className="form-input" value={draft.province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">— انتخاب کنید —</option>
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
              value={draft.city}
              disabled={!draft.province}
              onChange={(e) => patch('city', e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-span-2">
            <span className="form-label">آدرس</span>
            <input className="form-input" value={draft.address} onChange={(e) => patch('address', e.target.value)} />
          </label>
          <label>
            <span className="form-label">مدرک تحصیلی</span>
            <select
              className="form-input"
              value={draft.educationLevel}
              onChange={(e) => patch('educationLevel', e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
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
              value={draft.fieldOfStudy}
              onChange={(e) => patch('fieldOfStudy', e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {HR_FIELDS_OF_STUDY.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">Gmail</span>
            <input className="form-input" dir="ltr" value={draft.gmail} onChange={(e) => patch('gmail', e.target.value)} />
          </label>
        </div>
      ) : null}

      {tab === 'job' ? (
        <div className="admin-form-grid">
          <label>
            <span className="form-label">شغل</span>
            <select className="form-input" value={draft.jobTitle} onChange={(e) => patch('jobTitle', e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {jobOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">بخش</span>
            <select className="form-input" value={draft.department} onChange={(e) => patch('department', e.target.value)}>
              <option value="">— انتخاب کنید —</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">محل حضور</span>
            <select className="form-input" value={draft.location} onChange={(e) => patch('location', e.target.value)}>
              {HR_LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">مدیر مربوطه (سمت شغلی)</span>
            <select
              className="form-input"
              value={draft.reportingManagerTitle}
              onChange={(e) => setManagerTitle(e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {jobOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">نام مدیر / سرپرست</span>
            <select
              className="form-input"
              value={draft.reportingManagerPersonId}
              onChange={(e) => setManagerPerson(e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
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
              مدیر انتخاب‌شده: {selectedManager.firstName} {selectedManager.lastName}
              {selectedManager.jobTitle ? ` (${selectedManager.jobTitle})` : ''}
            </p>
          ) : null}
          <label>
            <span className="form-label">نحوه همکاری</span>
            <select
              className="form-input"
              value={draft.cooperationType}
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
            <span className="form-label">داخلی</span>
            <input className="form-input" value={draft.extension} onChange={(e) => patch('extension', e.target.value)} />
          </label>
          <div className="admin-span-2 admin-benefit-block">
            <h4 className="admin-subsection-title">مزایا</h4>
            <div className="admin-check-grid">
              {BENEFIT_LABELS.map(({ key, label }) => (
                <label key={key} className="admin-check-inline">
                  <input
                    type="checkbox"
                    checked={draft.benefits[key]}
                    onChange={(e) => patch('benefits', { ...draft.benefits, [key]: e.target.checked })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className="admin-muted admin-hint">
              در صورت عدم انتخاب هر مزیت، آن آیتم در محاسبات هزینه نیروی انسانی لحاظ نمی‌شود.
            </p>
          </div>
        </div>
      ) : null}

      {tab === 'contract' ? (
        <div className="admin-form-grid">
          <label>
            <span className="form-label">وضعیت قرارداد</span>
            <select
              className="form-input"
              value={draft.contractStatus}
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
            <span className="form-label">نحوه همکاری</span>
            <select
              className="form-input"
              value={draft.cooperationType}
              onChange={(e) => patch('cooperationType', e.target.value)}
            >
              {HR_COOPERATION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-muted admin-span-2">برای ثبت اولین قرارداد، تب «ایجاد / تمدید قرارداد» را پر کنید.</p>
        </div>
      ) : null}

      {tab === 'renew' ? (
        <div className="admin-form-grid">
          <div>
            <span className="form-label">تاریخ شروع *</span>
            <JalaliDateSelect
              value={parseJalaliSlash(draft.contractStart)}
              onChange={(v) => patch('contractStart', formatJalaliSlash(v))}
            />
          </div>
          <div>
            <span className="form-label">تاریخ پایان *</span>
            <JalaliDateSelect
              value={parseJalaliSlash(draft.contractEnd)}
              onChange={(v) => patch('contractEnd', formatJalaliSlash(v))}
            />
          </div>
          <label>
            <span className="form-label">حقوق ماهانه (تومان)</span>
            <input className="form-input" dir="ltr" value={draft.salary} onChange={(e) => patch('salary', e.target.value)} />
          </label>
          <label>
            <span className="form-label">شماره بیمه</span>
            <input className="form-input" value={draft.insuranceNo} onChange={(e) => patch('insuranceNo', e.target.value)} />
          </label>
          <label>
            <span className="form-label">بانک</span>
            <input className="form-input" value={draft.bankName} onChange={(e) => patch('bankName', e.target.value)} />
          </label>
          <label>
            <span className="form-label">شماره حساب</span>
            <input
              className="form-input"
              dir="ltr"
              value={draft.bankAccountNo}
              onChange={(e) => patch('bankAccountNo', e.target.value)}
            />
          </label>
          <label className="admin-span-2">
            <span className="form-label">شبا</span>
            <input className="form-input" dir="ltr" value={draft.sheba} onChange={(e) => patch('sheba', e.target.value)} />
          </label>
          {draft.contractStart || draft.contractEnd ? (
            <p className="admin-muted admin-span-2">
              پیش‌نمایش در تاریخچه: شروع قرارداد {draft.contractStart || '—'}
              {draft.contractEnd ? ` · پایان قرارداد ${draft.contractEnd}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'comp' ? (
        <div className="admin-form-grid">
          <label>
            <span className="form-label">مدل درآمدی</span>
            <select
              className="form-input"
              value={draft.incomeModelId}
              onChange={(e) => patch('incomeModelId', e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {models.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-muted admin-span-2">مدل‌های درآمدی از بخش جبران خدمت مدیریت می‌شوند.</p>
        </div>
      ) : null}

      {tab === 'career' ? (
        <div className="admin-form-grid">
          <label>
            <span className="form-label">لایه مسیر شغلی</span>
            <select
              className="form-input"
              value={draft.careerLayerId}
              onChange={(e) => patch('careerLayerId', e.target.value)}
            >
              <option value="">— انتخاب کنید —</option>
              {layers.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {tab === 'benefits' ? (
        <div className="admin-benefit-block" style={{ borderTop: 'none', paddingTop: 0 }}>
          <h4 className="admin-subsection-title">مزایا</h4>
          <div className="admin-check-grid">
            {BENEFIT_LABELS.map(({ key, label }) => (
              <label key={key} className="admin-check-inline">
                <input
                  type="checkbox"
                  checked={draft.benefits[key]}
                  onChange={(e) => patch('benefits', { ...draft.benefits, [key]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <p className="admin-muted admin-hint">
            در صورت عدم انتخاب هر مزیت، آن آیتم در محاسبات هزینه نیروی انسانی لحاظ نمی‌شود.
          </p>
        </div>
      ) : null}

      {tab === 'requests' ? (
        <p className="admin-muted">پس از ذخیره پرونده می‌توانید درخواست‌ها را ثبت کنید.</p>
      ) : null}

      {tab === 'access' ? (
        <div className="admin-form-grid">
          <label>
            <span className="form-label">وضعیت دسترسی</span>
            <select
              className="form-input"
              value={draft.accessStatus}
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
            <span className="form-label">نام کاربری</span>
            <input
              className="form-input"
              dir="ltr"
              autoComplete="off"
              placeholder="latin.lowercase"
              value={draft.username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            <span className="form-label">ایمیل سازمانی</span>
            <input
              className="form-input"
              dir="ltr"
              value={draft.orgEmail}
              onChange={(e) => {
                setOrgEmailDirty(true);
                patch('orgEmail', e.target.value);
              }}
            />
          </label>
          <label>
            <span className="form-label">موبایل (پیامک اطلاعات ورود)</span>
            <input
              className="form-input"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              value={draft.mobile}
              onChange={(e) => patch('mobile', e.target.value)}
            />
          </label>
          <div className="admin-span-2">
            <span className="form-label">رمز تولیدشده</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" dir="ltr" readOnly value={draft.password} style={{ flex: 1 }} />
              <button
                type="button"
                className="admin-btn"
                onClick={() => patch('password', genReadablePassword())}
              >
                تولید مجدد
              </button>
            </div>
            <p className="admin-muted admin-hint">این رمز فقط یک‌بار در این صفحه نمایش داده می‌شود و پس از ذخیره پیامک می‌شود.</p>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div>
          <p className="admin-muted">تاریخچه کامل پس از ایجاد پرونده فعال می‌شود.</p>
          {draft.contractStart || draft.contractEnd ? (
            <ul className="admin-log-list">
              {draft.contractStart ? (
                <li>
                  <b>شروع قرارداد</b>: {draft.contractStart} <span className="admin-muted">(در انتظار ذخیره)</span>
                </li>
              ) : null}
              {draft.contractEnd ? (
                <li>
                  <b>پایان قرارداد</b>: {draft.contractEnd} <span className="admin-muted">(در انتظار ذخیره)</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="admin-muted">هنوز قرارداد پیش‌نویس نشده است.</p>
          )}
        </div>
      ) : null}
    </AdminModal>
  );
}
