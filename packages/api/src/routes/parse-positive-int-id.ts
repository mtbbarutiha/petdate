/** Reject NaN / non-positive ids before they hit the DB (bigint "NaN" 500s). */
export function parsePositiveIntId(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}
