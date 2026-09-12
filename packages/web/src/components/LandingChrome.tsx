import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND, primaryRole } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { SiteFooter } from './SiteFooter';
import { NavUserCluster } from './NavUserCluster';
import { SiteDesktopNav } from './SiteDesktopNav';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { PlatformBanners } from './PlatformBanners';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

const BANNER_IMG = '/pepito/uploads/3.jpg';

function PawIcon({ size = 14 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

export interface LandingChromeProps {
  children: ReactNode;
  /** Slim continuity banner title (defaults to brand) */
  bannerTitle?: string;
  bannerLead?: string;
  bannerImage?: string;
  /** Right-side nav action (e.g. back link) */
  actionLabel?: string;
  actionTo?: string;
  /** When set, action renders as a button (e.g. logout) instead of a link */
  onAction?: () => void;
  /** Extra action — primary CTA style */
  ctaLabel?: string;
  ctaTo?: string;
  /** When true, show app destinations in the top nav instead of landing anchors */
  appNav?: boolean;
  /** Hide the photo banner (app shell pages that have their own headers) */
  hideBanner?: boolean;
  className?: string;
  footer?: boolean;
}

/**
 * Shared Pepito landing frame — same fixed nav, atmosphere, and footer as Welcome.
 * Used by auth/onboarding and the logged-in app shell so flows never feel like “another app”.
 */
export function LandingChrome({
  children,
  bannerTitle,
  bannerLead,
  bannerImage = BANNER_IMG,
  actionLabel: actionLabelProp,
  actionTo = '/',
  onAction,
  ctaLabel,
  ctaTo,
  appNav = false,
  hideBanner = false,
  className = '',
  footer = true,
}: LandingChromeProps) {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuthStore();
  const { t, dir } = useI18n();
  const platform = usePlatformConfig();
  const { pathname } = useLocation();
  const bannerPlacement = pathname.startsWith('/shop') ? 'shop' : appNav ? 'app' : 'landing';
  const userPrimary = primaryRole(user?.roles, user?.role);
  const resolvedBannerTitle = bannerTitle ?? BRAND.displayName;
  const resolvedBannerLead = bannerLead ?? (dir === 'rtl' ? BRAND.taglineFa : BRAND.taglineEn);
  // App shell uses ProfileMenu for logout — no default “back” action in the top bar.
  const actionLabel =
    actionLabelProp !== undefined
      ? actionLabelProp
      : appNav
        ? ''
        : t('common.home');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('pepito-landing-active');
    document.body.classList.add('pepito-landing-active');
    return () => {
      root.classList.remove('pepito-landing-active');
      document.body.classList.remove('pepito-landing-active');
    };
  }, []);

  return (
    <div className={`pepito-landing pepito-flow-page${className ? ` ${className}` : ''}`} dir={dir}>
      <header
        className={`pepito-nav${scrolled ? ' is-scrolled' : ''}${
          appNav ? ' pepito-nav--app' : ' pepito-nav--tools'
        }`}
      >
        {/* Logo first in DOM so dir=rtl places it at inline-start (right). */}
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>

        {appNav ? (
          <nav className="pepito-nav-links pepito-nav-links--app" aria-label={t('nav.mainMenu')}>
            <NavLink to="/" end>
              {t('common.home')}
            </NavLink>
            {userPrimary === 'vet' && platform.vetConsultEnabled ? (
              <NavLink to="/vet-consult">{t('nav.vet_panel')}</NavLink>
            ) : (
              <NavLink to="/my-pets">{t('nav.my_pets')}</NavLink>
            )}
          </nav>
        ) : (
          <nav className="pepito-nav-links" aria-label={t('nav.sections')}>
            <Link to="/#services">{t('nav.services')}</Link>
            <Link to="/adoption" data-testid="nav-adoption">{t('nav.adoption')}</Link>
            {platform.shopEnabled ? <Link to="/shop">{t('nav.petShop')}</Link> : null}
            {platform.vetConsultEnabled ? <Link to="/vet-consult">{t('nav.vet')}</Link> : null}
            <Link to="/faq" className="pepito-nav-faq">{t('nav.faq')}</Link>
          </nav>
        )}

        {/* Cluster before actions; mobile CSS parks both at inline-end (left). */}
        <NavUserCluster showCart />

        <div className="pepito-nav-actions">
          <LanguageToggle />
          <ThemeToggle />
          <SiteDesktopNav />
          {actionLabel && onAction ? (
            <button type="button" className="pepito-nav-login pepito-nav-login--btn" onClick={onAction}>
              {actionLabel}
            </button>
          ) : actionLabel && actionTo ? (
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
        </div>
      </header>

      {!hideBanner && (
        <section
          className="pepito-flow-banner"
          style={{ backgroundImage: `url(${bannerImage})` }}
          aria-label={resolvedBannerTitle}
        >
          <div className="pepito-flow-banner-wash" aria-hidden />
          <div className="pepito-flow-banner-inner">
            <p className="pepito-flow-banner-brand">
              <span className="pepito-kicker-dot" aria-hidden>
                <PawPrint size={16} />
              </span>
              {BRAND.displayName}
            </p>
            <h1>{resolvedBannerTitle}</h1>
            {resolvedBannerLead ? <p>{resolvedBannerLead}</p> : null}
          </div>
        </section>
      )}

      <PlatformBanners placement={bannerPlacement} />

      {children}

      {footer ? <SiteFooter /> : null}
    </div>
  );
}
