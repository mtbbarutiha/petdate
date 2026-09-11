/**
 * Google Tag Assistant / GTM Preview query params.
 * Must stay on the top-level URL — SPA redirects that drop them break debugger pairing
 * and can confuse auth `next` handling if folded into other query values.
 */
export const TAG_ASSISTANT_PARAM_KEYS = ['gtm_debug', '_dbg'] as const;

export type TagAssistantParamKey = (typeof TAG_ASSISTANT_PARAM_KEYS)[number];

const STORAGE_KEY = 'pd_gtm_tag_assistant_params';

export function isTagAssistantParamKey(key: string): key is TagAssistantParamKey {
  return (TAG_ASSISTANT_PARAM_KEYS as readonly string[]).includes(key);
}

/** Pick only Tag Assistant params from a query string (`?a=1` or `a=1`). */
export function pickTagAssistantParams(search: string): URLSearchParams {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const src = new URLSearchParams(raw);
  const out = new URLSearchParams();
  for (const key of TAG_ASSISTANT_PARAM_KEYS) {
    if (!src.has(key)) continue;
    const value = src.get(key);
    // Empty value is still meaningful for some Tag Assistant flows (`?gtm_debug=`).
    out.set(key, value ?? '');
  }
  return out;
}

export function hasTagAssistantParams(search: string): boolean {
  return [...pickTagAssistantParams(search).keys()].length > 0;
}

/** Persist seen params for the tab so SPA navigations can restore them. */
export function rememberTagAssistantParams(search: string): void {
  const picked = pickTagAssistantParams(search);
  if ([...picked.keys()].length === 0) return;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, picked.toString());
    }
  } catch {
    /* private mode / quota */
  }
}

export function loadRememberedTagAssistantParams(): URLSearchParams {
  try {
    if (typeof sessionStorage === 'undefined') return new URLSearchParams();
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new URLSearchParams();
    return pickTagAssistantParams(raw);
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Params that should be on the URL but are missing (from current search + memory).
 * Returns entries to set; empty array if nothing to restore.
 */
export function missingTagAssistantEntries(search: string): Array<[string, string]> {
  rememberTagAssistantParams(search);
  const current = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const remembered = loadRememberedTagAssistantParams();
  const missing: Array<[string, string]> = [];
  for (const key of TAG_ASSISTANT_PARAM_KEYS) {
    if (current.has(key)) continue;
    if (!remembered.has(key)) continue;
    missing.push([key, remembered.get(key) ?? '']);
  }
  return missing;
}

/** Strip Tag Assistant params from a relative path (`/home?gtm_debug=1&x=2` → `/home?x=2`). */
export function stripTagAssistantParams(pathWithSearch: string): string {
  const q = pathWithSearch.indexOf('?');
  if (q < 0) {
    const hash = pathWithSearch.indexOf('#');
    return hash >= 0 ? pathWithSearch.slice(0, hash) : pathWithSearch;
  }
  const path = pathWithSearch.slice(0, q);
  let rest = pathWithSearch.slice(q + 1);
  let hash = '';
  const hashIdx = rest.indexOf('#');
  if (hashIdx >= 0) {
    hash = rest.slice(hashIdx);
    rest = rest.slice(0, hashIdx);
  }
  const params = new URLSearchParams(rest);
  for (const key of TAG_ASSISTANT_PARAM_KEYS) params.delete(key);
  const qs = params.toString();
  return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
}

/**
 * Merge Tag Assistant params onto a react-router `to` path (relative).
 * Uses `fromSearch` when provided, else remembered session values.
 */
export function withTagAssistantParams(to: string, fromSearch?: string): string {
  if (!to.startsWith('/')) return to;
  const hashIdx = to.indexOf('#');
  const hash = hashIdx >= 0 ? to.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? to.slice(0, hashIdx) : to;
  const qIdx = withoutHash.indexOf('?');
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const existing = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : '');

  const source =
    fromSearch != null
      ? pickTagAssistantParams(fromSearch)
      : typeof window !== 'undefined'
        ? (() => {
            rememberTagAssistantParams(window.location.search);
            const live = pickTagAssistantParams(window.location.search);
            if ([...live.keys()].length > 0) return live;
            return loadRememberedTagAssistantParams();
          })()
        : loadRememberedTagAssistantParams();

  for (const [key, value] of source.entries()) {
    if (!existing.has(key)) existing.set(key, value);
  }

  const qs = existing.toString();
  return qs ? `${path}?${qs}${hash}` : `${path}${hash}`;
}
