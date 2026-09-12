import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { useI18n } from '../i18n';
import { LanguageToggle } from './LanguageToggle';
import { NavUserCluster } from './NavUserCluster';
import { SiteHeaderLinkView } from './SiteHeaderLinkView';
import { SiteNavOverflow } from './SiteNavOverflow';
import { ThemeToggle } from './ThemeToggle';
import { INLINE_SECTION_COUNT, type SiteHeaderLink } from './siteHeaderLinks';

const LazySiteDesktopNav = lazy(() =>
  import('./SiteDesktopNav').then((m) => ({ default: m.SiteDesktopNav })),
);

function PawIcon({ size = 14 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
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
  logoWidth?: number;
  logoHeight?: number;
};

/**
 * Shared site header: brand | primary pills + overflow | utilities.
 * Marketing text links no longer sit beside duplicate شاپ / بازی‌ها pills.
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

  const inlineLinks = sectionLinks.slice(0, INLINE_SECTION_COUNT);
  const headerClass = `pepito-nav${scrolled ? ' is-scrolled' : ''}${className ? ` ${className}` : ''}`;

  return (
    <header className={headerClass}>
      <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
        <img
          src={logoSrc}
          alt={BRAND.displayName}
          {...(logoWidth ? { width: logoWidth } : {})}
          {...(logoHeight ? { height: logoHeight } : {})}
          decoding="async"
        />
      </Link>

      <div className="pepito-nav-primary">
        {showDesktopNav && wideEnoughForNav ? (
          <Suspense fallback={null}>
            <LazySiteDesktopNav />
          </Suspense>
        ) : null}
        {inlineLinks.length > 0 ? (
          <nav className="pepito-nav-links pepito-nav-section-inline" aria-label={t('nav.sections')}>
            {inlineLinks.map((link) => (
              <SiteHeaderLinkView key={link.key} link={link} />
            ))}
          </nav>
        ) : null}
        <SiteNavOverflow links={sectionLinks} />
      </div>

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
