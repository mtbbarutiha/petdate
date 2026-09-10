import { Navigate } from 'react-router-dom';
import { adminCan } from '../../auth';

export function SalesGuard({ children }: { children: React.ReactNode }) {
  if (!adminCan('sales.read') && !adminCan('admin.full')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
