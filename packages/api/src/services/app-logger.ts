import type { NextFunction, Request, Response } from 'express';
import { dbService } from '../db';

export type AppLogLevel = 'error' | 'warn' | 'info';

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 20_000;
let persisting = false;
let consoleBridged = false;
let processLoggingInstalled = false;

function shouldDedupe(key: string): boolean {
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) return true;
  recentKeys.set(key, now);
  if (recentKeys.size > 500) {
    for (const [k, t] of recentKeys) {
      if (now - t > DEDUPE_MS) recentKeys.delete(k);
    }
  }
  return false;
}

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 4000);
}

/**
 * Telegram 400s for deleted / blocked / never-started chats are expected ops noise
 * (stale telegram_id on users). Keep console.warn for debugging; do not flood admin logs.
 */
export function isBenignTelegramWarn(message: string): boolean {
  const lower = message.toLowerCase();
  if (!lower.includes('telegram')) return false;
  return (
    lower.includes('chat not found') ||
    lower.includes('bot was blocked') ||
    lower.includes('bot was blocked by the user') ||
    lower.includes('user is deactivated') ||
    lower.includes('forbidden: bot was blocked') ||
    lower.includes('peer_id_invalid') ||
    lower.includes('chat_id is empty')
  );
}

/** Known wrong / legacy admin auth paths some clients still hit. */
const ADMIN_PROBE_404 = new Set([
  '/api/admin/login',
  '/api/admin/session',
  '/api/auth/admin/login',
]);

/**
 * HTTP responses that are expected product outcomes or internet noise —
 * not actionable ops errors for «لاگ خطاها».
 */
export function isExpectedHttpNoise(
  method: string,
  pathOrUrl: string,
  statusCode: number
): boolean {
  const path = (pathOrUrl || '').split('?')[0] || '';
  const m = (method || 'GET').toUpperCase();

  // Scanners / health probes under /api/* that are not our routes.
  if (statusCode === 404) {
    if (!path.startsWith('/api/')) return true;
    if (ADMIN_PROBE_404.has(path)) return true;
    // Keep admin 404s (broken UI links) except known probes above.
    if (path.startsWith('/api/admin')) return false;
    // Public API 404s are almost always scanners or stale clients.
    return true;
  }

  // No online providers / AI fallback declined — expected 409 for users.
  if (
    statusCode === 409 &&
    m === 'POST' &&
    (path === '/api/consultations/quick-connect' ||
      path.startsWith('/api/consultations/quick-connect'))
  ) {
    return true;
  }

  return false;
}

export function logAppEvent(opts: {
  level?: AppLogLevel;
  source?: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  meta?: Record<string, unknown> | null;
}): void {
  const message = (opts.message || '').trim();
  if (!message) return;
  const level = opts.level ?? 'error';
  const source = opts.source ?? 'api';
  const dedupeKey = `${level}|${source}|${message.slice(0, 240)}|${opts.path ?? ''}`;
  if (shouldDedupe(dedupeKey)) return;

  if (persisting) return;
  persisting = true;
  try {
    dbService.createAppErrorLog({
      level,
      source,
      message,
      stack: opts.stack,
      path: opts.path,
      method: opts.method,
      statusCode: opts.statusCode,
      meta: opts.meta,
    });
  } catch (err) {
    // Use native console to avoid re-entrancy through the bridge.
    nativeConsoleError('failed to persist app log:', (err as Error).message);
  } finally {
    persisting = false;
  }
}

const nativeConsoleError = console.error.bind(console);
const nativeConsoleWarn = console.warn.bind(console);

/** Mirror console.error / meaningful console.warn into admin log store. */
export function installConsoleErrorBridge(source = 'api'): void {
  if (consoleBridged) return;
  consoleBridged = true;

  console.error = (...args: unknown[]) => {
    nativeConsoleError(...args);
    const message = formatConsoleArgs(args);
    if (!message || message.startsWith('failed to persist app log:')) return;
    const err = args.find((a): a is Error => a instanceof Error);
    logAppEvent({
      level: 'error',
      source,
      message: message.split('\n')[0]!.slice(0, 500),
      stack: err?.stack ?? (message.includes('\n') ? message : null),
      meta: { via: 'console.error' },
    });
  };

  console.warn = (...args: unknown[]) => {
    nativeConsoleWarn(...args);
    const message = formatConsoleArgs(args);
    if (!message) return;
    if (isBenignTelegramWarn(message)) return;
    // Only persist operational failures — skip routine noise.
    const lower = message.toLowerCase();
    if (
      !(
        lower.includes('fail') ||
        lower.includes('error') ||
        lower.includes('timeout') ||
        lower.includes('econnrefused') ||
        lower.includes('unable') ||
        lower.includes('cannot')
      )
    ) {
      return;
    }
    logAppEvent({
      level: 'warn',
      source,
      message: message.split('\n')[0]!.slice(0, 500),
      meta: { via: 'console.warn' },
    });
  };
}

/** Session probes that routinely 401 when the browser has no (or stale) web token. */
function isExpectedUnauthNoise(req: Request, statusCode: number): boolean {
  if (statusCode !== 401) return false;
  const path = req.path || '';
  const url = req.originalUrl || path;
  if (path.startsWith('/api/admin') || url.startsWith('/api/admin')) return true;
  // Logged-out landing / dock / wallet chip / role switch — not actionable ops errors.
  const expected = [
    '/api/auth/me',
    '/api/auth/wallet',
    '/api/auth/roles',
    '/api/auth/vet-online',
    '/api/auth/visit-fee',
    '/api/shop/my-orders',
    '/api/shop/checkout/card-status',
  ];
  return expected.some((p) => path === p || path.startsWith(`${p}/`) || url.startsWith(p));
}

/** Express middleware: log 4xx/5xx responses (except common auth noise). */
export function responseErrorLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    // SPA / static 404s and unauthenticated admin probes are noise.
    if (res.statusCode === 404 && !req.path.startsWith('/api/')) return;
    if (isExpectedUnauthNoise(req, res.statusCode)) return;
    if (isExpectedHttpNoise(req.method, req.originalUrl || req.path, res.statusCode)) return;
    logAppEvent({
      level: res.statusCode >= 500 ? 'error' : 'warn',
      source: 'api',
      message: `HTTP ${res.statusCode} ${req.method} ${req.originalUrl}`,
      path: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      meta: { durationMs: Date.now() - started },
    });
  });
  next();
}

/** Final Express error handler — persists + returns JSON. */
export function expressErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  nativeConsoleError('unhandled api error:', message);
  logAppEvent({
    level: 'error',
    source: 'api',
    message,
    stack,
    path: req.originalUrl,
    method: req.method,
    statusCode: 500,
  });
  if (res.headersSent) return;
  res.status(500).json({ error: 'خطای داخلی سرور' });
}

export function installProcessErrorLogging(source = 'api'): void {
  if (processLoggingInstalled) return;
  processLoggingInstalled = true;
  process.on('uncaughtException', (err) => {
    nativeConsoleError('uncaughtException:', err);
    logAppEvent({
      level: 'error',
      source,
      message: `uncaughtException: ${err.message}`,
      stack: err.stack,
      meta: { type: 'uncaughtException' },
    });
  });
  process.on('unhandledRejection', (reason) => {
    const message =
      reason instanceof Error ? reason.message : `unhandledRejection: ${String(reason)}`;
    const stack = reason instanceof Error ? reason.stack : undefined;
    nativeConsoleError('unhandledRejection:', reason);
    logAppEvent({
      level: 'error',
      source,
      message,
      stack,
      meta: { type: 'unhandledRejection' },
    });
  });
}
