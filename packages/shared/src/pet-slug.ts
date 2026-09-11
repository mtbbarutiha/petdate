/**
 * Public pet URL slugs — Latin transliteration of Persian/Arabic names,
 * hyphenated, unique-friendly. Never emit a pure-numeric slug (so /pet/35
 * always means legacy id redirect, not a name collision).
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Common Persian/Arabic letter → Latin (URL-safe) mapping. */
const FA_TO_LATIN: Record<string, string> = {
  'آ': 'a',
  'ا': 'a',
  'أ': 'a',
  'إ': 'e',
  'ٱ': 'a',
  'ب': 'b',
  'پ': 'p',
  'ت': 't',
  'ث': 's',
  'ج': 'j',
  'چ': 'ch',
  'ح': 'h',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'z',
  'ر': 'r',
  'ز': 'z',
  'ژ': 'zh',
  'س': 's',
  'ش': 'sh',
  'ص': 's',
  'ض': 'z',
  'ط': 't',
  'ظ': 'z',
  'ع': 'a',
  'غ': 'gh',
  'ف': 'f',
  'ق': 'gh',
  'ک': 'k',
  'ك': 'k',
  'گ': 'g',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'و': 'v',
  'ه': 'h',
  'ة': 'h',
  'ی': 'i',
  'ي': 'i',
  'ى': 'i',
  'ئ': 'i',
  'ء': '',
};

/** Drop Arabic diacritics / tatweel silently. */
const FA_DROP = new Set(['ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ّ', 'ْ', 'ـ', '\u200c', '\u200d']);

/** API path segments that must never be pet slugs. */
export const PET_SLUG_RESERVED = new Set([
  'photos',
  'nearby',
  'mine',
  'diary',
  'wishlist',
  'medical',
  'medical-record',
  'medical-entries',
  'profile-card',
  'new',
  'edit',
  'api',
  'pet',
  'pets',
]);

function normalizeDigit(ch: string): string {
  const pi = PERSIAN_DIGITS.indexOf(ch);
  if (pi >= 0) return String(pi);
  const ai = ARABIC_DIGITS.indexOf(ch);
  if (ai >= 0) return String(ai);
  return ch;
}

/** Transliterate + slugify a pet display name for public URLs. */
export function slugifyPetName(name: string): string {
  const raw = String(name ?? '').trim();
  let out = '';
  for (const ch of raw) {
    if (FA_DROP.has(ch)) continue;
    const d = normalizeDigit(ch);
    if (/[a-zA-Z0-9]/.test(d)) {
      out += d.toLowerCase();
      continue;
    }
    if (/\s|_/.test(d) || d === '-') {
      out += '-';
      continue;
    }
    const mapped = FA_TO_LATIN[d];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (/[\u0600-\u06FF]/.test(d)) out += '-';
  }
  let slug = out
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length > 48) slug = slug.slice(0, 48).replace(/-$/, '');
  if (!slug || /^\d+$/.test(slug) || PET_SLUG_RESERVED.has(slug)) slug = 'pet';
  return slug;
}

export function isNumericPetIdParam(param: string): boolean {
  return /^\d+$/.test(String(param ?? '').trim());
}

export function petPublicPath(pet: { slug?: string | null; id: number }): string {
  const slug = String(pet.slug ?? '').trim();
  if (slug) return `/pet/${encodeURIComponent(slug)}`;
  return `/pet/${pet.id}`;
}
