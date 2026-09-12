import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  Circle,
  Clock,
  MessageCircle,
  PawPrint,
  Stethoscope,
  X,
} from 'lucide-react';
import {
  BRAND,
  MAX_VET_VISIT_FEE_COINS,
  MIN_VET_VISIT_FEE_COINS,
  QUICK_VET_COST,
  formatPersianDateTime,
  isPrimaryRole,
  userHasRole,
  vetVisitFeeCoins,
  type PetProfile,
  type User,
  type VetConsultation,
  type VetCredentialStatus,
} from '@petdate/shared';
import { appConfirm } from '../components/AppDialog';
import { AiConsultCtaButton } from '../components/AiConsultCtaButton';
import { PageHelpLink } from '../components/PageHelpLink';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
import { credentialChromeLabel, localeNum, useI18n, type TranslateFn } from '../i18n';
import {
  acceptVetConsultation,
  listOnlineVets,
  listPets,
  listVetConsultations,
  quickVetConnect,
  rejectVetConsultation,
  telegramBotDeepLink,
} from '../lib/api';
import { subscribeIncomingRefresh } from '../lib/liveIncoming';

type Phase = 'ready' | 'sending' | 'waiting' | 'connected';

const VISIT_FEE_PRESETS = [1, 5, 10, 20, 50, 100] as const;

function formatCoins(lang: 'fa' | 'en', value: number): string {
  return localeNum(lang, value);
}

function quickConnectCostForVets(vets: User[]): number {
  if (!vets.length) return QUICK_VET_COST;
  return Math.max(QUICK_VET_COST, ...vets.map((v) => vetVisitFeeCoins(v)));
}

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

function patientLabel(c: VetConsultation, t: TranslateFn): string {
  const name = c.patientName?.trim() || t('consultDesk.patientFallback', { id: c.patientUserId });
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

function VetVisitFeeCard({
  currentFee,
  busy,
  needsLogin,
  onSave,
}: {
  currentFee: number;
  busy: boolean;
  needsLogin: boolean;
  onSave: (fee: number) => void | Promise<void>;
}) {
  const { t, lang } = useI18n();
  const [custom, setCustom] = useState('');
  const locked = busy || needsLogin;
  const n = (v: number) => formatCoins(lang, v);

  return (
    <section className="pepito-vet-fee-panel" aria-label={t('consultDesk.visitFeeAria')}>
      <div className="pepito-vet-fee-head">
        <h2>{t('consultDesk.visitFeeTitle')}</h2>
        <p>
          {t('consultDesk.visitFeeCurrent', { n: n(currentFee) })}
        </p>
        <p className="pepito-vet-fee-hint">
          {t('consultDesk.visitFeeHint', {
            min: n(MIN_VET_VISIT_FEE_COINS),
            max: n(MAX_VET_VISIT_FEE_COINS),
          })}
        </p>
      </div>
      <div className="pepito-vet-fee-presets" role="group" aria-label={t('consultDesk.visitFeePresets')}>
        {VISIT_FEE_PRESETS.map((fee) => (
          <button
            key={fee}
            type="button"
            className={`pepito-vet-fee-chip${fee === currentFee ? ' is-active' : ''}`}
            disabled={locked}
            onClick={() => void onSave(fee)}
          >
            {fee === currentFee ? '✓ ' : ''}
            {t('consultDesk.coins', { n: n(fee) })}
          </button>
        ))}
      </div>
      <form
        className="pepito-vet-fee-custom"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Math.floor(Number(custom));
          if (!Number.isFinite(n)) return;
          void onSave(n);
          setCustom('');
        }}
      >
        <label htmlFor="vet-visit-fee-custom">{t('consultDesk.visitFeeCustom')}</label>
        <div className="pepito-vet-fee-custom-row">
          <input
            id="vet-visit-fee-custom"
            type="number"
            min={MIN_VET_VISIT_FEE_COINS}
            max={MAX_VET_VISIT_FEE_COINS}
            inputMode="numeric"
            placeholder={t('consultDesk.visitFeePlaceholder')}
            value={custom}
            disabled={locked}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button type="submit" className="pepito-btn button-1" disabled={locked || !custom.trim()}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </section>
  );
}

