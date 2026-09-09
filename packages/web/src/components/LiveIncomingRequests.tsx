import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, HeartHandshake, Stethoscope, X } from 'lucide-react';
import { userHasRole, type VetConsultation } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppToast } from '../hooks/useAppToast';
import { useChatSocket } from '../hooks/useChatSocket';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
import {
  acceptVetConsultation,
  listPlaydateRequests,
  listVetConsultations,
  rejectVetConsultation,
  updatePlaydateStatus,
} from '../lib/api';
import { emitIncomingRefresh } from '../lib/liveIncoming';
import { isIncomingPlaydate } from '../lib/playdateMap';

/**
 * Backup ajax even when WebSocket is up — CDN/idle tabs drop inbox events.
 * Offline poll is faster because pending playmate TTL is only 2 minutes.
 */
const WS_BACKUP_POLL_MS = 12_000;
const OFFLINE_POLL_MS = 8_000;

type IncomingItem =
  | { kind: 'playmate'; id: number; title: string; subtitle: string; photo?: string; href: string }
  | { kind: 'vet'; id: number; title: string; subtitle: string; photo?: string; href: string };

function seenStorageKey(userId: number) {
  return `petdate:incoming-seen:${userId}`;
}

function loadSeenKeys(userId: number): Set<string> {
  try {
    const raw = sessionStorage.getItem(seenStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === 'string'));
  } catch {
    return new Set();
  }
}

function saveSeenKeys(userId: number, keys: Set<string>) {
  try {
    sessionStorage.setItem(seenStorageKey(userId), JSON.stringify([...keys]));
  } catch {
    /* private mode / quota — in-memory still works for this tab */
  }
}

function isConversationPath(pathname: string, item: IncomingItem): boolean {
  if (item.kind === 'playmate') {
    return pathname === item.href || pathname === `/chats/${item.id}`;
  }
  return pathname === item.href || pathname === `/vet-chats/${item.id}`;
}

/**
 * Live incoming playmate / vet requests.
 *
 * Primary surface is گفتگو (conversation thread + inbox), not a desktop-only
 * chrome. Fresh requests open `/chats/:id` or `/vet-chats/:id` where the
 * in-thread request card already has accept/reject. A modal is only a
 * fallback when something was queued by an older client path.
 *
 * Seen keys live in sessionStorage so a mount/WS race cannot swallow the
 * request that triggered the first poll (previous seededRef bug).
 */
