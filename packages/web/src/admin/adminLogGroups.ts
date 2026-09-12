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
  count: number;
  latest: T;
  oldest: T;
  items: T[];
};

/** Group adjacent rows that share the same fingerprint (list is newest-first). */
export function groupConsecutiveLogs<T extends AdminLogGroupKeyInput>(rows: T[]): AdminLogGroup<T>[] {
  const groups: AdminLogGroup<T>[] = [];
  for (const row of rows) {
    const key = adminLogFingerprint(row);
    const prev = groups[groups.length - 1];
    if (prev && prev.key === key) {
      prev.items.push(row);
      prev.count += 1;
      prev.oldest = row;
      continue;
    }
    groups.push({
      key,
      count: 1,
      latest: row,
      oldest: row,
      items: [row],
    });
  }
  return groups;
}
