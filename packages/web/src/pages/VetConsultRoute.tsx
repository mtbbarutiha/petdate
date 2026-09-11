import { Layout } from '../components/Layout';
import { useAuthStore } from '../hooks/useAuthStore';
import { VetConsultLandingPage } from './VetConsultLandingPage';
import { VetConsultPage } from './VetConsultPage';

/**
 * Guests get a marketing landing (no app sidebar, no consult API calls).
 * Signed-in users keep the existing consult / vet-inbox flow inside the app shell.
 */
export function VetConsultRoute() {
  const { isLoggedIn } = useAuthStore();
  if (!isLoggedIn) return <VetConsultLandingPage />;
  return (
    <Layout>
      <VetConsultPage />
    </Layout>
  );
}
