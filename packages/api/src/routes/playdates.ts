import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import type { PlaydateChatMediaKind, PlaydateStatus } from '@petdate/shared';
import { userCommandIdOf } from '@petdate/shared';
import { dbService } from '../db';
import { notifyPlaydateRequestTelegram } from '../services/telegram-playdate-notify';
import {
  notifyPlaydateChatEndedTelegram,
  notifyPlaydateChatSecureTelegram,
  notifyPlaydateChatTelegram,
  resolveTelegramFile,
  wipePlaydateChatTelegram,
} from '../services/telegram-chat-notify';
import { normalizeTelegramId } from '../services/telegram-id';
import {
  MAX_UPLOAD_BYTES,
  deleteChatUpload,
  inferMediaKind,
  normalizeChatUploadFile,
  purgeChatUploadFolder,
  resolveStoragePath,
  saveChatUpload,
} from '../services/chat-upload-store';
import { startOwnerChatFromApi } from '../services/telegram-owner-chat-start';
import { clearBotOwnerChatSessions } from '../services/bot-owner-chat-session';
import {
  notifyInbox,
  notifyPlaymateMessage,
  notifyPlaymateThread,
} from '../ws/chatHub';

const VALID_STATUSES: PlaydateStatus[] = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
];

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export const playdatesRouter = Router();

function purgePlaydateUploads(playdateId: number): void {
  for (const key of dbService.listPlaydateChatStorageKeys(playdateId)) {
    deleteChatUpload(key);
  }
  purgeChatUploadFolder(playdateId);
}

function peerTelegramIds(playdate: NonNullable<ReturnType<typeof dbService.getPlaydateRequest>>, exceptUserId?: number): string[] {
  const ids: string[] = [];
  for (const userId of [playdate.fromUserId, playdate.toUserId]) {
    if (!userId || userId === exceptUserId) continue;
    const user = dbService.getUserById(userId);
    if (user?.telegramId) ids.push(user.telegramId);
  }
  // Fallback via pets if toUserId missing
  if (!playdate.toUserId) {
    const ownerId = dbService.getPet(playdate.toPetId)?.ownerId;
    if (ownerId && ownerId !== exceptUserId) {
      const user = dbService.getUserById(ownerId);
      if (user?.telegramId) ids.push(user.telegramId);
    }
  }
  return [...new Set(ids)];
}


function enrichPlaydate(req: ReturnType<typeof dbService.getPlaydateRequest>) {
  if (!req) return null;
  return {
    ...req,
    fromPet: dbService.getPet(req.fromPetId) ?? undefined,
    toPet: dbService.getPet(req.toPetId) ?? undefined,
  };
}

function requireParticipant(playdateId: number, userId: number) {
  const playdate = dbService.getPlaydateRequest(playdateId);
  if (!playdate) return { error: 'not_found' as const };
  if (!dbService.isPlaydateParticipant(playdate, userId)) {
    return { error: 'forbidden' as const, playdate };
  }
  return { playdate };
}

function isUsableTelegramId(telegramId: string | null | undefined): boolean {
  const id = String(telegramId ?? '').trim();
  if (!id) return false;
  // Demo / seed accounts and placeholders never have a real bot chat.
  if (/^(fake_|demo_)/i.test(id)) return false;
  return true;
}

/**
 * Web/API → Telegram fan-out for a playdate chat line.
 * Always delivers one copy to the peer. Also echoes a labeled copy to the
 * sender's own bot chat (web→self sync). Callers that set skipTelegram must
 * not invoke this — the bot already shows the sender's typed line.
 */
