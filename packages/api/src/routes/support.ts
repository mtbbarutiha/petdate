import { Router } from 'express';
import { dbService } from '../db';
import {
  createUserSupportTicket,
  getTicketByRef,
  listPublicTicketActivities,
  listTicketsForPlatformUser,
} from '../crm-service';
import { generateAiConsultAdvice, AI_ASSISTANT_DISPLAY_NAME } from '../services/ai-consult';
import {
  STT_UNAVAILABLE_FA,
  isSpeechToTextConfigured,
  transcribeAudio,
} from '../services/speech-to-text';
import { fetchTelegramFileBytes } from '../services/telegram-media';
import { getUserFromBearer } from '../services/web-otp';

export const supportRouter = Router();

/** Canonical support AI agent (لیلا کیانی) — same persona as /api/support chat. */
export const SUPPORT_AGENT_NAME = AI_ASSISTANT_DISPLAY_NAME;

function requireUser(req: { header: (n: string) => string | undefined }) {
  return getUserFromBearer(req.header('authorization') ?? undefined)?.user ?? null;
}

function publicTicket(
  t: {
    id: number;
    publicId: string;
    uuid?: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    channel: string;
    createdAt: string;
    updatedAt: string;
  },
  extras?: {
    lastPublicReply?: string | null;
    replies?: Array<{ id: number; text: string; at: string; agentName?: string }>;
  }
) {
  return {
    id: t.id,
    publicId: t.publicId,
    uuid: t.uuid || '',
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    channel: t.channel,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastPublicReply: extras?.lastPublicReply ?? null,
    replies: extras?.replies,
  };
}

async function replySupportTurn(opts: {
  userId: number;
  userName?: string;
  text: string;
}) {
  const userMsg = dbService.addSupportMessage(opts.userId, 'user', opts.text);
  const history = dbService.listSupportMessages(opts.userId, 20).map((m) => ({
    role: m.role,
    content: m.text,
  }));
  const generated = await generateAiConsultAdvice({
    kind: 'support',
    patientName: opts.userName,
    agentName: SUPPORT_AGENT_NAME,
    userMessage: opts.text,
    history: history.slice(0, -1),
  });
  const assistantMsg = dbService.addSupportMessage(opts.userId, 'assistant', generated.text);
  return { userMsg, assistantMsg, generated };
}

/** تاریخچه چت پشتیبانی کاربر */
supportRouter.get('/messages', (req, res) => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const messages = dbService.listSupportMessages(user.id);
  res.json({
    ok: true,
    messages,
    welcome:
      messages.length === 0
        ? `👋 من ${SUPPORT_AGENT_NAME} هستم، پشتیبانی هوشمند پت‌دیت. درباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.`
        : null,
    agentName: SUPPORT_AGENT_NAME,
  });
});

/** لیست تیکت‌های کاربر (ماژول تیکتینگ CRM) */
supportRouter.get('/tickets', (req, res) => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const tickets = listTicketsForPlatformUser(user.id).map((t) => {
    const publicActs = listPublicTicketActivities(t.id);
    const last = publicActs[publicActs.length - 1];
    return publicTicket(t, { lastPublicReply: last?.text || null });
  });
  res.json({ ok: true, tickets });
});

/** جزئیات + پاسخ‌های عمومی یک تیکت (id / uuid) */
supportRouter.get('/tickets/:ref', (req, res) => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const ticket = getTicketByRef(String(req.params.ref || ''));
  if (!ticket) {
    res.status(404).json({ error: 'تیکت پیدا نشد' });
    return;
  }
  const owned = listTicketsForPlatformUser(user.id).some((t) => t.id === ticket.id);
  if (!owned) {
    res.status(404).json({ error: 'تیکت پیدا نشد' });
    return;
  }
  const replies = listPublicTicketActivities(ticket.id).map((a) => ({
    id: a.id,
    text: a.text,
    at: a.at,
    agentName: a.userName,
  }));
  res.json({
    ok: true,
    ticket: publicTicket(ticket, {
      lastPublicReply: replies[replies.length - 1]?.text || null,
      replies,
    }),
  });
});

/** ثبت تیکت پشتیبانی توسط کاربر وب */
supportRouter.post('/tickets', (req, res) => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  try {
    const ticket = createUserSupportTicket(user, {
      title: String(req.body?.title ?? req.body?.subject ?? ''),
      description: String(req.body?.description ?? req.body?.body ?? ''),
      category: String(req.body?.category ?? ''),
      channel: 'web',
    });
    res.status(201).json({ ok: true, ticket: publicTicket(ticket) });
  } catch (err) {
    const status = (err as Error & { status?: number }).status || 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : 'ثبت تیکت ناموفق بود',
    });
  }
});

