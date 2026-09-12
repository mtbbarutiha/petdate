import { parseDbDateMs } from './petdate';

/**
 * Sibling requests created in the same find / quick-connect wave.
 * Matches playmate + consult request TTL so one broadcast is one cohort.
 */
export const FANOUT_SIBLING_WINDOW_MS = 120_000;

/**
 * Per-recipient reject must not ping the requester when the request was
 * fanned out to many people (هم‌بازی find, مشاوره quick-connect, …).
 * Single-recipient (count <= 1) keeps the previous reject notify.
 */
export function shouldNotifyRequesterOnReject(recipientCount: number): boolean {
  return !(Number.isFinite(recipientCount) && recipientCount > 1);
}

/** Count rows whose created_at falls in the same fan-out window as `createdAt`. */
export function countFanoutSiblingsByCreatedAt(
  createdAt: string | undefined | null,
  siblingCreatedAts: Array<string | undefined | null>,
  windowMs = FANOUT_SIBLING_WINDOW_MS
): number {
  const t0 = parseDbDateMs(createdAt);
  const times = siblingCreatedAts
    .map((value) => parseDbDateMs(value))
    .filter((t) => Number.isFinite(t));
  if (!Number.isFinite(t0)) return Math.max(1, times.length);
  return times.filter((t) => Math.abs(t - t0) <= windowMs).length;
}

export function playdateRejectedNotifyText(): string {
  return '❌ درخواست همبازی رد شد.';
}

export function consultRejectedNotifyText(
  serviceKind?: string | null
): string {
  if (serviceKind === 'seeker_advice') {
    return [
      'صاحب پت این درخواست راهنمایی را نپذیرفت.',
      'می‌تونی دوباره از «مشورت با صاحبین» درخواست بدی.',
    ].join('\n');
  }
  if (serviceKind === 'trainer') {
    return [
      'مربی این درخواست را نپذیرفت.',
      'می‌تونی دوباره از منوی مربی درخواست بدی.',
    ].join('\n');
  }
  return [
    'دامپزشک این درخواست را نپذیرفت.',
    'می‌تونی دوباره از «ارتباط سریع با پزشک» درخواست بدی.',
  ].join('\n');
}
