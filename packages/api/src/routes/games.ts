import fs from 'fs';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { Game, GameStatus, GameType } from '@petdate/shared';
import {
  EVENT_CREATE_COST,
  EVENT_GAME_TYPES,
  MAX_EVENT_JOIN_FEE_COINS,
  sanitizeGamePhotoForViewer,
} from '@petdate/shared';
import { dbService } from '../db';
import { parsePositiveIntId } from './parse-positive-int-id';
import {
  MAX_EVENT_PHOTO_BYTES,
  mimeFromEventPhotoKey,
  resolveEventPhotoPath,
  saveEventPhoto,
} from '../services/event-photo-store';
import { getUserFromBearer } from '../services/web-otp';

export { parsePositiveIntId } from './parse-positive-int-id';

export const gamesRouter = Router();

const eventPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVENT_PHOTO_BYTES, files: 1 },
});

function viewerUserId(req: { header: (name: string) => string | undefined }): number | undefined {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  return session?.user?.id;
}

function presentGame(game: Game, viewerId?: number): Game {
  return sanitizeGamePhotoForViewer(game, viewerId);
}

const PET_EVENT_TYPE_SET = new Set<string>(EVENT_GAME_TYPES as readonly string[]);
const LEGACY_TYPES = new Set([
  'football',
  'volleyball',
  'basketball',
  'futsal',
  'tennis',
  'board',
  'other',
]);

function isValidGameType(raw: unknown): raw is GameType {
  const s = String(raw || '').trim();
  return PET_EVENT_TYPE_SET.has(s) || LEGACY_TYPES.has(s);
}

function listGamesHandler(req: Request, res: Response): void {
  let sectionId: number | undefined;
  if (req.query.sectionId != null && String(req.query.sectionId).trim() !== '') {
    const parsed = parsePositiveIntId(req.query.sectionId);
    if (parsed == null) {
      res.status(400).json({ error: 'شناسه بخش نامعتبر است' });
      return;
    }
    sectionId = parsed;
  }
  const status = req.query.status as GameStatus | undefined;
  const gameType = req.query.gameType as GameType | undefined;
  const viewerId = viewerUserId(req);
  const games = dbService.listGames({ sectionId, status, gameType });
  const rows = (Array.isArray(games) ? games : []).map((g) => presentGame(g, viewerId));
  res.json(rows);
}

// /list must be registered before /:id — otherwise "list" becomes NaN and
// Postgres `WHERE id = $1` throws (live 500 «خطای داخلی سرور»).
gamesRouter.get('/', listGamesHandler);
gamesRouter.get('/list', listGamesHandler);

/** Pet event types for create forms */
gamesRouter.get('/meta/types', (_req, res) => {
  res.json({
    types: EVENT_GAME_TYPES,
    createCostCoins: EVENT_CREATE_COST,
    maxJoinFeeCoins: MAX_EVENT_JOIN_FEE_COINS,
  });
});

gamesRouter.post('/photos/upload', (req, res) => {
  eventPhotoUpload.single('file')(req, res, (uploadErr) => {
    void (async () => {
      if (uploadErr) {
        const tooLarge =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge
            ? 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)'
            : 'آپلود عکس ناموفق بود',
        });
        return;
      }

      const session = getUserFromBearer(req.header('authorization') ?? undefined);
      if (!session) {
        res.status(401).json({ error: 'وارد نشده‌اید' });
        return;
      }

      const hostUserId = Number(
        (req.body as { hostUserId?: string })?.hostUserId ??
          req.query.hostUserId ??
          session.user.id
      );
      const file = req.file;

      if (!Number.isFinite(hostUserId) || hostUserId <= 0) {
        res.status(400).json({ error: 'hostUserId الزامی است' });
        return;
      }
      if (hostUserId !== session.user.id) {
        res.status(403).json({ error: 'فقط صاحب حساب می‌تواند عکس آپلود کند' });
        return;
      }
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'فایل عکس الزامی است' });
        return;
      }

      const host = dbService.getUserById(hostUserId);
      if (!host) {
        res.status(404).json({ error: 'میزبان پیدا نشد' });
        return;
      }

      try {
        const saved = await saveEventPhoto({
          hostUserId,
          originalName: file.originalname || 'event.jpg',
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        res.status(201).json({
          ok: true,
          url: saved.urlPath,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
          photoStatus: 'pending',
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'FILE_TOO_LARGE') {
          res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
          return;
        }
        if (code === 'INVALID_MIME' || code === 'INVALID_IMAGE') {
          res.status(400).json({
            error:
              code === 'INVALID_IMAGE'
                ? 'فایل عکس قابل پردازش نیست. یک عکس دیگر انتخاب کن'
                : 'فقط عکس مجاز است (JPG، PNG، WebP، HEIC، GIF)',
          });
          return;
        }
        console.warn('event photo upload failed:', (err as Error).message);
        res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
      }
    })();
  });
});

