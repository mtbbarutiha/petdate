import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { HrEmployee } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import {
  currentJalaliParts,
  formatJalaliNumFa,
  jalaliToGregorianYmd,
  JALALI_MONTHS,
} from '../../JalaliDateSelect';
import { formatHrMoney } from './HrUi';
import { tr } from '../../../i18n';

type CostRow = {
  employee: {
    id: number;
    publicId: string;
    personnelCode: string;
    name: string;
    jobTitle: string;
    department?: string;
    avatarUrl?: string;
  };
  cost: {
    salary: number;
    insurance: number;
    tax: number;
    bonus: number;
    commission: number;
    eidiMonthly: number;
    sanavatMonthly: number;
    total: number;
  };
};

export function AdminHrCostPage() {
  const jalaliNow = useMemo(() => currentJalaliParts(), []);
  const [jalaliYear, setJalaliYear] = useState(jalaliNow.year);
  const [jalaliMonth, setJalaliMonth] = useState(jalaliNow.month);
  const [colleagueName, setColleagueName] = useState('');
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [orgTotal, setOrgTotal] = useState(0);
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    insurance: '0',
    tax: '0',
    bonus: '0',
    sales: '0',
  });
  const canWrite = adminCan('hr.write');

  const gregorianYm = useMemo(() => {
    // Mid-month of selected Jalali period → Gregorian Y/M for cost API
    const g = jalaliToGregorianYmd(jalaliYear, jalaliMonth, 15);
    return { year: g.gy, month: g.gm };
  }, [jalaliYear, jalaliMonth]);

  const yearOptions = useMemo(() => {
    const cur = jalaliNow.year;
    return [cur - 1, cur, cur + 1];
  }, [jalaliNow.year]);

  const load = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        adminFetch<{ costs: CostRow[]; orgTotal: number }>(
          `/api/admin/hr/cost?year=${gregorianYm.year}&month=${gregorianYm.month}`
        ),
        adminFetch<{ employees: HrEmployee[] }>('/api/admin/hr/employees?limit=200'),
      ]);
      setCosts(c.costs);
      setOrgTotal(c.orgTotal);
      setEmployees(e.employees);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [gregorianYm.year, gregorianYm.month]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCosts = useMemo(() => {
    const q = colleagueName.trim().toLowerCase();
    if (!q) return costs;
    return costs.filter((row) => row.employee.name.toLowerCase().includes(q));
  }, [costs, colleagueName]);

  const deptTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredCosts) {
      const dept = row.employee.department?.trim() || 'بدون دپارتمان';
      map.set(dept, (map.get(dept) || 0) + (row.cost.total || 0));
    }
    return [...map.entries()]
      .map(([department, total]) => ({ department, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredCosts]);

  const filteredOrgTotal = useMemo(
    () => filteredCosts.reduce((s, r) => s + (r.cost.total || 0), 0),
    [filteredCosts]
  );

  const displayOrgTotal = colleagueName.trim() ? filteredOrgTotal : orgTotal;

  const upsert = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !employees.length) return;
    const employeeId = Number(form.employeeId || employees[0].id);
    if (!Number.isFinite(employeeId)) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/cost', {
        method: 'POST',
        body: JSON.stringify({
          employeeId,
          year: gregorianYm.year,
          month: gregorianYm.month,
          insurance: Number(form.insurance) || 0,
          tax: Number(form.tax) || 0,
          bonus: Number(form.bonus) || 0,
          sales: Number(form.sales) || 0,
        }),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header hr-reports-header hr-cost-header">
        <div>
          <h1>{tr('تخصیص هزینه نیروی کار')}</h1>
          <p>{tr('بدون تسهیم بیزنس‌لاین — قرارداد + مزایا + ورودی ماه')}</p>
          <p className="hr-cost-org-total">
            {tr('جمع سازمانی')}{colleagueName.trim() ? tr(' (فیلتر)') : ''}:{' '}
            <strong>{formatHrMoney(displayOrgTotal)}</strong>
          </p>
        </div>
        <div className="hr-reports-filters hr-cost-filters" role="group" aria-label={tr("فیلتر تخصیص هزینه")}>
          <label className="hr-reports-filter">
            <span>{tr('ماه جلالی')}</span>
            <select
              className="admin-select"
              value={jalaliMonth}
              onChange={(e) => setJalaliMonth(Number(e.target.value))}
              aria-label={tr("ماه جلالی")}
            >
              {JALALI_MONTHS.map((m) => (
                <option key={m.v} value={m.v}>
                  {tr(m.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="hr-reports-filter">
            <span>{tr('سال جلالی')}</span>
            <select
              className="admin-select"
              value={jalaliYear}
              onChange={(e) => setJalaliYear(Number(e.target.value))}
              aria-label={tr("سال جلالی")}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {formatJalaliNumFa(y)}
                </option>
              ))}
            </select>
          </label>
          <label className="hr-reports-filter hr-cost-colleague-filter">
            <span>{tr('نام همکار')}</span>
            <div className="admin-search">
              <Search size={16} aria-hidden />
              <input
                placeholder={tr("نام همکار")}
                value={colleagueName}
                onChange={(e) => setColleagueName(e.target.value)}
                aria-label={tr("جستجوی نام همکار")}
              />
            </div>
          </label>
          {canWrite ? (
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setForm({
                  employeeId: employees[0] ? String(employees[0].id) : '',
                  insurance: '0',
                  tax: '0',
                  bonus: '0',
                  sales: '0',
                });
                setOpen(true);
              }}
            >
              {tr('+ ورودی ماه')}
            </button>
          ) : null}
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      {deptTotals.length ? (
        <section className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{tr('جمع هزینه به تفکیک دپارتمان')}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('دپارتمان')}</th>
                  <th>{tr('جمع')}</th>
                </tr>
              </thead>
              <tbody>
                {deptTotals.map((d) => (
                  <tr key={d.department}>
                    <td>{d.department}</td>
                    <td>
                      <strong>{formatNumFa(d.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('همکار')}</th>
              <th>{tr('دپارتمان')}</th>
              <th>{tr('حقوق')}</th>
              <th>{tr('بیمه')}</th>
              <th>{tr('مالیات')}</th>
              <th>{tr('کمیسیون')}</th>
              <th>{tr('جمع')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCosts.map((row) => (
              <tr key={row.employee.id}>
                <td>
                  <AdminEntityCell
                    thumb={
                      <AdminThumb
                        src={
                          row.employee.avatarUrl ||
                          employees.find((e) => e.id === row.employee.id)?.avatarUrl
                        }
                        label={row.employee.name}
                        kind="user"
                        size={32}
                      />
                    }
                    title={row.employee.name}
                    subtitle={row.employee.personnelCode}
                  />
                </td>
                <td>{row.employee.department || '—'}</td>
                <td>{formatNumFa(row.cost.salary)}</td>
                <td>{formatNumFa(row.cost.insurance)}</td>
                <td>{formatNumFa(row.cost.tax)}</td>
                <td>{formatNumFa(row.cost.commission)}</td>
                <td>
                  <strong>{formatNumFa(row.cost.total)}</strong>
                </td>
              </tr>
            ))}
            {!filteredCosts.length ? (
              <tr>
                <td colSpan={7} className="admin-muted">
                  {tr('ردیفی یافت نشد')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={open}
        title={tr("ورودی هزینه ماه")}
        onClose={() => setOpen(false)}
        as="form"
        onSubmit={(e) => void upsert(e)}
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
          <span className="form-label">{tr('بیمه')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.insurance}
            onChange={(e) => setForm({ ...form, insurance: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('مالیات')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.tax}
            onChange={(e) => setForm({ ...form, tax: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('پاداش')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.bonus}
            onChange={(e) => setForm({ ...form, bonus: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">{tr('فروش')}</span>
          <input
            className="form-input"
            dir="ltr"
            value={form.sales}
            onChange={(e) => setForm({ ...form, sales: e.target.value })}
          />
        </label>
      </AdminModal>
    </div>
  );
}
