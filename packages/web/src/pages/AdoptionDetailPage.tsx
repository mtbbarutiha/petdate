import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { SiteFooter } from '../components/SiteFooter';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { useI18n } from '../i18n';
import { AdoptionPurchaseCta, PetPurchaseLeadButton } from '../components/AdoptionPurchaseCta';
import { ADOPTION_PETS, getAdoptionPet } from '../data/adoptionPets';
import { loginPath } from '../lib/authRedirect';
import { useAuthStore } from '../hooks/useAuthStore';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

function GatedLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const { isLoggedIn, hasRole, isProfileComplete } = useAuthStore();
  const ready = isLoggedIn && hasRole && isProfileComplete;
  return (
    <Link to={ready ? to : loginPath(to)} className={className}>
      {children}
    </Link>
  );
}

export function AdoptionDetailPage() {
  const { t, dir } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const pet = getAdoptionPet(slug);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('pepito-landing-active');
    document.body.classList.add('pepito-landing-active');
    return () => {
      root.classList.remove('pepito-landing-active');
      document.body.classList.remove('pepito-landing-active');
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!pet) {
    return <Navigate to="/adoption" replace />;
  }

  const name = t(pet.nameKey);
  const related = ADOPTION_PETS;

  return (
    <div className="pepito-landing pepito-adoption-page" dir={dir}>
      <header className={`pepito-nav${scrolled ? ' is-scrolled' : ''}`}>
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>
        <nav className="pepito-nav-links" aria-label={t('nav.sections')}>
          <Link to="/#services">{t('nav.services')}</Link>
          <Link to="/adoption">{t('nav.adoption')}</Link>
          <Link to="/shop">{t('nav.petShop')}</Link>
          <Link to="/#team">{t('nav.team')}</Link>
          <Link to="/#reviews">{t('nav.reviews')}</Link>
          <Link to="/#faq" className="pepito-nav-faq">{t('nav.faq')}</Link>
        </nav>
        <div className="pepito-nav-actions">
          <LanguageToggle />
          <ThemeToggle />
          <Link to={loginPath('/home')} className="pepito-nav-login">
            {t('common.login')}
          </Link>
          <GatedLink to="/chats" className="pepito-btn pepito-btn--nav">
            <PawIcon size={14} />
            {t('common.sendMessage')}
          </GatedLink>
        </div>
      </header>

      <section
        className="pepito-adopt-banner"
        style={{ backgroundImage: `url(${pet.bannerImg})` }}
      >
        <div className="pepito-adopt-banner-wash" aria-hidden />
        <div className="pepito-adopt-banner-inner">
          <h1>{t('adoption.petNameLabel', { name })}</h1>
          <p>{t('landing.adoptionEyebrow')}</p>
        </div>
      </section>

      <section className="pepito-adopt-single">
        <div className="pepito-adopt-single-grid">
          <div className="pepito-adopt-gallery">
            <div className="pepito-adopt-gallery-main">
              <img src={pet.gallery[0]} alt={name} />
            </div>
            <div className="pepito-adopt-gallery-row">
              {pet.gallery.slice(1, 3).map((src) => (
                <div key={src} className="pepito-adopt-gallery-item">
                  <img src={src} alt={t('adoption.galleryAlt', { name })} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          <div className="pepito-adopt-cont">
            <h2>{t('adoption.petNameLabel', { name })}</h2>
            <ul className="pepito-adopt-list">
              {pet.details.map((d) => (
                <li key={d.labelKey}>
                  <span className="pepito-adopt-list-label">{t(d.labelKey)}:</span>
                  <span className="pepito-adopt-list-value">{t(d.valueKey, d.valueVars)}</span>
                </li>
              ))}
            </ul>

            <h3>{t('adoption.aboutHeading', { name })}</h3>
            <p className="pepito-adopt-about">{t(pet.aboutKey)}</p>
            <ul className="pepito-adopt-traits">
              {pet.traitKeys.map((key) => (
                <li key={key}>
                  <i className="flaticon-pawprint-4" aria-hidden />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>

            <h3>{t('adoption.rulesTitle')}</h3>
            <p className="pepito-adopt-rules">{t(pet.rulesKey)}</p>

            <div className="pepito-adopt-ctas">
              <PetPurchaseLeadButton className="pepito-btn button-1 pepito-adoption-lead-btn" />
              <GatedLink to="/chats" className="pepito-btn button-3">
                <PawIcon />
                {t('adoption.requestAdoption')}
              </GatedLink>
            </div>
          </div>
        </div>
      </section>

      <section className="pepito-section pepito-adoption pepito-adopt-related" id="related">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <PawPrint size={18} />
            </span>
            {t('landing.adoptionEyebrow')}
          </p>
          <h2>{t('landing.adoptionHeading')}</h2>
        </div>
        <div className="pepito-adoption-grid">
          {related.map((p) => {
            const relatedName = t(p.nameKey);
            return (
              <article key={p.slug} className="pepito-adoption-card">
                <div className="pepito-adoption-media">
                  <img src={p.img} alt={relatedName} loading="lazy" />
                  <div className="pepito-adoption-shade" aria-hidden />
                </div>
                <div className="pepito-adoption-front">
                  <h3>{relatedName}</h3>
                </div>
                <Link to={`/adoption/${p.slug}`} className="pepito-adoption-back">
                  <h3>{relatedName}</h3>
                  <ul>
                    {p.details.slice(0, 3).map((d) => (
                      <li key={d.labelKey}>
                        {t(d.labelKey)}: {t(d.valueKey, d.valueVars)}
                      </li>
                    ))}
                  </ul>
                </Link>
              </article>
            );
          })}
        </div>
        <AdoptionPurchaseCta />
      </section>

      <SiteFooter />
    </div>
  );
}
