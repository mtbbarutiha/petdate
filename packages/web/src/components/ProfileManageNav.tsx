import { NavLink, useLocation } from 'react-router-dom';
import {
  Ban,
  Banknote,
  Eye,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { VerificationStatus } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { faceVerifyChromeLabel, useI18n } from '../i18n';

export type ProfileManageVariant = 'rail' | 'menu' | 'sheet';

type ManageLink = {
  key: string;
  to: string;
  icon: LucideIcon;
  label: string;
  tone?: 'warn' | 'danger' | 'finance';
  match: (pathname: string, search: string) => boolean;
};

function manageLinks(
  _verifyStatus: VerificationStatus | null | undefined,
  labels: {
    edit: string;
    verify: string;
    interactions: string;
    earn: string;
    blocked: string;
    account: string;
  }
): ManageLink[] {
  return [
    {
      key: 'edit',
      to: '/profile?edit=1',
      icon: Pencil,
      label: labels.edit,
      match: (pathname, search) =>
        pathname === '/profile' && new URLSearchParams(search).get('edit') === '1',
    },
    {
      key: 'interactions',
      to: '/profile?panel=interactions',
      icon: Eye,
      label: labels.interactions,
      match: (pathname, search) =>
        pathname === '/profile' && new URLSearchParams(search).get('panel') === 'interactions',
    },
    {
      key: 'earn',
      to: '/wallet/earn',
      icon: Banknote,
      label: labels.earn,
      tone: 'finance',
      match: (pathname) => pathname === '/wallet/earn' || pathname.startsWith('/wallet/earn/'),
    },
    {
      key: 'verify',
      to: '/profile?panel=verify',
      icon: ShieldCheck,
      label: labels.verify,
      tone: 'warn',
      match: (pathname, search) =>
        pathname === '/profile' && new URLSearchParams(search).get('panel') === 'verify',
    },
    {
      key: 'blocked',
      to: '/profile?panel=blocked',
      icon: Ban,
      label: labels.blocked,
      tone: 'warn',
      match: (pathname, search) =>
        pathname === '/profile' && new URLSearchParams(search).get('panel') === 'blocked',
    },
    {
      key: 'account',
      to: '/profile?panel=account',
      icon: Trash2,
      label: labels.account,
      tone: 'danger',
      match: (pathname, search) =>
        pathname === '/profile' && new URLSearchParams(search).get('panel') === 'account',
    },
  ];
}

export interface ProfileManageNavProps {
  variant?: ProfileManageVariant;
  /** Called after a link is activated (e.g. close a dropdown). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Profile «مدیریت» destinations — desktop rail, avatar menu, and mobile dock sheet.
 * Silent-chat lives as an icon beside playmate (not re-listed here).
 */
export function ProfileManageNav({
  variant = 'rail',
  onNavigate,
  className = '',
}: ProfileManageNavProps) {
  const { pathname, search } = useLocation();
  const { user } = useAuthStore();
  const { t, lang } = useI18n();
  const items = manageLinks(user?.verificationStatus, {
    edit: t('nav.manageEdit'),
    verify: faceVerifyChromeLabel(t, lang, user?.verificationStatus),
    interactions: t('nav.manageInteractions'),
    earn: t('nav.manageEarn'),
    blocked: t('nav.manageBlocked'),
    account: t('nav.manageAccount'),
  });

  const rootClass =
    variant === 'rail'
      ? `pepito-app-rail-group${className ? ` ${className}` : ''}`
      : variant === 'sheet'
        ? `pepito-dock-manage-nav${className ? ` ${className}` : ''}`
        : `pepito-nav-profile-manage${className ? ` ${className}` : ''}`;
  const linkClass = (active: boolean, tone?: 'warn' | 'danger' | 'finance') => {
    if (variant === 'rail') {
      return `pepito-app-rail-link${active ? ' is-active' : ''}${tone ? ` is-${tone}` : ''}`;
    }
    if (variant === 'sheet') {
      return `pepito-dock-manage-link${active ? ' is-active' : ''}${tone ? ` is-${tone}` : ''}`;
    }
    return `pepito-nav-profile-item${tone === 'danger' ? ' pepito-nav-profile-item--danger' : ''}${
      tone === 'warn' ? ' pepito-nav-profile-item--warn' : ''
    }${tone === 'finance' ? ' pepito-nav-profile-item--finance' : ''}`;
  };
  const labelClass =
    variant === 'rail'
      ? 'pepito-app-rail-group-label'
      : variant === 'sheet'
        ? 'pepito-dock-manage-label'
        : 'pepito-nav-profile-manage-label';
  const iconSize = variant === 'rail' ? 18 : variant === 'sheet' ? 20 : 16;

  return (
    <div className={rootClass} data-testid="profile-manage-nav">
      {variant === 'sheet' ? null : <p className={labelClass}>{t('nav.manage')}</p>}
      <nav aria-label={t('nav.manage')}>
        {items.map((item) => {
          const active = item.match(pathname, search);
          return (
            <NavLink
              key={item.key}
              to={item.to}
              className={linkClass(active, item.tone)}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate?.()}
            >
              <item.icon size={iconSize} strokeWidth={2} aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
