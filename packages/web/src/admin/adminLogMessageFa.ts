/**
 * Human-readable bilingual copy for admin «لاگ خطاها» rows.
 * Titles come from the shared error catalog; the raw line stays as detail.
 */
import {
  pickLogTitle,
  translateAppLogMessage,
  type AppLogTranslateInput,
  type ErrorLang,
  type TranslatedAppLog,
} from '@petdate/shared';

export type AdminLogMessageInput = AppLogTranslateInput;

export type AdminLogMessageFa = {
  /** Primary Persian summary shown in the table */
  title: string;
  /** Original / technical line (expandable secondary) */
  detail: string | null;
};

export { parseHttpLogMessage, translateAppLogMessage, pickLogTitle } from '@petdate/shared';
export type { TranslatedAppLog };

/**
 * Map a log row to Persian primary copy + optional technical detail.
 */
export function formatAdminLogMessageFa(input: AdminLogMessageInput): AdminLogMessageFa {
  const mapped = translateAppLogMessage(input);
  return {
    title: mapped.titleFa,
    detail: mapped.detail,
  };
}

export function formatAdminLogMessage(
  input: AdminLogMessageInput,
  lang: ErrorLang = 'fa'
): { title: string; titleFa: string; titleEn: string; detail: string | null; code: string | null } {
  const mapped = translateAppLogMessage(input);
  return {
    title: pickLogTitle(mapped, lang),
    titleFa: mapped.titleFa,
    titleEn: mapped.titleEn,
    detail: mapped.detail,
    code: mapped.code,
  };
}

/** Secondary line: raw original when it differs from the UI-lang title. */
export function adminLogSecondary(mapped: TranslatedAppLog, primary: string): string | null {
  const raw = mapped.detail;
  if (raw && raw !== primary) return raw;
  if (mapped.titleEn !== mapped.titleFa) {
    const other = primary === mapped.titleFa ? mapped.titleEn : mapped.titleFa;
    if (other && other !== primary) return other;
  }
  return null;
}
