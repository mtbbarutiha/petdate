import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, PawPrint, Pencil, Plus, Stethoscope } from 'lucide-react';
import { BRAND, petPublicIdOf } from '@petdate/shared';
import { PetAvatar } from '../components/PetAvatar';
import { useAuthStore } from '../hooks/useAuthStore';
import { useMyPets } from '../hooks/useMyPets';
import { petProfileToUiPet } from '../lib/playdateMap';
import { PET_TYPE_LABELS } from '../types';
import { formatAge } from '../data/mock';
import { useI18n } from '../i18n';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

/** Owner hub: list pets with profile + edit + medical entry points (mobile + desktop). */
export function MyPetsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuthStore();
  const { pets, loading, error } = useMyPets();

  if (!isLoggedIn) {
    return (
      <div className="pepito-my-pets pepito-my-pets--gate">
        <header className="pepito-my-pets-hero">
          <div className="pepito-my-pets-hero-wash" aria-hidden />
          <div className="pepito-my-pets-hero-inner">
            <p className="pepito-kicker">
              <span className="pepito-kicker-dot" aria-hidden>
                <PawPrint size={16} />
              </span>
              {BRAND.displayName}
            </p>
            <h1>{t('pets.title')}</h1>
            <p className="pepito-my-pets-lead">{t('pets.loginLead')}</p>
          </div>
        </header>
        <Link to="/auth/login?next=/my-pets" className="pepito-btn button-1">
          {t('common.login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="pepito-my-pets">
      <header className="pepito-my-pets-hero">
        <div className="pepito-my-pets-hero-wash" aria-hidden />
        <div className="pepito-my-pets-hero-inner">
          <p className="pepito-kicker">
            <span className="pepito-kicker-dot" aria-hidden>
              <PawPrint size={16} />
            </span>
            {BRAND.displayName}
          </p>
          <h1>{t('pets.title')}</h1>
          <p className="pepito-my-pets-lead">
            {t('pets.leadOwner')}
          </p>
          <Link to="/add-pet" className="pepito-btn button-1 pepito-my-pets-add">
            <Plus size={18} aria-hidden />
            {t('pets.addNew')}
          </Link>
        </div>
      </header>

      {error ? <p className="auth-error">{error}</p> : null}

      {loading ? (
        <div className="pepito-my-pets-grid" aria-busy="true">
          <div className="pepito-my-pets-card is-skeleton" />
          <div className="pepito-my-pets-card is-skeleton" />
        </div>
      ) : pets.length === 0 ? (
        <div className="pepito-my-pets-empty">
          <span className="pepito-my-pets-empty-mark" aria-hidden>
            <PawIcon size={28} />
          </span>
          <h2>{t('pets.emptyTitle')}</h2>
          <p>{t('pets.emptyLead')}</p>
          <Link to="/add-pet" className="pepito-btn button-1">
            <Plus size={18} aria-hidden />
            {t('pets.add')}
          </Link>
        </div>
      ) : (
        <ul className="pepito-my-pets-grid">
          {pets.map((pet) => {
            const ui = petProfileToUiPet(pet);
            return (
              <li key={pet.id} className="pepito-my-pets-card">
                <Link to={`/pets/${pet.id}`} className="pepito-my-pets-card-main">
                  <div className="pepito-my-pets-card-media">
                    {pet.lookingForPlaymate ? (
                      <span className="pepito-my-pets-chip">{t('pets.lookingPlaymate')}</span>
                    ) : null}
                    <PetAvatar
                      type={ui.type}
                      size="lg"
                      variant="cover"
                      imageUrl={ui.imageUrl}
                      name={pet.name}
                      className="pepito-my-pets-card-photo"
                    />
                  </div>
                  <div className="pepito-my-pets-card-body">
                    <div className="pepito-my-pets-card-text">
                      <strong>{pet.name}</strong>
                      <span>
                        {PET_TYPE_LABELS[ui.type] || pet.species} · {formatAge(ui)}
                      </span>
                      <small>
                        {[pet.breed, pet.city || pet.ownerCity].filter(Boolean).join(' · ') || '—'}
                      </small>
                      <span className="pepito-my-pets-card-id" dir="ltr">
                        {t('pets.petId', { id: petPublicIdOf(pet) })}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="pepito-my-pets-card-actions">
                  <Link
                    to={`/pets/${pet.id}`}
                    className="pepito-my-pets-action"
                    aria-label={t('pets.profileOf', { name: pet.name })}
                  >
                    {t('pets.profileShort')}
                  </Link>
                  <Link
                    to={`/pets/${pet.id}/edit`}
                    className="pepito-my-pets-action"
                    aria-label={t('pets.editOf', { name: pet.name })}
                  >
                    <Pencil size={14} aria-hidden />
                    {t('pets.editShort')}
                  </Link>
                  <Link
                    to={`/pets/${pet.id}#pet-diary`}
                    className="pepito-my-pets-action pepito-my-pets-action--diary"
                    aria-label={t('pets.diaryOf', { name: pet.name })}
                  >
                    <BookOpen size={14} aria-hidden />
                    {t('pets.diaryShort')}
                  </Link>
                  <Link
                    to={`/pets/${pet.id}#pet-medical`}
                    className="pepito-my-pets-action pepito-my-pets-action--med"
                    aria-label={t('pets.medicalOf', { name: pet.name })}
                  >
                    <Stethoscope size={14} aria-hidden />
                    {t('pets.medicalShort')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="pepito-my-pets-count" aria-live="polite">
        {pets.length ? t('pets.countRegistered', { n: pets.length }) : null}
      </p>

      <button
        type="button"
        className="pepito-btn pepito-btn--ghost pepito-my-pets-back"
        onClick={() => navigate(-1)}
      >
        <ArrowRight size={16} aria-hidden />
        {t('common.back')}
      </button>
    </div>
  );
}
