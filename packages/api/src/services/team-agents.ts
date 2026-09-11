/**
 * Ensure landing-page team AI agents exist as synthetic users with avatars.
 */
import {
  DEFAULT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
  getTeamAgentByTelegramId,
  type TeamAgentDef,
  type User,
} from '@petdate/shared';
import { dbService } from '../db';

export {
  TEAM_AGENTS,
  DEFAULT_TEAM_AGENT_SLUG,
  getTeamAgentBySlug,
  getTeamAgentByTelegramId,
};

function rolesForKind(kind: TeamAgentDef['kind'], telegramId: string): Array<'vet' | 'trainer'> {
  if (telegramId === 'petdate_ai_assistant') return ['vet', 'trainer'];
  return kind === 'vet' ? ['vet'] : ['trainer'];
}

export function ensureTeamAgent(def: TeamAgentDef): User {
  const existing = dbService.getUserByTelegramId(def.telegramId);
  if (existing) {
    const patch: {
      name?: string;
      avatarUrl?: string;
      avatarCustom?: boolean;
      avatarModerationStatus?: 'approved';
    } = {};
    if (existing.name !== def.name) patch.name = def.name;
    if (existing.avatarUrl !== def.avatarUrl) {
      patch.avatarUrl = def.avatarUrl;
      patch.avatarCustom = true;
      patch.avatarModerationStatus = 'approved';
    }
    if (Object.keys(patch).length) {
      dbService.updateUserProfile(existing.id, patch);
    }
    dbService.setUserRoles(existing.id, rolesForKind(def.kind, def.telegramId));
    return dbService.getUserById(existing.id) ?? existing;
  }

  const { user } = dbService.findOrCreateUser({
    telegramId: def.telegramId,
    name: def.name,
    username: `agent_${def.slug.replace(/-/g, '_')}`,
  });
  dbService.setUserRoles(user.id, rolesForKind(def.kind, def.telegramId));
  dbService.updateUserProfile(user.id, {
    avatarUrl: def.avatarUrl,
    avatarCustom: true,
    avatarModerationStatus: 'approved',
  });
  return dbService.getUserById(user.id) ?? user;
}

export function ensureTeamAgentBySlug(slug: string): User | null {
  const def = getTeamAgentBySlug(slug);
  if (!def) return null;
  return ensureTeamAgent(def);
}

export function ensureAllTeamAgents(): User[] {
  return TEAM_AGENTS.map((def) => ensureTeamAgent(def));
}

export function resolveTeamAgentForUserId(userId: number): TeamAgentDef | null {
  const u = dbService.getUserById(userId);
  return getTeamAgentByTelegramId(u?.telegramId);
}