function fanOutPlaydateChatTelegram(opts: {
  playdate: NonNullable<ReturnType<typeof dbService.getPlaydateRequest>>;
  senderUserId: number;
  text: string;
  mediaKind?: PlaydateChatMediaKind | string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}): void {
  const { playdate, senderUserId } = opts;
  let peerUserId =
    playdate.fromUserId === senderUserId ? playdate.toUserId : playdate.fromUserId;
  if (!peerUserId) {
    const peerPetId =
      playdate.fromUserId === senderUserId ? playdate.toPetId : playdate.fromPetId;
    peerUserId = dbService.getPet(peerPetId)?.ownerId;
  }
  const peer = peerUserId ? dbService.getUserById(peerUserId) : null;
  const sender = dbService.getUserById(senderUserId);
  const senderName = sender?.name || 'همبازی';
  const peerTg = normalizeTelegramId(peer?.telegramId);
  const senderTg = normalizeTelegramId(sender?.telegramId);
  const common = {
    senderName,
    text: opts.text,
    playdateId: playdate.id,
    protectContent: Boolean(playdate.chatSecure),
    mediaKind: (opts.mediaKind ?? null) as PlaydateChatMediaKind | null,
    storageKey: opts.storageKey,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
  };

  if (peerTg) {
    void notifyPlaydateChatTelegram({
      ...common,
      toTelegramId: peerTg,
    });
  }
  // Self-echo so the sender's bot session mirrors what they sent on web.
  if (senderTg && senderTg !== peerTg) {
    void notifyPlaydateChatTelegram({
      ...common,
      toTelegramId: senderTg,
      asSelf: true,
    });
  }
}

/** Fire-and-forget Telegram notify to recipient (bot-equivalent). */
async function notifyNewPlaydateTelegram(
  request: NonNullable<ReturnType<typeof enrichPlaydate>>
): Promise<boolean> {
  const toUserId =
    request.toUserId ?? dbService.getPet(request.toPetId)?.ownerId ?? undefined;
  if (!toUserId || !request.fromPet || !request.toPet) return false;
  const owner = dbService.getUserById(toUserId);
  if (!isUsableTelegramId(owner?.telegramId)) return false;
  return notifyPlaydateRequestTelegram({
    requestId: request.id,
    toTelegramId: owner!.telegramId!,
    fromPet: request.fromPet,
    toPetName: request.toPet.name,
  });
}

async function openOwnerChatOnAccept(
  request: NonNullable<ReturnType<typeof enrichPlaydate>>,
  previousStatus: PlaydateStatus
): Promise<boolean> {
  if (request.status !== 'accepted' || previousStatus === 'accepted') return false;
  const fromUser = dbService.getUserById(request.fromUserId);
  const toUserId =
    request.toUserId ?? dbService.getPet(request.toPetId)?.ownerId ?? undefined;
  const toUser = toUserId ? dbService.getUserById(toUserId) : null;
  if (!fromUser || !toUser) return false;

  // Recipient (toUser) is the accepter in the normal flow.
  return startOwnerChatFromApi({
    playdateId: request.id,
    accepter: toUser,
    requester: fromUser,
    fromPetName: request.fromPet?.name,
    toPetName: request.toPet?.name,
    fromPetId: request.fromPetId,
    toPetId: request.toPetId,
  });
}

playdatesRouter.get('/', (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const petId = req.query.petId ? Number(req.query.petId) : undefined;
  const status = req.query.status as PlaydateStatus | undefined;

  dbService.expireStalePlaydateRequests();
  const requests = dbService
    .listPlaydateRequests({ userId, petId, status })
    .map((r) => enrichPlaydate(r)!);
  res.json(requests);
});

