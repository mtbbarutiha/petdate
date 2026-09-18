import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';

const DEFAULT_MAILDIR = '/var/mail/vhosts/petdate.ir/info/Maildir';

export type InboxListItem = {
  id: string;
  uid: string;
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
  unread: boolean;
  size: number;
};

export type InboxMessage = InboxListItem & {
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
};

function maildirRoot(): string {
  return String(process.env.MAIL_INBOX_PATH ?? '').trim() || DEFAULT_MAILDIR;
}

export function getInboxMailboxAddress(): string {
  return String(process.env.MAIL_INBOX_ADDRESS ?? '').trim() || 'info@petdate.ir';
}

/** Resolve a petdate.ir mailbox to its Maildir. Default stays info@. */
export function maildirForMailbox(address?: string): string {
  const raw = String(address || '').trim().toLowerCase();
  const fallback = maildirRoot();
  if (!raw || raw === getInboxMailboxAddress().toLowerCase()) return fallback;
  const local = raw.split('@')[0] || '';
  if (!/^[a-z0-9._+-]+$/.test(local)) return fallback;
  return join(dirname(dirname(fallback)), local, 'Maildir');
}

export function isInboxConfigured(address?: string): boolean {
  const root = maildirForMailbox(address);
  return existsSync(join(root, 'cur')) || existsSync(join(root, 'new'));
}

export function getInboxPublicStatus(): {
  configured: boolean;
  path: string;
  address: string;
} {
  return {
    configured: isInboxConfigured(),
    path: maildirRoot(),
    address: getInboxMailboxAddress(),
  };
}

export function encodeMessageId(relPath: string): string {
  return Buffer.from(relPath, 'utf8').toString('base64url');
}

export function decodeMessageId(id: string): string | null {
  try {
    const rel = Buffer.from(id, 'base64url').toString('utf8');
    if (!rel || rel.includes('..') || rel.startsWith('/') || !/^(cur|new)\//.test(rel)) {
      return null;
    }
    return rel;
  } catch {
    return null;
  }
}

function listMaildirFiles(root = maildirRoot()): Array<{ abs: string; rel: string; unread: boolean; mtimeMs: number; size: number }> {
  const out: Array<{ abs: string; rel: string; unread: boolean; mtimeMs: number; size: number }> = [];
  for (const folder of ['new', 'cur'] as const) {
    const dir = join(root, folder);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const abs = join(dir, name);
      try {
        const st = statSync(abs);
        if (!st.isFile()) continue;
        out.push({
          abs,
          rel: `${folder}/${name}`,
          unread: folder === 'new' || !/:2,.*S/.test(name),
          mtimeMs: st.mtimeMs,
          size: st.size,
        });
      } catch {
        /* skip */
      }
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

function addrText(obj: AddressObject | AddressObject[] | undefined): { email: string; name: string | null } {
  const list = Array.isArray(obj) ? obj : obj ? [obj] : [];
  const first = list[0]?.value?.[0];
  if (!first) return { email: '', name: null };
  return {
    email: String(first.address || '').trim().toLowerCase(),
    name: first.name ? String(first.name).trim() : null,
  };
}

function previewOf(text: string, html: string | null): string {
  const raw =
    text.trim() ||
    (html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  return raw.slice(0, 160);
}

async function parseFile(abs: string): Promise<ParsedMail> {
  return simpleParser(createReadStream(abs));
}

function toListItem(
  file: { rel: string; unread: boolean; size: number },
  parsed: ParsedMail
): InboxListItem {
  const from = addrText(parsed.from);
  const to = addrText(parsed.to);
  const text = String(parsed.text || '');
  const html = typeof parsed.html === 'string' ? parsed.html : null;
  return {
    id: encodeMessageId(file.rel),
    uid: createHash('sha1').update(file.rel).digest('hex').slice(0, 12),
    from: from.email,
    fromName: from.name,
    to: to.email || getInboxMailboxAddress(),
    subject: String(parsed.subject || '(بدون موضوع)').slice(0, 300),
    date: parsed.date ? parsed.date.toISOString() : null,
    preview: previewOf(text, html),
    unread: file.unread,
    size: file.size,
  };
}

export async function listInboxMessages(limit = 50, mailbox?: string): Promise<InboxListItem[]> {
  const root = maildirForMailbox(mailbox);
  if (!isInboxConfigured(mailbox)) return [];
  const files = listMaildirFiles(root).slice(0, Math.min(Math.max(limit, 1), 200));
  const items: InboxListItem[] = [];
  for (const file of files) {
    try {
      const parsed = await parseFile(file.abs);
      items.push(toListItem(file, parsed));
    } catch (err) {
      console.error('inbox parse failed', file.rel, err instanceof Error ? err.message : err);
    }
  }
  return items;
}

function markSeenInPlace(rel: string, root = maildirRoot()): string {
  const abs = join(root, rel);
  if (!existsSync(abs)) throw new Error('پیام پیدا نشد');

  if (rel.startsWith('cur/') && /:2,.*S/.test(rel)) return rel;

  const name = basename(rel);
  let newName = name;
  if (rel.startsWith('new/')) {
    if (!name.includes(':2,')) newName = `${name}:2,S`;
    else if (!/:2,.*S/.test(name)) newName = name.replace(/:2,/, ':2,S');
  } else if (rel.startsWith('cur/')) {
    if (!name.includes(':2,')) newName = `${name}:2,S`;
    else if (!/:2,.*S/.test(name)) {
      newName = name.replace(/:2,([A-Za-z]*)/, (_m, flags: string) =>
        `:2,${flags.includes('S') ? flags : `${flags}S`}`
      );
    }
  }

  const destRel = `cur/${newName}`;
  const destAbs = join(root, destRel);
  if (abs !== destAbs) {
    renameSync(abs, destAbs);
  }
  return destRel;
}

export async function getInboxMessage(
  id: string,
  opts?: { markSeen?: boolean; mailbox?: string }
): Promise<InboxMessage | null> {
  const root = maildirForMailbox(opts?.mailbox);
  if (!isInboxConfigured(opts?.mailbox)) return null;
  let rel = decodeMessageId(id);
  if (!rel) return null;
  let abs = join(root, rel);
  if (!existsSync(abs)) return null;

  if (opts?.markSeen !== false) {
    try {
      rel = markSeenInPlace(rel, root);
      abs = join(root, rel);
    } catch {
      /* keep original */
    }
  }

  const st = statSync(abs);
  const parsed = await parseFile(abs);
  const base = toListItem({ rel, unread: false, size: st.size }, parsed);
  const refsRaw = parsed.references;
  const references = Array.isArray(refsRaw)
    ? refsRaw.map(String)
    : refsRaw
      ? [String(refsRaw)]
      : [];
  return {
    ...base,
    text: String(parsed.text || '').slice(0, 50_000),
    html: typeof parsed.html === 'string' ? parsed.html.slice(0, 200_000) : null,
    messageId: parsed.messageId ? String(parsed.messageId) : null,
    inReplyTo: parsed.inReplyTo ? String(parsed.inReplyTo) : null,
    references,
  };
}

export function buildReplySubject(subject: string): string {
  const s = String(subject || '').trim() || '(بدون موضوع)';
  return /^re\s*:/i.test(s) || /^پاسخ\s*:/i.test(s) ? s : `Re: ${s}`;
}
