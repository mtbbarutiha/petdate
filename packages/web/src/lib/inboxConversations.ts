import type { User, UserRole, VetConsultation } from '@petdate/shared';
import { makeUserPublicId, primaryRole, toUserCommandId, userHasRole } from '@petdate/shared';
import type { MatchRequest, Pet } from '../types';
import {
  acceptVetConsultation,
  listPlaydateRequests,
  listVetConsultations,
  rejectVetConsultation,
  updatePlaydateStatus,
} from './api';
import { playdateToMatchRequest } from './playdateMap';

export type InboxKind = 'playmate' | 'vet';

/** Scope of chats tied to the active primary role (no cross-role mixing). */
export type InboxScope = 'vet' | 'owner';

export type InboxConversation = {
  key: string;
  kind: InboxKind;
  id: number;
  title: string;
  preview: string;
  createdAt: string;
  /** آخرین فعالیت — گفتگوی تازه‌تر بالاتر می‌آید */
  lastActivityAt: string;
  pending: boolean;
  ended: boolean;
  /**
   * گفتگوی جاری/باز: همبازی پذیرفته‌شده بدون قطع، یا مشاورهٔ دامپزشک فعال.
   * درخواست‌های در انتظار و چت‌های پایان‌یافته ongoing نیستند.
   */
  ongoing: boolean;
  direction: 'incoming' | 'outgoing';
  /** طرف مقابل می‌تواند قبول/رد کند (مثل ربات) */
  canDecide: boolean;
  href: string;
  peerPet?: Pet;
};

export function inboxScopeForRole(role?: UserRole | null): InboxScope {
  return role === 'vet' ? 'vet' : 'owner';
}

export function inboxScopeForUser(user?: User | null): InboxScope {
  return inboxScopeForRole(primaryRole(user?.roles, user?.role));
}

function activityMs(value: string | undefined | null): number {
  if (!value) return 0;
  const raw = value.trim();
  if (!raw) return 0;
  const normalized =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? raw.replace(' ', 'T') + 'Z'
      : raw;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Inbox priority:
 * 1) ongoing (accepted/open sessions) — always above idle/closed
 * 2) pending requests
 * 3) ended/closed
 * Within each tier: newest lastActivityAt first.
 */
function sortInbox(items: InboxConversation[]): InboxConversation[] {
  return [...items].sort((a, b) => {
    const rank = (m: InboxConversation) => (m.ongoing ? 0 : m.pending ? 1 : 2);
    const byTier = rank(a) - rank(b);
    if (byTier !== 0) return byTier;
    return activityMs(b.lastActivityAt) - activityMs(a.lastActivityAt);
  });
}

export function playmateToInbox(match: MatchRequest): InboxConversation {
  const peer = match.fromPet;
  const pending = match.status === 'pending';
  const expired = match.status === 'expired' || Boolean(match.expired);
  const ended = Boolean(match.chatEnded) || expired;
  /** Accepted playmate session that has not been ended/expired. */
  const ongoing = match.status === 'accepted' && !ended;
  const preview = expired
    ? 'درخواست منقضی شده'
    : ended
      ? 'چت پایان یافته'
      : pending
        ? match.direction === 'incoming'
          ? 'درخواست همبازی جدید'
          : 'منتظر پاسخ درخواست'
        : match.chatSecure
          ? 'چت امن · همبازی'
          : `${peer.name} · همبازی`;

  const lastActivityAt = match.updatedAt || match.createdAt;

  return {
    key: `playmate:${match.id}`,
    kind: 'playmate',
    id: match.id,
    // Accepted chat: tappable/copyable /u##### (never Telegram username / display name).
    // Pending requests keep pet name so the seeker sees which pet was requested.
    title:
      match.status === 'accepted' && peer.ownerId
        ? toUserCommandId(makeUserPublicId(peer.ownerId))
        : peer.ownerName || peer.name,
    preview,
    createdAt: match.createdAt,
    lastActivityAt,
    pending,
    ended,
    ongoing,
    direction: match.direction === 'outgoing' ? 'outgoing' : 'incoming',
    canDecide: pending && match.direction === 'incoming',
    href: `/chats/${match.id}`,
    peerPet: peer,
  };
}