playdatesRouter.get('/active-owner-chat', (req, res) => {
  const telegramId = String(req.query.telegramId ?? '').trim();
  if (!telegramId) {
    res.status(400).json({ error: 'telegramId الزامی است' });
    return;
  }
  const user = dbService.getUserByTelegramId(telegramId);
  if (!user) {
    res.json(null);
    return;
  }

  const accepted = dbService.listPlaydateRequests({ userId: user.id, status: 'accepted' });
  // newest first — skip ended chats so bot does not resume a closed session
  const sorted = [...accepted].filter((pd) => !pd.chatEnded).sort((a, b) => b.id - a.id);
  for (const pd of sorted) {
    const fromUser = dbService.getUserById(pd.fromUserId);
    const toUserId = pd.toUserId ?? dbService.getPet(pd.toPetId)?.ownerId;
    const toUser = toUserId ? dbService.getUserById(toUserId) : null;
    if (!fromUser?.telegramId || !toUser?.telegramId) continue;
    if (fromUser.telegramId.startsWith('fake_') || toUser.telegramId.startsWith('fake_')) continue;

    const iAmFrom = fromUser.id === user.id;
    const peer = iAmFrom ? toUser : fromUser;
    const peerPublicId = userCommandIdOf(peer);
    res.json({
      playdateId: pd.id,
      peerTelegramId: peer.telegramId,
      peerUserId: peer.id,
      myPetId: iAmFrom ? pd.fromPetId : pd.toPetId,
      peerPetId: iAmFrom ? pd.toPetId : pd.fromPetId,
      peerPublicId,
      // Legacy field — command-safe id so old bots never show @username/name
      peerName: peerPublicId,
      chatSecure: Boolean(pd.chatSecure),
    });
    return;
  }
  res.json(null);
});

playdatesRouter.get('/:id/messages', (req, res) => {
  const playdateId = Number(req.params.id);
  const userId = Number(req.query.userId);
  if (!Number.isFinite(playdateId) || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }

  const afterId = req.query.afterId ? Number(req.query.afterId) : undefined;
  const messages = dbService.listPlaydateChatMessages(playdateId, {
    afterId: Number.isFinite(afterId) ? afterId : undefined,
  });
  res.json(messages);
});

