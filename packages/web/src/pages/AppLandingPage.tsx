import { useMemo, useState, type FormEvent } from 'react';
import {
  Download,
  HeartHandshake,
  MapPinned,
  MessageCircleHeart,
  PawPrint,
  ShoppingBag,
  Stethoscope,
  Trophy,
} from 'lucide-react';
import { BRAND, SITE } from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { useI18n } from '../i18n';

/** Public Android package served from `public/downloads/`. */
export const ANDROID_APK_HREF = '/downloads/petdate-android.apk';

type Feature = {
  icon: typeof PawPrint;
  titleKey: string;
  leadKey: string;
};

const FEATURES: Feature[] = [
  {
    icon: HeartHandshake,
    titleKey: 'appLanding.featPlaymateTitle',
    leadKey: 'appLanding.featPlaymateLead',
  },
  {
    icon: Stethoscope,
    titleKey: 'appLanding.featVetTitle',
    leadKey: 'appLanding.featVetLead',
  },
  {
    icon: Trophy,
    titleKey: 'appLanding.featTrainerTitle',
    leadKey: 'appLanding.featTrainerLead',
  },
  {
    icon: ShoppingBag,
    titleKey: 'appLanding.featShopTitle',
    leadKey: 'appLanding.featShopLead',
  },
  {
    icon: MapPinned,
    titleKey: 'appLanding.featEventsTitle',
    leadKey: 'appLanding.featEventsLead',
  },
  {
    icon: MessageCircleHeart,
    titleKey: 'appLanding.featChatTitle',
    leadKey: 'appLanding.featChatLead',
  },
];

function normalizeIrMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^989\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

/**
 * Digikala-style app intro landing — brand-first hero, feature story, download rail.
 * Route: `/landings/app` (alias `/app`).
 */
