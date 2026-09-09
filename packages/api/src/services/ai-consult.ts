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

/** نام نمایشی مربی آنلاین (وقتی مربی دیگری آزاد نیست) */
export const AI_TRAINER_DISPLAY_NAME = 'پاشا یزدانی';

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
      `تو ${AI_TRAINER_DISPLAY_NAME} هستی؛ مربی باتجربهٔ آموزش سگ و گربه که از طریق پت‌دیت آنلاین در دسترس هستی.`,
      'مثل یک مربی واقعی حرف بزن: اول‌شخص، گرم، صمیمی، کمی ادبی ولی طبیعی و گفت‌وگو‌محور — نه ربات، نه بولت‌لیست خشک مگر کاربر صریحاً چک‌لیست بخواهد.',
      `هرگز نگو و اشاره نکن که دستیار هوشمند، هوش مصنوعی، ربات، AI، مدل زبانی، یا «جایگزین مربی» هستی. اگر پرسیدند کی هستی: «من ${AI_TRAINER_DISPLAY_NAME} هستم، مربی آنلاین پت‌دیت.»`,
      'نرم بگو که وقتی مربی دیگری آزاد نباشد از همین‌جا آنلاین همراهی می‌کنی؛ شخصیت انسانِ مربی را نشکن.',
      'دانش‌ات را از ادبیات مدرن ترینینگ به‌کار بگیر: تقویت مثبت (R+)، کلیکر/مارکر، حساسیت‌زدایی و counter-conditioning، پنجرهٔ جامعه‌پذیری توله، آداب قلاده، مدیریت فاصله، enrichment، مدیریت ترس/اضطراب، و برنامه‌های کوتاه روزانه. دقیق، عملی و متناسب سن/نژاد/گونه پاسخ بده.',
      'هر سؤال ترینینگ یا رفتار پت را کامل و دقیق جواب بده. وقتی اطلاعات کم است ۱–۲ سؤال کوتاه بپرس (سن، نژاد، محیط، تاریخچه).',
      'برای آموزش فرمان: ابتدا یک پاراگراف همدلانه، بعد در صورت نیاز چند گام شماره‌دار سبک؛ در پایان دعوت به سؤال بعدی مثل یک کوچ واقعی.',
      'اگر موضوع پزشکی/اورژانس بود در نقش خودت بمان ولی فوری به دامپزشک واقعی ارجاع بده؛ تشخیص یا دارو اختراع نکن.',
      'از تنبیه فیزیکی، خفه‌کردن، شوک و روش‌های خشن دوری کن؛ force-free و تقویت مثبت را ترجیح بده.',
      'از تضمین ۱۰۰٪ نتیجه و ادعاهای پزشکی خودداری کن. گاه با مثال کوتاه از تجربهٔ آموزشی (بدون ادعاهای پزشکی) حرف بزن.',
      'پاسخ را به فارسی روان بنویس؛ از قالب‌های تکراریِ خشک در شروع هر پیام پرهیز کن.',
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
        ? 'کاربر برای آموزش/رفتار پت راهنمایی می‌خواهد.'
        : 'دامپزشک آنلاین نیست. لطفاً راهنمایی عمومی بده.';
  const ask =
    ctx.userMessage?.trim() ||
    (ctx.kind === 'support'
      ? 'سلام؛ چطور می‌توانم کمکت کنم؟'
      : ctx.kind === 'trainer'
        ? 'سلام؛ برای شروع آموزش پت از کجا شروع کنیم؟'
        : 'برای مراقبت کلی از پت چه نکات مهمی داری؟');
  return [intro, bits.length ? bits.join(' · ') : null, '', ask].filter(Boolean).join('\n');
}

