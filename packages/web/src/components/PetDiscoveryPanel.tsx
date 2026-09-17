import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Contact, MapPin, PawPrint, Search } from 'lucide-react';
import {
  PET_BREEDS_SEED,
  PET_SPECIES,
  PLAYDATE_REQUEST_COST,
  SEEKER_ADVICE_COST,
  toPersianDigits,
  type PetProfile,
  type PetSpeciesCode,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useI18n } from '../i18n';
import { listNearbyPets, listPets, listUserContacts, quickVetConnect } from '../lib/api';
import { sendPlaymateRequestNow } from '../lib/playmateActions';
import { peopleFromDiscoveryPets } from '../lib/petDiscoveryPeople';
import { authStore } from '../data/authStore';
import { ConfirmModal } from './ConfirmModal';
import { InboxPeerAvatar } from './InboxPeerAvatar';
import { PetAvatar } from './PetAvatar';

export type PetDiscoveryMode = 'nearby' | 'samebreed' | 'sameprovince' | 'contacts';

type ContactRow = {
  contactUserId: number;
  contactName?: string;
  contactAvatarUrl?: string;
  contactGender?: string;
  contactPublicId?: string;
};

type Props = {
  /** Owner pets used for same-breed / same-province seeds + request fromPetId. */
  myPets: PetProfile[];
  className?: string;
  /** Called after a successful playmate request so parent can refresh inbox */
  onSent?: () => void;
  /** Open existing playmate chat; return true if opened. False → panel may send a new request. */
  onOpenContact?: (id: number) => boolean;
  /**
   * `panel` = full card with title (default).
   * `bar` = compact chip row for chat list header (no title/lead chrome).
   */
  variant?: 'panel' | 'bar';
  /**
   * `playmate` = pet-owner discovery + playmate request.
   * `owners` = no-pet role: nearby / breed-picker / same-province → seeker advice.
   */
  audience?: 'playmate' | 'owners';
};

export type { DiscoveryPerson } from '../lib/petDiscoveryPeople';
export { peopleFromDiscoveryPets } from '../lib/petDiscoveryPeople';

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

/**
 * Bot parity discovery chips: پت‌های نزدیک من / هم‌نژاد / هم‌استان / لیست مخاطبین.
 * No-pet audience: مالکین نزدیک من / مالکین نژاد / هم استان → مشورت بگیر.
 */
