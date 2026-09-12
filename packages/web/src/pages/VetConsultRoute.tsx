import { lazy, Suspense } from 'react';
import { useAuthStore } from '../hooks/useAuthStore';

const VetConsultLandingPage = lazy(() =>
  import('./VetConsultLandingPage').then((m) => ({ default: m.VetConsultLandingPage })),
);
const VetConsultAppRoute = lazy(() =>
  import('./VetConsultAppRoute').then((m) => ({ default: m.VetConsultAppRoute })),
);

/**
 * Route shell stays eager from App (old-SW 404 on /vet-consult). The marketing
 * landing is lazy so lucide + LandingChrome + SiteFooter stay off the homepage
 * graph. Signed-in UI lives in VetConsultAppRoute (also lazy).
 */
export function VetConsultRoute() {
  const { isLoggedIn, user, hasRole } = useAuthStore();
  const showAppShell = Boolean(isLoggedIn && user?.id && hasRole);
  if (!showAppShell) {
    return (
      <Suspense fallback={<div className="pd-route-fallback" aria-hidden="true" />}>
        <VetConsultLandingPage />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<div className="pd-route-fallback" aria-hidden="true" />}>
      <VetConsultAppRoute />
    </Suspense>
  );
}
