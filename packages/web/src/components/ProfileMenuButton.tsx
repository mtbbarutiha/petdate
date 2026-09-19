import { useSyncExternalStore } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';
import { resolvePublicAvatarUrl } from '../lib/api';
import { getProfileMenuOpen, subscribeProfileMenu, toggleProfileMenu } from './profileMenuStore';

/**
 * Circular account avatar. Any instance toggles the same ProfileMenu panel.
 */
export function ProfileMenuButton({ className = '' }: { className?: string }) {
  const { user, isLoggedIn } = useAuthStore();
  const open = useSyncExternalStore(subscribeProfileMenu, getProfileMenuOpen, () => false);

  if (!isLoggedIn || !user) return null;

  const initial = (user.name?.trim()?.[0] || 'پ').toUpperCase();
  const photo = resolvePublicAvatarUrl(user.avatarUrl, {
    verificationPhotoFileId: user.verificationPhotoFileId,
    gender: user.gender,
  });

  return (
    <button
      type="button"
      className={`pepito-nav-profile-btn${className ? ` ${className}` : ''}`}
      data-profile-menu-anchor=""
      data-testid="profile-menu-trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls="pepito-profile-menu"
      aria-label={user.name ? `پروفایل ${user.name}` : 'منوی پروفایل'}
      onClick={(e) => {
        e.preventDefault();
        toggleProfileMenu(e.currentTarget);
      }}
    >
      {photo ? (
        <img src={photo} alt="" className="pepito-nav-profile-photo" />
      ) : (
        <span className="pepito-nav-profile-fallback" aria-hidden>
          {initial}
        </span>
      )}
    </button>
  );
}
