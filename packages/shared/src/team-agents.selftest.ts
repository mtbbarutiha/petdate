/**
 * Five site personas → three domain agents + exact chat routes.
 * Run: npx tsx packages/shared/src/team-agents.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_AGENT_SLUG,
  DEFAULT_VET_TEAM_AGENT_SLUG,
  SUPPORT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
  teamAgentChatPath,
  teamAgentOutOfDomainHint,
  teamAgentReferralForKind,
} from './team-agents';

assert.equal(TEAM_AGENTS.length, 5);
assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'faranak-ahmadi');
assert.equal(DEFAULT_VET_TEAM_AGENT_SLUG, 'sara-noori');
assert.equal(SUPPORT_TEAM_AGENT_SLUG, 'yalda-shabani');

assert.equal(teamAgentChatPath('faranak-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('leila-kiani'), '/team-chat/leila-kiani');
assert.equal(teamAgentChatPath('sanaz-ghaffari'), '/team-chat/sanaz-ghaffari');
assert.equal(teamAgentChatPath('sara-noori'), '/team-chat/sara-noori');
assert.equal(teamAgentChatPath('yalda-shabani'), '/support/chat');
assert.equal(teamAgentChatPath('pasha-yazdani'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('layla-ahmadi'), '/team-chat/faranak-ahmadi');
assert.equal(teamAgentChatPath('sara-nozi'), '/team-chat/sara-noori');

assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.kind, 'trainer');
assert.equal(getTeamAgentBySlug('leila-kiani')?.kind, 'trainer');
assert.equal(getTeamAgentBySlug('sanaz-ghaffari')?.kind, 'vet');
assert.equal(getTeamAgentBySlug('sara-noori')?.kind, 'vet');
assert.equal(getTeamAgentBySlug('yalda-shabani')?.kind, 'support');

for (const a of TEAM_AGENTS) {
  assert.match(a.avatarUrl, new RegExp(`/agents/${a.slug}\\.jpg$`), `${a.slug} avatar path`);
}

const trainerRef = teamAgentReferralForKind('trainer');
assert.equal(trainerRef.path, '/team-chat/faranak-ahmadi');
assert.match(trainerRef.name, /فرانک/);
const vetRef = teamAgentReferralForKind('vet');
assert.equal(vetRef.path, '/team-chat/sara-noori');
const supportRef = teamAgentReferralForKind('support');
assert.equal(supportRef.path, '/support/chat');

const trainerOod = teamAgentOutOfDomainHint('trainer');
assert.match(trainerOod, /\/team-chat\/sara-noori/);
assert.match(trainerOod, /\/support\/chat/);
const vetOod = teamAgentOutOfDomainHint('vet');
assert.match(vetOod, /\/team-chat\/faranak-ahmadi/);
assert.match(vetOod, /\/support\/chat/);
const supportOod = teamAgentOutOfDomainHint('support');
assert.match(supportOod, /\/team-chat\/faranak-ahmadi/);
assert.match(supportOod, /\/team-chat\/sara-noori/);

console.log('team-agents.selftest: ok');
