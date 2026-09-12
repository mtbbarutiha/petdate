import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';
import { landingSectionLinks } from '../components/siteHeaderLinks';
import { useI18n } from '../i18n';
import { usePlatformConfig } from '../hooks/usePlatformConfig';
import { AdoptionPurchaseCta } from '../components/AdoptionPurchaseCta';
import { ADOPTION_PETS } from '../data/adoptionPets';
import { loginPath } from '../lib/authRedirect';

export function AdoptionListPage() {
  const { t, dir } = useI18n();
  const platform = usePlatformConfig();
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

      <section className="pepito-section pepito-adoption" id="adoption">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.adoptionEyebrow')}
          </p>
          <h1>{t('landing.adoptionHeading')}</h1>
          <p className="pepito-adoption-desc">{t('adoption.listDesc')}</p>
        </div>
        <div className="pepito-adoption-grid">
          {ADOPTION_PETS.map((p) => {
            const name = t(p.nameKey);
            return (
              <article key={p.slug} className="pepito-adoption-card">
                <div className="pepito-adoption-media">
                  <img src={p.img} alt={name} loading="lazy" />
                  <div className="pepito-adoption-shade" aria-hidden />
                </div>
                <div className="pepito-adoption-front">
                  <h2>{name}</h2>
                </div>
                <Link to={`/adoption/${p.slug}`} className="pepito-adoption-back">
                  <h2>{name}</h2>
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
