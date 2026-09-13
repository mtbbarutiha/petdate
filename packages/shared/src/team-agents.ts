/**
 * Site team chat personas → 3 domain AI agents (vet | trainer | support).
 *
 * Domain engines (prompts / knowledge):
 *   trainer → فرانک احمدی، لیلا کیانی
 *   vet     → دکتر ساناز غفاری، دکتر سارا نوری
 *   support → یلدا شعبانی
 *
 * These five faces are the same roster Mohammad built in Grok Bot (گراک بات /
 * «گراگ بات»). `grokBotKey` is the stable bridge id for optional external links.
 *
 * Default trainer face is فرانک احمدی (replaces legacy «پاشا یزدانی»).
 * لیلا remains a separate trainer persona (same domain engine).
 */

export type TeamAgentKind = 'vet' | 'trainer' | 'support';

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
    role: 'مربی',
    kind: 'trainer',
    avatarUrl: '/agents/leila-kiani.jpg',
    cardImage: '/pepito/uploads/02-3.jpg',
    grokBotKey: 'leila_kiani',
  },
  {
    slug: 'sanaz-ghaffari',
    telegramId: 'petdate_ai_sanaz_ghaffari',
    name: 'دکتر ساناز غفاری',
    role: 'دامپزشک',
    kind: 'vet',
    avatarUrl: '/agents/sanaz-ghaffari.jpg',
    cardImage: '/pepito/uploads/03-3.jpg',
    grokBotKey: 'sanaz_ghaffari',
  },
  {
    slug: 'sara-noori',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_sara_nozi',
    name: 'دکتر سارا نوری',
    role: 'دامپزشک',
    kind: 'vet',
    avatarUrl: '/agents/sara-noori.jpg',
    cardImage: '/pepito/uploads/04-3.jpg',
    grokBotKey: 'sara_noori',
  },
  {
    slug: 'yalda-shabani',
    telegramId: 'petdate_ai_yalda_shabani',
    name: 'یلدا شعبانی',
    role: 'پشتیبانی',
    kind: 'support',
    avatarUrl: '/agents/yalda-shabani.jpg',
    cardImage: '/agents/yalda-shabani.jpg',
    grokBotKey: 'yalda_shabani',
  },
] as const;

/** Old public URLs still resolve after renames. */
const TEAM_AGENT_SLUG_ALIASES: Record<string, string> = {
  'layla-ahmadi': 'faranak-ahmadi',
  'sara-nozi': 'sara-noori',
  'pasha-yazdani': 'faranak-ahmadi',
  pasha: 'faranak-ahmadi',
};

/**
 * Legacy display names → current TEAM_AGENTS slug.
 * «پاشا یزدانی» now maps to فرانک (مربی پیش‌فرض)، not لیلا.
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
  'یلدا شعبانی': 'yalda-shabani',
  یلدا: 'yalda-shabani',
  'دستیار هوشمند پت‌دیت': 'faranak-ahmadi',
  'دستیار هوشمند پت': 'faranak-ahmadi',
  'دستیار هوشمند': 'faranak-ahmadi',
};

/** Default trainer / AI fallback face — فرانک replaces پاشا. */
export const DEFAULT_TEAM_AGENT_SLUG = 'faranak-ahmadi';

export const SUPPORT_TEAM_AGENT_SLUG = 'yalda-shabani';

/** Default vet AI face when no human vet is online. */
export const DEFAULT_VET_TEAM_AGENT_SLUG = 'sara-noori';

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
