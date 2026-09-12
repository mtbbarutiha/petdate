import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift, Send } from 'lucide-react';
import {
  REFERRAL_BONUS_COINS,
  SITE,
  formatFaInt,
  inviteTelegramLink,
  parseReferralRef,
} from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { PageHelpLink } from '../components/PageHelpLink';
import { useAuthStore } from '../hooks/useAuthStore';
import { loginPath } from '../lib/authRedirect';
import { persistReferralRef, readStoredReferralRef } from '../lib/referral';

/**
 * Public invite landing — `/invite?ref=<id>`.
 * Guests store the code and sign up on web or Telegram; logged-in owners see their own card.
 */
export function InvitePage() {
  const [params] = useSearchParams();
  const { isLoggedIn } = useAuthStore();
  const refFromUrl = parseReferralRef(params.get('ref') || params.get('start'));
  const stored = readStoredReferralRef();
  const refId = refFromUrl ?? stored;

  useEffect(() => {
    if (refFromUrl != null) persistReferralRef(refFromUrl);
  }, [refFromUrl]);

  const rewardFa = formatFaInt(REFERRAL_BONUS_COINS);
  const botLink = useMemo(
    () => (refId != null ? inviteTelegramLink(refId) : SITE.telegramBot),
    [refId]
  );

  if (isLoggedIn) {
    return (
      <LandingChrome
        bannerTitle="دعوت دوستان"
        bannerLead={`با هر ثبت‌نام جدید از لینک تو، ${rewardFa} سکه می‌گیری.`}
      >
        <div className="pepito-container pepito-invite-page" data-testid="invite-page-owner">
          <PageHelpLink section="invite" />
          <InviteFriendsCard variant="card" />
        </div>
      </LandingChrome>
    );
  }

  return (
    <LandingChrome
      bannerTitle="دعوت به پت‌دیت"
      bannerLead={`ثبت‌نام از لینک دوستت — ${rewardFa} سکه جایزه برای معرف`}
    >
      <div className="pepito-container pepito-invite-page" data-testid="invite-page-guest">
        <header className="pepito-invite-page-head">
          <p className="pepito-eyebrow">
            <Gift size={16} aria-hidden />
            دعوت دوستان
          </p>
          <h2>یک دوست تو را به پت‌دیت دعوت کرده</h2>
          <p>
            با ثبت‌نام از همین صفحه یا ربات تلگرام، حسابت ساخته می‌شود و{' '}
            <strong>{rewardFa} سکه</strong> به دوست دعوت‌کننده‌ات اضافه می‌شود — فقط یک‌بار، برای
            حساب جدید.
          </p>
          {refId != null ? (
            <p className="pepito-invite-code" dir="ltr">
              کد دعوت: ref_{refId}
            </p>
          ) : (
            <p className="pepito-invite-page-muted">لینک دعوت ناقص است — از دوستت لینک تازه بگیر.</p>
          )}
          <PageHelpLink section="invite" />
        </header>
        <div className="pepito-invite-page-actions">
          <Link
            className="pepito-btn button-1"
            to={loginPath('/home')}
            data-testid="invite-signup-web"
          >
            ثبت‌نام / ورود در سایت
          </Link>
          <a
            className="pepito-btn button-2"
            href={botLink}
            target="_blank"
            rel="noreferrer"
            data-testid="invite-signup-bot"
          >
            <Send size={16} aria-hidden />
            ادامه در ربات تلگرام
          </a>
        </div>
      </div>
    </LandingChrome>
  );
}
