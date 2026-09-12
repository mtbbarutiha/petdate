import { createHash, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import type { PlaydateChatMediaKind, PlaydateStatus } from '@petdate/shared';
import {
  PET_SPECIES_LABELS,
  PLAYDATE_REQUEST_COST,
  rankPlaymateMatches,
  sanitizePetPhotosForViewer,
  userPublicIdOf,
} from '@petdate/shared';
import { infra } from '../config/infra';
import { dbService, isDeletedOrInactiveUser } from '../db';
import { getUserFromBearer } from '../services/web-otp';
import {
  chargePlaydateFee,
  insufficientPlaydateFeePayload,
  refundPlaydateFee,
} from '../services/playdate-fee';
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
  sniffChatMediaContentType,
} from '../services/chat-upload-store';
import { startOwnerChatFromApi } from '../services/telegram-owner-chat-start';
import { clearBotOwnerChatSessions } from '../services/bot-owner-chat-session';
import {
  notifyInbox,
  notifyPlaymateMessage,
  notifyPlaymateThread,
} from '../ws/chatHub';
import { rejectIfFlagOff } from '../runtime-settings';

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

function tokensEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Internal Telegram bot (X-PetDate-Bot-Token === TELEGRAM_BOT_TOKEN). */
function isInternalBot(req: { header: (name: string) => string | undefined }): boolean {
  const expected = infra.telegram.botToken?.trim();
  const got = String(req.header('x-petdate-bot-token') ?? '').trim();
  if (!expected || !got) return false;
  return tokensEqual(expected, got);
}

function viewerFromBearer(req: { header: (name: string) => string | undefined }) {
  return getUserFromBearer(req.header('authorization') ?? undefined)?.user ?? null;
}

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


