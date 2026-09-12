import { Router } from 'express';
import type { GameStatus, GameType } from '@petdate/shared';
import { dbService } from '../db';

export const gamesRouter = Router();

function parseGameId(raw: string | undefined): number | null {
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function listGamesHandler(
  req: { query: { sectionId?: string; status?: string; gameType?: string } },
  res: { json: (body: unknown) => void }
) {
  const sectionRaw = req.query.sectionId ? Number(req.query.sectionId) : undefined;
  const sectionId = sectionRaw != null && Number.isFinite(sectionRaw) ? sectionRaw : undefined;
  const status = req.query.status as GameStatus | undefined;
  const gameType = req.query.gameType as GameType | undefined;
  const games = dbService.listGames({ sectionId, status, gameType });
  res.json(games);
}

// /list must be registered before /:id — otherwise "list" becomes NaN and
// Postgres `WHERE id = $1` throws (live 500 «خطای داخلی سرور»).
gamesRouter.get('/', listGamesHandler);
gamesRouter.get('/list', listGamesHandler);

gamesRouter.get('/:id', (req, res) => {
  const id = parseGameId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: 'شناسه بازی نامعتبر است' });
    return;
  }
  const game = dbService.getGame(id);
  if (!game) {
    res.status(404).json({ error: 'بازی پیدا نشد' });
    return;
  }
  const players = dbService.getGamePlayers(game.id);
  res.json({ ...game, players });
});

gamesRouter.post('/', (req, res) => {
  const { title, gameType, sectionId, hostUserId, location, scheduledAt, maxPlayers, description } =
    req.body;

  if (!title || !gameType || !hostUserId || !location || !scheduledAt) {
    res.status(400).json({ error: 'فیلدهای الزامی را پر کنید' });
    return;
  }

  const host = dbService.getUserById(Number(hostUserId));
  if (!host) {
    res.status(404).json({ error: 'میزبان پیدا نشد' });
    return;
  }

  const game = dbService.createGame({
    title,
    gameType,
    sectionId: sectionId ? Number(sectionId) : host.sectionId,
    hostUserId: Number(hostUserId),
    location,
    scheduledAt,
    maxPlayers: maxPlayers ? Number(maxPlayers) : 10,
    description,
  });
  res.status(201).json(game);
});

gamesRouter.post('/:id/join', (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (gameId == null) {
    res.status(400).json({ error: 'شناسه بازی نامعتبر است' });
    return;
  }
  const { userId, telegramId } = req.body;
  let uid = userId ? Number(userId) : undefined;
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
    res.status(400).json({ error: result.error, game: result.game });
    return;
  }
  res.json(result.game);
});
