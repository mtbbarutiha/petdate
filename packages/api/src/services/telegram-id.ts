/**
 * Telegram chat ids must be strings for Bot API / string helpers.
 * After Postgres migration, some drivers/paths can surface digit-only ids as numbers.
 */
export function normalizeTelegramId(id: unknown): string | null {
  if (id == null) return null;
  const t = String(id).trim();
  if (!t) return null;
  if (t.startsWith('fake_') || t.startsWith('fake_owner_') || t.startsWith('demo_')) {
    return null;
  }
  return t;
}

/** Internal synthetic accounts that must never receive Bot API sends. */
export function isSyntheticTelegramId(id: unknown): boolean {
  const t = normalizeTelegramId(id);
  if (!t) return false;
  return t === 'petdate_ai_assistant' || t.startsWith('petdate_ai_');
}

/** Real Telegram chat ids are numeric (users positive; groups/channels may be negative). */
export function usableTelegramId(id: unknown): id is string {
  const t = normalizeTelegramId(id);
  if (!t) return false;
  if (isSyntheticTelegramId(t)) return false;
  return /^-?\d+$/.test(t);
}
