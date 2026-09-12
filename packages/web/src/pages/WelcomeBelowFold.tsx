import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Home,
  PawPrint,
  Star,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { SiteFooter } from '../components/SiteFooter';
import { useI18n } from '../i18n/I18nProvider';
import { AdoptionPurchaseCta } from '../components/AdoptionPurchaseCta';
import { ADOPTION_PETS } from '../data/adoptionPets';
import { resolvePublicMediaUrl } from '../lib/api';
import { formatAdminFaDate } from '../admin/jalaliDate';
import { fetchMagazineFeatured, type MagazineCard } from '../lib/magazineApi';
import { GatedLink, PawIcon } from './landingGatedLink';

const P = '/pepito/uploads';

const BLOB_PATH =
  'M30,16C46.588,6.484,54.481-2.058,64.3,1.452c3.145,1.125,6.861,3.657,10.212,9.426A40.611,40.611,0,0,1,59.5,66.544,41.151,41.151,0,0,1,3.482,51.629C0.134,45.865-.2,41.289.375,38.125,2.228,27.979,13.544,25.436,30,16Z';

/**
 * Core PetDate product lines only (no sitter / generic filler):
 * همبازی → دامپزشک آنلاین → مربی → بدون پت → پذیرش
 */
const SERVICES: {
  to: string;
  titleKey: string;
  descKey: string;
  Icon: LucideIcon;
  fill: 1 | 2 | 3 | 4;
}[] = [
  {
    to: '/chats',
    titleKey: 'landing.svcPlaymateTitle',
    descKey: 'landing.svcPlaymateDesc',
    Icon: HeartHandshake,
    fill: 1,
  },
  {
    to: '/vet-consult',
    titleKey: 'landing.svcVetTitle',
    descKey: 'landing.svcVetDesc',
    Icon: Stethoscope,
    fill: 3,
  },
  {
    to: '/trainer-consult',
    titleKey: 'landing.svcTrainerTitle',
    descKey: 'landing.svcTrainerDesc',
    Icon: GraduationCap,
    fill: 2,
  },
  {
    to: '/onboarding/role',
    titleKey: 'landing.svcNoPetTitle',
    descKey: 'landing.svcNoPetDesc',
    Icon: Home,
    fill: 4,
  },
  {
    to: '/adoption',
    titleKey: 'landing.svcAdoptionTitle',
    descKey: 'landing.svcAdoptionDesc',
    Icon: PawPrint,
    fill: 1,
  },
];

/** Landing cards → Pepito adoption single pages (`/adoption/:slug`) */
const PETS = ADOPTION_PETS.map((p) => ({
  nameKey: p.nameKey,
  img: p.img,
  to: `/adoption/${p.slug}`,
  details: p.details.slice(0, 3),
}));

const TEAM = [
  // DOM order (RTL): first item is visual-right.
  { slug: 'faranak-ahmadi', nameKey: 'landing.team1', roleKey: 'landing.roleTrainer', img: `${P}/01-3.jpg` },
  { slug: 'leila-kiani', nameKey: 'landing.team2', roleKey: 'landing.roleTrainer', img: `${P}/02-3.jpg` },
  { slug: 'sanaz-ghaffari', nameKey: 'landing.team3', roleKey: 'landing.roleVet', img: `${P}/03-3.jpg` },
  { slug: 'sara-noori', nameKey: 'landing.team4', roleKey: 'landing.roleVet', img: `${P}/04-3.jpg` },
] as const;

const REVIEW_DEFS = [
  { handleKey: 'landing.review1h', textKey: 'landing.review1t', img: `${P}/01-4.jpg` },
  { handleKey: 'landing.review2h', textKey: 'landing.review2t', img: `${P}/02-4.jpg` },
  { handleKey: 'landing.review3h', textKey: 'landing.review3t', img: `${P}/03-4.jpg` },
  { handleKey: 'landing.review4h', textKey: 'landing.review4t', img: `${P}/04-4.jpg` },
] as const;

const FAQ_DEFS = [
  { qKey: 'landing.faq1q', aKey: 'landing.faq1a' },
  { qKey: 'landing.faq2q', aKey: 'landing.faq2a' },
  { qKey: 'landing.faq3q', aKey: 'landing.faq3a' },
  { qKey: 'landing.faq4q', aKey: 'landing.faq4a' },
] as const;

