/**
 * Admin mailbox picker: system addresses plus HR personnel org emails.
 * Super-admin / system manager sees every mailbox. Others see info@ and their own.
 */
import { getDb } from './db';

export type AdminMailbox = {
  address: string;
  label: string;
  kind: 'system' | 'personnel';
  active: boolean;
};

export const DEFAULT_MAILBOX = 'info@petdate.ir';

const SYSTEM_MAILBOXES: AdminMailbox[] = [
  { address: DEFAULT_MAILBOX, label: 'صندوق اطلاعات', kind: 'system', active: true },
  { address: 'no-reply@petdate.ir', label: 'ایمیل سیستمی', kind: 'system', active: true },
  { address: 'support@petdate.ir', label: 'پشتیبانی', kind: 'system', active: true },
];

export function normalizeMailboxAddress(raw: string): string | null {
  const address = String(raw || '').trim().toLowerCase();
  if (!/^[a-z0-9._+-]+@petdate\.ir$/.test(address)) return null;
  return address;
}

export function actorSeesAllMailboxes(actor: {
  role?: string;
  permissions?: string[];
  displayName?: string;
} | null | undefined): boolean {
  if (!actor) return false;
  if (actor.role === 'admin') return true;
  if (actor.permissions?.includes('admin.full')) return true;
  const blob = `${actor.displayName || ''} ${actor.role || ''}`;
  return blob.includes('مدیر سیستم') || /system/i.test(String(actor.role || ''));
}

export function filterMailboxesForActor(
  all: AdminMailbox[],
  actor: { seeAll: boolean; username?: string; email?: string }
): AdminMailbox[] {
  const byAddress = new Map<string, AdminMailbox>();
  for (const row of all) {
    const address = normalizeMailboxAddress(row.address);
    if (!address) continue;
    byAddress.set(address, { ...row, address });
  }
  if (!byAddress.has(DEFAULT_MAILBOX)) {
    byAddress.set(DEFAULT_MAILBOX, SYSTEM_MAILBOXES[0]!);
  }
  const list = [...byAddress.values()];
  if (actor.seeAll) {
    return list.sort((a, b) => a.address.localeCompare(b.address));
  }
  const own = new Set<string>([DEFAULT_MAILBOX]);
  const email = normalizeMailboxAddress(actor.email || '');
  if (email) own.add(email);
  const username = String(actor.username || '').trim().toLowerCase();
  if (username) own.add(`${username}@petdate.ir`);
  return list
    .filter((row) => own.has(row.address))
    .sort((a, b) => a.address.localeCompare(b.address));
}

function personnelMailboxes(): AdminMailbox[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT first_name, last_name, org_email, access_status, username
         FROM hr_employees
         WHERE TRIM(COALESCE(org_email, '')) != ''`
      )
      .all() as Array<{
      first_name: string;
      last_name: string;
      org_email: string;
      access_status: string;
      username: string;
    }>;
    const out: AdminMailbox[] = [];
    for (const row of rows) {
      const address = normalizeMailboxAddress(row.org_email);
      if (!address) continue;
      const name = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      out.push({
        address,
        label: name || row.username || address,
        kind: 'personnel',
        active: String(row.access_status || '') !== 'غیر فعال',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function listAdminMailboxes(actor: {
  role?: string;
  permissions?: string[];
  displayName?: string;
  username?: string;
} | null | undefined): AdminMailbox[] {
  const all = [...SYSTEM_MAILBOXES, ...personnelMailboxes()];
  return filterMailboxesForActor(all, {
    seeAll: actorSeesAllMailboxes(actor),
    username: actor?.username,
  });
}
