import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown,
  Activity, Bell, Briefcase, Building2, ClipboardList, FileText, Headset, Landmark, LayoutDashboard, LineChart, LogOut, Mail, Menu, Newspaper, Package,
  PawPrint, PieChart, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, Stethoscope,
  Store, Target, Ticket, TrendingUp, UserPlus, UserRound, Users, Wallet, X, ClipboardCheck, BarChart3, Coins, Tags,
  Route, Inbox, HandCoins, Bot, MessageSquare, Star, HeartHandshake, ArrowLeftRight,
} from 'lucide-react';
import type { PlatformNavCounts, SalesNavCounts } from '@petdate/shared';
import { ADMIN_PANEL_ROLE_LABELS } from '@petdate/shared';
import { AdminWordmark } from './AdminWordmark';
import { AdminHeaderNotifications } from './AdminHeaderNotifications';
import { adminCan, getAdminAvatarUrl, getAdminDisplayName, getAdminRole, logoutAdmin, setAdminAvatarUrl } from './auth';
import { adminFetch, formatNumFa } from './api';
import { resolvePublicMediaUrl } from '../lib/api';
import { SalesCallSimProvider } from './pages/sales/SalesCallSim';
import '../styles/admin.css';

type SalesBadgeKey = keyof SalesNavCounts;
type PlatformBadgeKey = keyof PlatformNavCounts;
type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  perm?: string;
  salesBadgeKey?: SalesBadgeKey;
  platformBadgeKey?: PlatformBadgeKey;
};
type NavGroup = { title: string; items: NavItem[] };

function adminInitials(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '؟';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  return t.slice(0, 2);
}

