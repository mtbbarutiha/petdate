import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, Clock, MessageCircle, X } from 'lucide-react';
import {
  SITTER_CONNECT_COST,
  TRAINER_CONSULT_COST,
  VET_CREDENTIAL_STATUS_LABELS,
  formatPersianDateTime,
  isPrimaryRole,
  toPersianDigits,
  type ConsultServiceKind,
  type PetProfile,
  type User,
  type VetConsultation,
  type VetCredentialStatus,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
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

type Kind = Extract<ConsultServiceKind, 'trainer' | 'sitter'>;

const COST: Record<Kind, number> = {
  trainer: TRAINER_CONSULT_COST,
  sitter: SITTER_CONNECT_COST,
};

const COPY: Record<
  Kind,
  {
    title: string;
    role: 'trainer' | 'pet_sitter';
    patientCta: string;
    providerHint: string;
    noProviders: string;
    needPet: string;
    disclaimer?: string;
  }
> = {
  trainer: {
    title: 'پنل مربی',
    role: 'trainer',
    patientCta: 'درخواست مربی',
    providerHint: 'آنلاین شو تا درخواست‌های مشاوره مربی را بگیری.',
    noProviders: 'فعلاً مربی آنلاینی برای اتصال پیدا نشد.',
    needPet: 'برای درخواست مربی، اول باید حداقل یک پت ثبت کنی.',
  },
  sitter: {
    title: 'پنل پرستار پت',
    role: 'pet_sitter',
    patientCta: 'درخواست پرستار پت',
    providerHint: 'آنلاین شو تا درخواست‌های پرستار را بگیری.',
    noProviders: 'فعلاً پرستار پت آنلاینی برای اتصال پیدا نشد.',
    needPet: 'برای ارتباط با پرستار، اول باید حداقل یک پت ثبت کنی.',
    disclaimer:
      'پت‌دیت فقط شما را به پرستار متصل می‌کند و مسئولیتی فراتر از اتصال ندارد.',
  },
};

function formatCoins(n: number): string {
  return toPersianDigits(String(n));
}

function credentialLabel(status?: VetCredentialStatus | null): string {
  const key: VetCredentialStatus =
    status && status in VET_CREDENTIAL_STATUS_LABELS ? status : 'none';
  return VET_CREDENTIAL_STATUS_LABELS[key];
}

function patientLabel(c: VetConsultation): string {
  const name = c.patientName?.trim() || `کاربر #${c.patientUserId}`;
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

function providerPeerLabel(c: VetConsultation): string {
  const name = c.vetName?.trim() || `کاربر #${c.vetUserId}`;
  const pet = c.petName?.trim();
  return pet ? `${name} · ${pet}` : name;
}

function consultStatusLabel(status: VetConsultation['status']): {
  text: string;
  tone: 'wait' | 'active' | 'done';
} {
  switch (status) {
    case 'requested':
      return { text: 'در انتظار پاسخ', tone: 'wait' };
    case 'active':
      return { text: 'گفتگوی فعال', tone: 'active' };
    case 'completed':
      return { text: 'پایان‌یافته', tone: 'done' };
    case 'cancelled':
      return { text: 'لغو شده', tone: 'done' };
    case 'expired':
      return { text: 'منقضی شده', tone: 'done' };
    default:
      return { text: 'گفتگو', tone: 'done' };
  }
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

export function ServiceConsultPage({ kind }: { kind: Kind }) {
  const navigate = useNavigate();
  const { user, token, isLoggedIn, refreshMe } = useAuthStore();
  const meta = COPY[kind];
  const cost = COST[kind];
  /** فقط نقش فعال ارائه‌دهنده — نه داشتن نقش فرعی (صاحب‌پت چندنقشی نباید پنل مدرک ببیند). */
  const isProvider = isPrimaryRole(user, meta.role);
  const credStatus =
    kind === 'trainer' ? user?.trainerCredentialStatus : user?.sitterCredentialStatus;
  const online =
    kind === 'trainer' ? Boolean(user?.trainerOnline) : Boolean(user?.sitterOnline);
  const verified = credStatus === 'verified';
  const coins = user?.coins ?? user?.wallet?.coins ?? 0;
  const botUrl = telegramBotDeepLink();

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [onlineProviders, setOnlineProviders] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState(false);
  const [needsResendConfirm, setNeedsResendConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<VetConsultation[]>([]);
  const [recent, setRecent] = useState<VetConsultation[]>([]);
  const [actingId, setActingId] = useState<number | null>(null);

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
    if (!token) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (next && !verified) {
      setError(
        credStatus === 'pending'
          ? 'مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین آنلاین شو.'
          : 'اول مدرک را همین‌جا یا در ربات آپلود کن تا پنل فعال شود.'
      );
      return;
    }
    setOnlineBusy(true);
    setError(null);
    try {
      await patchWebProviderOnline(token, kind, next);
      await refreshMe();
    } catch (err) {
      setError(errMessage(err, 'تغییر وضعیت ناموفق بود'));
    } finally {
      setOnlineBusy(false);
    }
  }

  async function onUploadCredential(file: File | null | undefined) {
    if (!token) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      await uploadProviderCredential(token, kind, file);
      await refreshMe();
      setStatusMsg('مدرک ارسال شد و در صف تأیید ادمین است. بعد از تأیید می‌توانی آنلاین شوی.');
    } catch (err) {
      setError(errMessage(err, 'آپلود مدرک ناموفق بود'));
    } finally {
      setUploadBusy(false);
    }
  }

  function validatePatient(): string | null {
    if (!user?.id || !token) return 'اول وارد حساب شو.';
    if (!pets.length) return meta.needPet;
    const others = onlineProviders.filter((p) => p.id !== user.id);
    // No human online → API starts free AI consult (trainer/vet). Don't block.
    if (!others.length) return null;
    if (coins < cost) {
      return `حداقل ${formatCoins(cost)} سکه لازم است. موجودی: ${formatCoins(coins)}`;
    }
    return null;
  }

  async function sendRequest(confirmResend = false) {
    if (!user?.id || !token) {
      setError('اول وارد حساب شو.');
      return;
    }
    const gate = validatePatient();
    if (gate) {
      setError(gate);
      setConfirmPay(false);
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      let res;
      try {
        res = await quickVetConnect(user.id, token, { kind, confirmResend });
      } catch (err) {
        const needsConfirm =
          err instanceof Error &&
          ((err as Error & { requiresResendConfirm?: boolean }).requiresResendConfirm ||
            /میخوای مجدد/.test(err.message));
        if (needsConfirm && !confirmResend) {
          setNeedsResendConfirm(true);
          setConfirmPay(true);
          setError('درخواست قبلی منقضی شده. برای ارسال مجدد دوباره تأیید کن.');
          return;
        }
        throw err;
      }
      await refreshMe();
      await loadLists();
      await loadOnline();
      setConfirmPay(false);
      setNeedsResendConfirm(false);
      setStatusMsg(res.message);
      if (res.aiFallback) {
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
      setError(errMessage(err, 'ارسال درخواست ناموفق بود'));
    } finally {
      setBusy(false);
    }
  }

  async function onPrimaryClick() {
    setError(null);
    setStatusMsg(null);
    const gate = validatePatient();
    if (gate) {
      setError(gate);
      setConfirmPay(false);
      return;
    }
    const humanOnline = onlineProviders.filter((p) => p.id !== user?.id).length > 0;
    if (!humanOnline) {
      await sendRequest(needsResendConfirm);
      return;
    }
    if (!confirmPay) {
      setConfirmPay(true);
      return;
    }
    await sendRequest(needsResendConfirm);
  }

  async function onAccept(id: number) {
    if (!token) return;
    setActingId(id);
    try {
      await acceptVetConsultation(id, token);
      await loadLists();
      navigate(`/vet-chats/${id}`);
    } catch (err) {
      setError(errMessage(err, 'قبول درخواست ناموفق بود'));
    } finally {
      setActingId(null);
    }
  }

  async function onReject(id: number) {
    if (!token) return;
    setActingId(id);
    try {
      await rejectVetConsultation(id, token);
      await loadLists();
    } catch (err) {
      setError(errMessage(err, 'رد درخواست ناموفق بود'));
    } finally {
      setActingId(null);
    }
  }

  const onlineCount = onlineProviders.filter((p) => p.id !== user?.id).length;

  return (
    <div className="pepito-vet-consult" dir="rtl">
      <header className="pepito-vet-consult-head">
        <h1>{isProvider ? meta.title : meta.patientCta}</h1>
        <p>
          {isProvider
            ? meta.providerHint
            : `هزینه اتصال انسانی ${formatCoins(cost)} سکه · اگر آنلاین نباشد دستیار هوشمند رایگان پاسخ می‌دهد`}
        </p>
        {meta.disclaimer && !isProvider ? <p className="muted">{meta.disclaimer}</p> : null}
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
            وضعیت مدرک: <strong>{credentialLabel(credStatus)}</strong>
          </p>
          {!verified ? (
            <div className="pepito-provider-cred-upload">
              <p>
                برای فعال‌شدن پنل، مدرک را آپلود کن و منتظر تأیید ادمین بمان
                {credStatus === 'pending' ? ' — مدرکت در صف بررسی است.' : '.'}
              </p>
              <label className="pepito-btn button-1 pepito-provider-cred-label">
                {uploadBusy
                  ? 'در حال آپلود…'
                  : credStatus === 'pending'
                    ? 'ارسال مجدد مدرک'
                    : 'آپلود مدرک'}
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
                یا از{' '}
                <a href={botUrl} target="_blank" rel="noreferrer">
                  ربات تلگرام
                </a>{' '}
                هم می‌توانی بفرستی.
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
              <Circle size={14} /> آنلاین
            </button>
            <button
              type="button"
              className={`pepito-vet-online-seg-btn${!online ? ' is-active is-offline' : ''}`}
              disabled={onlineBusy}
              data-testid={`${kind}-online-toggle-off`}
              onClick={() => void onToggleOnline(false)}
            >
              آفلاین
            </button>
          </div>
        </section>
      ) : null}

      {!isProvider ? (
        <section className="pepito-vet-consult-cta">
          <p className="pepito-vet-consult-hint" data-testid={`${kind}-online-count`}>
            {isLoggedIn
              ? onlineCount > 0
                ? `${toPersianDigits(String(onlineCount))} نفر آنلاین آماده پذیرش`
                : kind === 'trainer'
                  ? 'مربی انسانی آنلاین نیست — با زدن دکمه، دستیار هوشمند آموزش پاسخ می‌دهد (رایگان).'
                  : meta.noProviders
              : 'برای ارسال درخواست وارد حساب شو.'}
          </p>
          {!isLoggedIn ? (
            <Link to="/auth/login" className="pepito-btn button-1">
              ورود
            </Link>
          ) : (
            <>
              {confirmPay && onlineCount > 0 ? (
                <p className="pepito-vet-consult-hint" role="status">
                  تأیید نهایی: {formatCoins(cost)} سکه از موجودی کسر می‌شود
                  {meta.disclaimer ? ` — ${meta.disclaimer}` : ''}.
                </p>
              ) : null}
              <button
                type="button"
                className="pepito-btn button-1"
                disabled={busy}
                data-testid={`${kind}-request-cta`}
                onClick={() => void onPrimaryClick()}
              >
                {busy
                  ? 'در حال ارسال…'
                  : onlineCount === 0 && kind === 'trainer'
                    ? 'مشورت با دستیار هوشمند (رایگان)'
                    : confirmPay
                      ? `تأیید و ارسال (${formatCoins(cost)} سکه)`
                      : `${meta.patientCta} (${formatCoins(cost)} سکه)`}
              </button>
              {confirmPay && onlineCount > 0 ? (
                <button
                  type="button"
                  className="pepito-btn pepito-btn--ghost"
                  disabled={busy}
                  onClick={() => setConfirmPay(false)}
                >
                  انصراف
                </button>
              ) : null}
              {!pets.length ? (
                <Link to="/add-pet" className="pepito-btn pepito-btn--ghost">
                  ثبت پت
                </Link>
              ) : null}
              {coins < cost ? (
                <Link to="/wallet" className="pepito-btn pepito-btn--ghost">
                  شارژ سکه
                </Link>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {isProvider ? (
        <div className="pepito-vet-inbox-stack">
          <section
            className="pepito-vet-inbox-panel pepito-vet-inbox-panel--incoming"
            aria-label="درخواست‌های ورودی"
            data-testid={`${kind}-incoming-inbox`}
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
                  <li key={c.id} data-testid={`${kind}-incoming-${c.id}`}>
                    <div className="pepito-vet-row-info">
                      <strong>{patientLabel(c)}</strong>
                      <span className="pepito-vet-status">
                        <Clock size={12} aria-hidden />
                        در انتظار پاسخ
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
                        قبول و چت
                      </button>
                      <button
                        type="button"
                        className="pepito-btn pepito-btn--ghost pepito-vet-reject"
                        disabled={actingId === c.id}
                        onClick={() => void onReject(c.id)}
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
            aria-label="گفتگوهای اخیر"
            data-testid={`${kind}-recent-chats`}
          >
            <header className="pepito-vet-inbox-head">
              <div>
                <p className="pepito-eyebrow">گفتگو</p>
                <h2>گفتگوهای اخیر</h2>
              </div>
            </header>
            {recent.length === 0 ? (
              <p className="pepito-vet-consult-hint">هنوز گفتگویی ثبت نشده.</p>
            ) : (
              <ul className="pepito-vet-consult-incoming-list">
                {recent.map((c) => {
                  const st = consultStatusLabel(c.status);
                  const canChat = c.status === 'active' || c.status === 'completed';
                  return (
                    <li key={c.id} data-testid={`${kind}-recent-${c.id}`}>
                      <div className="pepito-vet-row-info">
                        <strong>{patientLabel(c)}</strong>
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
                              c.status === 'active' ? 'button-1' : 'pepito-btn--ghost'
                            }`}
                            data-testid={`${kind}-open-chat-${c.id}`}
                          >
                            <MessageCircle size={16} aria-hidden />
                            {c.status === 'active' ? 'ورود به چت' : 'مشاهده گفتگو'}
                          </Link>
                        ) : (
                          <span className="pepito-vet-consult-hint">چت باز نیست</span>
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
          aria-label="درخواست‌های من"
          data-testid={`${kind}-my-requests`}
        >
          <header className="pepito-vet-inbox-head">
            <div>
              <p className="pepito-eyebrow">درخواست‌ها</p>
              <h2>درخواست‌های من</h2>
            </div>
          </header>
          {recent.length === 0 ? (
            <p className="pepito-vet-consult-hint">هنوز درخواستی نفرستاده‌ای.</p>
          ) : (
            <ul className="pepito-vet-consult-incoming-list">
              {recent.map((c) => {
                const st = consultStatusLabel(c.status);
                const canChat = c.status === 'active' || c.status === 'completed';
                return (
                  <li key={c.id}>
                    <div className="pepito-vet-row-info">
                      <strong>{providerPeerLabel(c)}</strong>
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
                            c.status === 'active' ? 'button-1' : 'pepito-btn--ghost'
                          }`}
                        >
                          <MessageCircle size={16} aria-hidden />
                          {c.status === 'active' ? 'ورود به چت' : 'مشاهده گفتگو'}
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

export function SitterConsultPage() {
  return <ServiceConsultPage kind="sitter" />;
}
