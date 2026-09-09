/**
 * Per-user tone learning for پاشا یزدانی — infer how each owner chats
 * and mirror that register (formal/casual, short/long, emoji, energy).
 */

export type UserToneProfile = {
  /** 0 = very casual (تو), 1 = very formal (شما) */
  formality: number;
  /** 0 = very short texts, 1 = long paragraphs */
  verbosity: number;
  /** 0 = no emoji, 1 = heavy emoji */
  emoji: number;
  /** 0 = calm, 1 = excited (!!! / ؟؟) */
  energy: number;
  /** Colloquial particle density (آخه، والا، دیگه، …) */
  colloquial: number;
  samples: number;
  updatedAt?: string;
};

const DEFAULT_TONE: UserToneProfile = {
  formality: 0.35,
  verbosity: 0.4,
  emoji: 0.15,
  energy: 0.35,
  colloquial: 0.45,
  samples: 0,
};

/** Persian letters — JS `\b` does not treat these as word chars. */
const FA = '\\u0600-\\u06FF';

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Count standalone Persian tokens (no ASCII `\b`). */
function countFaWord(text: string, word: string): number {
  const re = new RegExp(`(?<![${FA}])${word}(?![${FA}])`, 'g');
  return (text.match(re) || []).length;
}

function replaceFaWord(text: string, from: string, to: string): string {
  const re = new RegExp(`(?<![${FA}])${from}(?![${FA}])`, 'g');
  return text.replace(re, to);
}

