import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { welcomeSectionLinks } from '../components/siteHeaderLinks';
import { PlatformBanners } from '../components/PlatformBanners';
import { useI18n } from '../i18n/I18nProvider';
import { useAuthStore } from '../hooks/useAuthStore';
import { GatedLink, PawIcon } from './landingGatedLink';

const WelcomeBelowFold = lazy(() =>
  import('./WelcomeBelowFold').then((m) => ({ default: m.WelcomeBelowFold })),
);

type HeroRole = 'playmate' | 'vet' | 'trainer' | 'no_pet' | 'adoption';

type HeroCta =
  | { kind: 'gated'; to: string; labelKey: string }
  | { kind: 'link'; to: string; labelKey: string }
  | { kind: 'hash'; href: string; labelKey: string };

const HERO_SLIDES: {
  role: HeroRole;
  webp: string;
  srcSet?: string;
  fallback: string;
  kickerKey: string;
  titleKey: string;
  leadKey: string;
  cta: HeroCta;
  testId: string;
}[] = [
  {
    role: 'playmate',
    webp: '/media/lcp/hero-playmate-800.webp',
    srcSet: '/media/lcp/hero-playmate-800.webp 800w, /media/lcp/hero-playmate-1280.webp 1280w',
    fallback: '/pepito/uploads/1-hero.jpg',
    kickerKey: 'landing.heroPlaymateKicker',
    titleKey: 'landing.heroPlaymateTitle',
    leadKey: 'landing.heroPlaymateLead',
    cta: { kind: 'gated', to: '/chats', labelKey: 'landing.heroPlaymateCta' },
    testId: 'hero-playmate-cta',
  },
  {
    role: 'vet',
    webp: '/media/lcp/hero-vet-800.webp',
    fallback: '/pepito/uploads/3.jpg',
    kickerKey: 'landing.heroVetKicker',
    titleKey: 'landing.heroVetTitle',
    leadKey: 'landing.heroVetLead',
    cta: { kind: 'link', to: '/vet-consult', labelKey: 'landing.heroVetCta' },
    testId: 'hero-vet-consult-cta',
  },
  {
    role: 'trainer',
    webp: '/media/lcp/hero-trainer-800.webp',
    fallback: '/pepito/uploads/5-hero.jpg',
    kickerKey: 'landing.heroTrainerKicker',
    titleKey: 'landing.heroTrainerTitle',
    leadKey: 'landing.heroTrainerLead',
    cta: { kind: 'gated', to: '/trainer-consult', labelKey: 'landing.heroTrainerCta' },
    testId: 'hero-trainer-cta',
  },
  {
    role: 'no_pet',
    webp: '/media/lcp/hero-nopet-800.webp',
    fallback: '/pepito/uploads/06-hero.jpg',
    kickerKey: 'landing.heroNoPetKicker',
    titleKey: 'landing.heroNoPetTitle',
    leadKey: 'landing.heroNoPetLead',
    cta: { kind: 'gated', to: '/onboarding/role', labelKey: 'landing.heroNoPetCta' },
    testId: 'hero-no-pet-cta',
  },
  {
    role: 'adoption',
    webp: '/media/lcp/hero-adoption-800.webp',
    fallback: '/pepito/uploads/2.jpg',
    kickerKey: 'landing.heroAdoptionKicker',
    titleKey: 'landing.heroAdoptionTitle',
    leadKey: 'landing.heroAdoptionLead',
    cta: { kind: 'hash', href: '#adoption', labelKey: 'landing.heroAdoptionCta' },
    testId: 'hero-adoption-cta',
  },
];

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

export function WelcomePage() {
  const { t, dir } = useI18n();
  const { isLoggedIn } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [slide, setSlide] = useState(0);

  const goToSlide = (index: number) => {
    const len = HERO_SLIDES.length;
    setSlide(((index % len) + len) % len);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const current = HERO_SLIDES[slide]!;

  return (
    <div className="pepito-landing pepito-landing--with-dock" dir={dir}>
      <SiteHeader
        scrolled={scrolled}
        className={isLoggedIn ? 'pepito-nav--app' : ''}
        sectionLinks={welcomeSectionLinks()}
        showCart
        deferDesktopNav
        logoSrc="/media/lcp/logo-390.webp"
        logoWidth={390}
        logoHeight={114}
      />

      <PlatformBanners placement="landing" />

      <section
        className="pepito-hero"
        role="region"
        aria-roledescription="carousel"
        aria-label={t('landing.heroAria')}
      >
        <div className="pepito-hero-slides">
          {HERO_SLIDES.map((s, i) => (
            <div
              key={s.role}
              className={`pepito-hero-slide${i === slide ? ' is-active' : ''}`}
              aria-hidden={i !== slide}
            >
              {i === slide ? (
                <picture>
                  <source type="image/webp" srcSet={s.srcSet || s.webp} sizes="100vw" />
                  <img
                    className="pepito-hero-media"
                    src={s.fallback}
                    alt={t(s.titleKey)}
                    width={1600}
                    height={900}
                    decoding={i === 0 ? 'sync' : 'async'}
                    loading="eager"
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                  />
                </picture>
              ) : null}
            </div>
          ))}
        </div>
        <div className="pepito-hero-wash" aria-hidden />
        <div className="pepito-hero-inner" key={current.role}>
          <div className="pepito-hero-copy">
            <p className="pepito-kicker">
              <span className="pepito-kicker-dot">
                <i className="flaticon-pawprint-4" />
              </span>
              {t(current.kickerKey)}
            </p>
            <h1 className="pepito-hero-slide-title">{t(current.titleKey)}</h1>
            <p className="pepito-hero-lead">{t(current.leadKey)}</p>
            <div className="pepito-hero-cta">
              {current.cta.kind === 'gated' ? (
                <GatedLink
                  to={current.cta.to}
                  className="pepito-btn pepito-hero-cta-btn--glass"
                  data-testid={current.testId}
                >
                  <PawIcon />
                  {t(current.cta.labelKey)}
                </GatedLink>
              ) : current.cta.kind === 'link' ? (
                <Link
                  to={current.cta.to}
                  className="pepito-btn pepito-hero-cta-btn--glass"
                  data-testid={current.testId}
                >
                  <PawIcon />
                  {t(current.cta.labelKey)}
                </Link>
              ) : (
                <a
                  href={current.cta.href}
                  className="pepito-btn pepito-hero-cta-btn--glass"
                  data-testid={current.testId}
                >
                  <PawIcon />
                  {t(current.cta.labelKey)}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="pepito-hero-nav" role="group" aria-label={t('landing.slideNav')}>
          <button
            type="button"
            className="pepito-hero-arrow pepito-hero-arrow--prev"
            onClick={() => goToSlide(slide - 1)}
            aria-label={t('landing.prevSlide')}
          >
            <Chevron dir="right" />
          </button>
          <button
            type="button"
            className="pepito-hero-arrow pepito-hero-arrow--next"
            onClick={() => goToSlide(slide + 1)}
            aria-label={t('landing.nextSlide')}
          >
            <Chevron dir="left" />
          </button>
        </div>
        <div className="pepito-hero-dots" role="group" aria-label={t('landing.slideTabs')}>
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.role}
              type="button"
              className={`pepito-hero-dot${i === slide ? ' is-active' : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={t(s.kickerKey)}
              aria-current={i === slide ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="pepito-below-fold-slot" aria-hidden />}>
        <WelcomeBelowFold />
      </Suspense>
    </div>
  );
}
