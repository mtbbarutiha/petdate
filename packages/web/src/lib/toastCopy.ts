/** Split a single toast message into title/body. Existing call sites pass one string. */
export function splitToastCopy(
  message: string,
  explicitTitle?: string
): { title: string; body?: string } {
  const trimmed = message.trim();
  const heading = explicitTitle?.trim();
  if (heading) return { title: heading, body: trimmed || undefined };
  const parts = trimmed.split(/\n+| — | – /);
  if (parts.length >= 2) {
    const title = parts[0]!.trim();
    const body = parts.slice(1).join(' — ').trim();
    if (title && body) return { title, body };
  }
  return { title: trimmed };
}
