import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminCan } from '../auth';
import { AdminFinanceProductsPage } from './AdminFinanceProductsPage';
import { AdminSiteReportsPage } from './AdminSiteReportsPage';
import { AdminCrmReportsPage } from './crm/AdminCrmReportsPage';
import { tr } from '../../i18n';

type Tab = 'products' | 'club' | 'traffic' | 'sales';

export function AdminReportsHubPage() {
  const [tab, setTab] = useState<Tab>('products');
  const canClub = adminCan('crm.read') || adminCan('loyalty.read') || adminCan('admin.full');
  const canTraffic = adminCan('platform.read') || adminCan('admin.full');
  const canProducts = adminCan('finance.read') || adminCan('shop.read') || adminCan('admin.full');

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'products', label: 'محصولات برتر', show: canProducts },
    { id: 'club', label: 'گزارش باشگاه مشتریان', show: canClub },
    { id: 'traffic', label: 'گزارشات ترافیک', show: canTraffic },
  ];
  const visible = tabs.filter((t) => t.show);
  const active = visible.some((t) => t.id === tab) ? tab : visible[0]?.id;

  if (!visible.length) return <Navigate to="/admin/dashboard" replace />;

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>{tr('گزارش‌ها')}</h1>
          <p>{tr('محصولات برتر، باشگاه مشتریان و ترافیک — با دروازه دسترسی هر تب')}</p>
        </div>
      </header>
      <div className="admin-tabs" role="tablist">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={`admin-tab${active === t.id ? ' is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>
      {active === 'products' ? <AdminFinanceProductsPage /> : null}
      {active === 'club' && canClub ? (
        <section>
          <div className="admin-tabs" style={{ marginTop: 8 }}>
            <span className="admin-tab is-on">{tr('نمای کلی')}</span>
            <span className="admin-tab">{tr('تیکت و تعامل')}</span>
            <span className="admin-tab">{tr('وفاداری')}</span>
          </div>
          <AdminCrmReportsPage />
        </section>
      ) : null}
      {active === 'traffic' && canTraffic ? <AdminSiteReportsPage /> : null}
    </div>
  );
}
