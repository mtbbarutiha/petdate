import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Home,
  Star,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { SiteFooter } from '../components/SiteFooter';
import { NavUserCluster } from '../components/NavUserCluster';
import { SiteDesktopNav } from '../components/SiteDesktopNav';
import { ADOPTION_PETS } from '../data/adoptionPets';
import { useAuthStore } from '../hooks/useAuthStore';
import { loginPath } from '../lib/authRedirect';
import { resolvePublicMediaUrl } from '../lib/api';
import { formatAdminFaDate } from '../admin/jalaliDate';
import { fetchMagazineFeatured, type MagazineCard } from './MagazinePage';

const P = '/pepito/uploads';

/** Display + tel: for Pepito-style “Call us” band */
const CONTACT_PHONE_DISPLAY = '۰۲۱-۸۸۷۷۶۶۵۵';
const CONTACT_PHONE_TEL = '+982188776655';

const BLOB_PATH =
  'M30,16C46.588,6.484,54.481-2.058,64.3,1.452c3.145,1.125,6.861,3.657,10.212,9.426A40.611,40.611,0,0,1,59.5,66.544,41.151,41.151,0,0,1,3.482,51.629C0.134,45.865-.2,41.289.375,38.125,2.228,27.979,13.544,25.436,30,16Z';

/** Pepito services — role value-props (همبازی → دامپزشک → مربی → بدون پت), no sitter leftovers */
const SERVICES: {
  to: string;
  title: string;
  desc: string;
  icon: string;
  fill: 1 | 2 | 3 | 4;
}[] = [
  { to: '/chats', title: 'پیدا کردن همبازی', desc: 'همبازی مناسب برای پت‌ات در محله — درخواست بفرست و چت کن.', icon: 'flaticon-people-1', fill: 1 },
  { to: '/chats', title: 'بازی و پیاده‌روی', desc: 'هماهنگی بازی و پیاده‌روی مشترک با صاحبان پت نزدیک.', icon: 'flaticon-animals-11', fill: 2 },
  { to: '/vet-consult', title: 'مشاوره دامپزشک', desc: 'اتصال فوری به پزشک آنلاین با پرداخت سکه روی همان حساب.', icon: 'flaticon-veterinarian-hospital', fill: 3 },
  { to: '/vet-consult', title: 'واکسیناسیون و درمان', desc: 'راهنمایی واکسن، دندان و پیگیری درمان با دامپزشک مجرب.', icon: 'flaticon-syringe', fill: 4 },
  { to: '/trainer-consult', title: 'پیدا کردن مربی', desc: 'تربیت رفتاری و فرمان‌پذیری با مربیان تأییدشده آنلاین.', icon: 'flaticon-dog-training-3', fill: 2 },
  { to: '/trainer-consult', title: 'آموزش توله', desc: 'برنامه آموزش پایه برای توله‌ها و گربه‌های جوان.', icon: 'flaticon-dog-puppy', fill: 1 },
  { to: '/onboarding/role', title: 'شروع بدون پت', desc: 'هنوز پت نداری؟ نقش بدون پت را انتخاب کن و از مشاوره خرید شروع کن.', icon: 'flaticon-dog-and-pets-house', fill: 4 },
  { to: '/adoption', title: 'پذیرش پت', desc: 'پت‌های نیازمند خانه را ببین و مسیر پذیرش مسئولانه را شروع کن.', icon: 'flaticon-animal-13', fill: 3 },
  { to: '/shop', title: 'پت شاپ', desc: 'غذا، اسباب‌بازی و لوازم — سفارش روی همان حساب وب و ربات.', icon: 'flaticon-pet-food', fill: 1 },
  { to: '/add-pet', title: 'ثبت پت', desc: 'پروفایل پت بساز تا همبازی، مربی و دامپزشک فعال شوند.', icon: 'flaticon-pawprint-4', fill: 2 },
  { to: '/vet-consult', title: 'پرونده سلامت', desc: 'ویزیت و پیگیری روی همان حساب مشترک وب و تلگرام.', icon: 'flaticon-cross', fill: 4 },
  { to: '/chats', title: 'گفتگوی امن', desc: 'چت همبازی و خدمات با همگام‌سازی وب و ربات.', icon: 'flaticon-dog-with-first-aid-kit-bag', fill: 3 },
];

