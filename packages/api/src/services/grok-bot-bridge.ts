/**
 * Bridge: Grok Bot (گراک بات / «گراگ بات») roster ↔ petdate TEAM_AGENTS.
 *
 * Mohammad’s Grok Bot teammates map 1:1 onto site personas.
 * Each persona has a baked-in live engine id (`grokBotId`). Public `grokBot.id`
 * always equals that id — stale VPS `GROK_BOT_*_ID` / map remaps are ignored.
 * Optional env still supplies `grokBot.url` only.
 * Consult still goes through ai-consult with that persona’s kind/prompt.
 *
 * Per-agent URL (id keys are ignored so leftover trainer/vet remaps cannot
 * leak into GET /api/consultations/team-agents):
 *   GROK_BOT_FARANAK_AHMADI_URL=https://x.ai/…
 * Or JSON map:
 *   GROK_BOT_AGENT_MAP={"faranak_ahmadi":{"url":"…"},…}
 */
import {
  TEAM_AGENTS,
  getTeamAgentByGrokBotKey,
  getTeamAgentBySlug,
  teamAgentChatPath,
  type TeamAgentDef,
  type TeamAgentKind,
} from '@petdate/shared';

export type GrokBotLink = {
  id: string | null;
  url: string | null;
  /** True when id or url is configured for this persona. */
  linked: boolean;
};

export type TeamAgentPublicWithGrok = {
  slug: string;
  name: string;
  role: string;
  kind: TeamAgentKind;
  avatarUrl: string;
  chatPath: string;
  grokBotKey: string;
  grokBotId: string;
  grokBot: GrokBotLink;
};

type MapEntry = { id?: string; url?: string };

function parseAgentMap(): Record<string, MapEntry> {
  const raw = String(process.env.GROK_BOT_AGENT_MAP || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, MapEntry | string>;
    const out: Record<string, MapEntry> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      const key = String(k).trim().toLowerCase().replace(/-/g, '_');
      if (!key) continue;
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) continue;
        out[key] = /^https?:\/\//i.test(s) ? { url: s } : { id: s };
      } else if (v && typeof v === 'object') {
        out[key] = {
          id: v.id != null ? String(v.id).trim() || undefined : undefined,
          url: v.url != null ? String(v.url).trim() || undefined : undefined,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function envSuffixesFor(def: TeamAgentDef): string[] {
  const suffixes = new Set<string>([def.grokBotKey.toUpperCase(), def.slug.replace(/-/g, '_').toUpperCase()]);
  // Legacy Sara typo (نوزی) — same vet persona as sara_noori.
  if (def.slug === 'sara-noori') suffixes.add('SARA_NOZI');
  return [...suffixes];
}

function firstEnv(suffixes: string[], kind: 'ID' | 'URL'): string | null {
  for (const suffix of suffixes) {
    const v = String(process.env[`GROK_BOT_${suffix}_${kind}`] || '').trim();
    if (v) return v;
  }
  return null;
}

/** Resolve Grok Bot link for one team persona. `id` is always the baked grokBotId. */
export function resolveGrokBotLink(def: TeamAgentDef): GrokBotLink {
  const map = parseAgentMap();
  const fromMap =
    map[def.grokBotKey] ||
    map[def.slug.replace(/-/g, '_')] ||
    (def.slug === 'sara-noori' ? map.sara_nozi : undefined);
  const suffixes = envSuffixesFor(def);
  // Public id is the persona’s baked engine — never another teammate’s leftover env remap.
  const id = def.grokBotId || null;
  const url = firstEnv(suffixes, 'URL') || (fromMap?.url != null ? String(fromMap.url).trim() : '') || null;
  return { id: id || null, url: url || null, linked: Boolean(id || url) };
}

export function listTeamAgentsWithGrokBridge(): TeamAgentPublicWithGrok[] {
  return TEAM_AGENTS.map((a) => {
    const link = resolveGrokBotLink(a);
    return {
      slug: a.slug,
      name: a.name,
      role: a.role,
      kind: a.kind,
      avatarUrl: a.avatarUrl,
      chatPath: teamAgentChatPath(a.slug),
      grokBotKey: a.grokBotKey,
      grokBotId: a.grokBotId,
      grokBot: { ...link, id: a.grokBotId, linked: Boolean(a.grokBotId || link.url) },
    };
  });
}

/** Lookup site persona from a Grok Bot key / slug / Persian name fragment. */
export function resolveTeamAgentFromGrokRef(ref: string | null | undefined): TeamAgentDef | null {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  return (
    getTeamAgentByGrokBotKey(raw) ||
    getTeamAgentBySlug(raw) ||
    null
  );
}

export function grokBotBridgeSummary(): {
  source: 'grok_bot';
  rosterSize: number;
  linkedCount: number;
  agents: TeamAgentPublicWithGrok[];
} {
  const agents = listTeamAgentsWithGrokBridge();
  return {
    source: 'grok_bot',
    rosterSize: agents.length,
    linkedCount: agents.filter((a) => a.grokBot.linked).length,
    agents,
  };
}
