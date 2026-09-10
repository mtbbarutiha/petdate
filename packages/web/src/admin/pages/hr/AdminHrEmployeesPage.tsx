import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import type { HrEmployee } from '@petdate/shared';
import { HR_ACCESS_STATUSES, HR_CONTRACT_STATUSES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDate } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { EmployeeCreateModal } from './EmployeeCreateModal';

function formatHrDate(raw?: string | null): string {
  return formatAdminFaDate(raw);
}

function formatContractEnd(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return 'تاکنون';
  return formatHrDate(raw);
}

function accessPillClass(status: string): string {
  if (status === 'فعال') return 'admin-pill admin-pill--mint';
  if (status === 'غیر فعال') return 'admin-pill admin-pill--error';
  return 'admin-pill';
}

function contractPillClass(status: string): string {
  if (status === 'در حال همکاری') return 'admin-pill admin-pill--mint';
  if (status === 'در مرحله آزمایشی') return 'admin-pill admin-pill--warn';
  if (status === 'عدم تمدید' || status === 'اخراج') return 'admin-pill admin-pill--error';
  return 'admin-pill';
}

export function AdminHrEmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [facetEmployees, setFacetEmployees] = useState<HrEmployee[]>([]);
  const [q, setQ] = useState('');
  const [contractStatus, setContractStatus] = useState('');
  const [accessStatus, setAccessStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const canWrite = adminCan('hr.write');

  const loadFacets = useCallback(async () => {
    try {
      const data = await adminFetch<{ total: number; employees: HrEmployee[] }>(
        '/api/admin/hr/employees?limit=500'
      );
      setFacetEmployees(data.employees);
    } catch {
      /* facets are best-effort */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (contractStatus) qs.set('contractStatus', contractStatus);
      if (accessStatus) qs.set('accessStatus', accessStatus);
      if (department) qs.set('department', department);
      if (jobTitle) qs.set('jobTitle', jobTitle);
      qs.set('limit', '100');
      const data = await adminFetch<{ total: number; employees: HrEmployee[] }>(
        `/api/admin/hr/employees?${qs}`
      );
      setEmployees(data.employees);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [q, contractStatus, accessStatus, department, jobTitle]);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  useEffect(() => {
    void load();
  }, [load]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of facetEmployees) {
      if (e.department?.trim()) set.add(e.department.trim());
    }
    if (department.trim()) set.add(department.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [facetEmployees, department]);

  const jobOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of facetEmployees) {
      if (e.jobTitle?.trim()) set.add(e.jobTitle.trim());
    }
    if (jobTitle.trim()) set.add(jobTitle.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [facetEmployees, jobTitle]);

  const hasFilters = Boolean(
    q.trim() || contractStatus || accessStatus || department || jobTitle
  );

  const clearFilters = () => {
    setQ('');
    setContractStatus('');
    setAccessStatus('');
    setDepartment('');
    setJobTitle('');
  };

  const removeEmployee = async (emp: HrEmployee) => {
    if (!canWrite) return;
    const name = `${emp.firstName} ${emp.lastName}`.trim() || emp.personnelCode;
    if (!confirm(`حذف پرونده «${name}»؟ این کار برگشت‌پذیر نیست.`)) return;
    setBusyId(emp.id);
    try {
      await adminFetch(`/api/admin/hr/employees/${emp.id}`, { method: 'DELETE' });
      await Promise.all([load(), loadFacets()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page admin-hr-personnel">
      <header className="admin-header">
        <div>
          <h1>اطلاعات پرسنلی</h1>
          <p>
            پرونده کامل هر همکار — هویتی، شغلی، قرارداد، جبران خدمت، مسیر شغلی، مزایا، تیکت‌های منابع انسانی،
            دسترسی، فعالیت
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} /> افزودن همکار
          </button>
        ) : (
          <span className="admin-topbar-chip">فقط خواندن</span>
        )}
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card admin-hr-personnel-card">
        <div className="admin-card-head admin-hr-personnel-card-head">
          <div>
            <h2>لیست اطلاعات پرسنلی</h2>
            <p className="admin-muted admin-hr-personnel-sum">مجموع {formatNumFa(total)} نفر</p>
          </div>
        </div>

        <div className="admin-toolbar admin-hr-personnel-filters">
          <div className="admin-search">
            <Search size={16} />
            <input
              placeholder="جستجوی نام یا کد پرسنلی..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="جستجوی نام یا کد پرسنلی"
            />
          </div>
          <select
            className="admin-select"
            value={accessStatus}
            onChange={(e) => setAccessStatus(e.target.value)}
            aria-label="وضعیت دسترسی"
          >
            <option value="">وضعیت دسترسی: همه</option>
            {HR_ACCESS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="بیزنس لاین"
          >
            <option value="">بیزنس لاین: همه</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            aria-label="شغل"
          >
            <option value="">شغل: همه</option>
            {jobOptions.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={contractStatus}
            onChange={(e) => setContractStatus(e.target.value)}
            aria-label="وضعیت همکاری"
          >
            <option value="">وضعیت همکاری: همه</option>
            {HR_CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {hasFilters ? (
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-hr-personnel-clear"
              onClick={clearFilters}
            >
              <X size={14} /> پاک کردن فیلترها
            </button>
          ) : null}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense admin-hr-personnel-table">
            <thead>
              <tr>
                <th>وضعیت دسترسی</th>
                <th>کد پرسنلی</th>
                <th>نام و نام خانوادگی</th>
                <th>بیزنس لاین</th>
                <th>شغل</th>
                <th>شروع همکاری</th>
                <th>پایان قرارداد</th>
                <th>وضعیت همکاری</th>
                <th>تاریخ تولد</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="admin-empty">
                    هنوز همکاری ثبت نشده
                  </td>
                </tr>
              ) : (
                employees.map((e) => {
                  const fullName = `${e.firstName} ${e.lastName}`.trim();
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className={accessPillClass(e.accessStatus)}>{e.accessStatus}</span>
                      </td>
                      <td className="admin-mono">{e.personnelCode || '—'}</td>
                      <td>
                        <AdminEntityCell
                          thumb={
                            <AdminThumb
                              src={e.avatarUrl}
                              label={fullName}
                              kind="user"
                              alt={fullName}
                            />
                          }
                          title={
                            <Link to={`/admin/hr/employees/${e.id}`} className="admin-link">
                              {fullName || '—'}
                            </Link>
                          }
                        />
                      </td>
                      <td>
                        {e.department ? (
                          <span className="admin-pill admin-pill--line">{e.department}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{e.jobTitle || '—'}</td>
                      <td className="admin-cell-nowrap">
                        {formatHrDate(e.contractStartDate)}
                      </td>
                      <td className="admin-cell-nowrap">
                        {formatContractEnd(e.contractEndDate)}
                      </td>
                      <td>
                        <span className={contractPillClass(e.contractStatus)}>
                          {e.contractStatus || '—'}
                        </span>
                      </td>
                      <td className="admin-cell-nowrap">{formatHrDate(e.birthDate)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() => navigate(`/admin/hr/employees/${e.id}`)}
                          >
                            ویرایش
                          </button>
                          {canWrite ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
                              disabled={busyId === e.id}
                              onClick={() => void removeEmployee(e)}
                            >
                              حذف
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EmployeeCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          void load();
          void loadFacets();
        }}
      />
    </div>
  );
}
