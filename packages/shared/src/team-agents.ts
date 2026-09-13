/**
 * Site team chat personas → 4 public faces / 4 domain AI agents.
 *
 * Domain engines (prompts / knowledge):
 *   trainer  → فرانک احمدی
 *   finance  → لیلا کیانی (مدیر مالی)
 *   support  → ساناز غفاری
 *   vet      → سارا نوری  (only public vet — no second doctor)
 *
 * Same roster as Grok Bot (گراک بات). `grokBotKey` bridges optional external
 * bot ids (GROK_BOT_<KEY>_ID / URL). Finance may run on xAI via system prompt
 * when GROK_BOT_LEILA_KIANI_ID is not yet provisioned.
 *
 * Legacy: یلدا شعبانی redirects to ساناز (support). Old Sanaz-as-vet / Leila-as-trainer
 * URLs still resolve via aliases.
 */

export type TeamAgentKind = 'vet' | 'trainer' | 'support' | 'finance';

export type TeamAgentDef = {
  slug: string;
  telegramId: string;
  name: string;
  role: string;
  kind: TeamAgentKind;
  avatarUrl: string;
  cardImage: string;
  /**
   * Stable Grok Bot (گراک بات) roster key — same identity as the off-site Bot.
   * Env link: GROK_BOT_<KEY>_ID / GROK_BOT_<KEY>_URL (KEY = upper snake of this).
   */
  grokBotKey: string;
};

/** Visual L→R on RTL landing ≈ reverse of this DOM order. */
export const TEAM_AGENTS: readonly TeamAgentDef[] = [
  {
    slug: 'faranak-ahmadi',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_layla_ahmadi',
    name: 'فرانک احمدی',
    role: 'مربی',
    kind: 'trainer',
    avatarUrl: '/agents/faranak-ahmadi.jpg',
    cardImage: '/pepito/uploads/01-3.jpg',
    grokBotKey: 'faranak_ahmadi',
  },
  {
    slug: 'leila-kiani',
    telegramId: 'petdate_ai_assistant',
    name: 'لیلا کیانی',
    role: 'مدیر مالی',
    kind: 'finance',
    avatarUrl: '/agents/leila-kiani.jpg',
    cardImage: '/pepito/uploads/02-3.jpg',
    grokBotKey: 'leila_kiani',
  },
  {
    slug: 'sanaz-ghaffari',
    telegramId: 'petdate_ai_sanaz_ghaffari',
    name: 'ساناز غفاری',
    role: 'پشتیبانی',
    kind: 'support',
    avatarUrl: '/agents/sanaz-ghaffari.jpg',
    cardImage: '/pepito/uploads/03-3.jpg',
    grokBotKey: 'sanaz_ghaffari',
  },
  {
    slug: 'sara-noori',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_sara_nozi',
    name: 'سارا نوری',
    role: 'دامپزشک',
    kind: 'vet',
    avatarUrl: '/agents/sara-noori.jpg',
    cardImage: '/pepito/uploads/04-3.jpg',
    grokBotKey: 'sara_noori',
  },
] as const;

/** Old public URLs still resolve after renames / role moves. */
const TEAM_AGENT_SLUG_ALIASES: Record<string, string> = {
  'layla-ahmadi': 'faranak-ahmadi',
  'sara-nozi': 'sara-noori',
  'pasha-yazdani': 'faranak-ahmadi',
  pasha: 'faranak-ahmadi',
  /** یلدا replaced by ساناز as support. */
  'yalda-shabani': 'sanaz-ghaffari',
};

/**
 * Legacy display names → current TEAM_AGENTS slug.
 * «پاشا یزدانی» → فرانک (مربی پیش‌فرض).
 * یلدا → ساناز (پشتیبانی).
 */
const TEAM_AGENT_NAME_ALIASES: Record<string, string> = {
  'پاشا یزدانی': 'faranak-ahmadi',
  پاشا: 'faranak-ahmadi',
  'دکتر لیلا کیانی': 'leila-kiani',
  'لیلا کیانی': 'leila-kiani',
  'دکتر لایلا احمدی': 'faranak-ahmadi',
  'لایلا احمدی': 'faranak-ahmadi',
  'فرانک احمدی': 'faranak-ahmadi',
  'دکتر ساناز غفاری': 'sanaz-ghaffari',
  'ساناز غفاری': 'sanaz-ghaffari',
  'دکتر سارا نوری': 'sara-noori',
  'سارا نوری': 'sara-noori',
  'دکتر سارا نوزی': 'sara-noori',
  'سارا نوزی': 'sara-noori',
  'یلدا شعبانی': 'sanaz-ghaffari',
  یلدا: 'sanaz-ghaffari',
  'دستیار هوشمند پت‌دیت': 'faranak-ahmadi',
  'دستیار هوشمند پت': 'faranak-ahmadi',
  'دستیار هوشمند': 'faranak-ahmadi',
};

/** Default trainer / AI fallback face — فرانک replaces پاشا. */
export const DEFAULT_TEAM_AGENT_SLUG = 'faranak-ahmadi';

/** Support AI face — ساناز غفاری (replaces یلدا). */
export const SUPPORT_TEAM_AGENT_SLUG = 'sanaz-ghaffari';

/** Default vet AI face when no human vet is online — only سارا. */
export const DEFAULT_VET_TEAM_AGENT_SLUG = 'sara-noori';

/** Finance / billing AI face — لیلا کیانی. */
export const FINANCE_TEAM_AGENT_SLUG = 'leila-kiani';

export function getTeamAgentBySlug(slug: string | null | undefined): TeamAgentDef | null {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;
  const canonical = TEAM_AGENT_SLUG_ALIASES[key] ?? key;
  return TEAM_AGENTS.find((a) => a.slug === canonical) ?? null;
}

export function getTeamAgentByTelegramId(telegramId: string | null | undefined): TeamAgentDef | null {
  const t = String(telegramId || '').trim();
  if (!t) return null;
  return TEAM_AGENTS.find((a) => a.telegramId === t) ?? null;
}

/** Resolve by Grok Bot roster key (`faranak_ahmadi` or `faranak-ahmadi`). */
export function getTeamAgentByGrokBotKey(key: string | null | undefined): TeamAgentDef | null {
  const raw = String(key || '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.replace(/-/g, '_');
  // Legacy yalda_shabani → sanaz support persona.
  if (normalized === 'yalda_shabani') return getTeamAgentBySlug('sanaz-ghaffari');
  return TEAM_AGENTS.find((a) => a.grokBotKey === normalized) ?? getTeamAgentBySlug(raw.replace(/_/g, '-'));
}

/** Resolve team agent by current or legacy Persian display name. */
export function getTeamAgentByName(name: string | null | undefined): TeamAgentDef | null {
  const key = String(name || '').trim();
  if (!key) return null;
  const byExact = TEAM_AGENTS.find((a) => a.name === key);
  if (byExact) return byExact;
  const slug = TEAM_AGENT_NAME_ALIASES[key];
  return slug ? getTeamAgentBySlug(slug) : null;
}

export function isTeamAgentTelegramId(telegramId: string | null | undefined): boolean {
  return Boolean(getTeamAgentByTelegramId(telegramId));
}

export function teamAgentsByKind(kind: TeamAgentKind): TeamAgentDef[] {
  return TEAM_AGENTS.filter((a) => a.kind === kind);
}

export function teamAgentChatPath(slug: string): string {
  if (getTeamAgentBySlug(slug)?.kind === 'support') return '/support/chat';
  return `/team-chat/${encodeURIComponent(slug)}`;
}
