import { Link, Navigate } from 'react-router-dom';
import { GraduationCap, HeartHandshake, Home, PawPrint, Stethoscope } from 'lucide-react';
import { BRAND, dashboardPathForRole, primaryRole } from '@petdate/shared';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { useAuthStore } from '../hooks/useAuthStore';
import { useMyPets } from '../hooks/useMyPets';
import { useUserStore } from '../hooks/useUserStore';

const HERO_IMG = '/pepito/uploads/3.jpg';
const HERO_IMG_PLAYMATE = '/pepito/uploads/1-hero.jpg';
const HERO_IMG_NO_PET = '/pepito/uploads/06-hero.jpg';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

function PlaymateIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <HeartHandshake size={size} />
    </span>
  );
}

function VetIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <Stethoscope size={size} />
    </span>
  );
}

function TrainerIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <GraduationCap size={size} />
    </span>
  );
}

function NoPetIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <Home size={size} />
    </span>
  );
}

export function HomePage() {
  const { user } = useUserStore();
  const { user: authUser, isProfileComplete } = useAuthStore();
  const { pets: myPets } = useMyPets();

  // نقش فعال (نه فقط «داشتن نقش») — هم‌تراز ربات و RoleSwitchControl
  const active =
    primaryRole(authUser?.roles, authUser?.role) ??
    primaryRole(user.roles, user.role);

  // نقش‌های ارائه‌دهنده → داشبورد اختصاصی (نه پنل صاحب‌پت)
  if (active === 'vet' || active === 'trainer') {
    return <Navigate to={dashboardPathForRole(active)} replace />;
  }

  const isPetOwner = active === 'pet_owner';
  const isNoPet = active === 'no_pet';
  const displayName = authUser?.name?.trim() || 'دوست';
  const primaryPetName = myPets[0]?.name?.trim() || '';
  const hasPetName = Boolean(primaryPetName);
  const needsProfile = !isProfileComplete;

  const heroImg = isNoPet ? HERO_IMG_NO_PET : isPetOwner ? HERO_IMG_PLAYMATE : HERO_IMG;

  const kicker = needsProfile
    ? BRAND.taglineFa
    : isPetOwner
      ? 'همبازی پت'
      : isNoPet
        ? 'بدون پت'
        : BRAND.taglineFa;

  const headline = needsProfile
    ? `سلام ${displayName}`
    : isPetOwner && hasPetName
      ? `همبازی برای ${primaryPetName}`
      : isPetOwner
        ? `سلام ${displayName} — پت‌ات را ثبت کن`
        : isNoPet
          ? `سلام ${displayName} — شروع بدون پت`
          : `سلام ${displayName}`;

  const lead = needsProfile
    ? 'پروفایلت را کامل کن تا همبازی، دامپزشک و مربی نزدیک‌تر شوند.'
    : isPetOwner && hasPetName
      ? `درخواست همبازی بفرست، بعد مشاوره دامپزشک یا مربی — همان فضای Pet Date.`
      : isPetOwner
        ? 'پت‌ات را ثبت کن و همبازی پیدا کن — همان حساب وب و تلگرام.'
        : isNoPet
          ? 'مشاوره خرید بگیر، پذیرش را ببین، یا وقتی آماده شدی پت ثبت کن.'
          : 'از پروفایل، کلینیک، پت شاپ و مشاوره را در همین محیط ادامه بده.';

  /** Primary CTA — role order preference: همبازی → دامپزشک → مربی → بدون پت */
  const primaryTo = needsProfile
    ? '/onboarding/profile'
    : isPetOwner && !hasPetName
      ? '/add-pet'
      : isPetOwner
        ? '/chats'
        : isNoPet
          ? '/adoption'
          : '/profile';
  const primaryLabel = needsProfile
    ? 'تکمیل پروفایل'
    : isPetOwner && !hasPetName
      ? 'ثبت پت'
      : isPetOwner
        ? 'پیدا کردن همبازی'
        : isNoPet
          ? 'پذیرش پت'
          : 'پروفایل من';

  return (
    <div className="pepito-home">
      <section
        className="pepito-home-hero"
        style={{ backgroundImage: `url(${heroImg})` }}
        aria-label="خوش‌آمد"
      >
        <div className="pepito-home-hero-wash" aria-hidden />
        <div className="pepito-home-hero-inner">
          <p className="pepito-kicker pepito-home-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <PawPrint size={16} />
            </span>
            {kicker}
          </p>
          <p className="pepito-home-brand">{BRAND.displayName}</p>
          <h1>{headline}</h1>
          <p className="pepito-home-lead">{lead}</p>
          <div className="pepito-home-cta">
            <Link to={primaryTo} className="pepito-btn button-1" data-testid="home-primary-cta">
              {isPetOwner && !needsProfile && hasPetName ? <PlaymateIcon /> : isNoPet ? <NoPetIcon /> : <PawIcon />}
              {primaryLabel}
            </Link>
            {/* Role CTAs in fixed order: همبازی → دامپزشک → مربی → بدون پت */}
            {isPetOwner && primaryTo !== '/chats' ? (
              <Link
                to="/chats"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-playmate-cta"
              >
                <PlaymateIcon />
                همبازی
              </Link>
            ) : null}
            {isPetOwner || isNoPet ? (
              <Link
                to="/vet-consult"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="owner-quick-vet-cta"
              >
                <VetIcon />
                دامپزشک
              </Link>
            ) : null}
            {isPetOwner ? (
              <Link
                to="/trainer-consult"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="owner-request-trainer-cta"
              >
                <TrainerIcon />
                مربی
              </Link>
            ) : null}
            {isNoPet ? (
              <Link
                to="/adoption"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-no-pet-adoption-cta"
              >
                <NoPetIcon />
                پذیرش پت
              </Link>
            ) : null}
            {isNoPet ? (
              <Link
                to="/add-pet"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-no-pet-add-pet-cta"
              >
                <PawIcon />
                ثبت پت
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="pepito-home-next" aria-label="قدم بعدی">
        <header className="pepito-home-section-head">
          <p className="pepito-eyebrow">همین حالا</p>
          <h2>قدم بعدی‌ات در Pet Date</h2>
          <p>همبازی، دامپزشک، مربی یا بدون پت — بدون پنل جدا.</p>
        </header>
        <div className="pepito-home-actions">
          {needsProfile ? (
            <Link to="/onboarding/profile" className="pepito-home-action">
              <strong>تکمیل پروفایل</strong>
              <span>نام، شهر و نقش را تمام کن</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link to="/my-pets" className="pepito-home-action">
              <strong>پت‌های من</strong>
              <span>ثبت یا ویرایش پت‌ها</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link to="/chats" className="pepito-home-action" data-testid="home-action-playmate">
              <strong>همبازی</strong>
              <span>پیدا کردن همبازی و مدیریت گفتگوها</span>
            </Link>
          ) : null}
          {isPetOwner || isNoPet ? (
            <Link
              to="/vet-consult"
              className="pepito-home-action"
              data-testid="owner-quick-vet-home-action"
            >
              <strong>دامپزشک</strong>
              <span>مشاوره سریع — کسر سکه از کیف پول</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link
              to="/trainer-consult"
              className="pepito-home-action"
              data-testid="owner-request-trainer-home-action"
            >
              <strong>مربی</strong>
              <span>درخواست به مربی‌های آنلاین</span>
            </Link>
          ) : null}
          {isNoPet ? (
            <Link to="/adoption" className="pepito-home-action" data-testid="home-action-no-pet">
              <strong>بدون پت / پذیرش</strong>
              <span>مشاوره خرید و پت‌های نیازمند خانه</span>
            </Link>
          ) : null}
          {!isPetOwner && !isNoPet ? (
            <Link to="/profile" className="pepito-home-action">
              <strong>پروفایل و خدمات</strong>
              <span>پت شاپ و مشاوره</span>
            </Link>
          ) : null}
        </div>
      </section>

      <InviteFriendsCard variant="card" className="pepito-home-invite" />

      {!isPetOwner ? (
        <section className="pepito-home-services" aria-label="خدمات">
          <header className="pepito-home-section-head">
            <p className="pepito-eyebrow">خدمات</p>
            <h2>ادامه در همین فضا</h2>
            <p>پت شاپ و مشاوره — بدون ترک ظاهر لندینگ.</p>
          </header>
          <div className="pepito-home-actions">
            <Link to="/shop" className="pepito-home-action">
              <strong>پت شاپ</strong>
              <span>لوازم و محصولات پت</span>
            </Link>
            <Link to="/vet-consult" className="pepito-home-action">
              <strong>مشاوره دامپزشک</strong>
              <span>ارتباط سریع با پزشک</span>
            </Link>
            {isNoPet ? (
              <Link to="/adoption" className="pepito-home-action">
                <strong>پذیرش پت</strong>
                <span>شروع مسیر بدون پت</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