type HeroRole = 'playmate' | 'vet' | 'trainer' | 'no_pet';

type HeroCta =
  | { kind: 'gated'; to: string; label: string }
  | { kind: 'link'; to: string; label: string };

/** Marketing hero — fixed role order: همبازی → دامپزشک → مربی → بدون پت */
const HERO_SLIDES: {
  role: HeroRole;
  img: string;
  kicker: string;
  title: string;
  lead: string;
  cta: HeroCta;
  testId: string;
  Icon: LucideIcon;
}[] = [
  {
    role: 'playmate',
    img: `${P}/1-hero.jpg`,
    kicker: 'همبازی پت',
    title: 'همبازی مناسب برای پت‌ات پیدا کن',
    lead: 'صاحبان پت نزدیک را ببین، درخواست همبازی بفرست و روی همان حساب وب و تلگرام چت کن.',
    cta: { kind: 'gated', to: '/chats', label: 'پیدا کردن همبازی' },
    testId: 'hero-playmate-cta',
    Icon: HeartHandshake,
  },
  {
    role: 'vet',
    img: `${P}/3.jpg`,
    kicker: 'دامپزشک آنلاین',
    title: 'همین حالا به دامپزشک وصل شو',
    lead: 'درخواست اتصال فوری به پزشک آنلاین — پس از تأیید پرداخت سکه، چت مشاوره شروع می‌شود.',
    cta: { kind: 'link', to: '/vet-consult', label: 'مشاوره دامپزشک' },
    testId: 'hero-vet-consult-cta',
    Icon: Stethoscope,
  },
  {
    role: 'trainer',
    img: `${P}/5-hero.jpg`,
    kicker: 'مربی پت',
    title: 'مربی آنلاین برای آموزش پت‌ات',
    lead: 'به مربی‌های تأییدشده درخواست بده — تربیت رفتاری و هماهنگی روی چت مشترک وب و ربات.',
    cta: { kind: 'gated', to: '/trainer-consult', label: 'پیدا کردن مربی' },
    testId: 'hero-trainer-cta',
    Icon: GraduationCap,
  },
  {
    role: 'no_pet',
    img: `${P}/06-hero.jpg`,
    kicker: 'بدون پت',
    title: 'هنوز پت نداری؟ از همین‌جا شروع کن',
    lead: 'نقش بدون پت را انتخاب کن، مشاوره خرید بگیر یا مسیر پذیرش را ببین — بدون اپ جدا.',
    cta: { kind: 'gated', to: '/onboarding/role', label: 'شروع بدون پت' },
    testId: 'hero-no-pet-cta',
    Icon: Home,
  },
];

/** Landing cards → Pepito adoption single pages (`/adoption/:slug`) */
const PETS = ADOPTION_PETS.map((p) => ({
  name: p.name,
  img: p.img,
  to: `/adoption/${p.slug}`,
  details: p.details.slice(0, 3) }));

const TEAM = [
  { name: 'دکتر سارا نوری', role: 'دامپزشک', img: `${P}/01-3.jpg` },
  { name: 'دکتر امیر رضایی', role: 'مدیر آموزش', img: `${P}/02-3.jpg` },
  { name: 'دکتر لیلا کیانی', role: 'مراقبت پت', img: `${P}/03-3.jpg` },
  { name: 'دکتر پویا مرادی', role: 'مشاوره آنلاین', img: `${P}/04-3.jpg` },
] as const;

const TEAM_ALT = (name: string, role: string) => `${name} — ${role} پت‌دیت`;

/** Pepito “Happy pet lovers / Pepito reviews” — photo + stars + quote */
const REVIEWS = [
  {
    handle: '@سارا',
    text: 'قابل اعتماد و مهربون؛ معلومه عاشق حیوانان‌اند!',
    img: `${P}/01-4.jpg` },
  {
    handle: '@مینا',
    text: 'سگم عاشق همبازی‌شه و زمان‌بندی‌شون انعطاف‌پذیره.',
    img: `${P}/02-4.jpg` },
  {
    handle: '@علی',
    text: 'درستکار و مطمئن؛ خرگوش‌هام عاشقشون شدن!',
    img: `${P}/03-4.jpg` },
  {
    handle: '@نگار',
    text: 'دیدن اینکه بچه‌هام خوب مراقبت می‌شن همیشه لذت‌بخشه.',
    img: `${P}/04-4.jpg` },
] as const;

