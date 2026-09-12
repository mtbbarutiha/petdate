import { announcementsForPlacement, type AnnouncementPlacement } from '@petdate/shared';
import { useI18n } from '../i18n';
import { usePlatformConfig } from '../hooks/usePlatformConfig';

export function PlatformBanners({
  placement,
}: {
  placement: AnnouncementPlacement | 'any';
}) {
  const { t } = useI18n();
  const config = usePlatformConfig();
  const notes =
    placement === 'any'
      ? config.announcements
      : announcementsForPlacement(config.announcements, placement);

  if (!config.maintenanceMode && !notes.length) return null;

  return (
    <div className="pd-platform-banners" role="region" aria-label={t('platform.notices')}>
      {config.maintenanceMode ? (
        <div className="pd-platform-banner pd-platform-banner--maintenance">
          <strong>{t('platform.maintenanceTitle')}</strong>
          <p>{t('platform.maintenanceBody')}</p>
        </div>
      ) : null}
      {notes.map((a) => (
        <div key={a.id} className="pd-platform-banner">
          <strong>{a.title}</strong>
          {a.body ? <p>{a.body}</p> : null}
        </div>
      ))}
    </div>
  );
}
