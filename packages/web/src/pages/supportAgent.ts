import { getTeamAgentBySlug, SUPPORT_TEAM_AGENT_SLUG } from '@petdate/shared';

const support = getTeamAgentBySlug(SUPPORT_TEAM_AGENT_SLUG);

/** Canonical support AI agent — یلدا شعبانی. */
export const AI_ASSISTANT_DISPLAY_NAME = support?.name ?? 'یلدا شعبانی';
export const AI_SUPPORT_AVATAR_URL = support?.avatarUrl ?? '/agents/yalda-shabani.jpg?v=persona-v2';
