import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Activity, Bell, ClipboardList, LayoutDashboard, LineChart, LogOut, Mail, Menu, Package,
  PawPrint, PieChart, ScrollText, Settings, ShieldCheck, ShoppingBag, Stethoscope,
  Store, TrendingUp, Users, Wallet, X,
} from 'lucide-react';
import { AdminWordmark } from './AdminWordmark';
import { logoutAdmin } from './auth';
import '../styles/admin.css';

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { title: 'نمای کلی', items: [{ to: '/admin/dashboard', icon: LayoutDashboard, label: 'داشبورد' }] },
  { title: 'پلتفرم', items: [
    { to: '/admin/users', icon: Users, label: 'کاربران' },
    { to: '/admin/pets', icon: PawPrint, label: 'پت‌ها' },
    { to: '/admin/playdates', icon: ClipboardList, label: 'همبازی' },
    { to: '/admin/consults', icon: Stethoscope, label: 'مشاوره دامپزشک' },
    { to: '/admin/verification', icon: ShieldCheck, label: 'احراز هویت' },
    { to: '/admin/marketplace-moderation', icon: ClipboardList, label: 'مدارک و عکس' },
  ]},
  { title: 'مالی', items: [
    { to: '/admin/finance', icon: TrendingUp, label: 'داشبورد مالی' },
    { to: '/admin/finance/pnl', icon: PieChart, label: 'سود و زیان' },
    { to: '/admin/finance/sales', icon: LineChart, label: 'نمودار فروش' },
    { to: '/admin/finance/orders', icon: ShoppingBag, label: 'درآمد سفارش' },
    { to: '/admin/finance/wallet', icon: Wallet, label: 'کیف پول' },
    { to: '/admin/finance/products', icon: Package, label: 'محصولات برتر' },
  ]},
  { title: 'فروشگاه', items: [
    { to: '/admin/shop/products', icon: Package, label: 'محصولات' },
    { to: '/admin/shop/categories', icon: Store, label: 'دسته‌بندی' },
    { to: '/admin/shop/orders', icon: ShoppingBag, label: 'سفارش‌ها' },
    { to: '/admin/payments', icon: Wallet, label: 'پرداخت‌ها' },
  ]},
  { title: 'محتوا و سیستم', items: [
    { to: '/admin/content', icon: Bell, label: 'اعلان‌ها / محتوا' },
    { to: '/admin/mail', icon: Mail, label: 'ایمیل / SMTP' },
    { to: '/admin/monitoring', icon: Activity, label: 'مانیتورینگ' },
    { to: '/admin/logs', icon: ScrollText, label: 'لاگ خطاها' },
    { to: '/admin/settings', icon: Settings, label: 'تنظیمات' },
  ]},
];

const TITLE_MAP: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.to, i.label]))
);

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pageTitle = useMemo(() => {
    const hit = Object.keys(TITLE_MAP).sort((a, b) => b.length - a.length).find((k) => location.pathname.startsWith(k));
    return hit ? TITLE_MAP[hit] : 'پنل مدیریت';
  }, [location.pathname]);

  return (
    <div className={`admin-app${collapsed ? ' admin-app--collapsed' : ''}`}>
      <div className="admin-shell">
        <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}>
          <div className="admin-brand">
            <AdminWordmark />
          </div>
          <nav className="admin-nav" aria-label="منوی ادمین">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="admin-nav-group">
                <div className="admin-nav-group-title">{group.title}</div>
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}>
                    <item.icon size={18} strokeWidth={2} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-foot">
            <button type="button" className="admin-logout" onClick={() => { logoutAdmin(); navigate('/admin/login'); }}>
              <LogOut size={16} /> خروج
            </button>
          </div>
        </aside>
        {mobileOpen ? <button type="button" className="admin-backdrop" aria-label="بستن منو" onClick={() => setMobileOpen(false)} /> : null}
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-start">
              <button type="button" className="admin-icon-btn admin-icon-btn--mobile" onClick={() => setMobileOpen((v) => !v)} aria-label="منو">
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <button type="button" className="admin-icon-btn admin-icon-btn--desktop" onClick={() => setCollapsed((v) => !v)} aria-label="جمع کردن سایدبار">
                <Menu size={18} />
              </button>
              <div>
                <p className="admin-topbar-eyebrow">Pet Date · کنسول عملیات</p>
                <h1 className="admin-topbar-title">{pageTitle}</h1>
              </div>
            </div>
            <div className="admin-topbar-end">
              <span className="admin-topbar-chip">RTL · fa</span>
              <span className="admin-topbar-chip admin-topbar-chip--mint admin-live-pulse">live DB</span>
            </div>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
