import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { USER_ROLE_LABELS, normalizeRoles, primaryRole } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { resolvePublicAvatarUrl } from '../lib/api';
import { ProfileManageNav } from './ProfileManageNav';
import { RoleSwitchControl } from './RoleSwitchControl';

/**
 * Post-login profile avatar control — pinned to physical CSS left of the Pepito nav.
 * Menu includes profile link, role switch (if available), and logout.
 */
export function ProfileMenu() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
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
  const initial = (user.name?.trim()?.[0] || 'پ').toUpperCase();
  const photo = resolvePublicAvatarUrl(user.avatarUrl, {
    verificationPhotoFileId: user.verificationPhotoFileId,
    gender: user.gender,
  });

  async function onLogout() {
    if (busy) return;
    setBusy(true);
    try {
      setOpen(false);
      await logout();
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pepito-nav-profile" ref={rootRef}>
      <button
        type="button"
        className="pepito-nav-profile-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={user.name ? `پروفایل ${user.name}` : 'منوی پروفایل'}
        onClick={() => setOpen((v) => !v)}
      >
        {photo ? (
          <img src={photo} alt="" className="pepito-nav-profile-photo" />
        ) : (
          <span className="pepito-nav-profile-fallback" aria-hidden>
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div id={menuId} className="pepito-nav-profile-menu" role="menu" aria-label="منوی پروفایل">
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
            onClick={() => setOpen(false)}
          >
            <UserRound size={16} strokeWidth={2} />
            <span>پروفایل</span>
          </Link>

          <ProfileManageNav variant="menu" onNavigate={() => setOpen(false)} />

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
        </div>
      ) : null}
    </div>
  );
}
