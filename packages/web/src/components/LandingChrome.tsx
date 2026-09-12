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
  // Logo is home. Only show an explicit action when the caller passes one
  // (auth back-link, magazine, vet landing CTA). Avoid a default خانه pill
  // stacked on marketing links + SiteDesktopNav.
  const actionLabel = actionLabelProp ?? '';
  const sectionLinks = appNav ? [] : landingSectionLinks(platform);

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
