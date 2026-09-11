export type PetType = 'dog' | 'cat' | 'bird' | 'rabbit' | 'hamster' | 'other';

export type PetSize = 'small' | 'medium' | 'large';

export type PetGender = 'male' | 'female';

export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Pet {
  id: number;
  name: string;
  type: PetType;
  breed: string;
  age: number;
  ageUnit: 'month' | 'year';
  size: PetSize;
  gender: PetGender;
  city: string;
  neighborhood: string;
  ownerName: string;
  ownerId: number;
  imageUrl: string;
  emoji: string;
  bio?: string;
  traits: string[];
  healthNotes?: string;
  vaccinated: boolean;
  neutered: boolean;
  lookingForPlaymate: boolean;
  distanceKm: number;
}

export interface MatchRequest {
  id: number;
  /** پت طرف مقابل (برای نمایش کارت / چت) */
  fromPet: Pet;
  /** پت خود کاربر در این درخواست */
  toPet?: Pet;
  toPetId: number;
  fromPetId?: number;
  message?: string;
  status: MatchStatus;
  statusLabel?: string;
  direction?: 'incoming' | 'outgoing';
  createdAt: string;
  /** آخرین فعالیت برای مرتب‌سازی فهرست گفتگوها */
  updatedAt?: string;
  scheduledAt?: string;
  location?: string;
  /** نام پت مبدأ در API (برای فرمت ربات: مبدأ → مقصد) */
  rawFromName?: string;
  rawToName?: string;
  chatSecure?: boolean;
  chatEnded?: boolean;
  /** درخواست منقضی‌شده (بیش از ۲ دقیقه بدون پاسخ) */
  expired?: boolean;
}

export interface OwnerProfile {
  id: number;
  name: string;
  city: string;
  pets: Pet[];
}

export const PET_TYPE_LABELS: Record<PetType, string> = {
  dog: 'سگ',
  cat: 'گربه',
  bird: 'پرنده',
  rabbit: 'خرگوش',
  hamster: 'همستر',
  other: 'سایر',
};

export const PET_TYPE_EMOJI: Record<PetType, string> = {
  dog: '🐕',
  cat: '🐈',
  bird: '🐦',
  rabbit: '🐇',
  hamster: '🐹',
  other: '🐾',
};

export const PET_SIZE_LABELS: Record<PetSize, string> = {
  small: 'کوچک',
  medium: 'متوسط',
  large: 'بزرگ',
};

export const PET_GENDER_LABELS: Record<PetGender, string> = {
  male: 'نر',
  female: 'ماده',
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  pending: 'در انتظار',
  accepted: 'پذیرفته',
  rejected: 'رد شده',
  expired: 'منقضی شده',
};
