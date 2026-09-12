import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, PawPrint } from 'lucide-react';
import {
  BRAND,
  PLAYDATE_REQUEST_COST,
  primaryRole,
  toPersianDigits,
  type PetProfile,
} from '@petdate/shared';
import { ConfirmModal } from './ConfirmModal';
import { PlaymateRequestsPanel } from './PlaymateRequestsPanel';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useUserStore } from '../hooks/useUserStore';
import { useI18n } from '../i18n';
import { listPets, setSilentChatRequests } from '../lib/api';
import { findAndSendPlaymates, type FindPlaymateResult } from '../lib/playmateActions';
import { petProfileToUiPet } from '../lib/playdateMap';
import { authStore } from '../data/authStore';

type FindPhase = 'idle' | 'pick' | 'sending' | 'done';

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

function PawIcon({ size = 18 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon find-playmate-paw" aria-hidden>
      <PawPrint size={size} strokeWidth={2.25} />
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
  const { t } = useI18n();
  const { user } = useUserStore();
  const { user: authUser, isLoggedIn, refreshMe } = useAuthStore();
  const { toastError, toastSuccess, toastInfo } = useAppToast();
  const [myPets, setMyPets] = useState<PetProfile[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [findPhase, setFindPhase] = useState<FindPhase>('idle');
  const [findError, setFindError] = useState<string | null>(null);
  const [findResult, setFindResult] = useState<FindPlaymateResult | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [silentBusy, setSilentBusy] = useState(false);
  /** Explain mute before toggling silent-chat (not a bare toggle). */
  const [silentConfirmOpen, setSilentConfirmOpen] = useState(false);
  /** Pet awaiting fee confirmation in custom modal (not the browser confirm dialog). */
  const [feeConfirmPet, setFeeConfirmPet] = useState<PetProfile | null>(null);

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

  const coins = authUser?.coins ?? authUser?.wallet?.coins ?? 0;

  /** Validate balance then open confirm modal (does not send yet). */
  function requestFindForPet(pet: PetProfile) {
    if (!myUserId) {
      const msg = 'برای ارسال درخواست همبازی وارد حساب شو.';
      setFindError(msg); toastError(msg); return;
    }
    if (coins < PLAYDATE_REQUEST_COST) {
      const msg = `برای درخواست همبازی حداقل ${formatCoins(PLAYDATE_REQUEST_COST)} سکه لازم داری. موجودی: ${formatCoins(coins)}`;
      setFindError(msg); toastError(msg); return;
    }
    setFindError(null);
    setFeeConfirmPet(pet);
  }

  function dismissFeeConfirm() {
    if (findPhase === 'sending') return;
    setFeeConfirmPet(null);
  }

  async function executeFindForPet(pet: PetProfile) {
    if (!myUserId) return;
    setFeeConfirmPet(null);
    setFindPhase('sending'); setFindError(null); setFindResult(null); setStatusLine(null);
    try {
      const result = await findAndSendPlaymates(pet, myUserId);
      setFindResult(result); setFindPhase('done');
      if (result.sent === 0) {
        const msg = `برای ${result.sourceName} فعلاً همبازی هم‌گروه پیدا نشد. درخواست ارسال نشد.`;
        setStatusLine(msg); toastInfo(msg);
      } else {
        const feeNote =
          result.cost > 0 ? ` · هزینه: ${formatCoins(result.cost)} سکه` : '';
        const msg = `${result.sent} درخواست برای ${result.sourceName} ارسال شد${feeNote} — در گفتگوها می‌بینی.`;
        setStatusLine(`✅ ${msg}`); toastSuccess(msg); onSent?.();
        void authStore.refreshMe();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ارسال درخواست‌ها ناموفق بود';
      setFindError(msg); toastError(msg);
      setFindPhase(myPets.length > 1 ? 'pick' : 'idle');
    }
  }

  const feeConfirmModal = (
    <ConfirmModal
      open={!!feeConfirmPet}
      title="تأیید درخواست همبازی"
      confirmLabel={t('common.confirm')}
      cancelLabel={t('common.cancel')}
      busy={findPhase === 'sending'}
      testId="playmate-fee-confirm"
      onCancel={dismissFeeConfirm}
      onConfirm={() => {
        const pet = feeConfirmPet;
        if (!pet) return;
        void executeFindForPet(pet);
      }}
    >
      <dl className="pepito-confirm-modal__stats">
        <div className="pepito-confirm-modal__row pepito-confirm-modal__row--fee">
          <dt>هزینه درخواست</dt>
          <dd>{formatCoins(PLAYDATE_REQUEST_COST)} سکه</dd>
        </div>
        <div className="pepito-confirm-modal__row">
          <dt>موجودی فعلی</dt>
          <dd>{formatCoins(coins)} سکه</dd>
        </div>
      </dl>
      <p className="pepito-lead-modal__lead">
        با تأیید، سکه از موجودی‌ات کسر می‌شود و درخواست همبازی برای هم‌گروه‌ها ارسال می‌شود.
      </p>
    </ConfirmModal>
  );

  async function onPrimaryClick() {
    setFindError(null);
    if (!isLoggedIn || !myUserId) return;
    if (petsLoading) return;
    if (myPets.length === 0) return;
    if (myPets.length === 1) {
      requestFindForPet(myPets[0]!);
      return;
    }
    setFindPhase('pick');
    setFindResult(null);
    setStatusLine(null);
  }

  const silentOn = Boolean(authUser?.silentChatRequests);
  const silentLabel = silentOn ? t('chats.silentOnLabel') : t('chats.silentOffLabel');

  function openSilentConfirm() {
    if (!myUserId || silentBusy) return;
    setSilentConfirmOpen(true);
  }

  function dismissSilentConfirm() {
    if (silentBusy) return;
    setSilentConfirmOpen(false);
  }

  async function confirmSilentToggle() {
    if (!myUserId || silentBusy) return;
    setSilentBusy(true);
    try {
      await setSilentChatRequests(myUserId, !silentOn);
      await refreshMe();
      setSilentConfirmOpen(false);
      toastSuccess(t('chats.silentSaved'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chats.silentError');
      toastError(msg);
    } finally {
      setSilentBusy(false);
    }
  }

  const silentConfirmModal = (
    <ConfirmModal
      open={silentConfirmOpen}
      title={silentOn ? t('chats.silentDisableTitle') : t('chats.silentEnableTitle')}
      confirmLabel={silentOn ? t('chats.silentDisableConfirm') : t('chats.silentEnableConfirm')}
      cancelLabel={t('common.cancel')}
      busy={silentBusy}
      testId="silent-chat-confirm"
      onCancel={dismissSilentConfirm}
      onConfirm={() => {
        void confirmSilentToggle();
      }}
    >
      <p className="pepito-lead-modal__lead">
        {silentOn ? t('chats.silentDisableBody') : t('chats.silentEnableBody')}
      </p>
    </ConfirmModal>
  );

  if (!isPetOwner) {
    if (active === 'trainer') {
      return (
        <div className={`find-playmate-panel${compact ? ' is-compact' : ''}`}>
          <p className="find-playmate-panel__hint">
            اینجا با صاحبان پت برای هماهنگی آموزش آنلاین گفتگو می‌کنی.
          </p>
          <Link to="/trainer-consult" className="pepito-btn button-1" style={{ marginTop: 12 }}>
            رفتن به پنل مربی
          </Link>
        </div>
      );
    }
    if (active === 'vet') {
      return (
        <div className={`find-playmate-panel${compact ? ' is-compact' : ''}`}>
          <p className="find-playmate-panel__hint">
            گفتگوهای مشاوره دامپزشکی در پنل پزشک می‌آیند.
          </p>
          <Link to="/vet-consult" className="pepito-btn button-1" style={{ marginTop: 12 }}>
            رفتن به پنل پزشک
          </Link>
        </div>
      );
    }
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
  const ctaLabel = sending ? t('chats.findCtaSending') : t('chats.findCta');

  if (variant === 'header') {
    if (!isPetOwner) return null;
    const muteBtn =
      !needsLogin && myUserId ? (
        <button
          type="button"
          className={`find-playmate-mute-btn${silentOn ? ' is-on' : ''}`}
          data-testid="silent-chat-header"
          onClick={openSilentConfirm}
          disabled={silentBusy}
          aria-label={silentLabel}
          title={silentLabel}
          aria-pressed={silentOn}
          aria-haspopup="dialog"
        >
          {silentOn ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
        </button>
      ) : null;
    return (
      <>
        <div className="find-playmate-header">
          {/* Mute first so the compact icon sits nearer the brand; CTA stays at the outer edge */}
          {muteBtn}
          {needsLogin ? (
            <Link to="/auth/login" className="find-playmate-header-btn">
              <PawIcon size={18} />
              <span>{t('common.login')}</span>
            </Link>
          ) : needsPet ? (
            <Link to="/add-pet" className="find-playmate-header-btn">
              <PawIcon size={18} />
              <span>{t('chats.findCtaAddPet')}</span>
            </Link>
          ) : showPetPick ? (
            <div className="find-playmate-header-pick" role="menu">
              {myPets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  className="find-playmate-header-btn"
                  disabled={sending}
                  onClick={() => requestFindForPet(pet)}
                >
                  <PawIcon size={16} />
                  <span>{pet.name}</span>
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
              aria-label={t('chats.findCta')}
            >
              <PawIcon size={18} />
              <span>{ctaLabel}</span>
            </button>
          )}
          {findError ? <span className="find-playmate-header-err">{findError}</span> : null}
        </div>
        {feeConfirmModal}
        {silentConfirmModal}
      </>
    );
  }

  return (
    <>
    <div className={`find-playmate-panel${compact ? ' is-compact' : ''}`}>
      {!compact ? (
        <header className="find-playmate-panel__head">
          <p className="pepito-eyebrow">{BRAND.taglineFa}</p>
          <h2>{t('chats.findCta')}</h2>
          <p>درخواست بفرست، قبول/رد کن و همین‌جا چت کن.</p>
          <p className="find-playmate-panel__fee">
            هزینه درخواست: {formatCoins(PLAYDATE_REQUEST_COST)} سکه
          </p>
        </header>
      ) : null}

      <section className="find-playmate-one" aria-label={t('chats.findCta')}>
        {!needsLogin && !needsPet ? (
          <p className="find-playmate-one__fee" role="status" data-testid="find-playmate-fee">
            هزینه درخواست: {formatCoins(PLAYDATE_REQUEST_COST)} سکه
            {authUser ? ` · موجودی: ${formatCoins(coins)} سکه` : ''}
          </p>
        ) : null}
        {needsLogin ? (
          <Link to="/auth/login" className="pepito-btn button-1 find-playmate-one__btn">
            <PawIcon size={16} />
            {t('chats.findCtaLogin')}
          </Link>
        ) : needsPet ? (
          <Link to="/add-pet" className="pepito-btn button-1 find-playmate-one__btn">
            <PawIcon size={16} />
            {t('chats.findCtaAddPet')}
          </Link>
        ) : showPetPick ? (
          <div className="find-playmate-one__pick">
            <p className="find-playmate-one__hint">{t('chats.findCtaPickPet')}</p>
            <div className="find-playmate-pet-list">
              {myPets.map((pet) => {
                const ui = petProfileToUiPet(pet);
                return (
                  <button
                    key={pet.id}
                    type="button"
                    className="find-playmate-pet-btn"
                    disabled={sending}
                    onClick={() => requestFindForPet(pet)}
                  >
                    <img src={ui.imageUrl || '/brand/photo-placeholder.svg'} alt="" />
                    <span>
                      <strong>{pet.name}</strong>
                      <small>
                        {[pet.breed, pet.city || pet.ownerCity].filter(Boolean).join(' · ')}
                      </small>
                      {(pet.photoModerationStatus ?? 'approved') === 'pending' && pet.imageUrl ? (
                        <small>{t('moderation.chipPending')}</small>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="pepito-btn button-1 find-playmate-one__btn"
            data-testid="find-playmate-primary"
            disabled={sending || petsLoading}
            onClick={() => void onPrimaryClick()}
          >
            <PawIcon size={16} />
            {sending
              ? t('chats.findCtaSending')
              : findPhase === 'done'
                ? t('chats.findCtaAgain')
                : t('chats.findCta')}
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
    {feeConfirmModal}
    {silentConfirmModal}
  </>
  );
}
