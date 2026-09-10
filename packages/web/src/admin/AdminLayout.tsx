import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Activity, Bell, Briefcase, ClipboardList, FileText, LayoutDashboard, LineChart, LogOut, Mail, Menu, Package,
  PawPrint, PieChart, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, Stethoscope,
  Store, TrendingUp, UserRound, Users, Wallet, X,
} from 'lucide-react';
import { AdminWordmark } from './AdminWordmark';
import { adminCan, getAdminDisplayName, getAdminRole, logoutAdmin } from './auth';
import { ADMIN_PANEL_ROLE_LABELS } from '@petdate/shared';
import '../styles/admin.css';

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; perm?: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { title: 'نمای کلی', items: [{ to: '/admin/dashboard', icon: LayoutDashboard, label: 'داشبورد' }] },
  { title: 'پلتفرم', items: [
    { to: '/admin/users', icon: Users, label: 'کاربران', perm: 'platform.read' },
    { to: '/admin/pets', icon: PawPrint, label: 'پت‌ها', perm: 'platform.read' },
    { to: '/admin/playdates', icon: ClipboardList, label: 'همبازی', perm: 'platform.read' },
    { to: '/admin/consults', icon: Stethoscope, label: 'مشاوره دامپزشک', perm: 'platform.read' },
    { to: '/admin/verification', icon: ShieldCheck, label: 'احراز هویت', perm: 'platform.write' },
    { to: '/admin/marketplace-moderation', icon: ClipboardList, label: 'مدارک و عکس', perm: 'platform.write' },
  ]},
  { title: 'منابع انسانی', items: [
    { to: '/admin/hr/employees', icon: UserRound, label: 'همکاران', perm: 'hr.read' },
    { to: '/admin/hr/contracts', icon: FileText, label: 'قراردادها', perm: 'hr.read' },
    { to: '/admin/hr/ats', icon: Briefcase, label: 'استخدام (ATS)', perm: 'hr.read' },
    { to: '/admin/hr/settings', icon: Settings, label: 'تنظیمات HR', perm: 'hr.read' },
    { to: '/admin/hr/rbac', icon: Shield, label: 'نقش‌ها و دسترسی', perm: 'admin.full' },
  ]},
  { title: 'مالی', items: [
    { to: '/admin/finance', icon: TrendingUp, label: 'داشبورد مالی', perm: 'platform.read' },
    { to: '/admin/finance/pnl', icon: PieChart, label: 'سود و زیان', perm: 'platform.read' },
    { to: '/admin/finance/sales', icon: LineChart, label: 'نمودار فروش', perm: 'platform.read' },
    { to: '/admin/finance/orders', icon: ShoppingBag, label: 'درآمد سفارش', perm: 'platform.read' },
    { to: '/admin/finance/wallet', icon: Wallet, label: 'کیف پول', perm: 'platform.read' },
    { to: '/admin/finance/products', icon: Package, label: 'محصولات برتر', perm: 'platform.read' },
  ]},
  { title: 'فروشگاه', items: [
    { to: '/admin/shop/products', icon: Package, label: 'محصولات', perm: 'platform.read' },
    { to: '/admin/shop/categories', icon: Store, label: 'دسته‌بندی', perm: 'platform.read' },
    { to: '/admin/shop/orders', icon: ShoppingBag, label: 'سفارش‌ها', perm: 'platform.read' },
    { to: '/admin/payments', icon: Wallet, label: 'پرداخت‌ها', perm: 'platform.read' },
  ]},
  { title: 'محتوا و سیستم', items: [
    { to: '/admin/content', icon: Bell, label: 'اعلان‌ها / محتوا', perm: 'platform.write' },
    { to: '/admin/mail', icon: Mail, label: 'ایمیل / SMTP', perm: 'platform.read' },
    { to: '/admin/monitoring', icon: Activity, label: 'مانیتورینگ', perm: 'platform.read' },
    { to: '/admin/logs', icon: ScrollText, label: 'لاگ خطاها', perm: 'platform.read' },
    { to: '/admin/settings', icon: Settings, label: 'تنظیمات', perm: 'platform.write' },
  ]},
];

const TITLE_MAP: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.to, i.label]))
);

function visibleGroups(): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.perm || adminCan(item.perm) || adminCan('admin.full')),
  })).filter((g) => g.items.length > 0);
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const groups = useMemo(() => visibleGroups(), []);
  const pageTitle = useMemo(() => {
    const hit = Object.keys(TITLE_MAP).sort((a, b) => b.length - a.length).find((k) => location.pathname.startsWith(k));
    return hit ? TITLE_MAP[hit] : 'پنل مدیریت';
  }, [location.pathname]);
  const role = getAdminRole();
  const roleLabel =
    getAdminDisplayName() ||
    ADMIN_PANEL_ROLE_LABELS[role] ||
    (role === 'admin' ? 'مدیر' : role);

  return (
    <div className={`admin-app${collapsed ? ' admin-app--collapsed' : ''}`}>
      <div className="admin-shell">
        <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}>
          <div className="admin-brand">
            <AdminWordmark />
          </div>
          <nav className="admin-nav" aria-label="منوی ادمین">
            {groups.map((group) => (
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
            <p className="admin-role-chip">{roleLabel}</p>
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
                <p className="admin-topbar-eyebrow">Pet Date · پیوند</p>
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
