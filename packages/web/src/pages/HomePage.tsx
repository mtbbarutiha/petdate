import { Link, Navigate } from 'react-router-dom';
import { GraduationCap, HeartHandshake, Home, PawPrint, Stethoscope } from 'lucide-react';
import { BRAND, dashboardPathForRole, primaryRole } from '@petdate/shared';
import { InviteFriendsCard } from '../components/InviteFriendsCard';
import { useAuthStore } from '../hooks/useAuthStore';
import { useMyPets } from '../hooks/useMyPets';
import { useUserStore } from '../hooks/useUserStore';
import { useI18n } from '../i18n';

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
  const { t, lang } = useI18n();
  const { user } = useUserStore();
  const { user: authUser, isProfileComplete } = useAuthStore();
  const { pets: myPets } = useMyPets();

  // Active role (not merely “has a role”) — aligned with bot + RoleSwitchControl
  const active =
    primaryRole(authUser?.roles, authUser?.role) ??
    primaryRole(user.roles, user.role);

  // Provider roles → dedicated dashboard (not pet-owner panel)
  if (active === 'vet' || active === 'trainer') {
    return <Navigate to={dashboardPathForRole(active)} replace />;
  }

  const isPetOwner = active === 'pet_owner';
  const isNoPet = active === 'no_pet';
  const displayName = authUser?.name?.trim() || t('home.friend');
  const primaryPetName = myPets[0]?.name?.trim() || '';
  const hasPetName = Boolean(primaryPetName);
  const needsProfile = !isProfileComplete;

  const heroImg = isNoPet ? HERO_IMG_NO_PET : isPetOwner ? HERO_IMG_PLAYMATE : HERO_IMG;

  const kicker = needsProfile
    ? lang === 'en'
      ? BRAND.taglineEn
      : BRAND.taglineFa
    : isPetOwner
      ? t('home.kickerPlaymate')
      : isNoPet
        ? t('home.kickerNoPet')
        : lang === 'en'
          ? BRAND.taglineEn
          : BRAND.taglineFa;

  const headline = needsProfile
    ? t('home.helloName', { name: displayName })
    : isPetOwner && hasPetName
      ? t('home.playmateFor', { pet: primaryPetName })
      : isPetOwner
        ? t('home.helloAddPet', { name: displayName })
        : isNoPet
          ? t('home.helloNoPet', { name: displayName })
          : t('home.helloName', { name: displayName });

  const lead = needsProfile
    ? t('home.leadProfile')
    : isPetOwner && hasPetName
      ? t('home.leadPlaymate')
      : isPetOwner
        ? t('home.leadAddPet')
        : isNoPet
          ? t('home.leadNoPet')
          : t('home.leadDefault');

  /** Primary CTA — role order preference: playmate → vet → trainer → no pet */
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
    ? t('home.ctaProfile')
    : isPetOwner && !hasPetName
      ? t('home.ctaAddPet')
      : isPetOwner
        ? t('home.ctaPlaymate')
        : isNoPet
          ? t('home.ctaAdoption')
          : t('home.ctaMyProfile');

  return (
    <div className="pepito-home">
      <section
        className="pepito-home-hero"
        style={{ backgroundImage: `url(${heroImg})` }}
        aria-label={t('home.welcomeAria')}
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
            {isPetOwner && primaryTo !== '/chats' ? (
              <Link
                to="/chats"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-playmate-cta"
              >
                <PlaymateIcon />
                {t('home.playmate')}
              </Link>
            ) : null}
            {isPetOwner || isNoPet ? (
              <Link
                to="/vet-consult"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="owner-quick-vet-cta"
              >
                <VetIcon />
                {t('home.vet')}
              </Link>
            ) : null}
            {isPetOwner ? (
              <Link
                to="/trainer-consult"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="owner-request-trainer-cta"
              >
                <TrainerIcon />
                {t('home.trainer')}
              </Link>
            ) : null}
            {isNoPet ? (
              <Link
                to="/adoption"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-no-pet-adoption-cta"
              >
                <NoPetIcon />
                {t('home.ctaAdoption')}
              </Link>
            ) : null}
            {isNoPet ? (
              <Link
                to="/add-pet"
                className="pepito-btn pepito-btn--ghost pepito-home-cta-ghost"
                data-testid="home-no-pet-add-pet-cta"
              >
                <PawIcon />
                {t('home.ctaAddPet')}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="pepito-home-next" aria-label={t('home.nextAria')}>
        <header className="pepito-home-section-head">
          <p className="pepito-eyebrow">{t('home.now')}</p>
          <h2>{t('home.nextTitle')}</h2>
          <p>{t('home.nextLead')}</p>
        </header>
        <div className="pepito-home-actions">
          {needsProfile ? (
            <Link to="/onboarding/profile" className="pepito-home-action">
              <strong>{t('home.actProfile')}</strong>
              <span>{t('home.actProfileSub')}</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link to="/chats" className="pepito-home-action" data-testid="home-action-playmate">
              <strong>{t('home.actPlaymate')}</strong>
              <span>{t('home.actPlaymateSub')}</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link to="/my-pets" className="pepito-home-action">
              <strong>{t('home.actPets')}</strong>
              <span>{t('home.actPetsSub')}</span>
            </Link>
          ) : null}
          {isPetOwner || isNoPet ? (
            <Link
              to="/vet-consult"
              className="pepito-home-action"
              data-testid="owner-quick-vet-home-action"
            >
              <strong>{t('home.actVet')}</strong>
              <span>{t('home.actVetSub')}</span>
            </Link>
          ) : null}
          {isPetOwner ? (
            <Link
              to="/trainer-consult"
              className="pepito-home-action"
              data-testid="owner-request-trainer-home-action"
            >
              <strong>{t('home.actTrainer')}</strong>
              <span>{t('home.actTrainerSub')}</span>
            </Link>
          ) : null}
          {isNoPet ? (
            <Link to="/adoption" className="pepito-home-action" data-testid="home-action-no-pet">
              <strong>{t('home.actNoPet')}</strong>
              <span>{t('home.actNoPetSub')}</span>
            </Link>
          ) : null}
          {!isPetOwner && !isNoPet ? (
            <Link to="/profile" className="pepito-home-action">
              <strong>{t('home.actProfileSvc')}</strong>
              <span>{t('home.actProfileSvcSub')}</span>
            </Link>
          ) : null}
        </div>
      </section>

      <InviteFriendsCard variant="card" className="pepito-home-invite" />

      {!isPetOwner ? (
        <section className="pepito-home-services" aria-label={t('home.svcAria')}>
          <header className="pepito-home-section-head">
            <p className="pepito-eyebrow">{t('home.svcEyebrow')}</p>
            <h2>{t('home.svcTitle')}</h2>
            <p>{t('home.svcLead')}</p>
          </header>
          <div className="pepito-home-actions">
            <Link to="/shop" className="pepito-home-action">
              <strong>{t('home.svcShop')}</strong>
              <span>{t('home.svcShopSub')}</span>
            </Link>
            <Link to="/vet-consult" className="pepito-home-action">
              <strong>{t('home.svcVet')}</strong>
              <span>{t('home.svcVetSub')}</span>
            </Link>
            {isNoPet ? (
              <Link to="/adoption" className="pepito-home-action">
                <strong>{t('home.svcAdopt')}</strong>
                <span>{t('home.svcAdoptSub')}</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