function trainerTopicHint(message: string): string | null {
  const q = message.toLowerCase();
  if (/بشین|نشست|sit/.test(q)) {
    return [
      `«بشین» را معمولاً با تشویقی جلوی بینی و یک حرکت ملایم به بالا شروع می‌کنم؛ به‌محض اینکه پشتی نشست، فوری جایزه می‌دهم.`,
      `۱) جلسه حدود ۵ دقیقه، ۵ تا ۱۰ تکرار موفق`,
      `۲) یک کلمهٔ ثابت مثل «بشین» با لحن آرام`,
      `۳) وقتی حدود هشتاد درصد مواقع درست نشست، کمی تأخیر قبل از تشویقی`,
    ].join('\n');
  }
  if (/بیا|برگشت|recall|صدا/.test(q)) {
    return [
      `برای «بیا» اول فاصله را کوتاه نگه دار و محیط را خلوت کن؛ برگشت باید همیشه حسِ جایزه داشته باشد، نه ترس.`,
      `۱) صدای شاد + جایزهٔ باارزش وقتی آمد`,
      `۲) هرگز برای برگشت تنبیه نکن`,
      `۳) کم‌کم فاصله و حواس‌پرتی را سخت‌تر کن`,
    ].join('\n');
  }
  if (/قلاده|کشید|leash|پیاده/.test(q)) {
    return [
      `قلاده را اول داخل خانه با بند سبک و تشویقی تمرین می‌کنم تا راه رفتن کنار پا حس خوبی پیدا کند.`,
      `۱) اگر کشید: بایست؛ وقتی توجه کرد جایزه`,
      `۲) مسیرهای کوتاه با پاداش کنار پا`,
      `۳) بیرون فقط بعد از چند جلسهٔ خانگی موفق`,
    ].join('\n');
  }
  if (/گاز|پرخاش|عض|bite|حمله/.test(q)) {
    return [
      `در پرخاش یا گاز گرفتن، اول ایمنی و پیدا کردن علت مهم است: ترس، درد، محافظت منبع، یا هیجان زیاد.`,
      `۱) محرک را موقتاً کم کن`,
      `۲) با مدیریت فاصله و تقویت آرامش شروع کن`,
      `۳) اگر ناگهانی یا شدید بود، قبل از ادامهٔ تمرین با دامپزشک هم چک کن`,
    ].join('\n');
  }
  if (/پارس|صد|bark|هاپ/.test(q)) {
    return [
      `پارس معمولاً پیام است؛ اول ببین چه موقع شروع می‌شود — زنگ، تنهایی، یا هیجان.`,
      `۱) قبل از پارس: «آروم» + تشویقی برای سکوت کوتاه`,
      `۲) انرژی اضافه را با بازی و پیاده‌روی تخلیه کن`,
      `۳) محیط را کمی مدیریت کن تا موفقیت‌های کوچک پشت‌سرهم بیاید`,
    ].join('\n');
  }
  if (/دستشوی|پد|potty|توالت|مدفوع/.test(q)) {
    return [
      `دستشویی با برنامه پیش می‌رود، نه با دعوا: بعد از بیداری، غذا و بازی، همان نقطهٔ ثابت بیرون یا پد.`,
      `۱) جایزه فوری وقتی درست انجام داد`,
      `۲) تصادف را بی‌سروصدا جمع کن؛ تنبیه نکن`,
      `۳) برنامه را چند روز ثابت نگه دار`,
    ].join('\n');
  }
  if (/توله|puppy|جوجه/.test(q)) {
    return [
      `توله مغز کوچکی دارد؛ جلسات ۳ تا ۵ دقیقه‌ای و چندبار در روز بهتر از یک جلسهٔ طولانی جواب می‌دهد.`,
      `۱) جامعه‌پذیری ملایم با آدم، صدا و محیط`,
      `۲) گاز بازی = توقف کوتاه بازی + جایگزین اسباب`,
      `۳) خواب و بازی منظم، پایهٔ یادگیری است`,
    ].join('\n');
  }
  if (/گربه|cat|میو/.test(q)) {
    return [
      `گربه با فشار یاد نمی‌گیرد؛ با تشویقی، بازی و انتخاب خودش جلو می‌رود.`,
      `۱) بستر و جای خراشیدن مشخص`,
      `۲) تقویت مثبت کوتاه و مکرر`,
      `۳) اگر زمان خواست، عجله نکن`,
    ].join('\n');
  }
  if (/ترس|اضطراب|anxiety|استرس/.test(q)) {
    return [
      `ترس را با زور حل نمی‌کنیم؛ از فاصلهٔ امن شروع می‌کنیم و برای آرام ماندن پاداش می‌دهیم.`,
      `۱) محرک را از دور شروع کن`,
      `۲) هر روز یک قدم کوچک`,
      `۳) اگر لرزش، پنهان‌شدن شدید یا پرخاش دیدی، قدم را عقب بکش`,
    ].join('\n');
  }
  if (/تشویق|جایزه|reward|کلیکر/.test(q)) {
    return [
      `تقویت مثبت وقتی قوی است که جایزه زیر دو ثانیه برسد و مارکر (کلمه یا کلیکر) ثابت بماند.`,
      `۱) برای کار سخت، تشویقی باارزش‌تر`,
      `۲) اول پیوسته جایزه بده، بعد کم‌کم فاصله بینداز`,
      `۳) لحن تشویق را گرم و یکدست نگه دار`,
    ].join('\n');
  }
  return null;
}

