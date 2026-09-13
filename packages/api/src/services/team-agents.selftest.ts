/**
 * Team agents selftest — temp SQLite (never touches production DATABASE_*).
 * Run: cd packages/api && npx tsx src/services/team-agents.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-team-agents-${process.pid}.db`;

import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
} from '@petdate/shared';

async function main() {
  const { dbService, getDb } = await import('../db');
  const { ensureAllTeamAgents, ensureTeamAgentBySlug } = await import('./team-agents');
  const {
    decorateAiConsultDisplay,
    ensureAiAssistantUser,
    isAiAssistantUserId,
    startTeamAgentConsult,
  } = await import('./ai-consult-session');
  const { AI_TRAINER_DISPLAY_NAME } = await import('./ai-consult');

  getDb();

  assert.equal(TEAM_AGENTS.length, 5);
  assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'faranak-ahmadi');
  assert.equal(AI_TRAINER_DISPLAY_NAME, 'فرانک احمدی');
  assert.equal(getTeamAgentBySlug('leila-kiani')?.name, 'لیلا کیانی');
  assert.equal(getTeamAgentBySlug('leila-kiani')?.telegramId, 'petdate_ai_assistant');
  assert.equal(TEAM_AGENTS.filter((a) => a.telegramId === 'petdate_ai_assistant').length, 1);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'vet').length, 2);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'trainer').length, 2);
  assert.ok(TEAM_AGENTS.some((a) => a.name === 'دکتر سارا نوری'));
  assert.equal(getTeamAgentBySlug('sara-noori')?.name, 'دکتر سارا نوری');
  assert.equal(getTeamAgentBySlug('sara-nozi')?.slug, 'sara-noori');
  assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.name, 'فرانک احمدی');
  assert.equal(getTeamAgentBySlug('layla-ahmadi')?.slug, 'faranak-ahmadi');
  assert.ok(
    !TEAM_AGENTS.some(
      (a) =>
        a.name.includes('لایلا') ||
        a.name.includes('نوزی') ||
        a.name.startsWith('دکتر فرانک') ||
        a.name === 'دکتر لیلا کیانی' ||
        (a.kind === 'trainer' && a.name.startsWith('دکتر ')),
    ),
  );

  const users = ensureAllTeamAgents();
  assert.equal(users.length, 5);
  const faranakDefault = ensureAiAssistantUser();
  assert.equal(faranakDefault.name, 'فرانک احمدی');
  assert.ok(!faranakDefault.name.startsWith('دکتر'));
  assert.ok(isAiAssistantUserId(faranakDefault.id));
  assert.ok(faranakDefault.avatarUrl?.includes('faranak-ahmadi'));

  const leila = ensureTeamAgentBySlug('leila-kiani')!;
  assert.equal(leila.name, 'لیلا کیانی');
  assert.ok(leila.avatarUrl?.includes('leila-kiani'));

  const faranak = ensureTeamAgentBySlug('faranak-ahmadi')!;
  assert.equal(faranak.name, 'فرانک احمدی');
  assert.equal(faranak.username, 'agent_faranak_ahmadi');
  assert.ok(faranak.avatarUrl?.includes('faranak-ahmadi'));
  assert.ok(isAiAssistantUserId(faranak.id));

  // Legacy slug still ensures the same synthetic user (rename patch).
  const viaAlias = ensureTeamAgentBySlug('layla-ahmadi')!;
  assert.equal(viaAlias.id, faranak.id);
  assert.equal(viaAlias.name, 'فرانک احمدی');

  const sara = ensureTeamAgentBySlug('sara-noori')!;
  assert.equal(sara.name, 'دکتر سارا نوری');
  assert.equal(sara.username, 'agent_sara_noori');
  assert.ok(sara.avatarUrl?.includes('sara-noori'));
  assert.ok(isAiAssistantUserId(sara.id));

  const { getTeamAgentByName } = await import('@petdate/shared');
  assert.equal(getTeamAgentByName('لیلا کیانی')?.slug, 'leila-kiani');
  assert.equal(getTeamAgentByName('پاشا یزدانی')?.slug, 'faranak-ahmadi');
  assert.equal(getTeamAgentByName('فرانک احمدی')?.avatarUrl?.includes('faranak-ahmadi'), true);
  assert.equal(getTeamAgentByName('دکتر ساناز غفاری')?.slug, 'sanaz-ghaffari');
  assert.equal(getTeamAgentByName('دکتر سارا نوزی')?.slug, 'sara-noori');

  const saraViaAlias = ensureTeamAgentBySlug('sara-nozi')!;
  assert.equal(saraViaAlias.id, sara.id);
  assert.equal(saraViaAlias.name, 'دکتر سارا نوری');

  const tg = `selftest_team_${Date.now()}`;
  const { user: patient } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'TeamPatient',
    username: 'team_patient',
  });
  dbService.setUserRoles(patient.id, ['pet_owner']);
  dbService.createPet({ ownerId: patient.id, name: 'پلو', species: 'dog' });

  const session = await startTeamAgentConsult({ patient, agentSlug: 'sara-noori' });
  assert.ok(session);
  assert.equal(session!.consult.vetUserId, sara.id);
  assert.equal(decorateAiConsultDisplay(session!.consult).vetName, 'دکتر سارا نوری');
  assert.ok(
    decorateAiConsultDisplay(session!.consult).vetAvatarUrl?.includes('sara-noori'),
    'decorate includes team avatar',
  );
  const reuse = await startTeamAgentConsult({ patient, agentSlug: 'sara-nozi' });
  assert.equal(reuse!.consult.id, session!.consult.id);
  assert.equal(reuse!.reused, true);
  const yalda = ensureTeamAgentBySlug('yalda-shabani')!;
  assert.equal(yalda.name, 'یلدا شعبانی');
  assert.ok(yalda.avatarUrl?.includes('yalda-shabani'));
  assert.equal(getTeamAgentBySlug('yalda-shabani')?.kind, 'support');
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'support').length, 1);

  const supportAttempt = await startTeamAgentConsult({ patient, agentSlug: 'yalda-shabani' });
  assert.equal(supportAttempt, null);

  console.log('team-agents.selftest: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
