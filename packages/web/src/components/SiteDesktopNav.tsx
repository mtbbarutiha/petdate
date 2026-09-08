import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { loginPath } from '../lib/authRedirect';
import { SITE_NAV_DESKTOP_GUEST, siteNavDesktopForUser } from '../lib/siteNav';

/**
 * Desktop primary actions (≥860px) — follow active primary role.
 * Owner: شاپ / هم بازی (پت‌های من is in LandingChrome app nav)
 * Vet: شاپ / پنل پزشک / گفتگو
 * Wallet chip + circular profile avatar live in NavUserCluster.
 */
export function SiteDesktopNav() {
  const { pathname } = useLocation();
  const { isLoggedIn, user } = useAuthStore();

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

  const items = isLoggedIn ? siteNavDesktopForUser(user) : SITE_NAV_DESKTOP_GUEST;

  return (
    <nav className="pepito-site-desktop-nav" aria-label="میانبرهای اصلی">
      {items.map((item) => {
        const href = item.gate && !isLoggedIn ? loginPath(item.to) : item.to;
        const active = item.match?.(pathname) ?? pathname === item.to;
        return (
          <Link
            key={item.key}
            to={href}
            className={`pepito-site-desktop-nav-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            dir="rtl"
          >
            <item.icon size={16} strokeWidth={2.25} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
