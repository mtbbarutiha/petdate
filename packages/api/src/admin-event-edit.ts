/**
 * Validate an admin event edit body before it hits the games row.
 */
import {
  EVENT_GAME_TYPES,
  MAX_EVENT_JOIN_FEE_COINS,
  type Game,
  type GamePhotoStatus,
  type GameStatus,
  type GameType,
} from '@petdate/shared';

const STATUSES: readonly GameStatus[] = ['open', 'full', 'cancelled', 'completed'];
const PHOTO: readonly GamePhotoStatus[] = ['pending', 'approved', 'rejected'];

export type EventEditInput = {
  title: string;
  gameType: GameType;
  hostUserId?: number;
  hostName?: string;
  location: string;
  province?: string;
  city?: string;
  scheduledAt: string;
  maxPlayers: number;
  description?: string;
  services?: string;
  joinFeeCoins: number;
  photoUrl?: string;
  photoStatus?: GamePhotoStatus;
  status: GameStatus;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

export function parseEventEditPayload(
  body: Record<string, unknown>,
  existing?: Partial<Game>
): { ok: true; value: EventEditInput } | { ok: false; error: string } {
  const title = str(body.title ?? existing?.title);
  if (!title || title.length > 200) {
    return { ok: false, error: 'عنوان ایونت الزامی است' };
  }

  const typeRaw = str(body.gameType ?? existing?.gameType) as GameType;
  if (!EVENT_GAME_TYPES.includes(typeRaw) && typeRaw !== existing?.gameType) {
    return { ok: false, error: 'نوع ایونت نامعتبر است' };
  }
  const gameType = (EVENT_GAME_TYPES.includes(typeRaw) ? typeRaw : existing?.gameType) as GameType;
  if (!gameType) return { ok: false, error: 'نوع ایونت نامعتبر است' };

  const statusRaw = str(body.status ?? existing?.status) as GameStatus;
  if (!STATUSES.includes(statusRaw)) {
    return { ok: false, error: 'وضعیت نامعتبر' };
  }

  const maxRaw = body.maxPlayers ?? body.capacity ?? existing?.maxPlayers;
  const maxPlayers = Math.floor(Number(maxRaw));
  if (!Number.isFinite(maxPlayers) || maxPlayers < 1 || maxPlayers > 5000) {
    return { ok: false, error: 'ظرفیت نامعتبر است' };
  }

  const feeRaw = body.joinFeeCoins ?? existing?.joinFeeCoins ?? 0;
  const joinFeeCoins = Math.min(
    MAX_EVENT_JOIN_FEE_COINS,
    Math.max(0, Math.floor(Number(feeRaw) || 0))
  );

  let scheduledAt = str(body.scheduledAt ?? existing?.scheduledAt);
  if (!scheduledAt) return { ok: false, error: 'زمان ایونت الزامی است' };
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(scheduledAt) && !scheduledAt.endsWith('Z')) {
    const parsed = new Date(scheduledAt);
    if (!Number.isNaN(parsed.getTime())) scheduledAt = parsed.toISOString();
  }

  const location = str(body.location ?? existing?.location) || '—';
  const province = str(body.province ?? existing?.province) || undefined;
  const city = str(body.city ?? existing?.city) || undefined;
  const description = str(body.description ?? existing?.description) || undefined;
  const services = str(body.services ?? existing?.services) || undefined;
  const photoUrl = str(body.photoUrl ?? existing?.photoUrl) || undefined;

  let photoStatus: GamePhotoStatus | undefined;
  if (body.photoStatus != null && str(body.photoStatus)) {
    const raw = str(body.photoStatus) as GamePhotoStatus;
    if (!PHOTO.includes(raw)) return { ok: false, error: 'وضعیت عکس نامعتبر است' };
    photoStatus = raw;
  } else if (photoUrl && photoUrl !== existing?.photoUrl) {
    photoStatus = 'pending';
  }

  const hostIdRaw = body.hostUserId ?? body.host_user_id;
  let hostUserId: number | undefined;
  if (hostIdRaw != null && String(hostIdRaw).trim() !== '') {
    const n = Math.floor(Number(hostIdRaw));
    if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'شناسه میزبان نامعتبر است' };
    hostUserId = n;
  }
  const hostName = str(body.hostName) || undefined;

  return {
    ok: true,
    value: {
      title,
      gameType,
      hostUserId,
      hostName,
      location,
      province,
      city,
      scheduledAt,
      maxPlayers,
      description,
      services,
      joinFeeCoins,
      photoUrl,
      photoStatus,
      status: statusRaw,
    },
  };
}
