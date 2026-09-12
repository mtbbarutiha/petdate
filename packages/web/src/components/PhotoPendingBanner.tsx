import {
  hasPendingPhotoApproval,
  pendingPhotoApprovalMessage,
  pendingPhotoSubjects,
  type PhotoPendingLocale,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useMyPets } from '../hooks/useMyPets';
import { useI18n } from '../i18n';

export function usePhotoPendingSubjects() {
  const { user } = useAuthStore();
  const { pets } = useMyPets();
  return pendingPhotoSubjects({
    hasAvatar: Boolean(user?.avatarUrl?.trim()),
    avatarStatus: user?.avatarModerationStatus,
    petStatuses: pets.map((pet) => ({
      hasPhoto: Boolean(pet.imageUrl?.trim()),
      status: pet.photoModerationStatus,
    })),
  });
}

/** Persistent owner-panel notice while a pet/owner photo awaits admin review. */
export function PhotoPendingBanner({ compact = false }: { compact?: boolean }) {
  const { lang, t } = useI18n();
  const subjects = usePhotoPendingSubjects();
  if (!hasPendingPhotoApproval(subjects)) return null;
  const locale: PhotoPendingLocale = lang === 'en' ? 'en' : 'fa';
  const message =
    pendingPhotoApprovalMessage(subjects, locale) ?? t('moderation.bannerBoth');

  return (
    <div
      className={`pepito-photo-pending${compact ? ' pepito-photo-pending--compact' : ''}`}
      role="status"
      data-testid="photo-pending-banner"
    >
      <p>{message}</p>
    </div>
  );
}