function enrichPlaydate(
  req: ReturnType<typeof dbService.getPlaydateRequest>,
  viewerId?: number
) {
  if (!req) return null;
  const fromPet = dbService.getPet(req.fromPetId);
  const toPet = dbService.getPet(req.toPetId);
  return {
    ...req,
    fromPet: fromPet ? sanitizePetPhotosForViewer(fromPet, viewerId) : undefined,
    toPet: toPet ? sanitizePetPhotosForViewer(toPet, viewerId) : undefined,
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
 * Delivers exactly one copy to the peer's bot chat.
 *
 * Intentionally does NOT echo to the sender's own Telegram: Bot API messages
 * always appear as incoming (left) from the bot, so a self-echo cannot look
 * like a normal outgoing (right) bubble. Labeled «شما» echos were confusing;
 * unlabeled left-side copies would look like peer messages. Own lines typed
 * in the bot already appear correctly on the right. Callers that set
 * skipTelegram must not invoke this — the bot already shows the sender's typed line.
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

  if (!peerTg) return;

  void notifyPlaydateChatTelegram({
    toTelegramId: peerTg,
    senderName,
    text: opts.text,
    playdateId: playdate.id,
    protectContent: Boolean(playdate.chatSecure),
    mediaKind: (opts.mediaKind ?? null) as PlaydateChatMediaKind | null,
    storageKey: opts.storageKey,
    mimeType: opts.mimeType,
    fileName: opts.fileName,
  });
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
  const bot = isInternalBot(req);
  const viewer = viewerFromBearer(req);
  if (!bot && !viewer) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  let userId = req.query.userId ? Number(req.query.userId) : undefined;
  let petId = req.query.petId ? Number(req.query.petId) : undefined;
  const status = req.query.status as PlaydateStatus | undefined;

  if (viewer && !bot) {
    // Web session: always scope to the signed-in user (ignore spoofed userId).
    userId = viewer.id;
    petId = Number.isFinite(petId) && petId! > 0 ? petId : undefined;
  } else if (bot && !Number.isFinite(userId) && !Number.isFinite(petId)) {
    res.status(400).json({ error: 'userId یا petId الزامی است' });
    return;
  }

  dbService.expireStalePlaydateRequests();
  const dismissals =
    Number.isFinite(userId) && userId!
      ? new Set(
          dbService
            .listInboxDismissals(userId!, 'playmate')
            .map((d) => d.entityId)
        )
      : null;
  const requests = dbService
    .listPlaydateRequests({
      userId: Number.isFinite(userId) ? userId : undefined,
      petId: Number.isFinite(petId) ? petId : undefined,
      status,
    })
    .filter((r) => {
      if (dismissals?.has(r.id)) return false;
      if (Number.isFinite(userId) && userId) {
        if (dbService.isPlaydatePeerDeleted(r, userId)) return false;
      } else {
        const from = dbService.getUserById(r.fromUserId);
        const toId = r.toUserId ?? dbService.getPet(r.toPetId)?.ownerId;
        const to = toId ? dbService.getUserById(toId) : null;
        if (isDeletedOrInactiveUser(from) || isDeletedOrInactiveUser(to)) return false;
      }
      return true;
    })
    .map((r) => enrichPlaydate(r, userId)!);
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
    const peerPublicId = userPublicIdOf(peer);
    res.json({
      playdateId: pd.id,
      peerTelegramId: peer.telegramId,
      peerUserId: peer.id,
      myPetId: iAmFrom ? pd.fromPetId : pd.toPetId,
      peerPetId: iAmFrom ? pd.toPetId : pd.fromPetId,
      peerPublicId,
      // Legacy field — same canonical public id so old bots never show @username/name
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

    const playdate = gate.playdate;
    const participants = [playdate.fromUserId, playdate.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    );
    for (const uid of participants) {
      dbService.clearInboxDismissal(uid, 'playmate', playdateId);
    }
    // WS first — web dual-online peers must not wait on Telegram latency/failures.
    notifyPlaymateMessage(playdateId, message, participants);
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

      const playdate = gate.playdate;
      const participants = [playdate.fromUserId, playdate.toUserId].filter(
        (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
      );
      // WS first — web dual-online peers must not wait on Telegram latency/failures.
      notifyPlaymateMessage(playdateId, message, participants);
      fanOutPlaydateChatTelegram({
        playdate: gate.playdate,
        senderUserId,
        text: message.text,
        mediaKind: message.mediaKind,
        storageKey: message.storageKey,
        mimeType: message.mimeType,
        fileName: message.fileName,
      });
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
    const buf = fs.readFileSync(abs);
    const contentType = sniffChatMediaContentType(buf, message.mimeType, message.fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (message.fileName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(message.fileName)}`
      );
    }
    res.send(buf);
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

  const wasSecure = Boolean(gate.playdate.chatSecure);
  purgePlaydateUploads(playdateId);
  const updated = dbService.endPlaydateChat(playdateId);
  const bothTelegramIds = peerTelegramIds(gate.playdate);
  // Clear sticky bot owner_chat for BOTH sides — stops mobile/desktop keyboard interference
  void clearBotOwnerChatSessions({
    playdateId,
    telegramIds: bothTelegramIds,
  });
  // Secure chat: wipe CTA for BOTH participants. Otherwise notify peer only.
  const notifyIds = wasSecure
    ? bothTelegramIds
    : peerTelegramIds(gate.playdate, userId);
  for (const telegramId of notifyIds) {
    void notifyPlaydateChatEndedTelegram({
      toTelegramId: telegramId,
      wasSecure,
      playdateId,
    });
  }
  notifyPlaymateThread(
    playdateId,
    [gate.playdate.fromUserId, gate.playdate.toUserId].filter(
      (id): id is number => Number.isFinite(id as number) && (id as number) > 0,
    ),
    { chatEnded: true, chatSecure: false, wasSecure },
  );
  res.json({ ok: true, playdate: enrichPlaydate(updated, userId), wasSecure });
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
  res.json(enrichPlaydate(updated, userId));
});


/**
 * Gift coins from sender balance to playmate peer — creates a gift chat bubble.
 */
playdatesRouter.post('/:id/gift', async (req, res) => {
  const playdateId = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.body?.userId != null ? Number(req.body.userId) : undefined);
  const amount = Math.floor(Number(req.body?.amount));
  if (!Number.isFinite(playdateId) || !userId || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 10_000) {
    res.status(400).json({ error: 'مبلغ هدیه باید بین ۱ تا ۱۰۰۰۰ سکه باشد' });
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
  if (gate.playdate.status !== 'accepted' || gate.playdate.chatEnded) {
    res.status(409).json({ error: 'هدیه فقط در چت فعال همبازی مجاز است' });
    return;
  }
  if (dbService.isPlaydatePeerDeleted(gate.playdate, userId)) {
    res.status(410).json({ error: 'طرف مقابل دیگر در دسترس نیست' });
    return;
  }

  const peerUserId =
    gate.playdate.fromUserId === userId
      ? gate.playdate.toUserId ?? dbService.getPet(gate.playdate.toPetId)?.ownerId
      : gate.playdate.fromUserId;
  if (!peerUserId || peerUserId === userId) {
    res.status(400).json({ error: 'گیرنده هدیه پیدا نشد' });
    return;
  }
  if (dbService.isUserBlocked(userId, peerUserId)) {
    res.status(403).json({ error: 'امکان ارسال هدیه به کاربر مسدود وجود ندارد' });
    return;
  }

  const debited = dbService.debitCoins(userId, amount, {
    reason: 'chat_gift',
    refType: 'playdate_gift',
    refId: playdateId,
  });
  if (!debited) {
    const bal = dbService.getUserById(userId)?.coins ?? 0;
    res.status(402).json({
      error: `موجودی سکه کافی نیست. نیاز: ${amount.toLocaleString('fa-IR')} — موجودی: ${bal.toLocaleString('fa-IR')}`,
      need: amount,
      balance: bal,
    });
    return;
  }

  const credited = dbService.creditCoins(peerUserId, amount, undefined, {
    reason: 'chat_gift_received',
    refType: 'playdate_gift',
    refId: playdateId,
  });
  if (!credited) {
    dbService.creditCoins(userId, amount, undefined, {
      reason: 'chat_gift_refund',
      refType: 'playdate_gift',
      refId: playdateId,
    });
    res.status(500).json({ error: 'واریز هدیه به گیرنده ناموفق بود' });
    return;
  }

  const giftText = `🎁 هدیه ${amount.toLocaleString('fa-IR')} سکه`;
  const message = dbService.createPlaydateChatMessage({
    playdateId,
    senderUserId: userId,
    text: giftText,
    mediaKind: 'gift',
    mimeType: 'application/x-petdate-gift',
    fileName: String(amount),
  });

  dbService.clearInboxDismissal(userId, 'playmate', playdateId);
  dbService.clearInboxDismissal(peerUserId, 'playmate', playdateId);

  const participants = [gate.playdate.fromUserId, gate.playdate.toUserId].filter(
    (id): id is number => Number.isFinite(id as number) && (id as number) > 0
  );
  notifyPlaymateMessage(playdateId, message, participants);
  fanOutPlaydateChatTelegram({
    playdate: gate.playdate,
    senderUserId: userId,
    text: message.text,
    mediaKind: 'gift',
  });

  res.status(201).json({
    ok: true,
    message,
    amount,
    senderCoins: debited.coins,
    recipientCoins: credited.coins,
  });
});

/** Hide this playmate conversation from my inbox (does not wipe peer history). */
playdatesRouter.delete('/:id/inbox', (req, res) => {
  const playdateId = Number(req.params.id);
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  const userId =
    session?.user?.id ??
    (req.query.userId != null ? Number(req.query.userId) : undefined) ??
    (req.body?.userId != null ? Number(req.body.userId) : undefined);
  if (!Number.isFinite(playdateId) || !userId || !Number.isFinite(userId)) {
    res.status(400).json({ error: 'شناسه درخواست و userId الزامی هستند' });
    return;
  }
  const gate = requireParticipant(playdateId, userId);
  if (gate.error === 'not_found') {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (gate.error === 'forbidden') {
    res.status(403).json({ error: 'دسترسی مجاز نیست' });
    return;
  }
  dbService.dismissInboxItem(userId, 'playmate', playdateId);
  notifyInbox([userId], { kind: 'playmate', reason: 'dismiss', id: playdateId });
  res.json({ ok: true });
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
  const playdateId = Number(req.params.id);
  if (!Number.isFinite(playdateId) || playdateId <= 0) {
    res.status(400).json({ error: 'شناسه درخواست نامعتبر است' });
    return;
  }

  const rawRequest = dbService.getPlaydateRequest(playdateId);
  if (!rawRequest) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }

  const bot = isInternalBot(req);
  const viewer = viewerFromBearer(req);
  if (!bot && !viewer) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const request = enrichPlaydate(rawRequest, viewer?.id);
  if (!request) {
    res.status(404).json({ error: 'درخواست پیدا نشد' });
    return;
  }
  if (viewer && !bot && !dbService.isPlaydateParticipant(request, viewer.id)) {
    res.status(403).json({ error: 'دسترسی به این درخواست مجاز نیست' });
    return;
  }

  res.json(request);
});

const MAX_AUTO_PLAYMATE_REQUESTS = 30;

/**
 * پیدا کردن همبازی (وب + ربات): یک‌بار ۲ سکه از درخواست‌کننده، سپس ارسال به هم‌گروه‌ها.
 * اگر مچ جدیدی نباشد، سکه‌ای کسر نمی‌شود.
 */
playdatesRouter.post('/find', async (req, res) => {
  if (rejectIfFlagOff(res, 'playdatesEnabled')) return;
  const fromPetId = Number(req.body?.fromPetId);
  const fromUserId = Number(req.body?.fromUserId);
  if (!Number.isFinite(fromPetId) || !Number.isFinite(fromUserId)) {
    res.status(400).json({ error: 'fromPetId و fromUserId الزامی هستند' });
    return;
  }

  const fromPet = dbService.getPet(fromPetId);
  if (!fromPet) {
    res.status(404).json({ error: 'پت مبدأ پیدا نشد' });
    return;
  }
  if (fromPet.ownerId !== fromUserId) {
    res.status(403).json({ error: 'این پت مال تو نیست' });
    return;
  }

  const requester = dbService.getUserById(fromUserId);
  if (!requester) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }

  dbService.expireStalePlaydateRequests();

  const peers = dbService.listPets({
    lookingForPlaymate: true,
    species: fromPet.species,
    excludeOwnerId: fromUserId,
  });
  const matches = rankPlaymateMatches(fromPet, peers, { max: MAX_AUTO_PLAYMATE_REQUESTS });
  const speciesLabel = PET_SPECIES_LABELS[fromPet.species] ?? fromPet.species;

  type MatchRow = (typeof matches)[number];
  const toCreate: MatchRow[] = [];
  let skipped = 0;
  for (const match of matches) {
    const toUid = match.pet.ownerId;
    if (dbService.hasPendingPlaydate(fromPetId, match.pet.id)) {
      skipped += 1;
      continue;
    }
    if (toUid && dbService.hasPendingPlaydateBetweenUsers(fromUserId, toUid)) {
      skipped += 1;
      continue;
    }
    toCreate.push(match);
  }

  if (toCreate.length === 0) {
    res.status(200).json({
      ok: true,
      sent: 0,
      skipped: matches.length,
      cost: 0,
      coins: requester.coins ?? 0,
      speciesLabel,
      sourceName: fromPet.name,
      sourcePetId: fromPet.id,
      requests: [],
      message: `برای ${fromPet.name} فعلاً همبازی هم‌گروه پیدا نشد.`,
    });
    return;
  }

  const balance = requester.coins ?? 0;
  if (balance < PLAYDATE_REQUEST_COST) {
    res.status(400).json(insufficientPlaydateFeePayload(balance));
    return;
  }

  const charged = chargePlaydateFee(fromUserId, {
    refType: 'playdate_find',
    refId: fromPetId,
  });
  if (!charged.ok) {
    res.status(400).json({
      error: charged.error,
      reason: charged.reason,
      balance: charged.balance,
      cost: charged.cost,
    });
    return;
  }

  const created: NonNullable<ReturnType<typeof enrichPlaydate>>[] = [];
  let sampleLine: string | undefined;
  let preferredSample: string | undefined;

  for (const match of toCreate) {
    try {
      const toUid = match.pet.ownerId;
      const request = dbService.createPlaydateRequest({
        fromPetId,
        toPetId: match.pet.id,
        fromUserId,
        toUserId: toUid,
      });
      const enriched = enrichPlaydate(request, fromUserId)!;
      created.push(enriched);
      const recipientUserId =
        enriched.toUserId ?? enriched.toPet?.ownerId ?? toUid ?? undefined;
      void notifyNewPlaydateTelegram(enriched).catch((err) => {
        console.warn('playdate telegram notify failed:', (err as Error).message);
      });
      notifyInbox([recipientUserId, enriched.fromUserId], {
        kind: 'playmate',
        reason: 'request',
        id: enriched.id,
      });

      const locReasons = match.reasons.filter(
        (r) => r === 'هم‌کشور' || r === 'هم‌استان' || r === 'هم‌شهر'
      );
      const why =
        locReasons.length > 0
          ? locReasons.join(' · ')
          : match.reasons.slice(0, 2).join(' · ');
      const line = `• ${match.pet.name}${why ? ` — ${why}` : ''}`;
      if (!sampleLine) sampleLine = line;
      if (
        !preferredSample &&
        (match.reasons.includes('هم‌استان') || match.reasons.includes('هم‌کشور'))
      ) {
        preferredSample = line;
      }
    } catch (err) {
      skipped += 1;
      console.warn('playdate find create failed:', (err as Error).message);
    }
  }

  if (created.length === 0) {
    refundPlaydateFee(fromUserId, { refType: 'playdate_find_refund', refId: fromPetId });
    res.status(200).json({
      ok: true,
      sent: 0,
      skipped: matches.length,
      cost: 0,
      coins: dbService.getUserById(fromUserId)?.coins ?? balance,
      speciesLabel,
      sourceName: fromPet.name,
      sourcePetId: fromPet.id,
      requests: [],
      message: `برای ${fromPet.name} الان درخواستی ارسال نشد.`,
    });
    return;
  }

  const coinsLeft = dbService.getUserById(fromUserId)?.coins ?? charged.user.coins ?? 0;
  console.log(
    'playdate find',
    'pet',
    fromPetId,
    'user',
    fromUserId,
    'sent',
    created.length,
    'cost',
    PLAYDATE_REQUEST_COST
  );

  res.status(201).json({
    ok: true,
    sent: created.length,
    skipped: skipped + (toCreate.length - created.length),
    cost: PLAYDATE_REQUEST_COST,
    coins: coinsLeft,
    speciesLabel,
    sourceName: fromPet.name,
    sourcePetId: fromPet.id,
    sampleLine: preferredSample ?? sampleLine,
    requests: created,
    message: `${created.length} درخواست همبازی ارسال شد (هزینه: ${PLAYDATE_REQUEST_COST} سکه).`,
  });
});

playdatesRouter.post('/', async (req, res) => {
  if (rejectIfFlagOff(res, 'playdatesEnabled')) return;
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
      ...enrichPlaydate(existing ?? null, fromUid),
      telegramNotified: false,
      alreadyPending: true,
      cost: 0,
    });
    return;
  }

  if (toUid && dbService.hasPendingPlaydateBetweenUsers(fromUid, toUid)) {
    const existing = dbService.findPendingPlaydateBetweenUsers(fromUid, toUid);
    res.status(200).json({
      ...enrichPlaydate(existing, fromUid),
      telegramNotified: false,
      alreadyPending: true,
      cost: 0,
    });
    return;
  }

  const confirmResend = Boolean(req.body?.confirmResend);
  if (!confirmResend && dbService.hasExpiredPlaydate(Number(fromPetId), Number(toPetId))) {
    res.status(409).json({
      error: 'میخوای مجدد درخواست بدی به اون شخص؟',
      code: 'RESEND_CONFIRM_REQUIRED',
      requiresResendConfirm: true,
    });
    return;
  }

  const charged = chargePlaydateFee(fromUid, {
    refType: 'playdate_request',
    refId: `${fromPetId}->${toPetId}`,
  });
  if (!charged.ok) {
    res.status(400).json({
      error: charged.error,
      reason: charged.reason,
      balance: charged.balance,
      cost: charged.cost,
    });
    return;
  }

  let request;
  try {
    request = dbService.createPlaydateRequest({
      fromPetId: Number(fromPetId),
      toPetId: Number(toPetId),
      fromUserId: fromUid,
      toUserId: toUid,
      message,
      scheduledAt,
      location,
    });
  } catch (err) {
    refundPlaydateFee(fromUid, {
      refType: 'playdate_fee_refund',
      refId: `${fromPetId}->${toPetId}`,
    });
    console.warn('playdate create failed after fee:', (err as Error).message);
    res.status(500).json({ error: 'ثبت درخواست همبازی ناموفق بود' });
    return;
  }

  const enriched = enrichPlaydate(request, fromUid)!;
  const recipientUserId =
    enriched.toUserId ?? enriched.toPet?.ownerId ?? toUid ?? undefined;
  void notifyNewPlaydateTelegram(enriched).catch((err) => {
    console.warn('playdate telegram notify failed:', (err as Error).message);
  });
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
    'cost',
    PLAYDATE_REQUEST_COST
  );
  res.status(201).json({
    ...enriched,
    toUserId: recipientUserId ?? enriched.toUserId,
    telegramNotified: true,
    cost: PLAYDATE_REQUEST_COST,
    coins: charged.user.coins ?? 0,
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

  const updated = enrichPlaydate(dbService.updatePlaydateStatus(id, status), actorUserId);
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
