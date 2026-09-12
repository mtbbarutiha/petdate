import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../hooks/useUserStore';

const PUBLIC_PATHS = ['/welcome', '/onboarding'];

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore();
  const location = useLocation();

  const isPublic = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));
  const isAdmin = location.pathname.startsWith('/admin');

  if (isAdmin || isPublic) {
    return <>{children}</>;
  }

  if (!user.role && !(user.roles && user.roles.length)) {
    return <Navigate to="/onboarding/role" replace />;
  }

  // Incomplete pet registration / pending photos must not lock matching,
  // chat, shop, or the owner panel. Role is the only hard gate here.

  return <>{children}</>;
}

export function TelegramSync() {
  const { syncFromTelegram, linkApiUser } = useUserStore();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tg = params.get('tg');
    const from = params.get('from');

    if (from === 'telegram' && tg) {
      syncFromTelegram(tg).catch(() => {
        linkApiUser({ id: 0, telegramId: tg, name: 'کاربر تلگرام', onboarding: 'role_selected' });
      });
    }
  }, [location.search, syncFromTelegram, linkApiUser]);

  return null;
}
