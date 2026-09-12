import { Link } from 'react-router-dom';
import { formatFaInt } from '@petdate/shared';

export type ProfileStatsStripProps = {
  /** Own-profile only — contact/peer views must not render this strip. */
  isOwnProfile: boolean;
  likes: number;
  views: number;
  coins: number;
  contactsCount: number;
  walletAriaLabel: string;
  onOpenLikes: () => void;
  onOpenViews: () => void;
  onOpenContacts: () => void;
};

/**
 * Owner-only likes / views / coins / contacts strip.
 * Render directly under the own-profile hero — never on «پروفایل مخاطب».
 */
export function ProfileStatsStrip({
  isOwnProfile,
  likes,
  views,
  coins,
  contactsCount,
  walletAriaLabel,
  onOpenLikes,
  onOpenViews,
  onOpenContacts,
}: ProfileStatsStripProps) {
  if (!isOwnProfile) return null;

  return (
    <div
      className="pepito-profile-stats pepito-profile-stats--strip"
      role="list"
      data-testid="own-profile-stats"
      aria-label="آمار پروفایل من"
    >
      <button type="button" className="pepito-profile-stat" onClick={onOpenLikes} role="listitem">
        <strong>{formatFaInt(likes)}</strong>
        <span>لایک</span>
      </button>
      <button type="button" className="pepito-profile-stat" onClick={onOpenViews} role="listitem">
        <strong>{formatFaInt(views)}</strong>
        <span>بازدید</span>
      </button>
      <Link to="/wallet" className="pepito-profile-stat" aria-label={walletAriaLabel} role="listitem">
        <strong>{formatFaInt(coins)}</strong>
        <span>سکه</span>
      </Link>
      <button
        type="button"
        className="pepito-profile-stat"
        onClick={onOpenContacts}
        role="listitem"
      >
        <strong>{contactsCount > 0 ? formatFaInt(contactsCount) : '−'}</strong>
        <span>مخاطب</span>
      </button>
    </div>
  );
}
