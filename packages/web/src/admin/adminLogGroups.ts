/**
 * Collapse consecutive identical admin log rows (spam like repeated avatar warns).
 */

export type AdminLogGroupKeyInput = {
  level: string;
  source: string;
  message: string;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
};

export function adminLogFingerprint(row: AdminLogGroupKeyInput): string {
  const msg = (row.message || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const path = (row.path || '').split('?')[0] || '';
  return [
    (row.level || '').toLowerCase(),
    (row.source || '').toLowerCase(),
    msg,
    path,
    (row.method || '').toUpperCase(),
    row.statusCode ?? '',
  ].join('|');
}

export type AdminLogGroup<T extends AdminLogGroupKeyInput> = {
  key: string;
  fingerprint: string;
  count: number;
  latest: T;
  oldest: T;
  items: T[];
};

/** Group adjacent rows that share the same fingerprint (list is newest-first). */
export function groupConsecutiveLogs<T extends AdminLogGroupKeyInput & { id?: number }>(
  rows: T[]
): AdminLogGroup<T>[] {
  const groups: AdminLogGroup<T>[] = [];
  for (const row of rows) {
    const fingerprint = adminLogFingerprint(row);
    const prev = groups[groups.length - 1];
    if (prev && prev.fingerprint === fingerprint) {
      prev.items.push(row);
      prev.count += 1;
      prev.oldest = row;
      continue;
    }
    // Include latest id so React keys stay unique across non-adjacent groups.
    groups.push({
      key: `${fingerprint}#${row.id ?? groups.length}`,
      fingerprint,
      count: 1,
      latest: row,
      oldest: row,
      items: [row],
    });
  }
  return groups;
}
