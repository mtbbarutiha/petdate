/**
 * Three AI agent backends + domain guards for PetDate personas.
 *
 * Personas map to backends in @petdate/shared TEAM_AGENTS.
 * Out-of-domain questions get a polite refusal + optional redirect.
 */
import {
  TEAM_AGENTS,
  type TeamAgentBackend,
  type TeamAgentDef,
} from '@petdate/shared';

export type DomainGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'out_of_domain';
      suggestedBackend: TeamAgentBackend | null;
      suggestedPersonas: TeamAgentDef[];
      replyFa: string;
    };

const VET_MARKERS =
  /دامپزشک|دام‌پزشک|پزشک|ویزیت|نسخه|دارو|آنتی\s*بیوتیک|تب|استفراغ|اسهال|خونریزی|تشنج|زخم|عفونت|واکسن|انگل|کرم|گوش\s*درد|چشم\s*چرک|تنگی\s*نفس|بی‌حالی|آلرژی|جراحی|بیماری|علائم|سلامت|تغذیه\s*بیمار|مسموم|لنگش|درد|سرفه|عطسه|کرم\s*کشی|ضد\s*کک|کک|کنه|vet|medicine|antibiotic|vomit|diarrhea|fever|seizure/i;

const TRAINER_MARKERS =
  /مربی|آموزش|تربیت|فرمان|بشین|بمان|بیا|قلاده|پاشو|جایزه|کلیکر|رفتار|گاز|پارس|جدايي|جدایی|اضطراب|دستشویی|جعبه|crate|پیاده‌روی|اجتماعی|پلی‌دیت|همبازی|پاشا|trainer|sit|stay|leash|bark|bite|crate|clicker|obedience/i;

const SUPPORT_MARKERS =
  /پشتیبانی|تیکت|otp|ورود|ثبت[\s‌]?نام|سکه|کیف\s*پول|شارژ|پرداخت|سفارش|شاپ|فروشگاه|ربات|تلگرام|حساب|پروفایل|رمز|خطا|باگ|سایت|وب|پیگیری|پیامک|sms|پشتیبانی|مشکل\s*فنی|نمی‌تونم\s*وارد|لاگین|login|wallet|coin|ticket|support|shop|checkout/i;

const GREETING_ONLY =
  /^(سلام|درود|هی|hello|hi|صبح\s*بخیر|عصر\s*بخیر|شب\s*بخیر|خوبی|حالت\s*چطوره)[\s!.؟?]*$/i;

function personasFor(backend: TeamAgentBackend): TeamAgentDef[] {
  return TEAM_AGENTS.filter((a) => a.backend === backend);
}

function formatPersonaHint(personas: TeamAgentDef[]): string {
  if (!personas.length) return '';
  return personas.map((p) => `${p.name} (${p.role})`).join(' یا ');
}

/**
 * Classify a user message against the active backend.
 * Greetings and empty messages always pass (persona handles openers).
 */
export function guardAgentDomain(
  backend: TeamAgentBackend,
  userMessage: string | null | undefined
): DomainGuardResult {
  const q = String(userMessage || '').trim();
  if (!q || GREETING_ONLY.test(q) || q.length < 4) return { ok: true };

  const looksVet = VET_MARKERS.test(q);
  const looksTrainer = TRAINER_MARKERS.test(q);
  const looksSupport = SUPPORT_MARKERS.test(q);

  // Strong in-domain signal wins even if another marker also matches weakly.
  if (backend === 'vet') {
    if (looksVet) return { ok: true };
    if (looksTrainer && !looksSupport) {
      const suggested = personasFor('trainer');
      return {
        ok: false,
        reason: 'out_of_domain',
        suggestedBackend: 'trainer',
        suggestedPersonas: suggested,
        replyFa: [
          'این مورد بیشتر به آموزش و رفتار پت مربوط می‌شود و تخصص من دامپزشکی است.',
          suggested.length
            ? `برای تربیت/رفتار با ${formatPersonaHint(suggested)} چت کن.`
            : 'با یکی از مربی‌های پت‌دیت چت کن.',
        ].join(' '),
      };
    }
    if (looksSupport && !looksTrainer) {
      const suggested = personasFor('support');
      return {
        ok: false,
        reason: 'out_of_domain',
        suggestedBackend: 'support',
        suggestedPersonas: suggested,
        replyFa: [
          'سؤالت دربارهٔ سایت/حساب یا پشتیبانی فنی است و خارج از حوزهٔ دامپزشکی من است.',
          suggested.length
            ? `از ${formatPersonaHint(suggested)} کمک بگیر.`
            : 'از بخش پشتیبانی پت‌دیت کمک بگیر.',
        ].join(' '),
      };
    }
    return { ok: true };
  }

  if (backend === 'trainer') {
    if (looksTrainer) return { ok: true };
    if (looksVet && !looksSupport) {
      const suggested = personasFor('vet');
      return {
        ok: false,
        reason: 'out_of_domain',
        suggestedBackend: 'vet',
        suggestedPersonas: suggested,
        replyFa: [
          'این موضوع پزشکی/سلامت پت است و تخصص من آموزش و رفتار است.',
          suggested.length
            ? `برای دامپزشکی با ${formatPersonaHint(suggested)} صحبت کن.`
            : 'با دامپزشک آنلاین پت‌دیت صحبت کن.',
          'اگر اورژانسیه، حضوری برو.',
        ].join(' '),
      };
    }
    if (looksSupport && !looksVet) {
      const suggested = personasFor('support');
      return {
        ok: false,
        reason: 'out_of_domain',
        suggestedBackend: 'support',
        suggestedPersonas: suggested,
        replyFa: [
          'این کار پشتیبانی سایت/حساب است؛ من مربی پت هستم.',
          suggested.length
            ? `با ${formatPersonaHint(suggested)} در میون بذار.`
            : 'از پشتیبانی پت‌دیت بپرس.',
        ].join(' '),
      };
    }
    return { ok: true };
  }

  // support
  if (looksSupport) return { ok: true };
  if (looksVet && !looksTrainer) {
    const suggested = personasFor('vet');
    return {
      ok: false,
      reason: 'out_of_domain',
      suggestedBackend: 'vet',
      suggestedPersonas: suggested,
      replyFa: [
        'من پشتیبانی پت‌دیت هستم و تشخیص/درمان نمی‌دم.',
        suggested.length
          ? `برای سلامت پت با ${formatPersonaHint(suggested)} چت کن.`
          : 'با دامپزشک آنلاین چت کن.',
      ].join(' '),
    };
  }
  if (looksTrainer && !looksVet) {
    const suggested = personasFor('trainer');
    return {
      ok: false,
      reason: 'out_of_domain',
      suggestedBackend: 'trainer',
      suggestedPersonas: suggested,
      replyFa: [
        'آموزش و رفتار پت تخصص مربی‌هاست، نه پشتیبانی.',
        suggested.length
          ? `با ${formatPersonaHint(suggested)} شروع کن.`
          : 'با مربی آنلاین پت‌دیت شروع کن.',
      ].join(' '),
    };
  }
  return { ok: true };
}

