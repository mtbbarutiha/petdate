import { Navigate } from 'react-router-dom';
import { adminCan } from '../../auth';

export function CrmGuard({ children }: { children: React.ReactNode }) {
  if (!adminCan('crm.read') && !adminCan('loyalty.read') && !adminCan('admin.full')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