playdatesRouter.post('/:id/messages', async (req, res) => {
  const playdateId = Number(req.params.id);
  const senderUserId = Number(req.body?.senderUserId ?? req.body?.userId);
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const mediaKind = typeof req.body?.mediaKind === 'string' ? req.body.mediaKind : undefined;
  const telegramFileId =
    typeof req.body?.telegramFileId === 'string' ? req.body.telegramFileId : undefined;
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined;
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : undefined;
  /** When true, skip Telegram fan-out (bot already delivered the line). */
  const skipTelegram = Boolean(req.body?.skipTelegram);

  if (!Number.isFinite(playdateId) || !Number.isFinite(senderUserId)) {
    res.status(400).json({ error: 'شناسه درخواست و senderUserId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, senderUserId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.playdate.status !== 'accepted') {
    res.status(409).json({ error: 'چت فقط بعد از قبول درخواست فعال است' });
    return;
  }
  if (gate.playdate.chatEnded) {
    res.status(409).json({ error: 'این چت قطع شده است' });
    return;
  }

  try {
    const message = dbService.createPlaydateChatMessage({
      playdateId,
      senderUserId,
      text,
      mediaKind,
      telegramFileId,
      mimeType,
      fileName,
    });

    if (!skipTelegram) {
      fanOutPlaydateChatTelegram({
        playdate: gate.playdate,
        senderUserId,
        text: message.text,
        mediaKind: message.mediaKind,
        storageKey: message.storageKey,
        mimeType: message.mimeType,
        fileName: message.fileName,
      });
    }

    const playdate = gate.playdate;
    const participants = [playdate.fromUserId, playdate.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    );
    notifyPlaymateMessage(playdateId, message, participants);
    res.status(201).json(message);
  } catch (err) {
    if (err instanceof Error && err.message === 'EMPTY_TEXT') {
      res.status(400).json({ error: 'متن پیام خالی است' });
      return;
    }
    if (err instanceof Error && err.message === 'TEXT_TOO_LONG') {
      res.status(400).json({ error: 'پیام خیلی طولانی است' });
      return;
    }
    throw err;
  }
});

playdatesRouter.post('/:id/messages/upload', (req, res) => {
  chatUpload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)' : 'آپلود فایل ناموفق بود',
      });
      return;
    }

    const playdateId = Number(req.params.id);
    const senderUserId = Number(
      (req.body as { senderUserId?: string; userId?: string })?.senderUserId ??
        (req.body as { userId?: string })?.userId
    );
    const caption =
      typeof (req.body as { caption?: string; text?: string })?.caption === 'string'
        ? (req.body as { caption: string }).caption
        : typeof (req.body as { text?: string })?.text === 'string'
          ? (req.body as { text: string }).text
          : '';
    const file = req.file;

    if (!Number.isFinite(playdateId) || !Number.isFinite(senderUserId)) {
      res.status(400).json({ error: 'شناسه درخواست و senderUserId الزامی هستند' });
      return;
    }
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'فایل الزامی است' });
      return;
    }

    const gate = requireParticipant(playdateId, senderUserId);
    if (gate.error === 'not_found') {
      res.status(404).json({ error: 'درخواست پیدا نشد' });
      return;
    }
    if (gate.error === 'forbidden') {
      res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
      return;
    }
    if (gate.playdate.status !== 'accepted') {
      res.status(409).json({ error: 'چت فقط بعد از قبول درخواست فعال است' });
      return;
    }
    if (gate.playdate.chatEnded) {
      res.status(409).json({ error: 'این چت قطع شده است' });
      return;
    }

    try {
      const normalized = await normalizeChatUploadFile({
        buffer: file.buffer,
        mimeType: file.mimetype || 'application/octet-stream',
        originalName: file.originalname || 'file',
      });
      const originalName = normalized.originalName;
      const mimeType = normalized.mimeType;
      const mediaKind = inferMediaKind(mimeType, originalName);
      const saved = saveChatUpload({
        folderId: playdateId,
        originalName,
        buffer: normalized.buffer,
      });

      const message = dbService.createPlaydateChatMessage({
        playdateId,
        senderUserId,
        text: caption,
        mediaKind,
        storageKey: saved.storageKey,
        mimeType,
        fileName: originalName,
      });

      fanOutPlaydateChatTelegram({
        playdate: gate.playdate,
        senderUserId,
        text: message.text,
        mediaKind: message.mediaKind,
        storageKey: message.storageKey,
        mimeType: message.mimeType,
        fileName: message.fileName,
      });

      const playdate = gate.playdate;
      const participants = [playdate.fromUserId, playdate.toUserId].filter(
        (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
      );
      notifyPlaymateMessage(playdateId, message, participants);
      res.status(201).json(message);
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم فایل بیش از حد مجاز است (حداکثر ۱۵ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'EMPTY_TEXT') {
        res.status(400).json({ error: 'فایل یا متن پیام الزامی است' });
        return;
      }
      if (err instanceof Error && err.message === 'TEXT_TOO_LONG') {
        res.status(400).json({ error: 'کپشن خیلی طولانی است' });
        return;
      }
      console.warn('chat upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره فایل ناموفق بود' });
    }
  });
});

playdatesRouter.get('/:id/messages/:messageId/file', async (req, res) => {
  const playdateId = Number(req.params.id);
  const messageId = Number(req.params.messageId);
  const userId = Number(req.query.userId);
  if (!Number.isFinite(playdateId) || !Number.isFinite(messageId) || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست، پیام و userId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }

  const message = dbService.getPlaydateChatMessage(messageId);
  if (!message || message.playdateId !== playdateId) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }

  if (message.storageKey) {
    const abs = resolveStoragePath(message.storageKey);
    if (!abs || !fs.existsSync(abs)) {
      res.status(404).json({ error: 'فایل پیدا نشد' });
      return;
    }
    const contentType = message.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (message.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
      );
    }
    res.send(fs.readFileSync(abs));
    return;
  }

  if (!message.telegramFileId) {
    res.status(404).json({ error: 'فایل پیدا نشد' });
    return;
  }

  const file = await resolveTelegramFile(message.telegramFileId);
  if (!file) {
    res.status(502).json({ error: 'دریافت فایل از تلگرام ناموفق بود' });
    return;
  }

  try {
    const upstream = await fetch(file.downloadUrl);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: 'دانلود فایل ناموفق بود' });
      return;
    }
    const contentType =
      message.mimeType ||
      upstream.headers.get('content-type') ||
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (message.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
      );
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.warn('proxy telegram file failed:', (err as Error).message);
    res.status(502).json({ error: 'پروکسی فایل ناموفق بود' });
  }
});

