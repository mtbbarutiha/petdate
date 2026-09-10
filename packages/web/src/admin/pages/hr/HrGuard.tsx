import { Navigate } from 'react-router-dom';
import { adminCan } from '../../auth';

/** Guard HR routes — requires hr.read (or admin.full). */
export function HrGuard({ children }: { children: React.ReactNode }) {
  if (!adminCan('hr.read') && !adminCan('admin.full')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
