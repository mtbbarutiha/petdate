import { AdminBrandLoader } from './AdminBrandLoader';

export function AdminPageLoading({ overlay = false }: { overlay?: boolean }) {
  return (
    <div className={`admin-route-loading${overlay ? ' admin-route-loading--overlay' : ''}`}>
      <AdminBrandLoader size="page" />
    </div>
  );
}
