import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { useI18n } from '../i18n';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { landingSectionLinks } from './siteHeaderLinks';
import { PlatformBanners } from './PlatformBanners';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

const BANNER_IMG = '/pepito/uploads/3.jpg';

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
  const { dir } = useI18n();
  const platform = usePlatformConfig();
  const { pathname } = useLocation();
  const bannerPlacement = pathname.startsWith('/shop') ? 'shop' : appNav ? 'app' : 'landing';
  const resolvedBannerTitle = bannerTitle ?? BRAND.displayName;
  const resolvedBannerLead = bannerLead ?? (dir === 'rtl' ? BRAND.taglineFa : BRAND.taglineEn);
  /** Avoid stacking brand line + identical h1 («PET DATE» / «Pet Date»). */
  const bannerTitleIsBrand = (() => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s._-]+/g, '');
    const title = norm(resolvedBannerTitle);
    const display = BRAND.displayName.trim();
    const titleCase = display
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const aliases = new Set(
      [display, BRAND.displayNameFa, titleCase, display.replace(/\s+/g, '')].map(norm)
    );
    return aliases.has(title);
  })();
  // Logo is home. Only show an explicit action when the caller passes one
  // (auth back-link, magazine). Do not pass login — NavUserCluster already
  // has pepito-nav-login-icon. Avoid a default خانه pill stacked on
  // marketing links + SiteDesktopNav.
  const actionLabel = actionLabelProp ?? '';
  const sectionLinks = appNav ? [] : landingSectionLinks(platform);
  // Public marketing (FAQ/help, shop-adjacent, magazine, games, vet, invite).
  // App shell already pads `.pepito-app-main`; auth hides the dock.
  const withDock =
    !appNav && !/\bpepito-auth-flow\b/.test(className);

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
    <div
      className={`pepito-landing pepito-flow-page${withDock ? ' pepito-landing--with-dock' : ''}${className ? ` ${className}` : ''}`}
      dir={dir}
    >
      <SiteHeader
        scrolled={scrolled}
        className={appNav ? 'pepito-nav--app' : 'pepito-nav--tools'}
        sectionLinks={sectionLinks}
        showCart
        actionLabel={actionLabel || undefined}
        actionTo={actionTo}
        onAction={onAction}
        ctaLabel={ctaLabel}
        ctaTo={ctaTo}
      />

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
            {!bannerTitleIsBrand ? <h1>{resolvedBannerTitle}</h1> : null}
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
