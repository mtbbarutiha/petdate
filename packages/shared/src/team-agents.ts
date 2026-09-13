/**
 * Site team chat personas → domain AI agents (trainer | finance | support | vet).
 *
 * Authoritative public map (Mohammad, 2026-09-13):
 *   trainer → فرانک احمدی          /team-chat/faranak-ahmadi
 *   finance → لیلا کیانی           /team-chat/leila-kiani
 *   support → ساناز غفاری          /team-chat/sanaz-ghaffari
 *             یلدا شعبانی          /support/chat  (same support engine as Sanaz)
 *   vet     → دکتر سارا نوری       /team-chat/sara-noori  (only doctor)
 *
 * Grok Bot (گراک بات) engine ids are baked in so `/api/consultations/team-agents`
 * always exposes the live agent. Env `GROK_BOT_*_ID` can still override.
 */

export type TeamAgentKind = 'vet' | 'trainer' | 'support' | 'finance';

/** Live Grok Bot agent ids — one per public persona (Yalda shares Sanaz support). */
export const TEAM_AGENT_GROK_ENGINE_IDS = {
  'faranak-ahmadi': 'b6e496b5-0b15-4c9b-852d-644d3f5e411a',
  'leila-kiani': '2410554d-9496-4a60-9b15-4248dcc6e725',
  'sanaz-ghaffari': '18a4d76a-1900-49dc-964c-27d23abb31e9',
  'sara-noori': '0140b645-f844-45c1-b6d8-3f06514529de',
  'yalda-shabani': '18a4d76a-1900-49dc-964c-27d23abb31e9',
} as const;

export type TeamAgentSlug = keyof typeof TEAM_AGENT_GROK_ENGINE_IDS;

export type TeamAgentDef = {
  slug: TeamAgentSlug;
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
  /** Canonical live Grok Bot agent id. */
  grokBotId: string;
  /** Matching admin/staff username from STAFF_AGENTS — does not change chat identity. */
  staffUsername: string;
};

/** Query on /agents/*.jpg so browsers drop pepito lookalikes + the YS/yalda-v1 files. */
export const TEAM_AGENT_AVATAR_CACHE_BUST = 'persona-v2';

function agentAvatar(slug: string): string {
  return `/agents/${slug}.jpg?v=${TEAM_AGENT_AVATAR_CACHE_BUST}`;
}

/** Homepage `#team` cards — four public faces (Yalda stays on /support/chat). */
export const LANDING_TEAM_AGENT_SLUGS: readonly TeamAgentSlug[] = [
  'faranak-ahmadi',
  'leila-kiani',
  'sanaz-ghaffari',
  'sara-noori',
];

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
    grokBotId: TEAM_AGENT_GROK_ENGINE_IDS['faranak-ahmadi'],
    staffUsername: 'faranak',
  },
  {
    slug: 'leila-kiani',
    telegramId: 'petdate_ai_assistant',
    name: 'لیلا کیانی',
    role: 'مدیر مالی',
    kind: 'finance',
    avatarUrl: agentAvatar('leila-kiani'),
    cardImage: agentAvatar('leila-kiani'),
    grokBotKey: 'leila_kiani',
    grokBotId: TEAM_AGENT_GROK_ENGINE_IDS['leila-kiani'],
    staffUsername: 'leila',
  },
  {
    slug: 'sanaz-ghaffari',
    telegramId: 'petdate_ai_sanaz_ghaffari',
    name: 'ساناز غفاری',
    role: 'پشتیبانی',
    kind: 'support',
    avatarUrl: agentAvatar('sanaz-ghaffari'),
    cardImage: agentAvatar('sanaz-ghaffari'),
    grokBotKey: 'sanaz_ghaffari',
    grokBotId: TEAM_AGENT_GROK_ENGINE_IDS['sanaz-ghaffari'],
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
    grokBotId: TEAM_AGENT_GROK_ENGINE_IDS['sara-noori'],
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
    grokBotId: TEAM_AGENT_GROK_ENGINE_IDS['yalda-shabani'],
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
 * the same vet persona.
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
export const DEFAULT_TEAM_AGENT_SLUG: TeamAgentSlug = 'faranak-ahmadi';

export const SUPPORT_TEAM_AGENT_SLUG: TeamAgentSlug = 'yalda-shabani';

/** Team-chat support face (Sanaz). Yalda stays on /support/chat. */
export const TEAM_CHAT_SUPPORT_AGENT_SLUG: TeamAgentSlug = 'sanaz-ghaffari';

/** Default vet AI face when no human vet is online — only Sara. */
export const DEFAULT_VET_TEAM_AGENT_SLUG: TeamAgentSlug = 'sara-noori';

export const DEFAULT_FINANCE_TEAM_AGENT_SLUG: TeamAgentSlug = 'leila-kiani';

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

export function getTeamAgentByGrokBotId(id: string | null | undefined): TeamAgentDef | null {
  const raw = String(id || '').trim().toLowerCase();
  if (!raw) return null;
  return TEAM_AGENTS.find((a) => a.grokBotId.toLowerCase() === raw) ?? null;
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

export function landingTeamAgents(): TeamAgentDef[] {
  return LANDING_TEAM_AGENT_SLUGS.map((slug) => getTeamAgentBySlug(slug)!);
}

/** Yalda stays on the support hub; Sanaz (also support) uses team-chat. */
export function teamAgentChatPath(slug: string): string {
  const def = getTeamAgentBySlug(slug);
  if (def?.slug === SUPPORT_TEAM_AGENT_SLUG) return '/support/chat';
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
        : kind === 'finance'
          ? getTeamAgentBySlug(DEFAULT_FINANCE_TEAM_AGENT_SLUG)
          : getTeamAgentBySlug(DEFAULT_TEAM_AGENT_SLUG);
  const def = preferred ?? TEAM_AGENTS.find((a) => a.kind === kind)!;
  return { slug: def.slug, name: def.name, role: def.role, path: teamAgentChatPath(def.slug) };
}

/** Persian one-liner: «این تو تخصص من نیست» + named colleague + site path. */
export function teamAgentOutOfDomainHint(fromKind: TeamAgentKind): string {
  const trainer = teamAgentReferralForKind('trainer');
  const vet = teamAgentReferralForKind('vet');
  const support = teamAgentReferralForKind('support');
  const finance = teamAgentReferralForKind('finance');
  if (fromKind === 'trainer') {
    return `این تو تخصص من نیست — برای پزشکی برو پیش ${vet.name} (${vet.path})، برای ورود/سکه/شاپ پیش ${support.name} (${support.path}) و برای پرداخت/سکه/سفارش پیش ${finance.name} (${finance.path}).`;
  }
  if (fromKind === 'vet') {
    return `این تو تخصص من نیست — تربیت و فرمان را از ${trainer.name} بپرس (${trainer.path})، پشتیبانی سایت از ${support.name} (${support.path}) و مالی/سکه از ${finance.name} (${finance.path}).`;
  }
  if (fromKind === 'finance') {
    return `این تو تخصص من نیست — تربیت را از ${trainer.name} بپرس (${trainer.path})، پزشکی را از ${vet.name} (${vet.path}) و پشتیبانی محصول از ${support.name} (${support.path}).`;
  }
  return `تخصص من پشتیبانی محصول است — تربیت را از ${trainer.name} بپرس (${trainer.path})، پزشکی را از ${vet.name} (${vet.path}) و مالی/سکه را از ${finance.name} (${finance.path}).`;
}
