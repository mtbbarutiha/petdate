import { getTeamAgentBySlug, SUPPORT_TEAM_AGENT_SLUG } from '@petdate/shared';

const support = getTeamAgentBySlug(SUPPORT_TEAM_AGENT_SLUG);

/** Canonical support AI agent — ساناز غفاری. */
export const AI_ASSISTANT_DISPLAY_NAME = support?.name ?? 'ساناز غفاری';
export const AI_SUPPORT_AVATAR_URL =
  support?.avatarUrl ?? '/agents/sanaz-ghaffari-480.webp?v=persona-v4';