playdatesRouter.post('/:id/end-chat', async (req, res) => {
  const playdateId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  if (!Number.isFinite(playdateId) || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.playdate.status !== 'accepted') {
    res.status(409).json({ error: 'فقط چت درخواست پذیرفته‌شده قابل قطع است' });
    return;
  }

  purgePlaydateUploads(playdateId);
  const updated = dbService.endPlaydateChat(playdateId);
  const bothTelegramIds = peerTelegramIds(gate.playdate);
  // Clear sticky bot owner_chat for BOTH sides — stops mobile/desktop keyboard interference
  void clearBotOwnerChatSessions({
    playdateId,
    telegramIds: bothTelegramIds,
  });
  for (const telegramId of peerTelegramIds(gate.playdate, userId)) {
    void notifyPlaydateChatEndedTelegram({ toTelegramId: telegramId });
  }
  notifyPlaymateThread(
    playdateId,
    [gate.playdate.fromUserId, gate.playdate.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    ),
    { chatEnded: true, chatSecure: false },
  );
  res.json({ ok: true, playdate: enrichPlaydate(updated) });
});

playdatesRouter.patch('/:id/chat-secure', async (req, res) => {
  const playdateId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  const secure = Boolean(req.body?.secure);
  if (!Number.isFinite(playdateId) || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }
  if (gate.playdate.status !== 'accepted') {
    res.status(409).json({ error: 'چت امن فقط برای درخواست پذیرفته‌شده فعال است' });
    return;
  }
  if (gate.playdate.chatEnded) {
    res.status(409).json({ error: 'این چت قطع شده است' });
    return;
  }

  const updated = dbService.setPlaydateChatSecure(playdateId, secure);
  for (const telegramId of peerTelegramIds(gate.playdate, userId)) {
    void notifyPlaydateChatSecureTelegram({ toTelegramId: telegramId, secure });
  }
    notifyPlaymateThread(playdateId, [gate.playdate.fromUserId, gate.playdate.toUserId].filter(
    (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
  ), { chatSecure: secure });
  res.json(enrichPlaydate(updated));
});

playdatesRouter.delete('/:id/messages', async (req, res) => {
  const playdateId = Number(req.params.id);
  const userId = Number(req.query.userId ?? req.body?.userId);
  if (!Number.isFinite(playdateId) || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }

  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
    return;
  }

  // Wipe bot-delivered Telegram copies for both participants before clearing web DB.
  const notifyIds = peerTelegramIds(gate.playdate, userId);
  let telegramDeleted = 0;
  try {
    const wipe = await wipePlaydateChatTelegram({
      playdateId,
      notifyTelegramIds: notifyIds,
    });
    telegramDeleted = wipe.deleted;
  } catch (err) {
    console.warn('wipePlaydateChatTelegram failed:', (err as Error).message);
  }

  purgePlaydateUploads(playdateId);
  const cleared = dbService.clearPlaydateChatMessages(playdateId);
  notifyPlaymateThread(
    playdateId,
    [gate.playdate.fromUserId, gate.playdate.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    ),
    { messagesCleared: true },
  );
  res.json({ ok: true, cleared, telegramDeleted });
});

