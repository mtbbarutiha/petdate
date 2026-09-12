import { lazy, Suspense } from 'react';
import { Layout } from '../components/Layout';

const VetConsultPage = lazy(() =>
  import('./VetConsultPage').then((m) => ({ default: m.VetConsultPage })),
);

/**
 * Logged-in consult shell. Kept in its own module so the guest landing graph
 * (VetConsultRoute + VetConsultLandingPage) does not pull Layout / app rail
 * into the homepage JS — that was a large TBT contributor.
 */
export function VetConsultAppRoute() {
  return (
    <Layout>
      <Suspense fallback={<div className="pd-route-fallback" aria-hidden="true" />}>
        <VetConsultPage />
      </Suspense>
    </Layout>
  );
}
