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

export function usableTelegramId(id: unknown): id is string {
  return normalizeTelegramId(id) != null;
}