export function LiveIncomingRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoggedIn, token } = useAuthStore();
  const { toastError, toastSuccess } = useAppToast();
  const myUserId = user?.id;
  const canPlaymate = Boolean(myUserId && userHasRole(user, 'pet_owner'));
  const canVet = Boolean(myUserId && userHasRole(user, 'vet'));
  const seenRef = useRef<Set<string>>(new Set());
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;
  const [queue, setQueue] = useState<IncomingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = queue[0] ?? null;

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setError(null);
  }, []);

  useEffect(() => {
    seenRef.current = myUserId ? loadSeenKeys(myUserId) : new Set();
    setQueue([]);
    setError(null);
  }, [myUserId, canPlaymate, canVet]);

  const openOnConversation = useCallback(
    (item: IncomingItem) => {
      emitIncomingRefresh({
        kinds: [item.kind],
        ids: [item.id],
      });
      if (isConversationPath(locationRef.current, item)) {
        // Already on this گفتگو thread — inbox/thread soft-reload is enough.
        return;
      }
      navigate(item.href);
    },
    [navigate],
  );

  const poll = useCallback(async () => {
    if (!isLoggedIn || !myUserId) return;
    try {
      // Merge session seen before diffing so a fast first poll cannot
      // re-open requests already handled earlier in this browser session.
      for (const key of loadSeenKeys(myUserId)) seenRef.current.add(key);

      const items: IncomingItem[] = [];

      if (canPlaymate) {
        const playdates = await listPlaydateRequests({
          userId: myUserId,
          status: 'pending',
        });
        for (const r of playdates) {
          if (r.status !== 'pending' || !isIncomingPlaydate(r, myUserId)) continue;
          const fromName = r.fromPet?.name ?? 'یک پت';
          const toName = r.toPet?.name;
          items.push({
            kind: 'playmate',
            id: r.id,
            title: toName ? `${fromName} → ${toName}` : fromName,
            subtitle: r.message?.trim()
              ? `درخواست همبازی — «${r.message.trim()}»`
              : 'درخواست همبازی تازه رسید.',
            photo: r.fromPet?.imageUrl,
            href: `/chats/${r.id}`,
          });
        }
      }

      if (canVet) {
        const consults = await listVetConsultations({
          vetUserId: myUserId,
          status: 'requested',
        }).catch(() => [] as VetConsultation[]);
        for (const c of consults) {
          if (c.status !== 'requested' || c.vetUserId !== myUserId) continue;
          const who =
            c.patientName?.trim() ||
            (c.petName ? `بیمار · ${c.petName}` : `بیمار #${c.patientUserId}`);
          items.push({
            kind: 'vet',
            id: c.id,
            title: who,
            subtitle: c.petName
              ? `درخواست مشاوره دامپزشکی · ${c.petName}`
              : 'درخواست مشاوره دامپزشکی تازه رسید.',
            href: `/vet-chats/${c.id}`,
          });
        }
      }

      const liveKeys = new Set(items.map((i) => `${i.kind}:${i.id}`));
      for (const key of [...seenRef.current]) {
        if (!liveKeys.has(key)) seenRef.current.delete(key);
      }

      const fresh = items.filter((i) => !seenRef.current.has(`${i.kind}:${i.id}`));
      if (!fresh.length) {
        saveSeenKeys(myUserId, seenRef.current);
        return;
      }

      for (const i of fresh) seenRef.current.add(`${i.kind}:${i.id}`);
      saveSeenKeys(myUserId, seenRef.current);

      emitIncomingRefresh({
        kinds: [
          ...(fresh.some((i) => i.kind === 'playmate') ? (['playmate'] as const) : []),
          ...(fresh.some((i) => i.kind === 'vet') ? (['vet'] as const) : []),
        ],
        ids: fresh.map((i) => i.id),
      });

      // Newest → open on گفتگو (thread request card), not desktop-only modal.
      const primary = fresh[fresh.length - 1]!;
      openOnConversation(primary);

      // Extra simultaneous requests stay visible in the /chats inbox list.
    } catch {
      /* silent */
    }
  }, [isLoggedIn, myUserId, canPlaymate, canVet, openOnConversation]);

  const { connected: wsConnected } = useChatSocket({
    token,
    enabled: Boolean(isLoggedIn && token && myUserId && (canPlaymate || canVet)),
    onEvent: (event) => {
      if (event.type === 'inbox') {
        void poll();
      }
    },
  });

  // Always poll as a safety net — do not disable when WS reports connected.
  // runOnEnable so the first check is immediate (2‑minute request TTL).
  useLiveAjaxPoll(poll, {
    enabled: Boolean(isLoggedIn && myUserId && (canPlaymate || canVet)),
    intervalMs: wsConnected ? WS_BACKUP_POLL_MS : OFFLINE_POLL_MS,
    runOnEnable: true,
  });

  async function onAccept() {
    if (!current || !myUserId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (current.kind === 'playmate') {
        await updatePlaydateStatus(current.id, 'accepted', myUserId);
        emitIncomingRefresh({ kinds: ['playmate'], ids: [current.id] });
      } else {
        await acceptVetConsultation(current.id, token);
        emitIncomingRefresh({ kinds: ['vet'], ids: [current.id] });
      }
      const href = current.href;
      dismissCurrent();
      navigate(href);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'قبول درخواست ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!current || !myUserId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (current.kind === 'playmate') {
        await updatePlaydateStatus(current.id, 'rejected', myUserId);
        emitIncomingRefresh({ kinds: ['playmate'], ids: [current.id] });
      } else {
        await rejectVetConsultation(current.id, token);
        emitIncomingRefresh({ kinds: ['vet'], ids: [current.id] });
      }
      dismissCurrent();
      toastSuccess('درخواست رد شد.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'رد درخواست ناموفق بود'; setError(msg); toastError(msg);
    } finally {
      setBusy(false);
    }
  }

  function onOpenInChat() {
    if (!current) return;
    const href = current.href;
    dismissCurrent();
    navigate(href);
  }

  function onViewAll() {
    dismissCurrent();
    // گفتگو hub — not explore / vet-consult desktop panels
    navigate('/chats');
  }

  // Modal kept only if something was queued by an older client path.
  if (!current) return null;

  return (
    <div
      className="modal-overlay live-incoming-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-incoming-title"
    >
      <div className="modal-sheet live-incoming-sheet">
        {current.photo ? (
          <div className="live-incoming-photo">
            <img src={current.photo} alt="" />
          </div>
        ) : (
          <div className="live-incoming-photo live-incoming-photo--icon" aria-hidden>
            {current.kind === 'vet' ? (
              <Stethoscope size={36} strokeWidth={1.75} />
            ) : (
              <HeartHandshake size={36} strokeWidth={1.75} />
            )}
          </div>
        )}
        <div className="live-incoming-body">
          <p className="live-incoming-kicker">
            {current.kind === 'vet' ? 'درخواست مشاوره جدید' : 'درخواست همبازی جدید'}
          </p>
          <h2 id="live-incoming-title">{current.title}</h2>
          <p className="live-incoming-subtitle">{current.subtitle}</p>
        </div>
        {error ? (
          <p className="auth-error live-incoming-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="match-actions live-incoming-actions">
          <div className="live-incoming-actions__primary">
            <button
              type="button"
              className="btn-accept"
              disabled={busy}
              onClick={() => void onAccept()}
            >
              <Check size={16} strokeWidth={2.5} />
              {busy ? '…' : 'قبول'}
            </button>
            <button
              type="button"
              className="btn-reject"
              disabled={busy}
              onClick={() => void onReject()}
            >
              <X size={16} strokeWidth={2.5} />
              رد
            </button>
          </div>
          <div className="live-incoming-actions__secondary">
            <button type="button" className="btn-profile" disabled={busy} onClick={onOpenInChat}>
              مشاهده در گفتگو
            </button>
            <button type="button" className="btn-profile" disabled={busy} onClick={onViewAll}>
              همه گفتگوها
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
