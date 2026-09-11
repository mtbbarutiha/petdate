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
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { useI18n } from '../i18n';
import '../styles/admin.css';

type SalesBadgeKey = keyof SalesNavCounts;
type PlatformBadgeKey = keyof PlatformNavCounts;
type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  perm?: string;
  salesBadgeKey?: SalesBadgeKey;
  platformBadgeKey?: PlatformBadgeKey;
};
type NavGroup = { titleKey: string; items: NavItem[] };

function adminInitials(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '؟';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  return t.slice(0, 2);
}

const NAV_GROUPS: NavGroup[] = [
  { titleKey: 'admin.overview', items: [{ to: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'admin.platformDashboard' }] },
  { titleKey: 'admin.ats', items: [
    { to: '/admin/hr/recruitment', icon: LayoutDashboard, labelKey: 'admin.atsDashboard', perm: 'ats.read' },
    { to: '/admin/hr/ats', icon: Briefcase, labelKey: 'admin.atsJobs', perm: 'ats.read' },
    { to: '/admin/hr/onboarding', icon: UserPlus, labelKey: 'admin.onboarding', perm: 'ats.read' },
  ]},
  { titleKey: 'admin.hr', items: [
    { to: '/admin/hr', icon: LayoutDashboard, labelKey: 'admin.hrDashboard', perm: 'hr.read' },
    { to: '/admin/hr/employees', icon: UserRound, labelKey: 'admin.hrEmployees', perm: 'hr.read' },
    { to: '/admin/hr/requests', icon: ClipboardCheck, labelKey: 'admin.hrTickets', perm: 'hr.read' },
    { to: '/admin/hr/service', icon: HandCoins, labelKey: 'admin.hrService', perm: 'hr.read' },
    { to: '/admin/hr/reports', icon: BarChart3, labelKey: 'admin.hrReports', perm: 'hr.read' },
    { to: '/admin/hr/cost', icon: Coins, labelKey: 'admin.hrCost', perm: 'hr.read' },
    { to: '/admin/hr/compensation', icon: TrendingUp, labelKey: 'admin.hrComp', perm: 'hr.read' },
    { to: '/admin/hr/career', icon: Route, labelKey: 'admin.hrCareer', perm: 'hr.read' },
    { to: '/admin/hr/cockpit', icon: Inbox, labelKey: 'admin.hrCockpit', perm: 'hr.read' },
    { to: '/admin/hr/contracts', icon: FileText, labelKey: 'admin.hrContracts', perm: 'hr.read' },
  ]},
  { titleKey: 'admin.assistant', items: [
    { to: '/admin/hr/armita', icon: Bot, labelKey: 'admin.armita', perm: 'hr.read' },
  ]},
  { titleKey: 'admin.config', items: [
    { to: '/admin/hr/settings', icon: Settings, labelKey: 'admin.hrSettings', perm: 'hr.read' },
    { to: '/admin/hr/rbac', icon: Shield, labelKey: 'admin.rbac', perm: 'admin.full' },
  ]},
  { titleKey: 'admin.platform', items: [
    { to: '/admin/users', icon: Users, labelKey: 'admin.users', perm: 'platform.read', platformBadgeKey: 'users' },
    { to: '/admin/pets', icon: PawPrint, labelKey: 'admin.pets', perm: 'platform.read', platformBadgeKey: 'pets' },
    { to: '/admin/playdates', icon: ClipboardList, labelKey: 'admin.playdates', perm: 'platform.read', platformBadgeKey: 'playdates' },
    { to: '/admin/consults', icon: Stethoscope, labelKey: 'admin.consults', perm: 'platform.read', platformBadgeKey: 'consults' },
    { to: '/admin/verification', icon: ShieldCheck, labelKey: 'admin.verification', perm: 'platform.write', platformBadgeKey: 'verification' },
    { to: '/admin/marketplace-moderation', icon: ClipboardList, labelKey: 'admin.docsPhotos', perm: 'platform.write', platformBadgeKey: 'docs' },
  ]},
  { titleKey: 'admin.sales', items: [
    { to: '/admin/sales', icon: Inbox, labelKey: 'admin.myInbox', perm: 'sales.read' },
    { to: '/admin/sales/leads', icon: Users, labelKey: 'admin.leads', perm: 'sales.read', salesBadgeKey: 'leads' },
    { to: '/admin/sales/pet-purchase-requests', icon: PawPrint, labelKey: 'admin.petPurchaseRequests', perm: 'sales.read', salesBadgeKey: 'petPurchaseRequests' },
    { to: '/admin/sales/upgrades', icon: TrendingUp, labelKey: 'admin.upgrades', perm: 'upgrade.read', salesBadgeKey: 'upgrades' },
    { to: '/admin/sales/customers', icon: UserRound, labelKey: 'admin.customers', perm: 'sales.read', salesBadgeKey: 'customers' },
    { to: '/admin/sales/tickets', icon: Ticket, labelKey: 'admin.salesTickets', perm: 'sales.read', salesBadgeKey: 'tickets' },
    { to: '/admin/sales/calls', icon: Headset, labelKey: 'admin.callCenter', perm: 'sales.read', salesBadgeKey: 'callsQa' },
    { to: '/admin/sales/settings', icon: Settings, labelKey: 'admin.settings', perm: 'sales.read' },
    { to: '/admin/sales/reports', icon: LineChart, labelKey: 'admin.reports', perm: 'sales.read' },
    { to: '/admin/sales/pipeline', icon: Target, labelKey: 'admin.pipeline', perm: 'sales.read' },
    { to: '/admin/sales/deals', icon: ShoppingBag, labelKey: 'admin.deals', perm: 'sales.read' },
    { to: '/admin/sales/products', icon: Package, labelKey: 'admin.productsPricing', perm: 'sales.read' },
  ]},
  { titleKey: 'admin.club', items: [
    { to: '/admin/crm', icon: LayoutDashboard, labelKey: 'admin.myDesk', perm: 'crm.read' },
    { to: '/admin/crm/ticketing', icon: Ticket, labelKey: 'admin.ticketing', perm: 'crm.read' },
    { to: '/admin/crm/inbox', icon: Inbox, labelKey: 'admin.inbox', perm: 'crm.read' },
    { to: '/admin/crm/customers', icon: HeartHandshake, labelKey: 'admin.customers360', perm: 'crm.read' },
    { to: '/admin/crm/experience', icon: Star, labelKey: 'admin.cx', perm: 'crm.read' },
    { to: '/admin/crm/calls', icon: Headset, labelKey: 'admin.calls', perm: 'crm.read' },
    { to: '/admin/crm/cases', icon: ClipboardList, labelKey: 'admin.cases', perm: 'crm.read' },
    { to: '/admin/crm/sms', icon: MessageSquare, labelKey: 'admin.sms', perm: 'crm.read' },
    { to: '/admin/crm/qa', icon: ClipboardCheck, labelKey: 'admin.qa', perm: 'crm.read' },
    { to: '/admin/crm/reports', icon: BarChart3, labelKey: 'admin.clubReports', perm: 'crm.read' },
    { to: '/admin/crm/settings', icon: Settings, labelKey: 'admin.clubSettings', perm: 'crm.read' },
  ]},
  { titleKey: 'admin.finance', items: [
    { to: '/admin/finance', icon: TrendingUp, labelKey: 'admin.financeDashboard', perm: 'finance.read' },
    { to: '/admin/finance/accounts', icon: Landmark, labelKey: 'admin.accounts', perm: 'finance.read' },
    { to: '/admin/finance/transactions', icon: ArrowLeftRight, labelKey: 'admin.transactions', perm: 'finance.read' },
    { to: '/admin/finance/allocation', icon: Building2, labelKey: 'admin.allocation', perm: 'finance.read' },
    { to: '/admin/finance/pnl', icon: PieChart, labelKey: 'admin.pnl', perm: 'finance.read' },
    { to: '/admin/finance/sales', icon: LineChart, labelKey: 'admin.salesChart', perm: 'finance.read' },
    { to: '/admin/finance/orders', icon: ShoppingBag, labelKey: 'admin.orderRevenue', perm: 'finance.read' },
    { to: '/admin/finance/wallet', icon: Wallet, labelKey: 'admin.wallet', perm: 'finance.read' },
    { to: '/admin/finance/products', icon: Package, labelKey: 'admin.topProducts', perm: 'finance.read' },
  ]},
  { titleKey: 'admin.store', items: [
    { to: '/admin/shop/products', icon: Package, labelKey: 'admin.products', perm: 'shop.read' },
    { to: '/admin/shop/categories', icon: Store, labelKey: 'admin.categories', perm: 'shop.read' },
    { to: '/admin/shop/orders', icon: ShoppingBag, labelKey: 'admin.orders', perm: 'shop.read' },
    { to: '/admin/payments', icon: Wallet, labelKey: 'admin.payments', perm: 'shop.read' },
  ]},
  { titleKey: 'admin.contentSystem', items: [
    { to: '/admin/magazine', icon: Newspaper, labelKey: 'admin.magazineNews', perm: 'platform.write' },
    { to: '/admin/content', icon: Bell, labelKey: 'admin.noticesContent', perm: 'platform.write' },
    { to: '/admin/mail', icon: Mail, labelKey: 'admin.mailSmtp', perm: 'platform.read' },
    { to: '/admin/analytics', icon: BarChart3, labelKey: 'admin.analytics', perm: 'platform.read' },
    { to: '/admin/tag-manager', icon: Tags, labelKey: 'admin.tagManager', perm: 'platform.read' },
    { to: '/admin/monitoring', icon: Activity, labelKey: 'admin.monitoring', perm: 'platform.read' },
    { to: '/admin/logs', icon: ScrollText, labelKey: 'admin.errorLogs', perm: 'platform.read' },
    { to: '/admin/settings', icon: Settings, labelKey: 'admin.platformSettings', perm: 'platform.write' },
  ]},
];