function trainerFollowUpReply(ctx: AiConsultContext): string | null {
  const q = ctx.userMessage?.trim() ?? '';
  const history = ctx.history ?? [];
  if (!history.length) return null;
  const lastUser = [...history].reverse().find((h) => h.role === 'user')?.content?.trim();
  const normalized = q.replace(/\s+/g, ' ').trim();
  const isShortFollowUp =
    normalized.length <= 48 &&
    /^(بله|آره|اره|باشه|مرسی|ممنون|بیشتر|ادامه|چطور|چجوری|چگونه|بعد|بعدش|؟|\?|ok|okay)([\s،.!؟]*)$|^(بیشتر\s+توضیح|ادامه\s+بده|مرحله\s+بعد)/i.test(
      normalized
    );
  if (isShortFollowUp && lastUser) {
    const hint = trainerTopicHint(lastUser);
    if (hint) {
      return [
        `باشه، روی «${lastUser}» دقیق‌تر می‌روم.`,
        ``,
        hint,
        ``,
        `اگر سن یا نژاد ${ctx.petName || 'پت'} را بگویی، برنامه را برایت شخصی‌تر می‌چینم.`,
      ].join('\n');
    }
  }
  return null;
}

function supportTopicHint(message: string): string | null {
  const q = message.toLowerCase();
  if (/otp|کد|پیامک|ورود|لاگین|login|رمز/.test(q)) {
    return [
      `ورود وب با OTP:`,
      `۱) شماره موبایل را در petdate.ir وارد کن`,
      `۲) کد ۶ رقمی پیامک را بزن (۱–۲ دقیقه صبر کن)`,
      `۳) همان شماره در ربات تلگرام = همان حساب`,
      `اگر کد نمی‌آید: آنتن، اسپم، و شمارهٔ درست را چک کن؛ بعد «ارسال مجدد».`,
    ].join('\n');
  }
  if (/پت|ثبت.*سگ|ثبت.*گربه|پروفایل.*پت|pet/.test(q)) {
    return [
      `ثبت پت:`,
      `• وب: منو → «پت‌های من» → افزودن پت`,
      `• ربات: منو → ثبت/ویرایش پت و مراحل را پر کن`,
      `عکس پت بعد از تأیید ادمین نمایش داده می‌شود.`,
    ].join('\n');
  }
  if (/همبازی|playdate|نزدیک|جستجو/.test(q)) {
    return [
      `همبازی:`,
      `• پت را ثبت کن و «دنبال همبازی» را فعال کن`,
      `• از «جستجوی پت» یا «پت‌های نزدیک» فیلتر بزن`,
      `• درخواست بفرست؛ بعد از قبول، گفتگو باز می‌شود`,
    ].join('\n');
  }
  if (/مربی|trainer|آموزش/.test(q)) {
    return [
      `مربی:`,
      `• منو → درخواست مربی / پنل مربی`,
      `• اگر مربی دیگری آنلاین باشد اتصال مستقیم؛ وگرنه پاشا یزدانی (مربی آنلاین) راهنمایی می‌کند`,
      `• مدارک مربی باید تأیید شده باشد`,
    ].join('\n');
  }
  if (/پرستار|sitter|نگهداری/.test(q)) {
    return [
      `پرستار:`,
      `• منو → درخواست پرستار`,
      `• زمان و محل را مشخص کن؛ پرستار تأییدشده هماهنگ می‌کند`,
    ].join('\n');
  }
  if (/دامپزشک|vet|مشاوره.*پزشک|پزشک/.test(q)) {
    return [
      `دامپزشک:`,
      `• منو → مشاوره سریع / پنل دامپزشک`,
      `• اگر پزشک آنلاین نباشد دستیار هوشمند پاسخ اولیه می‌دهد`,
      `• اورژانس = مراجعه حضوری فوری، نه چت`,
    ].join('\n');
  }
  if (/شاپ|فروشگاه|shop|خرید/.test(q)) {
    return [
      `شاپ:`,
      `• منو → فروشگاه؛ محصول را انتخاب و آدرس/تلفن را وارد کن`,
      `• پرداخت با سکه یا رسید (طبق راهنمای checkout)`,
      `• خطا؟ متن خطا + اسکرین بفرست`,
    ].join('\n');
  }
  if (/سکه|coin|کیف\s*پول|wallet|شارژ|پرداخت/.test(q)) {
    return [
      `سکه / کیف پول:`,
      `• منو → کیف پول / سکه`,
      `• برای مشاوره و برخی خدمات سکه لازم است`,
      `• شارژ از راهنمای «ارسال رسید» در ربات`,
    ].join('\n');
  }
  if (/ربات|تلگرام|telegram|bot/.test(q)) {
    return [
      `ربات تلگرام:`,
      `• /start برای ساخت/بازیابی حساب`,
      `• منوی پایین = همان امکانات اصلی`,
      `• وب و ربات با یک شماره OTP یکی می‌شوند`,
    ].join('\n');
  }
  if (/وب|سایت|petdate/.test(q)) {
    return [
      `وب petdate.ir:`,
      `• ورود OTP → داشبورد نقش‌ات`,
      `• پشتیبانی: منو → «پشتیبانی» (/support)`,
    ].join('\n');
  }
  return null;
}