/** ارسال پیام به پشتیبانی هوشمند */
supportRouter.post('/messages', async (req, res) => {
  const user = requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const text = String(req.body?.text ?? req.body?.message ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'متن پیام الزامی است' });
    return;
  }
  if (text.length > 4000) {
    res.status(400).json({ error: 'پیام خیلی طولانی است' });
    return;
  }

  try {
    const { userMsg, assistantMsg, generated } = await replySupportTurn({
      userId: user.id,
      userName: user.name,
      text,
    });
    res.status(201).json({
      ok: true,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      adviceSource: generated.source,
      messages: dbService.listSupportMessages(user.id),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMPTY_TEXT') {
      res.status(400).json({ error: 'متن پیام خالی است' });
      return;
    }
    console.warn('support chat failed:', (err as Error).message);
    res.status(500).json({ error: 'پاسخ پشتیبانی ناموفق بود' });
  }
});


function isTrustedBot(req: { headers: Record<string, unknown> }): boolean {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return false;
  const header = String(req.headers['x-petdate-bot-token'] || '').trim();
  return header.length > 0 && header === token;
}

supportRouter.get('/telegram/:telegramId/messages', (req, res) => {
  if (!isTrustedBot(req as never)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const messages = dbService.listSupportMessages(user.id);
  res.json({
    messages,
    welcome:
      messages.length === 0
        ? `👋 من ${SUPPORT_AGENT_NAME} هستم، پشتیبانی هوشمند پت‌دیت. درباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.`
        : null,
    agentName: SUPPORT_AGENT_NAME,
  });
});

supportRouter.get('/telegram/:telegramId/tickets', (req, res) => {
  if (!isTrustedBot(req as never)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({
    ok: true,
    tickets: listTicketsForPlatformUser(user.id).map((t) => {
      const publicActs = listPublicTicketActivities(t.id);
      const last = publicActs[publicActs.length - 1];
      return publicTicket(t, { lastPublicReply: last?.text || null });
    }),
  });
});

supportRouter.post('/telegram/:telegramId/tickets', (req, res) => {
  if (!isTrustedBot(req as never)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  try {
    const ticket = createUserSupportTicket(user, {
      title: String(req.body?.title ?? req.body?.subject ?? ''),
      description: String(req.body?.description ?? req.body?.body ?? ''),
      category: String(req.body?.category ?? ''),
      channel: 'telegram',
    });
    res.status(201).json({ ok: true, ticket: publicTicket(ticket) });
  } catch (err) {
    const status = (err as Error & { status?: number }).status || 500;
    res.status(status).json({
      error: err instanceof Error ? err.message : 'ثبت تیکت ناموفق بود',
    });
  }
});

supportRouter.post('/telegram/:telegramId/messages', async (req, res) => {
  if (!isTrustedBot(req as never)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }

  let text = String(req.body?.text ?? '').trim();
  const telegramFileId =
    typeof req.body?.telegramFileId === 'string' ? req.body.telegramFileId.trim() : '';
  const mediaKind =
    typeof req.body?.mediaKind === 'string' ? req.body.mediaKind.trim() : '';

  // Voice / audio from Telegram → Whisper STT, then same support reply path.
  if (!text && telegramFileId && (mediaKind === 'voice' || mediaKind === 'audio')) {
    if (!isSpeechToTextConfigured()) {
      res.status(201).json({
        ok: true,
        assistantMessage: { text: STT_UNAVAILABLE_FA },
        messages: dbService.listSupportMessages(user.id),
        sttUnavailable: true,
      });
      return;
    }
    const file = await fetchTelegramFileBytes(telegramFileId);
    if (!file) {
      res.status(201).json({
        ok: true,
        assistantMessage: { text: STT_UNAVAILABLE_FA },
        messages: dbService.listSupportMessages(user.id),
        sttUnavailable: true,
      });
      return;
    }
    const mimeType =
      typeof req.body?.mimeType === 'string' && req.body.mimeType.trim()
        ? req.body.mimeType.trim()
        : file.contentType;
    const stt = await transcribeAudio({
      buffer: file.buffer,
      filename: mediaKind === 'voice' ? 'voice.ogg' : 'audio.ogg',
      mimeType,
      language: 'fa',
    });
    if (!stt.ok) {
      res.status(201).json({
        ok: true,
        assistantMessage: { text: STT_UNAVAILABLE_FA },
        messages: dbService.listSupportMessages(user.id),
        sttUnavailable: true,
      });
      return;
    }
    text = stt.text;
  }

  if (!text) {
    res.status(400).json({ error: 'متن پیام الزامی است' });
    return;
  }
  try {
    const { assistantMsg } = await replySupportTurn({
      userId: user.id,
      userName: user.name,
      text,
    });
    res.status(201).json({
      ok: true,
      assistantMessage: assistantMsg,
      messages: dbService.listSupportMessages(user.id),
      transcript: telegramFileId ? text : undefined,
    });
  } catch (err) {
    console.warn('support telegram chat failed:', (err as Error).message);
    res.status(500).json({ error: 'پاسخ پشتیبانی ناموفق بود' });
  }
});
