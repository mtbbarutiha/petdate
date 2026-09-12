/**
 * Shared error-code → FA/EN catalog for API copy and admin «لاگ خطاها».
 * Prefer this map over one-off UI string hacks.
 */

export type ErrorLang = 'fa' | 'en';

export type LocalizedCopy = {
  fa: string;
  en: string;
};

export function pickLocalized(copy: LocalizedCopy, lang: ErrorLang = 'fa'): string {
  return lang === 'en' ? copy.en : copy.fa;
}

/** Stable machine codes thrown by uploads / image pipeline / HTTP bodies. */
export const ERROR_CODE_COPY: Record<string, LocalizedCopy> = {
  INVALID_IMAGE: {
    fa: 'فایل عکس قابل پردازش نیست. یک عکس دیگر انتخاب کن',
    en: 'This image file could not be processed. Choose another photo.',
  },
  INVALID_MIME: {
    fa: 'فقط عکس مجاز است (JPG، PNG، WebP، HEIC، GIF)',
    en: 'Only image files are allowed (JPG, PNG, WebP, HEIC, GIF).',
  },
  FILE_TOO_LARGE: {
    fa: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)',
    en: 'Image is too large (maximum 8 MB).',
  },
  EMPTY_JPEG: {
    fa: 'خروجی عکس خالی بود',
    en: 'Normalized image output was empty.',
  },
  INVALID_STORAGE_KEY: {
    fa: 'ذخیره عکس ناموفق بود',
    en: 'Could not store the image.',
  },
  ECONNREFUSED: {
    fa: 'اتصال به سرویس برقرار نشد',
    en: 'Connection to the service was refused.',
  },
  ETIMEDOUT: {
    fa: 'اتمام مهلت اتصال / پاسخ',
    en: 'Connection or response timed out.',
  },
  ENOTFOUND: {
    fa: 'میزبان پیدا نشد',
    en: 'Host was not found.',
  },
  EPIPE: {
    fa: 'اتصال قطع شد',
    en: 'The connection was broken.',
  },
};

const DEFAULT_UPLOAD_FAIL: LocalizedCopy = {
  fa: 'ذخیره عکس ناموفق بود',
  en: 'Could not save the photo.',
};

/** User-facing upload error (API / forms). */
export function uploadErrorCopy(code: string, lang: ErrorLang = 'fa'): string {
  const row = ERROR_CODE_COPY[String(code || '').trim().toUpperCase()];
  return pickLocalized(row ?? DEFAULT_UPLOAD_FAIL, lang);
}

export const HTTP_STATUS_COPY: Record<number, LocalizedCopy> = {
  400: { fa: 'درخواست نامعتبر', en: 'Invalid request' },
  401: { fa: 'نیاز به ورود / احراز هویت', en: 'Authentication required' },
  403: { fa: 'دسترسی غیرمجاز', en: 'Forbidden' },
  404: { fa: 'یافت نشد', en: 'Not found' },
  408: { fa: 'اتمام مهلت درخواست', en: 'Request timed out' },
  409: { fa: 'تداخل وضعیت', en: 'Conflict' },
  413: { fa: 'حجم درخواست زیاد', en: 'Payload too large' },
  422: { fa: 'داده قابل پردازش نیست', en: 'Unprocessable entity' },
  429: { fa: 'تعداد درخواست بیش از حد', en: 'Too many requests' },
  500: { fa: 'خطای داخلی سرور', en: 'Internal server error' },
  502: { fa: 'خطای دروازه (upstream)', en: 'Bad gateway' },
  503: { fa: 'سرویس در دسترس نیست', en: 'Service unavailable' },
  504: { fa: 'اتمام مهلت دروازه', en: 'Gateway timeout' },
};

export function httpStatusCopy(code: number | null | undefined, lang: ErrorLang = 'fa'): string {
  if (code == null || !Number.isFinite(code)) {
    return lang === 'en' ? 'HTTP error' : 'خطای HTTP';
  }
  const row = HTTP_STATUS_COPY[code];
  if (row) return pickLocalized(row, lang);
  return lang === 'en' ? `HTTP ${code}` : `خطای HTTP ${code}`;
}

