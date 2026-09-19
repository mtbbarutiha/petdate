import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type TouchEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, UserRound } from 'lucide-react';
import {
  dashboardPathForRole,
  normalizeRoles,
  primaryRole,
  type UserRole,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { resolvePublicAvatarUrl } from '../lib/api';
import { loginPath } from '../lib/authRedirect';
import {
  closeProfileMenu,
  getProfileMenuOpen,
  subscribeProfileMenu,
  toggleProfileMenu,
} from './profileMenuStore';
import {
  filterNavByPlatformConfig,
  isMobileDockHidden,
  SITE_NAV_GUEST,
  siteNavMobileForUser,
  type SiteNavItem,
} from '../lib/siteNav';
import { useAppToast } from '../hooks/useAppToast';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

const LONG_PRESS_MS = 480;
/** One glyph box for every dock item (home/shop/chats/wallet/profile/…). */
const DOCK_ICON_PX = 24;
const DOCK_ICON_STROKE = 2;
const DOCK_ICON_STROKE_ACTIVE = 2.25;

/**
 * Instagram-style mobile bottom dock.
 * Profile tap opens the same account menu as the header avatar.
 * Long-press opens role switcher.
 */
export function LandingMobileDock() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, setPrimaryRole } = useAuthStore();
  const { t } = useI18n();
  const [roleOpen, setRoleOpen] = useState(false);
  const profileOpen = useSyncExternalStore(subscribeProfileMenu, getProfileMenuOpen, () => false);
  const [busy, setBusy] = useState(false);
  const { toastSuccess, toastError } = useAppToast();
  const rolePanelId = useId();
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const platform = usePlatformConfig();
  const items = filterNavByPlatformConfig(
    isLoggedIn ? siteNavMobileForUser(user) : SITE_NAV_GUEST,
    platform
  );
  const roles = normalizeRoles(user?.roles, user?.role);
  const activeRole = primaryRole(roles, user?.role);
  const photo = resolvePublicAvatarUrl(user?.avatarUrl, {
    gender: user?.gender,
    verificationPhotoFileId: user?.verificationPhotoFileId,
  });
  const initial = (user?.name?.trim()?.[0] || 'P').toUpperCase();

  const hideDock = isMobileDockHidden(pathname);

  useEffect(() => {
    if (!roleOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRoleOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [roleOpen]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    if (!isLoggedIn || roles.length === 0) return;
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      closeProfileMenu();
      setRoleOpen(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
  }, [clearLongPress, isLoggedIn, roles.length]);

  const goProfile = (anchor: HTMLElement) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!isLoggedIn) {
      navigate(loginPath('/profile'));
      return;
    }
    setRoleOpen(false);
    toggleProfileMenu(anchor);
  };

  const roleLabel = (role: UserRole) => t(`roles.${role}`);

  const handleSwitchRole = async (role: UserRole) => {
    if (busy || !user) return;
    if (activeRole === role) {
      setRoleOpen(false);
      toastSuccess(t('roles.activeToast', { role: roleLabel(role) }));
      navigate(dashboardPathForRole(role));
      return;
    }
    setBusy(true);
    try {
      const updated = await setPrimaryRole(role);
      const next = primaryRole(updated.roles, updated.role) ?? role;
      setRoleOpen(false);
      toastSuccess(t('roles.activeToast', { role: roleLabel(next) }));
      navigate(dashboardPathForRole(next));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('roles.switchFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (hideDock) return null;

  const isCenterChats = (item: SiteNavItem) =>
    item.key === 'chats' || item.key === 'playmate';

  const renderIcon = (item: SiteNavItem, active: boolean) => {
    if (item.key === 'profile' && isLoggedIn) {
      return photo ? (
        <img
          src={photo}
          alt=""
          width={DOCK_ICON_PX}
          height={DOCK_ICON_PX}
          className={`pepito-landing-mobile-dock-avatar${active ? ' is-active' : ''}`}
          draggable={false}
        />
      ) : (
        <span
          className={`pepito-landing-mobile-dock-avatar pepito-landing-mobile-dock-avatar--fallback${active ? ' is-active' : ''}`}
          aria-hidden
        >
          {initial || <UserRound size={16} strokeWidth={DOCK_ICON_STROKE_ACTIVE} />}
        </span>
      );
    }
    return (
      <item.icon
        size={DOCK_ICON_PX}
        strokeWidth={active ? DOCK_ICON_STROKE_ACTIVE : DOCK_ICON_STROKE}
        aria-hidden
      />
    );
  };

  const onProfilePointerDown = (e: MouseEvent | TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    startLongPress();
  };

  return (
    <>
      <nav className="pepito-landing-mobile-dock" aria-label={t('nav.mobileShortcuts')}>
        {items.map((item) => {
          const href = item.gate && !isLoggedIn ? loginPath(item.to) : item.to;
          const active = item.match?.(pathname) ?? pathname === item.to;
          const isProfile = item.key === 'profile';

          if (isProfile) {
            return (
              <button
                key={item.key}
                type="button"
                className={`pepito-landing-mobile-dock-link pepito-landing-mobile-dock-link--profile${active || roleOpen || profileOpen ? ' is-active' : ''}`}
                aria-label={`${t(`nav.${item.key}`)}`}
                aria-haspopup="menu"
                aria-expanded={roleOpen || profileOpen}
                aria-controls={roleOpen ? rolePanelId : profileOpen ? 'pepito-profile-menu' : undefined}
                data-profile-menu-anchor=""
                aria-current={active ? 'page' : undefined}
                onClick={(e) => goProfile(e.currentTarget)}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={onProfilePointerDown}
                onTouchEnd={clearLongPress}
                onTouchCancel={clearLongPress}
                onTouchMove={clearLongPress}
                onMouseDown={onProfilePointerDown}
                onMouseUp={clearLongPress}
                onMouseLeave={clearLongPress}
              >
                {renderIcon(item, active || roleOpen || profileOpen)}
              </button>
            );
          }

          const chatsCenter = isCenterChats(item);
          return (
            <Link
              key={item.key}
              to={href}
              className={`pepito-landing-mobile-dock-link${chatsCenter ? ' pepito-landing-mobile-dock-link--chats' : ''}${active ? ' is-active' : ''}${item.tone ? ` pepito-landing-mobile-dock-link--${item.tone}` : ''}`}
              aria-label={t(`nav.${item.key}`)}
              aria-current={active ? 'page' : undefined}
            >
              {renderIcon(item, active)}
            </Link>
          );
        })}
      </nav>

      {roleOpen ? (
        <div className="pepito-dock-role-sheet-root" role="presentation">
          <button
            type="button"
            className="pepito-dock-role-sheet-backdrop"
            aria-label={t('common.close')}
            onClick={() => setRoleOpen(false)}
          />
          <div
            ref={sheetRef}
            id={rolePanelId}
            className="pepito-dock-role-sheet"
            role="dialog"
            aria-label={t('roles.switchTitle')}
          >
            <div className="pepito-dock-role-sheet-handle" aria-hidden />
            <p className="pepito-dock-role-sheet-title">{t('roles.myRoles')}</p>
            <p className="pepito-dock-role-sheet-hint">{t('roles.longPressHint')}</p>
            <ul className="pepito-dock-role-sheet-list">
              {roles.map((role) => {
                const isActive = role === activeRole;
                return (
                  <li key={role}>
                    <button
                      type="button"
                      className={`pepito-dock-role-sheet-item${isActive ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => void handleSwitchRole(role)}
                    >
                      <span>{roleLabel(role)}</span>
                      {isActive ? (
                        <span className="pepito-dock-role-sheet-badge">
                          <Check size={14} strokeWidth={2.5} aria-hidden />
                          {t('roles.activeBadge')}
                        </span>
                      ) : (
                        <span className="pepito-dock-role-sheet-switch">{t('roles.select')}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/profile"
              className="pepito-dock-role-sheet-profile"
              onClick={() => setRoleOpen(false)}
            >
              {t('roles.goProfile')}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
