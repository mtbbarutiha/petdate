import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND, primaryRole, type PetProfile } from '@petdate/shared';
import { PlaymateRequestsPanel } from './PlaymateRequestsPanel';
import { EMPTY_STATE_PHOTO } from '../data/petImages';
import { useAuthStore } from '../hooks/useAuthStore';
import { useUserStore } from '../hooks/useUserStore';
import { listPets } from '../lib/api';
import { findAndSendPlaymates, type FindPlaymateResult } from '../lib/playmateActions';
import { petProfileToUiPet } from '../lib/playdateMap';

type FindPhase = 'idle' | 'pick' | 'sending' | 'done';

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

export type FindPlaymatePanelProps = {
  /** Tighter layout for chat list empty state */
  compact?: boolean;
  /** Ghost header control for mobile chat list */
  variant?: 'panel' | 'header';
  /** Show PlaymateRequestsPanel under the find CTA (default true) */
  showRequests?: boolean;
  /** Called after a successful find/send so parent can refresh inbox */
  onSent?: () => void;
};

/**
 * Find + request playmates + manage requests — used inside /chats for pet_owner.
 */
export function FindPlaymatePanel({
  compact = false,
  variant = 'panel',
  showRequests = true,
  onSent,
}: FindPlaymatePanelProps) {
  const { user } = useUserStore();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const [myPets, setMyPets] = useState<PetProfile[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [findPhase, setFindPhase] = useState<FindPhase>('idle');
  const [findError, setFindError] = useState<string | null>(null);
  const [findResult, setFindResult] = useState<FindPlaymateResult | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const myUserId = authUser?.id ?? user.id;
  const active =
    primaryRole(authUser?.roles, authUser?.role) ?? primaryRole(user.roles, user.role);
  const isPetOwner = active === 'pet_owner';

  const loadMyPets = useCallback(async () => {
    if (!myUserId || !isPetOwner) {
      setMyPets([]);
      return;
    }
    setPetsLoading(true);
    try {
      const rows = await listPets({ ownerId: myUserId });
      setMyPets(rows);
    } catch {
      setMyPets([]);
    } finally {
      setPetsLoading(false);
    }
  }, [myUserId, isPetOwner]);

  useEffect(() => {
    void loadMyPets();
  }, [loadMyPets]);

  async function runFindForPet(pet: PetProfile) {
    if (!myUserId) {
      setFindError('برای ارسال درخواست همبازی وارد حساب شو.');
      return;
    }
    setFindPhase('sending');
    setFindError(null);
    setFindResult(null);
    setStatusLine(null);
    try {
      const result = await findAndSendPlaymates(pet, myUserId);
      setFindResult(result);
      setFindPhase('done');
      if (result.sent === 0) {
        setStatusLine(
          `برای ${result.sourceName} فعلاً همبازی هم‌گروه پیدا نشد. درخواست ارسال نشد.`,
        );
      } else {
        setStatusLine(
          `✅ ${result.sent} درخواست برای ${result.sourceName} ارسال شد — در گفتگوها می‌بینی.`,
        );
        onSent?.();
      }
    } catch (err) {
      setFindError(err instanceof Error ? err.message : 'ارسال درخواست‌ها ناموفق بود');
      setFindPhase(myPets.length > 1 ? 'pick' : 'idle');
    }
  }

  async function onPrimaryClick() {
    setFindError(null);
    if (!isLoggedIn || !myUserId) return;
    if (petsLoading) return;
    if (myPets.length === 0) return;
    if (myPets.length === 1) {
      await runFindForPet(myPets[0]!);
      return;
    }
    setFindPhase('pick');
    setFindResult(null);
    setStatusLine(null);
  }

  if (!isPetOwner) {
    return (
      <div className={`find-playmate-panel${compact ? ' is-compact' : ''}`}>
        <p className="find-playmate-panel__hint">
          برای پیدا کردن همبازی، نقش «صاحب پت» را فعال کن.
        </p>
      </div>
    );
  }

  const needsLogin = !isLoggedIn || !myUserId;
  const needsPet = !needsLogin && !petsLoading && myPets.length === 0;
  const showPetPick = findPhase === 'pick' && myPets.length > 1;
  const sending = findPhase === 'sending';

  if (variant === 'header') {
    if (!isPetOwner) return null;
    return (
      <div className="find-playmate-header">
        {needsLogin ? (
          <Link to="/auth/login" className="find-playmate-header-btn">
            ورود
          </Link>
        ) : needsPet ? (
          <Link to="/add-pet" className="find-playmate-header-btn">
            ثبت پت
          </Link>
        ) : showPetPick ? (
          <div className="find-playmate-header-pick" role="menu">
            {myPets.map((pet) => (
              <button
                key={pet.id}
                type="button"
                className="find-playmate-header-btn"
                disabled={sending}
                onClick={() => void runFindForPet(pet)}
              >
                {pet.name}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="find-playmate-header-btn"
            data-testid="find-playmate-header"
            disabled={sending || petsLoading}
            onClick={() => void onPrimaryClick()}
            aria-label="پیدا کردن همبازی"
          >
            {sending ? 'در حال ارسال…' : 'پیدا کردن همبازی'}
          </button>
        )}
        {findError ? <span className="find-playmate-header-err">{findError}</span> : null}
      </div>
    );
  }

  return (
    <div className={`find-playmate-panel${compact ? ' is-compact' : ''}`}>
      {!compact ? (
        <header className="find-playmate-panel__head">
          <p className="pepito-eyebrow">{BRAND.taglineFa}</p>
          <h2>پیدا کردن همبازی</h2>
          <p>درخواست بفرست، قبول/رد کن و همین‌جا چت کن.</p>
        </header>
      ) : null}

      <section className="find-playmate-one" aria-label="ارسال درخواست همبازی">
        {needsLogin ? (
          <Link to="/auth/login" className="pepito-btn button-1">
            <PawIcon />
            ورود برای پیدا کردن همبازی
          </Link>
        ) : needsPet ? (
          <Link to="/add-pet" className="pepito-btn button-1">
            <PawIcon />
            ثبت پت
          </Link>
        ) : showPetPick ? (
          <div className="find-playmate-one__pick">
            <p className="find-playmate-one__hint">کدوم پتت؟</p>
            <div className="find-playmate-pet-list">
              {myPets.map((pet) => {
                const ui = petProfileToUiPet(pet);
                return (
                  <button
                    key={pet.id}
                    type="button"
                    className="find-playmate-pet-btn"
                    disabled={sending}
                    onClick={() => void runFindForPet(pet)}
                  >
                    <img src={ui.imageUrl || EMPTY_STATE_PHOTO} alt="" />
                    <span>
                      <strong>{pet.name}</strong>
                      <small>
                        {[pet.breed, pet.city || pet.ownerCity].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="pepito-btn button-1"
            data-testid="find-playmate-primary"
            disabled={sending || petsLoading}
            onClick={() => void onPrimaryClick()}
          >
            <PawIcon />
            {sending
              ? 'در حال ارسال…'
              : findPhase === 'done'
                ? 'ارسال دوباره درخواست'
                : 'پیدا کردن همبازی'}
          </button>
        )}

        {findError ? <p className="auth-error find-playmate-one__status">{findError}</p> : null}
        {!findError && statusLine ? (
          <p className="find-playmate-one__status" role="status">
            {statusLine}
            {findResult?.sampleLine ? ` · ${findResult.sampleLine}` : ''}
          </p>
        ) : null}
      </section>

      {showRequests ? (
        <section className="find-playmate-panel__requests" aria-label="درخواست‌های همبازی">
          {!compact ? (
            <header className="find-playmate-panel__subhead">
              <h3>درخواست‌های من</h3>
              <p>دریافتی و ارسالی — قبول، رد و ورود به چت.</p>
            </header>
          ) : null}
          <PlaymateRequestsPanel embedded />
        </section>
      ) : null}
    </div>
  );
}
