/**
 * Live platform flags + public announcements.
 * Source of truth: admin_settings / admin_announcements (written by admin Settings + Content).
 */
import type { Request, Response, NextFunction } from 'express';
import {
  RUNTIME_FLAG_DEFAULTS,
  RUNTIME_FLAG_KEYS,
  isTruthySetting,
  type PublicAnnouncement,
  type PublicPlatformConfig,
  type RuntimeFlagKey,
} from '@petdate/shared';
import { adminPlatform } from './admin-platform';

export const RUNTIME_DISABLED_FA: Record<RuntimeFlagKey, string> = {
  shopEnabled: 'فروشگاه فعلاً غیرفعال است.',
  playdatesEnabled: 'درخواست همبازی فعلاً غیرفعال است.',
  vetConsultEnabled: 'مشاوره دامپزشک فعلاً غیرفعال است.',
  botForceJoin: 'عضویت اجباری کانال خاموش است.',
  paymentCardEnabled: 'پرداخت کارت‌به‌کارت فعلاً غیرفعال است.',
  paymentStarsEnabled: 'پرداخت Stars فعلاً غیرفعال است.',
  maintenanceMode: 'سایت در حال تعمیرات است.',
};

export function getRuntimeFlags(): Record<RuntimeFlagKey, boolean> {
  const stored = adminPlatform.getSettings();
  const out = {} as Record<RuntimeFlagKey, boolean>;
  for (const key of RUNTIME_FLAG_KEYS) {
    out[key] = isTruthySetting(stored[key], RUNTIME_FLAG_DEFAULTS[key]);
  }
  return out;
}

export function isRuntimeFlagOn(flag: RuntimeFlagKey): boolean {
  return getRuntimeFlags()[flag];
}

export function listPublicAnnouncements(): PublicAnnouncement[] {
  return adminPlatform
    .listAnnouncements()
    .filter((a) => a.active)
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      placement: a.placement || 'landing',
    }));
}

export function getPublicPlatformConfig(): PublicPlatformConfig {
  return {
    ...getRuntimeFlags(),
    announcements: listPublicAnnouncements(),
  };
}

export function featureDisabledPayload(flag: RuntimeFlagKey) {
  return {
    error: RUNTIME_DISABLED_FA[flag],
    reason: 'feature_disabled' as const,
    flag,
  };
}

/** Returns true when the response was already sent (flag off). */
export function rejectIfFlagOff(res: Response, flag: RuntimeFlagKey): boolean {
  if (isRuntimeFlagOn(flag)) return false;
  res.status(403).json(featureDisabledPayload(flag));
  return true;
}

export function requireRuntimeFlag(flag: RuntimeFlagKey) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (rejectIfFlagOff(res, flag)) return;
    next();
  };
}
