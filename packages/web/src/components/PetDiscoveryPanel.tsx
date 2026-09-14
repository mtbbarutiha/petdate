import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, PawPrint, Search } from 'lucide-react';
import type { PetProfile } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useI18n } from '../i18n';
import { listNearbyPets, listPets } from '../lib/api';
import { PetAvatar } from './PetAvatar';

export type PetDiscoveryMode = 'nearby' | 'samebreed' | 'sameprovince';

type Props = {
  /** Owner pets used for same-breed / same-province seeds. */
  myPets: PetProfile[];
  className?: string;
};

/**
 * Bot parity discovery chips: پت‌های نزدیک من / هم‌نژاد / هم‌استان.
 * Lives next to find-playmate CTA inside /chats.
 */
export function PetDiscoveryPanel({ myPets, className = '' }: Props) {
  const { t } = useI18n();
  const { user, isLoggedIn } = useAuthStore();
  const { toastError, toastInfo } = useAppToast();
  const [mode, setMode] = useState<PetDiscoveryMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PetProfile[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const myUserId = user?.id;
  const province = user?.province?.trim() || '';

  const runMode = useCallback(
    async (next: PetDiscoveryMode) => {
      if (!isLoggedIn || !myUserId) {
        toastError(t('chats.discoveryLogin'));
        return;
      }
      setMode(next);
      setBusy(true);
      setResults([]);
      setStatus(null);
      try {
        if (next === 'nearby') {
          const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error(t('chats.discoveryGeoUnsupported')));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos.coords),
              (err) => reject(err),
              { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 }
            );
          });
          const rows = await listNearbyPets({
            lat: coords.latitude,
            lng: coords.longitude,
            radiusKm: 25,
            excludeOwnerId: myUserId,
            limit: 24,
          });
          setResults(rows);
          setStatus(
            rows.length
              ? t('chats.discoveryNearbyCount', { n: rows.length })
              : t('chats.discoveryNearbyEmpty')
          );
          return;
        }

        if (next === 'sameprovince') {
          if (!province) {
            setStatus(t('chats.discoveryNeedProvince'));
            toastInfo(t('chats.discoveryNeedProvince'));
            return;
          }
          const rows = await listPets({
            province,
            lookingForPlaymate: true,
            excludeOwnerId: myUserId,
            sort: 'newest',
          });
          setResults(rows.slice(0, 24));
          setStatus(
            rows.length
              ? t('chats.discoveryProvinceCount', { n: Math.min(rows.length, 24), province })
              : t('chats.discoveryProvinceEmpty', { province })
          );
          return;
        }

        // samebreed
        const breeds = [
          ...new Set(
            myPets
              .map((p) => p.breed?.trim())
              .filter((b): b is string => Boolean(b))
          ),
        ];
        if (!breeds.length) {
          setStatus(t('chats.discoveryNeedBreed'));
          toastInfo(t('chats.discoveryNeedBreed'));
          return;
        }
        const rows = await listPets({
          breeds,
          lookingForPlaymate: true,
          excludeOwnerId: myUserId,
          sort: 'newest',
        });
        setResults(rows.slice(0, 24));
        setStatus(
          rows.length
            ? t('chats.discoveryBreedCount', { n: Math.min(rows.length, 24) })
            : t('chats.discoveryBreedEmpty')
        );
      } catch (err) {
        const msg =
          err instanceof GeolocationPositionError
            ? t('chats.discoveryGeoDenied')
            : err instanceof Error
              ? err.message
              : t('chats.discoveryFail');
        setStatus(msg);
        toastError(msg);
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, myPets, myUserId, province, t, toastError, toastInfo]
  );

  useEffect(() => {
    setResults([]);
    setMode(null);
    setStatus(null);
  }, [myUserId]);

  const chips: { id: PetDiscoveryMode; label: string; Icon: typeof MapPin }[] = [
    { id: 'nearby', label: t('chats.discoveryNearby'), Icon: MapPin },
    { id: 'samebreed', label: t('chats.discoverySameBreed'), Icon: PawPrint },
    { id: 'sameprovince', label: t('chats.discoverySameProvince'), Icon: Search },
  ];

  return (
    <section
      className={`pepito-pet-discovery${className ? ` ${className}` : ''}`}
      aria-label={t('chats.discoveryTitle')}
      data-testid="pet-discovery"
    >
      <header className="pepito-pet-discovery-head">
        <h3>{t('chats.discoveryTitle')}</h3>
        <p>{t('chats.discoveryLead')}</p>
      </header>
      <div className="pepito-pet-discovery-chips" role="toolbar">
        {chips.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`pepito-pet-discovery-chip${mode === id ? ' is-active' : ''}`}
            disabled={busy}
            data-testid={`pet-discovery-${id}`}
            onClick={() => void runMode(id)}
          >
            <Icon size={16} strokeWidth={2.25} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {status ? <p className="pepito-pet-discovery-status">{status}</p> : null}
      {busy ? <p className="pepito-muted">{t('common.loading')}</p> : null}
      {results.length > 0 ? (
        <ul className="pepito-pet-discovery-list">
          {results.map((pet) => (
            <li key={pet.id}>
              <Link to={`/p/${pet.slug || pet.publicId || pet.id}`} className="pepito-pet-discovery-card">
                <PetAvatar
                  type={pet.species === 'cat' ? 'cat' : pet.species === 'bird' ? 'bird' : 'dog'}
                  size="sm"
                  imageUrl={pet.imageUrl}
                  name={pet.name}
                />
                <span className="pepito-pet-discovery-copy">
                  <strong>{pet.name}</strong>
                  <span>
                    {[pet.breed, pet.city || pet.ownerCity, pet.ownerProvince]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
