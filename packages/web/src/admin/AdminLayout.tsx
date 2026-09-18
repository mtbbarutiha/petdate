import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminRouteOutlet } from './AdminRouteOutlet';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import type { CrmNavCounts, FinanceNavCounts, PlatformNavCounts, SalesNavCounts } from '@petdate/shared';
import { ADMIN_PANEL_ROLE_LABELS } from '@petdate/shared';
import { AdminWordmark } from './AdminWordmark';
import { AdminHeaderNotifications } from './AdminHeaderNotifications';
import { adminCan, getAdminAvatarUrl, getAdminDisplayName, getAdminRole, logoutAdmin, setAdminAvatarUrl } from './auth';
import { adminFetch, formatNumFa } from './api';
import { resolvePublicMediaUrl } from '../lib/api';
import { SalesCallSimProvider } from './pages/sales/SalesCallSim';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { tr, useI18n } from '../i18n';
import {
  ADMIN_NAV_END_HREFS,
  ADMIN_NAV_GROUPS,
  findActiveGroupTitle,
  itemBadge,
  pageTitleKey,
  type AdminNavGroup,
} from './adminNav';
import '../styles/admin.css';

function adminInitials(label?: string | null): string {
  const t = String(label ?? '').trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.slice(0, 2);
  return t.slice(0, 2);
}

const ADMIN_NAV_MQ = '(max-width: 960px)';

function readIsMobileNav(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(ADMIN_NAV_MQ).matches;
}

function visibleGroups(): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.perm || adminCan(item.perm) || adminCan('admin.full')),
  })).filter((g) => g.items.length > 0);
}

function AdminLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [isMobileNav, setIsMobileNav] = useState(readIsMobileNav);
  const [navOpen, setNavOpen] = useState(() => !readIsMobileNav());
  const [salesCounts, setSalesCounts] = useState<SalesNavCounts | null>(null);
  const [platformCounts, setPlatformCounts] = useState<PlatformNavCounts | null>(null);
  const [financeCounts, setFinanceCounts] = useState<FinanceNavCounts | null>(null);
  const [crmCounts, setCrmCounts] = useState<CrmNavCounts | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(() => getAdminAvatarUrl());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const groups = useMemo(() => visibleGroups(), []);
  const activeGroupTitle = useMemo(
    () => findActiveGroupTitle(location.pathname, groups),
    [groups, location.pathname]
  );

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
    if (
      adminCan('platform.read') ||
      adminCan('platform.write') ||
      adminCan('finance.read') ||
      adminCan('shop.read') ||
      adminCan('admin.full')
    ) {
      void adminFetch<PlatformNavCounts>('/api/admin/platform/nav-counts', { cache: 'no-store' as RequestCache })
        .then(setPlatformCounts)
        .catch(() => setPlatformCounts(null));
    } else {
      setPlatformCounts(null);
    }
    if (adminCan('finance.read') || adminCan('admin.full')) {
      void adminFetch<FinanceNavCounts>('/api/admin/finance-os/nav-counts', { cache: 'no-store' as RequestCache })
        .then(setFinanceCounts)
        .catch(() => setFinanceCounts(null));
    } else {
      setFinanceCounts(null);
    }
    if (adminCan('crm.read') || adminCan('admin.full')) {
      void adminFetch<CrmNavCounts>('/api/admin/crm/nav-counts', { cache: 'no-store' as RequestCache })
        .then(setCrmCounts)
        .catch(() => setCrmCounts(null));
    } else {
      setCrmCounts(null);
    }
  }, []);
  useEffect(() => {
    refreshNavCounts();
    const t = window.setInterval(refreshNavCounts, 90_000);
    return () => window.clearInterval(t);
  }, [refreshNavCounts, location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia(ADMIN_NAV_MQ);
    const sync = () => {
      const mobile = mq.matches;
      setIsMobileNav(mobile);
      setNavOpen(!mobile);
    };
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* Close overlay drawer on navigation (deep links / back). Desktop stays open. */
  useEffect(() => {
    if (isMobileNav) setNavOpen(false);
  }, [location.pathname, isMobileNav]);

  useEffect(() => {
    if (!navOpen || !isMobileNav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [navOpen, isMobileNav]);

  const resolvedPageTitleKey = useMemo(() => pageTitleKey(location.pathname), [location.pathname]);
  const role = getAdminRole();
  const roleLabel =
    getAdminDisplayName() ||
    tr(ADMIN_PANEL_ROLE_LABELS[role] || (role === 'admin' ? t('admin.manager') : role || ''));
  const resolvedAvatar = resolvePublicMediaUrl(avatarUrl);
  const showAvatarImg = Boolean(resolvedAvatar) && !avatarFailed;

  return (
    <div className={`admin-app${navOpen ? ' admin-app--nav-open' : ' admin-app--nav-closed'}`}>
      <div className="admin-shell">
        <aside
          id="admin-mobile-nav"
          className={`admin-sidebar${navOpen ? ' is-open' : ''}`}
          aria-hidden={!navOpen}
        >
          <div className="admin-brand">
            <div className="admin-brand-row">
              <AdminWordmark />
              <button
                type="button"
                className={`admin-nav-toggle${navOpen ? ' is-open' : ''}`}
                onClick={() => setNavOpen((v) => !v)}
                aria-label={navOpen ? t('admin.closeMenu') : t('admin.menu')}
                aria-expanded={navOpen}
                aria-controls="admin-mobile-nav"
              >
                {navOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
              </button>
            </div>
            <div className="admin-brand-sub" style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {t('admin.brandSub')}
            </div>
          </div>
          <nav className="admin-nav" aria-label={t('admin.menuAria')}>
            {groups.map((group) => {
              const isOpen = Boolean(openGroups[group.titleKey]);
              const groupBadge = group.items.reduce(
                (sum, item) => sum + itemBadge(item, salesCounts, platformCounts, financeCounts, crmCounts),
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
                  <div className="admin-nav-group-items" hidden={!isOpen}>
                      {group.items.map((item) => {
                        const badge = itemBadge(item, salesCounts, platformCounts, financeCounts, crmCounts);
                        return (
                          <NavLink
                            key={`${item.to}:${item.labelKey}`}
                            to={item.to}
                            end={ADMIN_NAV_END_HREFS.has(item.to)}
                            onClick={() => { if (isMobileNav) setNavOpen(false); }}
                            className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}${item.tone ? ` admin-nav-item--${item.tone}` : ''}`}
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
        {navOpen && isMobileNav ? <button type="button" className="admin-backdrop" aria-label={t('admin.closeMenu')} onClick={() => setNavOpen(false)} /> : null}
        <div className="admin-main">
          <header className="admin-topbar">
            <div className="admin-topbar-start">
              {!navOpen ? (
                <button
                  type="button"
                  className="admin-nav-toggle admin-nav-toggle--reopen"
                  onClick={() => setNavOpen(true)}
                  aria-label={t('admin.menu')}
                  aria-expanded={false}
                  aria-controls="admin-mobile-nav"
                >
                  <Menu size={18} strokeWidth={2} />
                </button>
              ) : null}
              <div>
                <p className="admin-topbar-eyebrow">Pet Date · {t('admin.peyvand')}</p>
                <h1 className="admin-topbar-title">{t(resolvedPageTitleKey)}</h1>
              </div>
            </div>
            <div className="admin-topbar-end">
              <LanguageToggle compact className="admin-lang-toggle" />
              <ThemeToggle compact className="admin-theme-toggle" />
              <AdminHeaderNotifications />
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
          <AdminRouteOutlet />
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