export const PATH_AREA_COPY: Array<{ test: (path: string) => boolean; copy: LocalizedCopy }> = [
  { test: (p) => p.includes('/games'), copy: { fa: 'بازی‌ها', en: 'Games' } },
  { test: (p) => p.includes('/avatar'), copy: { fa: 'آواتار', en: 'Avatar' } },
  { test: (p) => p.includes('/appointment'), copy: { fa: 'نوبت‌ها', en: 'Appointments' } },
  {
    test: (p) => p.includes('/consult') || p.includes('/consulting'),
    copy: { fa: 'مشاوره', en: 'Consult' },
  },
  { test: (p) => p.includes('/auth'), copy: { fa: 'احراز هویت', en: 'Auth' } },
  { test: (p) => p.includes('/shop'), copy: { fa: 'فروشگاه', en: 'Shop' } },
  { test: (p) => p.includes('/admin'), copy: { fa: 'پنل ادمین', en: 'Admin' } },
  { test: (p) => p.includes('/pet'), copy: { fa: 'حیوانات', en: 'Pets' } },
  { test: (p) => p.includes('/playdate'), copy: { fa: 'قرار بازی', en: 'Playdate' } },
  {
    test: (p) => p.includes('/wallet') || p.includes('/coin'),
    copy: { fa: 'کیف پول', en: 'Wallet' },
  },
  { test: (p) => p.includes('/magazine'), copy: { fa: 'مجله', en: 'Magazine' } },
  { test: (p) => p.includes('/support'), copy: { fa: 'پشتیبانی', en: 'Support' } },
  { test: (p) => p.includes('/marketplace'), copy: { fa: 'بازار', en: 'Marketplace' } },
  { test: (p) => p.includes('/hr'), copy: { fa: 'منابع انسانی', en: 'HR' } },
  { test: (p) => p.includes('/crm'), copy: { fa: 'باشگاه مشتریان', en: 'CRM' } },
  { test: (p) => p.includes('/finance'), copy: { fa: 'مالی', en: 'Finance' } },
];

export function pathAreaCopy(path: string, lang: ErrorLang = 'fa'): string {
  const p = stripQuery(path).toLowerCase();
  for (const row of PATH_AREA_COPY) {
    if (row.test(p)) return pickLocalized(row.copy, lang);
  }
  return '';
}

/** Known operational log prefixes (console.warn / bot / API). */
export const LOG_PATTERN_COPY: Array<{
  id: string;
  test: (lower: string) => boolean;
  copy: LocalizedCopy;
}> = [
  {
    id: 'materialize_telegram_avatar',
    test: (s) => s.includes('materialize telegram avatar failed'),
    copy: {
      fa: 'ذخیره آواتار تلگرام ناموفق بود',
      en: 'Could not save the Telegram avatar',
    },
  },
  {
    id: 'telegram_profile_photo',
    test: (s) => s.includes('telegram') && s.includes('profile') && s.includes('fail'),
    copy: {
      fa: 'همگام‌سازی عکس پروفایل تلگرام ناموفق بود',
      en: 'Telegram profile photo sync failed',
    },
  },
  {
    id: 'telegram_send',
    test: (s) => s.includes('telegram') && (s.includes('send') || s.includes('notify')) && s.includes('fail'),
    copy: {
      fa: 'ارسال پیام تلگرام ناموفق بود',
      en: 'Telegram send failed',
    },
  },
  {
    id: 'owner_profile_photo',
    test: (s) => s.includes('owner profile photo failed'),
    copy: {
      fa: 'ارسال عکس پروفایل صاحب ناموفق بود',
      en: 'Owner profile photo send failed',
    },
  },
  {
    id: 'owner_peer_pet_photo',
    test: (s) => s.includes('owner peer pet photo failed'),
    copy: {
      fa: 'ارسال عکس پت طرف مقابل ناموفق بود',
      en: 'Peer pet photo send failed',
    },
  },
  {
    id: 'welcome_logo',
    test: (s) => s.includes('welcome logo'),
    copy: {
      fa: 'ارسال لوگوی خوش‌آمدگویی ناموفق بود',
      en: 'Welcome logo send failed',
    },
  },
  {
    id: 'session_disk',
    test: (s) => s.includes('session disk'),
    copy: {
      fa: 'خواندن/نوشتن نشست روی دیسک ناموفق بود',
      en: 'Session disk load/save failed',
    },
  },
  {
    id: 'redis_unavailable',
    test: (s) => s.includes('redis') && (s.includes('unavailable') || s.includes('fail')),
    copy: {
      fa: 'اتصال Redis برقرار نشد',
      en: 'Redis is unavailable',
    },
  },
  {
    id: 'quick_connect',
    test: (s) => s.includes('quick-connect') || s.includes('quick-connection') || s.includes('quick connect'),
    copy: {
      fa: 'اتصال سریع مشاوره ناموفق بود',
      en: 'Consult quick-connect failed',
    },
  },
  {
    id: 'nearby',
    test: (s) => s.includes('nearby') && s.includes('fail'),
    copy: {
      fa: 'جستجوی پت‌های نزدیک ناموفق بود',
      en: 'Nearby pets lookup failed',
    },
  },
  {
    id: 'owner_chat',
    test: (s) => s.includes('owner chat') && s.includes('fail'),
    copy: {
      fa: 'چت صاحب‌پت ناموفق بود',
      en: 'Owner chat failed',
    },
  },
  {
    id: 'vet_chat',
    test: (s) => s.includes('vet chat') && s.includes('fail'),
    copy: {
      fa: 'چت دامپزشک ناموفق بود',
      en: 'Vet chat failed',
    },
  },
  {
    id: 'playdate_notify',
    test: (s) => s.includes('playdate notify') || s.includes('playdate') && s.includes('notify') && s.includes('fail'),
    copy: {
      fa: 'اعلان قرار بازی ناموفق بود',
      en: 'Playdate notify failed',
    },
  },
  {
    id: 'payment_notify',
    test: (s) => (s.includes('payment') || s.includes('shop card')) && s.includes('fail'),
    copy: {
      fa: 'اعلان پرداخت ناموفق بود',
      en: 'Payment notify failed',
    },
  },
  {
    id: 'support_reply',
    test: (s) => s.includes('support') && s.includes('fail'),
    copy: {
      fa: 'پاسخ پشتیبانی ناموفق بود',
      en: 'Support reply failed',
    },
  },
  {
    id: 'report_bot_error',
    test: (s) => s.includes('reportboterror') || s.includes('report bot error'),
    copy: {
      fa: 'ثبت خطای ربات در پنل ناموفق بود',
      en: 'Could not report the bot error to admin logs',
    },
  },
  {
    id: 'uncaught',
    test: (s) => s.includes('uncaughtexception'),
    copy: {
      fa: 'خطای مهلک پردازش‌نشده در سرور',
      en: 'Uncaught exception on the server',
    },
  },
  {
    id: 'unhandled_rejection',
    test: (s) => s.includes('unhandledrejection'),
    copy: {
      fa: 'Promise رد‌شدهٔ بدون کنترل',
      en: 'Unhandled promise rejection',
    },
  },
  {
    id: 'unhandled_api',
    test: (s) => s.includes('unhandled api error'),
    copy: {
      fa: 'خطای کنترل‌نشدهٔ API',
      en: 'Unhandled API error',
    },
  },
  {
    id: 'econnrefused',
    test: (s) => s.includes('econnrefused') || (s.includes('connect') && s.includes('refused')),
    copy: ERROR_CODE_COPY.ECONNREFUSED!,
  },
  {
    id: 'timeout',
    test: (s) => s.includes('etimedout') || s.includes('timeout'),
    copy: ERROR_CODE_COPY.ETIMEDOUT!,
  },
];

