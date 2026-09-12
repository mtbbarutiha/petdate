import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@petdate/shared';
import { useI18n } from '../i18n';
import { LanguageToggle } from './LanguageToggle';
import { NavUserCluster } from './NavUserCluster';
import { SiteHeaderLinkView } from './SiteHeaderLinkView';
import { ThemeToggle } from './ThemeToggle';
import { IconPaw } from './icons/ChromeIcons';
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

export type SiteHeaderProps = {
  scrolled?: boolean;
  className?: string;
  sectionLinks?: SiteHeaderLink[];
  showCart?: boolean;
  showOrders?: boolean;
  showDesktopNav?: boolean;
  /** Defer SiteDesktopNav until ≥860px (landing LCP / TBT). */
  deferDesktopNav?: boolean;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  ctaLabel?: string;
  ctaTo?: string;
  extras?: ReactNode;
  logoSrc?: string;
  logoSrcSet?: string;
  logoSizes?: string;
  logoWidth?: number;
  logoHeight?: number;
};

/**
 * Shared site header: brand | primary text links (all inline) | utilities.
 * Role shortcuts (هم بازی / شاپ / بازی‌ها) share the خدمات text treatment.
 * No «بیشتر» overflow — section extras render directly in the nav row.
 */
export function SiteHeader({
  scrolled = false,
  className = '',
  sectionLinks = [],
  showCart = true,
  showOrders = false,
  showDesktopNav = true,
  deferDesktopNav = false,
  actionLabel,
  actionTo,
  onAction,
  ctaLabel,
  ctaTo,
  extras,
  logoSrc = '/pepito/img/logo.png',
  logoSrcSet,
  logoSizes,
  logoWidth,
  logoHeight,
}: SiteHeaderProps) {
  const { t } = useI18n();
  const [wideEnoughForNav, setWideEnoughForNav] = useState(!deferDesktopNav);

  useEffect(() => {
    if (!deferDesktopNav) return;
    const mq = window.matchMedia('(min-width: 860px)');
    const sync = () => setWideEnoughForNav(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [deferDesktopNav]);

  const headerClass = `pepito-nav${scrolled ? ' is-scrolled' : ''}${className ? ` ${className}` : ''}`;

  return (
    <header className={headerClass}>
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

      {wideEnoughForNav ? (
        <div className="pepito-nav-primary">
          {showDesktopNav ? (
            <Suspense fallback={null}>
              <LazySiteDesktopNav />
            </Suspense>
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

      <div className="pepito-nav-actions">
        <NavUserCluster showCart={showCart} showOrders={showOrders} />
        <LanguageToggle />
        <ThemeToggle />
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
        {extras}
      </div>
    </header>
  );
}
