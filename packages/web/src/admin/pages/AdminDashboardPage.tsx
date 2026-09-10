import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, HeartHandshake, Package, PawPrint, Stethoscope, Users, Wallet } from 'lucide-react';
import { petPublicIdOf } from '@petdate/shared';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminBarChart, AdminLineChart } from '../FinanceCharts';
import { AdminIdChip } from '../AdminIds';

type Dash = {
  generatedAt: string;
  stats: {
    users: number; pets: number; playdates: number; playdatesPending: number;
    vetConsults: number; vetConsultsOpen: number; shopOrders: number; shopRevenueToman: number;
    walletTotals: { coins: number; toman: number; ton: number; stars: number };
    paymentOrdersPending: number;
    botRelated: { chatMessages: number; openGames: number; errors24h: number };
  };
  recentPets: Array<{ id: number; publicId?: string; name: string; species: string; breed?: string; city?: string; ownerId: number }>;
  recentShopOrders: Array<{ id: number; status: string; totalToman: number; userId?: number }>;
  recentConsults: Array<{
    id: number; status: string; patientName?: string; vetName?: string; petName?: string;
    patientUserId: number; vetUserId: number; petId?: number | null;
  }>;
};

type SalesSpark = {
  dailyOrMonthly: Array<{ label: string; value: number }>;
  paymentMix: Array<{ currency: string; label: string; value: number }>;
  totalRevenue: number;
};

