import { useEffect, useState } from 'react';
import type { PublicPlatformConfig } from '@petdate/shared';
import { RUNTIME_FLAG_DEFAULTS } from '@petdate/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const FALLBACK_PLATFORM_CONFIG: PublicPlatformConfig = {
  ...RUNTIME_FLAG_DEFAULTS,
  announcements: [],
};

let cached: { at: number; config: PublicPlatformConfig } | null = null;
const CACHE_MS = 20_000;
const listeners = new Set<(cfg: PublicPlatformConfig) => void>();

export async function fetchPublicPlatformConfig(force = false): Promise<PublicPlatformConfig> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  try {
    const res = await fetch(`${API_BASE}/api/platform/config`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Partial<PublicPlatformConfig> & { ok?: boolean };
    const config: PublicPlatformConfig = {
      shopEnabled: data.shopEnabled !== false,
      playdatesEnabled: data.playdatesEnabled !== false,
      vetConsultEnabled: data.vetConsultEnabled !== false,
      botForceJoin: data.botForceJoin !== false,
      paymentCardEnabled: data.paymentCardEnabled !== false,
      paymentStarsEnabled: data.paymentStarsEnabled !== false,
      maintenanceMode: data.maintenanceMode === true,
      announcements: Array.isArray(data.announcements) ? data.announcements : [],
    };
    cached = { at: Date.now(), config };
    listeners.forEach((fn) => fn(config));
    return config;
  } catch {
    const fallback = cached?.config ?? FALLBACK_PLATFORM_CONFIG;
    return fallback;
  }
}

export function usePlatformConfig(): PublicPlatformConfig {
  const [config, setConfig] = useState<PublicPlatformConfig>(
    cached?.config ?? FALLBACK_PLATFORM_CONFIG
  );

  useEffect(() => {
    listeners.add(setConfig);
    void fetchPublicPlatformConfig().then(setConfig);
    return () => {
      listeners.delete(setConfig);
    };
  }, []);

  return config;
}
