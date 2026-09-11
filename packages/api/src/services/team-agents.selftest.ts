import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
} from '@petdate/shared';
import { dbService, getDb } from '../db';
import { ensureAllTeamAgents, ensureTeamAgentBySlug } from './team-agents';
import {
  decorateAiConsultDisplay,
  ensureAiAssistantUser,
  isAiAssistantUserId,
  startTeamAgentConsult,
} from './ai-consult-session';
import { AI_TRAINER_DISPLAY_NAME } from './ai-consult';

getDb();

async function main() {
  assert.equal(TEAM_AGENTS.length, 4);
  assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'leila-kiani');
  assert.equal(AI_TRAINER_DISPLAY_NAME, 'دکتر لیلا کیانی');
  assert.equal(getTeamAgentBySlug('leila-kiani')?.telegramId, 'petdate_ai_assistant');
  assert.equal(TEAM_AGENTS.filter((a) => a.telegramId === 'petdate_ai_assistant').length, 1);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'vet').length, 2);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'trainer').length, 2);
  assert.ok(TEAM_AGENTS.some((a) => a.name === 'دکتر سارا نوزی'));

  const users = ensureAllTeamAgents();
  assert.equal(users.length, 4);
  const leila = ensureAiAssistantUser();
  assert.equal(leila.name, 'دکتر لیلا کیانی');
  assert.ok(isAiAssistantUserId(leila.id));
  assert.ok(leila.avatarUrl?.includes('leila-kiani'));

  const sara = ensureTeamAgentBySlug('sara-nozi')!;
  assert.equal(sara.name, 'دکتر سارا نوزی');
  assert.ok(isAiAssistantUserId(sara.id));

  const tg = `selftest_team_${Date.now()}`;
  const { user: patient } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'TeamPatient',
    username: 'team_patient',
  });
  dbService.setUserRoles(patient.id, ['pet_owner']);
  dbService.createPet({ ownerId: patient.id, name: 'پلو', species: 'dog' });

  const session = await startTeamAgentConsult({ patient, agentSlug: 'sara-nozi' });
  assert.ok(session);
  assert.equal(session!.consult.vetUserId, sara.id);
  assert.equal(decorateAiConsultDisplay(session!.consult).vetName, 'دکتر سارا نوزی');
  const reuse = await startTeamAgentConsult({ patient, agentSlug: 'sara-nozi' });
  assert.equal(reuse!.consult.id, session!.consult.id);
  assert.equal(reuse!.reused, true);
  console.log('team-agents.selftest: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