const TITLE_KEY_MAP: Record<string, string> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.to, i.labelKey]))
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
  const { t } = useI18n();
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
        if (location.pathname === it.to) return g.titleKey;
        if (it.to !== '/admin' && it.to !== '/admin/dashboard' && location.pathname.startsWith(it.to + '/')) return g.titleKey;
        if (it.to !== '/admin/dashboard' && location.pathname.startsWith(it.to) && location.pathname.length > it.to.length) return g.titleKey;
      }
    }
    // prefix match longest
    let best = '';
    let bestLen = -1;
    for (const g of groups) {
      for (const it of g.items) {
        if (location.pathname.startsWith(it.to) && it.to.length > bestLen) {
          best = g.titleKey;
          bestLen = it.to.length;
        }
      }
    }
    return best || groups[0]?.titleKey || '';
  }, [groups, location.pathname]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        // گروه‌ها پیش‌فرض بسته؛ فقط گروه صفحهٔ فعال باز می‌ماند
        if (next[g.titleKey] === undefined) next[g.titleKey] = false;
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

  /* Close mobile drawer on navigation (deep links / back). */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const pageTitleKey = useMemo(() => {
    const hit = Object.keys(TITLE_KEY_MAP).sort((a, b) => b.length - a.length).find((k) => location.pathname.startsWith(k));
    return hit ? TITLE_KEY_MAP[hit]! : 'admin.platformDashboard';
  }, [location.pathname]);
  const role = getAdminRole();
  const roleLabel =
    getAdminDisplayName() ||
    ADMIN_PANEL_ROLE_LABELS[role] ||
    (role === 'admin' ? t('admin.manager') : role);
  const resolvedAvatar = resolvePublicMediaUrl(avatarUrl);
  const showAvatarImg = Boolean(resolvedAvatar) && !avatarFailed;

  return (
    <div className={`admin-app${collapsed ? ' admin-app--collapsed' : ''}${mobileOpen ? ' admin-app--nav-open' : ''}`}>
      <div className="admin-shell">
        <aside
          id="admin-mobile-nav"
          className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}
        >
          <div className="admin-brand">
            <AdminWordmark />
            <div className="admin-brand-sub" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {t('admin.brandSub')}
            </div>
          </div>
          <nav className="admin-nav" aria-label={t('admin.menuAria')}>
            {groups.map((group) => {
              const isOpen = Boolean(openGroups[group.titleKey]);
              const groupBadge = group.items.reduce(
                (sum, item) => sum + itemBadge(item, salesCounts, platformCounts),
                0
              );
              return (
                <div
                  key={group.titleKey}
                  className={`admin-nav-group${isOpen ? ' is-open' : ' is-collapsed'}${activeGroupTitle === group.titleKey ? ' is-active-group' : ''}`}
                >
                  <button
                    type="button"
                    className="admin-nav-group-title"
                    aria-expanded={isOpen}
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [group.titleKey]: !prev[group.titleKey] }))}
                  >
                    <span>{t(group.titleKey)}</span>
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
                            <span className="admin-nav-item-label">{t(item.labelKey)}</span>
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
              <LogOut size={16} /> {t('admin.logout')}
            </button>
          </div>
        </aside>
        {mobileOpen ? <button type="button" className="admin-backdrop" aria-label={t('admin.closeMenu')} onClick={() => setMobileOpen(false)} /> : null}
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-start">
              <button
                type="button"
                className="admin-icon-btn admin-icon-btn--mobile"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label={t('admin.menu')}
                aria-expanded={mobileOpen}
                aria-controls="admin-mobile-nav"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <button type="button" className="admin-icon-btn admin-icon-btn--desktop" onClick={() => setCollapsed((v) => !v)} aria-label={t('admin.collapseSidebar')}>
                <Menu size={18} />
              </button>
              <div>
                <p className="admin-topbar-eyebrow">Pet Date · {t('admin.peyvand')}</p>
                <h1 className="admin-topbar-title">{t(pageTitleKey)}</h1>
              </div>
            </div>
            <div className="admin-topbar-end">
              <LanguageToggle compact className="admin-lang-toggle" />
              <ThemeToggle compact className="admin-theme-toggle" />
              <AdminHeaderNotifications />
              <span className="admin-topbar-chip admin-topbar-chip--mint admin-live-pulse">live DB</span>
            </div>
            {/* Far visual-left of RTL topbar (last flex child) — outside end cluster so it cannot clip */}
            <div className="admin-topbar-user" title={roleLabel} aria-label={t('admin.signedInAs', { name: roleLabel })}>
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
