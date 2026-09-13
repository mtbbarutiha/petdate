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
  /** Matching admin/staff username from STAFF_AGENTS — does not change chat identity. */
  staffUsername: string;
};

/** Query on /agents/*.jpg so browsers drop pepito lookalikes + the YS/yalda-v1 files. */
export const TEAM_AGENT_AVATAR_CACHE_BUST = 'persona-v2';

function agentAvatar(slug: string): string {
  return `/agents/${slug}.jpg?v=${TEAM_AGENT_AVATAR_CACHE_BUST}`;
}

/** Visual L→R on RTL landing ≈ reverse of this DOM order. */
export const TEAM_AGENTS: readonly TeamAgentDef[] = [
  {
    slug: 'faranak-ahmadi',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_layla_ahmadi',
    name: 'فرانک احمدی',
    role: 'مربی',
    kind: 'trainer',
    avatarUrl: agentAvatar('faranak-ahmadi'),
    cardImage: agentAvatar('faranak-ahmadi'),
    grokBotKey: 'faranak_ahmadi',
    staffUsername: 'faranak',
  },
  {
    slug: 'leila-kiani',
    telegramId: 'petdate_ai_assistant',
    name: 'لیلا کیانی',
    role: 'مربی',
    kind: 'trainer',
    avatarUrl: agentAvatar('leila-kiani'),
    cardImage: agentAvatar('leila-kiani'),
    grokBotKey: 'leila_kiani',
    staffUsername: 'leila',
  },
  {
    slug: 'sanaz-ghaffari',
    telegramId: 'petdate_ai_sanaz_ghaffari',
    name: 'دکتر ساناز غفاری',
    role: 'دامپزشک',
    kind: 'vet',
    avatarUrl: agentAvatar('sanaz-ghaffari'),
    cardImage: agentAvatar('sanaz-ghaffari'),
    grokBotKey: 'sanaz_ghaffari',
    staffUsername: 'sanaz',
  },
  {
    slug: 'sara-noori',
    // Keep telegram id so the existing DB synthetic user is patched, not recreated.
    telegramId: 'petdate_ai_sara_nozi',
    name: 'دکتر سارا نوری',
    role: 'دامپزشک',
    kind: 'vet',
    avatarUrl: agentAvatar('sara-noori'),
    cardImage: agentAvatar('sara-noori'),
    grokBotKey: 'sara_noori',
    staffUsername: 'sara',
  },
  {
    slug: 'yalda-shabani',
    telegramId: 'petdate_ai_yalda_shabani',
    name: 'یلدا شعبانی',
    role: 'پشتیبانی',
    kind: 'support',
    avatarUrl: agentAvatar('yalda-shabani'),
    cardImage: agentAvatar('yalda-shabani'),
    grokBotKey: 'yalda_shabani',
    staffUsername: 'yalda',
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
 * Synthetic telegram ids that are not the stored `telegramId` on TEAM_AGENTS.
 * Sara’s row keeps `petdate_ai_sara_nozi` so the live DB user is patched, not
 * recreated — but slug-shaped `petdate_ai_sara_noori` must still resolve to
 * the same vet persona (Sanaz already uses the slug-shaped id).
 */
const TEAM_AGENT_TELEGRAM_ID_ALIASES: Record<string, string> = {
  petdate_ai_sara_noori: 'sara-noori',
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
  const byExact = TEAM_AGENTS.find((a) => a.telegramId === t);
  if (byExact) return byExact;
  const slug = TEAM_AGENT_TELEGRAM_ID_ALIASES[t];
  return slug ? getTeamAgentBySlug(slug) : null;
}

/** Primary + alias telegram ids that identify the same persona. */
export function listTeamAgentTelegramIds(def: TeamAgentDef): string[] {
  const extras = Object.entries(TEAM_AGENT_TELEGRAM_ID_ALIASES)
    .filter(([, slug]) => slug === def.slug)
    .map(([id]) => id);
  return [def.telegramId, ...extras.filter((id) => id !== def.telegramId)];
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
  const def = getTeamAgentBySlug(slug);
  if (def?.kind === 'support') return '/support/chat';
  const canonical = def?.slug || slug;
  return `/team-chat/${encodeURIComponent(canonical)}`;
}

/** Default face + path to offer when a persona is out of domain. */
export function teamAgentReferralForKind(kind: TeamAgentKind): {
  slug: string;
  name: string;
  role: string;
  path: string;
} {
  const preferred =
    kind === 'support'
      ? getTeamAgentBySlug(SUPPORT_TEAM_AGENT_SLUG)
      : kind === 'vet'
        ? getTeamAgentBySlug(DEFAULT_VET_TEAM_AGENT_SLUG)
        : getTeamAgentBySlug(DEFAULT_TEAM_AGENT_SLUG);
  const def = preferred ?? TEAM_AGENTS.find((a) => a.kind === kind)!;
  return { slug: def.slug, name: def.name, role: def.role, path: teamAgentChatPath(def.slug) };
}

/** Persian one-liner: «این تو تخصص من نیست» + named colleague + site path. */
export function teamAgentOutOfDomainHint(fromKind: TeamAgentKind): string {
  if (fromKind === 'trainer') {
    const vet = teamAgentReferralForKind('vet');
    const support = teamAgentReferralForKind('support');
    return `این تو تخصص من نیست — برای پزشکی برو پیش ${vet.name} (${vet.path}) و برای ورود/سکه/شاپ پیش ${support.name} (${support.path}).`;
  }
  if (fromKind === 'vet') {
    const trainer = teamAgentReferralForKind('trainer');
    const support = teamAgentReferralForKind('support');
    return `این تو تخصص من نیست — تربیت و فرمان را از ${trainer.name} بپرس (${trainer.path}) و پشتیبانی سایت از ${support.name} (${support.path}).`;
  }
  const trainer = teamAgentReferralForKind('trainer');
  const vet = teamAgentReferralForKind('vet');
  return `تخصص من پشتیبانی محصول است — تربیت را از ${trainer.name} بپرس (${trainer.path}) و پزشکی را از ${vet.name} (${vet.path}).`;
}
