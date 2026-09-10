import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import type { HrEmployee } from '@petdate/shared';
import { HR_ACCESS_STATUSES, HR_CONTRACT_STATUSES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminIdChip } from '../../AdminIds';
import { EmployeeCreateModal } from './EmployeeCreateModal';

export function AdminHrEmployeesPage() {
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [contractStatus, setContractStatus] = useState('');
  const [accessStatus, setAccessStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const canWrite = adminCan('hr.write');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (contractStatus) qs.set('contractStatus', contractStatus);
      if (accessStatus) qs.set('accessStatus', accessStatus);
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
  }, [q, contractStatus, accessStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>همکاران · پیوند</h1>
          <p>{formatNumFa(total)} پرونده پرسنلی · بدون بیزنس‌لاین</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} /> همکار جدید
          </button>
        ) : (
          <span className="admin-topbar-chip">فقط خواندن</span>
        )}
      </header>

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16} />
          <input
            placeholder="نام، کد پرسنلی، PD-E…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="admin-select"
          value={contractStatus}
          onChange={(e) => setContractStatus(e.target.value)}
        >
          <option value="">همه وضعیت قرارداد</option>
          {HR_CONTRACT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          value={accessStatus}
          onChange={(e) => setAccessStatus(e.target.value)}
        >
          <option value="">همه دسترسی</option>
          {HR_ACCESS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          اعمال
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>آیدی</th>
              <th>نام</th>
              <th>کد پرسنلی</th>
              <th>شغل</th>
              <th>دپارتمان</th>
              <th>محل</th>
              <th>قرارداد</th>
              <th>دسترسی</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-empty">
                  هنوز همکاری ثبت نشده
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <AdminIdChip publicId={e.publicId} />
                  </td>
                  <td>
                    <Link to={`/admin/hr/employees/${e.id}`} className="admin-link">
                      {e.firstName} {e.lastName}
                    </Link>
                  </td>
                  <td className="admin-mono">{e.personnelCode}</td>
                  <td>{e.jobTitle || '—'}</td>
                  <td>{e.department || '—'}</td>
                  <td>{e.location || '—'}</td>
                  <td>
                    <span className="admin-pill">{e.contractStatus}</span>
                  </td>
                  <td>
                    <span
                      className={`admin-pill${e.accessStatus === 'فعال' ? ' admin-pill--mint' : ' admin-pill--warn'}`}
                    >
                      {e.accessStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EmployeeCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}
