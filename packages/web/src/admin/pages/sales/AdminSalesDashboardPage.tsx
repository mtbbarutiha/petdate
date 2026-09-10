import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SalesDashboard, SalesFollowup } from '@petdate/shared';
import { salesStageLabel } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

export function AdminSalesDashboardPage() {
  const [data, setData] = useState<SalesDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('sales.write') || adminCan('admin.full');

  const load = useCallback(() => {
    void adminFetch<SalesDashboard>('/api/admin/sales/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const completeFollowup = async (id: number) => {
    await adminFetch(`/api/admin/sales/followups/${id}/complete`, { method: 'POST', body: '{}' });
    load();
  };

  if (error) return <div className="admin-page"><p className="admin-error">{error}</p></div>;
  if (!data) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>سلام {data.greetingName}</h1>
          <p>کارتابل من · خط محصول Pet Date (بدون چند بیزنس‌لاین)</p>
        </div>
        <Link className="admin-btn admin-btn--primary" to="/admin/sales/leads">لیدها</Link>
      </header>

      <div className="admin-stats">
        <div className="admin-stat admin-stat--mint">
          <div className="admin-stat-value">{formatNumFa(data.callsToday)}</div>
          <div className="admin-stat-label">تماس امروز ({formatNumFa(data.callMinutesToday)} د)</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.overdueFollowups)}</div>
          <div className="admin-stat-label">پیگیری سررسیدشده</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.salesTodayCount)}</div>
          <div className="admin-stat-label">فروش امروز · {formatNumFa(data.salesTodayValue)} ت</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.pendingFinance)}</div>
          <div className="admin-stat-label">در انتظار مالی</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.aov)}</div>
          <div className="admin-stat-label">AOV</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.activeLeads)}</div>
          <div className="admin-stat-label">لید فعال</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.activeUpgrades)}</div>
          <div className="admin-stat-label">آپگرید فعال</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{formatNumFa(data.unassigned)}</div>
          <div className="admin-stat-label">بدون تخصیص</div>
        </div>
      </div>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>اقدام بعدی</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>نام</th><th>محصول</th><th>امتیاز</th><th>مرحله</th><th></th></tr></thead>
            <tbody>
              {data.nextActions.map((i) => (
                <tr key={i.id}>
                  <td>{i.first} {i.last}<div className="admin-muted">{i.mobile}</div></td>
                  <td>{i.product}</td>
                  <td>{formatNumFa(i.score)}</td>
                  <td>{salesStageLabel(i.stage)}</td>
                  <td><Link to={`/admin/sales/leads/${i.id}`}>باز</Link></td>
                </tr>
              ))}
              {!data.nextActions.length ? <tr><td colSpan={5}>خالی</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>فالوآپ‌های من</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>نوع</th><th>شرح</th><th>اولویت</th><th>سررسید</th><th></th></tr></thead>
            <tbody>
              {data.myFollowups.map((f: SalesFollowup) => {
                const overdue = new Date(f.at).getTime() < Date.now();
                return (
                  <tr key={f.id}>
                    <td>{f.type}</td>
                    <td>{f.desc || '—'}</td>
                    <td>{f.priority}</td>
                    <td style={{ color: overdue ? '#c62828' : undefined }}>
                      {new Date(f.at).toLocaleString('fa-IR')}
                    </td>
                    <td>
                      {canWrite && f.status === 'باز' ? (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          onClick={() => void completeFollowup(f.id)}
                        >
                          انجام شد
                        </button>
                      ) : f.status}
                    </td>
                  </tr>
                );
              })}
              {!data.myFollowups.length ? <tr><td colSpan={5}>خالی</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