export function PetDiscoveryPanel({
  myPets,
  className = '',
  onSent,
  onOpenContact,
  variant = 'panel',
  audience = 'playmate',
}: Props) {
  const { t } = useI18n();
  const { user, token, isLoggedIn } = useAuthStore();
  const { toastError, toastInfo, toastSuccess } = useAppToast();
  const isOwners = audience === 'owners';
  const [mode, setMode] = useState<PetDiscoveryMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PetProfile[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState(false);
  const [sendingOwnerId, setSendingOwnerId] = useState<number | null>(null);
  const [sentOwnerIds, setSentOwnerIds] = useState<Set<number>>(() => new Set());
  /** Pending target pet for fee confirm / from-pet pick */
  const [pendingTo, setPendingTo] = useState<PetProfile | null>(null);
  const [pickFromOpen, setPickFromOpen] = useState(false);
  const [feeConfirmOpen, setFeeConfirmOpen] = useState(false);
  const [fromPetId, setFromPetId] = useState<number | null>(null);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [breedSpecies, setBreedSpecies] = useState<PetSpeciesCode | null>(null);

  const myUserId = user?.id;
  const province = user?.province?.trim() || '';
  const coins = user?.coins ?? user?.wallet?.coins ?? 0;
  const requestCost = isOwners ? SEEKER_ADVICE_COST : PLAYDATE_REQUEST_COST;

  const people = useMemo(() => peopleFromDiscoveryPets(results), [results]);

  const runBreedSearch = useCallback(
    async (breedName: string) => {
      if (!isLoggedIn || !myUserId) {
        toastError(t('chats.discoveryLogin'));
        return;
      }
      setBreedPickerOpen(false);
      setBreedSpecies(null);
      setMode('samebreed');
      setBusy(true);
      setResults([]);
      setContacts([]);
      setStatus(null);
      setErrorKind(false);
      try {
        const rows = await listPets({
          breeds: [breedName],
          lookingForPlaymate: isOwners ? undefined : true,
          excludeOwnerId: myUserId,
          sort: 'newest',
        });
        const slice = rows.slice(0, 24);
        setResults(slice);
        const n = peopleFromDiscoveryPets(slice).length;
        setStatus(
          n
            ? t('chats.discoveryBreedCount', { n })
            : t('chats.discoveryBreedEmpty')
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('chats.discoveryFail');
        setErrorKind(true);
        setStatus(msg);
        toastError(msg);
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, isOwners, myUserId, t, toastError]
  );

  const runMode = useCallback(
    async (next: PetDiscoveryMode) => {
      if (!isLoggedIn || !myUserId) {
        toastError(t('chats.discoveryLogin'));
        return;
      }
      if (isOwners && next === 'samebreed') {
        setBreedSpecies(null);
        setBreedPickerOpen(true);
        return;
      }
      setMode(next);
      setBusy(true);
      setResults([]);
      setContacts([]);
      setStatus(null);
      setErrorKind(false);
      try {
        if (next === 'contacts') {
          const rows = await listUserContacts(myUserId);
          setContacts(
            rows.map((r) => ({
              contactUserId: r.contactUserId,
              contactName: r.contactName,
              contactAvatarUrl: r.contactAvatarUrl,
              contactGender: r.contactGender,
              contactPublicId: r.contactPublicId,
            }))
          );
          const n = rows.length;
          setStatus(
            n
              ? t('chats.discoveryContactsCount', { n })
              : t('chats.discoveryContactsEmpty')
          );
          return;
        }

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
          const n = peopleFromDiscoveryPets(rows).length;
          setStatus(
            n
              ? t('chats.discoveryNearbyCount', { n })
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
            lookingForPlaymate: isOwners ? undefined : true,
            excludeOwnerId: myUserId,
            sort: 'newest',
          });
          const slice = rows.slice(0, 24);
          setResults(slice);
          const n = peopleFromDiscoveryPets(slice).length;
          setStatus(
            n
              ? t('chats.discoveryProvinceCount', { n, province })
              : t('chats.discoveryProvinceEmpty', { province })
          );
          return;
        }

        // samebreed (playmate — from my pets)
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
        const slice = rows.slice(0, 24);
        setResults(slice);
        const n = peopleFromDiscoveryPets(slice).length;
        setStatus(
          n
            ? t('chats.discoveryBreedCount', { n })
            : t('chats.discoveryBreedEmpty')
        );
      } catch (err) {
        const msg =
          err instanceof GeolocationPositionError
            ? t('chats.discoveryGeoDenied')
            : err instanceof Error
              ? err.message
              : t('chats.discoveryFail');
        setErrorKind(true);
        setStatus(msg);
        toastError(msg);
      } finally {
        setBusy(false);
      }
    },
    [isLoggedIn, isOwners, myPets, myUserId, province, t, toastError, toastInfo]
  );

  useEffect(() => {
    setResults([]);
    setMode(null);
    setStatus(null);
    setErrorKind(false);
    setSentOwnerIds(new Set());
  }, [myUserId]);

  function beginRequest(toPet: PetProfile) {
    if (!isLoggedIn || !myUserId) {
      toastError(t('chats.discoveryLogin'));
      return;
    }
    if (sentOwnerIds.has(toPet.ownerId) || sendingOwnerId === toPet.ownerId) return;
    if (!isOwners && myPets.length === 0) {
      const msg = t('chats.discoveryNeedPet');
      toastError(msg);
      return;
    }
    if (coins < requestCost) {
      toastError(
        t('chats.discoveryNeedCoins', {
          cost: formatCoins(requestCost),
          coins: formatCoins(coins),
        })
      );
      return;
    }
    setPendingTo(toPet);
    if (isOwners) {
      setFromPetId(null);
      setPickFromOpen(false);
      setFeeConfirmOpen(true);
      return;
    }
    if (myPets.length === 1) {
      setFromPetId(myPets[0]!.id);
      setPickFromOpen(false);
      setFeeConfirmOpen(true);
      return;
    }
    setFromPetId(null);
    setPickFromOpen(true);
    setFeeConfirmOpen(false);
  }

  function onPickFrom(petId: number) {
    setFromPetId(petId);
    setPickFromOpen(false);
    setFeeConfirmOpen(true);
  }

  function dismissRequestFlow() {
    if (sendingOwnerId != null) return;
    setPendingTo(null);
    setFromPetId(null);
    setPickFromOpen(false);
    setFeeConfirmOpen(false);
  }

  async function beginRequestForContact(contactUserId: number) {
    if (!isLoggedIn || !myUserId) {
      toastError(t('chats.discoveryLogin'));
      return;
    }
    if (sentOwnerIds.has(contactUserId) || sendingOwnerId === contactUserId) return;
    setBusy(true);
    setErrorKind(false);
    try {
      const rows = await listPets({
        ownerId: contactUserId,
        lookingForPlaymate: true,
        sort: 'newest',
      });
      const people = peopleFromDiscoveryPets(rows);
      const target = people[0]?.pet;
      if (!target) {
        toastInfo(t('chats.discoveryContactNoPet'));
        setStatus(t('chats.discoveryContactNoPet'));
        return;
      }
      beginRequest(target);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chats.discoveryFail');
      toastError(msg);
      setErrorKind(true);
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  }

  function onContactPrimary(contactUserId: number) {
    const opened = onOpenContact?.(contactUserId);
    if (opened) return;
    void beginRequestForContact(contactUserId);
  }

  async function executeRequest() {
    if (!myUserId || !pendingTo) return;
    if (!isOwners && fromPetId == null) return;
    const ownerId = pendingTo.ownerId;
    setFeeConfirmOpen(false);
    setSendingOwnerId(ownerId);
    try {
      if (isOwners) {
        await quickVetConnect(myUserId, token, {
          kind: 'seeker_advice',
          humanOnly: true,
          preferredProviderId: ownerId,
        });
      } else {
        await sendPlaymateRequestNow({
          fromPetId: fromPetId!,
          toPetId: pendingTo.id,
          fromUserId: myUserId,
        });
      }
      setSentOwnerIds((prev) => new Set(prev).add(ownerId));
      toastSuccess(t('chats.discoveryRequestSent'));
      void authStore.refreshMe();
      onSent?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chats.discoverySendFail');
      toastError(msg);
    } finally {
      setSendingOwnerId(null);
      setPendingTo(null);
      setFromPetId(null);
    }
  }

  const chips: { id: PetDiscoveryMode; label: string; Icon: typeof MapPin }[] = isOwners
    ? [
        { id: 'nearby', label: t('chats.discoveryOwnersNearby'), Icon: MapPin },
        { id: 'samebreed', label: t('chats.discoveryOwnersBreed'), Icon: PawPrint },
        { id: 'sameprovince', label: t('chats.discoveryOwnersProvince'), Icon: Search },
      ]
    : [
        { id: 'nearby', label: t('chats.discoveryNearby'), Icon: MapPin },
        { id: 'samebreed', label: t('chats.discoverySameBreed'), Icon: PawPrint },
        { id: 'sameprovince', label: t('chats.discoverySameProvince'), Icon: Search },
        { id: 'contacts', label: t('chats.discoveryContacts'), Icon: Contact },
      ];

  const showEmpty =
    !busy &&
    mode != null &&
    !errorKind &&
    Boolean(status) &&
    (mode === 'contacts' ? contacts.length === 0 : people.length === 0);

  return (
    <section
      className={`pepito-pet-discovery${variant === 'bar' ? ' pepito-pet-discovery--bar' : ''}${className ? ` ${className}` : ''}`}
      aria-label={t('chats.discoveryTitle')}
      data-testid={variant === 'bar' ? 'pet-discovery-bar' : 'pet-discovery'}
    >
      {variant === 'panel' ? (
        <header className="pepito-pet-discovery-head">
          <h3>{t('chats.discoveryTitle')}</h3>
          <p>{t('chats.discoveryLead')}</p>
        </header>
      ) : null}
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
            <Icon size={variant === 'bar' ? 14 : 16} strokeWidth={2.25} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {status && !showEmpty ? (
        <p
          className={`pepito-pet-discovery-status${errorKind ? ' is-error' : ''}`}
          role={errorKind ? 'alert' : undefined}
          data-testid="pet-discovery-status"
        >
          {status}
        </p>
      ) : null}
      {busy ? (
        <p className="pepito-muted" data-testid="pet-discovery-loading">
          {t('common.loading')}
        </p>
      ) : null}
      {showEmpty ? (
        <p
          className="pepito-pet-discovery-empty"
          data-testid="pet-discovery-empty"
          role="status"
        >
          {status}
        </p>
      ) : null}
      {people.length > 0 ? (
        <ul className="pepito-pet-discovery-list" data-testid="pet-discovery-people">
          {people.map(({ ownerId, ownerName, ownerAvatarUrl, pet }) => {
            const already = sentOwnerIds.has(ownerId);
            const sending = sendingOwnerId === ownerId;
            const petLine = [pet.name, pet.breed, pet.city || pet.ownerCity, pet.ownerProvince]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={ownerId}>
                <article
                  className="pepito-pet-discovery-card pepito-pet-discovery-card--person"
                  data-testid={`pet-discovery-person-${ownerId}`}
                >
                  <InboxPeerAvatar
                    avatarUrl={ownerAvatarUrl}
                    name={ownerName}
                    size={44}
                  />
                  <div className="pepito-pet-discovery-copy">
                    <strong>{ownerName}</strong>
                    <Link
                      to={`/p/${pet.slug || pet.publicId || pet.id}`}
                      className="pepito-pet-discovery-petlink"
                    >
                      <PetAvatar
                        type={
                          pet.species === 'cat'
                            ? 'cat'
                            : pet.species === 'bird'
                              ? 'bird'
                              : 'dog'
                        }
                        size="sm"
                        imageUrl={pet.imageUrl}
                        name={pet.name}
                      />
                      <span>{petLine}</span>
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="pepito-btn button-1 pepito-pet-discovery-request"
                    disabled={already || sending || busy}
                    data-testid={`pet-discovery-request-${ownerId}`}
                    onClick={() => beginRequest(pet)}
                  >
                    {already
                      ? t('chats.discoveryRequestSent')
                      : sending
                        ? t('common.loading')
                        : isOwners
                          ? t('chats.discoveryConsultRequest')
                          : t('chats.discoverySendRequest')}
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {mode === 'contacts' && contacts.length > 0 ? (
        <ul className="pepito-pet-discovery-list" data-testid="pet-discovery-contacts">
          {contacts.map((row) => {
            const name = row.contactName?.trim() || t('chats.discoveryContacts');
            return (
              <li key={row.contactUserId}>
                <article
                  className="pepito-pet-discovery-card pepito-pet-discovery-card--person"
                  data-testid={`pet-discovery-contact-${row.contactUserId}`}
                >
                  <InboxPeerAvatar
                    avatarUrl={row.contactAvatarUrl}
                    name={name}
                    gender={row.contactGender}
                    size={44}
                  />
                  <div className="pepito-pet-discovery-copy">
                    <strong>{name}</strong>
                    {row.contactPublicId ? (
                      <span className="pepito-muted">/{row.contactPublicId}</span>
                    ) : null}
                  </div>
                  <div className="pepito-pet-discovery-contact-actions">
                    <button
                      type="button"
                      className="pepito-btn button-2 pepito-pet-discovery-request"
                      disabled={busy}
                      data-testid={`pet-discovery-open-contact-${row.contactUserId}`}
                      onClick={() => onContactPrimary(row.contactUserId)}
                    >
                      {t('chats.discoveryOpenOrRequest')}
                    </button>
                    <button
                      type="button"
                      className="pepito-btn button-1 pepito-pet-discovery-request"
                      disabled={busy || sentOwnerIds.has(row.contactUserId)}
                      data-testid={`pet-discovery-request-contact-${row.contactUserId}`}
                      onClick={() => void beginRequestForContact(row.contactUserId)}
                    >
                      {sentOwnerIds.has(row.contactUserId)
                        ? t('chats.discoveryRequestSent')
                        : t('chats.discoverySendRequest')}
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : null}

      {pickFromOpen && pendingTo && !isOwners ? (
        <div
          className="pepito-pet-discovery-pickpanel"
          data-testid="pet-discovery-pick-from"
          role="region"
          aria-label={t('chats.discoveryPickFrom')}
        >
          <p>
            {t('chats.discoveryPickFromLead', {
              person: pendingTo.ownerName?.trim() || 'صاحب پت',
              pet: pendingTo.name,
            })}
          </p>
          <div className="pepito-pet-discovery-pick">
            {myPets.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pepito-btn button-2"
                data-testid={`pet-discovery-from-${p.id}`}
                onClick={() => onPickFrom(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button
              type="button"
              className="pepito-btn button-3"
              onClick={dismissRequestFlow}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={
          feeConfirmOpen &&
          !!pendingTo &&
          (isOwners || fromPetId != null)
        }
        title={isOwners ? t('chats.discoveryConsultFeeTitle') : t('chats.discoveryFeeTitle')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        busy={sendingOwnerId != null}
        testId="pet-discovery-fee-confirm"
        onCancel={dismissRequestFlow}
        onConfirm={() => void executeRequest()}
      >
        <dl className="pepito-confirm-modal__stats">
          <div className="pepito-confirm-modal__row pepito-confirm-modal__row--fee">
            <dt>{t('chats.discoveryFeeCost')}</dt>
            <dd>
              {formatCoins(requestCost)} {t('chats.discoveryCoinsUnit')}
            </dd>
          </div>
          <div className="pepito-confirm-modal__row">
            <dt>{t('chats.discoveryFeeBalance')}</dt>
            <dd>
              {formatCoins(coins)} {t('chats.discoveryCoinsUnit')}
            </dd>
          </div>
        </dl>
        <p className="pepito-lead-modal__lead">
          {isOwners ? t('chats.discoveryConsultFeeLead') : t('chats.discoveryFeeLead')}
        </p>
      </ConfirmModal>

      {breedPickerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pepito-lead-modal-overlay"
              role="presentation"
              data-testid="pet-discovery-breed-picker"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setBreedPickerOpen(false);
                  setBreedSpecies(null);
                }
              }}
            >
              <div
                className="pepito-lead-modal pepito-confirm-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('chats.discoveryPickBreedTitle')}
              >
                <header className="pepito-lead-modal__head">
                  <h2>{t('chats.discoveryPickBreedTitle')}</h2>
                  <button
                    type="button"
                    className="pepito-lead-modal__close"
                    aria-label={t('common.close')}
                    onClick={() => {
                      setBreedPickerOpen(false);
                      setBreedSpecies(null);
                    }}
                  >
                    ×
                  </button>
                </header>
                <div className="pepito-lead-modal__body">
                  <p className="pepito-lead-modal__lead">{t('chats.discoveryPickBreedLead')}</p>
                  {!breedSpecies ? (
                    <div className="find-playmate-gender-options" role="group">
                      {PET_SPECIES.map((sp) => (
                        <button
                          key={sp.code}
                          type="button"
                          className="pepito-btn button-2 find-playmate-gender-btn"
                          data-testid={`pet-discovery-breed-species-${sp.code}`}
                          onClick={() => setBreedSpecies(sp.code)}
                        >
                          {sp.emoji} {sp.labelFa}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="pepito-pet-discovery-pick"
                      style={{ maxHeight: '50vh', overflow: 'auto' }}
                      role="listbox"
                    >
                      <button
                        type="button"
                        className="pepito-btn button-3"
                        onClick={() => setBreedSpecies(null)}
                      >
                        {t('common.back')}
                      </button>
                      {PET_BREEDS_SEED.filter((b) => b.speciesCode === breedSpecies)
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((b) => (
                          <button
                            key={`${b.speciesCode}-${b.nameFa}`}
                            type="button"
                            className="pepito-btn button-2"
                            data-testid={`pet-discovery-breed-${b.nameFa}`}
                            onClick={() => void runBreedSearch(b.nameFa)}
                          >
                            {b.nameFa}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