const FAQS = [
  {
    q: 'آیا حساب وب و ربات یکی است؟',
    a: 'بله. با همان موبایل یا ایمیل وارد شو؛ پت‌ها، درخواست‌ها و چت‌ها روی یک دیتابیس مشترک می‌مانند.' },
  {
    q: 'برای دیدن لندینگ باید وارد شوم؟',
    a: 'خیر. لندینگ و پت شاپ آزادند. برای همبازی، ثبت پت، دامپزشک و چت با OTP وارد شو؛ ثبت سفارش شاپ هم ورود می‌خواهد.' },
  {
    q: 'اگر من وب باشم و طرف مقابل ربات؟',
    a: 'پیام و درخواست از API مشترک رد می‌شود؛ هر دو طرف همان مکالمه را می‌بینند.' },
  {
    q: 'طراحی این صفحه از کجا آمده؟',
    a: 'ظاهر و عکس‌ها بر پایه قالب Pepito تنظیم شده تا تجربه دسکتاپ شبیه یک سایت مراقبت از پت واقعی باشد.' },
] as const;

/** Pepito “Why rely on us?” — two-column checklist + pet3.png */
const RELY_ITEMS_LEFT = ['عاشق سگ‌ها', 'راحتی', 'شفافیت', 'آرایشگر تأییدشده'] as const;
const RELY_ITEMS_RIGHT = ['مراقبت شخصی', 'آرامش خیال', 'کار تیمی', 'بیش از ۲۰ سال تجربه'] as const;

/** Pepito “Our featured products” — shop grid → real catalog */
const PRODUCTS = [
  { name: 'ظرف غذای سگ کوچک', price: '۶۴۴٬۰۰۰ تومان', badge: 'تخفیف', img: `${P}/01-1.png`, to: '/shop/product/dog-bowls-1-p41' },
  { name: 'توپ گربه', price: '۱۶۰٬۰۰۰ تومان', badge: 'پرفروش', img: `${P}/1-1.jpg`, to: '/shop/product/cat-toys-1-p131' },
  { name: 'خاک گربه', price: '۳۹۰٬۰۰۰ تومان', badge: 'ویژه', img: `${P}/03.png`, to: '/shop/product/cat-litter-1-p161' },
  { name: 'غذای خشک جوسرا', price: '۳٬۳۰۰٬۰۰۰ تومان', badge: 'پرفروش', img: `${P}/06-1.png`, to: '/shop/product/cat-food-2-p102' },
] as const;

/** Fallback demo cards when CMS has no published articles yet */
const NEWS_FALLBACK: MagazineCard[] = [
  {
    id: -1,
    title: 'مراقبت از دندان پت',
    excerpt: 'نکات ساده برای سلامت دهان و دندان پت‌تان در خانه.',
    publishAt: '2025-03-03',
    author: 'پت‌دیت',
    category: 'مراقبت',
    coverImage: `${P}/01.jpg`,
    slug: '',
  },
  {
    id: -2,
    title: 'سبک‌های آرایش سگ',
    excerpt: 'انتخاب کوتاهی مو متناسب با نژاد و فصل.',
    publishAt: '2025-03-03',
    author: 'پت‌دیت',
    category: 'پت',
    coverImage: `${P}/06.jpg`,
    slug: '',
  },
  {
    id: -3,
    title: 'نکات ایمنی پت',
    excerpt: 'چطور خانه را برای پت‌ها امن‌تر کنیم.',
    publishAt: '2025-03-03',
    author: 'پت‌دیت',
    category: 'ایمنی',
    coverImage: `${P}/03.jpg`,
    slug: '',
  },
];

