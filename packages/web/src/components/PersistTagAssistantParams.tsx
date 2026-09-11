import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { missingTagAssistantEntries, rememberTagAssistantParams } from '../lib/tagAssistantParams';

/**
 * Keep `gtm_debug` / `_dbg` on the URL across SPA navigations and auth redirects.
 * Tag Assistant pairs via these top-level query params — dropping them disconnects debug.
 */
export function PersistTagAssistantParams() {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    rememberTagAssistantParams(location.search);
    const missing = missingTagAssistantEntries(location.search);
    if (missing.length === 0) return;

    const next = new URLSearchParams(location.search);
    let changed = false;
    for (const [key, value] of missing) {
      if (!next.has(key)) {
        next.set(key, value);
        changed = true;
      }
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [location.pathname, location.search, setSearchParams]);

  return null;
}
