import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { SiteFooter } from '../components/SiteFooter';
import { ADOPTION_PETS } from '../data/adoptionPets';
import { loginPath } from '../lib/authRedirect';

const CONTACT_PHONE_DISPLAY = '۰۲۱-۸۸۷۷۶۶۵۵';
const CONTACT_PHONE_TEL = '+982188776655';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

export function AdoptionListPage() {
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
    <div className="pepito-landing pepito-adoption-page" dir="rtl">
      <header className={`pepito-nav${scrolled ? ' is-scrolled' : ''}`}>
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>
        <nav className="pepito-nav-links" aria-label="بخش‌ها">
          <Link to="/#services">خدمات</Link>
          <Link to="/adoption">پذیرش</Link>
          <Link to="/shop">پت شاپ</Link>
          <Link to="/vet-consult">دامپزشک</Link>
          <Link to="/faq">سؤالات</Link>
        </nav>
        <div className="pepito-nav-actions">
          <Link to={loginPath('/home')} className="pepito-nav-login">
            ورود
          </Link>
          <Link to={loginPath('/chats')} className="pepito-btn pepito-btn--nav">
            <PawIcon size={14} />
            ارسال پیام
          </Link>
        </div>
      </header>

      <section className="pepito-section pepito-adoption" id="pets">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            پذیرش یک پت
          </p>
          <h1>یک دوست پشمالوی جدید پیدا کن</h1>
          <p className="pepito-adoption-desc">
            پت‌های نیازمند خانه در پت‌دیت — پذیرش مسئولانه، بازدید حضوری و همراهی تا استقرار.
          </p>
        </div>
        <div className="pepito-adoption-grid">
          {ADOPTION_PETS.map((p) => (
            <article key={p.slug} className="pepito-adoption-card">
              <div className="pepito-adoption-media">
                <img src={p.img} alt={p.name} loading="lazy" />
                <div className="pepito-adoption-shade" aria-hidden />
              </div>
              <div className="pepito-adoption-front">
                <h2>{p.name}</h2>
              </div>
              <Link to={`/adoption/${p.slug}`} className="pepito-adoption-back">
                <h2>{p.name}</h2>
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
