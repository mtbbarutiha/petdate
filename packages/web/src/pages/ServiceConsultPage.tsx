import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, Clock, MessageCircle, X } from 'lucide-react';
import {
  SEEKER_ADVICE_COST,
  SITTER_CONNECT_COST,
  TRAINER_CONSULT_COST,
  VET_CREDENTIAL_STATUS_LABELS,
  formatPersianDateTime,
  isPrimaryRole,
  toPersianDigits,
  userHasRole,
  type ConsultServiceKind,
  type PetProfile,
  type VetConsultation,
  type VetCredentialStatus,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
import {
  acceptVetConsultation,
  listPets,
  listVetConsultations,
  patchWebProviderOnline,
  quickVetConnect,
  rejectVetConsultation,
  telegramBotDeepLink,
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
    disclaimer?: string;
  }
> = {
  trainer: {
    title: 'پنل مربی',
    role: 'trainer',
    patientCta: 'درخواست مربی',
    providerHint: 'آنلاین شو تا درخواست‌های مشاوره مربی را بگیری.',
    noProviders: 'فعلاً مربی آنلاینی نیست.',
  },
  sitter: {
    title: 'پنل پرستار پت',
    role: 'pet_sitter',
    patientCta: 'درخواست پرستار پت',
    providerHint: 'آنلاین شو تا درخواست‌های پرستار را بگیری.',
    noProviders: 'فعلاً پرستار آنلاینی نیست.',
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

export function ServiceConsultPage({ kind }: { kind: Kind }) {
  const navigate = useNavigate();
  const { user, token, isLoggedIn, refreshMe } = useAuthStore();
  const meta = COPY[kind];
  const cost = COST[kind];
  const isProvider = isPrimaryRole(user, meta.role);
  const hasRole = userHasRole(user, meta.role);
  const credStatus =
    kind === 'trainer' ? user?.trainerCredentialStatus : user?.sitterCredentialStatus;
  const online =
    kind === 'trainer' ? Boolean(user?.trainerOnline) : Boolean(user?.sitterOnline);
  const verified = credStatus === 'verified';
  const coins = user?.coins ?? user?.wallet?.coins ?? 0;
  const botUrl = telegramBotDeepLink();

  const [pets, setPets] = useState<PetProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
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

  const loadLists = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (isProvider) {
        const rows = await listVetConsultations({
          vetUserId: user.id,
          kind,
        });
        setIncoming(rows.filter((r) => r.status === 'requested'));
        setRecent(rows.filter((r) => r.status !== 'requested').slice(0, 12));
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
  }, [loadPets, loadLists]);

  useLiveAjaxPoll(loadLists, {
    enabled: Boolean(user?.id),
    intervalMs: 8_000,
  });
  useEffect(() => subscribeIncomingRefresh(() => void loadLists()), [loadLists]);

  async function onToggleOnline(next: boolean) {
    if (!token) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (next && !verified) {
      setError(
        credStatus === 'none'
          ? 'اول مدرک را از ربات آپلود کن تا پنل فعال شود.'
          : 'مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین آنلاین شو.'
      );
      return;
    }
    setOnlineBusy(true);
    setError(null);
    try {
      await patchWebProviderOnline(token, kind, next);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر وضعیت ناموفق بود');
    } finally {
      setOnlineBusy(false);
    }
  }

  async function onConnect() {
    if (!user?.id || !token) {
      setError('اول وارد حساب شو.');
      return;
    }
    if (!pets.length) {
      setError('اول حداقل یک پت ثبت کن.');
      return;
    }
    if (coins < cost) {
      setError(`حداقل ${formatCoins(cost)} سکه لازم است. موجودی: ${formatCoins(coins)}`);
      return;
    }
    const ok = window.confirm(
      [
        `${meta.patientCta}`,
        `هزینه: ${formatCoins(cost)} سکه`,
        meta.disclaimer || '',
        'ادامه می‌دهی؟',
      ]
        .filter(Boolean)
        .join('\n')
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await quickVetConnect(user.id, token, { kind });
      await refreshMe();
      await loadLists();
      window.alert(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال درخواست ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function onAccept(id: number) {
    if (!token) return;
    setActingId(id);
    try {
      await acceptVetConsultation(id, token);
      await loadLists();
      navigate(`/vet-chats/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'قبول درخواست ناموفق بود');
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
      setError(err instanceof Error ? err.message : 'رد درخواست ناموفق بود');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="pepito-vet-consult" dir="rtl">
      <header className="pepito-vet-consult-head">
        <h1>{isProvider ? meta.title : meta.patientCta}</h1>
        <p>
          {isProvider
            ? meta.providerHint
            : `هزینه ${formatCoins(cost)} سکه · بدون اتصال پزشک`}
        </p>
        {meta.disclaimer && !isProvider ? <p className="muted">{meta.disclaimer}</p> : null}
      </header>

      {error ? <p className="pepito-vet-consult-error">{error}</p> : null}

      {isProvider || hasRole ? (
        <section className="pepito-vet-online-card">
          <p>
            وضعیت مدرک: <strong>{credentialLabel(credStatus)}</strong>
          </p>
          {!verified ? (
            <p>
              برای فعال‌شدن پنل، مدرک را در{' '}
              <a href={botUrl} target="_blank" rel="noreferrer">
                ربات تلگرام
              </a>{' '}
              آپلود کن و منتظر تأیید ادمین بمان.
            </p>
          ) : null}
          <div className="pepito-vet-online-seg">
            <button
              type="button"
              className={`pepito-vet-online-seg-btn${online ? ' is-active is-online' : ''}`}
              disabled={onlineBusy || !verified}
              onClick={() => void onToggleOnline(true)}
            >
              <Circle size={14} /> آنلاین
            </button>
            <button
              type="button"
              className={`pepito-vet-online-seg-btn${!online ? ' is-active is-offline' : ''}`}
              disabled={onlineBusy}
              onClick={() => void onToggleOnline(false)}
            >
              آفلاین
            </button>
          </div>
        </section>
      ) : null}

      {!isProvider ? (
        <section className="pepito-vet-consult-cta">
          {!isLoggedIn ? (
            <Link to="/auth/login" className="pepito-btn button-1">
              ورود
            </Link>
          ) : (
            <button
              type="button"
              className="pepito-btn button-1"
              disabled={busy}
              onClick={() => void onConnect()}
            >
              {busy ? 'در حال ارسال…' : `${meta.patientCta} (${formatCoins(cost)} سکه)`}
            </button>
          )}
        </section>
      ) : null}

      {isProvider && incoming.length > 0 ? (
        <section>
          <h2>درخواست‌های جدید</h2>
          <ul className="pepito-vet-consult-incoming-list">
            {incoming.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{patientLabel(c)}</strong>
                  {c.createdAt ? <small>{formatPersianDateTime(c.createdAt)}</small> : null}
                </div>
                <div className="pepito-vet-consult-incoming-actions">
                  <button
                    type="button"
                    className="pepito-btn button-1"
                    disabled={actingId === c.id}
                    onClick={() => void onAccept(c.id)}
                  >
                    <Check size={16} /> قبول
                  </button>
                  <button
                    type="button"
                    className="pepito-btn pepito-btn--ghost"
                    disabled={actingId === c.id}
                    onClick={() => void onReject(c.id)}
                  >
                    <X size={16} /> رد
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>{isProvider ? 'گفتگوهای اخیر' : 'درخواست‌های من'}</h2>
        {!recent.length ? (
          <p className="muted">موردی نیست.</p>
        ) : (
          <ul className="pepito-vet-consult-incoming-list">
            {recent.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{patientLabel(c)}</strong>
                  <small>
                    <Clock size={12} /> {c.status}
                  </small>
                </div>
                <Link to={`/vet-chats/${c.id}`} className="pepito-btn pepito-btn--ghost">
                  <MessageCircle size={16} /> چت
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isProvider ? (
        <p className="muted">
          هزینه مشورت خرید از صاحب پت: {formatCoins(SEEKER_ADVICE_COST)} سکه — از منوی دنبال پت.
        </p>
      ) : null}
    </div>
  );
}

export function TrainerConsultPage() {
  return <ServiceConsultPage kind="trainer" />;
}

export function SitterConsultPage() {
  return <ServiceConsultPage kind="sitter" />;
}
