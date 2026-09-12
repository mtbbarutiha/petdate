import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { SiteHeaderLink } from './siteHeaderLinks';

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
  const cls = ['pepito-nav-section-link', link.className, className].filter(Boolean).join(' ');
  const label = t(link.labelKey);
  if (link.href) {
    return (
      <a href={link.href} className={cls} data-testid={link.testId} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link to={link.to || '/'} className={cls} data-testid={link.testId} onClick={onClick}>
      {label}
    </Link>
  );
}
