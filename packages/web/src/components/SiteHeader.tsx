import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@petdate/shared';
import { useI18n } from '../i18n';
import { LanguageToggle } from './LanguageToggle';
import { NavUserCluster } from './NavUserCluster';
import { SiteHeaderLinkView } from './SiteHeaderLinkView';
import { ThemeToggle } from './ThemeToggle';
import { IconGamepad, IconPaw } from './icons/ChromeIcons';
import { type SiteHeaderLink } from './siteHeaderLinks';

const LazySiteDesktopNav = lazy(() =>
  import('./SiteDesktopNav').then((m) => ({ default: m.SiteDesktopNav })),
);

function PawIcon({ size = 14 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <IconPaw size={size} />
    </span>
  );
}

/** Guest login is the cluster icon (pepito-nav-login-icon). Never also render text login. */
function isGuestLoginTextAction(label: string | undefined, to: string | undefined, loginLabel: string): boolean {
  const n = (label ?? '').trim().toLowerCase();
  const login = loginLabel.trim().toLowerCase();
  if (n && (n === login || n === 'login' || n === 'sign in')) return true;
  return Boolean(to && /\/auth\/login/.test(to));
}

export type SiteHeaderProps = {
  scrolled?: boolean;
  className?: string;
  sectionLinks?: SiteHeaderLink[];
  showCart?: boolean;
  showOrders?: boolean;
  showDesktopNav?: boolean;
  /**
   * Mobile Events (ایونت‌ها) pill beside the logo.
   * Shop pages hide this — Events lives in the profile menu instead.
   */
  showMobileEvents?: boolean;
  /** Defer SiteDesktopNav until ≥860px (landing LCP / TBT). */
  deferDesktopNav?: boolean;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  ctaLabel?: string;
  ctaTo?: string;
  extras?: ReactNode;
  /**
   * Shop search slot.
   * Mobile: full-width row under the logo + tools (must not collide with icons).
   * Desktop: renders in the primary row beside the logo (shop has no section links).
   */
  brandBelow?: ReactNode;
  logoSrc?: string;
  logoSrcSet?: string;
  logoSizes?: string;
  logoWidth?: number;
  logoHeight?: number;
};

/**
 * Shared site header: leading (brand + primary links) | utilities.
 * Two flex children under `.pepito-nav-main` so RTL space-between parks
 * logo/nav at the physical right and utilities flush at the physical left.
 * Shop search: full-width under logo/tools on mobile; inline beside logo on desktop.
 * Shop mode: logo + search only on the leading side (no Events / desktop nav).
 */
export function SiteHeader({
  scrolled = false,
  className = '',
  sectionLinks = [],
  showCart = true,
  showOrders = false,
  showDesktopNav = true,
  showMobileEvents = true,
  deferDesktopNav = false,
  actionLabel,
  actionTo,
  onAction,
  ctaLabel,
  ctaTo,
  extras,
  brandBelow,
  logoSrc = '/pepito/img/logo.png',
  logoSrcSet,
  logoSizes,
  logoWidth,
  logoHeight,
}: SiteHeaderProps) {
  const { t } = useI18n();
  const [wideEnoughForNav, setWideEnoughForNav] = useState(!deferDesktopNav);
  const [compactChrome, setCompactChrome] = useState(Boolean(brandBelow));

  useEffect(() => {
    // Always track viewport so shop search can sit under the logo on mobile
    // and inline before Orders on desktop (deferDesktopNav only delays nav chunk).
    const mq = window.matchMedia('(min-width: 860px)');
    const sync = () => setWideEnoughForNav(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [deferDesktopNav]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 859px)');
    const sync = () => setCompactChrome(Boolean(brandBelow) || mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [brandBelow]);

  const isDesktop = wideEnoughForNav;
  const mobileSearch = brandBelow && !isDesktop ? brandBelow : null;
  const desktopSearch = brandBelow && isDesktop ? brandBelow : null;

  const headerClass = `pepito-nav${scrolled ? ' is-scrolled' : ''}${brandBelow ? ' pepito-nav--with-search' : ''}${mobileSearch ? ' pepito-nav--mobile-search' : ''}${desktopSearch ? ' pepito-nav--desktop-search' : ''}${className ? ` ${className}` : ''}`;
  const showTextAction =
    Boolean(actionLabel) && !isGuestLoginTextAction(actionLabel, actionTo, t('common.login'));

  return (
    <header className={headerClass}>
      <div className="pepito-nav-main">
        <div className="pepito-nav-leading">
          <div className="pepito-nav-brand">
            <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
              <img
                src={logoSrc}
                alt={BRAND.displayName}
                {...(logoSrcSet ? { srcSet: logoSrcSet } : {})}
                {...(logoSizes ? { sizes: logoSizes } : {})}
                {...(logoWidth ? { width: logoWidth } : {})}
                {...(logoHeight ? { height: logoHeight } : {})}
                decoding="async"
              />
            </Link>
          </div>

          {!isDesktop && showMobileEvents ? (
            <Link
              to="/events"
              className="pepito-nav-mobile-events"
              data-testid="nav-mobile-events"
              aria-label={t('nav.games')}
            >
              <IconGamepad size={18} />
              <span>{t('nav.games')}</span>
            </Link>
          ) : null}

          {isDesktop ? (
            <div className="pepito-nav-primary">
              {showDesktopNav ? (
                <Suspense fallback={null}>
                  <LazySiteDesktopNav />
                </Suspense>
              ) : null}
              {desktopSearch ? (
                <div className="pepito-nav-desktop-search" data-testid="nav-desktop-search">
                  {desktopSearch}
                </div>
              ) : null}
              {sectionLinks.length > 0 ? (
                <nav className="pepito-nav-links pepito-nav-section-inline" aria-label={t('nav.sections')}>
                  {sectionLinks.map((link) => (
                    <SiteHeaderLinkView key={link.key} link={link} />
                  ))}
                </nav>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="pepito-nav-actions">
          <NavUserCluster showCart={showCart} showOrders={showOrders} />
          <LanguageToggle compact={compactChrome} />
          <ThemeToggle compact={compactChrome} />
          {showTextAction && onAction ? (
            <button type="button" className="pepito-nav-login pepito-nav-login--btn" onClick={onAction}>
              {actionLabel}
            </button>
          ) : showTextAction && actionTo ? (
            <Link to={actionTo} className="pepito-nav-login">
              {actionLabel}
            </Link>
          ) : null}
          {ctaLabel && ctaTo ? (
            <Link to={ctaTo} className="pepito-btn pepito-btn--nav">
              <PawIcon />
              {ctaLabel}
            </Link>
          ) : null}
          {extras}
        </div>
      </div>
      {mobileSearch ? (
        <div className="pepito-nav-search-row" data-testid="nav-mobile-search">
          {mobileSearch}
        </div>
      ) : null}
    </header>
  );
}
