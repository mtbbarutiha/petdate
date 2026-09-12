import { useI18n } from '../i18n';

export function AdminPageLoading({ overlay = false }: { overlay?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={`admin-route-loading${overlay ? ' admin-route-loading--overlay' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="admin-route-spinner" aria-hidden />
      <p className="admin-route-loading-label">{t('admin.loading')}</p>
      <div className="admin-route-skeleton" aria-hidden>
        <div className="admin-route-skeleton-bar admin-route-skeleton-bar--lg" />
        <div className="admin-route-skeleton-bar" />
        <div className="admin-route-skeleton-bar admin-route-skeleton-bar--md" />
        <div className="admin-route-skeleton-bar admin-route-skeleton-bar--sm" />
      </div>
    </div>
  );
}