/** Pepito “Our featured products” — shop grid → real catalog */
const PRODUCT_DEFS = [
  { nameKey: 'landing.prodBowl', priceKey: 'landing.priceBowl', badgeKey: 'landing.badgeSale', img: `${P}/01-1.png`, to: '/shop/product/dog-bowls-1-p41' },
  { nameKey: 'landing.prodToy', priceKey: 'landing.priceToy', badgeKey: 'landing.badgeHot', img: `${P}/1-1.jpg`, to: '/shop/product/cat-toys-1-p131' },
  { nameKey: 'landing.prodLitter', priceKey: 'landing.priceLitter', badgeKey: 'landing.badgeSpecial', img: `${P}/03.png`, to: '/shop/product/cat-litter-1-p161' },
  { nameKey: 'landing.prodFood', priceKey: 'landing.priceFood', badgeKey: 'landing.badgeHot', img: `${P}/06-1.png`, to: '/shop/product/cat-food-2-p102' },
] as const;

function newsFallback(t: (key: string) => string): MagazineCard[] {
  return [
    {
      id: -1,
      title: t('landing.newsFb1t'),
      excerpt: t('landing.newsFb1e'),
      publishAt: '2025-03-03',
      author: t('landing.newsAuthor'),
      category: t('landing.newsCatCare'),
      coverImage: `${P}/01.jpg`,
      slug: '',
    },
    {
      id: -2,
      title: t('landing.newsFb2t'),
      excerpt: t('landing.newsFb2e'),
      publishAt: '2025-03-03',
      author: t('landing.newsAuthor'),
      category: t('landing.newsCatPet'),
      coverImage: `${P}/06.jpg`,
      slug: '',
    },
    {
      id: -3,
      title: t('landing.newsFb3t'),
      excerpt: t('landing.newsFb3e'),
      publishAt: '2025-03-03',
      author: t('landing.newsAuthor'),
      category: t('landing.newsCatSafety'),
      coverImage: `${P}/03.jpg`,
      slug: '',
    },
  ];
}