function OnlineVetsList({
  vets,
  loading,
  connectCost,
}: {
  vets: User[];
  loading: boolean;
  connectCost: number;
}) {
  const { t, lang } = useI18n();
  return (
    <section className="pepito-vet-online-list" aria-label={t('consultDesk.onlineVetsAria')}>
      <div className="pepito-vet-online-list-head">
        <h2>{t('consultDesk.onlineVetsTitle')}</h2>
        <p>
          {loading
            ? t('consultDesk.onlineVetsLoading')
            : vets.length
              ? t('consultDesk.onlineVetsReady', {
                  n: formatCoins(lang, vets.length),
                  cost: formatCoins(lang, connectCost),
                })
              : t('consultDesk.noProvidersHuman')}
        </p>
      </div>
      {!loading && vets.length ? (
        <ul className="pepito-vet-online-list-ul">
          {vets.map((vet) => {
            const fee = vetVisitFeeCoins(vet);
            const city = vet.city?.trim();
            return (
              <li key={vet.id}>
                <div>
                  <strong>{vet.name}</strong>
                  {city ? <span className="pepito-vet-online-list-city">{city}</span> : null}
                </div>
                <span className="pepito-vet-online-list-fee">{t('consultDesk.coins', { n: formatCoins(lang, fee) })}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function VetOnlineCard({
  vetOnline,
  onlineBusy,
  needsLogin,
  dualRole,
  credentialStatus,
  onSetOnline,
}: {
  vetOnline: boolean;
  onlineBusy: boolean;
  needsLogin: boolean;
  dualRole?: boolean;
  credentialStatus?: VetCredentialStatus | null;
  onSetOnline: (online: boolean) => void;
}) {
  const { t } = useI18n();
  const cred = credentialChromeLabel(t, credentialStatus);
  const verified = credentialStatus === 'verified';
  // Only block interaction while a request is in flight or when logged out.
  // Never leave the control permanently inert — busy is cleared by a timeout too.
  const locked = onlineBusy || needsLogin;
  return (
    <section
      className={`pepito-vet-online-card${vetOnline ? ' is-online' : ' is-offline'}`}
      aria-label={t('consultDesk.onlineStateAria')}
      aria-busy={onlineBusy || undefined}
    >
      <div className="pepito-vet-online-card-main">
        <div className="pepito-vet-online-status">
          <span className="pepito-vet-online-pulse" aria-hidden>
            <span className="pepito-vet-online-pulse-core" />
          </span>
          <div className="pepito-vet-online-text">
            <p className="pepito-vet-online-kicker">{dualRole ? t('consultDesk.roleVet') : t('consultDesk.acceptingState')}</p>
            <strong>
              <span className="pepito-vet-online-state">{vetOnline ? t('consultDesk.online') : t('consultDesk.offline')}</span>
              <span className="pepito-vet-online-sep"> · </span>
              {vetOnline ? t('consultDesk.readyToAccept') : t('consultDesk.awayAccept')}
            </strong>
            <span className="pepito-vet-online-hint">
              {vetOnline
                ? dualRole
                  ? t('consultDesk.hintOnlineDual')
                  : t('consultDesk.hintOnlineSolo')
                : dualRole
                  ? t('consultDesk.hintOfflineDual')
                  : t('consultDesk.hintOfflineSolo')}
            </span>
          </div>
        </div>
        <div
          className="pepito-vet-online-seg"
          role="group"
          aria-label={t('consultDesk.toggleAcceptAria')}
        >
          <button
            type="button"
            className={`pepito-vet-online-seg-btn${vetOnline ? ' is-active is-online' : ''}`}
            disabled={locked}
            onClick={() => onSetOnline(true)}
            data-testid={
              dualRole ? 'vet-online-toggle-dual-on' : 'vet-online-toggle-on'
            }
            aria-pressed={vetOnline}
            aria-label={t('consultDesk.goOnline')}
          >
            {onlineBusy && !vetOnline ? '…' : t('consultDesk.online')}
          </button>
          <button
            type="button"
            className={`pepito-vet-online-seg-btn${!vetOnline ? ' is-active is-offline' : ''}`}
            disabled={locked}
            onClick={() => onSetOnline(false)}
            data-testid={
              dualRole ? 'vet-online-toggle-dual-off' : 'vet-online-toggle-off'
            }
            aria-pressed={!vetOnline}
            aria-label={t('consultDesk.goOffline')}
          >
            {onlineBusy && vetOnline ? '…' : t('consultDesk.offline')}
          </button>
        </div>
      </div>
      <div className="pepito-vet-panel-meta">
        <p className="pepito-vet-panel-caps-line">
          {t('consultDesk.chatTools')}
        </p>
        <p className={`pepito-vet-cred-pill${verified ? ' is-ok' : ' is-warn'}`}>
          {cred}
          {!verified ? (
            <>
              {' · '}
              <Link to="/profile">{t('consultDesk.credUpload')}</Link>
            </>
          ) : null}
        </p>
      </div>
    </section>
  );
}

function VetInboxSection({
  incoming,
  recent,
  actingId,
  onAccept,
  onReject,
}: {
  incoming: VetConsultation[];
  recent: VetConsultation[];
  actingId: number | null;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <div className="pepito-vet-inbox-stack">
      <section
        className="pepito-vet-inbox-panel pepito-vet-inbox-panel--incoming"
        aria-label={t('consultDesk.incomingVetAria')}
        data-testid="vet-incoming-inbox"
      >
        <header className="pepito-vet-inbox-head">
          <div>
            <p className="pepito-eyebrow">{t('consultDesk.incomingEyebrow')}</p>
            <h2>{t('consultDesk.incomingTitle')}</h2>
          </div>
          {incoming.length > 0 ? (
            <span className="pepito-vet-inbox-count" aria-label={t('consultDesk.incomingCountAria')}>
              {localeNum(lang, incoming.length)}
            </span>
          ) : null}
        </header>
        {incoming.length === 0 ? (
          <p className="pepito-vet-consult-hint">{t('consultDesk.incomingEmpty')}</p>
        ) : (
          <ul className="pepito-vet-consult-incoming-list">
            {incoming.map((c) => (
              <li key={c.id} data-testid={`vet-incoming-${c.id}`}>
                <div className="pepito-vet-row-info">
                  <strong>{patientLabel(c, t)}</strong>
                  <span className="pepito-vet-status">
                    <Clock size={12} aria-hidden />
                    {t('consultDesk.statusWaiting')}
                  </span>
                  {c.createdAt ? <small>{formatPersianDateTime(c.createdAt)}</small> : null}
                </div>
                <div className="pepito-vet-consult-incoming-actions">
                  <button
                    type="button"
                    className="pepito-btn button-1"
                    disabled={actingId === c.id}
                    onClick={() => onAccept(c.id)}
                    data-testid={`vet-accept-${c.id}`}
                  >
                    <Check size={16} aria-hidden />
                    {t('consultDesk.acceptChat')}
                  </button>
                  <Link
                    to={`/vet-chats/${c.id}`}
                    className="pepito-btn pepito-btn--ghost"
                    data-testid={`vet-open-chat-${c.id}`}
                  >
                    <MessageCircle size={16} aria-hidden />
                    {t('consultDesk.view')}
                  </Link>
                  <button
                    type="button"
                    className="pepito-btn pepito-btn--ghost pepito-vet-reject"
                    disabled={actingId === c.id}
                    onClick={() => onReject(c.id)}
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
        aria-label={t('consultDesk.recentPatientsAria')}
        data-testid="vet-recent-patients"
      >
        <header className="pepito-vet-inbox-head">
          <div>
            <p className="pepito-eyebrow">{t('consultDesk.patientsEyebrow')}</p>
            <h2>{t('consultDesk.recentPatients')}</h2>
          </div>
        </header>
        {recent.length === 0 ? (
          <p className="pepito-vet-consult-hint">{t('consultDesk.recentPatientsEmpty')}</p>
        ) : (
          <ul className="pepito-vet-consult-incoming-list">
            {recent.map((c) => {
              const isActive = c.status === 'active' && !c.chatEnded;
              return (
              <li key={c.id}>
                <div className="pepito-vet-row-info">
                  <strong>{patientLabel(c, t)}</strong>
                  <span
                    className={`pepito-vet-status${
                      isActive ? ' is-active' : ' is-done'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Circle size={10} fill="currentColor" aria-hidden />
                        {t('consultDesk.statusConsultActive')}
                      </>
                    ) : (
                      t('consultDesk.statusClosed')
                    )}
                  </span>
                  {c.createdAt ? <small>{formatPersianDateTime(c.createdAt)}</small> : null}
                </div>
                <div className="pepito-vet-consult-incoming-actions">
                  <Link
                    to={`/vet-chats/${c.id}`}
                    className={`pepito-btn ${isActive ? 'button-1' : 'pepito-btn--ghost'}`}
                    data-testid={
                      isActive ? `vet-resume-chat-${c.id}` : `vet-view-chat-${c.id}`
                    }
                  >
                    <MessageCircle size={16} aria-hidden />
                    {isActive ? t('consultDesk.openChat') : t('consultDesk.viewChat')}
                  </Link>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function VetConsultPage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const n = (v: number) => formatCoins(lang, v);
  const { user, token, isLoggedIn, refreshMe, setVetOnline, setVisitFee } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [busyMode, setBusyMode] = useState<'ai' | 'human' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusLines, setStatusLines] = useState<string[] | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [activeConsult, setActiveConsult] = useState<VetConsultation | null>(null);
  const [requestedIds, setRequestedIds] = useState<number[]>([]);
  const [incoming, setIncoming] = useState<VetConsultation[]>([]);
  const [recent, setRecent] = useState<VetConsultation[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [feeBusy, setFeeBusy] = useState(false);
  const [onlineVets, setOnlineVets] = useState<User[]>([]);
  const [onlineVetsLoading, setOnlineVetsLoading] = useState(false);
  const autoNavRef = useRef<number | null>(null);
  const onlineBusyRef = useRef(false);
  const onlineToggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const coins = user?.coins ?? user?.wallet?.coins ?? 0;
  const botUrl = telegramBotDeepLink();
  const hasVetRole = userHasRole(user, 'vet');
  const isVetDashboard = isPrimaryRole(user, 'vet');
  const vetOnline = Boolean(user?.vetOnline);
  const myVisitFee = vetVisitFeeCoins(user);
  const patientOnlineVets = useMemo(
    () => onlineVets.filter((v) => v.id !== user?.id),
    [onlineVets, user?.id]
  );
  const connectCost = quickConnectCostForVets(patientOnlineVets);

  const loadPets = useCallback(async () => {
    if (!user?.id || isVetDashboard) {
      setPets([]);
      return;
    }
    setPetsLoading(true);
    try {
      setPets(await listPets({ ownerId: user.id }));
    } catch {
      setPets([]);
    } finally {
      setPetsLoading(false);
    }
  }, [user?.id, isVetDashboard]);

  const loadOnlineVets = useCallback(async () => {
    if (isVetDashboard) {
      setOnlineVets([]);
      return;
    }
    setOnlineVetsLoading(true);
    try {
      setOnlineVets(await listOnlineVets());
    } catch {
      setOnlineVets([]);
    } finally {
      setOnlineVetsLoading(false);
    }
  }, [isVetDashboard]);

  const refreshConsultStatus = useCallback(async () => {
    if (!user?.id || isVetDashboard) return;
    try {
      const rows = await listVetConsultations({ patientUserId: user.id });
      // Only treat as "connected" when THIS request was accepted — never jump into
      // an unrelated older active consult right after paying.
      const accepted =
        requestedIds.length > 0
          ? rows.find((c) => c.status === 'active' && requestedIds.includes(c.id)) ??
            null
          : null;
      if (accepted) {
        setActiveConsult(accepted);
        setPhase('connected');
        return;
      }
      const pending = rows.filter(
        (c) =>
          c.status === 'requested' &&
          (requestedIds.length === 0 || requestedIds.includes(c.id))
      );
      if (pending.length && phase !== 'sending') {
        setPhase('waiting');
        setActiveConsult(null);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [user?.id, requestedIds, phase, isVetDashboard]);

  const loadIncoming = useCallback(async () => {
    if (!user?.id || !hasVetRole) {
      setIncoming([]);
      return;
    }
    try {
      const rows = await listVetConsultations({
        vetUserId: user.id,
        status: 'requested',
      });
      setIncoming((prev) => {
        if (
          prev.length === rows.length &&
          prev.every(
            (row, i) =>
              row.id === rows[i]?.id &&
              row.status === rows[i]?.status &&
              row.patientName === rows[i]?.patientName &&
              row.petName === rows[i]?.petName,
          )
        ) {
          return prev;
        }
        return rows;
      });
    } catch {
      setIncoming([]);
    }
  }, [user?.id, hasVetRole]);

  const loadRecent = useCallback(async () => {
    // Any owned vet role must see active/recent patients — not only primary=vet.
    // Dual-role users often keep pet_owner as primary while receiving consults.
    if (!user?.id || !hasVetRole) {
      setRecent([]);
      return;
    }
    try {
      const rows = await listVetConsultations({ vetUserId: user.id });
      const done = rows.filter((c) => c.status === 'active' || c.status === 'completed');
      const next = done.slice(0, 8);
      setRecent((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (row, i) =>
              row.id === next[i]?.id &&
              row.status === next[i]?.status &&
              row.patientName === next[i]?.patientName,
          )
        ) {
          return prev;
        }
        return next;
      });
    } catch {
      setRecent([]);
    }
  }, [user?.id, hasVetRole]);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    void loadOnlineVets();
  }, [loadOnlineVets]);

  useEffect(() => {
    void refreshConsultStatus();
  }, [refreshConsultStatus]);

  useEffect(() => {
    void loadIncoming();
  }, [loadIncoming]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useLiveAjaxPoll(
    () => {
      void refreshConsultStatus();
      void loadIncoming();
      if (hasVetRole) void loadRecent();
    },
    {
      enabled: hasVetRole || phase === 'waiting' || phase === 'connected',
      intervalMs: 45_000,
    },
  );

  useEffect(() => {
    if (!hasVetRole) return;
    return subscribeIncomingRefresh((detail) => {
      if (detail?.kinds && !detail.kinds.includes('vet')) return;
      void loadIncoming();
      void loadRecent();
    });
  }, [hasVetRole, loadIncoming, loadRecent]);

  useEffect(() => {
    if (isVetDashboard) return;
    if (phase === 'connected' && activeConsult?.id && autoNavRef.current !== activeConsult.id) {
      autoNavRef.current = activeConsult.id;
      navigate(`/vet-chats/${activeConsult.id}`);
    }
  }, [phase, activeConsult?.id, navigate, isVetDashboard]);

  const needsLogin = !isLoggedIn || !user?.id;
  const needsPet = !needsLogin && !petsLoading && pets.length === 0;
  const noOnlineVets = !needsLogin && !needsPet && !onlineVetsLoading && patientOnlineVets.length === 0;
  const lowCoins = !needsLogin && !needsPet && !noOnlineVets && coins < connectCost;

  const lead = useMemo(() => {
    if (isVetDashboard) {
      return vetOnline
        ? t('consultDesk.leadVetOnline')
        : t('consultDesk.leadVetOffline');
    }
    if (needsLogin) return t('consultDesk.leadVetLogin');
    if (needsPet) return t('consultDesk.needPetVet');
    if (noOnlineVets) return t('consultDesk.doctorLeadAi');
    if (lowCoins) {
      return t('consultDesk.lowCoins', { cost: n(connectCost), coins: n(coins) });
    }
    return t('consultDesk.doctorLeadReady');
  }, [isVetDashboard, vetOnline, needsLogin, needsPet, noOnlineVets, lowCoins, coins, connectCost, t, lang]);

  async function onSetVetOnline(nextOnline: boolean) {
    if (!token) { const msg = 'اول وارد حساب شو.'; setError(msg); toastError(msg); return; }
    if (nextOnline) {
      const cred = user?.vetCredentialStatus ?? 'none';
      if (cred === 'none') {
        const msg = 'اول مدرک دامپزشکی را آپلود کن تا پنل فعال شود (از ربات یا پروفایل).';
        setError(msg); toastError(msg); return;
      }
      if (cred !== 'verified') {
        const msg = 'مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین می‌توانی آنلاین شوی.';
        setError(msg); toastError(msg); return;
      }
    }
    if (onlineBusyRef.current) return;
    if (Boolean(user?.vetOnline) === nextOnline) return;
    onlineBusyRef.current = true; setOnlineBusy(true); setError(null);
    if (onlineToggleTimerRef.current) clearTimeout(onlineToggleTimerRef.current);
    let timedOut = false;
    onlineToggleTimerRef.current = setTimeout(() => {
      timedOut = true; onlineBusyRef.current = false; setOnlineBusy(false);
      const msg = 'تغییر وضعیت بیش از حد طول کشید. دوباره تلاش کن.';
      setError(msg); toastError(msg);
    }, 12_000);
    try {
      await setVetOnline(nextOnline);
      toastSuccess(nextOnline ? 'آنلاین شدی.' : 'آفلاین شدی.');
    } catch (err) {
      if (!timedOut) {
        const msg = err instanceof Error ? err.message : 'تغییر وضعیت آنلاین ناموفق بود';
        setError(msg); toastError(msg);
      }
    } finally {
      if (onlineToggleTimerRef.current) { clearTimeout(onlineToggleTimerRef.current); onlineToggleTimerRef.current = null; }
      if (!timedOut) { onlineBusyRef.current = false; setOnlineBusy(false); }
    }
  }

  useEffect(() => {
    return () => {
      if (onlineToggleTimerRef.current) clearTimeout(onlineToggleTimerRef.current);
    };
  }, []);

  async function onSaveVisitFee(fee: number) {
    if (!token) return;
    setFeeBusy(true); setError(null);
    try {
      await setVisitFee(fee);
      toastSuccess('مبلغ ویزیت ذخیره شد.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ثبت مبلغ ویزیت ناموفق بود';
      setError(msg); toastError(msg);
    } finally { setFeeBusy(false); }
  }

  async function onConnect(mode: 'ai' | 'human') {
    if (!user?.id) { const msg = 'اول وارد حساب شو.'; setError(msg); toastError(msg); return; }
    if (pets.length === 0) {
      const msg = 'برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.';
      setError(msg); toastError(msg); return;
    }
    if (mode === 'human') {
      if (!patientOnlineVets.length) {
        const msg = 'فعلاً دامپزشک آنلاینی (ربات یا وب) برای اتصال پیدا نشد. کمی بعد دوباره امتحان کن.';
        setError(msg); toastError(msg); return;
      }
      if (coins < connectCost) {
        const msg = `برای اتصال سریع حداقل ${n(connectCost)} سکه لازم داری.
موجودی: ${n(coins)} — از ربات «سکه» بگیر.`;
        setError(msg);
        toastError(msg);
        return;
      }
      const payOk = await appConfirm(
        [
          `هزینه این درخواست: ${n(connectCost)} سکه`,
          `موجودی فعلی: ${n(coins)} سکه`,
          `پزشک‌های هدف: ${patientOnlineVets.length}`,
          '',
          'با تأیید، سکه از موجودی‌ات کسر می‌شود و درخواست برای پزشک‌های آنلاین ارسال می‌شود.',
          'ادامه می‌دهی؟',
        ].join('\n')
      );
      if (!payOk) return;
    }

    setPhase('sending');
    setBusyMode(mode);
    setError(null);
    setStatusLines(null);
    setActiveConsult(null);
    autoNavRef.current = null;
    try {
      let result;
      try {
        result = await quickVetConnect(user.id, token, {
          preferAi: mode === 'ai',
          humanOnly: mode === 'human',
        });
      }
      catch (err) {
        const needsConfirm =
          err instanceof Error &&
          ((err as Error & { requiresResendConfirm?: boolean }).requiresResendConfirm ||
            /میخوای مجدد/.test(err.message));
        if (needsConfirm) {
          const ok = await appConfirm('میخوای مجدد درخواست بدی به اون شخص؟');
          if (!ok) { setPhase('ready'); setBusyMode(null); return; }
          result = await quickVetConnect(user.id, token, {
            confirmResend: true,
            preferAi: mode === 'ai',
            humanOnly: mode === 'human',
          });
        } else { throw err; }
      }
      setSentCount(result.sent);
      setRequestedIds(result.consultations.map((c) => c.id));
      if (result.aiFallback || mode === 'ai') {
        const consultId = result.consultations?.[0]?.id;
        const aiLines = [
          result.message,
          'چت با لیلا کیانی باز شد — می‌توانی سؤال‌ات را بفرستی.',
        ];
        setStatusLines(aiLines);
        setPhase('ready');
        setBusyMode(null);
        toastSuccess(aiLines[0]!);
        try {
          await refreshMe();
        } catch {
          /* wallet chip may lag */
        }
        if (consultId) {
          navigate(`/vet-chats/${consultId}`);
        }
        return;
      }
      const lines = [
        'درخواستت برای پزشک‌های آنلاین ربات و وب ارسال شد.',
        `پزشک‌های هدف: ${n(result.sent)}`,
        `سکه کسر شده: ${n(result.cost)}`,
        `موجودی باقی‌مانده: ${n(result.coins)}`,
        'در انتظار پذیرش دامپزشک — تا قبول پزشک چت باز نمی‌شود.',
      ];
      setStatusLines(lines); setPhase('waiting'); setBusyMode(null); toastSuccess(lines[0]!);
      try { await refreshMe(); } catch { /* */ }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ارسال درخواست';
      setError(msg); toastError(msg); setPhase('ready'); setBusyMode(null);
    }
  }

  async function onAcceptIncoming(id: number) {
    if (!token) return;
    setActingId(id); setError(null);
    try {
      await acceptVetConsultation(id, token);
      navigate(`/vet-chats/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'قبول درخواست ناموفق بود';
      setError(msg); toastError(msg);
    } finally { setActingId(null); }
  }

  async function onRejectIncoming(id: number) {
    if (!token) return;
    setActingId(id); setError(null);
    try {
      await rejectVetConsultation(id, token);
      await loadIncoming();
      toastSuccess('درخواست رد شد.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'رد درخواست ناموفق بود';
      setError(msg); toastError(msg);
    } finally { setActingId(null); }
  }

  const hero = (
    <header className="pepito-vet-hero">
      <div className="pepito-vet-hero-wash" aria-hidden />
      <div className="pepito-vet-hero-inner">
        <p className="pepito-kicker pepito-vet-kicker">
          <span className="pepito-kicker-dot" aria-hidden>
            <Stethoscope size={16} />
          </span>
          {BRAND.displayNameFa || BRAND.displayName}
        </p>
        <h1>{isVetDashboard ? t('consultDesk.titleVet') : t('consultDesk.titleVetPatient')}</h1>
        <p className="pepito-vet-lead">{lead}</p>
        <PageHelpLink section="consults" className="pepito-page-help-link--hero" />
      </div>
    </header>
  );

  /* ── Dedicated vet dashboard (primary role = vet) ── */
  if (isVetDashboard) {
    return (
      <div className="pepito-vet-consult pepito-vet-dashboard">
        {hero}
        <VetOnlineCard
          vetOnline={vetOnline}
          onlineBusy={onlineBusy}
          needsLogin={needsLogin}
          credentialStatus={user?.vetCredentialStatus}
          onSetOnline={(online) => void onSetVetOnline(online)}
        />
        <VetVisitFeeCard
          currentFee={myVisitFee}
          busy={feeBusy}
          needsLogin={needsLogin}
          onSave={onSaveVisitFee}
        />
        {error ? (
          <p className="auth-error pepito-vet-consult-status" role="alert">
            {error}
          </p>
        ) : null}
        <VetInboxSection
          incoming={incoming}
          recent={recent}
          actingId={actingId}
          onAccept={(id) => void onAcceptIncoming(id)}
          onReject={(id) => void onRejectIncoming(id)}
        />
      </div>
    );
  }

  /* ── Patient / owner quick-connect surface ── */
  return (
    <div className="pepito-vet-consult">
      {hero}

      {hasVetRole ? (
        <>
          <VetOnlineCard
            vetOnline={vetOnline}
            onlineBusy={onlineBusy}
            needsLogin={needsLogin}
            dualRole
            credentialStatus={user?.vetCredentialStatus}
            onSetOnline={(online) => void onSetVetOnline(online)}
          />
          <VetVisitFeeCard
            currentFee={myVisitFee}
            busy={feeBusy}
            needsLogin={needsLogin}
            onSave={onSaveVisitFee}
          />
          <VetInboxSection
            incoming={incoming}
            recent={recent}
            actingId={actingId}
            onAccept={(id) => void onAcceptIncoming(id)}
            onReject={(id) => void onRejectIncoming(id)}
          />
        </>
      ) : null}

      <OnlineVetsList
        vets={patientOnlineVets}
        loading={onlineVetsLoading}
        connectCost={connectCost}
      />

      <section className="pepito-vet-connect-panel" aria-label={t('consultDesk.quickConnectAria')}>
        <div className="pepito-vet-consult-cost" role="status">
          <span className="pepito-vet-cost-mark" aria-hidden>
            <Stethoscope size={20} strokeWidth={2} />
          </span>
          <div>
            <strong>{t('consultDesk.connectCostTitle')}</strong>
            <span>
              {onlineVetsLoading
                ? t('consultDesk.connecting')
                : noOnlineVets
                  ? t('consultDesk.aiLeilaFree')
                  : t('consultDesk.deductBeforeSend', { cost: n(connectCost) })}
            </span>
          </div>
          {!needsLogin ? (
            <small>
              {t('consultDesk.balanceLine', { n: n(coins) })}
              {lowCoins ? t('consultDesk.lowCoinsHint') : ''}
            </small>
          ) : null}
        </div>

        {needsLogin ? (
          <Link to="/auth/login" className="pepito-btn button-1">
            <PawIcon />
            {t('consultDesk.loginForVet')}
          </Link>
        ) : needsPet ? (
          <>
            <p className="pepito-vet-consult-hint">
              {t('consultDesk.noPetYet')}
              <br />
              {t('consultDesk.needPetVet')}
            </p>
            <Link to="/add-pet" className="pepito-btn button-1">
              <PawIcon />
              {t('consultDesk.addPet')}
            </Link>
          </>
        ) : (
          <div className="pepito-consult-cta-stack">
            <AiConsultCtaButton
              testId="vet-ai-quick-connect"
              busy={phase === 'sending' && busyMode === 'ai'}
              disabled={phase === 'sending' || petsLoading || onlineVetsLoading}
              label={t('consultDesk.aiLeilaFree')}
              busyLabel={t('consultDesk.sending')}
              badge={t('consultDesk.aiBadge')}
              onClick={() => void onConnect('ai')}
            />
            <button
              type="button"
              className="pepito-btn pepito-human-consult-cta"
              data-testid="vet-quick-connect"
              disabled={
                phase === 'sending' ||
                petsLoading ||
                onlineVetsLoading ||
                (patientOnlineVets.length > 0 && lowCoins) ||
                patientOnlineVets.length === 0
              }
              onClick={() => void onConnect('human')}
            >
              <span className="pepito-btn-icon" aria-hidden>
                <Stethoscope size={16} strokeWidth={2.25} />
              </span>
              {phase === 'sending' && busyMode === 'human'
                ? t('consultDesk.sendingDeduct')
                : patientOnlineVets.length === 0
                  ? t('consultDesk.realDoctor')
                  : phase === 'waiting' || phase === 'connected'
                    ? t('consultDesk.sendAgain')
                    : t('consultDesk.confirmConnect', { cost: n(connectCost) })}
            </button>
          </div>
        )}

        {lowCoins && !needsLogin && !needsPet ? (
          <a
            className="pepito-btn pepito-btn--ghost pepito-vet-consult-bot"
            href={botUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t('consultDesk.buyCoinsBot')}
          </a>
        ) : null}

        {error ? (
          <p className="auth-error pepito-vet-consult-status" role="alert">
            {error}
          </p>
        ) : null}

        {statusLines && !error ? (
          <div className="pepito-vet-consult-status" role="status">
            {statusLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}

        {phase === 'waiting' ? (
          <div
            className="pepito-vet-consult-wait"
            role="status"
            data-testid="vet-consult-waiting"
          >
            <p className="pepito-vet-consult-wait-title">
              {t('consultDesk.waitingVetTitle')}
            </p>
            <p>{t('consultDesk.waitingVetSent', { n: n(sentCount || requestedIds.length) })}</p>
            <p>{t('consultDesk.waitingVetBody')}</p>
          </div>
        ) : null}

        {phase === 'connected' && activeConsult ? (
          <div className="pepito-vet-consult-connected" role="status">
            <p>
              {t('consultDesk.vetAccepted', {
                name: activeConsult.vetName?.trim() || `#${activeConsult.vetUserId}`,
              })}
            </p>
            <Link className="pepito-btn button-1" to={`/vet-chats/${activeConsult.id}`}>
              <PawIcon />
              {t('consultDesk.openVetChat')}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
