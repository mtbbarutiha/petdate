import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
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
import { resolvePublicMediaUrl } from '../lib/api';
import { loginPath } from '../lib/authRedirect';
import { filterNavByPlatformConfig, SITE_NAV_GUEST, siteNavMobileForUser, type SiteNavItem } from '../lib/siteNav';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import { ProfileManageNav } from './ProfileManageNav';

const LONG_PRESS_MS = 480;

/**
 * Instagram-style mobile bottom dock.
 * Profile tap opens مدیریت sheet (rail is desktop-only; avatar menu is hidden on mobile).
 * Long-press opens role switcher.
 */
export function LandingMobileDock() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, setPrimaryRole } = useAuthStore();
  const { t } = useI18n();
  const [roleOpen, setRoleOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rolePanelId = useId();
  const managePanelId = useId();
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
  const photo = resolvePublicMediaUrl(user?.avatarUrl);
  const initial = (user?.name?.trim()?.[0] || 'P').toUpperCase();

  const hideDock =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding') ||
    pathname === '/chats' ||
    pathname.startsWith('/chats/') ||
    pathname.startsWith('/vet-chats') ||
    pathname === '/vet-consult' ||
    pathname.startsWith('/vet-consult/');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!roleOpen && !manageOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleOpen(false);
        setManageOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [roleOpen, manageOpen]);

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
      setManageOpen(false);
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

  const goProfile = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!isLoggedIn) {
      navigate(loginPath('/profile'));
      return;
    }
    // Desktop rail + top avatar menu are hidden on mobile — open مدیریت sheet here.
    setRoleOpen(false);
    setManageOpen(true);
  };

  const roleLabel = (role: UserRole) => t(`roles.${role}`);

  const handleSwitchRole = async (role: UserRole) => {
    if (busy || !user) return;
    if (activeRole === role) {
      setRoleOpen(false);
      setToast(t('roles.activeToast', { role: roleLabel(role) }));
      navigate(dashboardPathForRole(role));
      return;
    }
    setBusy(true);
    try {
      const updated = await setPrimaryRole(role);
      const next = primaryRole(updated.roles, updated.role) ?? role;
      setRoleOpen(false);
      setToast(t('roles.activeToast', { role: roleLabel(next) }));
      navigate(dashboardPathForRole(next));
    } catch (err) {
      setToast(err instanceof Error ? err.message : t('roles.switchFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (hideDock) return null;

  const renderIcon = (item: SiteNavItem, active: boolean) => {
    if (item.key === 'profile' && isLoggedIn) {
      return photo ? (
        <img
          src={photo}
          alt=""
          className={`pepito-landing-mobile-dock-avatar${active ? ' is-active' : ''}`}
          draggable={false}
        />
      ) : (
        <span
          className={`pepito-landing-mobile-dock-avatar pepito-landing-mobile-dock-avatar--fallback${active ? ' is-active' : ''}`}
          aria-hidden
        >
          {initial || <UserRound size={16} strokeWidth={2.25} />}
        </span>
      );
    }
    return <item.icon size={24} strokeWidth={active ? 2.35 : 1.85} aria-hidden />;
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
                className={`pepito-landing-mobile-dock-link pepito-landing-mobile-dock-link--profile${active || roleOpen || manageOpen ? ' is-active' : ''}`}
                aria-label={`${t(`nav.${item.key}`)}`}
                aria-haspopup="dialog"
                aria-expanded={roleOpen || manageOpen}
                aria-controls={roleOpen ? rolePanelId : manageOpen ? managePanelId : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={goProfile}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={onProfilePointerDown}
                onTouchEnd={clearLongPress}
                onTouchCancel={clearLongPress}
                onTouchMove={clearLongPress}
                onMouseDown={onProfilePointerDown}
                onMouseUp={clearLongPress}
                onMouseLeave={clearLongPress}
              >
                {renderIcon(item, active || roleOpen || manageOpen)}
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              to={href}
              className={`pepito-landing-mobile-dock-link${active ? ' is-active' : ''}`}
              aria-label={t(`nav.${item.key}`)}
              aria-current={active ? 'page' : undefined}
            >
              {renderIcon(item, active)}
            </Link>
          );
        })}
      </nav>

      {manageOpen ? (
        <div className="pepito-dock-role-sheet-root" role="presentation">
          <button
            type="button"
            className="pepito-dock-role-sheet-backdrop"
            aria-label={t('common.close')}
            onClick={() => setManageOpen(false)}
          />
          <div
            id={managePanelId}
            className="pepito-dock-role-sheet pepito-dock-manage-sheet"
            role="dialog"
            aria-label={t('nav.manage')}
          >
            <div className="pepito-dock-role-sheet-handle" aria-hidden />
            <p className="pepito-dock-role-sheet-title">{t('nav.manage')}</p>
            <Link
              to="/profile"
              className="pepito-dock-manage-profile"
              onClick={() => setManageOpen(false)}
            >
              <UserRound size={20} strokeWidth={2} aria-hidden />
              <span>{t('roles.goProfile')}</span>
            </Link>
            <ProfileManageNav variant="sheet" onNavigate={() => setManageOpen(false)} />
          </div>
        </div>
      ) : null}

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

      {toast ? (
        <div className="pepito-dock-role-toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
