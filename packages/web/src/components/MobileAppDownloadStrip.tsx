import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@petdate/shared';
import { ANDROID_APK_HREF } from '../pages/AppLandingPage';
import { useI18n } from '../i18n';

function isNativeCapacitorShell(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export type AppDownloadStripVariant = 'home' | 'article';

type MobileAppDownloadStripProps = {
  /** `home` = mobile-only (default). `article` = under magazine articles on all viewports. */
  variant?: AppDownloadStripVariant;
};

/**
 * Digikala-style app download strip.
 * - home: mobile viewport only (homepage)
 * - article: mobile + desktop (under every magazine article)
 * Hidden inside the Capacitor Android shell (already installed).
 */
export function MobileAppDownloadStrip({ variant = 'home' }: MobileAppDownloadStripProps) {
  const { t, dir, lang } = useI18n();

  useEffect(() => {
    void import('../styles/mobile-app-strip.css');
  }, []);

  if (isNativeCapacitorShell()) return null;

  const brandLabel = lang === 'en' ? BRAND.displayName : BRAND.displayNameFa;
  const className =
    variant === 'article' ? 'pd-app-strip pd-app-strip--article' : 'pd-app-strip';

  return (
    <aside
      className={className}
      data-testid={variant === 'article' ? 'article-app-download-strip' : 'mobile-app-download-strip'}
      data-variant={variant}
      aria-label={t('landing.appStripAria')}
      dir={dir}
    >
      <div className="pd-app-strip-inner">
        <div className="pd-app-strip-brand">
          <img
            className="pd-app-strip-logo"
            src="/pwa-192.png"
            alt=""
            width={36}
            height={36}
            decoding="async"
            loading="lazy"
          />
          <span className="pd-app-strip-title">
            {t('landing.appStripTitle', { brand: brandLabel })}
          </span>
        </div>

        <ul className="pd-app-strip-stores">
          <li>
            <a
              className="pd-app-strip-store pd-app-strip-store--apk"
              href={ANDROID_APK_HREF}
              download="petdate-android.apk"
              data-testid="mobile-app-strip-apk"
            >
              <span className="pd-app-strip-store-ico" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>{t('landing.appStripApk')}</span>
            </a>
          </li>
          <li>
            <span className="pd-app-strip-store pd-app-strip-store--soon" aria-disabled="true">
              <span className="pd-app-strip-store-ico pd-app-strip-store-ico--bazaar" aria-hidden>
                ب
              </span>
              <span>{t('landing.appStripBazaar')}</span>
            </span>
          </li>
          <li>
            <span className="pd-app-strip-store pd-app-strip-store--soon" aria-disabled="true">
              <span className="pd-app-strip-store-ico pd-app-strip-store-ico--myket" aria-hidden>
                م
              </span>
              <span>{t('landing.appStripMyket')}</span>
            </span>
          </li>
          <li>
            <Link
              className="pd-app-strip-store pd-app-strip-store--more"
              to="/landings/app"
              aria-label={t('landing.appStripMoreAria')}
              data-testid="mobile-app-strip-more"
            >
              <span aria-hidden>⋯</span>
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
