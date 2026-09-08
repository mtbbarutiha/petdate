import { config } from './config';

/** Public HTTPS URL for Telegram inline buttons (falls back to WEB_URL). */
export function effectiveWebUrl(): string {
  return config.publicWebUrl ?? config.webUrl;
}

/** Telegram rejects localhost and private URLs in inline keyboard link buttons. */
export function isTelegramInlineUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return false;
    }
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Public origin that Telegram's servers can fetch (HTTPS preferred). */
function publicFetchOrigin(): string | null {
  for (const cand of [
    process.env.PUBLIC_API_URL,
    process.env.API_PUBLIC_URL,
    config.publicWebUrl,
    config.webUrl,
    config.apiUrl,
  ]) {
    const v = String(cand ?? '')
      .trim()
      .replace(/\/$/, '');
    if (!v) continue;
    if (!isTelegramInlineUrl(v)) continue;
    return v;
  }
  return null;
}

/**
 * Resolve pets.image_url for Telegram sendPhoto / replyWithPhoto.
 * Relative paths like `/api/pets/photos/...` have no host and Telegram rejects
 * them ("URL host is empty"). Absolutize when a public origin is available;
 * otherwise return null so callers can fall back to a default HTTPS image.
 */
export function resolveTelegramPhotoUrl(
  imageUrl: string | undefined | null
): string | null {
  const raw = String(imageUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return isTelegramInlineUrl(raw) ? raw : null;
  }
  // Telegram file_id (opaque token stored by bot uploads)
  if (!raw.startsWith('/')) return raw;
  const origin = publicFetchOrigin();
  if (!origin) return null;
  return `${origin}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

export function webLinkHint(): string {
  const url = effectiveWebUrl();
  if (isTelegramInlineUrl(url)) return '';
  return `\n\n🌐 برای ادامه در مرورگر:\n${url}`;
}
