/** Locale-aware diary heading, e.g. «شنبه ۲۱ شهریور ۱۴۰۵» / «Saturday, 12 September 2026». */
export function formatDiaryWhen(iso: string, lang: 'fa' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}
