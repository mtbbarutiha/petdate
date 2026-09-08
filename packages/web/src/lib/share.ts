/**
 * Share a public URL via Web Share API when available; otherwise copy to clipboard.
 * Returns a short Persian status message for toast UI.
 * User-cancelled share sheets resolve to `null` (no toast).
 */
export async function shareOrCopyUrl(opts: {
  url: string;
  title?: string;
  text?: string;
}): Promise<string | null> {
  const url = opts.url.trim();
  if (!url) return 'لینک اشتراک در دسترس نیست';

  const title = opts.title?.trim() || 'پت‌دیت';
  const text = opts.text?.trim() || title;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'اشتراک‌گذاری شد';
    } catch (err) {
      // User dismissed the sheet — not an error.
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
      if (name === 'AbortError') return null;
      // Fall through to clipboard (desktop browsers often reject share).
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'لینک کپی شد';
    }
  } catch {
    /* ignore — try legacy fallback */
  }

  try {
    const input = document.createElement('input');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, url.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    if (ok) return 'لینک کپی شد';
  } catch {
    /* ignore */
  }

  return 'کپی لینک ناموفق بود';
}

/** Absolute public URL for a pet profile page. */
export function petPublicUrl(petId: number | string): string {
  const id = String(petId).trim();
  const path = `/pets/${id}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
