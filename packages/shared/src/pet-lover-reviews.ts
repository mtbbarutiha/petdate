/** User-submitted “نظرات عاشقان پت” reviews (fantasy photo + text). */

export const PET_LOVER_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type PetLoverReviewStatus = (typeof PET_LOVER_REVIEW_STATUSES)[number];

export type PetLoverReview = {
  id: number;
  userId: number | null;
  displayHandle: string;
  body: string;
  rating: number;
  photoUrl: string;
  status: PetLoverReviewStatus;
  isSeed: boolean;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

/** Public card shape for landing / /reviews page. */
export type PetLoverReviewPublic = {
  id: number;
  displayHandle: string;
  body: string;
  rating: number;
  photoUrl: string;
  createdAt: string;
};

export const PET_LOVER_REVIEW_HANDLE_MAX = 40;
export const PET_LOVER_REVIEW_BODY_MAX = 400;
export const PET_LOVER_REVIEW_RATING_MIN = 1;
export const PET_LOVER_REVIEW_RATING_MAX = 5;

export function normalizePetLoverHandle(raw: string): string {
  let s = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '');
  if (!s) return '';
  if (s.length > PET_LOVER_REVIEW_HANDLE_MAX) s = s.slice(0, PET_LOVER_REVIEW_HANDLE_MAX);
  return `@${s}`;
}

export function clampPetLoverRating(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.min(
    PET_LOVER_REVIEW_RATING_MAX,
    Math.max(PET_LOVER_REVIEW_RATING_MIN, Math.round(v)),
  );
}
