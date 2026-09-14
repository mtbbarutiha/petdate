import { normalizeIranMobile } from '@petdate/shared';

const EMAIL_LOCAL_MAX = 40;

/** Display name from email local-part when the account still has a placeholder name. */
export function nameFromEmailLocalPart(email: string | undefined | null): string | null {
  const raw = String(email ?? '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at <= 0) return null;
  let local = raw.slice(0, at).replace(/\+.*$/, '');
  local = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!local || local.length > EMAIL_LOCAL_MAX) return null;
  if (/^\d+$/.test(local)) return null;
  const titled = local
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return titled || null;
}

export function pickIranPhoneFromProvider(raw: string | undefined | null): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return normalizeIranMobile(text);
}
