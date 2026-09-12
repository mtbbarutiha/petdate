import { DEFAULT_IMAGES } from '../data/petImages';
import type { PetType } from '../types';

interface PetAvatarProps {
  type: PetType;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  imageUrl?: string;
  name?: string;
  variant?: 'circle' | 'cover';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'pet-avatar--sm',
  md: 'pet-avatar--md',
  lg: 'pet-avatar--lg',
  xl: 'pet-avatar--xl',
};

/** Branded default while a real photo is missing or awaiting admin approval. */
export const PHOTO_PLACEHOLDER_SRC = '/brand/photo-placeholder.svg';

/** Neutral SVG data-URI — never swap in another animal stock photo on error. */
const NEUTRAL_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect fill="#e8e4dc" width="120" height="120"/><circle cx="60" cy="48" r="22" fill="#c9c2b6"/><ellipse cx="60" cy="98" rx="36" ry="24" fill="#c9c2b6"/></svg>'
  );

export function PetAvatar({
  type,
  size = 'md',
  imageUrl,
  name = '',
  variant = 'circle',
  className = '',
}: PetAvatarProps) {
  const sizeClass = SIZE_CLASS[size];
  const variantClass = variant === 'cover' ? 'pet-avatar--cover' : '';
  const src = imageUrl?.trim() || DEFAULT_IMAGES[type] || PHOTO_PLACEHOLDER_SRC;

  return (
    <div className={`pet-avatar pet-avatar--photo ${sizeClass} ${variantClass} ${className}`}>
      <img
        src={src}
        alt={name || 'پت'}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== NEUTRAL_FALLBACK) img.src = NEUTRAL_FALLBACK;
        }}
      />
    </div>
  );
}
