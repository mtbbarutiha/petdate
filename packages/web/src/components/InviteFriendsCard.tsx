import { useCallback, useState } from 'react';
import { Gift, Copy, Check, Share2 } from 'lucide-react';
import {
  REFERRAL_BONUS_COINS,
  formatFaInt,
  inviteTelegramLink,
  inviteTelegramShareUrl,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';

type Props = {
  /** compact = یک ردیف اکشن؛ card = بلوک با توضیح */
  variant?: 'card' | 'action' | 'inline';
  className?: string;
};

/**
 * دعوت دوستان — لینک ref_ تلگرام + جایزه ۳۰ سکه.
 * روی پروفایل / کیف پول / خانه نمایش داده می‌شود.
 */
export function InviteFriendsCard({ variant = 'card', className = '' }: Props) {
  const { user, isLoggedIn } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const userId = user?.id;
  const link = userId != null ? inviteTelegramLink(userId) : '';
  const rewardFa = formatFaInt(REFERRAL_BONUS_COINS);

  const copyLink = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [link]);

  if (!isLoggedIn || userId == null) return null;

  if (variant === 'action') {
    return (
      <button
        type="button"
        className={`pepito-profile-action pepito-profile-action--soft ${className}`.trim()}
        onClick={() => void copyLink()}
        data-testid="invite-friends-action"
      >
        <Gift size={18} aria-hidden />
        {copied ? 'لینک کپی شد' : `دعوت دوستان (+${rewardFa} سکه)`}
      </button>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`pepito-invite-inline ${className}`.trim()} data-testid="invite-friends-inline">
        <Gift size={16} aria-hidden />
        <span>
          دعوت دوستان — هر ثبت‌نام از لینک تو <strong>{rewardFa} سکه</strong>
        </span>
        <button type="button" className="pepito-invite-copy" onClick={() => void copyLink()}>
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'کپی شد' : 'کپی لینک'}
        </button>
        <a
          className="pepito-invite-share"
          href={inviteTelegramShareUrl(userId)}
          target="_blank"
          rel="noreferrer"
        >
          <Share2 size={14} aria-hidden />
          اشتراک
        </a>
      </div>
    );
  }

  return (
    <section
      className={`pepito-invite-card ${className}`.trim()}
      aria-label="دعوت دوستان"
      data-testid="invite-friends-card"
    >
      <header className="pepito-home-section-head">
        <p className="pepito-eyebrow">سکه رایگان</p>
        <h2>دعوت دوستان</h2>
        <p>
          لینک دعوتت را بفرست؛ با هر ثبت‌نام جدید <strong>{rewardFa} سکه</strong> می‌گیری.
        </p>
      </header>
      <p className="pepito-invite-link" dir="ltr">
        {link}
      </p>
      <div className="pepito-invite-actions">
        <button type="button" className="pepito-btn button-1" onClick={() => void copyLink()}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? 'کپی شد' : 'کپی لینک'}
        </button>
        <a
          className="pepito-btn button-2"
          href={inviteTelegramShareUrl(userId)}
          target="_blank"
          rel="noreferrer"
        >
          <Share2 size={16} aria-hidden />
          اشتراک در تلگرام
        </a>
      </div>
    </section>
  );
}