export type AppLogTranslateInput = {
  message: string;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  level?: string | null;
};

export type TranslatedAppLog = {
  titleFa: string;
  titleEn: string;
  /** Original / technical line when it differs from a title */
  detail: string | null;
  code: string | null;
  translated: boolean;
};

export function stripQuery(path: string): string {
  return path.split('?')[0] || path;
}

/** Parse `HTTP 500 GET /api/games/list` style messages. */
export function parseHttpLogMessage(message: string): {
  status: number;
  method: string;
  path: string;
} | null {
  const m = message.trim().match(/^HTTP\s+(\d{3})\s+([A-Z]+)\s+(\S+)/i);
  if (!m) return null;
  return {
    status: Number(m[1]),
    method: m[2]!.toUpperCase(),
    path: m[3]!,
  };
}

const GENERIC_HTTP_CODE = /\b[A-Z][A-Z0-9_]{2,}\b/g;

export function extractErrorCode(message: string): string | null {
  const tokens = String(message || '').match(GENERIC_HTTP_CODE);
  if (!tokens) return null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!;
    if (ERROR_CODE_COPY[token]) return token;
  }
  return null;
}

function joinTitle(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(' — ');
}

function bigintNaNCopy(message: string): LocalizedCopy | null {
  const lower = message.toLowerCase();
  if (lower.includes('invalid input syntax for type bigint') || (lower.includes('bigint') && lower.includes('nan'))) {
    return {
      fa: 'شناسه عددی نامعتبر (مقدار NaN به‌جای عدد)',
      en: 'Invalid numeric id (NaN instead of a number)',
    };
  }
  return null;
}