/** Infer tone features from one user message. */
export function scoreUserMessageTone(text: string): Omit<UserToneProfile, 'samples' | 'updatedAt'> {
  const t = String(text || '').trim();
  if (!t) {
    return {
      formality: DEFAULT_TONE.formality,
      verbosity: DEFAULT_TONE.verbosity,
      emoji: DEFAULT_TONE.emoji,
      energy: DEFAULT_TONE.energy,
      colloquial: DEFAULT_TONE.colloquial,
    };
  }

  const formalHits =
    countFaWord(t, 'شما') +
    (t.match(/می‌فرمایید|بفرمایید|لطفاً?|خواهش|مرسی از شما|ممنون از شما|متشکرم|بنده|خواهشمندم/g) || [])
      .length;
  const casualHits =
    countFaWord(t, 'تو') +
    (t.match(/می‌خوام|نمی‌خوام|چیکار|چطوره|باشه|آره|عه |دیگه|آخه|والا|حالا|داداش|رفیق/g) || [])
      .length;
  // Formal markers weigh more so a polite owner clearly crosses the offline-rewrite band
  const formality = clamp01(0.22 + formalHits * 0.28 - casualHits * 0.14);

  const len = t.length;
  const verbosity = clamp01(len < 40 ? 0.15 : len < 120 ? 0.4 : len < 280 ? 0.65 : 0.9);

  const emojiCount =
    (t.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length +
    (t.match(/[\u{2600}-\u{27BF}]/gu) || []).length +
    (t.includes(':)') || t.includes(':) ') ? 1 : 0);
  const emoji = clamp01(emojiCount === 0 ? 0.05 : emojiCount === 1 ? 0.45 : emojiCount <= 3 ? 0.7 : 0.95);

  const bangs = (t.match(/!+/g) || []).join('').length;
  const qmarks = (t.match(/؟+|\?+/g) || []).join('').length;
  const energy = clamp01(0.2 + Math.min(0.7, bangs * 0.12 + qmarks * 0.08 + (t.includes('😂') ? 0.15 : 0)));

  const colloquialHits = (
    t.match(/آخه|والا|دیگه|حالا|یعنی|اصلاً|اصلا|چراا|عه\b|ها\b|دیگ\b|نمیخام|نمی‌خام|میشه|چیکار|داداش/g) ||
    []
  ).length;
  const colloquial = clamp01(0.2 + colloquialHits * 0.15 + casualHits * 0.05);

  return { formality, verbosity, emoji, energy, colloquial };
}

/** Blend many user messages into one profile (recent messages weigh more). */
export function inferUserToneFromMessages(messages: string[]): UserToneProfile {
  const cleaned = messages.map((m) => String(m || '').trim()).filter(Boolean);
  if (!cleaned.length) return { ...DEFAULT_TONE };

  const scores = cleaned.map(scoreUserMessageTone);
  // Recent messages count double
  const weights = scores.map((_, i) => (i >= scores.length - 3 ? 2 : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pick = (key: keyof Omit<UserToneProfile, 'samples' | 'updatedAt'>) =>
    scores.reduce((acc, s, i) => acc + s[key] * weights[i]!, 0) / wsum;

  return {
    formality: clamp01(pick('formality')),
    verbosity: clamp01(pick('verbosity')),
    // Emoji: keep the peak so one expressive message isn't washed out by short replies
    emoji: clamp01(Math.max(...scores.map((s) => s.emoji))),
    energy: clamp01(pick('energy')),
    colloquial: clamp01(pick('colloquial')),
    samples: cleaned.length,
    updatedAt: new Date().toISOString(),
  };
}

/** Exponential merge of stored tone with a fresh observation. */
export function mergeUserTone(
  previous: UserToneProfile | null | undefined,
  next: UserToneProfile,
  alpha = 0.35
): UserToneProfile {
  if (!previous || previous.samples <= 0) {
    return { ...next, samples: Math.max(1, next.samples) };
  }
  const a = clamp01(alpha);
  const mix = (p: number, n: number) => clamp01(p * (1 - a) + n * a);
  return {
    formality: mix(previous.formality, next.formality),
    verbosity: mix(previous.verbosity, next.verbosity),
    // Prefer recent peak emoji so expressive turns aren't diluted away
    emoji: clamp01(Math.max(mix(previous.emoji, next.emoji), next.emoji * 0.85)),
    energy: mix(previous.energy, next.energy),
    colloquial: mix(previous.colloquial, next.colloquial),
    samples: previous.samples + Math.max(1, next.samples),
    updatedAt: new Date().toISOString(),
  };
}

function band(v: number, low: string, mid: string, high: string): string {
  if (v < 0.34) return low;
  if (v < 0.66) return mid;
  return high;
}

/** Persian instruction injected into پاشا system prompt. */
export function formatToneSystemInstruction(profile: UserToneProfile): string {
  const formality = band(
    profile.formality,
    'صمیمی و خودمونی (تو، باشه، آره) — رسمی حرف نزن',
    'متعادل؛ کمی گرم، نه خشکِ اداری',
    'مودب و کمی رسمی‌تر (شما، لطفاً) ولی هنوز انسان و گرم'
  );
  const verbosity = band(
    profile.verbosity,
    'جواب کوتاه و جمع‌وجور؛ ۲–۵ جمله کافی است مگر جزئیات حیاتی باشد',
    'طول متوسط؛ ۲–۳ پاراگراف کوتاه',
    'می‌توانی کمی کامل‌تر توضیح بدهی؛ کاربر خودش هم بلند می‌نویسد'
  );
  const emoji = band(
    profile.emoji,
    'ایموجی کم یا هیچ',
    'گاهی یک ایموجی ملایم اگر طبیعی است',
    'می‌توانی ۱–۳ ایموجی خودمونی مثل طرف مقابل بگذاری'
  );
  const energy = band(
    profile.energy,
    'آروم و صبور',
    'گرم و زنده',
    'با انرژی بالاتر و تشویق بیشتر (بدون فریاد متنی)'
  );
  const colloquial = band(
    profile.colloquial,
    'فارسی روان و ساده؛ کمتر کوچه‌بازاری',
    'گفتاری طبیعی روزمره',
    'گفتاری خودمونی‌تر (ببین، راستش، آخه) — ولی بی‌ادب نشو'
  );

  return [
    'راهنمای لحن این کاربر (از پیام‌های قبلی‌اش یاد گرفته‌ای):',
    `• رسمیت: ${formality}`,
    `• طول جواب: ${verbosity}`,
    `• ایموجی: ${emoji}`,
    `• انرژی: ${energy}`,
    `• درجهٔ خودمونی: ${colloquial}`,
    'مهم: محتوای آموزشی دقیق بماند؛ فقط لحن و ریتم را با کاربر هم‌تراز کن. ادای لهجهٔ ساختگی یا مسخره‌بازی نکن.',
  ].join('\n');
}

/**
 * Light offline rewrite of openings to mirror user register.
 * Keeps content; tweaks pronouns / length soft-hints via prefix.
 */
export function offlineTonePrefix(profile: UserToneProfile): string {
  if (profile.formality >= 0.66) {
    return 'با احترام و کمی رسمی‌تر جواب بده، ولی گرم بمان.';
  }
  if (profile.colloquial >= 0.66 && profile.formality < 0.4) {
    return 'خودمونی و راحت جواب بده، مثل چت با دوست.';
  }
  if (profile.verbosity < 0.34) {
    return 'کوتاه و مفید بگو؛ پرحرفی نکن.';
  }
  return '';
}

export function applyOfflineToneStyle(text: string, profile: UserToneProfile): string {
  let out = text;
  if (profile.formality >= 0.66) {
    out = replaceFaWord(out, 'تو', 'شما');
    out = replaceFaWord(out, 'بگو', 'بفرمایید');
    out = out
      .replace(/کنی([.،]|$)/g, 'کنید$1')
      .replace(/ببین،/g, 'ببینید،')
      .replace(new RegExp(`ببین(?![${FA}])`, 'g'), 'ببینید');
  } else if (profile.formality < 0.35) {
    out = replaceFaWord(out, 'شما', 'تو');
  }

  if (profile.verbosity < 0.34) {
    // Keep first ~2 paragraphs + last question-ish line if present
    const parts = out.split(/\n\n+/).filter(Boolean);
    if (parts.length > 3) {
      out = [...parts.slice(0, 2), parts[parts.length - 1]].join('\n\n');
    }
  }

  if (profile.emoji >= 0.55 && !/[\u{1F300}-\u{1FAFF}]/u.test(out)) {
    out = out.replace(/^(آها|خب|سلام|باشه)/, '$1 🙂');
  }

  return out;
}

export function parseStoredTone(raw: string | null | undefined): UserToneProfile | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Partial<UserToneProfile>;
    return {
      formality: clamp01(Number(j.formality ?? DEFAULT_TONE.formality)),
      verbosity: clamp01(Number(j.verbosity ?? DEFAULT_TONE.verbosity)),
      emoji: clamp01(Number(j.emoji ?? DEFAULT_TONE.emoji)),
      energy: clamp01(Number(j.energy ?? DEFAULT_TONE.energy)),
      colloquial: clamp01(Number(j.colloquial ?? DEFAULT_TONE.colloquial)),
      samples: Math.max(0, Math.floor(Number(j.samples ?? 0))),
      updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}
