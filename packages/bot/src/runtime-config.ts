import type { PublicPlatformConfig } from '@petdate/shared';
import { RUNTIME_FLAG_DEFAULTS } from '@petdate/shared';
import { config } from './config';

const FALLBACK: PublicPlatformConfig = {
  ...RUNTIME_FLAG_DEFAULTS,
  announcements: [],
};

let cached: { at: number; config: PublicPlatformConfig } | null = null;
const CACHE_MS = 20_000;

export async function fetchPublicPlatformConfig(force = false): Promise<PublicPlatformConfig> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.config;
  try {
    const res = await fetch(`${config.apiUrl}/api/platform/config`);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as Partial<PublicPlatformConfig>;
    const next: PublicPlatformConfig = {
      shopEnabled: data.shopEnabled !== false,
      playdatesEnabled: data.playdatesEnabled !== false,
      vetConsultEnabled: data.vetConsultEnabled !== false,
      botForceJoin: data.botForceJoin !== false,
      paymentCardEnabled: data.paymentCardEnabled !== false,
      paymentStarsEnabled: data.paymentStarsEnabled !== false,
      maintenanceMode: data.maintenanceMode === true,
      announcements: Array.isArray(data.announcements) ? data.announcements : [],
    };
    cached = { at: Date.now(), config: next };
    return next;
  } catch {
    return cached?.config ?? FALLBACK;
  }
}

export async function isBotFeatureOn(
  flag: keyof Omit<PublicPlatformConfig, 'announcements'>
): Promise<boolean> {
  const cfg = await fetchPublicPlatformConfig();
  return Boolean(cfg[flag]);
}

export const FEATURE_OFF_FA: Record<string, string> = {
  shopEnabled: '🛒 فروشگاه فعلاً از طرف مدیریت غیرفعال است.',
  playdatesEnabled: '🔍 پیدا کردن همبازی فعلاً غیرفعال است.',
  vetConsultEnabled: '🩺 مشاوره دامپزشک فعلاً غیرفعال است.',
  paymentCardEnabled: '💳 پرداخت کارت‌به‌کارت فعلاً غیرفعال است.',
  paymentStarsEnabled: '⭐ پرداخت Stars فعلاً غیرفعال است.',
};

export async function replyIfFeatureOff(
  ctx: {
    callbackQuery?: unknown;
    answerCallbackQuery: (o: { text: string; show_alert?: boolean }) => Promise<unknown>;
    reply: (t: string) => Promise<unknown>;
  },
  flag: 'shopEnabled' | 'playdatesEnabled' | 'vetConsultEnabled' | 'paymentCardEnabled' | 'paymentStarsEnabled'
): Promise<boolean> {
  if (await isBotFeatureOn(flag)) return false;
  const msg = FEATURE_OFF_FA[flag] || 'این بخش فعلاً غیرفعال است.';
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: msg.slice(0, 180), show_alert: true }).catch(() => undefined);
  }
  await ctx.reply(msg).catch(() => undefined);
  return true;
}
