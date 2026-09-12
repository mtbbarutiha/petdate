import '../styles/chat.css';
import {
  FormEvent,
  KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  Check,
  CheckCheck,
  ImageOff,
  Loader2,
  Lock,
  LockOpen,
  MoreVertical,
  PhoneOff,
  Paperclip,
  PawPrint,
  RefreshCw,
  Send,
  Smile,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { SiteLogo } from '../components/SiteLogo';
import { ChatMediaCaptureProvider, ChatMediaCaptureTriggers } from '../components/ChatMediaCapture';
import { ChatVoicePlayer } from '../components/ChatVoicePlayer';
import { ChatGiftBubble, PlaymateChatToolbar, PlaymateGiftSheet } from '../components/PlaymateGift';
import { ConfirmModal } from '../components/ConfirmModal';
import { EmojiPicker } from '../components/EmojiPicker';
import { FindPlaymatePanel } from '../components/FindPlaymatePanel';
import {
  OwnerConsultPanel,
  shouldShowOwnerConsultCta,
} from '../components/OwnerConsultPanel';
import { InboxPeerAvatar } from '../components/InboxPeerAvatar';
import { PetAvatar } from '../components/PetAvatar';
import { PresenceBadge } from '../components/PresenceBadge';
import { RequestCountdown } from '../components/RequestCountdown';
import { formatAge, formatTimeAgo } from '../data/mock';
import { useAuthStore } from '../hooks/useAuthStore';
import { useChatSocket, type ChatSocketEvent } from '../hooks/useChatSocket';
import { useChatViewportHeight } from '../hooks/useChatViewportHeight';
import { useLiveAjaxPoll } from '../hooks/useLiveAjaxPoll';
import {
  CHAT_FILE_ACCEPT,
  MAX_CHAT_ATTACH_BYTES,
  isLikelyChatImage,
  prepareChatUploadFile,
} from '../lib/chatMediaUpload';
import { usePeerPresence, usePresenceHeartbeat } from '../hooks/usePresence';
import {
  addUserContact,
  clearPlaydateChatMessages,
  sendPlaydateGift,
  dismissPlaydateInbox,
  dismissVetInbox,
  addUserBlock,
  endPlaydateChat,
  getPlaydateRequest,
  getUserById,
  listPlaydateChatMessages,
  playdateChatMediaUrl,
  postPlaydateChatMessage,
  setPlaydateChatSecure,
  updatePlaydateStatus,
  uploadPlaydateChatFile,
  resolvePublicAvatarUrl,
  resolvePublicMediaUrl,
} from '../lib/api';
import type { PlaydateChatMediaKind, PlaydateChatMessage } from '@petdate/shared';
import { PLAYDATE_REQUEST_TTL_MS, USER_GENDER_LABELS, isPendingRequestExpired, makeUserPublicId, petPublicIdOf, userPublicIdOf } from '@petdate/shared';
import { playdateToMatchRequest, shouldShowOutgoingRejectToRequester } from '../lib/playdateMap';
import { subscribeIncomingRefresh } from '../lib/liveIncoming';
import {
  acceptInboxItem,
  inboxRowsEquivalent,
  inboxScopeForUser,
  loadInboxConversations,
  playmateInboxTitle,
  rejectInboxItem,
  type InboxConversation,
  type InboxScope,
} from '../lib/inboxConversations';
import {
  MATCH_STATUS_LABELS,
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_TYPE_LABELS,
  type MatchRequest,
} from '../types';
import { PublicIdBadge } from '../components/PublicIdBadge';
import { useI18n } from '../i18n';

const CHAT_WIPE_HINT =
  'لطفاً کل این گفتگو را پاک کنید تا اثری از پیام‌ها (متن، عکس، ویس و …) نماند.';

const SECURE_WIPE_HINT =
  '🔒 چت امن پایان یافت — برای پاک‌کردن کامل گفتگو دکمه «حذف کل چت» را بزن.';

/** Soft inbox refresh — backup even when WS is up (missed inbox events). */
const FALLBACK_POLL_MS = 12_000;
const OFFLINE_FALLBACK_POLL_MS = 8_000;
/** Message/status poll when WS is down — keep gentle to avoid UI thrash. */
const MESSAGE_FALLBACK_POLL_MS = 8_000;
/**
 * Catch-up while WS is up (missed Telegram→web events / subscribe races /
 * half-open sockets). Keep short enough that dual-online "گیر کردن" recovers
 * within a few seconds without waiting for a full page refresh.
 */
const MESSAGE_WS_CATCHUP_POLL_MS = 8_000;
const DESKTOP_MQ = '(min-width: 860px)';

type ChatMsg = {
  id: string;
  numericId: number;
  from: 'me' | 'peer' | 'system';
  text: string;
  at: number;
  mediaKind?: PlaydateChatMediaKind | null;
  telegramFileId?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
};

type InfoCard = 'none' | 'owner' | 'pet';

function toUiMessage(row: PlaydateChatMessage, myUserId: number): ChatMsg {
  const at = Date.parse(row.createdAt);
  return {
    id: String(row.id),
    numericId: row.id,
    from: row.senderUserId === myUserId ? 'me' : 'peer',
    text: row.text,
    at: Number.isFinite(at) ? at : Date.now(),
    mediaKind: row.mediaKind,
    telegramFileId: row.telegramFileId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}

function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'امروز';
  if (sameDay(d, yesterday)) return 'دیروز';
  return d.toLocaleDateString('fa-IR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function mediaLabel(kind?: PlaydateChatMediaKind | null) {
  switch (kind) {
    case 'photo':
      return 'تصویر';
    case 'video':
    case 'animation':
    case 'video_note':
      return 'ویدیو';
    case 'voice':
      return 'پیام صوتی';
    case 'audio':
      return 'فایل صوتی';
    case 'document':
      return 'فایل';
    case 'sticker':
      return 'استیکر';
    case 'gift':
      return 'هدیه';
    default:
      return 'رسانه';
  }
}

function systemMessage(text: string): ChatMsg {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    numericId: 0,
    from: 'system',
    text,
    at: Date.now(),
  };
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

function inboxListTitle(scope: InboxScope, t: (k: string) => string): string {
  if (scope === 'vet') return t('chats.titleVet');
  if (scope === 'trainer') return t('chats.titleTrainer');
  return t('chats.titleDefault');
}

function inboxKindBadge(c: InboxConversation, t: (k: string) => string): string {
  if (c.kind === 'playmate') return t('chats.badgePlaymate');
  if (c.serviceKind === 'trainer') return 'آموزش';
  if (c.serviceKind === 'sitter') return 'پرستار';
  return 'مشاوره';
}

function providerHomePath(scope: InboxScope): string {
  if (scope === 'vet') return '/vet-consult';
  if (scope === 'trainer') return '/trainer-consult';
  return '/home';
}

function ConversationListPane({
  conversations,
  loading,
  error,
  scope,
  activeKey,
  busyKey,
  ownerConsult,
  onSelect,
  onRefresh,
  onAccept,
  onReject,
  onViewOwner,
  onDismiss,
}: {
  conversations: InboxConversation[];
  loading: boolean;
  error: string | null;
  scope: InboxScope;
  activeKey?: string;
  busyKey?: string | null;
  /** نقش بدون پت: مشورت با صاحبین به‌جای پیدا کردن همبازی */
  ownerConsult?: boolean;
  onSelect: (item: InboxConversation) => void;
  onRefresh: () => void;
  onAccept: (item: InboxConversation) => void;
  onReject: (item: InboxConversation) => void;
  onViewOwner: (item: InboxConversation) => void;
  onDismiss: (item: InboxConversation) => void;
}) {
  const { t } = useI18n();
  const isPlaymateHub = scope === 'owner';
  const panelPath = providerHomePath(scope);
  const HubCta = ownerConsult ? OwnerConsultPanel : FindPlaymatePanel;
  return (
    <aside className="tg-chat-list" aria-label={t('chats.listAria')}>
      <header className="tg-chat-list-head">
        <Link
          to={panelPath}
          className="tg-icon-btn"
          aria-label={isPlaymateHub ? t('common.back') : t('common.back')}
        >
          <ArrowRight size={18} />
        </Link>
        <div className="tg-chat-list-brand">
          <SiteLogo className="tg-chat-list-logo" height={34} />
          <h1>{inboxListTitle(scope, t)}</h1>
        </div>
        {isPlaymateHub ? <HubCta variant="header" onSent={onRefresh} /> : null}
        {!isPlaymateHub ? (
          <button
            type="button"
            className="tg-icon-btn"
            onClick={onRefresh}
            aria-label="بروزرسانی فهرست"
            title="بروزرسانی"
          >
            <RefreshCw size={18} />
          </button>
        ) : null}
      </header>

      {error ? <p className="tg-error tg-error--inset">{error}</p> : null}

      <div className="tg-chat-list-body">
        {loading ? (
          <div className="tg-chat-list-empty">
            <div className="tg-skeleton tg-skeleton--row" />
            <div className="tg-skeleton tg-skeleton--row" />
            <div className="tg-skeleton tg-skeleton--row" />
          </div>
         ) : conversations.length === 0 ? (
          <div
            className={`tg-chat-list-empty${isPlaymateHub ? ' tg-chat-list-empty--hub' : ''}`}
          >
            {scope === 'vet' ? (
              <>
                <div className="tg-empty-mark" aria-hidden>
                  <SiteLogo className="tg-chat-empty-logo" height={40} />
                </div>
                <h2>{t('chats.emptyTitle')}</h2>
                <p>{t('chats.emptyLead')}</p>
                <Link to="/vet-consult" className="tg-chat-link-btn">
                  رفتن به پنل پزشک
                </Link>
              </>
            ) : scope === 'trainer' ? (
              <>
                <div className="tg-empty-mark" aria-hidden>
                  <SiteLogo className="tg-chat-empty-logo" height={40} />
                </div>
                <h2>هماهنگی آموزش آنلاین</h2>
                <p>
                  اینجا فقط با صاحبان پت برای هماهنگی زمان و جزئیات آموزش آنلاین گفتگو
                  می‌کنی — همبازی نیست.
                </p>
                <Link to="/trainer-consult" className="tg-chat-link-btn">
                  رفتن به پنل مربی
                </Link>
              </>
            ) : ownerConsult ? (
              <>
                <ChatEmptyVisual />
                <h2>مشورت با صاحبین</h2>
                <p>هنوز گفتگویی نداری — از صاحبین باتجربه درباره نگهداری و هزینه بپرس.</p>
                <div className="tg-thread-empty__cta-wrap">
                  <OwnerConsultPanel compact onSent={onRefresh} />
                </div>
              </>
            ) : (
              <>
                <ChatEmptyVisual />
                <h2>{t('chats.emptyTitle')}</h2>
                <p>{t('chats.pickLead')}</p>
                <div className="tg-thread-empty__cta-wrap">
                  <FindPlaymatePanel compact showRequests={false} onSent={onRefresh} />
                </div>
              </>
            )}
          </div>
        ) : (
          <ul className="tg-chat-list-items">
            {conversations.map((c) => {
              const active = activeKey === c.key;
              const busy = busyKey === c.key;
              const peer = c.peerPet;
              const badge = inboxKindBadge(c, t);
              return (
                <li key={c.key} className={`tg-chat-list-row${c.ongoing ? ' is-ongoing-row' : ''}`}>
                  <button
                    type="button"
                    className={`tg-chat-list-item${active ? ' is-active' : ''}${
                      c.ended ? ' is-ended' : ''
                    }${c.pending ? ' is-pending' : ''}${c.ongoing ? ' is-ongoing' : ''}`}
                    onClick={() => onSelect(c)}
                  >
                    {peer ? (
                      <PetAvatar
                        type={peer.type}
                        size="md"
                        imageUrl={peer.imageUrl}
                        name={peer.name}
                      />
                    ) : (
                      <InboxPeerAvatar avatarUrl={c.peerAvatarUrl} name={c.title} />
                    )}
                    <span className="tg-chat-list-meta">
                      <strong>
                        {c.title}
                        <em
                          className={`tg-chat-list-kind${
                            c.kind === 'vet'
                              ? ' is-vet'
                              : c.serviceKind === 'trainer'
                                ? ' is-trainer'
                                : ''
                          }`}
                        >
                          {badge}
                        </em>
                      </strong>
                      <small>{c.preview}</small>
                    </span>
                    <span className="tg-chat-list-side">
                      <time className="tg-chat-list-time">
                        {formatTimeAgo(c.lastActivityAt || c.createdAt)}
                      </time>
                      {c.ongoing ? (
                        <span
                          className="tg-chat-list-badge is-ongoing"
                          aria-label={
                            c.serviceKind === 'trainer'
                              ? t('chats.busyWithPet')
                              : t('chats.active')
                          }
                        >
                          {c.serviceKind === 'trainer'
                            ? t('chats.busyWithPet')
                            : t('chats.activeShort')}
                        </span>
                      ) : c.ended ? (
                        <span className="tg-chat-list-badge is-ended" aria-label={t('chats.closedAria')}>
                          {t('chats.closed')}
                        </span>
                      ) : c.pending ? (
                        <span className="tg-chat-list-badge is-pending" aria-label={t('chats.pendingAria')}>
                          !
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tg-icon-btn tg-chat-list-dismiss"
                    aria-label={t('chats.dismissFromList')}
                    title={t('chats.dismissTitle')}
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(c);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  {c.canDecide ? (

                    <div className="tg-chat-list-actions">
                      <button
                        type="button"
                        className="tg-chat-list-accept"
                        disabled={Boolean(busy)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAccept(c);
                        }}
                      >
                        <Check size={14} strokeWidth={2.5} />
                        قبول
                      </button>
                      <button
                        type="button"
                        className="tg-chat-list-reject"
                        disabled={Boolean(busy)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(c);
                        }}
                      >
                        <X size={14} strokeWidth={2.5} />
                        رد
                      </button>
                      {c.kind === 'playmate' ? (
                        <button
                          type="button"
                          className="tg-chat-list-profile"
                          disabled={Boolean(busy)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOwner(c);
                          }}
                        >
                          <UserRound size={14} strokeWidth={2.2} />
                          پروفایل صاحب پت
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ChatEmptyVisual() {
  return (
    <div className="tg-empty-visual" aria-hidden>
      <span className="tg-empty-visual__ring tg-empty-visual__ring--outer" />
      <span className="tg-empty-visual__ring tg-empty-visual__ring--inner" />
      <span className="tg-empty-visual__paw">
        <PawPrint size={28} strokeWidth={1.75} />
      </span>
    </div>
  );
}

function ThreadEmptyState({
  scope,
  desktop,
  ownerConsult,
  onFindSent,
}: {
  scope: InboxScope;
  desktop?: boolean;
  ownerConsult?: boolean;
  onFindSent?: () => void;
}) {
  const { t } = useI18n();
  if (scope === 'vet') {
    return (
      <div className="tg-thread-empty tg-thread-empty--pepito">
        <ChatEmptyVisual />
        <h2>{t('chats.pickTitle')}</h2>
        <p>{t('chats.pickLeadVet')}</p>
        <Link to="/vet-consult" className="pepito-btn button-1 tg-thread-empty__cta">
          {t('nav.vet_panel')}
        </Link>
      </div>
    );
  }
  if (scope === 'trainer') {
    return (
      <div className="tg-thread-empty tg-thread-empty--pepito">
        <ChatEmptyVisual />
        <h2>{t('chats.pickTitleTrainer')}</h2>
        <p>{t('chats.pickLeadTrainer')}</p>
        <Link to="/trainer-consult" className="pepito-btn button-1 tg-thread-empty__cta">
          {t('nav.trainer_panel')}
        </Link>
      </div>
    );
  }
  if (ownerConsult) {
    if (desktop) {
      return (
        <div className="tg-thread-empty tg-thread-empty--pepito">
          <ChatEmptyVisual />
          <h2>مشورت با صاحبین</h2>
          <p>یک گفتگو را از فهرست انتخاب کن یا مشورت جدید شروع کن.</p>
          <div className="tg-thread-empty__cta-wrap">
            <OwnerConsultPanel compact onSent={onFindSent} />
          </div>
        </div>
      );
    }
    return (
      <div className="tg-thread-empty tg-thread-empty--hub">
        <OwnerConsultPanel onSent={onFindSent} />
      </div>
    );
  }
  // Desktop split: Pepito empty pane with hierarchy + primary find CTA.
  if (desktop) {
    return (
      <div className="tg-thread-empty tg-thread-empty--pepito">
        <ChatEmptyVisual />
        <h2>{t('chats.pickTitle')}</h2>
        <p>{t('chats.pickLead')}</p>
        <div className="tg-thread-empty__cta-wrap">
          <FindPlaymatePanel compact showRequests={false} onSent={onFindSent} />
        </div>
      </div>
    );
  }
  return (
    <div className="tg-thread-empty tg-thread-empty--hub">
      <FindPlaymatePanel onSent={onFindSent} />
    </div>
  );
}

export function ChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const desktop = useIsDesktop();
  const { t } = useI18n();
  const { user: authUser, token, isProfileComplete, refreshMe, applyUser } = useAuthStore();
  const myUserId = authUser?.id;
  const inboxScope = inboxScopeForUser(authUser);
  const ownerConsult = shouldShowOwnerConsultCta(authUser);
  const selectedId = Number(matchId);
  const hasThread = Number.isFinite(selectedId) && selectedId > 0;

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [listActionKey, setListActionKey] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  /** After the first successful inbox load, never flash the skeleton again. */
  const listReadyRef = useRef(false);

  const [match, setMatch] = useState<MatchRequest | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [secure, setSecure] = useState(false);
  const [contactAdded, setContactAdded] = useState(false);
  const [draft, setDraft] = useState('');
  const [ended, setEnded] = useState(false);
  const [wiped, setWiped] = useState(false);
  /** After secure chat ends, keep wipe CTA visible (don't force-exit to inbox). */
  const [needsSecureWipe, setNeedsSecureWipe] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [infoCard, setInfoCard] = useState<InfoCard>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  /** Pending inbox dismiss — ConfirmModal must confirm before API call */
  const [dismissConfirm, setDismissConfirm] = useState<
    | { source: 'list'; item: InboxConversation }
    | { source: 'thread' }
    | null
  >(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [captureOccupied, setCaptureOccupied] = useState(false);
  const [peerOwnerLabel, setPeerOwnerLabel] = useState<string | null>(null);
  const [peerOwnerDisplayName, setPeerOwnerDisplayName] = useState<string | null>(null);
  const [peerOwnerAvatar, setPeerOwnerAvatar] = useState<string>('');
  const [peerPhotoBroken, setPeerPhotoBroken] = useState(false);
  const [peerOwnerMeta, setPeerOwnerMeta] = useState<{
    city?: string;
    province?: string;
    age?: number | null;
    gender?: string;
    interests?: string;
    verification?: string;
    publicId?: string;
    bio?: string;
  } | null>(null);
  const [brokenMedia, setBrokenMedia] = useState<Record<string, boolean>>({});
  const [requestBusy, setRequestBusy] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const lastMsgIdRef = useRef(0);
  const bootstrappedRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);
  const smoothScrollRef = useRef(false);
  const secureRef = useRef(false);
  secureRef.current = secure;

  const showList = desktop || !hasThread;
  const showThread = desktop || hasThread;

  useChatViewportHeight(true);
  usePresenceHeartbeat(myUserId);
  const peerPresence = usePeerPresence(match?.fromPet?.ownerId);

  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  const softReloadTimerRef = useRef<number | undefined>(undefined);
  const reloadConversations = useCallback(async (opts?: { soft?: boolean }) => {
    if (!myUserId) {
      setConversations([]);
      setListLoading(false);
      listReadyRef.current = false;
      setListError(t('chats.needLogin'));
      return;
    }
    // Once the list has painted, all subsequent reloads stay soft — hard loading
    // looks like a full page refresh on /chats.
    const soft = Boolean(opts?.soft || listReadyRef.current);
    if (!soft) {
      setListLoading(true);
      setListError(null);
    }
    try {
      const mapped = await loadInboxConversations(myUserId, authUserRef.current);
      setConversations((prev) => {
        // Skip state write when soft poll returns the same inbox — stops list flicker.
        // Ignore lastActivityAt / sort order: clock skew + reshuffles felt like refresh.
        if (soft && inboxRowsEquivalent(prev, mapped)) {
          return prev;
        }
        return mapped;
      });
      listReadyRef.current = true;
      if (soft) setListError(null);
    } catch (err) {
      if (!soft) {
        setListError(err instanceof Error ? err.message : 'بارگذاری گفتگوها ناموفق بود');
      }
    } finally {
      if (!soft) setListLoading(false);
    }
  }, [myUserId]);

  const softReloadConversations = useCallback(() => {
    window.clearTimeout(softReloadTimerRef.current);
    softReloadTimerRef.current = window.setTimeout(() => {
      void reloadConversations({ soft: true });
    }, 400);
  }, [reloadConversations]);

  useEffect(() => {
    return () => window.clearTimeout(softReloadTimerRef.current);
  }, []);

  useEffect(() => {
    void reloadConversations();
  }, [reloadConversations]);

  const onChatSocket = useCallback(
    (event: ChatSocketEvent) => {
      if (event.type === 'inbox') {
        softReloadConversations();
        return;
      }
      if (!myUserId || !hasThread || selectedId <= 0) return;
      // Match by URL thread id — do not wait for match load (WS can arrive first).
      if (event.type === 'message' && event.channel === 'playmate' && event.threadId === selectedId) {
        const row = event.message as PlaydateChatMessage;
        if (!row?.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.numericId === row.id || m.id === String(row.id))) return prev;
          return [...prev, toUiMessage(row, myUserId)];
        });
        lastMsgIdRef.current = Math.max(lastMsgIdRef.current, row.id);
        softReloadConversations();
        return;
      }
      if (event.type === 'thread' && event.channel === 'playmate' && event.threadId === selectedId) {
        const patch = event.patch || {};
        if (typeof patch.chatSecure === 'boolean') {
          setSecure((prev) => {
            if (prev === patch.chatSecure) return prev;
            setMessages((msgs) => [
              ...msgs,
              systemMessage(
                patch.chatSecure
                  ? 'طرف مقابل چت امن را فعال کرد.\nپیام‌های این گفتگو قابل ذخیره یا فوروارد نیستند.'
                  : 'طرف مقابل چت امن را خاموش کرد.',
              ),
            ]);
            return Boolean(patch.chatSecure);
          });
        }
        if (patch.chatEnded) {
          const secureEnded = Boolean(patch.wasSecure) || secureRef.current;
          setEnded(true);
          if (secureEnded) setNeedsSecureWipe(true);
          setMessages((msgs) => [
            ...msgs,
            systemMessage(
              [
                'چت همبازی قطع شد.',
                '',
                secureEnded ? SECURE_WIPE_HINT : CHAT_WIPE_HINT,
              ].join('\n'),
            ),
          ]);
          softReloadConversations();
          // Secure chats stay open so the wipe CTA is reachable; otherwise exit.
          if (!secureEnded) {
            navigate('/chats', { replace: true });
          }
          return;
        }
        if (patch.messagesCleared) {
          setMessages([]);
          lastMsgIdRef.current = 0;
          setWiped(true);
          setNeedsSecureWipe(false);
        }
        if (typeof patch.status === 'string' && patch.status !== match?.status) {
          void getPlaydateRequest(selectedId).then((req) => {
            if (!req || !myUserId) return;
            const mapped = playdateToMatchRequest(req, myUserId);
            setMatch(mapped);
            setSecure(Boolean(req.chatSecure));
            setEnded(Boolean(req.chatEnded));
            bootstrappedRef.current = null;
            if (req.status === 'accepted') {
              setMessages([
                systemMessage('درخواست پذیرفته شد — چت همبازی فعال شد.'),
                systemMessage('به همبازی جدید سلام کن.'),
              ]);
            } else if (req.status === 'expired') {
              setMessages([systemMessage('درخواست همبازی منقضی شد (مهلت ۲ دقیقه).')]);
            } else if (req.status === 'rejected') {
              if (shouldShowOutgoingRejectToRequester(mapped)) {
                setMessages([systemMessage('درخواست همبازی رد شد.')]);
              } else {
                navigate('/chats', { replace: true });
              }
            }
          });
        }
        softReloadConversations();
      }
    },
    [hasThread, selectedId, match?.status, myUserId, softReloadConversations, navigate],
  );

  const { connected: wsConnected } = useChatSocket({
    token,
    enabled: Boolean(token && myUserId),
    thread:
      hasThread && selectedId > 0
        ? { channel: 'playmate', threadId: selectedId }
        : null,
    onEvent: onChatSocket,
  });
  const wsConnectedRef = useRef(wsConnected);
  wsConnectedRef.current = wsConnected;

  // Soft inbox refresh — always on as a safety net (WS can miss playmate
  // request events on mobile/desktop). Soft reload skips identical rows.
  useLiveAjaxPoll(
    () => {
      softReloadConversations();
    },
    {
      enabled: Boolean(myUserId),
      intervalMs: wsConnected ? FALLBACK_POLL_MS : OFFLINE_FALLBACK_POLL_MS,
      runOnEnable: true,
    },
  );

  useEffect(() => {
    if (!myUserId) return;
    return subscribeIncomingRefresh((detail) => {
      softReloadConversations();
      // Fresh playmate request → open گفتگو thread (request card).
      // Provider scopes (vet/trainer) stay on service inbox — no playmate jump.
      const playmateId = detail?.kinds?.includes('playmate') ? detail.ids?.[0] : undefined;
      if (!playmateId || inboxScope === 'vet' || inboxScope === 'trainer') {
        return;
      }
      const target = `/chats/${playmateId}`;
      if (window.location.pathname === target) return;
      if (
        window.location.pathname === '/chats' ||
        window.location.pathname.startsWith('/chats/')
      ) {
        navigate(target);
      }
    });
  }, [myUserId, softReloadConversations, inboxScope, navigate]);

  // Playmate threads belong to owner scope — leave them in provider roles.
  useEffect(() => {
    if (
      (inboxScope === 'vet' || inboxScope === 'trainer') &&
      hasThread
    ) {
      navigate('/chats', { replace: true });
    }
  }, [inboxScope, hasThread, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function loadThread() {
      if (!hasThread || !myUserId) {
        setMatch(null);
        setThreadLoading(false);
        return;
      }
      setThreadLoading(true);
      try {
        const req = await getPlaydateRequest(selectedId);
        if (
          !req ||
          (req.status !== 'accepted' &&
            req.status !== 'pending' &&
            req.status !== 'rejected' &&
            req.status !== 'expired')
        ) {
          if (!cancelled) setMatch(null);
          return;
        }
        const owns =
          req.toUserId === myUserId ||
          req.fromUserId === myUserId ||
          req.toPet?.ownerId === myUserId ||
          req.fromPet?.ownerId === myUserId;
        if (!owns) {
          if (!cancelled) setMatch(null);
          return;
        }
        if (!cancelled) {
          const mapped = playdateToMatchRequest(req, myUserId);
          setMatch(mapped);
          setSecure(Boolean(req.chatSecure));
          setEnded(Boolean(req.chatEnded));
          if (req.chatEnded) {
            setMessages([]);
            lastMsgIdRef.current = 0;
          }
        }
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    }
    void loadThread();
    return () => {
      cancelled = true;
    };
  }, [hasThread, selectedId, myUserId]);

  useEffect(() => {
    if (!match) return;
    if (bootstrappedRef.current === match.id) return;
    bootstrappedRef.current = match.id;
    setMessages([]);
    lastMsgIdRef.current = 0;
    setContactAdded(false);
    setDraft('');
    setSendError(null);
    setActionError(null);
    setWiped(false);
    setInfoCard('none');
    setMenuOpen(false);
    setEmojiOpen(false);
    setPendingFile(null);
    setPendingPreview(null);
    setPeerOwnerLabel(null);
    setBrokenMedia({});
    setRequestBusy(false);
    stickToBottomRef.current = true;
    if (match.status === 'accepted' && !ended) {
      setMessages([
        systemMessage('چت همبازی فعال شد.'),
        systemMessage('به همبازی جدید سلام کن.'),
      ]);
    } else if (match.status === 'pending') {
      setMessages([]);
    } else if (match.expired) {
      setMessages([systemMessage('این درخواست منقضی شده است (مهلت ۲ دقیقه).')]);
    } else if (match.status === 'rejected') {
      if (shouldShowOutgoingRejectToRequester(match)) {
        setMessages([systemMessage('این درخواست رد شده است.')]);
      } else {
        navigate('/chats', { replace: true });
      }
    }
  }, [match?.id, match?.status, ended, navigate]);

  // While pending, poll status so both sides unlock when accepted (bot parity).
  // Live socket already pushes thread/status — skip ajax while connected.
  useEffect(() => {
    if (!match || !myUserId || match.status !== 'pending') return;
    if (wsConnected) return;
    let cancelled = false;

    async function pullStatus() {
      try {
        const req = await getPlaydateRequest(match!.id);
        if (cancelled || !req || req.status === 'pending') return;
        const mapped = playdateToMatchRequest(req, myUserId!);
        setMatch(mapped);
        setSecure(Boolean(req.chatSecure));
        setEnded(Boolean(req.chatEnded));
        bootstrappedRef.current = null;
        softReloadConversations();
        if (req.status === 'accepted') {
          setMessages([
            systemMessage('درخواست پذیرفته شد — چت همبازی فعال شد.'),
            systemMessage('به همبازی جدید سلام کن.'),
          ]);
          requestAnimationFrame(() => inputRef.current?.focus());
        } else if (req.status === 'expired') {
          setMessages([systemMessage('درخواست همبازی منقضی شد (مهلت ۲ دقیقه).')]);
        } else if (req.status === 'rejected') {
          if (shouldShowOutgoingRejectToRequester(mapped)) {
            setMessages([systemMessage('درخواست همبازی رد شد.')]);
          } else {
            navigate('/chats', { replace: true });
          }
        }
      } catch {
        /* ignore */
      }
    }

    void pullStatus();
    const timer = window.setInterval(() => void pullStatus(), MESSAGE_FALLBACK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [match?.id, match?.status, myUserId, softReloadConversations, wsConnected, navigate]);

  useEffect(() => {
    if (!match || !myUserId || ended || match.status !== 'accepted') return;
    let cancelled = false;
    let inFlight = false;

    async function pull(initial = false) {
      if (inFlight) return;
      inFlight = true;
      try {
        const rows = await listPlaydateChatMessages(
          match!.id,
          myUserId!,
          initial ? undefined : lastMsgIdRef.current || undefined,
        );
        if (cancelled || !rows.length) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const mapped = rows
            .map((row) => toUiMessage(row, myUserId!))
            .filter((m) => !seen.has(m.id));
          if (!mapped.length) return prev;
          return [...prev, ...mapped];
        });
        lastMsgIdRef.current = Math.max(lastMsgIdRef.current, ...rows.map((r) => r.id));
      } catch {
        /* keep local — next tick / reconnect / focus retries */
      } finally {
        inFlight = false;
      }
    }

    async function pullMeta() {
      try {
        const req = await getPlaydateRequest(match!.id);
        if (cancelled || !req) return;
        if (req.status !== 'accepted') {
          return;
        }
        setSecure((prev) => {
          const next = Boolean(req.chatSecure);
          if (prev !== next) {
            setMessages((msgs) => [
              ...msgs,
              systemMessage(
                next
                  ? 'طرف مقابل چت امن را فعال کرد.\nپیام‌های این گفتگو قابل ذخیره یا فوروارد نیستند.'
                  : 'طرف مقابل چت امن را خاموش کرد.',
              ),
            ]);
          }
          return next;
        });
        if (req.chatEnded) {
          setEnded((prev) => {
            if (!prev) {
              const secureEnded = secureRef.current;
              if (secureEnded) setNeedsSecureWipe(true);
              setMessages((msgs) => [
                ...msgs,
                systemMessage(
                  [
                    'چت همبازی قطع شد.',
                    '',
                    secureEnded ? SECURE_WIPE_HINT : CHAT_WIPE_HINT,
                  ].join('\n'),
                ),
              ]);
              softReloadConversations();
              if (!secureEnded) {
                navigate('/chats', { replace: true });
              }
            }
            return true;
          });
        }
      } catch {
        /* ignore — retried on interval / reconnect */
      }
    }

    function catchUp(initial = false) {
      if (document.visibilityState === 'hidden') return;
      void pull(initial);
      void pullMeta();
    }

    // Always load history once — WS-only path missed Telegram→web lines and
    // dropped events that arrived before match finished loading.
    catchUp(true);
    const timer = window.setInterval(
      () => catchUp(false),
      wsConnected ? MESSAGE_WS_CATCHUP_POLL_MS : MESSAGE_FALLBACK_POLL_MS,
    );
    // Immediate catch-up after WS reconnect (covers subscribe races + missed frames).
    const onWsOpen = () => catchUp(false);
    const onVis = () => {
      if (document.visibilityState === 'visible') catchUp(false);
    };
    window.addEventListener('petdate:ws-open', onWsOpen);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onWsOpen);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('petdate:ws-open', onWsOpen);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onWsOpen);
    };
  }, [match?.id, myUserId, ended, softReloadConversations, wsConnected, navigate]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickToBottomRef.current) return;
    const behavior = smoothScrollRef.current ? 'smooth' : 'auto';
    smoothScrollRef.current = false;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, [messages, ended, infoCard, pendingFile, emojiOpen]);

  useEffect(() => {
    const ownerId = match?.fromPet?.ownerId;
    if (!ownerId) {
      setPeerOwnerLabel(null);
      setPeerOwnerDisplayName(null);
      setPeerOwnerAvatar('');
      setPeerOwnerMeta(null);
      return;
    }
    let cancelled = false;
    // Prefer canonical PD-U##### immediately — never Telegram @username.
    const fallbackId = makeUserPublicId(ownerId);
    setPeerOwnerLabel(fallbackId);
    void getUserById(ownerId)
      .then((user) => {
        if (cancelled || !user?.id) return;
        const label = userPublicIdOf(user);
        const displayName = (user.name && String(user.name).trim()) || null;
        setPeerOwnerLabel(label);
        setPeerOwnerDisplayName(displayName);
        setPeerOwnerAvatar(
          resolvePublicAvatarUrl(user.avatarUrl, {
            verificationPhotoFileId: user.verificationPhotoFileId,
            gender: user.gender,
            moderationStatus: user.avatarModerationStatus,
            publicFacing: true,
          })
        );
        setPeerOwnerMeta({
          city: user.city || undefined,
          province: user.province || undefined,
          age: user.age ?? null,
          gender: user.gender ? USER_GENDER_LABELS[user.gender] : undefined,
          interests:
            user.interests && user.interests.length
              ? user.interests.join(' · ')
              : undefined,
          verification:
            user.verificationStatus === 'verified'
              ? 'احراز هویت شده'
              : user.verificationStatus === 'pending'
                ? 'در انتظار احراز'
                : undefined,
          publicId: label,
          bio: user.bio || undefined,
        });
        // Inbox list title = display name (never PD-U /u). Public id stays in peerOwnerLabel for copy/profile.
        const inboxTitle = playmateInboxTitle({
          name: match?.fromPet?.name || '',
          ownerName: displayName || '',
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.peerPet?.ownerId === ownerId
              ? {
                  ...c,
                  title: inboxTitle,
                  peerPet: {
                    ...c.peerPet,
                    ownerName: displayName || c.peerPet.ownerName || '',
                  },
                }
              : c,
          ),
        );
        setMatch((prev) =>
          prev && prev.fromPet.ownerId === ownerId
            ? {
                ...prev,
                fromPet: {
                  ...prev.fromPet,
                  ownerName: displayName || prev.fromPet.ownerName || '',
                },
              }
            : prev,
        );
      })
      .catch(() => {
        /* keep /u##### fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [match?.id, match?.fromPet?.ownerId]);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return;
    }
    const type = (pendingFile.type || '').toLowerCase();
    if (isLikelyChatImage(pendingFile) || type.startsWith('video/') || type.startsWith('audio/')) {
      const url = URL.createObjectURL(pendingFile);
      setPendingPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPendingPreview(null);
  }, [pendingFile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    // Mobile: grow a few lines so long drafts stay visible, then scroll inside.
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 859.98px)').matches;
    const maxH = mobile ? 104 : 128;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(maxH, Math.max(44, ta.scrollHeight))}px`;
    ta.scrollTop = ta.scrollHeight;
  }, [draft, hasThread, match?.id]);

  useEffect(() => {
    if (ended) setEmojiOpen(false);
  }, [ended]);

  const peerPet = match?.fromPet;
  /** Counterpart pet photo — resolved for API/Telegram paths; empty → paw placeholder. */
  const peerPhotoUrl = peerPet
    ? resolvePublicMediaUrl(peerPet.imageUrl, { petId: peerPet.id }) ||
      peerPet.imageUrl?.trim() ||
      ''
    : '';
  const showPeerPhoto = Boolean(peerPhotoUrl) && !peerPhotoBroken;
  const peerOwnerId = peerPet?.ownerId;
  const peerOwnerPublicId =
    peerOwnerLabel ||
    (peerOwnerId ? makeUserPublicId(peerOwnerId) : null) ||
    peerOwnerMeta?.publicId ||
    null;
  const peerOwnerName =
    peerOwnerDisplayName ||
    (peerPet?.ownerName &&
    !String(peerPet.ownerName).startsWith('/') &&
    !/^PD-U\d+/i.test(String(peerPet.ownerName))
      ? peerPet.ownerName
      : null) ||
    'صاحب پت';

  useEffect(() => {
    setPeerPhotoBroken(false);
  }, [match?.id, peerPhotoUrl]);

  async function copyPeerPublicId() {
    const id = peerOwnerPublicId;
    if (!id || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      /* ignore */
    }
  }
  const isExpiredRequest =
    Boolean(match?.expired) ||
    match?.status === 'expired' ||
    (match?.status === 'pending' &&
      isPendingRequestExpired(match.createdAt, PLAYDATE_REQUEST_TTL_MS));
  const isPendingRequest = match?.status === 'pending' && !isExpiredRequest;
  const isRejectedRequest = match?.status === 'rejected' && !isExpiredRequest;
  const chatUnlocked = match?.status === 'accepted' && !ended;
  const incomingPending = Boolean(isPendingRequest && match?.direction === 'incoming');

  const messageBlocks = useMemo(() => {
    const blocks: Array<{ key: string; day?: string; msg?: ChatMsg }> = [];
    let lastDay = '';
    for (const msg of messages) {
      const key = dayKey(msg.at);
      if (key !== lastDay) {
        lastDay = key;
        blocks.push({ key: `day-${key}`, day: formatDayLabel(msg.at) });
      }
      blocks.push({ key: msg.id, msg });
    }
    return blocks;
  }, [messages]);

  useEffect(() => {
    if (!hasThread) return;
    if (searchParams.get('info') !== 'owner') return;
    setInfoCard('owner');
    const next = new URLSearchParams(searchParams);
    next.delete('info');
    setSearchParams(next, { replace: true });
  }, [hasThread, searchParams, setSearchParams]);

  function onSelectConversation(item: InboxConversation) {
    navigate(item.href);
  }

  function onViewOwnerFromList(item: InboxConversation) {
    if (item.kind !== 'playmate') {
      navigate(item.href);
      return;
    }
    const base = item.href.split('?')[0] || item.href;
    navigate(`${base}?info=owner`);
  }

  async function onAcceptFromList(item: InboxConversation) {
    if (!myUserId || listActionKey) return;
    setListActionKey(item.key);
    setListError(null);
    try {
      await acceptInboxItem(item, myUserId, token);
      await reloadConversations();
      navigate(item.href);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'قبول درخواست ناموفق بود');
    } finally {
      setListActionKey(null);
    }
  }

  async function onRejectFromList(item: InboxConversation) {
    if (!myUserId || listActionKey) return;
    setListActionKey(item.key);
    setListError(null);
    try {
      await rejectInboxItem(item, myUserId, token);
      await reloadConversations();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'رد درخواست ناموفق بود');
    } finally {
      setListActionKey(null);
    }
  }

  function onBack() {
    if (!desktop && hasThread) {
      navigate('/chats');
      return;
    }
    navigate('/chats');
  }

  async function onAcceptRequest() {
    if (!match || !myUserId || requestBusy || match.direction !== 'incoming') return;
    setRequestBusy(true);
    setActionError(null);
    try {
      const updated = await updatePlaydateStatus(match.id, 'accepted', myUserId);
      const mapped = playdateToMatchRequest(updated, myUserId);
      bootstrappedRef.current = null;
      setMatch(mapped);
      setEnded(Boolean(updated.chatEnded));
      setSecure(Boolean(updated.chatSecure));
      setMessages([
        systemMessage('درخواست پذیرفته شد — چت همبازی فعال شد.'),
        systemMessage('به همبازی جدید سلام کن.'),
      ]);
      void reloadConversations();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'قبول درخواست ناموفق بود');
    } finally {
      setRequestBusy(false);
    }
  }

  async function onRejectRequest() {
    if (!match || !myUserId || requestBusy || match.direction !== 'incoming') return;
    setRequestBusy(true);
    setActionError(null);
    try {
      const updated = await updatePlaydateStatus(match.id, 'rejected', myUserId);
      const mapped = playdateToMatchRequest(updated, myUserId);
      bootstrappedRef.current = null;
      setMatch(mapped);
      setMessages([systemMessage('درخواست همبازی رد شد.')]);
      void reloadConversations();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'رد درخواست ناموفق بود');
    } finally {
      setRequestBusy(false);
    }
  }

  function clearPendingFile() {
    setPendingFile(null);
    setPendingPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function rememberSelection() {
    const ta = inputRef.current;
    if (!ta) return;
    selectionRef.current = {
      start: ta.selectionStart ?? draft.length,
      end: ta.selectionEnd ?? draft.length,
    };
  }

  function insertEmoji(emoji: string) {
    const ta = inputRef.current;
    const sel = selectionRef.current;
    const start = sel?.start ?? ta?.selectionStart ?? draft.length;
    const end = sel?.end ?? ta?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    const caret = start + emoji.length;
    setDraft(next);
    selectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(caret, caret);
    });
  }

  async function onPickFile(fileList: FileList | null) {
    const raw = fileList?.[0];
    if (!raw) return;
    try {
      const file = await prepareChatUploadFile(raw);
      setSendError(null);
      setPendingFile(file);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'انتخاب فایل ناموفق بود');
      clearPendingFile();
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onScrollerScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  async function sendMessage(e?: FormEvent) {
    e?.preventDefault();
    if (ended || sending || !myUserId || !match || match.status !== 'accepted') return;
    const text = draft.trim();
    const file = pendingFile;
    if (!text && !file) return;
    if (file && file.size > MAX_CHAT_ATTACH_BYTES) {
      setSendError('حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)');
      return;
    }
    setSending(true);
    setSendError(null);
    setEmojiOpen(false);
    setDraft('');
    clearPendingFile();
    stickToBottomRef.current = true;
    smoothScrollRef.current = true;
    try {
      const saved = file
        ? await uploadPlaydateChatFile(match.id, myUserId, file, text)
        : await postPlaydateChatMessage(match.id, myUserId, text);
      const ui = toUiMessage(saved, myUserId);
      setMessages((prev) => (prev.some((m) => m.id === ui.id) ? prev : [...prev, ui]));
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, saved.id);
    } catch (err) {
      if (text) setDraft(text);
      if (file) setPendingFile(file);
      setSendError(err instanceof Error ? err.message : 'ارسال پیام ناموفق بود');
    } finally {
      setSending(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  async function sendCapturedMedia(file: File) {
    if (ended || sending || !myUserId || !match || match.status !== 'accepted') {
      throw new Error('چت برای ارسال رسانه آماده نیست');
    }
    if (file.size > MAX_CHAT_ATTACH_BYTES) {
      throw new Error('حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)');
    }
    setSending(true);
    setSendError(null);
    setEmojiOpen(false);
    stickToBottomRef.current = true;
    smoothScrollRef.current = true;
    try {
      const saved = await uploadPlaydateChatFile(match.id, myUserId, file, '');
      const ui = toUiMessage(saved, myUserId);
      setMessages((prev) => (prev.some((m) => m.id === ui.id) ? prev : [...prev, ui]));
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, saved.id);
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  async function toggleSecure() {
    if (!myUserId || !match || ended || match.status !== 'accepted') return;
    setMenuOpen(false);
    const next = !secure;
    setSecure(next);
    setActionError(null);
    setMessages((prev) => [
      ...prev,
      systemMessage(
        next
          ? 'چت امن فعال شد.\nاز این به بعد پیام‌ها قابل ذخیره یا فوروارد نیستند.'
          : 'چت امن خاموش شد. پیام‌های بعدی مثل قبل قابل ذخیره هستند.',
      ),
    ]);
    try {
      await setPlaydateChatSecure(match.id, myUserId, next);
      void reloadConversations();
    } catch (err) {
      setSecure(!next);
      setActionError(err instanceof Error ? err.message : 'تغییر چت امن ناموفق بود');
    }
  }

  async function addContact() {
    if (!myUserId || !peerOwnerId || ended || contactAdded) return;
    setMenuOpen(false);
    setActionError(null);
    try {
      await addUserContact(myUserId, peerOwnerId);
      setContactAdded(true);
      setMessages((prev) => [...prev, systemMessage('مخاطب با موفقیت اضافه شد.')]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'افزودن مخاطب ناموفق بود';
      if (/قبل|already|exists/i.test(msg)) {
        setContactAdded(true);
        setMessages((prev) => [...prev, systemMessage('این شخص از قبل در مخاطبینت بود.')]);
      } else {
        setActionError(msg);
      }
    }
  }

  async function endChat() {
    if (!myUserId || !match || ending || ended || match.status !== 'accepted') return;
    const secureEnded = secureRef.current;
    setMenuOpen(false);
    setEnding(true);
    setActionError(null);
    setEnded(true);
    setInfoCard('none');
    if (secureEnded) {
      setNeedsSecureWipe(true);
      setMessages((prev) => [
        ...prev,
        systemMessage(['چت همبازی پایان یافت.', '', SECURE_WIPE_HINT].join('\n')),
      ]);
    }
    try {
      await endPlaydateChat(match.id, myUserId);
      void reloadConversations();
    } catch (err) {
      try {
        await clearPlaydateChatMessages(match.id, myUserId);
      } catch {
        /* local end still ok */
      }
      setActionError(err instanceof Error ? err.message : 'قطع چت روی سرور ناموفق بود');
    } finally {
      setEnding(false);
      // Secure: stay for wipe CTA. Otherwise exit to inbox.
      if (!secureEnded) {
        navigate('/chats', { replace: true });
      }
    }
  }

  async function wipeConversation() {
    if (!myUserId || !match || wiping) return;
    setWiping(true);
    setActionError(null);
    try {
      await clearPlaydateChatMessages(match.id, myUserId);
      setMessages([systemMessage('گفتگو به‌طور کامل پاک شد.')]);
      lastMsgIdRef.current = 0;
      setWiped(true);
      setNeedsSecureWipe(false);
      // After secure wipe, return to inbox
      window.setTimeout(() => navigate('/chats', { replace: true }), 600);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'پاک‌کردن گفتگو ناموفق بود');
    } finally {
      setWiping(false);
    }
  }



  async function dismissInboxRow(item: InboxConversation) {
    if (!myUserId || dismissing) return;
    setDismissing(true);
    setListError(null);
    try {
      if (item.kind === 'playmate') {
        await dismissPlaydateInbox(item.id, myUserId);
      } else {
        await dismissVetInbox(item.id, myUserId);
      }
      setConversations((prev) => prev.filter((c) => c.key !== item.key));
      if (hasThread && item.kind === 'playmate' && item.id === selectedId) {
        navigate('/chats', { replace: true });
      }
      setDismissConfirm(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'حذف از فهرست ناموفق بود');
    } finally {
      setDismissing(false);
    }
  }

  async function sendGift(amount: number) {
    if (!myUserId || !match || giftBusy) return;
    setGiftBusy(true);
    setGiftError(null);
    try {
      const result = await sendPlaydateGift(match.id, myUserId, amount);
      const ui = toUiMessage(result.message, myUserId);
      setMessages((prev) => (prev.some((m) => m.id === ui.id) ? prev : [...prev, ui]));
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, ui.numericId);
      if (authUser) {
        applyUser({ ...authUser, coins: result.senderCoins });
      } else {
        void refreshMe();
      }
      setGiftOpen(false);
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : 'ارسال هدیه ناموفق بود');
    } finally {
      setGiftBusy(false);
    }
  }

  async function blockPeer() {
    if (!myUserId || !match || blocking) return;
    // playdateToMatchRequest maps peer pet into fromPet
    const blockedUserId = match.fromPet.ownerId;
    if (!blockedUserId || blockedUserId === myUserId) {
      setActionError('کاربر طرف مقابل پیدا نشد');
      return;
    }
    setBlocking(true);
    setMenuOpen(false);
    setActionError(null);
    try {
      await addUserBlock(myUserId, blockedUserId);
      setActionError(null);
      // Also hide from inbox after block
      await dismissPlaydateInbox(match.id, myUserId);
      navigate('/chats', { replace: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'مسدود کردن ناموفق بود');
    } finally {
      setBlocking(false);
    }
  }

  async function removeFromInbox() {
    if (!myUserId || !match || dismissing) return;
    setDismissing(true);
    setMenuOpen(false);
    setActionError(null);
    try {
      await dismissPlaydateInbox(match.id, myUserId);
      setDismissConfirm(null);
      navigate('/chats', { replace: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'حذف از فهرست ناموفق بود');
    } finally {
      setDismissing(false);
    }
  }

  function requestDismissFromList(item: InboxConversation) {
    setDismissConfirm({ source: 'list', item });
  }

  function requestDismissFromThread() {
    setMenuOpen(false);
    setDismissConfirm({ source: 'thread' });
  }

  function cancelDismissConfirm() {
    if (dismissing) return;
    setDismissConfirm(null);
  }

  function confirmDismissPending() {
    if (!dismissConfirm || dismissing) return;
    if (dismissConfirm.source === 'list') {
      void dismissInboxRow(dismissConfirm.item);
      return;
    }
    void removeFromInbox();
  }

  function renderMedia(msg: ChatMsg) {
    const isGift = msg.mediaKind === 'gift';
    const hasFile = Boolean(msg.telegramFileId || msg.storageKey || isGift);
    if (!msg.mediaKind || !hasFile || !myUserId || !match) return null;
    if (isGift) {
      const amt = Number(msg.fileName) || 0;
      return <ChatGiftBubble amount={amt || 0} mine={msg.from === 'me'} />;
    }
    if (brokenMedia[msg.id]) {
      return (
        <div className="tg-media-broken" role="img" aria-label={mediaLabel(msg.mediaKind)}>
          <ImageOff size={18} aria-hidden />
          <span>{mediaLabel(msg.mediaKind)} در دسترس نیست</span>
        </div>
      );
    }
    const src = playdateChatMediaUrl(match.id, msg.numericId, myUserId);
    const markBroken = () =>
      setBrokenMedia((prev) => (prev[msg.id] ? prev : { ...prev, [msg.id]: true }));
    const guardSave = secure
      ? {
          onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
          controlsList: 'nodownload noplaybackrate',
          disablePictureInPicture: true,
        }
      : {};
    if (msg.mediaKind === 'photo' || msg.mediaKind === 'sticker') {
      const img = (
        <img
          className="tg-media-image"
          src={src}
          alt={mediaLabel(msg.mediaKind)}
          loading="lazy"
          draggable={!secure}
          onError={markBroken}
          onContextMenu={secure ? (e) => e.preventDefault() : undefined}
        />
      );
      if (secure) return img;
      return (
        <a className="tg-media-link" href={src} target="_blank" rel="noreferrer">
          {img}
        </a>
      );
    }
    if (
      msg.mediaKind === 'video' ||
      msg.mediaKind === 'animation' ||
      msg.mediaKind === 'video_note'
    ) {
      return (
        <video
          className="tg-media-video"
          src={src}
          controls
          playsInline
          onError={markBroken}
          {...guardSave}
        >
          ویدیو پشتیبانی نمی‌شود
        </video>
      );
    }
    if (msg.mediaKind === 'voice' || msg.mediaKind === 'audio') {
      return (
        <ChatVoicePlayer
          src={src}
          mimeType={msg.mimeType}
          secure={secure}
          onBroken={markBroken}
        />
      );
    }
    if (secure) {
      return (
        <span className="tg-media-file tg-media-file--secure">
          {'📎 '}
          {msg.fileName || mediaLabel(msg.mediaKind)}
        </span>
      );
    }
    return (
      <a className="tg-media-file" href={src} target="_blank" rel="noreferrer">
        {'📎 '}
        {msg.fileName || mediaLabel(msg.mediaKind)}
      </a>
    );
  }

  const shellClass = [
    'tg-chat',
    'tg-chat--shell',
    showList && showThread ? 'tg-chat--split' : '',
    !showList && showThread ? 'tg-chat--thread-only' : '',
    showList && !showThread ? 'tg-chat--list-only' : '',
    secure ? 'tg-chat--secure' : '',
    ended ? 'tg-chat--ended' : '',
    isPendingRequest ? 'tg-chat--pending' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Incomplete registration: don't render broken empty chat chrome — clear CTA instead.
  if (!isProfileComplete) {
    const gateCopy =
      inboxScope === 'trainer'
        ? 'برای دیدن گفتگوهای هماهنگی آموزش آنلاین، اول ثبت‌نام را تمام کن (نام، سن، جنسیت و شهر).'
        : inboxScope === 'vet'
          ? 'برای دیدن گفتگوهای مشاوره دامپزشکی، اول ثبت‌نام را تمام کن (نام، سن، جنسیت و شهر).'
          : 'برای دیدن هم بازی و پیدا کردن همبازی، اول ثبت‌نام را تمام کن (نام، سن، جنسیت و شهر).';
    return (
      <div className="tg-chat tg-chat--gate" dir="rtl">
        <div className="tg-profile-gate">
          <SiteLogo className="tg-chat-empty-logo" height={52} />
          <h1>پروفایلت هنوز کامل نیست</h1>
          <p>{gateCopy}</p>
          <Link to="/onboarding/profile" className="pepito-btn button-1 tg-profile-gate__cta">
            تکمیل پروفایل
          </Link>
          <Link to="/home" className="tg-chat-link-btn">
            بازگشت به پنل
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} dir="rtl">
      <PlaymateGiftSheet
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        balance={Number(authUser?.coins ?? 0)}
        busy={giftBusy}
        error={giftError}
        onSend={sendGift}
      />

      <ConfirmModal
        open={Boolean(dismissConfirm)}
        title="حذف از فهرست گفتگوها"
        confirmLabel="تأیید"
        cancelLabel="انصراف"
        busy={dismissing}
        testId="chat-dismiss-confirm"
        onCancel={cancelDismissConfirm}
        onConfirm={confirmDismissPending}
      >
        <p className="pepito-lead-modal__lead">
          می‌خواهید این گفتگو از فهرست چت‌ها حذف شود؟ تاریخچه طرف مقابل پاک نمی‌شود.
        </p>
      </ConfirmModal>

      {showList ? (
        <ConversationListPane
          conversations={conversations}
          loading={listLoading}
          error={listError}
          scope={inboxScope}
          activeKey={hasThread ? `playmate:${selectedId}` : undefined}
          busyKey={listActionKey}
          ownerConsult={ownerConsult}
          onSelect={onSelectConversation}
          onRefresh={() => void reloadConversations()}
          onAccept={(item) => void onAcceptFromList(item)}
          onReject={(item) => void onRejectFromList(item)}
          onDismiss={requestDismissFromList}
          onViewOwner={onViewOwnerFromList}
        />
      ) : null}

      {showThread ? (
        <section
          className={`tg-thread${!hasThread || threadLoading || !match || !peerPet ? ' tg-thread--blank' : ''}`}
          aria-label="پنجره گفتگو"
        >
          {!hasThread ? (
            <div className="tg-thread-scroll">
              <ThreadEmptyState
                scope={inboxScope}
                desktop={desktop}
                ownerConsult={ownerConsult}
                onFindSent={() => void reloadConversations({ soft: true })}
              />
            </div>
          ) : threadLoading ? (
            <div className="tg-thread-scroll">
              <div className="tg-thread-empty">
                <div className="tg-empty-mark" aria-hidden>
                  <SiteLogo className="tg-chat-empty-logo" height={40} />
                </div>
                <h2>در حال باز کردن چت…</h2>
              </div>
            </div>
          ) : !match || !peerPet ? (
            <div className="tg-thread-scroll">
              <div className="tg-thread-empty">
                <div className="tg-empty-mark" aria-hidden>
                  <SiteLogo className="tg-chat-empty-logo" height={40} />
                </div>
                <h2>گفتگو پیدا نشد</h2>
                <p>این درخواست در دسترس نیست یا مال تو نیست.</p>
                <Link to="/chats" className="tg-chat-link-btn">
                  بازگشت به گفتگوها
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="tg-thread-top">
              <header className="tg-chat-header">
                <button
                  type="button"
                  className="tg-chat-back"
                  onClick={onBack}
                  aria-label="بازگشت"
                >
                  <ArrowRight size={22} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="tg-chat-peer"
                  onClick={() => setInfoCard(infoCard === 'owner' ? 'none' : 'owner')}
                >
                  {peerOwnerAvatar ? (
                    <span className="tg-chat-peer-avatar tg-chat-peer-avatar--photo">
                      <img src={peerOwnerAvatar} alt="" />
                    </span>
                  ) : (
                    <span className="tg-chat-peer-avatar tg-chat-peer-avatar--initials" aria-hidden>
                      {(peerOwnerName || '؟').trim().slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <strong
                      className="tg-peer-name"
                      title="کپی آیدی"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyPeerPublicId();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          void copyPeerPublicId();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {peerOwnerName}
                    </strong>
                    <small>
                      {ended
                        ? 'چت پایان یافته'
                        : isPendingRequest
                          ? incomingPending
                            ? 'درخواست همبازی جدید'
                            : 'منتظر پاسخ درخواست'
                          : isExpiredRequest
                            ? 'درخواست منقضی شده'
                          : isRejectedRequest
                            ? 'درخواست رد شده'
                            : secure
                              ? 'چت امن فعال'
                              : 'فعال در چت همبازی'}{' '}
                      · {peerPet.name}
                    </small>
                    <PresenceBadge presence={peerPresence} />
                  </span>
                </button>

                {chatUnlocked ? (
                  <div className="tg-chat-header-actions" ref={menuRef}>
                    <button
                      type="button"
                      className={`tg-icon-btn tg-secure-toggle${secure ? ' is-on' : ''}`}
                      onClick={() => void toggleSecure()}
                      aria-label={secure ? 'خاموش‌کردن چت امن' : 'فعال‌کردن چت امن'}
                      title={secure ? 'خاموش‌کردن چت امن' : 'فعال‌کردن چت امن'}
                    >
                      {secure ? <Lock size={18} /> : <LockOpen size={18} />}
                    </button>
                    <button
                      type="button"
                      className="tg-icon-btn tg-end-chat-btn"
                      onClick={() => void endChat()}
                      disabled={ending}
                      aria-label="بستن چت"
                      title="بستن چت"
                    >
                      <PhoneOff size={18} />
                    </button>
                    <button
                      type="button"
                      className="tg-icon-btn"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="منوی گفتگو"
                      aria-expanded={menuOpen}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen ? (
                      <div className="tg-chat-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setInfoCard('owner');
                            setMenuOpen(false);
                          }}
                        >
                          <UserRound size={16} /> پروفایل طرف مقابل
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setInfoCard('pet');
                            setMenuOpen(false);
                          }}
                        >
                          <PawPrint size={16} /> پروفایل پت
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void addContact()}
                          disabled={contactAdded}
                        >
                          <UserPlus size={16} />
                          {contactAdded ? 'مخاطب اضافه شد' : 'افزودن مخاطب'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          aria-haspopup="dialog"
                          onClick={requestDismissFromThread}
                          disabled={dismissing}
                        >
                          <Trash2 size={16} />
                          {dismissing ? 'در حال حذف…' : 'حذف از فهرست گفتگوها'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => void blockPeer()}
                          disabled={blocking}
                        >
                          <Ban size={16} />
                          {blocking ? 'در حال مسدود…' : 'مسدود کردن'}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => void endChat()}
                          disabled={ending}
                        >
                          {ending ? 'در حال بستن…' : 'بستن چت'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </header>

              {secure && chatUnlocked ? (
                <div className="tg-secure-strip" role="status">
                  چت امن فعال است — پیام‌ها قابل ذخیره یا فوروارد نیستند
                </div>
              ) : null}
              </div>

              <div
                className="tg-thread-scroll tg-chat-wallpaper"
                ref={scrollerRef}
                onScroll={onScrollerScroll}
              >
                <div className="tg-chat-messages">
                  <article
                    className={`tg-request-card${
                      match.direction === 'incoming' ? ' is-incoming' : ' is-outgoing'
                    }${isPendingRequest ? ' is-pending' : ''}${
                      isRejectedRequest ? ' is-rejected' : ''
                    }`}
                    aria-label="کارت درخواست همبازی"
                  >
                    <div
                      className={`tg-request-card-cover${
                        showPeerPhoto ? '' : ' is-placeholder'
                      }`}
                    >
                      {showPeerPhoto ? (
                        <div className="tg-request-card-photo">
                          <img
                            src={peerPhotoUrl}
                            alt={peerPet.name}
                            loading="lazy"
                            decoding="async"
                            onError={() => setPeerPhotoBroken(true)}
                          />
                        </div>
                      ) : (
                        <span className="tg-request-card-cover-mark" aria-hidden>
                          <PawPrint size={40} strokeWidth={1.75} />
                        </span>
                      )}
                      {peerOwnerAvatar ? (
                        <span
                          className="tg-request-card-owner"
                          title={peerOwnerName || 'صاحب پت'}
                        >
                          <img src={peerOwnerAvatar} alt="" loading="lazy" decoding="async" />
                        </span>
                      ) : (
                        <span
                          className="tg-request-card-owner tg-request-card-owner--initials"
                          title={peerOwnerName || 'صاحب پت'}
                          aria-hidden
                        >
                          {(peerOwnerName || '؟').trim().slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="tg-request-card-body">
                      <p className="tg-request-card-kicker">
                        {incomingPending
                          ? 'درخواست همبازی جدید'
                          : isPendingRequest
                            ? 'درخواست همبازی ارسال شد'
                            : isRejectedRequest
                              ? 'درخواست رد شد'
                              : 'درخواست همبازی'}
                      </p>
                      <h3>
                        {match.rawFromName ?? peerPet.name}
                        {' → '}
                        {match.rawToName ?? match.toPet?.name ?? 'پت شما'}
                      </h3>
                      <ul className="tg-request-card-meta">
                        <li className="tg-request-card-status">
                          #{match.id} ·{' '}
                          {match.statusLabel ??
                            MATCH_STATUS_LABELS[match.status] ??
                            match.status}
                          {isPendingRequest ? (
                            <>
                              {' · '}
                              <RequestCountdown
                                createdAt={match.createdAt}
                                onExpire={() => {
                                  void getPlaydateRequest(match.id).then((req) => {
                                    if (!req || !myUserId) return;
                                    setMatch(playdateToMatchRequest(req, myUserId));
                                    softReloadConversations();
                                  });
                                }}
                              />
                            </>
                          ) : null}
                        </li>
                        {peerPet.breed ? (
                          <li>
                            {PET_TYPE_LABELS[peerPet.type]} · {peerPet.breed}
                          </li>
                        ) : null}
                        {peerPet.city ? <li>{peerPet.city}</li> : null}
                        <li className="tg-request-card-ids">
                          <PublicIdBadge
                            label="شناسه پت:"
                            value={petPublicIdOf({
                              id: peerPet.id,
                              publicId: peerPet.publicId,
                            })}
                            size="sm"
                          />
                          {peerOwnerPublicId ? (
                            <PublicIdBadge
                              label="شناسه صاحب پت:"
                              value={peerOwnerPublicId}
                              size="sm"
                            />
                          ) : peerPet.ownerId ? (
                            <PublicIdBadge
                              label="شناسه صاحب پت:"
                              value={userPublicIdOf({ id: peerPet.ownerId })}
                              size="sm"
                            />
                          ) : null}
                        </li>
                      </ul>
                      {match.message ? (
                        <p className="tg-request-card-msg">«{match.message}»</p>
                      ) : null}
                      {incomingPending ? (
                        <div className="tg-request-card-actions">
                          <button
                            type="button"
                            className="tg-request-accept"
                            disabled={requestBusy}
                            onClick={() => void onAcceptRequest()}
                          >
                            <Check size={16} strokeWidth={2.5} />
                            {requestBusy ? '…' : 'قبول'}
                          </button>
                          <button
                            type="button"
                            className="tg-request-reject"
                            disabled={requestBusy}
                            onClick={() => void onRejectRequest()}
                          >
                            <X size={16} strokeWidth={2.5} />
                            رد
                          </button>
                          <button
                            type="button"
                            className="tg-request-profile"
                            disabled={requestBusy}
                            onClick={() => setInfoCard('owner')}
                          >
                            <UserRound size={16} strokeWidth={2.2} />
                            پروفایل صاحب پت
                          </button>
                        </div>
                      ) : isPendingRequest ? (
                        <p className="tg-request-card-wait" role="status">
                          منتظر پاسخ صاحب {peerPet.name} باش.
                        </p>
                      ) : isExpiredRequest ? (
                        <div className="tg-request-card-actions">
                          <p className="tg-request-card-wait" role="status">
                            این درخواست منقضی شده است.
                          </p>
                          {match.direction === 'outgoing' && peerPet.id ? (
                            <Link to={`/pets/${peerPet.id}`} className="tg-request-accept">
                              درخواست مجدد
                            </Link>
                          ) : null}
                        </div>
                      ) : match.status === 'accepted' ? (
                        <p className="tg-request-card-wait" role="status">
                          به همبازی جدید سلام کن
                        </p>
                      ) : null}
                    </div>
                  </article>
                  {messageBlocks.map((block) => {
                    if (block.day) {
                      return (
                        <div key={block.key} className="tg-day-sep">
                          <span>{block.day}</span>
                        </div>
                      );
                    }
                    const msg = block.msg!;
                    if (msg.from === 'system') {
                      return (
                        <div key={msg.id} className="tg-system-msg">
                          <span>{msg.text}</span>
                        </div>
                      );
                    }
                    const showText =
                      Boolean(msg.text) &&
                      !/^\[(تصویر|ویدیو|پیام صوتی|فایل صوتی|فایل|استیکر|رسانه)\]$/.test(
                        msg.text,
                      );
                    return (
                      <div
                        key={msg.id}
                        className={`tg-bubble-row${msg.from === 'me' ? ' is-out' : ' is-in'}`}
                      >
                        <div
                          className={`tg-bubble${secure ? ' is-protected' : ''}${
                            msg.mediaKind ? ' has-media' : ''
                          }`}
                        >
                          {renderMedia(msg)}
                          {showText ? <p className="tg-bubble-text">{msg.text}</p> : null}
                          {msg.mediaKind && !showText ? (
                            <span className="tg-media-caption">{mediaLabel(msg.mediaKind)}</span>
                          ) : null}
                          <footer className="tg-bubble-meta">
                            <time>{formatClock(msg.at)}</time>
                            {msg.from === 'me' ? (
                              <CheckCheck size={14} className="tg-ticks" aria-hidden />
                            ) : null}
                            {secure ? <Lock size={11} className="tg-lock-ico" aria-hidden /> : null}
                          </footer>
                        </div>
                      </div>
                    );
                  })}

                  {infoCard === 'owner' ? (
                    <div className="tg-info-card">
                      <button
                        type="button"
                        className="tg-info-close"
                        onClick={() => setInfoCard('none')}
                        aria-label="بستن"
                      >
                        <X size={16} />
                      </button>
                      {peerOwnerAvatar ? (
                        <div
                          className="tg-info-owner-cover"
                          style={{ backgroundImage: `url(${peerOwnerAvatar})` }}
                          role="img"
                          aria-label={`عکس پروفایل ${peerOwnerName}`}
                        />
                      ) : (
                        <div className="tg-info-owner-cover tg-info-owner-cover--empty" aria-hidden>
                          <UserRound size={36} strokeWidth={1.5} />
                        </div>
                      )}
                      <h3>پروفایل طرف مقابل</h3>
                      <p className="tg-info-owner-name">{peerOwnerName}</p>
                      {peerOwnerPublicId ? (
                        <p className="tg-info-owner-id-row">
                          <span className="tg-info-owner-id-label">شناسه کاربر/صاحب پت</span>
                          <strong
                            dir="ltr"
                            className="tg-peer-public-id-btn"
                            title="کپی آیدی"
                            role="button"
                            tabIndex={0}
                            onClick={() => void copyPeerPublicId()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void copyPeerPublicId();
                              }
                            }}
                          >
                            {peerOwnerPublicId}
                          </strong>
                        </p>
                      ) : null}
                      <ul>
                        {peerOwnerMeta?.age != null ? <li>سن: {peerOwnerMeta.age}</li> : null}
                        {peerOwnerMeta?.gender ? <li>جنسیت: {peerOwnerMeta.gender}</li> : null}
                        <li>
                          شهر:{' '}
                          {peerOwnerMeta?.city ||
                            peerPet.city ||
                            peerOwnerMeta?.province ||
                            '—'}
                        </li>
                        {peerOwnerMeta?.interests ? (
                          <li>علاقه‌مندی‌ها: {peerOwnerMeta.interests}</li>
                        ) : null}
                        {peerOwnerMeta?.verification ? (
                          <li>🛡️ {peerOwnerMeta.verification}</li>
                        ) : null}
                        <li>محله: {peerPet.neighborhood || '—'}</li>
                        <li>
                          پت: {peerPet.name}
                          {peerPet.id
                            ? ` · ${petPublicIdOf({ id: peerPet.id, publicId: peerPet.publicId })}`
                            : ''}
                        </li>
                      </ul>
                      {peerOwnerMeta?.bio ? (
                        <p className="tg-info-bio">{peerOwnerMeta.bio}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {infoCard === 'pet' ? (
                    <div className="tg-info-card">
                      <button
                        type="button"
                        className="tg-info-close"
                        onClick={() => setInfoCard('none')}
                        aria-label="بستن"
                      >
                        <X size={16} />
                      </button>
                      <div
                        className="tg-info-pet-cover"
                        style={{ backgroundImage: `url(${peerPet.imageUrl})` }}
                      />
                      <h3>
                        {peerPet.emoji} {peerPet.name}
                      </h3>
                      <p className="tg-info-owner-id-row">
                        <span className="tg-info-owner-id-label">شناسه پت</span>
                        <strong dir="ltr" className="tg-peer-public-id-btn">
                          {petPublicIdOf({ id: peerPet.id, publicId: peerPet.publicId })}
                        </strong>
                      </p>
                      <ul>
                        <li>
                          نوع: {PET_TYPE_LABELS[peerPet.type]} · {peerPet.breed}
                        </li>
                        <li>سن: {formatAge(peerPet)}</li>
                        <li>جنسیت: {PET_GENDER_LABELS[peerPet.gender]}</li>
                        <li>جثه: {PET_SIZE_LABELS[peerPet.size]}</li>
                        <li>واکسن: {peerPet.vaccinated ? 'زده' : 'نزده'}</li>
                      </ul>
                      {peerPet.bio ? <p className="tg-info-bio">{peerPet.bio}</p> : null}
                      <Link to={`/pets/${peerPet.id}`} className="tg-chat-link-btn">
                        مشاهده کامل پروفایل پت
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="tg-thread-foot">
              {actionError ? <p className="tg-error">{actionError}</p> : null}
              {sendError ? <p className="tg-error">{sendError}</p> : null}

              {!chatUnlocked && !ended ? (
                <div className="tg-request-composer-bar" role="status">
                  {incomingPending
                    ? 'برای شروع چت، درخواست را قبول یا رد کن.'
                    : isExpiredRequest
                      ? 'این درخواست منقضی شده است.'
                    : isRejectedRequest
                      ? 'این درخواست رد شده است.'
                      : 'چت بعد از قبول درخواست فعال می‌شود.'}
                </div>
              ) : chatUnlocked ? (
                <>
                  <PlaymateChatToolbar
                    disabled={sending || ending || giftBusy}
                    secure={secure}
                    showSecure
                    onToggleSecure={() => void toggleSecure()}
                    onOpenGift={() => {
                      setGiftError(null);
                      setGiftOpen(true);
                    }}
                  />
                  {pendingFile ? (
                    <div className="tg-attach-preview">
                      {pendingPreview ? (
                        (pendingFile.type || '').startsWith('video/') ? (
                          <video
                            src={pendingPreview}
                            className="tg-attach-thumb tg-attach-thumb--video"
                            muted
                            playsInline
                          />
                        ) : (pendingFile.type || '').startsWith('audio/') ? (
                          <audio
                            src={pendingPreview}
                            className="tg-attach-thumb tg-attach-thumb--audio"
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <img src={pendingPreview} alt="" className="tg-attach-thumb" />
                        )
                      ) : (
                        <span className="tg-attach-name">📎 {pendingFile.name}</span>
                      )}
                      <button
                        type="button"
                        className="tg-attach-clear"
                        onClick={clearPendingFile}
                        aria-label="حذف فایل"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                  {/*
                    Telegram-style composer: LTR chrome so Send stays on the physical RIGHT.
                    Attach + emoji on physical LEFT; textarea keeps RTL/auto Persian text.
                  */}
                  <div className="tg-composer-shell">
                    <ChatMediaCaptureProvider
                      disabled={sending}
                      onOccupiedChange={setCaptureOccupied}
                      onError={(msg) => setSendError(msg)}
                      onSend={sendCapturedMedia}
                    >
                    <EmojiPicker
                      open={emojiOpen && !captureOccupied}
                      onClose={() => setEmojiOpen(false)}
                      onPick={insertEmoji}
                    />
                    {captureOccupied ? null : (
                    <form
                      className="tg-composer"
                      dir="ltr"
                      onSubmit={(e) => {
                        void sendMessage(e);
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="tg-file-input"
                        accept={CHAT_FILE_ACCEPT}
                        onChange={(e) => {
                          void onPickFile(e.target.files);
                        }}
                        aria-hidden
                        tabIndex={-1}
                      />
                      <button
                        type="button"
                        className="tg-attach"
                        onClick={() => {
                          setEmojiOpen(false);
                          fileInputRef.current?.click();
                        }}
                        disabled={sending}
                        aria-label="پیوست فایل"
                        title="پیوست عکس یا فایل"
                      >
                        <Paperclip size={20} />
                      </button>
                      <button
                        type="button"
                        className={`tg-emoji-btn${emojiOpen ? ' is-open' : ''}`}
                        onClick={() => setEmojiOpen((v) => !v)}
                        disabled={sending}
                        aria-label="ایموجی"
                        aria-expanded={emojiOpen}
                        title="ایموجی"
                      >
                        <Smile size={20} />
                      </button>
                      <textarea
                        ref={inputRef}
                        dir="auto"
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          rememberSelection();
                        }}
                        onSelect={rememberSelection}
                        onClick={rememberSelection}
                        onKeyUp={rememberSelection}
                        onBlur={rememberSelection}
                        onKeyDown={onComposerKeyDown}
                        placeholder={
                          pendingFile
                            ? 'کپشن (اختیاری)…'
                            : secure
                              ? 'پیام امن…'
                              : 'پیام…'
                        }
                        aria-label="متن پیام"
                        rows={1}
                        autoComplete="off"
                        enterKeyHint="send"
                      />
                      {draft.trim() || pendingFile ? (
                        <button
                          type="submit"
                          className={`tg-send${sending ? ' is-sending' : ''}`}
                          disabled={(!draft.trim() && !pendingFile) || sending}
                          aria-label="ارسال"
                        >
                          {sending ? <Loader2 size={18} className="tg-spin" /> : <Send size={18} />}
                        </button>
                      ) : (
                        <ChatMediaCaptureTriggers />
                      )}
                    </form>
                    )}
                    </ChatMediaCaptureProvider>
                  </div>
                </>
              ) : (
                <div className={`tg-ended-bar${needsSecureWipe ? ' is-secure-wipe' : ''}`}>
                  <p>
                    {wiped
                      ? 'گفتگو کاملاً پاک شد.'
                      : needsSecureWipe
                        ? SECURE_WIPE_HINT
                        : CHAT_WIPE_HINT}
                  </p>
                  <div className="tg-ended-actions">
                    <button
                      type="button"
                      className="tg-wipe-btn"
                      onClick={() => void wipeConversation()}
                      disabled={wiping || wiped}
                      data-testid="playmate-wipe-chat"
                    >
                      {wiped ? (
                        <>
                          <Check size={16} /> پاک شد
                        </>
                      ) : wiping ? (
                        'در حال پاک‌کردن…'
                      ) : (
                        'حذف کل چت'
                      )}
                    </button>
                    <Link to="/chats" className="tg-chat-link-btn tg-chat-link-btn--outline">
                      بازگشت به همبازی
                    </Link>
                  </div>
                </div>
              )}
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
