/**
 * AI consult fallback — OpenAI-compatible chat completions + offline Persian advisor.
 *
 * Env (any of):
 *   AI_CONSULT_API_KEY / OPENAI_API_KEY
 *   AI_CONSULT_BASE_URL / OPENAI_BASE_URL  (default https://api.openai.com/v1)
 *   AI_CONSULT_MODEL / OPENAI_MODEL        (default gpt-4o-mini)
 *
 * When no key is configured, returns a careful offline advisory so users never
 * get a hard "no online provider" error for vet/trainer.
 */
export type AiConsultKind = 'vet' | 'trainer' | 'support';

export type AiConsultContext = {
  kind: AiConsultKind;
  userMessage?: string;
  patientName?: string;
  petName?: string;
  petSpecies?: string;
  petBreed?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

const AI_TELEGRAM_ID = 'petdate_ai_assistant';

export function aiAssistantTelegramId(): string {
  return AI_TELEGRAM_ID;
}

function envKey(): string {
  return String(process.env.AI_CONSULT_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function envBaseUrl(): string {
  const raw = String(
    process.env.AI_CONSULT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ).trim();
  return raw.replace(/\/$/, '');
}

function envModel(): string {
  return String(process.env.AI_CONSULT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
}

export function isAiConsultConfigured(): boolean {
  return Boolean(envKey());
}

function systemPrompt(kind: AiConsultKind): string {
  if (kind === 'support') {
    return [
      'تو پشتیبانی هوشمند پلتفرم پت‌دیت هستی.',
      'به فارسی، کوتاه، واضح و صمیمی راهنمایی کن.',
      'کمک کن کاربر بفهمد چطور: ورود OTP، ثبت پت، همبازی، مربی، پرستار، دامپزشک، شاپ، کیف پول/سکه، و اتصال وب↔ربات کار می‌کند.',
      'اگر مشکل فنی حل نشد بگو از ربات تلگرام پت‌دیت یا ادمین پیگیری کنند.',
      'تشخیص پزشکی یا تجویز دارو نده؛ برای درمان به دامپزشک ارجاع بده.',
      'وانمود نکن انسان هستی؛ بگو دستیار پشتیبانی پت‌دیت هستی.',
    ].join('\n');
  }
  if (kind === 'trainer') {
    return [
      'تو دستیار هوشمند آموزش پت در پلتفرم پت‌دیت هستی.',
      'به فارسی، کوتاه، عملی و مهربان پاسخ بده.',
      'تمرکز: آموزش حضوری/رفتاری سگ و گربه، برنامه‌ریزی تمرین، جامعه‌پذیری، دستورات پایه.',
      'اگر موضوع پزشکی/اورژانس بود بگو با دامپزشک تماس بگیرند.',
      'واضح بگو که جایگزین مربی انسانی نیستی و وقتی مربی آنلاین باشد اتصال انسانی اولویت دارد.',
      'از ادعاهای قطعی پزشکی یا تضمین نتیجه خودداری کن.',
    ].join('\n');
  }
  return [
    'تو دستیار هوشمند مشاوره دامپزشکی عمومی در پلتفرم پت‌دیت هستی.',
    'به فارسی، کوتاه، شفاف و محتاط پاسخ بده.',
    'راهنمایی عمومی مراقبت، تغذیه، پیشگیری و زمان مراجعه به دامپزشک بده.',
    'تشخیص قطعی نده؛ نسخه دارو ننویس؛ در علائم خطرناک فوری به مراجعه حضوری تأکید کن.',
    'واضح بگو که جایگزین دامپزشک آنلاین/حضوری نیستی و وقتی پزشک آنلاین باشد اتصال انسانی اولویت دارد.',
  ].join('\n');
}

function buildUserPrompt(ctx: AiConsultContext): string {
  const bits: string[] = [];
  if (ctx.patientName) bits.push(`نام کاربر: ${ctx.patientName}`);
  if (ctx.petName) bits.push(`نام پت: ${ctx.petName}`);
  if (ctx.petSpecies) bits.push(`گونه: ${ctx.petSpecies}`);
  if (ctx.petBreed) bits.push(`نژاد: ${ctx.petBreed}`);
  const intro =
    ctx.kind === 'support'
      ? 'کاربر از پشتیبانی پت‌دیت کمک می‌خواهد.'
      : ctx.kind === 'trainer'
        ? 'مربی انسانی آنلاین نیست. لطفاً برای هماهنگی/شروع آموزش راهنمایی بده.'
        : 'دامپزشک آنلاین نیست. لطفاً راهنمایی عمومی بده.';
  const ask =
    ctx.userMessage?.trim() ||
    (ctx.kind === 'support'
      ? 'سلام؛ چطور می‌توانم کمکت کنم؟'
      : ctx.kind === 'trainer'
        ? 'برای شروع آموزش پت چه برنامهٔ ساده‌ای پیشنهاد می‌کنی؟'
        : 'برای مراقبت کلی از پت چه نکات مهمی داری؟');
  return [intro, bits.length ? bits.join(' · ') : null, '', ask].filter(Boolean).join('\n');
}

/** Offline advisor when no LLM API key is configured. */
export function offlineAiAdvice(ctx: AiConsultContext): string {
  const pet =
    [ctx.petName, ctx.petBreed || ctx.petSpecies].filter(Boolean).join(' · ') || 'پت';
  if (ctx.kind === 'support') {
    const q = ctx.userMessage?.trim();
    return [
      `👋 من پشتیبانی هوشمند پت‌دیت هستم.`,
      ``,
      q
        ? `دربارهٔ «${q}»:`
        : `بگو روی کدام بخش گیر کردی: ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه.`,
      ``,
      `راهنمای سریع:`,
      `• ورود وب با OTP پیامک — همان حساب ربات تلگرام`,
      `• ثبت پت از «پت‌های من» یا ربات`,
      `• همبازی از پنل صاحب پت / گفتگوها`,
      `• مربی و دامپزشک از پنل‌های مربوط؛ اگر آنلاین نباشند دستیار هوشمند پاسخ می‌دهد`,
      `• سکه از منوی کیف پول / ربات`,
      ``,
      `اگر مشکل ادامه داشت جزئیات بیشتری بفرست (مثلاً اسکرین یا پیام خطا).`,
    ].join('\n');
  }
  if (ctx.kind === 'trainer') {
    return [
      `👋 من دستیار هوشمند آموزش پت‌دیت هستم (مربی انسانی الان آنلاین نیست).`,
      ``,
      `برای ${pet} می‌توانیم از همین‌جا شروع کنیم:`,
      `۱) روزی ۲–۳ جلسهٔ کوتاه ۵ تا ۱۰ دقیقه‌ای`,
      `۲) یک فرمان پایه (مثلاً بشین/بیا) با تشویقی کوچک`,
      `۳) محیط آرام، بدون تنبیه`,
      `۴) ثبت پیشرفت تا وقتی مربی آنلاین شد ادامه را حضوری هماهنگ کنید`,
      ``,
      ctx.userMessage?.trim()
        ? `دربارهٔ «${ctx.userMessage.trim()}»: با تکرار کوتاه، پاداش فوری و پایان جلسه روی موفقیت پیش برو.`
        : `سؤالت را همین‌جا بنویس تا مرحله‌به‌مرحله راهنمایی‌ات کنم.`,
      ``,
      `⚠️ این راهنما جایگزین مربی متخصص نیست.`,
    ].join('\n');
  }
  return [
    `👋 من دستیار هوشمند پت‌دیت هستم (دامپزشک انسانی الان آنلاین نیست).`,
    ``,
    `برای ${pet} چند نکتهٔ عمومی:`,
    `• آب تازه و غذای متناسب با سن/گونه`,
    `• علائم خطر (بی‌حالی شدید، استفراغ مکرر، تنگی نفس، خونریزی، تشنج) → فوری دامپزشک حضوری`,
    `• دارو را بدون تجویز شروع نکن`,
    ``,
    ctx.userMessage?.trim()
      ? `دربارهٔ «${ctx.userMessage.trim()}»: جزئیات سن، مدت علائم و شدت را بگو تا راهنمایی دقیق‌تری بدهم.`
      : `علائم یا سؤالت را بنویس تا کمکت کنم.`,
    ``,
    `⚠️ این پاسخ مشاوره عمومی است و جایگزین ویزیت دامپزشک نیست.`,
  ].join('\n');
}

async function callOpenAiCompatible(ctx: AiConsultContext): Promise<string | null> {
  const key = envKey();
  if (!key) return null;
  const base = envBaseUrl();
  const model = envModel();
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt(ctx.kind) },
  ];
  for (const h of ctx.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: buildUserPrompt(ctx) });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 700,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`ai-consult HTTP ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = String(data.choices?.[0]?.message?.content ?? '').trim();
    return text || null;
  } catch (err) {
    console.warn('ai-consult request failed:', (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateAiConsultAdvice(ctx: AiConsultContext): Promise<{
  text: string;
  source: 'llm' | 'offline';
}> {
  const llm = await callOpenAiCompatible(ctx);
  if (llm) return { text: llm, source: 'llm' };
  return { text: offlineAiAdvice(ctx), source: 'offline' };
}