function httpPathTitles(
  status: number,
  method: string,
  path: string
): LocalizedCopy {
  const p = stripQuery(path);
  const pl = p.toLowerCase();
  const statusFa = httpStatusCopy(status, 'fa');
  const statusEn = httpStatusCopy(status, 'en');
  const areaFa = pathAreaCopy(p, 'fa');
  const areaEn = pathAreaCopy(p, 'en');

  if (pl.includes('/games') && (pl.endsWith('/list') || pl.includes('/games/list'))) {
    if (status >= 500) {
      return {
        fa: 'خطای سرور در فهرست بازی‌ها — شناسه یا پارامتر نامعتبر (API قدیمی؛ رابط کاربر: هم بازی → /chats)',
        en: 'Games list server error — invalid id/params (legacy API; UI: playmates → /chats)',
      };
    }
    return {
      fa: `${statusFa} در فهرست بازی‌ها`,
      en: `${statusEn} on games list`,
    };
  }

  if (pl.includes('/games/') && status >= 500) {
    return {
      fa: 'خطای سرور در جزئیات بازی — شناسه باید عدد معتبر باشد',
      en: 'Game detail server error — id must be a valid number',
    };
  }

  if (pl.includes('/sections/') && pl.includes('/games') && status >= 500) {
    return {
      fa: 'خطای سرور در بازی‌های سکشن — شناسه سکشن نامعتبر',
      en: 'Section games server error — invalid section id',
    };
  }

  if (pl.includes('/avatar') && status === 401) {
    return {
      fa: 'آواتار: نشست نامعتبر یا کاربر وارد نشده',
      en: 'Avatar: invalid session or not signed in',
    };
  }

  if (pl.includes('/appointment') && status === 400) {
    return {
      fa: 'نوبت‌ها: پارامتر یا بدنهٔ درخواست نامعتبر',
      en: 'Appointments: invalid query or body',
    };
  }

  if (pl.includes('/auth/avatar') && status === 401) {
    return {
      fa: 'دریافت آواتار بدون احراز هویت',
      en: 'Avatar fetch without authentication',
    };
  }

  if (
    (pl.includes('/consultations/quick-connect') ||
      pl.includes('/consulting/quick-connection') ||
      pl.includes('/consult/quick-connect')) &&
    (status === 400 || status === 409)
  ) {
    return {
      fa: `${statusFa} · مشاوره اتصال سریع`,
      en: `${statusEn} · consult quick-connect`,
    };
  }

  if (areaFa) {
    return {
      fa: `${statusFa} · ${areaFa} (${method} ${p})`,
      en: `${statusEn} · ${areaEn} (${method} ${p})`,
    };
  }
  return {
    fa: `${statusFa} · ${method} ${p}`,
    en: `${statusEn} · ${method} ${p}`,
  };
}

function isPersian(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function withDetail(titleFa: string, titleEn: string, original: string, code: string | null): TranslatedAppLog {
  const translated = titleFa !== original || titleEn !== original;
  const detail = original && original !== titleFa && original !== titleEn ? original : null;
  return { titleFa, titleEn, detail, code, translated };
}

/**
 * Map a persisted admin log row to bilingual titles + raw technical detail.
 */
export function translateAppLogMessage(input: AppLogTranslateInput): TranslatedAppLog {
  const message = (input.message || '').trim();
  if (!message) {
    return {
      titleFa: 'بدون پیام',
      titleEn: 'No message',
      detail: null,
      code: null,
      translated: true,
    };
  }

  const fromHttpLine = parseHttpLogMessage(message);
  const status = input.statusCode ?? fromHttpLine?.status ?? null;
  const method = (input.method || fromHttpLine?.method || '').toUpperCase() || null;
  const path = input.path || fromHttpLine?.path || null;
  const code = extractErrorCode(message);
  const codeCopy = code ? ERROR_CODE_COPY[code] : null;
  const lower = message.toLowerCase();

  const nanCopy = bigintNaNCopy(message);
  if (nanCopy) {
    const ctx = path ? ` · ${method ? `${method} ` : ''}${stripQuery(path)}` : '';
    return withDetail(nanCopy.fa + ctx, nanCopy.en + ctx, message, code);
  }

  // HTTP access-log lines get status + area titles; do not let path words
  // (quick-connect, timeout, …) match generic console-warn patterns first.
  if (fromHttpLine || (status != null && path && method)) {
    const s = status ?? fromHttpLine!.status;
    const m = method ?? fromHttpLine!.method;
    const p = path ?? fromHttpLine!.path;
    const titles = httpPathTitles(s, m, p);
    const titleFa = joinTitle([titles.fa, codeCopy?.fa]);
    const titleEn = joinTitle([titles.en, codeCopy?.en]);
    return withDetail(titleFa, titleEn, message, code);
  }

  const pattern = LOG_PATTERN_COPY.find((row) => row.test(lower));
  if (pattern) {
    const titleFa = joinTitle([pattern.copy.fa, codeCopy?.fa]);
    const titleEn = joinTitle([pattern.copy.en, codeCopy?.en]);
    return withDetail(titleFa, titleEn, message, code);
  }

  if (codeCopy) {
    return withDetail(codeCopy.fa, codeCopy.en, message, code);
  }

  if (isPersian(message)) {
    return { titleFa: message, titleEn: message, detail: null, code, translated: false };
  }

  return {
    titleFa: message,
    titleEn: message,
    detail: null,
    code,
    translated: false,
  };
}

export function pickLogTitle(translated: TranslatedAppLog, lang: ErrorLang = 'fa'): string {
  return lang === 'en' ? translated.titleEn : translated.titleFa;
}
