import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PawPrint, Stethoscope } from 'lucide-react';
import { BRAND, dashboardPathForRole, primaryRole, type PetProfile } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useUserStore } from '../hooks/useUserStore';
import { listMyPets } from '../lib/api';
import { petProfileToUiPet } from '../lib/playdateMap';

const HERO_IMG = '/pepito/uploads/3.jpg';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
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

export function HomePage() {
  const { user } = useUserStore();
  const { user: authUser, isProfileComplete, token } = useAuthStore();
  const [myPets, setMyPets] = useState<PetProfile[]>([]);

  // نقش فعال (نه فقط «داشتن نقش») — هم‌تراز ربات و RoleSwitchControl
  const active =
    primaryRole(authUser?.roles, authUser?.role) ??
    primaryRole(user.roles, user.role);

  useEffect(() => {
    if (!token || active !== 'pet_owner') {
      setMyPets([]);
      return;
    }
    let cancelled = false;
    void listMyPets(token)
      .then((rows) => {
        if (!cancelled) setMyPets(rows);
      })
      .catch(() => {
        if (!cancelled) setMyPets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token, active]);

  // دامپزشک فعال → داشبورد اختصاصی پزشک (نه پنل صاحب‌پت)
  if (active === 'vet') {
    return <Navigate to={dashboardPathForRole('vet')} replace />;
  }

  const isPetOwner = active === 'pet_owner';
  const displayName = authUser?.name?.trim() || 'دوست';
  const primaryPet = myPets[0] ? petProfileToUiPet(myPets[0]) : null;
  const hasPetName = Boolean(primaryPet?.name);
  const needsProfile = !isProfileComplete;

  const lead = needsProfile
    ? 'پروفایلت را کامل کن تا همبازی و خدمات نزدیک‌تر شوند.'
    : isPetOwner && hasPetName
      ? `همبازی برای ${primaryPet!.name} — درخواست بفرست و مدیریت کن در همان فضای Pet Date.`
      : isPetOwner
        ? 'پت‌ات را ثبت کن و همبازی پیدا کن — همان حساب وب و تلگرام.'
        : 'از پروفایل، کلینیک، پت شاپ و مشاوره را در همین محیط ادامه بده.';

  const primaryTo = needsProfile
    ? '/onboarding/profile'
    : isPetOwner && !hasPetName
      ? '/add-pet'
      : isPetOwner
        ? '/chats'
        : '/profile';
  const primaryLabel = needsProfile
    ? 'تکمیل پروفایل'
    : isPetOwner && !hasPetName
      ? 'ثبت پت'
      : isPetOwner
        ? 'هم بازی'
        : 'پروفایل من';

  return (
    <div className="pepito-home">
      <section
        className="pepito-home-hero"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        aria-label="خوش‌آمد"
      >
        <div className="pepito-home-hero-wash" aria-hidden />
        <div className="pepito-home-hero-inner">
          <p className="pepito-kicker pepito-home-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <PawPrint size={16} />
            </span>
            {BRAND.taglineFa}
          </p>
          <p className="pepito-home-brand">{BRAND.displayName}</p>
          <h1>سلام {displayName}</h1>
          <p className="pepito-home-lead">{lead}</p>
          <div className="pepito-home-cta">
            <Link to={primaryTo} className="pepito-btn button-1">
              <PawIcon />
              {primaryLabel}
            </Link>
            {isPetOwner && primaryTo !== '/chats' ? (
              <Link to="/chats" className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost">
                هم بازی
              </Link>
            ) : null}
            {isPetOwner ? (
              <Link
                to="/vet-consult"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="owner-quick-vet-cta"
              >
                <VetIcon />
                مشاوره سریع
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="pepito-home-next" aria-label="قدم بعدی">
        <header className="pepito-home-section-head">
          <p className="pepito-eyebrow">همین حالا</p>
          <h2>قدم بعدی‌ات در Pet Date</h2>
          <p>همان زبان لندینگ — بدون پنل جدا.</p>
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
          <Link to={isPetOwner ? '/chats' : '/profile'} className="pepito-home-action">
            <strong>{isPetOwner ? 'هم بازی' : 'پروفایل و خدمات'}</strong>
            <span>
              {isPetOwner
                ? 'پیدا کردن همبازی و مدیریت گفتگوها'
                : 'پت شاپ و مشاوره'}
            </span>
          </Link>
          {isPetOwner ? (
            <Link
              to="/vet-consult"
              className="pepito-home-action"
              data-testid="owner-quick-vet-home-action"
            >
              <strong>مشاوره سریع با پزشک</strong>
              <span>درخواست فوری — کسر سکه از کیف پول</span>
            </Link>
          ) : null}
        </div>
      </section>

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
          </div>
        </section>
      ) : null}
    </div>
  );
}
