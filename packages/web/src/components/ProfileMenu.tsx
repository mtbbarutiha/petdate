import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Gamepad2, LogOut, PawPrint, ShoppingBag, UserRound } from 'lucide-react';
import { USER_ROLE_LABELS, normalizeRoles, primaryRole } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { ProfileManageNav } from './ProfileManageNav';
import { ProfileMenuButton } from './ProfileMenuButton';
import { RoleSwitchControl } from './RoleSwitchControl';
import {
  closeProfileMenu,
  getProfileMenuAnchor,
  getProfileMenuOpen,
  subscribeProfileMenu,
} from './profileMenuStore';

function computeMenuBox(anchor: HTMLElement | null): CSSProperties {
  const margin = 12;
  const width = Math.min(300, window.innerWidth - margin * 2);
  let top = 64;
  let left = margin;
  let maxHeight = Math.max(240, window.innerHeight - top - margin);
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight;
    if (visible) {
      left = Math.min(Math.max(margin, rect.left), window.innerWidth - margin - width);
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      if (below >= 220 || below >= above) {
        top = rect.bottom + 8;
        maxHeight = Math.max(180, below - 8);
      } else {
        maxHeight = Math.max(180, above - 8);
        top = Math.max(margin, rect.top - 8 - maxHeight);
      }
    }
  }
  return {
    position: 'fixed',
    top,
    left,
    width,
    maxHeight,
    zIndex: 90,
    overflowY: 'auto',
  };
}

/**
 * Post-login profile avatar control — pinned to physical CSS left of the Pepito nav.
 * Menu includes profile link, site shortcuts (playmate / shop / events),
 * role switch (if available), and logout.
 * Shop header drops Events + desktop nav; those shortcuts live here instead.
 * The panel is portaled so mobile header overflow cannot swallow the click.
 */
export function ProfileMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, dir } = useI18n();
  const { user, isLoggedIn, logout } = useAuthStore();
  const open = useSyncExternalStore(subscribeProfileMenu, getProfileMenuOpen, () => false);
  const pathRef = useRef(location.pathname);
  const [box, setBox] = useState<CSSProperties>({});
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => setBox(computeMenuBox(getProfileMenuAnchor()));
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [open]);

  useEffect(() => {
    if (pathRef.current !== location.pathname) {
      pathRef.current = location.pathname;
      closeProfileMenu();
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProfileMenu();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-profile-menu], [data-profile-menu-anchor]')) return;
      closeProfileMenu();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open]);

  if (!isLoggedIn || !user) return null;

  const roles = normalizeRoles(user.roles, user.role);
  const active = primaryRole(roles, user.role);
  const roleLabel = active ? USER_ROLE_LABELS[active] : null;

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      closeProfileMenu();
      await logout();
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            id="pepito-profile-menu"
            className="pepito-nav-profile-menu pepito-nav-profile-menu--floating"
            role="menu"
            aria-label="منوی پروفایل"
            data-profile-menu=""
            dir={dir}
            style={box}
          >
            <div className="pepito-nav-profile-head">
              <p className="pepito-nav-profile-name">{user.name || 'کاربر Pet Date'}</p>
              {roleLabel ? (
                <p className="pepito-nav-profile-role-label">نقش فعال: {roleLabel}</p>
              ) : null}
            </div>

            <Link
              to="/profile"
              className="pepito-nav-profile-item"
              role="menuitem"
              onClick={() => closeProfileMenu()}
            >
              <UserRound size={16} strokeWidth={2} />
              <span>پروفایل</span>
            </Link>

            <div className="pepito-nav-profile-shortcuts" role="group" aria-label={t('nav.shortcuts')}>
              <Link
                to="/chats"
                className="pepito-nav-profile-item"
                role="menuitem"
                data-testid="profile-shortcut-playmate"
                onClick={() => closeProfileMenu()}
              >
                <PawPrint size={16} strokeWidth={2} />
                <span>{t('nav.playmate')}</span>
              </Link>
              <Link
                to="/shop"
                className="pepito-nav-profile-item"
                role="menuitem"
                data-testid="profile-shortcut-shop"
                onClick={() => closeProfileMenu()}
              >
                <ShoppingBag size={16} strokeWidth={2} />
                <span>{t('nav.shop')}</span>
              </Link>
              <Link
                to="/events"
                className="pepito-nav-profile-item"
                role="menuitem"
                data-testid="profile-shortcut-events"
                onClick={() => closeProfileMenu()}
              >
                <Gamepad2 size={16} strokeWidth={2} />
                <span>{t('nav.games')}</span>
              </Link>
            </div>

            <ProfileManageNav variant="menu" onNavigate={() => closeProfileMenu()} />

            <div className="pepito-nav-profile-role-slot">
              <RoleSwitchControl compact className="pepito-nav-profile-role-switch" />
            </div>

            <button
              type="button"
              className="pepito-nav-profile-item pepito-nav-profile-item--logout"
              role="menuitem"
              disabled={busy}
              onClick={() => void onLogout()}
            >
              <LogOut size={16} strokeWidth={2} />
              <span>{busy ? 'خروج…' : 'خروج'}</span>
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="pepito-nav-profile">
      <ProfileMenuButton />
      {menu}
    </div>
  );
}
