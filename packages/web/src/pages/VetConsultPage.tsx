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
  VET_CREDENTIAL_STATUS_LABELS,
  formatPersianDateTime,
  isPrimaryRole,
  toPersianDigits,
  userHasRole,
  vetVisitFeeCoins,
  type PetProfile,
  type User,
  type VetConsultation,
  type VetCredentialStatus,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
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

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

function quickConnectCostForVets(vets: User[]): number {
  if (!vets.length) return QUICK_VET_COST;
  return Math.max(QUICK_VET_COST, ...vets.map((v) => vetVisitFeeCoins(v)));
}

function credentialLabel(status?: VetCredentialStatus | null): string {
  const key: VetCredentialStatus = status && status in VET_CREDENTIAL_STATUS_LABELS ? status : 'none';
  return VET_CREDENTIAL_STATUS_LABELS[key];
}

function PawIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <PawPrint size={size} />
    </span>
  );
}

function patientLabel(c: VetConsultation): string {
  const name = c.patientName?.trim() || `بیمار #${c.patientUserId}`;
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
  const [custom, setCustom] = useState('');
  const locked = busy || needsLogin;

  return (
    <section className="pepito-vet-fee-panel" aria-label="مبلغ ویزیت">
      <div className="pepito-vet-fee-head">
        <h2>مبلغ ویزیت</h2>
        <p>
          مبلغ فعلی: <strong>{formatCoins(currentFee)} سکه</strong>
        </p>
        <p className="pepito-vet-fee-hint">
          این مبلغ هنگام درخواست مشاوره سریع از بیمار کسر می‌شود ({formatCoins(MIN_VET_VISIT_FEE_COINS)} تا{' '}
          {formatCoins(MAX_VET_VISIT_FEE_COINS)} سکه).
        </p>
      </div>
      <div className="pepito-vet-fee-presets" role="group" aria-label="مبالغ آماده">
        {VISIT_FEE_PRESETS.map((fee) => (
          <button
            key={fee}
            type="button"
            className={`pepito-vet-fee-chip${fee === currentFee ? ' is-active' : ''}`}
            disabled={locked}
            onClick={() => void onSave(fee)}
          >
            {fee === currentFee ? '✓ ' : ''}
            {formatCoins(fee)} سکه
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
        <label htmlFor="vet-visit-fee-custom">مبلغ دلخواه</label>
        <div className="pepito-vet-fee-custom-row">
          <input
            id="vet-visit-fee-custom"
            type="number"
            min={MIN_VET_VISIT_FEE_COINS}
            max={MAX_VET_VISIT_FEE_COINS}
            inputMode="numeric"
            placeholder="مثلاً ۱۵"
            value={custom}
            disabled={locked}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button type="submit" className="pepito-btn button-1" disabled={locked || !custom.trim()}>
            ذخیره
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
  return (
    <section className="pepito-vet-online-list" aria-label="پزشک‌های آنلاین">
      <div className="pepito-vet-online-list-head">
        <h2>پزشک‌های آنلاین</h2>
        <p>
          {loading
            ? 'در حال دریافت لیست…'
            : vets.length
              ? `${formatCoins(vets.length)} پزشک آماده پذیرش — هزینه اتصال: ${formatCoins(connectCost)} سکه`
              : 'دامپزشک انسانی آنلاین نیست — دستیار هوشمند آماده پاسخ است.'}
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
                <span className="pepito-vet-online-list-fee">{formatCoins(fee)} سکه</span>
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
  const cred = credentialLabel(credentialStatus);
  const verified = credentialStatus === 'verified';
  // Only block interaction while a request is in flight or when logged out.
  // Never leave the control permanently inert — busy is cleared by a timeout too.
  const locked = onlineBusy || needsLogin;
  return (
    <section
      className={`pepito-vet-online-card${vetOnline ? ' is-online' : ' is-offline'}`}
      aria-label="وضعیت آنلاین"
      aria-busy={onlineBusy || undefined}
    >
      <div className="pepito-vet-online-card-main">
        <div className="pepito-vet-online-status">
          <span className="pepito-vet-online-pulse" aria-hidden>
            <span className="pepito-vet-online-pulse-core" />
          </span>
          <div className="pepito-vet-online-text">
            <p className="pepito-vet-online-kicker">{dualRole ? 'نقش دامپزشک' : 'وضعیت پذیرش'}</p>
            <strong>
              <span className="pepito-vet-online-state">{vetOnline ? 'آنلاین' : 'آفلاین'}</span>
              <span className="pepito-vet-online-sep"> · </span>
              {vetOnline ? 'آماده پذیرش' : 'خارج از پذیرش'}
            </strong>
            <span className="pepito-vet-online-hint">
              {vetOnline
                ? dualRole
                  ? 'درخواست‌های بیمار همین‌جا می‌رسند.'
                  : 'در فهرست پزشکان آماده قرار داری.'
                : dualRole
                  ? 'آنلاین شو تا درخواست‌های جدید برسند.'
                  : 'درخواست جدیدی نمی‌رسد؛ موارد در انتظار همین‌جا می‌مانند.'}
            </span>
          </div>
        </div>
        <div
          className="pepito-vet-online-seg"
          role="group"
          aria-label="تغییر وضعیت پذیرش"
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
            aria-label="آنلاین شو"
          >
            {onlineBusy && !vetOnline ? '…' : 'آنلاین'}
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
            aria-label="آفلاین شو"
          >
            {onlineBusy && vetOnline ? '…' : 'آفلاین'}
          </button>
        </div>
      </div>
      <div className="pepito-vet-panel-meta">
        <p className="pepito-vet-panel-caps-line">
          در چت فعال: <strong>نسخه</strong>، پرونده، مورد بالینی و بستن چت
        </p>
        <p className={`pepito-vet-cred-pill${verified ? ' is-ok' : ' is-warn'}`}>
          {cred}
          {!verified ? (
            <>
              {' · '}
              <Link to="/profile">آپلود مدرک</Link>
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
  return (
    <div className="pepito-vet-inbox-stack">
      <section
        className="pepito-vet-inbox-panel pepito-vet-inbox-panel--incoming"
        aria-label="درخواست‌های ورودی پزشک"
        data-testid="vet-incoming-inbox"
      >
        <header className="pepito-vet-inbox-head">
          <div>
            <p className="pepito-eyebrow">ورودی</p>
            <h2>درخواست‌های جدید</h2>
          </div>
          {incoming.length > 0 ? (
            <span className="pepito-vet-inbox-count" aria-label="تعداد درخواست">
              {toPersianDigits(String(incoming.length))}
            </span>
          ) : null}
        </header>
        {incoming.length === 0 ? (
          <p className="pepito-vet-consult-hint">فعلاً درخواست جدیدی نیست.</p>
        ) : (
          <ul className="pepito-vet-consult-incoming-list">
            {incoming.map((c) => (
              <li key={c.id} data-testid={`vet-incoming-${c.id}`}>
                <div className="pepito-vet-row-info">
                  <strong>{patientLabel(c)}</strong>
                  <span className="pepito-vet-status">
                    <Clock size={12} aria-hidden />
                    در انتظار پاسخ
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
                    قبول و چت
                  </button>
                  <Link
                    to={`/vet-chats/${c.id}`}
                    className="pepito-btn pepito-btn--ghost"
                    data-testid={`vet-open-chat-${c.id}`}
                  >
                    <MessageCircle size={16} aria-hidden />
                    مشاهده
                  </Link>
                  <button
                    type="button"
                    className="pepito-btn pepito-btn--ghost pepito-vet-reject"
                    disabled={actingId === c.id}
                    onClick={() => onReject(c.id)}
                  >
                    <X size={16} aria-hidden />
                    رد
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="pepito-vet-inbox-panel"
        aria-label="آخرین بیمارها"
        data-testid="vet-recent-patients"
      >
        <header className="pepito-vet-inbox-head">
          <div>
            <p className="pepito-eyebrow">بیماران</p>
            <h2>آخرین بیمارها</h2>
          </div>
        </header>
        {recent.length === 0 ? (
          <p className="pepito-vet-consult-hint">هنوز بیماری ثبت نشده.</p>
        ) : (
          <ul className="pepito-vet-consult-incoming-list">
            {recent.map((c) => (
              <li key={c.id}>
                <div className="pepito-vet-row-info">
                  <strong>{patientLabel(c)}</strong>
                  <span
                    className={`pepito-vet-status${
                      c.status === 'active' ? ' is-active' : ' is-done'
                    }`}
                  >
                    {c.status === 'active' ? (
                      <>
                        <Circle size={10} fill="currentColor" aria-hidden />
                        مشاوره فعال
                      </>
                    ) : (
                      'پایان‌یافته'
                    )}
                  </span>
                  {c.createdAt ? <small>{formatPersianDateTime(c.createdAt)}</small> : null}
                </div>
                <div className="pepito-vet-consult-incoming-actions">
                  <Link
                    to={`/vet-chats/${c.id}`}
                    className={`pepito-btn ${c.status === 'active' ? 'button-1' : 'pepito-btn--ghost'}`}
                    data-testid={
                      c.status === 'active' ? `vet-resume-chat-${c.id}` : `vet-view-chat-${c.id}`
                    }
                  >
                    <MessageCircle size={16} aria-hidden />
                    {c.status === 'active' ? 'ورود به چت' : 'مشاهده گفتگو'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function VetConsultPage() {
  const navigate = useNavigate();
  const { user, token, isLoggedIn, refreshMe, setVetOnline, setVisitFee } = useAuthStore();

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
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
        ? 'آنلاین هستی و آماده پذیرش بیمار — درخواست‌های جدید همین‌جا می‌آیند.'
        : 'برای دریافت درخواست جدید آنلاین شو؛ درخواست‌های در انتظار و بیمارهای فعال همین‌جا می‌مانند.';
    }
    if (needsLogin) return 'برای ارتباط سریع با پزشک وارد حساب شو.';
    if (needsPet) return 'برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.';
    if (noOnlineVets) return 'دامپزشک انسانی آنلاین نیست — با زدن دکمه، دستیار هوشمند رایگان پاسخ می‌دهد.';
    if (lowCoins) {
      return `برای اتصال سریع حداقل ${formatCoins(connectCost)} سکه لازم داری. موجودی: ${formatCoins(coins)} — از ربات «سکه» بگیر.`;
    }
    return 'پزشک‌های آنلاین و مبلغ ویزیت‌شان را ببین، بعد درخواست بفرست.';
  }, [isVetDashboard, vetOnline, needsLogin, needsPet, noOnlineVets, lowCoins, coins, connectCost]);

  async function onSetVetOnline(nextOnline: boolean) {
    if (!token) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (nextOnline) {
      const cred = user?.vetCredentialStatus ?? 'none';
      if (cred === 'none') {
        setError('اول مدرک دامپزشکی را آپلود کن تا پنل فعال شود (از ربات یا پروفایل).');
        return;
      }
      if (cred !== 'verified') {
        setError('مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین می‌توانی آنلاین شوی.');
        return;
      }
    }
    if (onlineBusyRef.current) return;
    if (Boolean(user?.vetOnline) === nextOnline) return;

    onlineBusyRef.current = true;
    setOnlineBusy(true);
    setError(null);

    // Never leave the segmented control disabled forever if the PATCH hangs.
    if (onlineToggleTimerRef.current) clearTimeout(onlineToggleTimerRef.current);
    let timedOut = false;
    onlineToggleTimerRef.current = setTimeout(() => {
      timedOut = true;
      onlineBusyRef.current = false;
      setOnlineBusy(false);
      setError('تغییر وضعیت بیش از حد طول کشید. دوباره تلاش کن.');
    }, 12_000);

    try {
      await setVetOnline(nextOnline);
    } catch (err) {
      if (!timedOut) {
        setError(err instanceof Error ? err.message : 'تغییر وضعیت آنلاین ناموفق بود');
      }
    } finally {
      if (onlineToggleTimerRef.current) {
        clearTimeout(onlineToggleTimerRef.current);
        onlineToggleTimerRef.current = null;
      }
      if (!timedOut) {
        onlineBusyRef.current = false;
        setOnlineBusy(false);
      }
    }
  }

  useEffect(() => {
    return () => {
      if (onlineToggleTimerRef.current) clearTimeout(onlineToggleTimerRef.current);
    };
  }, []);

  async function onSaveVisitFee(fee: number) {
    if (!token) return;
    setFeeBusy(true);
    setError(null);
    try {
      await setVisitFee(fee);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت مبلغ ویزیت ناموفق بود');
    } finally {
      setFeeBusy(false);
    }
  }

  async function onConnect() {
    if (!user?.id) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (pets.length === 0) {
      setError('برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.');
      return;
    }
    // If no human vet is online, API starts a free AI consult — don't block.
    if (patientOnlineVets.length && coins < connectCost) {
      setError(
        `برای اتصال سریع حداقل ${formatCoins(connectCost)} سکه لازم داری.
موجودی: ${formatCoins(coins)} — از ربات «سکه» بگیر.`
      );
      return;
    }

    if (patientOnlineVets.length) {
      const payOk = window.confirm(
        [
          `هزینه این درخواست: ${formatCoins(connectCost)} سکه`,
          `موجودی فعلی: ${formatCoins(coins)} سکه`,
          `پزشک‌های هدف: ${patientOnlineVets.length}`,
          '',
          'با تأیید، سکه از موجودی‌ات کسر می‌شود و درخواست برای پزشک‌های آنلاین ارسال می‌شود.',
          'ادامه می‌دهی؟',
        ].join('\n')
      );
      if (!payOk) return;
    }

    setPhase('sending');
    setError(null);
    setStatusLines(null);
    setActiveConsult(null);
    autoNavRef.current = null;

    try {
      let result;
      try {
        result = await quickVetConnect(user.id, token);
      } catch (err) {
        const needsConfirm =
          err instanceof Error &&
          ((err as Error & { requiresResendConfirm?: boolean }).requiresResendConfirm ||
            /میخوای مجدد/.test(err.message));
        if (needsConfirm) {
          const ok = window.confirm('میخوای مجدد درخواست بدی به اون شخص؟');
          if (!ok) {
            setPhase('ready');
            return;
          }
          result = await quickVetConnect(user.id, token, { confirmResend: true });
        } else {
          throw err;
        }
      }
      setSentCount(result.sent);
      setRequestedIds(result.consultations.map((c) => c.id));
      if (result.aiFallback) {
        const consultId = result.consultations?.[0]?.id;
        setStatusLines([
          result.message,
          'چت با دستیار هوشمند باز شد — می‌توانی سؤال‌ات را بفرستی.',
        ]);
        setPhase('ready');
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
      setStatusLines([
        'درخواستت برای پزشک‌های آنلاین ربات و وب ارسال شد.',
        `پزشک‌های هدف: ${formatCoins(result.sent)}`,
        `سکه کسر شده: ${formatCoins(result.cost)}`,
        `موجودی باقی‌مانده: ${formatCoins(result.coins)}`,
        'در انتظار پذیرش دامپزشک — تا قبول پزشک چت باز نمی‌شود.',
      ]);
      setPhase('waiting');
      try {
        await refreshMe();
      } catch {
        /* wallet chip may lag */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال درخواست');
      setPhase('ready');
    }
  }

  async function onAcceptIncoming(id: number) {
    if (!token) return;
    setActingId(id);
    setError(null);
    try {
      await acceptVetConsultation(id, token);
      navigate(`/vet-chats/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'قبول درخواست ناموفق بود');
    } finally {
      setActingId(null);
    }
  }

  async function onRejectIncoming(id: number) {
    if (!token) return;
    setActingId(id);
    setError(null);
    try {
      await rejectVetConsultation(id, token);
      await loadIncoming();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رد درخواست ناموفق بود');
    } finally {
      setActingId(null);
    }
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
        <h1>{isVetDashboard ? 'پنل دامپزشک' : 'ارتباط سریع با پزشک'}</h1>
        <p className="pepito-vet-lead">{lead}</p>
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

      <section className="pepito-vet-connect-panel" aria-label="ارتباط سریع با پزشک">
        <div className="pepito-vet-consult-cost" role="status">
          <span className="pepito-vet-cost-mark" aria-hidden>
            <Stethoscope size={20} strokeWidth={2} />
          </span>
          <div>
            <strong>هزینه اتصال فوری</strong>
            <span>
              {onlineVetsLoading
                ? 'در حال محاسبه…'
                : noOnlineVets
                  ? 'مشورت با دستیار هوشمند (رایگان)'
                  : `${formatCoins(connectCost)} سکه — قبل از ارسال کسر می‌شود`}
            </span>
          </div>
          {!needsLogin ? (
            <small>
              موجودی: {formatCoins(coins)} سکه
              {lowCoins ? ' — برای ادامه سکه کم داری' : ''}
            </small>
          ) : null}
        </div>

        {needsLogin ? (
          <Link to="/auth/login" className="pepito-btn button-1">
            <PawIcon />
            ورود برای ارتباط با پزشک
          </Link>
        ) : needsPet ? (
          <>
            <p className="pepito-vet-consult-hint">
              هنوز پتی ثبت نکردی.
              <br />
              برای درخواست ارتباط با پزشک، اول باید حداقل یک پت ثبت کنی.
            </p>
            <Link to="/add-pet" className="pepito-btn button-1">
              <PawIcon />
              ثبت پت
            </Link>
          </>
        ) : (
          <button
            type="button"
            className="pepito-btn button-1"
            data-testid="vet-quick-connect"
            disabled={
              phase === 'sending' || petsLoading || onlineVetsLoading || lowCoins
            }
            onClick={() => void onConnect()}
          >
            <PawIcon />
            {phase === 'sending'
              ? 'در حال کسر سکه و ارسال…'
              : noOnlineVets
                ? 'مشورت با دستیار هوشمند'
                : phase === 'waiting' || phase === 'connected'
                  ? 'ارسال دوباره درخواست'
                  : `تأیید پرداخت (${formatCoins(connectCost)} سکه) و اتصال`}
          </button>
        )}

        {lowCoins && !needsLogin && !needsPet ? (
          <a
            className="pepito-btn pepito-btn--ghost pepito-vet-consult-bot"
            href={botUrl}
            target="_blank"
            rel="noreferrer"
          >
            خرید سکه در ربات تلگرام
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
              ⏳ در انتظار پذیرش دامپزشک
            </p>
            <p>
              درخواست برای{' '}
              <strong>{formatCoins(sentCount || requestedIds.length)}</strong> پزشک آنلاین (ربات و
              وب) ارسال شد.
            </p>
            <p>
              تا وقتی یکی از دامپزشک‌ها قبول نکند، چت باز نمی‌شود. بعد از قبول، همین‌جا وارد چت وب
              می‌شوی.
            </p>
          </div>
        ) : null}

        {phase === 'connected' && activeConsult ? (
          <div className="pepito-vet-consult-connected" role="status">
            <p>
              دامپزشک{' '}
              <strong>{activeConsult.vetName?.trim() || `#${activeConsult.vetUserId}`}</strong>{' '}
              درخواست را قبول کرد.
            </p>
            <Link className="pepito-btn button-1" to={`/vet-chats/${activeConsult.id}`}>
              <PawIcon />
              ورود به چت وب با پزشک
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
