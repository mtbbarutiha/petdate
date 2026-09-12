import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { landingSectionLinks } from '../components/siteHeaderLinks';
import { useI18n } from '../i18n';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import { AdoptionPurchaseCta, PetPurchaseLeadButton } from '../components/AdoptionPurchaseCta';
import { ADOPTION_PETS, getAdoptionPet } from '../data/adoptionPets';
import { loginPath } from '../lib/authRedirect';
import { GatedLink, PawIcon } from './landingGatedLink';

export function AdoptionDetailPage() {
  const { t, dir } = useI18n();
  const platform = usePlatformConfig();
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
      <SiteHeader
        scrolled={scrolled}
        sectionLinks={landingSectionLinks(platform)}
        showCart
        actionLabel={t('common.login')}
        actionTo={loginPath('/home')}
        ctaLabel={t('common.sendMessage')}
        ctaTo={loginPath('/chats')}
      />

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
