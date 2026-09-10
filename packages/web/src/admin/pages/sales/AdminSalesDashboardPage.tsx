import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SalesDashboard } from '@petdate/shared';
import { salesStageLabel } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';

export function AdminSalesDashboardPage() {
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void adminFetch<SalesDashboard>('/api/admin/sales/dashboard').then(setData).catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);
  if (error) return <div className="admin-page"><p className="admin-error">{error}</p></div>;
  if (!data) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>سلام {data.greetingName}</h1><p>کارتابل فروش Pet Date · بدون بیزنس‌لاین</p></div>
        <Link className="admin-btn admin-btn--primary" to="/admin/sales/leads">لیدها</Link>
      </header>
      <div className="admin-stats">
        <div className="admin-stat admin-stat--mint"><div className="admin-stat-value">{formatNumFa(data.callsToday)}</div><div className="admin-stat-label">تماس امروز ({formatNumFa(data.callMinutesToday)} د)</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.overdueFollowups)}</div><div className="admin-stat-label">پیگیری سررسیدشده</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.salesTodayCount)}</div><div className="admin-stat-label">فروش امروز · {formatNumFa(data.salesTodayValue)} ت</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.pendingFinance)}</div><div className="admin-stat-label">در انتظار مالی</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.aov)}</div><div className="admin-stat-label">AOV</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.activeLeads)}</div><div className="admin-stat-label">لید فعال</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.activeUpgrades)}</div><div className="admin-stat-label">آپگرید فعال</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.unassigned)}</div><div className="admin-stat-label">بدون تخصیص</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>اقدام بعدی</h2></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>نام</th><th>محصول</th><th>امتیاز</th><th>مرحله</th><th></th></tr></thead>
          <tbody>{data.nextActions.map((i) => (
            <tr key={i.id}><td>{i.first} {i.last}<div className="admin-muted">{i.mobile}</div></td><td>{i.product}</td><td>{formatNumFa(i.score)}</td><td>{salesStageLabel(i.stage)}</td>
              <td><Link to={`/admin/sales/leads/${i.id}`}>باز</Link></td></tr>
          ))}{!data.nextActions.length ? <tr><td colSpan={5}>خالی</td></tr> : null}</tbody></table></div>
      </section>
    </div>
  );
}
