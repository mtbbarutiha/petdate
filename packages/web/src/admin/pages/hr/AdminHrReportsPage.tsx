import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { adminFetch, formatNumFa } from '../../api';
import { IranPersonnelHeatmap } from './IranPersonnelHeatmap';

type ChartRow = { name: string; count: number };

type Report = {
  personnelTotal: number;
  departments: string[];
  byProvince: ChartRow[];
  byGender: ChartRow[];
  byMarital: ChartRow[];
  topProvince: ChartRow | null;
  serviceHoursMonth: number;
  requestsOpen: number;
};

const DONUT_COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#64748b', '#ec4899'];

const MONTH_OPTIONS = [
  { v: '', label: 'کل سال' },
  { v: '1', label: 'فروردین' },
  { v: '2', label: 'اردیبهشت' },
  { v: '3', label: 'خرداد' },
  { v: '4', label: 'تیر' },
  { v: '5', label: 'مرداد' },
  { v: '6', label: 'شهریور' },
  { v: '7', label: 'مهر' },
  { v: '8', label: 'آبان' },
  { v: '9', label: 'آذر' },
  { v: '10', label: 'دی' },
  { v: '11', label: 'بهمن' },
  { v: '12', label: 'اسفند' },
];

function currentJalaliYear(): number {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric' }).formatToParts(
      new Date()
    );
    const y = parts.find((p) => p.type === 'year')?.value;
    const n = Number(String(y || '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 1300 ? n : 1404;
  } catch {
    return 1404;
  }
}

function toRows(data: ChartRow[] | undefined): ChartRow[] {
  if (!data?.length) return [];
  return data.filter((r) => r.count > 0);
}

function DonutTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: ChartRow & { pct?: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!;
  const pct = row.payload?.pct;
  return (
    <div className="hr-chart-tooltip">
      <div className="hr-chart-tooltip-label">{row.name}</div>
      <strong>
        {formatNumFa(Number(row.value || 0))} نفر
        {pct != null ? ` · ${formatNumFa(pct)}٪` : ''}
      </strong>
    </div>
  );
}

function FrequencyDonut({ title, rows }: { title: string; rows: ChartRow[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const pie = rows.map((r, i) => ({
    ...r,
    pct: total ? Math.round((r.count / total) * 100) : 0,
    color: DONUT_COLORS[i % DONUT_COLORS.length]!,
  }));

  return (
    <article className="admin-card hr-report-donut-card">
      <div className="admin-card-head">
        <h2>{title}</h2>
      </div>
      {pie.length ? (
        <div className="hr-report-donut-body">
          <div className="hr-report-donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={3}
                >
                  {pie.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="hr-report-donut-center" aria-hidden>
              <strong>{formatNumFa(total)}</strong>
              <span>نفر</span>
            </div>
          </div>
          <ul className="hr-report-donut-legend">
            {pie.map((s) => (
              <li key={s.name}>
                <i style={{ background: s.color }} />
                <div>
                  <b>{s.name}</b>
                  <span>
                    {formatNumFa(s.pct)}٪ · {formatNumFa(s.count)} نفر
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="admin-muted">داده‌ای برای نمایش نیست</p>
      )}
    </article>
  );
}

export function AdminHrReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState('');
  const [jalaliYear, setJalaliYear] = useState('');
  const [jalaliMonth, setJalaliMonth] = useState('');

  const yearOptions = useMemo(() => {
    const cur = currentJalaliYear();
    return [cur - 1, cur, cur + 1];
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (department) qs.set('department', department);
      if (jalaliYear) qs.set('jalaliYear', jalaliYear);
      if (jalaliMonth) qs.set('jalaliMonth', jalaliMonth);
      const path = `/api/admin/hr/reports${qs.toString() ? `?${qs}` : ''}`;
      setData(await adminFetch<Report>(path));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [department, jalaliYear, jalaliMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const byProvince = useMemo(() => toRows(data?.byProvince), [data]);
  const byGender = useMemo(() => toRows(data?.byGender), [data]);
  const byMarital = useMemo(() => toRows(data?.byMarital), [data]);

  return (
    <div className="admin-page hr-reports-page">
      <header className="admin-header hr-reports-header">
        <div>
          <h1>گزارشات</h1>
          <p>گزارش‌های پرسنلی و ارائه خدمات</p>
        </div>
        <div className="hr-reports-filters" role="group" aria-label="فیلتر گزارش">
          <label className="hr-reports-filter">
            <span>فیلتر بیزنس لاین</span>
            <select
              className="admin-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">همه</option>
              {(data?.departments || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="hr-reports-filter">
            <span>ماه</span>
            <select
              className="admin-select"
              value={jalaliMonth}
              onChange={(e) => setJalaliMonth(e.target.value)}
              disabled={!jalaliYear}
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.v || 'all'} value={m.v}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="hr-reports-filter">
            <span>سال</span>
            <select
              className="admin-select"
              value={jalaliYear}
              onChange={(e) => {
                setJalaliYear(e.target.value);
                if (!e.target.value) setJalaliMonth('');
              }}
            >
              <option value="">همه سال‌ها</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {formatNumFa(y)}
                </option>
              ))}
            </select>
          </label>
          <Link to="/admin/hr" className="admin-btn admin-btn--ghost">
            داشبورد
          </Link>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <article className="admin-card hr-report-heat-card">
        <div className="admin-card-head">
          <div>
            <h2>نقشه حرارتی پرسنل بر اساس استان</h2>
            <p className="admin-muted">
              استان‌هایی که فراوانی بیشتری دارند با رنگ گرم‌تر مشخص شده‌اند
              {data ? ` · مجموع ${formatNumFa(data.personnelTotal)} نفر` : ''}
            </p>
          </div>
        </div>
        <IranPersonnelHeatmap rows={byProvince} />
      </article>

      <div className="hr-report-donut-row">
        <FrequencyDonut title="فراوانی وضعیت تأهل" rows={byMarital} />
        <FrequencyDonut title="فراوانی جنسیت" rows={byGender} />
      </div>
    </div>
  );
}
