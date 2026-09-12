import { lazy, Suspense } from 'react';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../hooks/useAuthStore';
import { VetConsultLandingPage } from './VetConsultLandingPage';

const VetConsultPage = lazy(() =>
  import('./VetConsultPage').then((m) => ({ default: m.VetConsultPage })),
);

/**
 * Guest / incomplete sessions always get the marketing landing (no app rail).
 * This file is imported eagerly from App so the guest shell cannot 404 as a
 * lazy chunk when an older service worker still controls the tab.
 *
 * Signed-in users with a role keep the consult UI inside Layout.
 */
export function VetConsultRoute() {
  const { isLoggedIn, user, hasRole } = useAuthStore();
  const showAppShell = Boolean(isLoggedIn && user?.id && hasRole);
  if (!showAppShell) return <VetConsultLandingPage />;
  return (
    <Layout>
      <Suspense fallback={<div className="pd-route-fallback" aria-hidden="true" />}>
        <VetConsultPage />
      </Suspense>
    </Layout>
  );
}
