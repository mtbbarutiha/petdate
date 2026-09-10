import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch, formatNumFa } from '../../api';
import { HrKpiGrid, HrLinkGrid } from './HrUi';

type Report = {
  personnelTotal: number;
  byDept: Record<string, number>;
  byStatus: Record<string, number>;
  byLocation: Record<string, number>;
  serviceHoursMonth: number;
  requestsOpen: number;
};

export function AdminHrReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await adminFetch<Report>('/api/admin/hr/reports')); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>گزارشات منابع انسانی</h1><p>توزیع پرسنل، ساعت فعالیت و درخواست‌ها</p></div></header>
      {error ? <p className="admin-error">{error}</p> : null}
      {data ? <HrKpiGrid items={[
        { label: 'کل پرسنل', value: data.personnelTotal, tone: 'mint' },
        { label: 'ساعت فعالیت ماه', value: data.serviceHoursMonth, tone: 'sky' },
        { label: 'درخواست باز', value: data.requestsOpen, tone: 'orange' },
      ]} /> : null}
      <HrLinkGrid links={[
        { to: '/admin/hr/employees', label: 'پرسنل', sub: 'جزئیات پرونده' },
        { to: '/admin/hr/cost', label: 'هزینه', sub: 'جمع ماهانه' },
        { to: '/admin/hr/compensation', label: 'جبران خدمت', sub: 'مدل درآمد' },
      ]} />
      <div className="admin-settings-grid" style={{ marginTop: 16 }}>
        {([['دپارتمان', data?.byDept], ['وضعیت قرارداد', data?.byStatus], ['محل کار', data?.byLocation]] as const).map(([title, map]) => (
          <article key={title} className="admin-card" style={{ padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{title}</h2>
            <ul className="admin-log-list">
              {Object.entries(map || {}).map(([k, v]) => <li key={k}><b>{k}</b> · {formatNumFa(v)}</li>)}
            </ul>
          </article>
        ))}
      </div>
      <p style={{ marginTop: 12 }}><Link to="/admin/hr/requests">مانده مرخصی →</Link></p>
    </div>
  );
}
