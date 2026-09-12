import { parseReferralRef } from '@petdate/shared';

const STORAGE_KEY = 'petdate_invite_ref_v1';

function storage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function persistReferralRef(raw: unknown): number | null {
  const id = parseReferralRef(raw);
  if (id == null) return null;
  try {
    storage()?.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore quota / private mode */
  }
  return id;
}

export function readStoredReferralRef(): number | null {
  try {
    return parseReferralRef(storage()?.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearStoredReferralRef(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Capture `?ref=` / `ref_<id>` from the current location (any public page). */
export function captureReferralFromLocation(
  search = typeof window !== 'undefined' ? window.location.search : '',
  pathname = typeof window !== 'undefined' ? window.location.pathname : ''
): number | null {
  const params = new URLSearchParams(search);
  return persistReferralRef(params.get('ref') || params.get('start') || pathname);
}
