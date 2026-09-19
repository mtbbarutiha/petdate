import { Star } from 'lucide-react';
import { resolvePublicMediaUrl } from '../lib/mediaUrl';
import type { PetLoverReviewCard } from '../lib/petLoverReviewsApi';

function Stars({ rating, label }: { rating: number; label: string }) {
  const n = Math.min(5, Math.max(1, Math.round(rating) || 5));
  return (
    <div className="pepito-review-stars" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={16}
          fill={i < n ? 'currentColor' : 'none'}
          strokeWidth={i < n ? 0 : 1.5}
          aria-hidden
          style={i < n ? undefined : { opacity: 0.35 }}
        />
      ))}
    </div>
  );
}

export function PetLoverReviewCardView({
  review,
  starsAria,
}: {
  review: PetLoverReviewCard;
  starsAria: string;
}) {
  const img = resolvePublicMediaUrl(review.photoUrl) || '/pepito/uploads/01-4.jpg';
  return (
    <article className="pepito-review">
      <div className="pepito-review-img">
        <div className="pepito-review-img-frame">
          <img
            src={img}
            alt={review.displayHandle}
            loading="lazy"
            width={600} height={600}
            decoding="async"
          />
        </div>
      </div>
      <div className="pepito-review-body">
        <h3>{review.displayHandle}</h3>
        <Stars rating={review.rating} label={starsAria} />
        <p>{review.body}</p>
      </div>
    </article>
  );
}
