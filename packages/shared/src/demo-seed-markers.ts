/**
 * Known HR / CRM / Sales demo-seed markers.
 * Used to flag or hide seed rows in admin — never match production-looking data
 * by name alone. Keep this list in sync with hr-sales-demo-seed / crm-demo-seed.
 */

/** Personnel codes written by the HR↔Sales demo graph. */
export const DEMO_SEED_PERSONNEL_RE = /^SEED-HR-\d+$/i;

/** CRM demo mobiles (09120006001…088) + ATS demo mobiles (09120001001…004). */
export const DEMO_SEED_MOBILE_RE =
  /^(?:09120006\d{3}|0912000100[1-4]|0912SEED\d+)$/i;

/** Seed emails / org mail written by demo graphs. */
export const DEMO_SEED_EMAIL_RE =
  /(?:^seed-hr-\d+@petdate\.ir$|@seed\.petdate\.ir$|^seed\.customer\d+@petdate\.ir$|petdate-seed)/i;

/** Panel accounts created for the demo graph (seed.sales.agent, …). */
export const DEMO_SEED_USERNAME_RE = /^seed\./i;

/** Notes / activity text stamped by the demo seeders. */
export const DEMO_SEED_NOTE_RE = /(?:دادهٔ?\s*نمونه\s*SEED|ثبت نمونه SEED|فعالیت نمونه SEED|قرارداد SEED-HR)/i;

const SCAN_KEYS = [
  'personnelCode',
  'personnel_code',
  'code',
  'username',
  'orgEmail',
  'email',
  'mobile',
  'phone',
  'notes',
  'note',
  'ownerId',
  'owner_id',
] as const;

export function isDemoSeedText(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  const compactMobile = s.replace(/[\s-]/g, '');
  if (DEMO_SEED_PERSONNEL_RE.test(s)) return true;
  if (DEMO_SEED_MOBILE_RE.test(compactMobile)) return true;
  if (DEMO_SEED_EMAIL_RE.test(s)) return true;
  if (DEMO_SEED_USERNAME_RE.test(s)) return true;
  if (DEMO_SEED_NOTE_RE.test(s)) return true;
  return false;
}

/** True when any known seed field on the row matches a demo marker. */
export function isDemoSeedRecord(row: unknown): boolean {
  if (row == null || typeof row !== 'object') return isDemoSeedText(row);
  const r = row as Record<string, unknown>;
  for (const key of SCAN_KEYS) {
    if (key in r && isDemoSeedText(r[key])) return true;
  }
  return false;
}

export function partitionDemoSeedRows<T>(rows: readonly T[]): { live: T[]; seed: T[] } {
  const live: T[] = [];
  const seed: T[] = [];
  for (const row of rows) {
    if (isDemoSeedRecord(row)) seed.push(row);
    else live.push(row);
  }
  return { live, seed };
}

export function filterDemoSeedRows<T>(rows: readonly T[], showSeed: boolean): T[] {
  if (showSeed) return [...rows];
  return partitionDemoSeedRows(rows).live;
}
