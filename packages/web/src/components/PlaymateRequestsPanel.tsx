import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, MessageCircle, RefreshCw, Send, UserRound, X } from 'lucide-react';
import { PetAvatar } from './PetAvatar';
import { RequestCountdown } from './RequestCountdown';
import { formatTimeAgo } from '../data/mock';
import { EMPTY_STATE_PHOTO } from '../data/petImages';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useUserStore } from '../hooks/useUserStore';
import { listPlaydateRequests, updatePlaydateStatus } from '../lib/api';
import { subscribeIncomingRefresh } from '../lib/liveIncoming';
import { playdateToMatchRequest } from '../lib/playdateMap';
import type { MatchRequest } from '../types';

type Tab = 'incoming' | 'sent' | 'accepted';

export interface PlaymateRequestsPanelProps {
  /** When true, skip role empty state (parent already gates pet-owner UX). */
  embedded?: boolean;
  /** Optional initial tab (e.g. from hash deep-link). */
  initialTab?: Tab;
  className?: string;
}

export function PlaymateRequestsPanel({
  embedded = false,
  initialTab = 'incoming',
  className = '',
}: PlaymateRequestsPanelProps) {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [matches, setMatches] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const myUserId = authUser?.id ?? user.id;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const reload = useCallback(async () => {
    if (!myUserId) {
      setMatches([]);
      setLoading(false);
      setError('برای دیدن درخواست‌های همبازی وارد حساب شو.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listPlaydateRequests({ userId: myUserId });
      const mapped = rows
        .filter((r) => {
          const incoming = r.toUserId === myUserId || r.toPet?.ownerId === myUserId;
          const outgoing = r.fromUserId === myUserId || r.fromPet?.ownerId === myUserId;
          if (!incoming && !outgoing) return false;
          if (r.status === 'rejected' || r.status === 'cancelled' || r.status === 'expired') {
            return false;
          }
          return true;
        })
        .map((r) => playdateToMatchRequest(r, myUserId));
      setMatches(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری درخواست‌ها ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [myUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeIncomingRefresh((detail) => {
      if (detail?.kinds && detail.kinds.length > 0 && !detail.kinds.includes('playmate')) {
        return;
      }
      void reload();
    });
  }, [reload]);

  const incomingPending = useMemo(
    () => matches.filter((m) => m.status === 'pending' && m.direction === 'incoming'),
    [matches]
  );
  const sentPending = useMemo(
    () => matches.filter((m) => m.status === 'pending' && m.direction === 'outgoing'),
    [matches]
  );
  const accepted = useMemo(() => matches.filter((m) => m.status === 'accepted'), [matches]);

  const filtered =
    tab === 'incoming' ? incomingPending : tab === 'sent' ? sentPending : accepted;

  async function onAccept(id: number) {
    setBusyId(id); setError(null);
    try {
      if (!myUserId) throw new Error('وارد حساب نشده‌اید');
      await updatePlaydateStatus(id, 'accepted', myUserId);
      navigate(`/chats/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'قبول درخواست ناموفق بود';
      setError(msg); toastError(msg); setBusyId(null);
    }
  }

  async function onReject(id: number) {
    setBusyId(id); setError(null);
    try {
      if (!myUserId) throw new Error('وارد حساب نشده‌اید');
      await updatePlaydateStatus(id, 'rejected', myUserId);
      toastSuccess('درخواست رد شد.');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'رد درخواست ناموفق بود';
      setError(msg); toastError(msg);
    } finally { setBusyId(null); }
  }

  return (
    <div className={`playmate-requests-panel${className ? ` ${className}` : ''}`}>
      {!embedded && (
        <p className="playmate-requests-panel__lead">
          {isLoggedIn
            ? `همگام با ربات · ${incomingPending.length} ورودی جدید`
            : 'برای همگام‌سازی با ربات وارد شو'}
        </p>
      )}

      <div className="match-tabs">
        <button
          type="button"
          className={`match-tab${tab === 'incoming' ? ' active' : ''}`}
          onClick={() => setTab('incoming')}
        >
          <Clock size={14} strokeWidth={2} />
          دریافتی ({incomingPending.length})
        </button>
        <button
          type="button"
          className={`match-tab${tab === 'sent' ? ' active' : ''}`}
          onClick={() => setTab('sent')}
        >
          <Send size={14} strokeWidth={2} />
          ارسالی ({sentPending.length})
        </button>
        <button
          type="button"
          className={`match-tab${tab === 'accepted' ? ' active' : ''}`}
          onClick={() => setTab('accepted')}
        >
          <Check size={14} strokeWidth={2} />
          پذیرفته ({accepted.length})
        </button>
        <button type="button" className="match-tab" onClick={() => void reload()} aria-label="بروزرسانی">
          <RefreshCw size={14} strokeWidth={2} />
        </button>
      </div>

      {error && (
        <p className="auth-error" style={{ margin: '12px 0' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="empty-state">
          <h3>در حال بارگذاری…</h3>
        </div>
      ) : filtered.length > 0 ? (
        <div className="match-list">
          {filtered.map((match) => (
            <article key={match.id} className="match-card">
              <Link to={`/pets/${match.fromPet.id}`} className="match-card-photo">
                <img src={match.fromPet.imageUrl} alt={match.fromPet.name} />
                <div className="match-card-photo-overlay">
                  <strong>{match.fromPet.name}</strong>
                  <span>{match.fromPet.breed}</span>
                </div>
              </Link>
              <div className="match-card-body">
                <div className="match-card-header">
                  <PetAvatar
                    type={match.fromPet.type}
                    size="sm"
                    imageUrl={match.fromPet.imageUrl}
                    name={match.fromPet.name}
                  />
                  <div className="match-info">
                    <h3>
                      {match.rawFromName ?? match.fromPet.name}
                      {' → '}
                      {match.rawToName ?? match.toPet?.name ?? 'پت شما'}
                    </h3>
                    <p>
                      #{match.id} · {match.statusLabel ?? 'در انتظار'} · {formatTimeAgo(match.createdAt)}
                      {match.status === 'pending' ? (
                        <>
                          {' · '}
                          <RequestCountdown createdAt={match.createdAt} onExpire={() => void reload()} />
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                {match.direction === 'incoming' && match.status === 'pending' && (
                  <p className="match-msg">
                    درخواست همبازی جدید از طرف <strong>{match.fromPet.name}</strong>
                    {match.toPet?.name ? ` برای ${match.toPet.name}` : ''}
                  </p>
                )}
                {match.direction === 'outgoing' && match.status === 'pending' && (
                  <p className="match-msg">منتظر پاسخ صاحب {match.fromPet.name} باش.</p>
                )}
                {match.message && <p className="match-msg">«{match.message}»</p>}

                {match.status === 'pending' && match.direction === 'incoming' ? (
                  <div className="match-actions">
                    <button
                      type="button"
                      className="btn-accept"
                      disabled={busyId === match.id}
                      onClick={() => void onAccept(match.id)}
                    >
                      <Check size={16} strokeWidth={2.5} />
                      {busyId === match.id ? '…' : 'قبول'}
                    </button>
                    <button
                      type="button"
                      className="btn-reject"
                      disabled={busyId === match.id}
                      onClick={() => void onReject(match.id)}
                    >
                      <X size={16} strokeWidth={2.5} />
                      رد
                    </button>
                    <Link
                      to={`/chats/${match.id}?info=owner`}
                      className="btn-profile"
                    >
                      <UserRound size={16} strokeWidth={2} />
                      پروفایل صاحب پت
                    </Link>
                    <Link to={`/chats/${match.id}`} className="btn-profile">
                      <MessageCircle size={16} strokeWidth={2} />
                      مشاهده در چت
                    </Link>
                  </div>
                ) : match.status === 'accepted' ? (
                  <div className="match-actions">
                    <Link to={`/chats/${match.id}`} className="btn-accept">
                      <MessageCircle size={16} strokeWidth={2} />
                      باز کردن چت
                    </Link>
                    <Link to={`/pets/${match.fromPet.id}`} className="btn-profile">
                      پروفایل پت
                    </Link>
                  </div>
                ) : match.status === 'pending' ? (
                  <div className="match-actions">
                    <Link to={`/chats/${match.id}`} className="btn-accept">
                      <MessageCircle size={16} strokeWidth={2} />
                      مشاهده در چت
                    </Link>
                    <Link to={`/pets/${match.fromPet.id}`} className="btn-profile">
                      پروفایل
                    </Link>
                  </div>
                ) : (
                  <div className="match-actions">
                    <span className="match-status-pill">{match.statusLabel}</span>
                    <Link to={`/pets/${match.fromPet.id}`} className="btn-profile">
                      پروفایل
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state playmate-requests-panel__empty">
          <img src={EMPTY_STATE_PHOTO} alt="" className="empty-photo" />
          <h3>
            {tab === 'incoming'
              ? 'درخواست جدیدی نیست'
              : tab === 'sent'
                ? 'هنوز درخواستی نفرستادی'
                : 'هنوز مچی نداری'}
          </h3>
          <p>
            از دکمه «پیدا کردن همبازی» بالا شروع کن — درخواست‌ها همین‌جا همگام می‌شن.
          </p>
        </div>
      )}

    </div>
  );
}
