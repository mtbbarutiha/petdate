import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, Clock, GraduationCap, MessageCircle, X } from 'lucide-react';
import {
  TRAINER_CONSULT_COST,
  formatPersianDateTime,
  isPrimaryRole,
  type PetProfile,
  type User,
  type VetConsultation,
} from '@petdate/shared';
import { AiConsultCtaButton } from '../components/AiConsultCtaButton';
import { PageHelpLink } from '../components/PageHelpLink';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
import { credentialChromeLabel, localeNum, useI18n, type TranslateFn } from '../i18n';
import {
  acceptVetConsultation,
  listOnlineProviders,
  listPets,
  listVetConsultations,
  patchWebProviderOnline,
  quickVetConnect,
  rejectVetConsultation,
  telegramBotDeepLink,
  uploadProviderCredential,
} from '../lib/api';
import { subscribeIncomingRefresh } from '../lib/liveIncoming';

type Kind = 'trainer';

const COST: Record<Kind, number> = {
  trainer: TRAINER_CONSULT_COST,
};

function patientLabel(c: VetConsultation, t: TranslateFn): string {
  const name = c.patientName?.trim() || t('consultDesk.userFallback', { id: c.patientUserId });
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

function providerPeerLabel(c: VetConsultation, t: TranslateFn): string {
  const name = c.vetName?.trim() || t('consultDesk.userFallback', { id: c.vetUserId });
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

function consultStatusLabel(
  c: Pick<VetConsultation, 'status' | 'chatEnded'>,
  copy: { active: string; closed: string; waiting: string; cancelled: string; expired: string }
): {
  text: string;
  tone: 'wait' | 'active' | 'done';
} {
  if (c.chatEnded || c.status === 'completed') {
    return { text: copy.closed, tone: 'done' };
  }
  switch (c.status) {
    case 'requested':
      return { text: copy.waiting, tone: 'wait' };
    case 'active':
      return { text: copy.active, tone: 'active' };
    case 'cancelled':
      return { text: copy.cancelled, tone: 'done' };
    case 'expired':
      return { text: copy.expired, tone: 'done' };
    default:
      return { text: copy.closed, tone: 'done' };
  }
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

export function ServiceConsultPage({ kind }: { kind: Kind }) {
  const navigate = useNavigate();
  const { t, lang, dir } = useI18n();
  const { user, token, isLoggedIn, refreshMe } = useAuthStore();
  const { toastError, toastSuccess, toastInfo } = useAppToast();
  const cost = COST[kind];
  const coinsLabel = (n: number) => localeNum(lang, n);
  /** فقط نقش فعال ارائه‌دهنده — نه داشتن نقش فرعی (صاحب‌پت چندنقشی نباید پنل مدرک ببیند). */
  const isProvider = isPrimaryRole(user, 'trainer');
  const credStatus = user?.trainerCredentialStatus;
  const online = Boolean(user?.trainerOnline);
  const verified = credStatus === 'verified';
  const coins = user?.coins ?? user?.wallet?.coins ?? 0;
  const botUrl = telegramBotDeepLink();
  const statusCopy = {
    active:
      kind === 'trainer'
        ? t('consultDesk.statusBusyWithPet')
        : t('consultDesk.statusActive'),
    closed: t('consultDesk.statusClosed'),
    waiting: t('consultDesk.statusWaiting'),
    cancelled: t('consultDesk.statusCancelled'),
    expired: t('consultDesk.statusExpired'),
  };

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [onlineProviders, setOnlineProviders] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<'ai' | 'human' | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);
  const [needsResendConfirm, setNeedsResendConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<VetConsultation[]>([]);
  const [recent, setRecent] = useState<VetConsultation[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);

  function flashError(msg: string) {
    setError(msg);
    toastError(msg);
  }

  function flashSuccess(msg: string) {
    setStatusMsg(msg);
    toastSuccess(msg);
  }

  const loadPets = useCallback(async () => {
    if (!user?.id || isProvider) {
      setPets([]);
      return;
    }
    try {
      setPets(await listPets({ ownerId: user.id }));
    } catch {
      setPets([]);
    }
  }, [user?.id, isProvider]);

  const loadOnline = useCallback(async () => {
    if (isProvider) {
      setOnlineProviders([]);
      return;
    }
    try {
      setOnlineProviders(await listOnlineProviders(kind));
    } catch {
      setOnlineProviders([]);
    }
  }, [isProvider, kind]);

  const loadLists = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (isProvider) {
        const rows = await listVetConsultations({
          vetUserId: user.id,
          kind,
        });
        setIncoming(rows.filter((r) => r.status === 'requested'));
        const recentRows = rows
          .filter((r) => r.status !== 'requested')
          .sort((a, b) => {
            const rank = (s: string) => (s === 'active' ? 0 : s === 'completed' ? 1 : 2);
            const d = rank(a.status) - rank(b.status);
            if (d !== 0) return d;
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          })
          .slice(0, 12);
        setRecent(recentRows);
      } else {
        const rows = await listVetConsultations({
          patientUserId: user.id,
          kind,
        });
        setIncoming([]);
        setRecent(rows.slice(0, 12));
      }
    } catch {
      /* ignore */
    }
  }, [user?.id, isProvider, kind]);

  useEffect(() => {
    void loadPets();
    void loadLists();
    void loadOnline();
  }, [loadPets, loadLists, loadOnline]);

  useLiveAjaxPoll(
    async () => {
      await loadLists();
      await loadOnline();
    },
    {
      enabled: Boolean(user?.id),
      intervalMs: 8_000,
    }
  );
  useEffect(() => subscribeIncomingRefresh(() => void loadLists()), [loadLists]);

  async function onToggleOnline(next: boolean) {
    if (!token) { flashError(t('consultDesk.loginFirst')); return; }
    if (next && !verified) {
      flashError(
        credStatus === 'pending'
          ? t('consultDesk.credNotVerifiedShort')
          : t('consultDesk.credNeedUpload')
      );
      return;
    }
    setOnlineBusy(true); setError(null);
    try {
      await patchWebProviderOnline(token, kind, next);
      await refreshMe();
      toastSuccess(next ? t('consultDesk.onlineOk') : t('consultDesk.offlineOk'));
    } catch (err) {
      flashError(errMessage(err, t('consultDesk.statusChangeFail')));
    } finally { setOnlineBusy(false); }
  }

  async function onUploadCredential(file: File | null | undefined) {
    if (!token) { flashError(t('consultDesk.loginFirst')); return; }
    if (!file) return;
    setUploadBusy(true); setError(null); setStatusMsg(null);
    try {
      await uploadProviderCredential(token, kind, file);
      await refreshMe();
      flashSuccess(t('consultDesk.credSent'));
    } catch (err) {
      flashError(errMessage(err, t('consultDesk.credUploadFail')));
    } finally { setUploadBusy(false); }
  }

  function validatePatient(opts?: { humanOnly?: boolean }): string | null {
    if (!user?.id || !token) return t('consultDesk.loginFirst');
    if (!pets.length) return t('consultDesk.needPetTrainer');
    const others = onlineProviders.filter((p) => p.id !== user.id);
    if (opts?.humanOnly) {
      if (!others.length) return t('consultDesk.noProvidersTrainer');
      if (coins < cost) {
        return t('consultDesk.needCoins', { cost: coinsLabel(cost), coins: coinsLabel(coins) });
      }
      return null;
    }
    // AI path is free — no coin / online gate.
    return null;
  }

  async function sendRequest(
    mode: 'ai' | 'human',
    confirmResend = false
  ) {
    if (!user?.id || !token) { flashError(t('consultDesk.loginFirst')); return; }
    const gate = validatePatient({ humanOnly: mode === 'human' });
    if (gate) { flashError(gate); setConfirmPay(false); return; }
    setBusy(true);
    setBusyMode(mode);
    setError(null);
    setStatusMsg(null);
    try {
      let res;
      try {
        res = await quickVetConnect(user.id, token, {
          kind,
          confirmResend,
          preferAi: mode === 'ai',
          humanOnly: mode === 'human',
        });
      } catch (err) {
        const needsConfirm =
          err instanceof Error &&
          ((err as Error & { requiresResendConfirm?: boolean }).requiresResendConfirm ||
            /میخوای مجدد/.test(err.message));
        if (needsConfirm && !confirmResend) {
          setNeedsResendConfirm(true); setConfirmPay(true);
          flashError(t('consultDesk.resendConfirm'));
          return;
        }
        throw err;
      }
      await refreshMe();
      await loadLists();
      await loadOnline();
      setConfirmPay(false);
      setNeedsResendConfirm(false);
      flashSuccess(res.message);
      setStatusMsg(res.message);
      if (res.aiFallback || mode === 'ai') {
        const consultId = res.consultations?.[0]?.id;
        if (consultId) {
          navigate(`/vet-chats/${consultId}`);
          return;
        }
      }
      if (res.consultations?.length === 1 && res.consultations[0]?.status === 'active') {
        navigate(`/vet-chats/${res.consultations[0].id}`);
      }
    } catch (err) {
      flashError(errMessage(err, t('consultDesk.sendFail')));
    } finally {
      setBusy(false);
      setBusyMode(null);
    }
  }

  async function onAiClick() {
    setError(null); setStatusMsg(null); setConfirmPay(false);
    const gate = validatePatient();
    if (gate) { flashError(gate); return; }
    await sendRequest('ai', needsResendConfirm);
  }

  async function onHumanClick() {
    setError(null); setStatusMsg(null);
    const gate = validatePatient({ humanOnly: true });
    if (gate) {
      flashError(gate);
      setConfirmPay(false);
      return;
    }
    if (!confirmPay) {
      setConfirmPay(true);
      toastInfo(t('consultDesk.payHint', { cost: coinsLabel(cost) }));
      return;
    }
    await sendRequest('human', needsResendConfirm);
  }

  async function onAccept(id: number) {
    if (!token) return;
    setActingId(id);
    try {
      await acceptVetConsultation(id, token);
      await loadLists();
      navigate(`/vet-chats/${id}`);
    } catch (err) {
      flashError(errMessage(err, t('consultDesk.acceptFail')));
    } finally { setActingId(null); }
  }

  async function onReject(id: number) {
    if (!token) return;
    setActingId(id);
    try {
      await rejectVetConsultation(id, token);
      await loadLists();
      toastSuccess(t('consultDesk.rejectOk'));
    } catch (err) {
      flashError(errMessage(err, t('consultDesk.rejectFail')));
    } finally { setActingId(null); }
  }

  const onlineCount = onlineProviders.filter((p) => p.id !== user?.id).length;

  return (
    <div className="pepito-vet-consult" dir={dir}>
      <header className="pepito-vet-consult-head">
        <h1>{isProvider ? t('consultDesk.titleTrainer') : t('consultDesk.patientCtaTrainer')}</h1>
        <p>
          {isProvider
            ? t('consultDesk.leadTrainer')
            : t('consultDesk.trainerLead', { cost: coinsLabel(cost) })}
        </p>
        <PageHelpLink section="consults" />
      </header>

      {error ? (
        <p className="auth-error pepito-vet-consult-status" role="alert">
          {error}
        </p>
      ) : null}
      {statusMsg ? (
        <p className="pepito-vet-consult-status" role="status">
          {statusMsg}
        </p>
      ) : null}

      {isProvider ? (
        <section className="pepito-vet-online-card">
          <p>
            {t('consultDesk.credStatus', { status: credentialChromeLabel(t, credStatus) })}
          </p>
          {!verified ? (
            <div className="pepito-provider-cred-upload">
              <p>
                {t('consultDesk.credUploadHint')}
                {credStatus === 'pending' ? ` ${t('consultDesk.credQueued')}` : ''}
              </p>
              <label className="pepito-btn button-1 pepito-provider-cred-label">
                {uploadBusy
                  ? t('consultDesk.credUploading')
                  : credStatus === 'pending'
                    ? t('consultDesk.credReupload')
                    : t('consultDesk.credUpload')}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={uploadBusy}
                  hidden
                  data-testid={`${kind}-credential-upload`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    void onUploadCredential(file);
                  }}
                />
              </label>
              <p className="muted">
                {t('consultDesk.credBotHintBefore')}{' '}
                <a href={botUrl} target="_blank" rel="noreferrer">
                  {t('consultDesk.telegramBot')}
                </a>
                {t('consultDesk.credBotHintAfter')}
              </p>
            </div>
          ) : null}
          <div className="pepito-vet-online-seg">
            <button
              type="button"
              className={`pepito-vet-online-seg-btn${online ? ' is-active is-online' : ''}`}
              disabled={onlineBusy}
              data-testid={`${kind}-online-toggle-on`}
              onClick={() => void onToggleOnline(true)}
            >
              <Circle size={14} /> {t('consultDesk.online')}
            </button>
            <button
              type="button"
              className={`pepito-vet-online-seg-btn${!online ? ' is-active is-offline' : ''}`}
              disabled={onlineBusy}
              data-testid={`${kind}-online-toggle-off`}
              onClick={() => void onToggleOnline(false)}
            >
              {t('consultDesk.offline')}
            </button>
          </div>
        </section>
      ) : null}

      {!isProvider ? (
        <section className="pepito-vet-consult-cta">
          <p className="pepito-vet-consult-hint" data-testid={`${kind}-online-count`}>
            {isLoggedIn
              ? onlineCount > 0
                ? t('consultDesk.onlineCount', { n: coinsLabel(onlineCount) })
                : t('consultDesk.noProvidersTrainer')
              : t('consultDesk.loginToRequest')}
          </p>
          {!isLoggedIn ? (
            <Link to="/auth/login" className="pepito-btn button-1">
              {t('common.login')}
            </Link>
          ) : (
            <div className="pepito-consult-cta-stack">
              <AiConsultCtaButton
                testId={`${kind}-ai-request-cta`}
                busy={busy && busyMode === 'ai'}
                disabled={busy}
                label={t('consultDesk.aiLeilaFree')}
                busyLabel={t('consultDesk.sending')}
                badge={t('consultDesk.aiBadge')}
                onClick={() => void onAiClick()}
              />
              {confirmPay && onlineCount > 0 ? (
                <p className="pepito-vet-consult-hint" role="status">
                  {t('consultDesk.confirmDeduct', { cost: coinsLabel(cost) })}
                </p>
              ) : null}
              <button
                type="button"
                className="pepito-btn pepito-human-consult-cta"
                disabled={busy}
                data-testid={`${kind}-human-request-cta`}
                onClick={() => void onHumanClick()}
              >
                <span className="pepito-btn-icon" aria-hidden>
                  <GraduationCap size={16} strokeWidth={2.25} />
                </span>
                {busy && busyMode === 'human'
                  ? t('consultDesk.sending')
                  : confirmPay && onlineCount > 0
                    ? t('consultDesk.confirmPay', { cost: coinsLabel(cost) })
                    : t('consultDesk.realTrainer')}
              </button>
              {confirmPay && onlineCount > 0 ? (
                <button
                  type="button"
                  className="pepito-btn pepito-human-consult-cta pepito-human-consult-cta--cancel"
                  disabled={busy}
                  onClick={() => setConfirmPay(false)}
                >
                  {t('common.cancel')}
                </button>
              ) : null}
              {!pets.length ? (
                <Link to="/add-pet" className="pepito-btn pepito-human-consult-cta">
                  {t('consultDesk.addPet')}
                </Link>
              ) : null}
              {coins < cost ? (
                <Link to="/wallet" className="pepito-btn pepito-human-consult-cta">
                  {t('consultDesk.topUp')}
                </Link>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {isProvider ? (
        <div className="pepito-vet-inbox-stack">
          <section
            className="pepito-vet-inbox-panel pepito-vet-inbox-panel--incoming"
            aria-label={t('consultDesk.incomingAria')}
            data-testid={`${kind}-incoming-inbox`}
          >
            <header className="pepito-vet-inbox-head">
              <div>
                <p className="pepito-eyebrow">{t('consultDesk.incomingEyebrow')}</p>
                <h2>{t('consultDesk.incomingTitle')}</h2>
              </div>
              {incoming.length > 0 ? (
                <span className="pepito-vet-inbox-count" aria-label={t('consultDesk.incomingCountAria')}>
                  {coinsLabel(incoming.length)}
                </span>
              ) : null}
            </header>
            {incoming.length === 0 ? (
              <p className="pepito-vet-consult-hint">{t('consultDesk.incomingEmpty')}</p>
            ) : (
              <ul className="pepito-vet-consult-incoming-list">
                {incoming.map((c) => (
                  <li key={c.id} data-testid={`${kind}-incoming-${c.id}`}>
                    <div className="pepito-vet-row-info">
                      <strong>{patientLabel(c, t)}</strong>
                      <span className="pepito-vet-status">
                        <Clock size={12} aria-hidden />
                        {t('consultDesk.statusWaiting')}
                      </span>
                      {c.createdAt ? (
                        <small>{formatPersianDateTime(c.createdAt)}</small>
                      ) : null}
                    </div>
                    <div className="pepito-vet-consult-incoming-actions">
                      <button
                        type="button"
                        className="pepito-btn button-1"
                        disabled={actingId === c.id}
                        onClick={() => void onAccept(c.id)}
                        data-testid={`${kind}-accept-${c.id}`}
                      >
                        <Check size={16} aria-hidden />
                        {t('consultDesk.acceptChat')}
                      </button>
                      <button
                        type="button"
                        className="pepito-btn pepito-btn--ghost pepito-vet-reject"
                        disabled={actingId === c.id}
                        onClick={() => void onReject(c.id)}
                      >
                        <X size={16} aria-hidden />
                        {t('common.reject')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="pepito-vet-inbox-panel"
            aria-label={t('consultDesk.recentAria')}
            data-testid={`${kind}-recent-chats`}
          >
            <header className="pepito-vet-inbox-head">
              <div>
                <p className="pepito-eyebrow">{t('consultDesk.chatEyebrow')}</p>
                <h2>{t('consultDesk.recentTitle')}</h2>
              </div>
            </header>
            {recent.length === 0 ? (
              <p className="pepito-vet-consult-hint">{t('consultDesk.recentEmpty')}</p>
            ) : (
              <ul className="pepito-vet-consult-incoming-list">
                {recent.map((c) => {
                  const st = consultStatusLabel(c, statusCopy);
                  const canChat =
                    (!c.chatEnded && c.status === 'active') || c.status === 'completed';
                  return (
                    <li key={c.id} data-testid={`${kind}-recent-${c.id}`}>
                      <div className="pepito-vet-row-info">
                        <strong>{patientLabel(c, t)}</strong>
                        <span
                          className={`pepito-vet-status${
                            st.tone === 'active'
                              ? ' is-active'
                              : st.tone === 'done'
                                ? ' is-done'
                                : ''
                          }`}
                        >
                          {st.tone === 'active' ? (
                            <Circle size={10} fill="currentColor" aria-hidden />
                          ) : (
                            <Clock size={12} aria-hidden />
                          )}
                          {st.text}
                        </span>
                        {c.createdAt ? (
                          <small>{formatPersianDateTime(c.createdAt)}</small>
                        ) : null}
                      </div>
                      <div className="pepito-vet-consult-incoming-actions">
                        {canChat ? (
                          <Link
                            to={`/vet-chats/${c.id}`}
                            className={`pepito-btn ${
                              st.tone === 'active' ? 'button-1' : 'pepito-btn--ghost'
                            }`}
                            data-testid={`${kind}-open-chat-${c.id}`}
                          >
                            <MessageCircle size={16} aria-hidden />
                            {st.tone === 'active' ? t('consultDesk.openChat') : t('consultDesk.viewChat')}
                          </Link>
                        ) : (
                          <span className="pepito-vet-consult-hint">{t('consultDesk.chatClosedHint')}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <section
          className="pepito-vet-inbox-panel"
          aria-label={t('consultDesk.myRequestsAria')}
          data-testid={`${kind}-my-requests`}
        >
          <header className="pepito-vet-inbox-head">
            <div>
              <p className="pepito-eyebrow">{t('consultDesk.myRequestsEyebrow')}</p>
              <h2>{t('consultDesk.myRequestsTitle')}</h2>
            </div>
          </header>
          {recent.length === 0 ? (
            <p className="pepito-vet-consult-hint">{t('consultDesk.myRequestsEmpty')}</p>
          ) : (
            <ul className="pepito-vet-consult-incoming-list">
              {recent.map((c) => {
                const st = consultStatusLabel(c, statusCopy);
                const canChat =
                  (!c.chatEnded && c.status === 'active') || c.status === 'completed';
                return (
                  <li key={c.id}>
                    <div className="pepito-vet-row-info">
                      <strong>{providerPeerLabel(c, t)}</strong>
                      <span
                        className={`pepito-vet-status${
                          st.tone === 'active'
                            ? ' is-active'
                            : st.tone === 'done'
                              ? ' is-done'
                              : ''
                        }`}
                      >
                        {st.tone === 'active' ? (
                          <Circle size={10} fill="currentColor" aria-hidden />
                        ) : (
                          <Clock size={12} aria-hidden />
                        )}
                        {st.text}
                      </span>
                      {c.createdAt ? (
                        <small>{formatPersianDateTime(c.createdAt)}</small>
                      ) : null}
                    </div>
                    <div className="pepito-vet-consult-incoming-actions">
                      {canChat ? (
                        <Link
                          to={`/vet-chats/${c.id}`}
                          className={`pepito-btn ${
                            st.tone === 'active' ? 'button-1' : 'pepito-btn--ghost'
                          }`}
                        >
                          <MessageCircle size={16} aria-hidden />
                          {st.tone === 'active' ? t('consultDesk.openChat') : t('consultDesk.viewChat')}
                        </Link>
                      ) : (
                        <span className="pepito-vet-consult-hint">{st.text}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export function TrainerConsultPage() {
  return <ServiceConsultPage kind="trainer" />;
}
