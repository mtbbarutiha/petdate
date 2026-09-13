/**
 * Bridge: Grok Bot (گراک بات / «گراگ بات») roster ↔ petdate TEAM_AGENTS.
 *
 * Four public personas: trainer / finance / support / vet.
 * Optional env links (share id / URL) mark a persona as externally connected
 * without creating a parallel chat system — consult still goes through ai-consult
 * (xAI/Grok model + domain system prompt when bot id missing, e.g. finance).
 *
 * Known VPS domain IDs (remap by role):
 *   GROK_BOT_FARANAK_AHMADI_ID=b6e496b5-0b15-4c9b-852d-644d3f5e411a  (trainer)
 *   GROK_BOT_SARA_NOORI_ID=0140b645-f844-45c1-b6d8-3f06514529de      (vet)
 *   GROK_BOT_SANAZ_GHAFFARI_ID=18a4d76a-1900-49dc-964c-27d23abb31e9  (support)
 *   GROK_BOT_LEILA_KIANI_ID=…  (finance — provide when available)
 *
 * Or JSON map:
 *   GROK_BOT_AGENT_MAP={"faranak_ahmadi":{"id":"…"},"sara_noori":{"id":"…"},…}
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

function envKeyFor(def: TeamAgentDef): string {
  return def.grokBotKey.toUpperCase();
}

/** Resolve optional Grok Bot id/url for one team persona. */
export function resolveGrokBotLink(def: TeamAgentDef): GrokBotLink {
  const map = parseAgentMap();
  const fromMap = map[def.grokBotKey] || map[def.slug.replace(/-/g, '_')];
  const suffix = envKeyFor(def);
  const id =
    String(process.env[`GROK_BOT_${suffix}_ID`] || fromMap?.id || '').trim() || null;
  const url =
    String(process.env[`GROK_BOT_${suffix}_URL`] || fromMap?.url || '').trim() || null;
  return { id, url, linked: Boolean(id || url) };
}

export function listTeamAgentsWithGrokBridge(): TeamAgentPublicWithGrok[] {
  return TEAM_AGENTS.map((a) => ({
    slug: a.slug,
    name: a.name,
    role: a.role,
    kind: a.kind,
    avatarUrl: a.avatarUrl,
    chatPath: teamAgentChatPath(a.slug),
    grokBotKey: a.grokBotKey,
    grokBot: resolveGrokBotLink(a),
  }));
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
