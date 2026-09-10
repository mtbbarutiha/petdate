export type CheckTone = 'ok' | 'warn' | 'bad' | 'idle';

type CheckLike = {
  ok: boolean;
  status?: 'up' | 'down' | 'warn' | 'not_configured';
};

/** Map live check status → UI tone (green / amber / red / idle). */
export function checkTone(check: CheckLike): CheckTone {
  if (check.status === 'not_configured') return 'idle';
  if (check.status === 'warn') return 'warn';
  if (check.status === 'down') return 'bad';
  if (check.status === 'up' || (check.status == null && check.ok)) return 'ok';
  if (!check.ok) return 'bad';
  return 'ok';
}
