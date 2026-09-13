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
  SUPPORT_TEAM_AGENT_SLUG,
  TEAM_AGENTS,
  getTeamAgentBySlug,
  listTeamAgentsByBackend,
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
  const { guardAgentDomain } = await import('./agent-backends');
  const { knowledgePack } = await import('./agent-knowledge');

  getDb();

  assert.equal(TEAM_AGENTS.length, 5);
  assert.equal(DEFAULT_TEAM_AGENT_SLUG, 'leila-kiani');
  assert.equal(SUPPORT_TEAM_AGENT_SLUG, 'yalda-shabani');
  assert.equal(AI_TRAINER_DISPLAY_NAME, 'لیلا کیانی');
  assert.equal(getTeamAgentBySlug('leila-kiani')?.name, 'لیلا کیانی');
  assert.equal(getTeamAgentBySlug('leila-kiani')?.telegramId, 'petdate_ai_assistant');
  assert.equal(TEAM_AGENTS.filter((a) => a.telegramId === 'petdate_ai_assistant').length, 1);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'vet').length, 2);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'trainer').length, 2);
  assert.equal(TEAM_AGENTS.filter((a) => a.kind === 'support').length, 1);
  assert.equal(listTeamAgentsByBackend('vet').length, 2);
  assert.equal(listTeamAgentsByBackend('trainer').length, 2);
  assert.equal(listTeamAgentsByBackend('support').length, 1);
  assert.ok(TEAM_AGENTS.some((a) => a.name === 'دکتر سارا نوری'));
  assert.ok(TEAM_AGENTS.some((a) => a.name === 'یلدا شعبانی'));
  assert.equal(getTeamAgentBySlug('sara-noori')?.name, 'دکتر سارا نوری');
  assert.equal(getTeamAgentBySlug('sara-nozi')?.slug, 'sara-noori');
  assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.name, 'فرانک احمدی');
  assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.introSelf, true);
  assert.equal(getTeamAgentBySlug('faranak-ahmadi')?.coachStyle, 'pasha');
  assert.equal(getTeamAgentBySlug('layla-ahmadi')?.slug, 'faranak-ahmadi');
  assert.ok(
    getTeamAgentBySlug('yalda-shabani')?.avatarUrl.includes('yalda-shabani'),
    'yalda has placeholder avatar path'
  );
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

  // Domain guards
  assert.equal(guardAgentDomain('vet', 'چطور بشین یاد بگیره؟').ok, false);
  assert.equal(guardAgentDomain('trainer', 'تب و استفراغ داره').ok, false);
  assert.equal(guardAgentDomain('support', 'نسخه آنتی‌بیوتیک بده').ok, false);
  assert.equal(guardAgentDomain('vet', 'تب و استفراغ داره').ok, true);
  assert.equal(guardAgentDomain('trainer', 'چطور بشین یاد بگیره؟').ok, true);
  assert.equal(guardAgentDomain('support', 'OTP نیومد').ok, true);
  assert.ok(knowledgePack('vet').bullets.length >= 3);
  assert.ok(knowledgePack('trainer').bullets.length >= 3);
  assert.ok(knowledgePack('support').bullets.length >= 3);

  const users = ensureAllTeamAgents();
  assert.equal(users.length, 5);
  const leila = ensureAiAssistantUser();
  assert.equal(leila.name, 'لیلا کیانی');
  assert.ok(!leila.name.startsWith('دکتر'));
  assert.ok(isAiAssistantUserId(leila.id));
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

  const yalda = ensureTeamAgentBySlug('yalda-shabani')!;
  assert.equal(yalda.name, 'یلدا شعبانی');
  assert.equal(yalda.username, 'agent_yalda_shabani');
  assert.ok(yalda.avatarUrl?.includes('yalda-shabani'));
  assert.ok(isAiAssistantUserId(yalda.id));

  const { getTeamAgentByName } = await import('@petdate/shared');
  assert.equal(getTeamAgentByName('لیلا کیانی')?.slug, 'leila-kiani');
  assert.equal(getTeamAgentByName('پاشا یزدانی')?.slug, 'leila-kiani');
  assert.equal(getTeamAgentByName('فرانک احمدی')?.avatarUrl?.includes('faranak-ahmadi'), true);
  assert.equal(getTeamAgentByName('دکتر ساناز غفاری')?.slug, 'sanaz-ghaffari');
  assert.equal(getTeamAgentByName('دکتر سارا نوزی')?.slug, 'sara-noori');
  assert.equal(getTeamAgentByName('یلدا شعبانی')?.slug, 'yalda-shabani');

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

  const supportSession = await startTeamAgentConsult({ patient, agentSlug: 'yalda-shabani' });
  assert.ok(supportSession);
  assert.equal(supportSession!.consult.vetUserId, yalda.id);
  assert.equal(supportSession!.consult.serviceKind, 'support');
  assert.equal(decorateAiConsultDisplay(supportSession!.consult).vetName, 'یلدا شعبانی');
  assert.match(supportSession!.advice, /یلدا شعبانی|پشتیبانی/);

  const faranakSession = await startTeamAgentConsult({ patient, agentSlug: 'faranak-ahmadi' });
  assert.ok(faranakSession);
  assert.match(faranakSession!.advice, /من فرانک احمدی هستم/);

  console.log('team-agents.selftest: ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
