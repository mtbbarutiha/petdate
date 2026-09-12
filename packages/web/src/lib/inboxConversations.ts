import type { User, UserRole, VetConsultation } from '@petdate/shared';
import { primaryRole, userHasRole } from '@petdate/shared';
import type { MatchRequest, Pet } from '../types';
import {
  acceptVetConsultation,
  listPlaydateRequests,
  listVetConsultations,
  rejectVetConsultation,
  updatePlaydateStatus,
} from './api';
import { playmateInboxTitle } from './inboxTitle';
import { playdateToMatchRequest } from './playdateMap';
import { resolveConsultPeerAvatarUrl } from './resolveConsultPeerAvatar';

export { looksLikePublicUserId, playmateInboxTitle } from './inboxTitle';
export { resolveConsultPeerAvatarUrl } from './resolveConsultPeerAvatar';

export type InboxKind = 'playmate' | 'vet';

/** Scope of chats tied to the active primary role (no cross-role mixing). */
export type InboxScope = 'vet' | 'owner' | 'trainer';

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
   * گفتگوی جاری/باز: همبازی پذیرفته‌شده بدون قطع، یا مشاورهٔ فعال.
   * درخواست‌های در انتظار و چت‌های پایان‌یافته ongoing نیستند.
   */
  ongoing: boolean;
  direction: 'incoming' | 'outgoing';
  /** طرف مقابل می‌تواند قبول/رد کند (مثل ربات) */
  canDecide: boolean;
  href: string;
  peerPet?: Pet;
  /** عکس طرف مقابل (دامپزشک/مربی یا بیمار) — برای لیست مشاوره */
  peerAvatarUrl?: string;
  /** برای برچسب لیست — پیش‌فرض vet وقتی kind=vet */
  serviceKind?: 'vet' | 'trainer' | 'sitter' | 'seeker_advice';
};

export function inboxScopeForRole(role?: UserRole | null): InboxScope {
  if (role === 'vet') return 'vet';
  if (role === 'trainer') return 'trainer';
  return 'owner';
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

/**
 * Collapse duplicate ongoing AI provider rows in polluted DBs
 * (same peer title + serviceKind — e.g. many «پاشا یزدانی» / legacy دستیار names).
 * Keeps the newest by lastActivityAt.
 */
function collapseDuplicateAiInboxRows(items: InboxConversation[]): InboxConversation[] {
  const aiTitle =
    /^(پاشا یزدانی|دکتر لیلا کیانی|لیلا کیانی|دکتر لایلا احمدی|لایلا احمدی|فرانک احمدی|دستیار هوشمند پت‌دیت|دستیار هوشمند پت|دستیار هوشمند)$/;
  const seen = new Map<string, InboxConversation>();
  const out: InboxConversation[] = [];
  for (const item of sortInbox(items)) {
    if (
      item.kind === 'vet' &&
      item.ongoing &&
      item.direction === 'outgoing' &&
      aiTitle.test(item.title.trim())
    ) {
      // Collapse legacy + new titles into one bucket per serviceKind.
      const key = `ai:${item.serviceKind ?? 'vet'}`;
      if (seen.has(key)) continue;
      seen.set(key, item);
    }
    out.push(item);
  }
  return out;
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
    // Always show a human name in the list — never /u##### or PD-U##### as primary title.
    title: playmateInboxTitle(peer),
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

  const serviceKind = c.serviceKind ?? 'vet';
  const pending = c.status === 'requested';
  const ended = c.status === 'completed' || Boolean(c.chatEnded);
  /** Active consult that has not been completed/ended. */
  const ongoing = c.status === 'active' && !ended;
  const direction: 'incoming' | 'outgoing' = mode === 'as_vet' ? 'incoming' : 'outgoing';

  const peerTitle =
    mode === 'as_vet'
      ? c.patientName?.trim() ||
        (c.petName
          ? `صاحب پت · ${c.petName}`
          : `صاحب پت #${c.patientUserId}`)
      : c.vetName?.trim() ||
        (serviceKind === 'trainer'
          ? `مربی #${c.vetUserId}`
          : serviceKind === 'sitter'
            ? `پرستار #${c.vetUserId}`
            : `پزشک #${c.vetUserId}`);

  const preview = pending
    ? mode === 'as_vet'
      ? serviceKind === 'trainer'
        ? 'درخواست هماهنگی آموزش'
        : serviceKind === 'sitter'
          ? 'درخواست پرستار پت'
          : 'درخواست مشاوره جدید'
      : serviceKind === 'trainer'
        ? 'در انتظار پذیرش مربی'
        : serviceKind === 'sitter'
          ? 'در انتظار پذیرش پرستار'
          : 'در انتظار پذیرش دامپزشک'
    : ended
      ? serviceKind === 'trainer'
        ? 'هماهنگی پایان یافته'
        : serviceKind === 'sitter'
          ? 'ارتباط پایان یافته'
          : 'مشاوره پایان یافته'
      : c.petName
        ? serviceKind === 'trainer'
          ? `آموزش آنلاین · ${c.petName}`
          : serviceKind === 'sitter'
            ? `پرستاری · ${c.petName}`
            : `مشاوره · ${c.petName}`
        : serviceKind === 'trainer'
          ? 'آموزش آنلاین'
          : serviceKind === 'sitter'
            ? 'ارتباط پرستار پت'
            : 'مشاوره دامپزشک';

  const patientPanel =
    serviceKind === 'trainer'
      ? '/trainer-consult'
      : serviceKind === 'sitter'
        ? '/home'
        : '/vet-consult';

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
    href: pending && mode === 'as_patient' ? patientPanel : `/vet-chats/${c.id}`,
    peerAvatarUrl: resolveConsultPeerAvatarUrl(c, mode),
    serviceKind,
  };
}

/**
 * Role-scoped inbox:
 * - primary vet → only consultations as veterinarian
 * - primary trainer → only their service consultations as provider
 * - any other primary role → playmate chats + consultations as patient
 * Never mixes provider-practice threads into owner view (or the reverse).
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
      row.href !== other.href ||
      row.serviceKind !== other.serviceKind ||
      row.peerAvatarUrl !== other.peerAvatarUrl
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
    const rows = await listVetConsultations({
      vetUserId: myUserId,
      kind: 'vet',
    }).catch(() => [] as VetConsultation[]);
    const items: InboxConversation[] = [];
    for (const row of rows) {
      const item = vetToInbox(row, myUserId, 'as_vet');
      if (item) items.push(item);
    }
    return sortInbox(items);
  }

  if (scope === 'trainer') {
    if (!userHasRole(user, 'trainer')) return [];
    const rows = await listVetConsultations({
      vetUserId: myUserId,
      kind: 'trainer',
    }).catch(() => [] as VetConsultation[]);
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

  return collapseDuplicateAiInboxRows(sortInbox([...playmates, ...vetItems]));
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
