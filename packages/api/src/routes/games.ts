import { Router, type Request, type Response } from 'express';
import type { GameStatus, GameType } from '@petdate/shared';
import { dbService } from '../db';
import { parsePositiveIntId } from './parse-positive-int-id';

export { parsePositiveIntId } from './parse-positive-int-id';

export const gamesRouter = Router();

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
  const games = dbService.listGames({ sectionId, status, gameType });
  res.json(games);
}

gamesRouter.get('/', listGamesHandler);
/** Alias used by some clients / scanners — must be before `/:id`. */
gamesRouter.get('/list', listGamesHandler);

gamesRouter.get('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
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

  const game = dbService.createGame({
    title,
    gameType,
    sectionId: parsedSection ?? host.sectionId,
    hostUserId: hostId,
    location,
    scheduledAt,
    maxPlayers: maxParsed ?? 10,
    description,
  });
  res.status(201).json(game);
});

gamesRouter.post('/:id/join', (req, res) => {
  const gameId = parsePositiveIntId(req.params.id);
  if (gameId == null) {
    res.status(400).json({ error: 'شناسه بازی نامعتبر است' });
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
    res.status(400).json({ error: result.error, game: result.game });
    return;
  }
  res.json(result.game);
});