function supportFollowUpReply(ctx: AiConsultContext): string | null {
  const q = ctx.userMessage?.trim() ?? '';
  const history = ctx.history ?? [];
  if (!history.length) return null;
  const lastUser = [...history].reverse().find((h) => h.role === 'user')?.content?.trim();
  const normalized = q.replace(/\s+/g, ' ').trim();
  const isShortFollowUp =
    normalized.length <= 48 &&
    /^(بله|آره|اره|باشه|مرسی|ممنون|بیشتر|ادامه|چطور|چجوری|چگونه|بعد|بعدش|؟|\?|ok|okay)([\s،.!؟]*)$|^(بیشتر\s+توضیح|ادامه\s+بده|مرحله\s+بعد)/i.test(
      normalized
    );
  if (isShortFollowUp && lastUser) {
    const hint = supportTopicHint(lastUser);
    if (hint) {
      return [
        `ادامهٔ راهنما برای «${lastUser}»:`,
        ``,
        hint,
        ``,
        `اگر هنوز گیر کردی، دقیق بگو کدام مرحله خطا می‌دهد.`,
      ].join('\n');
    }
  }
  return null;
}

/** Offline advisor when no LLM API key is configured. */
export function offlineAiAdvice(ctx: AiConsultContext): string {
  const pet =
    [ctx.petName, ctx.petBreed || ctx.petSpecies].filter(Boolean).join(' · ') || 'پت';
  if (ctx.kind === 'support') {
    const q = ctx.userMessage?.trim() ?? '';
    const hasHistory = (ctx.history?.length ?? 0) > 0;
    const followUp = supportFollowUpReply(ctx);
    if (followUp) return followUp;
    const topic = q ? supportTopicHint(q) : null;
    if (topic) {
      const lines = hasHistory
        ? [`دربارهٔ «${q}»:`, ``, topic]
        : [`👋 من پشتیبانی هوشمند پت‌دیت هستم.`, ``, topic];
      lines.push(``, `سؤال بعدی‌ات را بپرس — همین‌جا ادامه می‌دهیم.`);
      return lines.join('\n');
    }
    if (hasHistory) {
      return [
        `دربارهٔ «${q || 'ادامهٔ گفتگو'}»:`,
        ``,
        `برای راهنمایی دقیق‌تر بگو کدام بخش: ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه.`,
        `اگر خطا دیدی متن خطا یا اسکرین بفرست.`,
      ].join('\n');
    }
    return [
      `👋 من پشتیبانی هوشمند پت‌دیت هستم.`,
      ``,
      q
        ? `دربارهٔ «${q}» — یکی از این‌ها را امتحان کن یا جزئیات بیشتر بفرست:`
        : `بگو روی کدام بخش گیر کردی: ورود، پت، همبازی، مربی، دامپزشک، شاپ یا سکه.`,
      ``,
      `• ورود وب با OTP پیامک — همان حساب ربات تلگرام`,
      `• ثبت پت از «پت‌های من» یا ربات`,
      `• همبازی از پنل صاحب پت / گفتگوها`,
      `• مربی و دامپزشک از پنل‌های مربوط؛ برای مربی اگر کسی آزاد نباشد پاشا یزدانی آنلاین جواب می‌دهد`,
      `• سکه از منوی کیف پول / ربات`,
      ``,
      `سؤال بعدی‌ات را بپرس — گفتگو ادامه دارد.`,
    ].join('\n');
  }
  if (ctx.kind === 'trainer') {
    const q = ctx.userMessage?.trim() ?? '';
    const hasHistory = (ctx.history?.length ?? 0) > 0;
    const followUp = trainerFollowUpReply(ctx);
    if (followUp) return followUp;
    const topic = q ? trainerTopicHint(q) : null;
    if (topic) {
      const openings = hasHistory
        ? [
            `در مورد «${q}» این‌طور پیش می‌روم:`,
            `خوب شد که پرسیدی — دربارهٔ «${q}»:`,
            `بگذار روی «${q}» عملی حرف بزنم:`,
          ]
        : [
            `سلام، من ${AI_TRAINER_DISPLAY_NAME} هستم؛ مربی آنلاین پت‌دیت. خوشحالم که اینجایی.`,
            `سلام، ${AI_TRAINER_DISPLAY_NAME}ام. از طریق پت‌دیت آنلاین درخدمتم.`,
          ];
      const opening = openings[(q.length + (ctx.petName?.length ?? 0)) % openings.length]!;
      return [
        opening,
        ``,
        topic,
        ``,
        `اگر خواستی بگو سن و محیط ${ctx.petName || 'پت'} چطور است تا قدم بعدی را دقیق‌تر بچینیم.`,
      ].join('\n');
    }
    if (hasHistory) {
      return [
        q
          ? `دربارهٔ «${q}» با تقویت مثبت و جلسات کوتاه جلو می‌رویم. سن، نژاد و محیط ${pet} را بگو تا برنامه را شخصی‌تر کنم.`
          : `بگو الان بیشتر روی بشین، بیا، قلاده، پارس یا توله گیر کرده‌ای — با هم جلو می‌رویم.`,
      ].join('\n');
    }
    const greetings = [
      `سلام، من ${AI_TRAINER_DISPLAY_NAME} هستم؛ مربی آنلاین پت‌دیت. خوش اومدی.`,
      `سلام! ${AI_TRAINER_DISPLAY_NAME}ام. از همین‌جا برای آموزش ${pet} کنارت هستم.`,
    ];
    const greet = greetings[(ctx.petName?.length ?? 0) % greetings.length]!;
    return [
      greet,
      ``,
      `برای شروع معمولاً این‌طور می‌چینم:`,
      `۱) روزی دو سه جلسهٔ کوتاه پنج تا ده دقیقه‌ای`,
      `۲) یک فرمان پایه مثل بشین یا بیا با تشویقی`,
      `۳) محیط آرام و بدون تنبیه — فقط تقویت مثبت`,
      ``,
      q
        ? `دربارهٔ «${q}»: سن و رفتار فعلی ${pet} را بگو تا مرحله‌به‌مرحله راهنمایی‌ات کنم.`
        : `هر سؤالی دربارهٔ آموزش یا رفتار داری، همین‌جا بپرس.`,
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
  if (ctx.kind === 'support' || ctx.kind === 'trainer') {
    const userText = ctx.userMessage?.trim() || 'سلام';
    const ctxBits: string[] = [];
    if (!(ctx.history?.length ?? 0)) {
      if (ctx.patientName) ctxBits.push(`نام صاحب پت: ${ctx.patientName}`);
      if (ctx.petName) ctxBits.push(`نام پت: ${ctx.petName}`);
      if (ctx.petSpecies) ctxBits.push(`گونه: ${ctx.petSpecies}`);
      if (ctx.petBreed) ctxBits.push(`نژاد: ${ctx.petBreed}`);
    }
    const prefix = ctxBits.length ? `${ctxBits.join(' · ')}\n\n` : '';
    messages.push({ role: 'user', content: `${prefix}${userText}` });
  } else {
    messages.push({ role: 'user', content: buildUserPrompt(ctx) });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
  const temperature = ctx.kind === 'trainer' ? 0.72 : 0.6;
  const maxTokens = ctx.kind === 'trainer' ? 1100 : 700;
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
        temperature,
        max_tokens: maxTokens,
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
