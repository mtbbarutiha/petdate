/**
 * Human-readable Persian copy for admin «لاگ خطاها» rows.
 * Keeps the original technical message available as secondary detail.
 */

export type AdminLogMessageInput = {
  message: string;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  level?: string | null;
};

export type AdminLogMessageFa = {
  /** Primary Persian summary shown in the table */
  title: string;
  /** Original / technical line (expandable secondary) */
  detail: string | null;
};

const STATUS_FA: Record<number, string> = {
  400: 'درخواست نامعتبر',
  401: 'نیاز به ورود / احراز هویت',
  403: 'دسترسی غیرمجاز',
  404: 'یافت نشد',
  408: 'اتمام مهلت درخواست',
  409: 'تداخل وضعیت',
  413: 'حجم درخواست زیاد',
  422: 'داده قابل پردازش نیست',
  429: 'تعداد درخواست بیش از حد',
  500: 'خطای داخلی سرور',
  502: 'خطای دروازه (upstream)',
  503: 'سرویس در دسترس نیست',
  504: 'اتمام مهلت دروازه',
};

function statusLabel(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return 'خطای HTTP';
  return STATUS_FA[code] ?? `خطای HTTP ${code}`;
}

function stripQuery(path: string): string {
  return path.split('?')[0] || path;
}

function pathHint(path: string): string {
  const p = stripQuery(path).toLowerCase();
  if (p.includes('/games')) return 'بازی‌ها';
  if (p.includes('/avatar')) return 'آواتار';
  if (p.includes('/appointment')) return 'نوبت‌ها';
  if (p.includes('/consult')) return 'مشاوره';
  if (p.includes('/auth')) return 'احراز هویت';
  if (p.includes('/shop')) return 'فروشگاه';
  if (p.includes('/admin')) return 'پنل ادمین';
  if (p.includes('/pet')) return 'حیوانات';
  if (p.includes('/playdate')) return 'قرار بازی';
  if (p.includes('/wallet') || p.includes('/coin')) return 'کیف پول';
  return '';
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

function bigintNaNFa(message: string): string | null {
  const lower = message.toLowerCase();
  if (
    lower.includes('invalid input syntax for type bigint') ||
    (lower.includes('bigint') && lower.includes('nan'))
  ) {
    return 'شناسه عددی نامعتبر (مقدار NaN به‌جای عدد)';
  }
  return null;
}

function httpPathFa(status: number, method: string, path: string): string {
  const p = stripQuery(path);
  const pl = p.toLowerCase();
  const area = pathHint(p);
  const statusFa = statusLabel(status);

  if (pl.includes('/games') && (pl.endsWith('/list') || pl.includes('/games/list'))) {
    if (status >= 500) {
      return 'خطای سرور در فهرست بازی‌ها — شناسه یا پارامتر نامعتبر (API قدیمی؛ رابط کاربر: هم بازی → /chats)';
    }
    return `${statusFa} در فهرست بازی‌ها`;
  }

  if (pl.includes('/games/') && status >= 500) {
    return 'خطای سرور در جزئیات بازی — شناسه باید عدد معتبر باشد';
  }

  if (pl.includes('/sections/') && pl.includes('/games') && status >= 500) {
    return 'خطای سرور در بازی‌های سکشن — شناسه سکشن نامعتبر';
  }

  if (pl.includes('/avatar') && status === 401) {
    return 'آواتار: نشست نامعتبر یا کاربر وارد نشده';
  }

  if (pl.includes('/appointment') && status === 400) {
    return 'نوبت‌ها: پارامتر یا بدنهٔ درخواست نامعتبر';
  }

  if (pl.includes('/auth/avatar') && status === 401) {
    return 'دریافت آواتار بدون احراز هویت';
  }

  if (area) {
    return `${statusFa} · ${area} (${method} ${p})`;
  }
  return `${statusFa} · ${method} ${p}`;
}

/**
 * Map a log row to Persian primary copy + optional technical detail.
 */
export function formatAdminLogMessageFa(input: AdminLogMessageInput): AdminLogMessageFa {
  const message = (input.message || '').trim();
  if (!message) {
    return { title: 'بدون پیام', detail: null };
  }

  const fromHttpLine = parseHttpLogMessage(message);
  const status = input.statusCode ?? fromHttpLine?.status ?? null;
  const method = (input.method || fromHttpLine?.method || '').toUpperCase() || null;
  const path = input.path || fromHttpLine?.path || null;

  const nanFa = bigintNaNFa(message);
  if (nanFa) {
    const ctx =
      path && method
        ? ` · ${method} ${stripQuery(path)}`
        : path
          ? ` · ${stripQuery(path)}`
          : '';
    return {
      title: nanFa + ctx,
      detail: message,
    };
  }

  if (fromHttpLine || (status != null && path && method)) {
    const s = status ?? fromHttpLine!.status;
    const m = method ?? fromHttpLine!.method;
    const p = path ?? fromHttpLine!.path;
    const title = httpPathFa(s, m, p);
    return {
      title,
      detail: message === title ? null : message,
    };
  }

  // Already Persian (contains Arabic/Persian letters) — keep as-is.
  if (/[\u0600-\u06FF]/.test(message)) {
    return { title: message, detail: null };
  }

  // Generic English fallbacks
  const lower = message.toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('connect')) {
    return { title: 'اتصال به سرویس برقرار نشد', detail: message };
  }
  if (lower.includes('timeout') || lower.includes('etimedout')) {
    return { title: 'اتمام مهلت اتصال / پاسخ', detail: message };
  }
  if (lower.includes('uncaughtexception')) {
    return { title: 'خطای مهلک پردازش‌نشده در سرور', detail: message };
  }
  if (lower.includes('unhandledrejection')) {
    return { title: 'Promise رد‌شدهٔ بدون کنترل', detail: message };
  }

  return { title: message, detail: null };
}
