/**
 * Telegram sendPhoto rejects relative paths like `/api/pets/photos/...`.
 * After API materializes file_ids to local URLs, bot replies must use an absolute HTTPS URL
 * (or keep a raw Telegram file_id).
 */
export function telegramMediaUrl(url?: string | null): string | undefined {
  const v = String(url ?? '').trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('/')) {
    const base = (
      process.env.PUBLIC_WEB_URL ||
      process.env.WEB_URL ||
      'https://petdate.ir'
    ).replace(/\/$/, '');
    return `${base}${v}`;
  }
  // Opaque Telegram file_id
  return v;
}