/** Extra system-prompt lines for a persona on top of its backend. */
export function personaPromptOverlay(agent: TeamAgentDef | null | undefined): string[] {
  if (!agent) return [];
  const lines: string[] = [
    `هویت نمایشی تو: ${agent.name} (${agent.role}).`,
    `بک‌اند تو: ${agent.backend}. فقط در همین حوزه جواب بده.`,
    'لحن کاربر را آینه کن (رسمی↔صمیمی). مثل آدم واقعی حرف بزن.',
    'اگر سؤال خارج از تخصص بود مؤدبانه بگو تخصصت نیست و به پرسونای درست ارجاع بده.',
  ];
  if (agent.backend === 'trainer' && agent.coachStyle === 'pasha') {
    lines.push(
      'سبک مربی‌گری: الگوی نقش پاشا یزدانی — گرم، خودمونی، عملی، تقویت مثبت؛ بدون تنبیه بدنی/آلفا.'
    );
  }
  if (agent.introSelf) {
    lines.push(
      `در پیام اول خودت را معرفی کن: «سلام، من ${agent.name} هستم، مربی پت‌دیت.» بعد احوال‌پرسی کوتاه.`,
      'وسط گفتگو معرفی تکراری نکن.'
    );
  }
  if (agent.backend === 'support') {
    lines.push(
      'می‌توانی تیکت بسازی، پیگیری بگذاری، برای مشتری پیامک بفرستی، و اگر گیر کردی از محمد (اپراتور) بپرسی.',
      'جریان کامل سایت را بلد باش: OTP، پت، همبازی، مربی، دامپزشک، شاپ، سکه، وب↔ربات.'
    );
  }
  return lines;
}

export function backendSystemCore(backend: TeamAgentBackend, agentName: string): string[] {
  if (backend === 'support') {
    return [
      `تو ${agentName} هستی؛ پشتیبانی هوشمند پلتفرم پت‌دیت.`,
      'به فارسی، کوتاه، واضح و هم‌لحن با کاربر راهنمایی کن.',
      'کمک کن کاربر بفهمد چطور: ورود OTP، ثبت پت، همبازی، مربی، دامپزشک، شاپ، کیف پول/سکه، و اتصال وب↔ربات کار می‌کند.',
      'اگر مشکل فنی حل نشد تیکت بساز یا به محمد (اپراتور) ارجاع بده.',
      'تشخیص پزشکی یا تجویز دارو نده؛ آموزش عمیق رفتار نده — ارجاع بده.',
      `اگر پرسیدند کی هستی بگو ${agentName} از پشتیبانی پت‌دیت هستی.`,
    ];
  }
  if (backend === 'trainer') {
    return [
      `تو ${agentName} هستی؛ مربی واقعی آموزش پت. مثل آدم واقعی توی چت حرف بزن، نه مثل ربات یا جزوه.`,
      'لحن: چت خودمونی تلگرامی — گرم، مطمئن، کمی شوخ اگر جا داشته باشه.',
      'فارسی کاملاً گفتاری. روی فرمان‌ها عمیق جواب بده.',
      `هرگز نگو هوش مصنوعی / ربات / AI هستی. اگر پرسید: «من ${agentName}ام، مربی آنلاین پت‌دیت.»`,
      'پزشکی: نگران شو و بفرست دامپزشک؛ دارو نده.',
      'دانش: Donaldson Culture Clash، McConnell Puppy Primer، تقویت مثبت/کلیکر.',
    ];
  }
  return [
    `تو ${agentName} هستی؛ مشاوره دامپزشکی عمومی در پلتفرم پت‌دیت می‌دهی.`,
    'به فارسی، کوتاه، شفاف و محتاط پاسخ بده.',
    'در پاسخ فارسی از DOG/CAT یا کد انگلیسی گونه استفاده نکن؛ بگو سگ یا گربه.',
    'راهنمایی عمومی مراقبت، تغذیه، پیشگیری و زمان مراجعه به دامپزشک بده.',
    'تشخیص قطعی نده؛ نسخه دارو ننویس؛ در علائم خطرناک فوری به مراجعه حضوری تأکید کن.',
    'آموزش فرمان‌پذیری عمیق نده — به مربی ارجاع بده.',
    `اگر پرسیدند کی هستی بگو ${agentName} هستی.`,
  ];
}