function GatedLink({
  to,
  className,
  style,
  children,
  'data-testid': dataTestId,
}: {
  to: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const { isLoggedIn, hasRole, isProfileComplete } = useAuthStore();
  const ready = isLoggedIn && hasRole && isProfileComplete;
  const publicDest =
    to === '/vet-consult' ||
    to.startsWith('/vet-consult') ||
    to === '/shop' ||
    to.startsWith('/shop/') ||
    to === '/adoption' ||
    to.startsWith('/adoption/');
  // Role onboarding is auth-gated but must not require a complete profile.
  const onboardingDest = to === '/onboarding/role' || to.startsWith('/onboarding/');
  const href = onboardingDest
    ? isLoggedIn
      ? to
      : loginPath(to)
    : ready || publicDest
      ? to
      : loginPath(to);
  return (
    <Link to={href} className={className} style={style} data-testid={dataTestId}>
      {children}
    </Link>
  );
}

function PawIcon() {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <i className="flaticon-pawprint-4" />
    </span>
  );
}

/** Glass hero CTA icon (RTL: icon before label → right). */
function HeroCtaIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="pepito-hero-cta-icon" aria-hidden>
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

export function WelcomePage() {
  const { isLoggedIn } = useAuthStore();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);
  const [slide, setSlide] = useState(0);
  const [heroNavKey, setHeroNavKey] = useState(0);
  const [svcIndex, setSvcIndex] = useState(0);
  const [svcPaused, setSvcPaused] = useState(false);
  const svcTrackRef = useRef<HTMLDivElement>(null);
  /** Ignore programmatic autoplay scrolls so sync/pause does not fight snap (mobile jump). */
  const svcProgrammaticScrollRef = useRef(false);
  const [newsIndex, setNewsIndex] = useState(0);
  const newsTrackRef = useRef<HTMLDivElement>(null);
  const [newsItems, setNewsItems] = useState<MagazineCard[]>(NEWS_FALLBACK);

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

  const goToSlide = (index: number) => {
    const len = HERO_SLIDES.length;
    setSlide(((index % len) + len) % len);
    setHeroNavKey((k) => k + 1);
  };
  const goPrevSlide = () => goToSlide(slide - 1);
  const goNextSlide = () => goToSlide(slide + 1);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % HERO_SLIDES.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [heroNavKey]);

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


  const current = HERO_SLIDES[slide]!;

  return (
    <div className="pepito-landing pepito-landing--with-dock" dir="rtl">
      <header className={`pepito-nav${scrolled ? ' is-scrolled' : ''}${isLoggedIn ? ' pepito-nav--app' : ''}`}>
        {/* Logo first so dir=rtl places it at inline-start (right). */}
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>
        <nav className="pepito-nav-links" aria-label="بخش‌ها">
          <a href="#services">خدمات</a>
          <a href="#rely">اعتماد</a>
          <Link to="/adoption">پذیرش</Link>
          <a href="#news">اخبار</a>
          <a href="#faq">سؤالات</a>
        </nav>
        <NavUserCluster showCart />
        <div className="pepito-nav-actions">
          <SiteDesktopNav />
        </div>
</header>

      <section
        className="pepito-hero"
        aria-roledescription="carousel"
        aria-label="اسلایدر نقش‌ها — همبازی، دامپزشک، مربی، بدون پت"
      >
        <div className="pepito-hero-slides">
          {HERO_SLIDES.map((s, i) => (
            <div
              key={s.role}
              className={`pepito-hero-slide${i === slide ? ' is-active' : ''}`}
              aria-hidden={i !== slide}
            >
              <img
                className="pepito-hero-media"
                src={s.img}
                alt={s.title}
                decoding={i === 0 ? 'sync' : 'async'}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
              />
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
              {current.kicker}
            </p>
            {/* Stable brand H1 for SEO; slide headline stays visual (styled like former h1). */}
            <h1 className="pd-sr-only">
              پت‌دیت — همبازی پت، دامپزشک آنلاین، مربی و شروع بدون پت
            </h1>
            <p className="pepito-hero-slide-title">{current.title}</p>
            <p className="pepito-hero-lead">{current.lead}</p>
            <div className="pepito-hero-cta">
              {current.cta.kind === 'gated' ? (
                <GatedLink
                  to={current.cta.to}
                  className="pepito-btn pepito-hero-cta-btn--glass"
                  data-testid={current.testId}
                >
                  <HeroCtaIcon Icon={current.Icon} />
                  {current.cta.label}
                </GatedLink>
              ) : (
                <Link
                  to={current.cta.to}
                  className="pepito-btn pepito-hero-cta-btn--glass"
                  data-testid={current.testId}
                >
                  <HeroCtaIcon Icon={current.Icon} />
                  {current.cta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* Pepito `.slider-fade .owl-nav` — circular angle arrows, hover-reveal, hide ≤991px */}
        <div className="pepito-hero-nav" aria-label="جابجایی اسلاید">
          <button
            type="button"
            className="pepito-hero-arrow pepito-hero-arrow--prev"
            onClick={goPrevSlide}
            aria-label="اسلاید قبلی"
          >
            {/* RTL: prev sits inline-start (right); chevron points toward previous */}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className="pepito-hero-arrow pepito-hero-arrow--next"
            onClick={goNextSlide}
            aria-label="اسلاید بعدی"
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="pepito-hero-dots" role="tablist" aria-label="اسلایدهای نقش">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.role}
              type="button"
              role="tab"
              aria-selected={i === slide}
              className={`pepito-hero-dot${i === slide ? ' is-active' : ''}`}
              onClick={() => goToSlide(i)}
              aria-label={s.kicker}
            />
          ))}
        </div>
      </section>

      <section className="pepito-section pepito-about" id="about">
        {/* Media first in RTL grid → physical right; copy stays on the left */}
        <div className="pepito-about-media">
          <div className="pepito-about-item">
            <div className="pepito-about-photo">
              <img src={`${P}/about.jpg`} alt="مراقبت از حیوانات خانگی در پت‌دیت" loading="lazy" />
            </div>
            {/* Pepito `.note.vert-move` floating quote on the about photo */}
            <aside className="pepito-about-note pepito-vert-move" aria-label="نظر">
              <div className="pepito-about-note-stars" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="pepito-about-note-txt">
                «از حیوانات طوری مراقبت کنید که انگار فرزندان‌تان هستند!»
              </p>
              <p className="pepito-about-note-title">
                <PawIcon />
                اولیویا مارتین
              </p>
            </aside>
          </div>
        </div>
        <div className="pepito-about-copy">
          <p className="pepito-eyebrow">عاشق حیواناتیم</p>
          <h2>خدماتی برای پت‌های خاص شما!</h2>
          <p>
            امکانات ربات، با تجربهٔ دسکتاپ قالب Pepito — داده همان لحظه سینک می‌ماند.
            دامپزشکان و همبازی‌ها روی یک حساب مشترک وب و تلگرام.
          </p>
          <ul className="pepito-about-features">
            {SERVICES.slice(0, 3).map((s) => (
              <li key={s.title} className="pepito-about-feature">
                <span className="pepito-about-feature-icon" aria-hidden>
                  <svg
                    className={`pepito-service-blob fill-${s.fill}`}
                    viewBox="0 0 80 72"
                  >
                    <path d={BLOB_PATH} />
                  </svg>
                  <i className={s.icon} />
                </span>
                <span>
                  <strong>{s.title}</strong>
                  <span>{s.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <a href="#services" className="pepito-btn button-1">
            <PawIcon />
            بیشتر بخوانید
          </a>
        </div>
      </section>

      <section className="pepito-section pepito-services-section" id="services">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            عاشق حیواناتیم
          </p>
          <h2>خدمات مراقبت از پت ما</h2>
        </div>
        <div
          className="pepito-services-viewport"
          onMouseEnter={() => setSvcPaused(true)}
          onMouseLeave={() => setSvcPaused(false)}
        >
          <div className="pepito-services-track" ref={svcTrackRef}>
            {SERVICES.map((s) => (
              <article key={s.title} className="pepito-service-card">
                <GatedLink to={s.to} className="pepito-service">
                  <span className="pepito-service-icon">
                    <svg
                      className={`pepito-service-blob fill-${s.fill}`}
                      viewBox="0 0 80 72"
                      aria-hidden
                    >
                      <path d={BLOB_PATH} />
                    </svg>
                    <i className={s.icon} />
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </GatedLink>
              </article>
            ))}
          </div>
        </div>
        <div className="pepito-services-dots" role="tablist" aria-label="خدمات">
          {SERVICES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === svcIndex}
              className={`pepito-services-dot${i === svcIndex ? ' is-active' : ''}`}
              onClick={() => setSvcIndex(i)}
              aria-label={s.title}
            />
          ))}
        </div>
      </section>

      {/* Pepito “Why rely on us?” — media first in RTL → physical right (col-lg-4 offset) */}
      <section className="pepito-section pepito-rely" id="rely">
        <div className="pepito-rely-grid">
          <div className="pepito-rely-media">
            <img src={`${P}/pet3.png`} alt="پت خوشحال — چرا به پت‌دیت اعتماد کنید" loading="lazy" />
          </div>
          <div className="pepito-rely-copy">
            <p className="pepito-eyebrow">
              <span className="pepito-eyebrow-icon" aria-hidden>
                <i className="flaticon-pawprint-4" />
              </span>
              عاشق حیواناتیم
            </p>
            <h2>چرا به ما اعتماد کنید؟</h2>
            <p>
              تیم petdate با تجربهٔ مراقبت از پت، شفافیت در خدمات و همراهی مداوم کنار شماست تا خیالتان از پت‌تان راحت باشد.
            </p>
            <div className="pepito-rely-lists">
              <ul className="pepito-listext">
                {RELY_ITEMS_LEFT.map((t) => (
                  <li key={t}>
                    <span className="pepito-listext-icon" aria-hidden>
                      <i className="flaticon-pawprint-4" />
                    </span>
                    <span className="pepito-listext-text">{t}</span>
                  </li>
                ))}
              </ul>
              <ul className="pepito-listext">
                {RELY_ITEMS_RIGHT.map((t) => (
                  <li key={t}>
                    <span className="pepito-listext-icon" aria-hidden>
                      <i className="flaticon-pawprint-4" />
                    </span>
                    <span className="pepito-listext-text">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="pepito-section pepito-adoption" id="pets">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            پذیرش یک پت
          </p>
          <h2>یک دوست پشمالوی جدید پیدا کن</h2>
        </div>
        <div className="pepito-adoption-grid">
          {PETS.map((p) => (
            <article key={p.name} className="pepito-adoption-card">
              <div className="pepito-adoption-media">
                <img src={p.img} alt={p.name} loading="lazy" />
                <div className="pepito-adoption-shade" aria-hidden />
              </div>
              <div className="pepito-adoption-front">
                <h3>{p.name}</h3>
              </div>
              <Link to={p.to} className="pepito-adoption-back">
                <h3>{p.name}</h3>
                <ul>
                  {p.details.map((d) => (
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

<section className="pepito-section" id="team">
        <div className="pepito-section-head">
          <p className="pepito-eyebrow">متخصصان واجد شرایط</p>
          <h2>با تیم ما آشنا شو</h2>
        </div>
        <div className="pepito-team">
          {TEAM.map((m) => (
            <article key={m.name} className="pepito-member">
              <div className="pepito-member-photo">
                <img src={m.img} alt={TEAM_ALT(m.name, m.role)} loading="lazy" width={600} height={700} decoding="async" />
              </div>
              <div className="pepito-member-info">
                <h3>{m.name}</h3>
                <p>{m.role}</p>
              </div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          {/* Pepito: Book now (button-3 pink) → contact / vet */}
          <GatedLink to="/vet-consult" className="pepito-btn button-3">
            <PawIcon />
            همین حالا رزرو کن
          </GatedLink>
        </div>
      </section>

      <section className="pepito-section pepito-reviews-section" id="reviews">
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <i className="flaticon-pawprint-4" />
            </span>
            عاشقان خوشحال پت
          </p>
          <h2>نظرات petdate</h2>
        </div>
        <div className="pepito-reviews">
          {REVIEWS.map((r) => (
            <article key={r.handle} className="pepito-review">
              <div className="pepito-review-img">
                <div className="pepito-review-img-frame">
                  <img src={r.img} alt={`نظر ${r.handle} درباره پت‌دیت`} loading="lazy" />
                </div>
              </div>
              <div className="pepito-review-body">
                <h3>{r.handle}</h3>
                <div className="pepito-review-stars" aria-label="۵ از ۵ ستاره">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={16} fill="currentColor" strokeWidth={0} aria-hidden />
                  ))}
                </div>
                <p>{r.text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="pepito-review-trust">
          <span className="pepito-review-trust-tag">عاشقان پت</span>
          <p className="pepito-review-trust-desc">
            بیش از ۱۰۰۰ نفر واقعی به مراقبت پت{' '}
            <span className="pepito-underline-pink">petdate</span> اعتماد دارند.
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
            پت شاپ
          </p>
          <h2>محصولات ویژه ما</h2>
        </div>
        <div className="pepito-shop-grid">
          {PRODUCTS.map((p) => (
            <article key={p.name} className="pepito-shop-item">
              <Link to={p.to} className="pepito-shop-wrap">
                <div className="pepito-shop-img">
                  <img src={p.img} alt={p.name} loading="lazy" />
                </div>
                <div className="pepito-shop-price" aria-hidden>
                  <h4>
                    <span>{p.badge}</span>
                    <span className="pepito-shop-amount">{p.price}</span>
                  </h4>
                </div>
              </Link>
              <div className="pepito-shop-text">
                <h3>
                  <Link to={p.to}>{p.name}</Link>
                </h3>
              </div>
            </article>
          ))}
        </div>
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <Link to="/shop" className="pepito-btn button-1">
            <PawIcon />
            ورود به پت شاپ
          </Link>
        </div>
      </section>

      <section className="pepito-section" id="faq">
        <div className="pepito-faq-layout">
          <div className="pepito-faq-intro">
            <p className="pepito-eyebrow">عمومی و پرتکرار</p>
            <h2>سؤالات متداول</h2>
            <p>پاسخ‌های کوتاه دربارهٔ حساب مشترک وب و ربات، OTP و همگام‌سازی داده.</p>
            {/* Pepito: Other FAQs → dedicated FAQ page */}
            <Link to="/faq" className="pepito-btn button-1">
              <PawIcon />
              سایر سؤالات
            </Link>
          </div>
          <div className="pepito-faq">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="pepito-faq-item">
                  <button
                    type="button"
                    className="pepito-faq-q"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                  >
                    <span>
                      {String(i + 1).padStart(2, '0')} {item.q}
                    </span>
                    <span aria-hidden>{open ? '−' : '+'}</span>
                  </button>
                  {open ? <p className="pepito-faq-a">{item.a}</p> : null}
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
            آخرین اخبار
          </p>
          <h2>
            مقالات و اخبار را ببینید<span className="pepito-news-dot">.</span>
          </h2>
        </div>
        <div className="pepito-news-viewport">
          <div className="pepito-news-nav" aria-label="جابجایی اخبار">
            <button
              type="button"
              className="pepito-news-arrow pepito-news-arrow--prev"
              onClick={() => goNews(newsIndex - 1)}
              aria-label="قبلی"
            >
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className="pepito-news-arrow pepito-news-arrow--next"
              onClick={() => goNews(newsIndex + 1)}
              aria-label="بعدی"
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
                      <img src={img} alt={n.title} loading="lazy" />
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
                        <h5>{formatAdminFaDate(n.publishAt)}</h5>
                        <h5>
                          {n.author ? (
                            <>
                              توسط <span className="pepito-news-author-name">{n.author}</span>
                            </>
                          ) : (
                            <Link to="/magazine">مشاهده مجله</Link>
                          )}
                        </h5>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="pepito-news-dots" role="tablist" aria-label="صفحات اخبار">
          {Array.from({ length: newsPages }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === newsIndex}
              className={`pepito-news-dot${i === newsIndex ? ' is-active' : ''}`}
              onClick={() => goNews(i)}
              aria-label={`صفحه ${i + 1}`}
            />
          ))}
        </div>
        <p className="pepito-news-more">
          <Link to="/magazine" className="pepito-btn button-1">
            همه مقالات مجله
          </Link>
        </p>
      </section>

      <section className="pepito-cta">
        <div className="pepito-cta-inner">
          <h2>آماده‌ای از نقش خودت شروع کنی؟</h2>
          <p>
            همبازی، دامپزشک، مربی یا بدون پت — با یک کد یکبارمصرف وارد دنیای مشترک وب و ربات شو.
          </p>
          <GatedLink to="/chats" className="pepito-btn button-1 pepito-btn--lg pepito-btn--on-dark">
            <PawIcon />
            پیدا کردن همبازی
          </GatedLink>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