export function vetToInbox(
  c: VetConsultation,
  myUserId: number,
  mode: 'as_vet' | 'as_patient',
): InboxConversation | null {
  if (c.status === 'cancelled' || c.status === 'expired') return null;

  const asVet = c.vetUserId === myUserId;
  const asPatient = c.patientUserId === myUserId;
  if (mode === 'as_vet' && !asVet) return null;
  if (mode === 'as_patient' && !asPatient) return null;
  if (!asVet && !asPatient) return null;

  const pending = c.status === 'requested';
  const ended = c.status === 'completed' || Boolean(c.chatEnded);
  /** Active vet consult that has not been completed/ended. */
  const ongoing = c.status === 'active' && !ended;
  const direction: 'incoming' | 'outgoing' = mode === 'as_vet' ? 'incoming' : 'outgoing';

  const peerTitle =
    mode === 'as_vet'
      ? c.patientName?.trim() || (c.petName ? `بیمار · ${c.petName}` : `بیمار #${c.patientUserId}`)
      : c.vetName?.trim() || `پزشک #${c.vetUserId}`;

  const preview = pending
    ? mode === 'as_vet'
      ? 'درخواست مشاوره جدید'
      : 'در انتظار پذیرش دامپزشک'
    : ended
      ? 'مشاوره پایان یافته'
      : c.petName
        ? `مشاوره · ${c.petName}`
        : 'مشاوره دامپزشک';

  return {
    key: `vet:${c.id}`,
    kind: 'vet',
    id: c.id,
    title: peerTitle,
    preview,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt || c.createdAt,
    pending,
    ended,
    ongoing,
    direction,
    canDecide: pending && mode === 'as_vet',
    // Patient pending → waiting page, not a live chat thread.
    href: pending && mode === 'as_patient' ? '/vet-consult' : `/vet-chats/${c.id}`,
  };
}

/**
 * Role-scoped inbox:
 * - primary vet → only consultations as veterinarian
 * - any other primary role → playmate chats + consultations as patient
 * Never mixes vet-practice threads into owner view (or the reverse).
 */
/** Soft-reload equality — order-independent, ignores lastActivityAt clock noise. */
export function inboxRowsEquivalent(
  prev: InboxConversation[],
  next: InboxConversation[],
): boolean {
  if (prev.length !== next.length) return false;
  const byKey = new Map(next.map((row) => [row.key, row]));
  for (const row of prev) {
    const other = byKey.get(row.key);
    if (!other) return false;
    if (
      row.preview !== other.preview ||
      row.pending !== other.pending ||
      row.ended !== other.ended ||
      row.ongoing !== other.ongoing ||
      row.title !== other.title ||
      row.canDecide !== other.canDecide ||
      row.kind !== other.kind ||
      row.href !== other.href
    ) {
      return false;
    }
  }
  return true;
}

export async function loadInboxConversations(
  myUserId: number,
  user?: User | null,
): Promise<InboxConversation[]> {
  const scope = inboxScopeForUser(user);

  if (scope === 'vet') {
    if (!userHasRole(user, 'vet')) return [];
    const rows = await listVetConsultations({ vetUserId: myUserId }).catch(
      () => [] as VetConsultation[],
    );
    const items: InboxConversation[] = [];
    for (const row of rows) {
      const item = vetToInbox(row, myUserId, 'as_vet');
      if (item) items.push(item);
    }
    return sortInbox(items);
  }

  const playmatePromise = listPlaydateRequests({ userId: myUserId }).then((rows) =>
    rows
      .filter((r) => {
        if (r.status === 'rejected' || r.status === 'cancelled' || r.status === 'expired') {
          return false;
        }
        const owns =
          r.toUserId === myUserId ||
          r.fromUserId === myUserId ||
          r.toPet?.ownerId === myUserId ||
          r.fromPet?.ownerId === myUserId;
        return owns;
      })
      .map((r) => playmateToInbox(playdateToMatchRequest(r, myUserId))),
  );

  const patientPromise = listVetConsultations({ patientUserId: myUserId }).catch(
    () => [] as VetConsultation[],
  );

  const [playmates, asPatient] = await Promise.all([playmatePromise, patientPromise]);

  const vetItems: InboxConversation[] = [];
  for (const row of asPatient) {
    const item = vetToInbox(row, myUserId, 'as_patient');
    if (item) vetItems.push(item);
  }

  return sortInbox([...playmates, ...vetItems]);
}

export async function acceptInboxItem(
  item: InboxConversation,
  myUserId: number,
  token?: string | null,
): Promise<void> {
  if (item.kind === 'playmate') {
    await updatePlaydateStatus(item.id, 'accepted', myUserId);
    return;
  }
  await acceptVetConsultation(item.id, token);
}

export async function rejectInboxItem(
  item: InboxConversation,
  myUserId: number,
  token?: string | null,
): Promise<void> {
  if (item.kind === 'playmate') {
    await updatePlaydateStatus(item.id, 'rejected', myUserId);
    return;
  }
  await rejectVetConsultation(item.id, token);
}
