import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STATE_TTL_MS = 15 * 60 * 1000;
const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';

/** openid/email/profile only — People phone scope is sensitive and blocks unverified apps. */
export const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'].join(' ');

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function googleClientId(): string | undefined {
  return optionalEnv('GOOGLE_CLIENT_ID');
}

export function googleClientSecret(): string | undefined {
  return optionalEnv('GOOGLE_CLIENT_SECRET');
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

/** Public site origin for OAuth redirects (not the API bind address). */
export function publicWebOrigin(): string {
  const fromEnv = optionalEnv('PUBLIC_WEB_URL') || optionalEnv('WEB_URL') || '';
  const web = fromEnv.replace(/\/$/, '');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(web);
  if (isLocal) {
    if (process.env.NODE_ENV === 'production') return 'https://petdate.ir';
    return web || 'http://localhost:5173';
  }
  return web || 'https://petdate.ir';
}

export function googleRedirectUri(): string {
  const explicit = optionalEnv('GOOGLE_REDIRECT_URI');
  if (explicit) return explicit.replace(/\/$/, '');
  return `${publicWebOrigin()}/api/auth/google/callback`;
}

function stateSecret(): string {
  return (
    optionalEnv('GOOGLE_OAUTH_STATE_SECRET') ||
    googleClientSecret() ||
    optionalEnv('TELEGRAM_BOT_TOKEN') ||
    'petdate-google-state-dev'
  );
}

export function sanitizeLoginNext(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/auth') || value.startsWith('/welcome')) return fallback;
  if (value === '/') return '/home';
  if (!SAFE_NEXT.test(value)) return fallback;
  return value;
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64url');
}

export function signGoogleOAuthState(nextRaw?: string | null): string {
  const payload = {
    n: sanitizeLoginNext(nextRaw),
    e: Date.now() + STATE_TTL_MS,
    r: randomBytes(8).toString('hex'),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readGoogleOAuthState(
  raw: string | null | undefined
): { ok: true; next: string } | { ok: false; reason: string } {
  const value = String(raw ?? '').trim();
  const dot = value.lastIndexOf('.');
  if (dot < 8) return { ok: false, reason: 'bad_state' };
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_state' };
  } catch {
    return { ok: false, reason: 'bad_state' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      n?: string;
      e?: number;
    };
    if (!parsed.e || Number(parsed.e) < Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true, next: sanitizeLoginNext(parsed.n) };
  } catch {
    return { ok: false, reason: 'bad_state' };
  }
}

export function buildGoogleAuthorizeUrl(nextRaw?: string | null): string | null {
  const clientId = googleClientId();
  if (!clientId || !googleClientSecret()) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state: signGoogleOAuthState(nextRaw),
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function googleLoginErrorRedirect(reason: string, nextRaw?: string | null): string {
  const next = sanitizeLoginNext(nextRaw);
  const q = new URLSearchParams({ google: reason });
  if (next !== '/home') q.set('next', next);
  return `${publicWebOrigin()}/auth/login?${q.toString()}`;
}

export function googleLoginSuccessRedirect(token: string, nextRaw?: string | null): string {
  const next = sanitizeLoginNext(nextRaw);
  const q = new URLSearchParams({ token });
  if (next !== '/home') q.set('next', next);
  return `${publicWebOrigin()}/auth/google?${q.toString()}`;
}
