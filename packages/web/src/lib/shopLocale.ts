import type { Lang } from '../i18n/types';

/** Prefer English label when lang=en; never leave Persian chrome when EN is available. */
export function shopLabel(lang: Lang, fa: string, en?: string | null): string {
  if (lang === 'en') return (en && en.trim()) || humanizeSlug(fa) || fa;
  return fa;
}

/** Build a readable EN title from an English slug when titleEn is missing. */
export function productTitleForLang(
  lang: Lang,
  title: string,
  opts?: { titleEn?: string | null; slug?: string | null }
): string {
  if (lang !== 'en') return title;
  if (opts?.titleEn?.trim()) return opts.titleEn.trim();
  if (opts?.slug) {
    const human = humanizeSlug(opts.slug);
    if (human) return human;
  }
  return title;
}

function humanizeSlug(slug: string): string {
  const s = String(slug || '')
    .replace(/-p\d+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!s || /[\u0600-\u06FF]/.test(s)) return '';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
