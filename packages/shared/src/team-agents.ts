/**
 * Landing-page team chat personas → 3 AI agent backends.
 *
 * Backends (exactly 3):
 *   - vet      → دامپزشک domain only
 *   - trainer  → مربی / رفتار domain only (role model: پاشا یزدانی)
 *   - support  → پشتیبانی سایت / ops
 *
 * Personas (5 on-site faces customers chat with):
 *   فرانک احمدی, لیلا کیانی → trainer
 *   دکتر ساناز غفاری, دکتر سارا نوری → vet
 *   یلدا شعبانی → support
 *
 * Default / legacy fallback identity (`petdate_ai_assistant`) is لیلا کیانی
 * (renamed from پاشا یزدانی). Do not create a second لیلا agent.
 *
 * یلدا شعبانی photo: drop the real still at public path
 *   packages/web/public/agents/yalda-shabani.jpg
 * until then avatarUrl points at the SVG placeholder.
 */

export type TeamAgentBackend = 'vet' | 'trainer' | 'support';

/** @deprecated use TeamAgentBackend — kept for call sites that import TeamAgentKind */
export type TeamAgentKind = TeamAgentBackend;

export type TeamAgentDef = {
  slug: string;
  telegramId: string;
  name: string;
  role: string;
  kind: TeamAgentBackend;
  /** Same as kind — explicit backend agent id for routing/prompts */
  backend: TeamAgentBackend;
  avatarUrl: string;
  cardImage: string;
  /**
   * Trainer persona that must introduce itself (فرانک احمدی) and coach
   * in پاشا یزدانی style.
   */
  introSelf?: boolean;
  /** Coach style overlay for trainer backend */
  coachStyle?: 'pasha';
};

/** Visual L→R on RTL landing matches reverse of this DOM order. */
export const TEAM_AGENTS: readonly TeamAgentDef[] = [
  {
    slug: 'faranak-ahmadi',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_layla_ahmadi',
    name: 'فرانک احمدی',
    role: 'مربی',
    kind: 'trainer',
    backend: 'trainer',
    avatarUrl: '/agents/faranak-ahmadi.jpg',
    cardImage: '/pepito/uploads/01-3.jpg',
    introSelf: true,
    coachStyle: 'pasha',
  },
  {
    slug: 'leila-kiani',
    telegramId: 'petdate_ai_assistant',
    name: 'لیلا کیانی',
    role: 'مربی',
    kind: 'trainer',
    backend: 'trainer',
    avatarUrl: '/agents/leila-kiani.jpg',
    cardImage: '/pepito/uploads/02-3.jpg',
    coachStyle: 'pasha',
  },
  {
    slug: 'sanaz-ghaffari',
    telegramId: 'petdate_ai_sanaz_ghaffari',
    name: 'دکتر ساناز غفاری',
    role: 'دامپزشک',
    kind: 'vet',
    backend: 'vet',
    avatarUrl: '/agents/sanaz-ghaffari.jpg',
    cardImage: '/pepito/uploads/03-3.jpg',
  },
  {
    slug: 'sara-noori',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_sara_nozi',
    name: 'دکتر سارا نوری',
    role: 'دامپزشک',
    kind: 'vet',
    backend: 'vet',
    avatarUrl: '/agents/sara-noori.jpg',
    cardImage: '/pepito/uploads/04-3.jpg',
  },
  {
    slug: 'yalda-shabani',
    telegramId: 'petdate_ai_yalda_shabani',
    name: 'یلدا شعبانی',
    role: 'پشتیبانی',
    kind: 'support',
    backend: 'support',
    /**
     * Placeholder until ops drops the real photo at:
     * packages/web/public/agents/yalda-shabani.jpg
     * Then flip avatarUrl to '/agents/yalda-shabani.jpg'.
     */
    avatarUrl: '/agents/yalda-shabani.png',
    cardImage: '/agents/yalda-shabani.png',
  },
] as const;

/** Old public URLs still resolve after renames. */
const TEAM_AGENT_SLUG_ALIASES: Record<string, string> = {
  'layla-ahmadi': 'faranak-ahmadi',
  'sara-nozi': 'sara-noori',
};

/** Legacy display names → current TEAM_AGENTS slug (inbox / decorate fallback). */
const TEAM_AGENT_NAME_ALIASES: Record<string, string> = {
  'پاشا یزدانی': 'leila-kiani',
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
  'دستیار هوشمند پت‌دیت': 'leila-kiani',
  'دستیار هوشمند پت': 'leila-kiani',
  'دستیار هوشمند': 'leila-kiani',
};

export const DEFAULT_TEAM_AGENT_SLUG = 'leila-kiani';

/** Canonical support persona (یلدا شعبانی). */
export const SUPPORT_TEAM_AGENT_SLUG = 'yalda-shabani';

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

export function teamAgentChatPath(slug: string): string {
  return `/team-chat/${encodeURIComponent(slug)}`;
}

export function listTeamAgentsByBackend(backend: TeamAgentBackend): TeamAgentDef[] {
  return TEAM_AGENTS.filter((a) => a.backend === backend);
}

export function getSupportTeamAgent(): TeamAgentDef {
  return getTeamAgentBySlug(SUPPORT_TEAM_AGENT_SLUG)!;
}
