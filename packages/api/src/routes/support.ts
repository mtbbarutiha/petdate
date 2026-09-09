import { Router } from 'express';
import { dbService } from '../db';
import { generateAiConsultAdvice } from '../services/ai-consult';
import { getUserFromBearer } from '../services/web-otp';

export const supportRouter = Router();

function requireUser(req: { header: (n: string) => string | undefined }) {
  return getUserFromBearer(req.header('authorization') ?? undefined)?.user ?? null;
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
        ? '👋 من پشتیبانی هوشمند پت‌دیت هستم. درباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.'
        : null,
  });
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
    const userMsg = dbService.addSupportMessage(user.id, 'user', text);
    const history = dbService.listSupportMessages(user.id, 20).map((m) => ({
      role: m.role,
      content: m.text,
    }));
    const generated = await generateAiConsultAdvice({
      kind: 'support',
      patientName: user.name,
      userMessage: text,
      history: history.slice(0, -1),
    });
    const assistantMsg = dbService.addSupportMessage(user.id, 'assistant', generated.text);
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
        ? '👋 من پشتیبانی هوشمند پت‌دیت هستم. درباره ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه بپرس.'
        : null,
  });
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
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'متن پیام الزامی است' });
    return;
  }
  try {
    dbService.addSupportMessage(user.id, 'user', text);
    const history = dbService.listSupportMessages(user.id, 20).map((m) => ({
      role: m.role,
      content: m.text,
    }));
    const generated = await generateAiConsultAdvice({
      kind: 'support',
      patientName: user.name,
      userMessage: text,
      history: history.slice(0, -1),
    });
    const assistantMessage = dbService.addSupportMessage(user.id, 'assistant', generated.text);
    res.status(201).json({
      ok: true,
      assistantMessage,
      messages: dbService.listSupportMessages(user.id),
    });
  } catch (err) {
    console.warn('support telegram chat failed:', (err as Error).message);
    res.status(500).json({ error: 'پاسخ پشتیبانی ناموفق بود' });
  }
});
