import { Link } from 'react-router-dom';
import { PawPrint, Stethoscope } from 'lucide-react';
import { BRAND, SITE } from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { loginPath } from '../lib/authRedirect';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import { useI18n } from '../i18n';

const HIGHLIGHTS = [
  {
    title: 'پزشک آنلاین',
    desc: 'دامپزشک‌های آماده را ببینید و همان لحظه درخواست اتصال بفرستید.',
  },
  {
    title: 'پرداخت با سکه',
    desc: 'هزینه اتصال فوری از کیف پول پت‌دیت کسر می‌شود — بدون درگاه جدا.',
  },
  {
    title: 'چت وب و تلگرام',
    desc: 'بعد از قبول پزشک، گفتگو روی همان حساب وب و ربات ادامه پیدا می‌کند.',
  },
] as const;

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

/** Public marketing landing for /vet-consult — no app rail, no consult APIs. */
export function VetConsultLandingPage() {
  const platform = usePlatformConfig();
  const { t } = useI18n();
  return (
    <LandingChrome
      bannerTitle="دامپزشک آنلاین"
      bannerLead={
        platform.vetConsultEnabled
          ? 'نقش دامپزشک در پت‌دیت — مشاوره فوری برای پت شما، بدون اپ جدا، روی همان حساب.'
          : t('platform.vetOff')
      }
      actionLabel="خانه"
      actionTo="/"
      ctaLabel={platform.vetConsultEnabled ? 'مشاوره دامپزشک' : undefined}
      ctaTo={platform.vetConsultEnabled ? loginPath('/vet-consult') : undefined}
      className="pepito-vet-landing-page"
    >
      <section className="pepito-section pepito-vet-landing" data-testid="vet-consult-landing">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <Stethoscope size={16} strokeWidth={2} />
            </span>
            مشاوره دامپزشک
          </p>
          <h2>همین حالا به دامپزشک وصل شو</h2>
          <p className="pepito-vet-landing-lead">
            درخواست اتصال فوری به پزشک آنلاین. بعد از ورود و تأیید پرداخت سکه، چت مشاوره شروع
            می‌شود. مهمان‌ها این صفحه را بدون پنل اپ می‌بینند.
          </p>
        </div>

        <ul className="pepito-vet-landing-grid">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="pepito-vet-landing-card">
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </li>
          ))}
        </ul>

        <div className="pepito-vet-landing-cta">
          <Link
            to={loginPath('/vet-consult')}
            className="pepito-btn button-1"
            data-testid="vet-consult-landing-login"
          >
            <PawIcon />
            ورود برای ارتباط با پزشک
          </Link>
          <Link to="/" className="pepito-btn pepito-btn--ghost">
            بازگشت به {BRAND.displayName}
          </Link>
          <a
            className="pepito-btn pepito-btn--ghost"
            href={SITE.telegramBot}
            target="_blank"
            rel="noreferrer"
          >
            مشاوره در ربات تلگرام
          </a>
        </div>
      </section>
    </LandingChrome>
  );
}