export function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [sales, setSales] = useState<SalesSpark | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [dash, salesRes] = await Promise.all([
        adminFetch<Dash>('/api/admin/dashboard'),
        adminFetch<SalesSpark>('/api/admin/finance/sales?period=month').catch(() => null),
      ]);
      setData(dash);
      setSales(salesRes);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const s = data?.stats;
  const kpis = s ? [
    { label: 'کاربران', value: formatNumFa(s.users), icon: Users, tone: 'violet', to: '/admin/users' },
    { label: 'پت‌ها', value: formatNumFa(s.pets), icon: PawPrint, tone: 'mint', to: '/admin/pets' },
    { label: 'همبازی (باز)', value: formatNumFa(s.playdatesPending), icon: HeartHandshake, tone: 'orange', to: '/admin/playdates' },
    { label: 'مشاوره باز', value: formatNumFa(s.vetConsultsOpen), icon: Stethoscope, tone: 'sky', to: '/admin/consults' },
    { label: 'سفارش فروشگاه', value: formatNumFa(s.shopOrders), icon: Package, tone: 'slate', to: '/admin/shop/orders' },
    { label: 'درآمد فروشگاه', value: formatTomanFa(s.shopRevenueToman), icon: Wallet, tone: 'mint', to: '/admin/finance' },
    { label: 'کیف پول تومان', value: formatTomanFa(s.walletTotals.toman), icon: Wallet, tone: 'violet', to: '/admin/finance/wallet' },
    { label: 'خطای ۲۴س', value: formatNumFa(s.botRelated.errors24h), icon: Activity, tone: 'orange', to: '/admin/logs' },
  ] : [];

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>داشبورد پلتفرم</h1>
          <p>
            دادهٔ زنده از دیتابیس
            {data?.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleString('fa-IR')}` : ''}
          </p>
        </div>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>بروزرسانی</button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <p className="admin-section-label">شاخص‌های زنده</p>
      <div className="admin-stats admin-stats--dense">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className={`admin-stat admin-stat--${k.tone}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="admin-stat-icon"><k.icon size={18} /></div>
            <div><div className="admin-stat-value">{k.value}</div><div className="admin-stat-label">{k.label}</div></div>
          </Link>
        ))}
      </div>

      {sales ? (
        <>
          <p className="admin-section-label">نمودارهای مالی (ماه جاری · لایو)</p>
          <div className="admin-dash-charts">
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>روند فروش</h2>
                <Link to="/admin/finance/sales">جزئیات</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminLineChart points={sales.dailyOrMonthly} color="#5c4d91" />
              </div>
              <p className="admin-muted" style={{ marginTop: 8 }}>
                جمع: <strong>{formatTomanFa(sales.totalRevenue)}</strong>
              </p>
            </section>
            <section className="admin-card">
              <div className="admin-card-head">
                <h2>ترکیب پرداخت</h2>
                <Link to="/admin/payments">پرداخت‌ها</Link>
              </div>
              <div className="admin-chart-panel">
                <AdminBarChart
                  color="#15cca0"
                  points={sales.paymentMix.map((p) => ({ label: p.label, value: p.value }))}
                />
              </div>
            </section>
          </div>
        </>
      ) : null}

      <p className="admin-section-label">آخرین فعالیت‌ها</p>
      <div className="admin-dash-grid">
        <section className="admin-card">
          <div className="admin-card-head"><h2>آخرین پت‌ها</h2><Link to="/admin/pets">همه</Link></div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>آیدی</th><th>نام</th><th>گونه</th><th>مالک</th><th>شهر</th></tr></thead>
            <tbody>
              {(data?.recentPets ?? []).map((pet) => (
                <tr key={pet.id}>
                  <td><AdminIdChip publicId={petPublicIdOf(pet)} numericId={pet.id} /></td>
                  <td><strong>{pet.name}</strong><div className="admin-muted">{pet.breed || '—'}</div></td>
                  <td>{pet.species}</td>
                  <td><code className="admin-mono" dir="ltr">#{pet.ownerId}</code></td>
                  <td>{pet.city || '—'}</td>
                </tr>
              ))}
              {!data?.recentPets?.length ? <tr><td colSpan={5} className="admin-muted">موردی نیست</td></tr> : null}
            </tbody>
          </table></div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head"><h2>سفارش فروشگاه</h2><Link to="/admin/shop/orders">همه</Link></div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>آیدی سفارش</th><th>کاربر</th><th>مبلغ</th><th>وضعیت</th></tr></thead>
            <tbody>
              {(data?.recentShopOrders ?? []).map((o) => (
                <tr key={o.id}>
                  <td><code className="admin-mono" dir="ltr">#{o.id}</code></td>
                  <td>{o.userId != null ? <code className="admin-mono" dir="ltr">#{o.userId}</code> : '—'}</td>
                  <td>{formatTomanFa(o.totalToman)}</td>
                  <td><span className="admin-badge">{o.status}</span></td>
                </tr>
              ))}
              {!data?.recentShopOrders?.length ? <tr><td colSpan={4} className="admin-muted">سفارشی نیست</td></tr> : null}
            </tbody>
          </table></div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head"><h2>مشاوره دامپزشک</h2><Link to="/admin/consults">صف</Link></div>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>آیدی</th><th>بیمار</th><th>پزشک</th><th>پت</th><th>وضعیت</th></tr></thead>
            <tbody>
              {(data?.recentConsults ?? []).map((c) => (
                <tr key={c.id}>
                  <td><code className="admin-mono" dir="ltr">#{c.id}</code></td>
                  <td>
                    {c.patientName || '—'}
                    <div className="admin-muted admin-mono">user #{c.patientUserId}</div>
                  </td>
                  <td>
                    {c.vetName || '—'}
                    <div className="admin-muted admin-mono">user #{c.vetUserId}</div>
                  </td>
                  <td>
                    {c.petName || '—'}
                    {c.petId != null ? <div className="admin-muted admin-mono">pet #{c.petId}</div> : null}
                  </td>
                  <td><span className="admin-badge">{c.status}</span></td>
                </tr>
              ))}
              {!data?.recentConsults?.length ? <tr><td colSpan={5} className="admin-muted">موردی نیست</td></tr> : null}
            </tbody>
          </table></div>
        </section>
        <section className="admin-card">
          <div className="admin-card-head"><h2>کیف پول کل</h2><Link to="/admin/users">کاربران</Link></div>
          {s ? (
            <ul className="admin-kv">
              <li><span>سکه</span><strong>{formatNumFa(s.walletTotals.coins)}</strong></li>
              <li><span>تومان</span><strong>{formatNumFa(s.walletTotals.toman)}</strong></li>
              <li><span>TON</span><strong>{formatNumFa(s.walletTotals.ton)}</strong></li>
              <li><span>Stars</span><strong>{formatNumFa(s.walletTotals.stars)}</strong></li>
              <li><span>پرداخت در انتظار</span><strong>{formatNumFa(s.paymentOrdersPending)}</strong></li>
              <li><span>پیام چت همبازی</span><strong>{formatNumFa(s.botRelated.chatMessages)}</strong></li>
              <li><span>بازی باز</span><strong>{formatNumFa(s.botRelated.openGames)}</strong></li>
            </ul>
          ) : <p className="admin-muted">…</p>}
        </section>
      </div>
    </div>
  );
}
