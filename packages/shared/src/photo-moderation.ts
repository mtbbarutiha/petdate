/**
 * Photo-moderation helpers shared by API, web, and bot.
 * Unapproved photos stay hidden; the pet/owner identity stays usable
 * with a default placeholder until an admin approves.
 */
import type { PhotoModerationStatus } from './petdate';

export type PhotoPendingLocale = 'fa' | 'en';

export type PhotoPendingSubjects = {
  owner: boolean;
  pet: boolean;
};

/** True only after admin approval (legacy rows with no status stay visible). */
export function isPhotoApproved(
  status?: PhotoModerationStatus | null
): boolean {
  return (status ?? 'approved') === 'approved';
}

export function isPhotoPendingApproval(
  status?: PhotoModerationStatus | null
): boolean {
  return (status ?? 'approved') === 'pending';
}

/**
 * Public-facing photo URL: approved photos pass through; pending/rejected
 * return undefined so clients render the default placeholder.
 * Owners still receive the real URL from owner-scoped API responses.
 */
export function publicFacingPhotoUrl(
  url?: string | null,
  status?: PhotoModerationStatus | null
): string | undefined {
  const raw = String(url ?? '').trim();
  if (!raw || !isPhotoApproved(status)) return undefined;
  return raw;
}

export function pendingPhotoSubjects(opts: {
  avatarStatus?: PhotoModerationStatus | null;
  hasAvatar?: boolean;
  petStatuses?: Array<{
    status?: PhotoModerationStatus | null;
    hasPhoto?: boolean;
  }>;
}): PhotoPendingSubjects {
  const owner =
    Boolean(opts.hasAvatar) && isPhotoPendingApproval(opts.avatarStatus);
  const pet = (opts.petStatuses ?? []).some(
    (row) => Boolean(row.hasPhoto) && isPhotoPendingApproval(row.status)
  );
  return { owner, pet };
}

export function hasPendingPhotoApproval(subjects: PhotoPendingSubjects): boolean {
  return subjects.owner || subjects.pet;
}

const COPY: Record<
  PhotoPendingLocale,
  { both: string; pet: string; owner: string }
> = {
  fa: {
    both: 'عکس پت و عکس خودت در انتظار تأیید ادمین است. تا آن زمان با عکس پیش‌فرض می‌توانی از امکانات استفاده کنی.',
    pet: 'عکس پت در انتظار تأیید ادمین است. تا آن زمان با عکس پیش‌فرض می‌توانی از امکانات استفاده کنی.',
    owner:
      'عکس خودت در انتظار تأیید ادمین است. تا آن زمان با عکس پیش‌فرض می‌توانی از امکانات استفاده کنی.',
  },
  en: {
    both: 'Your pet photo and your own photo are awaiting admin approval. You can keep using PetDate with a default photo until then.',
    pet: 'Your pet photo is awaiting admin approval. You can keep using PetDate with a default photo until then.',
    owner:
      'Your photo is awaiting admin approval. You can keep using PetDate with a default photo until then.',
  },
};

/** Persistent owner-facing copy (site + bot). Null when nothing is pending. */
export function pendingPhotoApprovalMessage(
  subjects: PhotoPendingSubjects,
  locale: PhotoPendingLocale = 'fa'
): string | null {
  if (!subjects.owner && !subjects.pet) return null;
  const pack = COPY[locale] ?? COPY.fa;
  if (subjects.owner && subjects.pet) return pack.both;
  if (subjects.pet) return pack.pet;
  return pack.owner;
}

/** Strip unapproved pet/owner photos for anyone who is not the pet owner. */
export function sanitizePetPhotosForViewer<
  T extends {
    ownerId: number;
    imageUrl?: string;
    photoModerationStatus?: PhotoModerationStatus;
    ownerAvatarUrl?: string;
  },
>(pet: T, viewerId?: number): T {
  const isOwner = viewerId != null && viewerId === pet.ownerId;
  if (isOwner) return pet;
  const out = { ...pet };
  out.imageUrl = publicFacingPhotoUrl(pet.imageUrl, pet.photoModerationStatus);
  return out;
}
