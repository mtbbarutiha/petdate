import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { SiteFooter } from '../components/SiteFooter';
import { ADOPTION_PETS, getAdoptionPet } from '../data/adoptionPets';
import { loginPath } from '../lib/authRedirect';
import { useAuthStore } from '../hooks/useAuthStore';

const CONTACT_PHONE_DISPLAY = '۰۲۱-۸۸۷۷۶۶۵۵';
const CONTACT_PHONE_TEL = '+982188776655';

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

  const related = ADOPTION_PETS;

  return (
    <div className="pepito-landing pepito-adoption-page" dir="rtl">
      <header className={`pepito-nav${scrolled ? ' is-scrolled' : ''}`}>
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>
        <nav className="pepito-nav-links" aria-label="بخش‌ها">
          <Link to="/#services">خدمات</Link>
          <Link to="/adoption">پذیرش</Link>
          <Link to="/shop">پت شاپ</Link>
          <Link to="/#team">تیم</Link>
          <Link to="/#reviews">نظرات</Link>
          <Link to="/#faq">سؤالات</Link>
        </nav>
        <div className="pepito-nav-actions">
          <Link to={loginPath('/home')} className="pepito-nav-login">
            ورود
          </Link>
          <GatedLink to="/chats" className="pepito-btn pepito-btn--nav">
            <PawIcon size={14} />
            ارسال پیام
          </GatedLink>
        </div>
      </header>

      <section
        className="pepito-adopt-banner"
        style={{ backgroundImage: `url(${pet.bannerImg})` }}
      >
        <div className="pepito-adopt-banner-wash" aria-hidden />
        <div className="pepito-adopt-banner-inner">
          <h1>نام پت: {pet.name}</h1>
          <p>پذیرش یک پت</p>
        </div>
      </section>

      <section className="pepito-adopt-single">
        <div className="pepito-adopt-single-grid">
          <div className="pepito-adopt-gallery">
            <div className="pepito-adopt-gallery-main">
              <img src={pet.gallery[0]} alt={pet.name} />
            </div>
            <div className="pepito-adopt-gallery-row">
              {pet.gallery.slice(1, 3).map((src) => (
                <div key={src} className="pepito-adopt-gallery-item">
                  <img src={src} alt={`${pet.name} — گالری پذیرش`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          <div className="pepito-adopt-cont">
            <h2>نام پت: {pet.name}</h2>
            <ul className="pepito-adopt-list">
              {pet.details.map((d) => (
                <li key={d.label}>
                  <span className="pepito-adopt-list-label">{d.label}:</span>
                  <span className="pepito-adopt-list-value">{d.value}</span>
                </li>
              ))}
            </ul>

            <h3>درباره {pet.name}</h3>
            <p className="pepito-adopt-about">{pet.about}</p>
            <ul className="pepito-adopt-traits">
              {pet.traits.map((t) => (
                <li key={t}>
                  <i className="flaticon-pawprint-4" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            <h3>قوانین پذیرش</h3>
            <p className="pepito-adopt-rules">{pet.rules}</p>

            <div className="pepito-adopt-ctas">
              <a href={`tel:${CONTACT_PHONE_TEL}`} className="pepito-btn button-1" dir="ltr">
                <PawIcon />
                {CONTACT_PHONE_DISPLAY}
              </a>
              <GatedLink to="/chats" className="pepito-btn button-3">
                <PawIcon />
                درخواست پذیرش
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
            پذیرش یک پت
          </p>
          <h2>یک دوست پشمالوی جدید پیدا کن</h2>
        </div>
        <div className="pepito-adoption-grid">
          {related.map((p) => (
            <article key={p.slug} className="pepito-adoption-card">
              <div className="pepito-adoption-media">
                <img src={p.img} alt={p.name} loading="lazy" />
                <div className="pepito-adoption-shade" aria-hidden />
              </div>
              <div className="pepito-adoption-front">
                <h3>{p.name}</h3>
              </div>
              <Link to={`/adoption/${p.slug}`} className="pepito-adoption-back">
                <h3>{p.name}</h3>
                <ul>
                  {p.details.slice(0, 3).map((d) => (
                    <li key={d.label}>
                      {d.label}: {d.value}
                    </li>
                  ))}
                </ul>
              </Link>
            </article>
          ))}
        </div>
        <div className="pepito-adoption-info">
          <span className="pepito-adoption-tag">پذیرش یک پت</span>
          <p className="pepito-adoption-desc">
            با ما تماس بگیرید{' '}
            <a href={`tel:${CONTACT_PHONE_TEL}`} dir="ltr" className="pepito-adoption-phone">
              {CONTACT_PHONE_DISPLAY}
            </a>{' '}
            برای اطلاعات بیشتر!
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
