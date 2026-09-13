/** Example / historical bootstrap password — rejected in production. */
export const DEFAULT_ADMIN_PASSWORD = 'petdate';

export function isDefaultAdminPassword(password: string): boolean {
  return String(password || '').trim().toLowerCase() === DEFAULT_ADMIN_PASSWORD;
}

/** Empty is never usable. The literal `petdate` is rejected when NODE_ENV=production. */
export function isUsableAdminPassword(
  password: string,
  nodeEnv = process.env.NODE_ENV
): boolean {
  const p = String(password || '').trim();
  if (!p) return false;
  if (nodeEnv === 'production' && isDefaultAdminPassword(p)) return false;
  return true;
}

/**
 * Env bootstrap password for /admin.
 * Production: only a non-default ADMIN_PASSWORD. Dev: unset falls back to `petdate`.
 */
export function resolveEnvAdminPassword(
  env: { ADMIN_PASSWORD?: string; NODE_ENV?: string } = process.env
): string | null {
  const raw = String(env.ADMIN_PASSWORD || '').trim();
  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;
  if (isUsableAdminPassword(raw, nodeEnv)) return raw;
  if (nodeEnv !== 'production' && !raw) return DEFAULT_ADMIN_PASSWORD;
  return null;
}
