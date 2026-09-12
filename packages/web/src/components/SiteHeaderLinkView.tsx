import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { SiteHeaderLink } from './siteHeaderLinks';

function isCurrentRoute(to: string | undefined, pathname: string): boolean {
  if (!to || to.includes('#')) return false;
  return pathname === to;
}

export function SiteHeaderLinkView({
  link,
  className = '',
  onClick,
}: {
  link: SiteHeaderLink;
  className?: string;
  onClick?: () => void;
}) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = isCurrentRoute(link.to, pathname);
  const cls = ['pepito-nav-section-link', link.className, className, active ? 'is-active' : '']
    .filter(Boolean)
    .join(' ');
  const label = t(link.labelKey);
  if (link.href) {
    return (
      <a href={link.href} className={cls} data-testid={link.testId} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link
      to={link.to || '/'}
      className={cls}
      data-testid={link.testId}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}
