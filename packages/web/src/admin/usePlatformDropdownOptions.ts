/**
 * Load active platform dropdown options (with shared-constant fallback).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from './api';

export type PlatformOptionLite = { value: string; label: string };

export function usePlatformDropdownOptions(
  moduleKey: string,
  fieldKey: string,
  fallback: readonly string[] | Array<{ value: string; label: string }>
): { options: PlatformOptionLite[]; loading: boolean; reload: () => void } {
  const fallbackKey = useMemo(
    () =>
      JSON.stringify(
        fallback.map((f) => (typeof f === 'string' ? f : `${f.value}:${f.label}`))
      ),
    [fallback]
  );

  const fallbackOpts = useMemo<PlatformOptionLite[]>(
    () => fallback.map((f) => (typeof f === 'string' ? { value: f, label: f } : f)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by fallbackKey
    [fallbackKey]
  );

  const [options, setOptions] = useState<PlatformOptionLite[]>(fallbackOpts);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    void adminFetch<{ options: Array<{ value: string; label: string; active: boolean }> }>(
      `/api/admin/platform-settings/modules/${encodeURIComponent(moduleKey)}/fields/${encodeURIComponent(fieldKey)}/options?includeInactive=0`
    )
      .then((d) => {
        const active = (d.options || [])
          .filter((o) => o.active !== false)
          .map((o) => ({ value: o.value, label: o.label }));
        if (active.length) setOptions(active);
        else setOptions(fallbackOpts);
      })
      .catch(() => setOptions(fallbackOpts))
      .finally(() => setLoading(false));
  }, [moduleKey, fieldKey, fallbackOpts]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { options, loading, reload };
}
