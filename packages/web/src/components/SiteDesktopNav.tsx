import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { loginPath } from '../lib/authRedirect';
import { filterNavByPlatformConfig, SITE_NAV_DESKTOP_GUEST, siteNavDesktopForUser } from '../lib/siteNav';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

/**
 * Desktop primary actions (≥860px) — follow active primary role.
 * Owner: هم بازی / شاپ / بازی‌ها (پت‌های من is in LandingChrome app nav)
 * Vet: پنل پزشک / گفتگو / شاپ / بازی‌ها
 * Wallet chip + circular profile avatar live in NavUserCluster.
 */
export function SiteDesktopNav() {
  const { pathname } = useLocation();
  const { isLoggedIn, user } = useAuthStore();
  const { t, dir } = useI18n();
  const platform = usePlatformConfig();

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname === '/chats' ||
    pathname.startsWith('/chats/') ||
    pathname.startsWith('/vet-chats')
  ) {
    return null;
  }

  const items = filterNavByPlatformConfig(
    isLoggedIn ? siteNavDesktopForUser(user) : SITE_NAV_DESKTOP_GUEST,
    platform
  );

  return (
    <nav className="pepito-site-desktop-nav" aria-label={t('nav.shortcuts')}>
      {items.map((item) => {
        const href = item.gate && !isLoggedIn ? loginPath(item.to) : item.to;
        const active = item.match?.(pathname) ?? pathname === item.to;
        return (
          <Link
            key={item.key}
            to={href}
            data-testid={`nav-${item.key}`}
            className={`pepito-site-desktop-nav-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            dir={dir}
          >
            <item.icon size={16} strokeWidth={2.25} aria-hidden />
            <span>{t(`nav.${item.key}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