gamesRouter.get('/photos/:hostUserId/:filename', (req, res) => {
  const hostUserId = String(req.params.hostUserId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${hostUserId}/${filename}`;
  const abs = resolveEventPhotoPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Content-Type', mimeFromEventPhotoKey(storageKey));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  fs.createReadStream(abs).pipe(res);
});

gamesRouter.get('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه ایونت نامعتبر است' });
    return;
  }
  const game = dbService.getGame(id);
  if (!game) {
    res.status(404).json({ error: 'ایونت پیدا نشد' });
    return;
  }
  const players = dbService.getGamePlayers(game.id);
  const viewerId = viewerUserId(req);
  res.json({ ...presentGame(game, viewerId), players });
});

gamesRouter.post('/', (req, res) => {
  const {
    title,
    gameType,
    sectionId,
    hostUserId,
    location,
    scheduledAt,
    maxPlayers,
    description,
    province,
    city,
    services,
    joinFeeCoins,
    photoUrl,
  } = req.body;

  if (!title || !gameType || !hostUserId || !scheduledAt) {
    res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
    return;
  }

  const prov = String(province ?? '').trim();
  const cityName = String(city ?? '').trim();
  const loc = String(location ?? '').trim();
  if (!prov || !cityName) {
    if (!loc) {
      res.status(400).json({ error: 'استان و شهر الزامی است' });
      return;
    }
  }

  if (!isValidGameType(gameType)) {
    res.status(400).json({ error: 'نوع ایونت نامعتبر است' });
    return;
  }

  const hostId = parsePositiveIntId(hostUserId);
  if (hostId == null) {
    res.status(400).json({ error: 'شناسه میزبان نامعتبر است' });
    return;
  }

  const host = dbService.getUserById(hostId);
  if (!host) {
    res.status(404).json({ error: 'میزبان پیدا نشد' });
    return;
  }

  let parsedSection: number | undefined;
  if (sectionId != null && String(sectionId).trim() !== '') {
    const s = parsePositiveIntId(sectionId);
    if (s == null) {
      res.status(400).json({ error: 'شناسه بخش نامعتبر است' });
      return;
    }
    parsedSection = s;
  }

  const maxParsed = maxPlayers != null ? parsePositiveIntId(maxPlayers) : null;
  const feeRaw = Number(joinFeeCoins);
  const fee = Number.isFinite(feeRaw)
    ? Math.min(MAX_EVENT_JOIN_FEE_COINS, Math.max(0, Math.floor(feeRaw)))
    : 0;

  const result = dbService.createGame({
    title: String(title).trim(),
    gameType: gameType as GameType,
    sectionId: parsedSection ?? host.sectionId,
    hostUserId: hostId,
    location: loc || [cityName, prov].filter(Boolean).join('، '),
    scheduledAt,
    maxPlayers: maxParsed ?? 10,
    description: description != null ? String(description).trim() : undefined,
    province: prov || undefined,
    city: cityName || undefined,
    services: services != null ? String(services).trim() : undefined,
    joinFeeCoins: fee,
    photoUrl: photoUrl != null ? String(photoUrl).trim() : undefined,
  });

  if (result.error) {
    const status = result.need != null ? 402 : 400;
    res.status(status).json({
      error: result.error,
      need: result.need,
      balance: result.balance,
      createCostCoins: EVENT_CREATE_COST,
    });
    return;
  }

  res.status(201).json(presentGame(result.game, hostId));
});

gamesRouter.post('/:id/join', (req, res) => {
  const gameId = parsePositiveIntId(req.params.id);
  if (gameId == null) {
    res.status(400).json({ error: 'شناسه ایونت نامعتبر است' });
    return;
  }

  const { userId, telegramId } = req.body;
  let uid = userId != null ? parsePositiveIntId(userId) ?? undefined : undefined;
  if (!uid && telegramId) {
    const user = dbService.getUserByTelegramId(telegramId);
    if (!user) {
      res.status(404).json({ error: 'کاربر پیدا نشد' });
      return;
    }
    uid = user.id;
  }
  if (!uid) {
    res.status(400).json({ error: 'شناسه کاربر لازم است' });
    return;
  }

  const result = dbService.joinGame(gameId, uid);
  if (result.error) {
    const status = result.need != null ? 402 : 400;
    res.status(status).json({
      error: result.error,
      game: result.game ? presentGame(result.game, uid) : undefined,
      need: result.need,
      balance: result.balance,
    });
    return;
  }
  res.json(presentGame(result.game, uid));
});