const NAV_GROUPS: NavGroup[] = [
  { title: 'نمای کلی', items: [{ to: '/admin/dashboard', icon: LayoutDashboard, label: 'داشبورد پلتفرم' }] },
  { title: 'جذب و استخدام', items: [
    { to: '/admin/hr/recruitment', icon: LayoutDashboard, label: 'داشبورد جذب', perm: 'ats.read' },
    { to: '/admin/hr/ats', icon: Briefcase, label: 'استخدام و جذب (ATS)', perm: 'ats.read' },
    { to: '/admin/hr/onboarding', icon: UserPlus, label: 'شروع به کار', perm: 'ats.read' },
  ]},
  { title: 'منابع انسانی', items: [
    { to: '/admin/hr', icon: LayoutDashboard, label: 'داشبورد HR', perm: 'hr.read' },
    { to: '/admin/hr/employees', icon: UserRound, label: 'اطلاعات پرسنلی', perm: 'hr.read' },
    { to: '/admin/hr/requests', icon: ClipboardCheck, label: 'تیکت‌های منابع انسانی', perm: 'hr.read' },
    { to: '/admin/hr/service', icon: HandCoins, label: 'ارائه خدمات', perm: 'hr.read' },
    { to: '/admin/hr/reports', icon: BarChart3, label: 'گزارشات', perm: 'hr.read' },
    { to: '/admin/hr/cost', icon: Coins, label: 'تخصیص هزینه نیروی کار', perm: 'hr.read' },
    { to: '/admin/hr/compensation', icon: TrendingUp, label: 'جبران خدمت (مدل درآمدی)', perm: 'hr.read' },
    { to: '/admin/hr/career', icon: Route, label: 'مسیر شغلی و مزایا', perm: 'hr.read' },
    { to: '/admin/hr/cockpit', icon: Inbox, label: 'کارتابل فعالیت', perm: 'hr.read' },
    { to: '/admin/hr/contracts', icon: FileText, label: 'قراردادها', perm: 'hr.read' },
  ]},
  { title: 'دستیار', items: [
    { to: '/admin/hr/armita', icon: Bot, label: 'آرمیتا (دستیار هوشمند)', perm: 'hr.read' },
  ]},
  { title: 'پیکربندی', items: [
    { to: '/admin/hr/settings', icon: Settings, label: 'تنظیمات HR', perm: 'hr.read' },
    { to: '/admin/hr/rbac', icon: Shield, label: 'نقش‌ها و دسترسی', perm: 'admin.full' },
  ]},
  { title: 'پلتفرم', items: [
    { to: '/admin/users', icon: Users, label: 'کاربران', perm: 'platform.read', platformBadgeKey: 'users' },
    { to: '/admin/pets', icon: PawPrint, label: 'پت‌ها', perm: 'platform.read', platformBadgeKey: 'pets' },
    { to: '/admin/playdates', icon: ClipboardList, label: 'همبازی', perm: 'platform.read', platformBadgeKey: 'playdates' },
    { to: '/admin/consults', icon: Stethoscope, label: 'مشاوره دامپزشک', perm: 'platform.read', platformBadgeKey: 'consults' },
    { to: '/admin/verification', icon: ShieldCheck, label: 'احراز هویت', perm: 'platform.write', platformBadgeKey: 'verification' },
    { to: '/admin/marketplace-moderation', icon: ClipboardList, label: 'مدارک و عکس', perm: 'platform.write', platformBadgeKey: 'docs' },
  ]},
  { title: 'فروش', items: [
    { to: '/admin/sales', icon: Inbox, label: 'کارتابل من', perm: 'sales.read' },
    { to: '/admin/sales/leads', icon: Users, label: 'لیدها', perm: 'sales.read', salesBadgeKey: 'leads' },
    { to: '/admin/sales/upgrades', icon: TrendingUp, label: 'آپگریدها', perm: 'upgrade.read', salesBadgeKey: 'upgrades' },
    { to: '/admin/sales/customers', icon: UserRound, label: 'مشتریان', perm: 'sales.read', salesBadgeKey: 'customers' },
    { to: '/admin/sales/tickets', icon: Ticket, label: 'تیکت فروش', perm: 'sales.read', salesBadgeKey: 'tickets' },
    { to: '/admin/sales/calls', icon: Headset, label: 'مرکز تماس و ارزیابی', perm: 'sales.read', salesBadgeKey: 'callsQa' },
    { to: '/admin/sales/settings', icon: Settings, label: 'تنظیمات', perm: 'sales.read' },
    { to: '/admin/sales/reports', icon: LineChart, label: 'گزارشات', perm: 'sales.read' },
    { to: '/admin/sales/pipeline', icon: Target, label: 'پایپ‌لاین', perm: 'sales.read' },
    { to: '/admin/sales/deals', icon: ShoppingBag, label: 'معاملات', perm: 'sales.read' },
    { to: '/admin/sales/products', icon: Package, label: 'محصولات و قیمت', perm: 'sales.read' },
  ]},
  { title: 'باشگاه مشتریان', items: [
    { to: '/admin/crm', icon: LayoutDashboard, label: 'میز کار من', perm: 'crm.read' },
    { to: '/admin/crm/ticketing', icon: Ticket, label: 'تیکتینگ', perm: 'crm.read' },
    { to: '/admin/crm/inbox', icon: Inbox, label: 'اینباکس', perm: 'crm.read' },
    { to: '/admin/crm/customers', icon: HeartHandshake, label: 'مشتریان ۳۶۰', perm: 'crm.read' },
    { to: '/admin/crm/experience', icon: Star, label: 'تجربه مشتری', perm: 'crm.read' },
    { to: '/admin/crm/calls', icon: Headset, label: 'تماس‌ها', perm: 'crm.read' },
    { to: '/admin/crm/cases', icon: ClipboardList, label: 'پرونده‌ها', perm: 'crm.read' },
    { to: '/admin/crm/sms', icon: MessageSquare, label: 'پیامک', perm: 'crm.read' },
    { to: '/admin/crm/qa', icon: ClipboardCheck, label: 'کنترل کیفیت', perm: 'crm.read' },
    { to: '/admin/crm/reports', icon: BarChart3, label: 'گزارش‌ها', perm: 'crm.read' },
    { to: '/admin/crm/settings', icon: Settings, label: 'تنظیمات باشگاه', perm: 'crm.read' },
  ]},
  { title: 'مالی', items: [
    { to: '/admin/finance', icon: TrendingUp, label: 'داشبورد مالی', perm: 'finance.read' },
    { to: '/admin/finance/accounts', icon: Landmark, label: 'حساب‌ها و داده‌های پایه', perm: 'finance.read' },
    { to: '/admin/finance/transactions', icon: ArrowLeftRight, label: 'تراکنش‌ها و دفتر', perm: 'finance.read' },
    { to: '/admin/finance/allocation', icon: Building2, label: 'تخصیص هزینه', perm: 'finance.read' },
    { to: '/admin/finance/pnl', icon: PieChart, label: 'سود و زیان', perm: 'finance.read' },
    { to: '/admin/finance/sales', icon: LineChart, label: 'نمودار فروش', perm: 'finance.read' },
    { to: '/admin/finance/orders', icon: ShoppingBag, label: 'درآمد سفارش', perm: 'finance.read' },
    { to: '/admin/finance/wallet', icon: Wallet, label: 'کیف پول', perm: 'finance.read' },
    { to: '/admin/finance/products', icon: Package, label: 'محصولات برتر', perm: 'finance.read' },
  ]},
  { title: 'فروشگاه', items: [
    { to: '/admin/shop/products', icon: Package, label: 'محصولات', perm: 'shop.read' },
    { to: '/admin/shop/categories', icon: Store, label: 'دسته‌بندی', perm: 'shop.read' },
    { to: '/admin/shop/orders', icon: ShoppingBag, label: 'سفارش‌ها', perm: 'shop.read' },
    { to: '/admin/payments', icon: Wallet, label: 'پرداخت‌ها', perm: 'shop.read' },
  ]},
  { title: 'محتوا و سیستم', items: [
    { to: '/admin/magazine', icon: Newspaper, label: 'مجله و اخبار', perm: 'platform.write' },
    { to: '/admin/content', icon: Bell, label: 'اعلان‌ها / محتوا', perm: 'platform.write' },
    { to: '/admin/mail', icon: Mail, label: 'ایمیل / SMTP', perm: 'platform.read' },
    { to: '/admin/analytics', icon: BarChart3, label: 'آنالیتیکس', perm: 'platform.read' },
    { to: '/admin/tag-manager', icon: Tags, label: 'تگ منیجر', perm: 'platform.read' },
    { to: '/admin/monitoring', icon: Activity, label: 'مانیتورینگ', perm: 'platform.read' },
    { to: '/admin/logs', icon: ScrollText, label: 'لاگ خطاها', perm: 'platform.read' },
    { to: '/admin/settings', icon: Settings, label: 'تنظیمات پلتفرم', perm: 'platform.write' },
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

function itemBadge(
  item: NavItem,
  salesCounts: SalesNavCounts | null,
  platformCounts: PlatformNavCounts | null
): number {
  if (item.salesBadgeKey && salesCounts) {
    const n = Number(salesCounts[item.salesBadgeKey] || 0);
    return Number.isFinite(n) ? n : 0;
  }
  if (item.platformBadgeKey && platformCounts) {
    const n = Number(platformCounts[item.platformBadgeKey] || 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function AdminLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [salesCounts, setSalesCounts] = useState<SalesNavCounts | null>(null);
  const [platformCounts, setPlatformCounts] = useState<PlatformNavCounts | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(() => getAdminAvatarUrl());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const groups = useMemo(() => visibleGroups(), []);
  const activeGroupTitle = useMemo(() => {
    for (const g of groups) {
      for (const it of g.items) {
        if (location.pathname === it.to) return g.title;
        if (it.to !== '/admin' && it.to !== '/admin/dashboard' && location.pathname.startsWith(it.to + '/')) return g.title;
        if (it.to !== '/admin/dashboard' && location.pathname.startsWith(it.to) && location.pathname.length > it.to.length) return g.title;
      }
    }
    // prefix match longest
    let best = '';
    let bestLen = -1;
    for (const g of groups) {
      for (const it of g.items) {
        if (location.pathname.startsWith(it.to) && it.to.length > bestLen) {
          best = g.title;
          bestLen = it.to.length;
        }
      }
    }
    return best || groups[0]?.title || '';
  }, [groups, location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        // گروه‌ها پیش‌فرض بسته؛ فقط گروه صفحهٔ فعال باز می‌ماند
        if (next[g.title] === undefined) next[g.title] = false;
      }
      if (activeGroupTitle) next[activeGroupTitle] = true;
      return next;
    });
  }, [groups, activeGroupTitle]);

  useEffect(() => {
    void adminFetch<{ displayName?: string; avatarUrl?: string | null }>('/api/admin/auth/me')
      .then((data) => {
        const url = String(data.avatarUrl || '').trim();
        setAdminAvatarUrl(url || null);
        setAvatarUrl(url);
        setAvatarFailed(false);
        const name = String(data.displayName || '').trim();
        if (name) {
          try {
            sessionStorage.setItem('petdate_admin_name', name);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* keep session cache */
      });
  }, []);

  const refreshNavCounts = useCallback(() => {
    if (adminCan('sales.read') || adminCan('admin.full')) {
      void adminFetch<SalesNavCounts>('/api/admin/sales/nav-counts', { cache: 'no-store' as RequestCache })
        .then(setSalesCounts)
        .catch(() => setSalesCounts(null));
    } else {
      setSalesCounts(null);
    }
    if (adminCan('platform.read') || adminCan('platform.write') || adminCan('admin.full')) {
      void adminFetch<PlatformNavCounts>('/api/admin/platform/nav-counts', { cache: 'no-store' as RequestCache })
        .then(setPlatformCounts)
        .catch(() => setPlatformCounts(null));
    } else {
      setPlatformCounts(null);
    }
  }, []);
  useEffect(() => {
    refreshNavCounts();
    const t = window.setInterval(refreshNavCounts, 45_000);
    return () => window.clearInterval(t);
  }, [refreshNavCounts, location.pathname]);
  const pageTitle = useMemo(() => {
    const hit = Object.keys(TITLE_MAP).sort((a, b) => b.length - a.length).find((k) => location.pathname.startsWith(k));
    return hit ? TITLE_MAP[hit] : 'پنل مدیریت';
  }, [location.pathname]);
  const role = getAdminRole();
  const roleLabel =
    getAdminDisplayName() ||
    ADMIN_PANEL_ROLE_LABELS[role] ||
    (role === 'admin' ? 'مدیر' : role);
  const resolvedAvatar = resolvePublicMediaUrl(avatarUrl);
  const showAvatarImg = Boolean(resolvedAvatar) && !avatarFailed;

  return (
    <div className={`admin-app${collapsed ? ' admin-app--collapsed' : ''}`}>
      <div className="admin-shell">
        <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}>
          <div className="admin-brand">
            <AdminWordmark />
            <div className="admin-brand-sub" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              پیوند · منابع انسانی
            </div>
          </div>
          <nav className="admin-nav" aria-label="منوی ادمین">
            {groups.map((group) => {
              const isOpen = Boolean(openGroups[group.title]);
              const groupBadge = group.items.reduce(
                (sum, item) => sum + itemBadge(item, salesCounts, platformCounts),
                0
              );
              return (
                <div
                  key={group.title}
                  className={`admin-nav-group${isOpen ? ' is-open' : ' is-collapsed'}${activeGroupTitle === group.title ? ' is-active-group' : ''}`}
                >
                  <button
                    type="button"
                    className="admin-nav-group-title"
                    aria-expanded={isOpen}
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                  >
                    <span>{group.title}</span>
                    <span className="admin-nav-group-meta">
                      {groupBadge > 0 ? <span className="admin-nav-count">{formatNumFa(groupBadge)}</span> : null}
                      <ChevronDown size={14} className={`admin-nav-chevron${isOpen ? ' is-open' : ''}`} aria-hidden />
                    </span>
                  </button>
                  <div className="admin-nav-group-items" hidden={!isOpen && !collapsed}>
                      {group.items.map((item) => {
                        const badge = itemBadge(item, salesCounts, platformCounts);
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/admin/hr' || item.to === '/admin/sales' || item.to === '/admin/crm' || item.to === '/admin/dashboard' || item.to === '/admin/finance'}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
                          >
                            <item.icon size={18} strokeWidth={2} />
                            <span className="admin-nav-item-label">{item.label}</span>
                            {badge > 0 ? <span className="admin-nav-count">{formatNumFa(badge)}</span> : null}
                          </NavLink>
                        );
                      })}
                  </div>
                </div>
              );
            })}
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
              <AdminHeaderNotifications />
              <span className="admin-topbar-chip">RTL · fa</span>
              <span className="admin-topbar-chip admin-topbar-chip--mint admin-live-pulse">live DB</span>
            </div>
            {/* Far visual-left of RTL topbar (last flex child) — outside end cluster so it cannot clip */}
            <div className="admin-topbar-user" title={roleLabel} aria-label={`کاربر واردشده: ${roleLabel}`}>
              {showAvatarImg ? (
                <img
                  className="admin-topbar-avatar admin-topbar-avatar--photo"
                  src={resolvedAvatar!}
                  alt=""
                  width={40}
                  height={40}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="admin-topbar-avatar" aria-hidden>
                  {adminInitials(roleLabel)}
                </span>
              )}
              <span className="admin-topbar-user-name">{roleLabel}</span>
            </div>
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <SalesCallSimProvider>
      <AdminLayoutInner />
    </SalesCallSimProvider>
  );
}