/** Record bot-delivered Telegram message ids so web wipe can delete them. */
playdatesRouter.post('/:id/telegram-message-refs', (req, res) => {
  const playdateId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  const rawRefs = Array.isArray(req.body?.refs) ? req.body.refs : [];
  if (!Number.isFinite(playdateId)) {
    res.status(400).json({ error: 'شناسه درخواست الزامی است' });
    return;
  }

  const playdate = dbService.getPlaydateRequest(playdateId);
  if (!playdate) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }

  // Allow either a participant userId, or omit userId when called from bot with valid playdate.
  if (Number.isFinite(userId)) {
    if (!dbService.isPlaydateParticipant(playdate, userId)) {
      res.status(403).json({ error: 'دسترسی به این چت مجاز نیست' });
      return;
    }
  }

  const refs: Array<{ telegramChatId: string; messageId: number }> = [];
  for (const row of rawRefs) {
    const telegramChatId = String(row?.telegramChatId ?? row?.telegram_chat_id ?? '').trim();
    const messageId = Number(row?.messageId ?? row?.message_id);
    if (!telegramChatId || !Number.isFinite(messageId) || messageId <= 0) continue;
    refs.push({ telegramChatId, messageId: Math.trunc(messageId) });
  }

  if (refs.length === 0) {
    res.status(400).json({ error: 'refs خالی است' });
    return;
  }

  const recorded = dbService.recordPlaydateChatTgRefs(playdateId, refs);
  res.json({ ok: true, recorded });
});

playdatesRouter.get('/:id', (req, res) => {
  const request = enrichPlaydate(dbService.getPlaydateRequest(Number(req.params.id)));
  if (!request) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  res.json(request);
});

playdatesRouter.post('/', async (req, res) => {
  const { fromPetId, toPetId, fromUserId, toUserId, message, scheduledAt, location } = req.body;

  if (!fromPetId || !toPetId || !fromUserId) {
    res.status(400).json({ error: 'fromPetId، toPetId و fromUserId الزامی هستند' });
    return;
  }

  const fromPet = dbService.getPet(Number(fromPetId));
  const toPet = dbService.getPet(Number(toPetId));
  if (!fromPet || !toPet) {
    res.status(404).json({ error: 'پت مبدأ یا مقصد پیدا نشد' });
    return;
  }

  dbService.expireStalePlaydateRequests();

  const fromUid = Number(fromUserId);
  const toUid = toUserId ? Number(toUserId) : toPet.ownerId;

  if (dbService.hasPendingPlaydate(Number(fromPetId), Number(toPetId))) {
    const existing = dbService
      .listPlaydateRequests({ userId: fromUid, status: 'pending' })
      .find((r) => r.fromPetId === Number(fromPetId) && r.toPetId === Number(toPetId));
    res.status(200).json({
      ...enrichPlaydate(existing ?? null),
      telegramNotified: false,
      alreadyPending: true,
    });
    return;
  }

  // Same owner already has a pending request from this sender (other pet) —
  // do not spam a second simultaneous request.
  if (toUid && dbService.hasPendingPlaydateBetweenUsers(fromUid, toUid)) {
    const existing = dbService.findPendingPlaydateBetweenUsers(fromUid, toUid);
    res.status(200).json({
      ...enrichPlaydate(existing),
      telegramNotified: false,
      alreadyPending: true,
    });
    return;
  }

  const confirmResend = Boolean(req.body?.confirmResend);
  // After a prior expired request to the same pet, require explicit resend confirm.
  if (!confirmResend && dbService.hasExpiredPlaydate(Number(fromPetId), Number(toPetId))) {
    res.status(409).json({
      error: 'میخوای مجدد درخواست بدی به اون شخص؟',
      code: 'RESEND_CONFIRM_REQUIRED',
      requiresResendConfirm: true,
    });
    return;
  }

  const request = dbService.createPlaydateRequest({
    fromPetId: Number(fromPetId),
    toPetId: Number(toPetId),
    fromUserId: fromUid,
    toUserId: toUid,
    message,
    scheduledAt,
    location,
  });

  const enriched = enrichPlaydate(request)!;
  const recipientUserId =
    enriched.toUserId ?? enriched.toPet?.ownerId ?? toUid ?? undefined;
  // Never block HTTP on Telegram — slow/failed TG was hanging find-playmate
  // for minutes (bot loops up to 30 creates, each awaiting notify).
  void notifyNewPlaydateTelegram(enriched).catch((err) => {
    console.warn('playdate telegram notify failed:', (err as Error).message);
  });
  // Always fan-out to resolved recipient + sender so web desktop/mobile
  // inboxes refresh even when to_user_id was null at insert time.
  notifyInbox([recipientUserId, enriched.fromUserId], {
    kind: 'playmate',
    reason: 'request',
    id: enriched.id,
  });
  console.log(
    'playdate request created',
    enriched.id,
    'from',
    enriched.fromUserId,
    'to',
    recipientUserId,
    'pets',
    `${enriched.fromPetId}->${enriched.toPetId}`,
  );
  // telegramNotified:true = API owns delivery (async); bot must not double-send
  res.status(201).json({
    ...enriched,
    toUserId: recipientUserId ?? enriched.toUserId,
    telegramNotified: true,
  });
});