export function AppLandingPage() {
  const { t, dir } = useI18n();
  const [phone, setPhone] = useState('');
  const [smsNote, setSmsNote] = useState<string | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);

  const downloadUrl = useMemo(() => {
    if (typeof window === 'undefined') return `${SITE.origin}${ANDROID_APK_HREF}`;
    return `${window.location.origin}${ANDROID_APK_HREF}`;
  }, []);

  const onSmsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSmsNote(null);
    const mobile = normalizeIrMobile(phone);
    if (!mobile) {
      setSmsNote(t('appLanding.smsInvalid'));
      return;
    }
    setSmsBusy(true);
    try {
      const text = `${t('appLanding.smsBody')}\n${downloadUrl}`;
      await navigator.clipboard?.writeText(text);
      window.location.href = `sms:${mobile}?&body=${encodeURIComponent(text)}`;
      setSmsNote(t('appLanding.smsOk'));
    } catch {
      setSmsNote(t('appLanding.smsCopyFail'));
    } finally {
      setSmsBusy(false);
    }
  };

  return (
    <LandingChrome
      bannerTitle={t('appLanding.bannerTitle')}
      bannerLead={t('appLanding.bannerLead')}
      showMobileEvents={false}
      showDesktopNav={false}
      hideBanner
      className="pepito-app-landing-page"
      actionLabel={t('common.home')}
      actionTo="/"
    >
      <main className="pd-app-land" data-testid="app-landing-page" dir={dir}>
        <section className="pd-app-land-hero" aria-labelledby="pd-app-land-hero-title">
          <div className="pd-app-land-hero-copy">
            <p className="pd-app-land-brand">
              <span className="pepito-kicker-dot" aria-hidden>
                <PawPrint size={18} />
              </span>
              <span>{BRAND.displayNameFa}</span>
              <span className="pd-app-land-brand-en" dir="ltr">
                {BRAND.displayName}
              </span>
            </p>
            <h1 id="pd-app-land-hero-title">{t('appLanding.heroTitle')}</h1>
            <p className="pd-app-land-hero-lead">{t('appLanding.heroLead')}</p>
            <div className="pd-app-land-cta-row">
              <a
                className="pd-app-land-cta pd-app-land-cta--primary"
                href={ANDROID_APK_HREF}
                download="petdate-android.apk"
                data-testid="app-landing-apk-download"
              >
                <Download size={20} aria-hidden />
                {t('appLanding.downloadApk')}
              </a>
              <a className="pd-app-land-cta pd-app-land-cta--ghost" href="#pd-app-land-download">
                {t('appLanding.seeDownloadWays')}
              </a>
            </div>
            <p className="pd-app-land-hero-note">{t('appLanding.heroNote')}</p>
          </div>

          <div className="pd-app-land-phone" aria-hidden>
            <div className="pd-app-land-phone-frame">
              <div className="pd-app-land-phone-notch" />
              <div className="pd-app-land-phone-screen">
                <img
                  src="/pepito/img/logo.png"
                  alt=""
                  className="pd-app-land-phone-logo"
                  width={120}
                  height={40}
                />
                <p className="pd-app-land-phone-kicker">{BRAND.taglineFa}</p>
                <ul className="pd-app-land-phone-chips">
                  <li>{t('appLanding.chipPlaymate')}</li>
                  <li>{t('appLanding.chipVet')}</li>
                  <li>{t('appLanding.chipShop')}</li>
                </ul>
                <div className="pd-app-land-phone-card">
                  <strong>{t('appLanding.phoneCardTitle')}</strong>
                  <span>{t('appLanding.phoneCardLead')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pd-app-land-features" aria-labelledby="pd-app-land-features-title">
          <header className="pd-app-land-section-head">
            <h2 id="pd-app-land-features-title">{t('appLanding.featuresTitle')}</h2>
            <p>{t('appLanding.featuresLead')}</p>
          </header>
          <ol className="pd-app-land-feature-list">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.titleKey} className="pd-app-land-feature">
                  <span className="pd-app-land-feature-icon" aria-hidden>
                    <Icon size={28} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3>{t(f.titleKey)}</h3>
                    <p>{t(f.leadKey)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="pd-app-land-trust" aria-label={t('appLanding.trustAria')}>
          <div>
            <strong>{t('appLanding.trust1Value')}</strong>
            <span>{t('appLanding.trust1Label')}</span>
          </div>
          <div>
            <strong>{t('appLanding.trust2Value')}</strong>
            <span>{t('appLanding.trust2Label')}</span>
          </div>
          <div>
            <strong>{t('appLanding.trust3Value')}</strong>
            <span>{t('appLanding.trust3Label')}</span>
          </div>
        </section>

        <section
          id="pd-app-land-download"
          className="pd-app-land-download"
          aria-labelledby="pd-app-land-download-title"
        >
          <header className="pd-app-land-section-head">
            <h2 id="pd-app-land-download-title">{t('appLanding.downloadTitle')}</h2>
            <p>{t('appLanding.downloadLead')}</p>
          </header>

          <div className="pd-app-land-download-grid">
            <div className="pd-app-land-store-rail">
              <a
                className="pd-app-land-store pd-app-land-store--apk"
                href={ANDROID_APK_HREF}
                download="petdate-android.apk"
                data-testid="app-landing-apk-download-secondary"
              >
                <Download size={22} aria-hidden />
                <span>
                  <strong>{t('appLanding.directApk')}</strong>
                  <em>{t('appLanding.directApkHint')}</em>
                </span>
              </a>
              <div className="pd-app-land-store pd-app-land-store--soon" aria-disabled="true">
                <span>
                  <strong>{t('appLanding.bazaarSoon')}</strong>
                  <em>{t('appLanding.storeSoonHint')}</em>
                </span>
              </div>
              <div className="pd-app-land-store pd-app-land-store--soon" aria-disabled="true">
                <span>
                  <strong>{t('appLanding.myketSoon')}</strong>
                  <em>{t('appLanding.storeSoonHint')}</em>
                </span>
              </div>
              <a className="pd-app-land-store pd-app-land-store--web" href="/">
                <span>
                  <strong>{t('appLanding.openWeb')}</strong>
                  <em>{t('appLanding.openWebHint')}</em>
                </span>
              </a>
            </div>

            <form className="pd-app-land-sms" onSubmit={onSmsSubmit} data-testid="app-landing-sms-form">
              <h3>{t('appLanding.smsTitle')}</h3>
              <p>{t('appLanding.smsLead')}</p>
              <label className="pd-app-land-sms-field">
                <span>{t('appLanding.smsPhoneLabel')}</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="09xxxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                />
              </label>
              <button type="submit" className="pd-app-land-cta pd-app-land-cta--primary" disabled={smsBusy}>
                {smsBusy ? t('common.loading') : t('appLanding.smsSubmit')}
              </button>
              {smsNote ? (
                <p className="pd-app-land-sms-note" role="status">
                  {smsNote}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
    </LandingChrome>
  );
}
