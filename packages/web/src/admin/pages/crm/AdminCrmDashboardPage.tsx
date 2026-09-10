import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CrmDashboard } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';

export function AdminCrmDashboardPage() {
  const [data, setData] = useState<CrmDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void adminFetch<CrmDashboard>('/api/admin/crm/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);
  if (error) return <div className="admin-page"><p className="admin-error">{error}</p></div>;
  if (!data) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>سلام {data.greetingName}</h1>
          <p>داشبورد باشگاه مشتریان / امور مشتریان · Pet Date</p>
        </div>
        <Link className="admin-btn admin-btn--primary" to="/admin/crm/inbox">اینباکس</Link>
      </header>
      <div className="admin-stats">
        <div className="admin-stat admin-stat--mint"><div className="admin-stat-value">{formatNumFa(data.openTickets)}</div><div className="admin-stat-label">تیکت باز</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.breachedSla)}</div><div className="admin-stat-label">نقض SLA</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.atRiskSla)}</div><div className="admin-stat-label">در معرض نقض</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.unassigned)}</div><div className="admin-stat-label">تخصیص‌نیافته</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.wrapPending)}</div><div className="admin-stat-label">Wrap-up ناتمام</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.overdueFollowups)}</div><div className="admin-stat-label">پیگیری سررسید</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.callsToday)}</div><div className="admin-stat-label">تماس امروز ({formatNumFa(data.callMinutesToday)} د)</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{data.avgCsat != null ? formatNumFa(data.avgCsat) : '—'}</div><div className="admin-stat-label">میانگین CSAT</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>پیش‌نمایش اینباکس</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>شناسه</th><th>عنوان</th><th>مشتری</th><th>وضعیت</th><th>SLA</th><th></th></tr></thead>
            <tbody>
              {data.inboxPreview.map((r) => (
                <tr key={`${r.kind}-${r.id}`} style={{ borderRight: `3px solid ${r.borderColor}` }}>
                  <td className="admin-muted">{r.publicId}</td>
                  <td>{r.title}</td>
                  <td>{r.customerName}</td>
                  <td>{r.status}</td>
                  <td>{r.slaState}</td>
                  <td><Link to="/admin/crm/inbox">باز</Link></td>
                </tr>
              ))}
              {!data.inboxPreview.length ? <tr><td colSpan={6}>خالی</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>وظایف من</h2></div>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {data.myTasks.map((t) => (
            <li key={t.id}>{t.title} · {t.dueAt.slice(0, 10)} · {t.priority}</li>
          ))}
          {!data.myTasks.length ? <li>وظیفه‌ای نیست</li> : null}
        </ul>
      </section>
    </div>
  );
}
