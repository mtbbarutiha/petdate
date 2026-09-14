import { randomBytes } from 'crypto';
import { dbService } from '../db';
import { parseReferredByInput, tryGrantReferralOnSignup } from './referral-grant';
import {
  applyLoginProfileHints,
  importRemoteAvatarIfEmpty,
} from './provider-profile-import';
import {
  buildGoogleAuthorizeUrl,
  googleClientId,
  googleClientSecret,
  googleLoginErrorRedirect,
  googleLoginSuccessRedirect,
  googleRedirectUri,
  isGoogleOAuthConfigured,
  publicWebOrigin,
  readGoogleOAuthState,
  signGoogleOAuthState,
} from './google-oauth-core';

export {
  buildGoogleAuthorizeUrl,
  googleClientId,
  googleClientSecret,
  googleLoginErrorRedirect,
  googleLoginSuccessRedirect,
  googleRedirectUri,
  isGoogleOAuthConfigured,
  publicWebOrigin,
  readGoogleOAuthState,
  signGoogleOAuthState,
};

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

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
  const emailVerified = info?.email_verified === true || info?.email_verified === 'true';
  if (!sub || !email || !emailVerified) {
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
