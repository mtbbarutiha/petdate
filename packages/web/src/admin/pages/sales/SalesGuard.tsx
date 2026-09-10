import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { adminCan } from '../../auth';

export function SalesGuard({ children }: { children: ReactNode }) {
  if (!adminCan('sales.read') && !adminCan('admin.full')) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
