import type { Pet } from '../types';

/** True when a label looks like a public command/id (never use as inbox title). */
export function looksLikePublicUserId(value?: string | null): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return false;
  return (
    /^\/?u[_-]?\d{3,}$/i.test(raw) ||
    /^PD-U\d{3,}$/i.test(raw) ||
    /^\/user_PD-U\d{3,}$/i.test(raw)
  );
}

/**
 * Primary inbox title for a playmate peer: display name first.
 * Never Telegram @username / phone, and never `/u#####` / `PD-U#####` as the title.
 */
export function playmateInboxTitle(peer: Pick<Pet, 'name' | 'ownerName'>): string {
  const owner = String(peer.ownerName ?? '').trim();
  if (owner && !looksLikePublicUserId(owner) && !owner.startsWith('@')) {
    return owner;
  }
  const petName = String(peer.name ?? '').trim();
  if (petName) return `صاحب ${petName}`;
  return 'همبازی';
}
