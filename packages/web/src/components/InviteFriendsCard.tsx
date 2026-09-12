import { useCallback, useEffect, useState } from 'react';
import { Gift, Copy, Check, Share2, Send } from 'lucide-react';
import {
  REFERRAL_BONUS_COINS,
  formatFaInt,
  inviteTelegramLink,
  inviteTelegramShareUrl,
  inviteWebLink,
  inviteWebShareUrl,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { fetchReferralStats, type ReferralStats } from '../lib/api';

type Props = {
  /** compact = یک ردیف اکشن؛ card = بلوک با توضیح */
  variant?: 'card' | 'action' | 'inline';
  className?: string;
};

/**
 * دعوت دوستان — لینک وب `/invite?ref=` + لینک ربات `ref_<id>` + آمار واقعی API.
 */
export function InviteFriendsCard({ variant = 'card', className = '' }: Props) {
  const { user, isLoggedIn, token } = useAuthStore();
  const [copied, setCopied] = useState<'web' | 'tg' | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const userId = user?.id;
  const webLink = userId != null ? inviteWebLink(userId) : '';
  const tgLink = userId != null ? inviteTelegramLink(userId) : '';
  const rewardFa = formatFaInt(stats?.bonusCoins ?? REFERRAL_BONUS_COINS);
  const invitedFa = formatFaInt(stats?.invitedCount ?? 0);
  const earnedFa = formatFaInt(stats?.coinsEarned ?? 0);

  useEffect(() => {
    if (!token || !isLoggedIn) return;
    let cancelled = false;
    void fetchReferralStats(token)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        /* card still works with local links */
      });
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn]);

  const copy = useCallback(async (value: string, which: 'web' | 'tg') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  if (!isLoggedIn || userId == null) return null;

  if (variant === 'action') {
    return (
      <button
        type="button"
        className={`pepito-profile-action pepito-profile-action--soft ${className}`.trim()}
        onClick={() => void copy(webLink, 'web')}
        data-testid="invite-friends-action"
      >
        <Gift size={18} aria-hidden />
        {copied === 'web' ? 'لینک کپی شد' : `دعوت دوستان (+${rewardFa} سکه)`}
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
        <button type="button" className="pepito-invite-copy" onClick={() => void copy(webLink, 'web')}>
          {copied === 'web' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied === 'web' ? 'کپی شد' : 'کپی لینک'}
        </button>
        <a
          className="pepito-invite-share"
          href={inviteWebShareUrl(userId)}
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
          لینک دعوتت را بفرست؛ با هر ثبت‌نام جدید در سایت یا ربات{' '}
          <strong>{rewardFa} سکه</strong> می‌گیری.
        </p>
      </header>
      <p className="pepito-invite-stats" data-testid="invite-friends-stats">
        {stats
          ? `${invitedFa} دوست ثبت‌نام کرده‌اند · ${earnedFa} سکه گرفته‌ای`
          : `هر دعوت موفق = ${rewardFa} سکه`}
      </p>
      <p className="pepito-invite-link" dir="ltr" data-testid="invite-friends-web-link">
        {webLink}
      </p>
      <div className="pepito-invite-actions">
        <button type="button" className="pepito-btn button-1" onClick={() => void copy(webLink, 'web')}>
          {copied === 'web' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied === 'web' ? 'کپی شد' : 'کپی لینک سایت'}
        </button>
        <a
          className="pepito-btn button-2"
          href={inviteWebShareUrl(userId)}
          target="_blank"
          rel="noreferrer"
        >
          <Share2 size={14} aria-hidden />
          اشتراک
        </a>
        <a
          className="pepito-btn button-3"
          href={inviteTelegramShareUrl(userId)}
          target="_blank"
          rel="noreferrer"
          title={tgLink}
        >
          <Send size={14} aria-hidden />
          لینک ربات
        </a>
      </div>
    </section>
  );
}
