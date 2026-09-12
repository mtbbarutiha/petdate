import { lazy, Suspense } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';
import { VetConsultLandingPage } from './VetConsultLandingPage';

const VetConsultAppRoute = lazy(() =>
  import('./VetConsultAppRoute').then((m) => ({ default: m.VetConsultAppRoute })),
);

/**
 * Guest / incomplete sessions always get the marketing landing (no app rail).
 * This file is imported eagerly from App so the guest shell cannot 404 as a
 * lazy chunk when an older service worker still controls the tab.
 *
 * Layout + the signed-in consult UI live in VetConsultAppRoute so the
 * homepage / guest graph does not download the app rail on first paint.
 */
export function VetConsultRoute() {
  const { isLoggedIn, user, hasRole } = useAuthStore();
  const showAppShell = Boolean(isLoggedIn && user?.id && hasRole);
  if (!showAppShell) return <VetConsultLandingPage />;
  return (
    <Suspense fallback={<div className="pd-route-fallback" aria-hidden="true" />}>
      <VetConsultAppRoute />
    </Suspense>
  );
}
