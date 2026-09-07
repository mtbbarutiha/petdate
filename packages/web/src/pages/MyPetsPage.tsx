import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, PawPrint, Pencil, Plus, Stethoscope } from 'lucide-react';
import type { PetProfile } from '@petdate/shared';
import { BRAND, toPersianDigits } from '@petdate/shared';
import { PetAvatar } from '../components/PetAvatar';
import { useAuthStore } from '../hooks/useAuthStore';
import { listMyPets } from '../lib/api';
import { petProfileToUiPet } from '../lib/playdateMap';
import { PET_TYPE_LABELS } from '../types';
import { formatAge } from '../data/mock';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

/** Owner hub: list pets with profile + edit + medical entry points (mobile + desktop). */
export function MyPetsPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, token, refreshMe } = useAuthStore();
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setPets([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const me = await refreshMe();
        if (cancelled) return;
        if (!me) {
          setPets([]);
          return;
        }
        const rows = await listMyPets(token);
        if (!cancelled) setPets(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'بارگذاری پت‌ها ناموفق بود');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, token, refreshMe]);

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
            <h1>پت‌های من</h1>
            <p className="pepito-my-pets-lead">برای دیدن و ویرایش پت‌ها وارد شو.</p>
          </div>
        </header>
        <Link to="/auth/login?next=/my-pets" className="pepito-btn button-1">
          ورود
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
          <h1>پت‌های من</h1>
          <p className="pepito-my-pets-lead">
            پروفایل، ویرایش و پرونده پزشکی هر پت — جدا از پروفایل خودت.
          </p>
          <Link to="/add-pet" className="pepito-btn button-1 pepito-my-pets-add">
            <Plus size={18} aria-hidden />
            ثبت پت جدید
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
          <h2>هنوز پتی ثبت نشده</h2>
          <p>اولین پت را بساز تا همبازی و پرونده پزشکی فعال شود.</p>
          <Link to="/add-pet" className="pepito-btn button-1">
            <Plus size={18} aria-hidden />
            ثبت پت
          </Link>
        </div>
      ) : (
        <ul className="pepito-my-pets-grid">
          {pets.map((pet) => {
            const ui = petProfileToUiPet(pet);
            return (
              <li key={pet.id} className="pepito-my-pets-card">
                {pet.lookingForPlaymate ? (
                  <span className="pepito-my-pets-chip">دنبال همبازی</span>
                ) : null}
                <Link to={`/pets/${pet.id}`} className="pepito-my-pets-card-main">
                  <PetAvatar
                    type={ui.type}
                    size="lg"
                    imageUrl={ui.imageUrl}
                    name={pet.name}
                  />
                  <div className="pepito-my-pets-card-text">
                    <strong>{pet.name}</strong>
                    <span>
                      {PET_TYPE_LABELS[ui.type] || pet.species} · {formatAge(ui)}
                    </span>
                    <small>
                      {[pet.breed, pet.city || pet.ownerCity].filter(Boolean).join(' · ') || '—'}
                    </small>
                  </div>
                </Link>
                <div className="pepito-my-pets-card-actions">
                  <Link
                    to={`/pets/${pet.id}`}
                    className="pepito-my-pets-action"
                    aria-label={`پروفایل ${pet.name}`}
                  >
                    پروفایل
                  </Link>
                  <Link
                    to={`/pets/${pet.id}/edit`}
                    className="pepito-my-pets-action"
                    aria-label={`ویرایش ${pet.name}`}
                  >
                    <Pencil size={14} aria-hidden />
                    ویرایش
                  </Link>
                  <Link
                    to={`/pets/${pet.id}?tab=medical`}
                    className="pepito-my-pets-action pepito-my-pets-action--med"
                    aria-label={`پرونده پزشکی ${pet.name}`}
                  >
                    <Stethoscope size={14} aria-hidden />
                    پرونده
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="pepito-my-pets-count" aria-live="polite">
        {pets.length ? `${toPersianDigits(String(pets.length))} پت ثبت‌شده` : null}
      </p>

      <button
        type="button"
        className="pepito-btn pepito-btn--ghost pepito-my-pets-back"
        onClick={() => navigate(-1)}
      >
        <ArrowRight size={16} aria-hidden />
        بازگشت
      </button>
    </div>
  );
}