export function WelcomeBelowFold() {
  const { t, lang } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [svcIndex, setSvcIndex] = useState(0);
  const [svcPaused, setSvcPaused] = useState(false);
  const svcTrackRef = useRef<HTMLDivElement>(null);
  /** Ignore programmatic autoplay scrolls so sync/pause does not fight snap (mobile jump). */
  const svcProgrammaticScrollRef = useRef(false);
  const [newsIndex, setNewsIndex] = useState(0);
  const newsTrackRef = useRef<HTMLDivElement>(null);
  const [newsItems, setNewsItems] = useState<MagazineCard[]>(() => newsFallback(t));

  useEffect(() => {
    setNewsItems((prev) => (prev.some((n) => n.id < 0) ? newsFallback(t) : prev));
  }, [lang, t]);


  useEffect(() => {
    let cancelled = false;
    void fetchMagazineFeatured(6)
      .then((list) => {
        if (!cancelled && list.length > 0) setNewsItems(list);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (svcPaused) return;
    const id = window.setInterval(() => {
      setSvcIndex((i) => (i + 1) % SERVICES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [svcPaused]);

  useEffect(() => {
    const track = svcTrackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.pepito-service-card');
    if (!card) return;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 21.6;
    const step = card.getBoundingClientRect().width + gap;
    if (step <= 0) return;
    const rtl = styles.direction === 'rtl';
    const target = rtl ? -svcIndex * step : svcIndex * step;
    const current = track.scrollLeft;
    if (Math.abs(current - target) < 2) return;
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    svcProgrammaticScrollRef.current = true;
    track.scrollTo({ left: target, behavior: narrow ? 'auto' : 'smooth' });
    window.requestAnimationFrame(() => {
      svcProgrammaticScrollRef.current = false;
    });
  }, [svcIndex]);

  /* Keep dots in sync when the user swipes the services track (RTL-aware). */
  useEffect(() => {
    const track = svcTrackRef.current;
    if (!track) return;
    let settleTimer = 0;
    let pointerDragging = false;

    const syncFromScroll = () => {
      if (svcProgrammaticScrollRef.current) return;
      const card = track.querySelector<HTMLElement>('.pepito-service-card');
      if (!card) return;
      const styles = getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap) || 21.6;
      const step = card.getBoundingClientRect().width + gap;
      if (step <= 0) return;
      const rtl = styles.direction === 'rtl';
      const raw = rtl ? -track.scrollLeft : track.scrollLeft;
      const idx = Math.max(0, Math.min(SERVICES.length - 1, Math.round(raw / step)));
      setSvcIndex((prev) => (prev === idx ? prev : idx));
    };

    const onPointerDown = () => {
      pointerDragging = true;
      setSvcPaused(true);
    };
    const onPointerUp = () => {
      pointerDragging = false;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        syncFromScroll();
        setSvcPaused(false);
      }, 180);
    };
    const onScroll = () => {
      if (svcProgrammaticScrollRef.current) return;
      if (!pointerDragging) return;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        syncFromScroll();
        setSvcPaused(false);
        pointerDragging = false;
      }, 180);
    };

    track.addEventListener('pointerdown', onPointerDown, { passive: true });
    track.addEventListener('pointerup', onPointerUp, { passive: true });
    track.addEventListener('pointercancel', onPointerUp, { passive: true });
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointerup', onPointerUp);
      track.removeEventListener('pointercancel', onPointerUp);
      track.removeEventListener('scroll', onScroll);
    };
  }, []);

  const newsPages = Math.max(1, newsItems.length - 2); // 3 visible on desktop → pages = n-2
  const goNews = (index: number) => {
    setNewsIndex(((index % newsPages) + newsPages) % newsPages);
  };

  useEffect(() => {
    setNewsIndex(0);
  }, [newsItems.length]);

  useEffect(() => {
    const track = newsTrackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>('.pepito-news-card');
    if (!card) return;
    const gap = 20;
    const step = card.getBoundingClientRect().width + gap;
    const rtl = getComputedStyle(track).direction === 'rtl';
    const narrow = window.matchMedia('(max-width: 720px)').matches;
    track.scrollTo({
      left: rtl ? -newsIndex * step : newsIndex * step,
      behavior: narrow ? 'auto' : 'smooth',
    });
  }, [newsIndex, newsItems]);


  return (
    <>
      <section className="pepito-section pepito-about" id="about">
        {/* Media first in RTL grid → physical right; copy stays on the left */}
        <div className="pepito-about-media">
          <div className="pepito-about-item">
            <div className="pepito-about-photo">
              <img src="/media/lcp/about-800.webp" alt={t('landing.aboutImgAlt')} loading="lazy" width={800} height={647} decoding="async" />
            </div>
            {/* Pepito `.note.vert-move` floating quote on the about photo */}
            <aside className="pepito-about-note pepito-vert-move" aria-label={t('landing.aboutQuoteAria')}>
              <div className="pepito-about-note-stars" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="pepito-about-note-txt">
                {t('landing.aboutQuote')}
              </p>
              <p className="pepito-about-note-title">
                <PawIcon />
                {t('landing.aboutQuoteAuthor')}
              </p>
            </aside>
          </div>
        </div>
        <div className="pepito-about-copy">
          <p className="pepito-eyebrow">{t('landing.aboutEyebrow')}</p>
          <h2>{t('landing.aboutTitle')}</h2>
          <p>
            {t('landing.aboutLead')}
          </p>
          <ul className="pepito-about-features">
            {SERVICES.slice(0, 3).map((s) => (
              <li key={s.titleKey} className="pepito-about-feature">
                <span className="pepito-about-feature-icon" aria-hidden>
                  <svg
                    className={`pepito-service-blob fill-${s.fill}`}
                    viewBox="0 0 80 72"
                  >
                    <path d={BLOB_PATH} />
                  </svg>
                  <s.Icon size={22} strokeWidth={1.75} />
                </span>
                <span>
                  <strong>{t(s.titleKey)}</strong>
                  <span>{t(s.descKey)}</span>
                </span>
              </li>
            ))}
          </ul>
          <a href="#services" className="pepito-btn button-1">
            <PawIcon />
            {t('landing.aboutMore')}
          </a>
        </div>
      </section>

      <section className="pepito-section pepito-services-section" id="services">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.aboutEyebrow')}
          </p>
          <h2>{t('landing.servicesTitle')}</h2>
          <p className="pepito-services-lead">
            {t('landing.servicesLead')}
          </p>
        </div>
        <div
          className="pepito-services-viewport"
          onMouseEnter={() => setSvcPaused(true)}
          onMouseLeave={() => setSvcPaused(false)}
        >
          <div className="pepito-services-track" ref={svcTrackRef}>
            {SERVICES.map((s) => (
              <article key={s.titleKey} className="pepito-service-card">
                <GatedLink to={s.to} className="pepito-service">
                  <span className="pepito-service-icon pepito-service-icon--proto" aria-hidden>
                    <span className="pepito-service-halo" />
                    <svg
                      className={`pepito-service-blob fill-${s.fill}`}
                      viewBox="0 0 80 72"
                    >
                      <path d={BLOB_PATH} />
                    </svg>
                    <s.Icon className="pepito-service-proto-glyph" size={48} strokeWidth={1.6} />
                  </span>
                  <h3>{t(s.titleKey)}</h3>
                  <p>{t(s.descKey)}</p>
                </GatedLink>
              </article>
            ))}
          </div>
        </div>
        <div className="pepito-services-dots" role="group" aria-label={t('landing.servicesDots')}>
          {SERVICES.map((s, i) => (
            <button
              key={s.titleKey}
              type="button"
              className={`pepito-services-dot${i === svcIndex ? ' is-active' : ''}`}
              onClick={() => setSvcIndex(i)}
              aria-label={t(s.titleKey)}
              aria-current={i === svcIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="pepito-section pepito-adoption" id="adoption">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.adoptionEyebrow')}
          </p>
          <h2>{t('landing.adoptionHeading')}</h2>
        </div>
        <div className="pepito-adoption-grid">
          {PETS.map((p) => {
            const name = t(p.nameKey);
            return (
            <article key={p.nameKey} className="pepito-adoption-card">
              <div className="pepito-adoption-media">
                <img src={p.img} alt={name} loading="lazy" width={600} height={700} decoding="async" />
                <div className="pepito-adoption-shade" aria-hidden />
              </div>
              <div className="pepito-adoption-front">
                <h3>{name}</h3>
              </div>
              <Link to={p.to} className="pepito-adoption-back">
                <h3>{name}</h3>
                <ul>
                  {p.details.map((d) => (
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

<section className="pepito-section" id="team">
        <div className="pepito-section-head">
          <p className="pepito-eyebrow">{t('landing.teamEyebrow')}</p>
          <h2>{t('landing.teamHeading')}</h2>
        </div>
        <div className="pepito-team">
          {TEAM.map((m) => (
            <article key={m.slug} className="pepito-member">
              <div className="pepito-member-photo">
                <img src={m.img} alt={t('landing.teamAlt', { name: t(m.nameKey), role: t(m.roleKey) })} loading="lazy" width={600} height={700} decoding="async" />
              </div>
              <div className="pepito-member-info">
                <h3>{t(m.nameKey)}</h3>
                <p>{t(m.roleKey)}</p>
                <GatedLink
                  to={`/team-chat/${m.slug}`}
                  className="pepito-btn button-3 pepito-member-consult"
                  data-testid={`team-consult-${m.slug}`}
                >
                  {t('landing.consultCta')}
                </GatedLink>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pepito-section pepito-reviews-section" id="reviews">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.reviewsEyebrow')}
          </p>
          <h2>{t('landing.reviewsTitle')}</h2>
        </div>
        <div className="pepito-reviews">
          {REVIEW_DEFS.map((r) => {
            const handle = t(r.handleKey);
            return (
            <article key={r.handleKey} className="pepito-review">
              <div className="pepito-review-img">
                <div className="pepito-review-img-frame">
                  <img src={r.img} alt={t('landing.reviewAlt', { handle })} loading="lazy" width={900} height={600} decoding="async" />
                </div>
              </div>
              <div className="pepito-review-body">
                <h3>{handle}</h3>
                <div className="pepito-review-stars" role="img" aria-label={t('landing.starsAria')}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={16} fill="currentColor" strokeWidth={0} aria-hidden />
                  ))}
                </div>
                <p>{t(r.textKey)}</p>
              </div>
            </article>
            );
          })}
        </div>
        <div className="pepito-review-trust">
          <span className="pepito-review-trust-tag">{t('landing.trustTag')}</span>
          <p className="pepito-review-trust-desc">
            {t('landing.trustDescBefore')}{' '}
            <span className="pepito-underline-pink">petdate</span>{' '}
            {t('landing.trustDescAfter')}
          </p>
        </div>
      </section>

      {/* Pepito “Our featured products” — after reviews / before FAQ */}
      <section className="pepito-section pepito-shop" id="shop">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.shopEyebrow')}
          </p>
          <h2>{t('landing.shopTitle')}</h2>
        </div>
        <div className="pepito-shop-grid">
          {PRODUCT_DEFS.map((p) => {
            const name = t(p.nameKey);
            return (
            <article key={p.nameKey} className="pepito-shop-item">
              <Link to={p.to} className="pepito-shop-wrap">
                <div className="pepito-shop-img">
                  <img src={p.img} alt={name} loading="lazy" width={690} height={676} decoding="async" />
                </div>
                <div className="pepito-shop-price" aria-hidden>
                  <p className="pepito-shop-price-line">
                    <span>{t(p.badgeKey)}</span>
                    <span className="pepito-shop-amount">{t(p.priceKey)}</span>
                  </p>
                </div>
              </Link>
              <div className="pepito-shop-text">
                <h3>
                  <Link to={p.to}>{name}</Link>
                </h3>
              </div>
            </article>
            );
          })}
        </div>
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <Link to="/shop" className="pepito-btn button-1">
            <PawIcon />
            {t('landing.shopEnter')}
          </Link>
        </div>
      </section>

      <section className="pepito-section pepito-faq-section" id="faq">
        <div className="pepito-faq-layout">
          <div className="pepito-faq-intro">
            <p className="pepito-eyebrow">{t('landing.faqEyebrow')}</p>
            <h2>{t('landing.faqTitle')}</h2>
            <p>{t('landing.faqLead')}</p>
            {/* Pepito: Other FAQs → dedicated FAQ page */}
            <Link to="/faq" className="pepito-btn button-1">
              <PawIcon />
              {t('landing.faqMore')}
            </Link>
          </div>
          <div className="pepito-faq">
            {FAQ_DEFS.map((item, i) => {
              const open = openFaq === i;
              const q = t(item.qKey);
              return (
                <div key={item.qKey} className="pepito-faq-item">
                  <button
                    type="button"
                    className="pepito-faq-q"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>
                      {String(i + 1).padStart(2, '0')} {q}
                    </span>
                    <span aria-hidden>{open ? '−' : '+'}</span>
                  </button>
                  {open ? <p className="pepito-faq-a">{t(item.aKey)}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pepito “Latest News” / blog1 — after FAQ */}
      <section className="pepito-section pepito-news" id="news">
        <div className="pepito-section-head pepito-section-head--center pepito-news-head">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            {t('landing.newsEyebrow')}
          </p>
          <h2>
            {t('landing.newsTitle')}.
          </h2>
        </div>
        <div className="pepito-news-viewport">
          <div className="pepito-news-nav" role="group" aria-label={t('landing.newsNav')}>
            <button
              type="button"
              className="pepito-news-arrow pepito-news-arrow--prev"
              onClick={() => goNews(newsIndex - 1)}
              aria-label={t('landing.prev')}
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className="pepito-news-arrow pepito-news-arrow--next"
              onClick={() => goNews(newsIndex + 1)}
              aria-label={t('landing.next')}
            >
              <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="pepito-news-track" ref={newsTrackRef}>
            {newsItems.map((n) => {
              const to = n.slug ? `/magazine/${n.slug}` : '/magazine';
              const img = resolvePublicMediaUrl(n.coverImage) || n.coverImage;
              return (
                <article key={n.id} className="pepito-news-card">
                  <div className="pepito-news-img">
                    <Link to={to}>
                      <img src={img} alt={n.title} loading="lazy" width={1600} height={900} decoding="async" />
                    </Link>
                    {n.category ? <span className="pepito-news-cat">{n.category}</span> : null}
                  </div>
                  <div className="pepito-news-cont">
                    <h3>
                      <Link to={to}>{n.title}</Link>
                    </h3>
                    <p>{n.excerpt}</p>
                    <div className="pepito-news-author">
                      <div>
                        <p className="pepito-news-meta">{formatAdminFaDate(n.publishAt)}</p>
                        <p className="pepito-news-meta">
                          {n.author ? (
                            <>
                              {t('landing.byAuthor')} <span className="pepito-news-author-name">{n.author}</span>
                            </>
                          ) : (
                            <Link to="/magazine">{t('landing.newsMore')}</Link>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="pepito-news-dots" role="group" aria-label={t('landing.newsPages')}>
          {Array.from({ length: newsPages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`pepito-news-dot${i === newsIndex ? ' is-active' : ''}`}
              onClick={() => goNews(i)}
              aria-label={t('landing.pageN', { n: i + 1 })}
              aria-current={i === newsIndex ? 'true' : undefined}
            />
          ))}
        </div>
        <p className="pepito-news-more">
          <Link to="/magazine" className="pepito-btn button-1">
            {t('landing.allArticles')}
          </Link>
        </p>
      </section>

      <SiteFooter />
    </>
  );
}
