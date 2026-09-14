import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { dbService } from '../db';
import { infra } from '../config/infra';
import { parseReferredByInput, tryGrantReferralOnSignup } from './referral-grant';
import {
  applyLoginProfileHints,
  importRemoteAvatarIfEmpty,
} from './provider-profile-import';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 15 * 60 * 1000;
const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

/** openid/email/profile only — People phone scope is sensitive and blocks unverified apps. */
const SCOPES = ['openid', 'email', 'profile'].join(' ');

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

export function googleRedirectUri(): string {
  const explicit = optionalEnv('GOOGLE_REDIRECT_URI');
  if (explicit) return explicit.replace(/\/$/, '');
  const web = String(infra.web.url || 'https://petdate.ir').replace(/\/$/, '');
  return `${web}/api/auth/google/callback`;
}

function stateSecret(): string {
  return (
    optionalEnv('GOOGLE_OAUTH_STATE_SECRET') ||
    googleClientSecret() ||
    optionalEnv('TELEGRAM_BOT_TOKEN') ||
    'petdate-google-state-dev'
  );
}

function sanitizeLoginNext(raw: string | null | undefined, fallback = '/home'): string {
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
    scope: SCOPES,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state: signGoogleOAuthState(nextRaw),
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

function webOrigin(): string {
  return String(infra.web.url || 'https://petdate.ir').replace(/\/$/, '');
}

export function googleLoginErrorRedirect(reason: string, nextRaw?: string | null): string {
  const next = sanitizeLoginNext(nextRaw);
  const q = new URLSearchParams({ google: reason });
  if (next !== '/home') q.set('next', next);
  return `${webOrigin()}/auth/login?${q.toString()}`;
}

export function googleLoginSuccessRedirect(token: string, nextRaw?: string | null): string {
  const next = sanitizeLoginNext(nextRaw);
  const q = new URLSearchParams({ token });
  if (next !== '/home') q.set('next', next);
  return `${webOrigin()}/auth/google?${q.toString()}`;
}

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  picture?: string;
  phone_number?: string;
};

async function fetchJson<T>(url: string, init: RequestInit): Promise<T | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10000);
    const res = await fetch(url, { ...init, signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('google oauth http', res.status, text.slice(0, 240));
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn('google oauth fetch failed:', (err as Error).message);
    return null;
  }
}

async function exchangeCode(code: string): Promise<{ access_token?: string; id_token?: string } | null> {
  const body = new URLSearchParams({
    code,
    client_id: googleClientId() || '',
    client_secret: googleClientSecret() || '',
    redirect_uri: googleRedirectUri(),
    grant_type: 'authorization_code',
  });
  return fetchJson(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export async function completeGoogleOAuth(opts: {
  code: string;
  state: string;
  referredBy?: unknown;
}): Promise<
  | { ok: true; redirect: string }
  | { ok: false; redirect: string }
> {
  if (!isGoogleOAuthConfigured()) {
    return { ok: false, redirect: googleLoginErrorRedirect('missing') };
  }
  const state = readGoogleOAuthState(opts.state);
  if (!state.ok) {
    return { ok: false, redirect: googleLoginErrorRedirect(state.reason) };
  }
  const tokens = await exchangeCode(String(opts.code ?? '').trim());
  const access = String(tokens?.access_token ?? '').trim();
  if (!access) {
    return { ok: false, redirect: googleLoginErrorRedirect('token', state.next) };
  }

  const info = await fetchJson<GoogleUserInfo>(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const sub = String(info?.sub ?? '').trim();
  const email = String(info?.email ?? '')
    .trim()
    .toLowerCase();
  if (!sub || !email) {
    return { ok: false, redirect: googleLoginErrorRedirect('profile', state.next) };
  }

  const existed = dbService.getUserByGoogleSub(sub) ?? dbService.getUserByEmail(email);
  let user = existed ?? dbService.findOrCreateWebUser({ email, name: String(info?.name ?? '').trim() });
  user = dbService.setUserGoogleSub(user.id, sub) ?? user;
  user =
    applyLoginProfileHints({
      userId: user.id,
      email,
      name: info?.name || info?.given_name,
      phone: info?.phone_number,
      phoneVerified: false,
    }) ?? user;
  user = (await importRemoteAvatarIfEmpty({ userId: user.id, pictureUrl: info?.picture })) ?? user;

  if (!existed) {
    tryGrantReferralOnSignup({
      invitedUserId: user.id,
      referredBy: parseReferredByInput(opts.referredBy),
      created: true,
    });
    user = dbService.getUserById(user.id) ?? user;
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  dbService.createWebSession(user.id, token, expiresAt);
  return { ok: true, redirect: googleLoginSuccessRedirect(token, state.next) };
}