playdatesRouter.patch('/:id', async (req, res) => {
  const { status } = req.body;
  const actorUserId = Number(req.body?.userId ?? req.body?.actorUserId);
  /** Bot already runs startOwnerChat — pass false to avoid duplicate intros. */
  const startOwnerChat = req.body?.startOwnerChat !== false;
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'وضعیت نامعتبر است' });
    return;
  }
  if (!Number.isFinite(actorUserId)) {
    res.status(400).json({ error: 'userId الزامی است' });
    return;
  }

  const id = Number(req.params.id);
  const previous = dbService.getPlaydateRequest(id);
  if (!previous) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }

  const recipientId =
    previous.toUserId ?? dbService.getPet(previous.toPetId)?.ownerId ?? undefined;
  const isRecipient = recipientId === actorUserId;
  const isSender = previous.fromUserId === actorUserId;

  // Accept/reject: ONLY the recipient (owner of toPet) may confirm.
  if (status === 'accepted' || status === 'rejected') {
    if (!isRecipient) {
      res.status(403).json({
        error: 'فقط گیرندهٔ درخواست می‌تواند قبول یا رد کند',
      });
      return;
    }
    if (previous.status === 'expired') {
      res.status(409).json({ error: 'این درخواست منقضی شده است', code: 'EXPIRED' });
      return;
    }
    if (previous.status !== 'pending') {
      res.status(409).json({ error: 'این درخواست قبلاً پاسخ داده شده است' });
      return;
    }
  } else if (status === 'cancelled') {
    if (!isRecipient && !isSender) {
      res.status(403).json({ error: 'اجازه لغو این درخواست را ندارید' });
      return;
    }
  } else if (status === 'expired') {
    // System / self-heal path — participants may force-expire a stale pending.
    if (!isRecipient && !isSender) {
      res.status(403).json({ error: 'اجازه تغییر این درخواست را ندارید' });
      return;
    }
  } else if (!isRecipient && !isSender) {
    res.status(403).json({ error: 'اجازه تغییر این درخواست را ندارید' });
    return;
  }

  const updated = enrichPlaydate(dbService.updatePlaydateStatus(id, status));
  if (!updated) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }

  let ownerChatStarted = false;
  // Only after the recipient accepts — never when sender self-accepts.
  if (startOwnerChat && isRecipient) {
    ownerChatStarted = await openOwnerChatOnAccept(updated, previous.status);
  }

  notifyInbox([updated.toUserId, updated.fromUserId], {
    kind: 'playmate',
    reason: 'status',
    id: updated.id,
  });
  notifyPlaymateThread(
    updated.id,
    [updated.fromUserId, updated.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    ),
    { status: updated.status },
  );

  res.json({ ...updated, ownerChatStarted });
});
