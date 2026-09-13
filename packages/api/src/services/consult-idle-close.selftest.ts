/**
 * consult idle policy:
 * - human↔human: never auto-close
 * - AI agent: 3 offline nudges every VET_CONSULT_IDLE_CLOSE_MS, then close
 * Run: cd packages/api && npx tsx src/services/consult-idle-close.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-consult-idle-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    VET_CONSULT_IDLE_CLOSE_MESSAGE_FA,
    VET_CONSULT_IDLE_CLOSE_MS,
    VET_CONSULT_IDLE_NUDGE_MAX,
    VET_CONSULT_IDLE_NUDGE_MESSAGE_FA,
  } = await import('@petdate/shared');

  assert(VET_CONSULT_IDLE_CLOSE_MS === 5 * 60_000, 'idle window is 5 minutes');
  assert(VET_CONSULT_IDLE_NUDGE_MAX === 3, '3 nudges before close');
  assert(/آنلاین نیستی|اینجایی/.test(VET_CONSULT_IDLE_NUDGE_MESSAGE_FA), 'nudge copy');
  assert(/بسته شد|وصل شو/.test(VET_CONSULT_IDLE_CLOSE_MESSAGE_FA), 'close copy');

  const { dbService, getDb } = await import('../db');
  const {
    closeOneIdleConsult,
    processOneIdleConsult,
    sweepIdleConsultClosures,
    isAiAgentConsult,
  } = await import('./consult-idle-close');
  const { ensureAiAssistantUser, isAiAssistantUserId } = await import(
    './ai-consult-session'
  );

  getDb();
  const stamp = Date.now();

  const { user: humanPatient } = dbService.findOrCreateUser({
    telegramId: `idle_patient_${stamp}`,
    name: 'IdlePatient',
    username: `idle_patient_${stamp}`,
  });
  const { user: humanVet } = dbService.findOrCreateUser({
    telegramId: `idle_vet_${stamp}`,
    name: 'IdleVet',
    username: `idle_vet_${stamp}`,
  });
  dbService.setUserRoles(humanVet.id, ['vet']);
  dbService.setUserRoles(humanPatient.id, ['pet_owner']);

  const humanFresh = dbService.createVetConsultation({
    vetUserId: humanVet.id,
    patientUserId: humanPatient.id,
    status: 'active',
    notes: 'idle-selftest-human-fresh',
    serviceKind: 'vet',
    feeCoins: 0,
  });
  assert(!isAiAgentConsult(humanFresh), 'human consult is not AI');
  assert(
    !dbService.listIdleActiveVetConsultIds(60_000).includes(humanFresh.id),
    'fresh human not idle'
  );

  // Force human consult idle, then process — must NOT nudge/close.
  dbService
    .prepare?.(
      `UPDATE vet_consultations SET patient_last_activity_at = datetime('now', '-10 minutes') WHERE id = ?`
    );
  // use raw via getDb
  const { getDb: gdb } = await import('../db');
  gdb()
    .prepare(
      `UPDATE vet_consultations SET patient_last_activity_at = datetime('now', '-10 minutes') WHERE id = ?`
    )
    .run(humanFresh.id);

  assert(
    dbService.listIdleActiveVetConsultIds(60_000).includes(humanFresh.id),
    'stale human listed idle by time'
  );
  assert(
    processOneIdleConsult(humanFresh.id, 60_000) === false,
    'human↔human must not auto-process'
  );
  assert(closeOneIdleConsult(humanFresh.id) === false, 'human↔human must not auto-close');
  const humanStill = dbService.getVetConsultation(humanFresh.id)!;
  assert(humanStill.status === 'active' && !humanStill.chatEnded, 'human stays open');

  // AI consult nudges then closes.
  const aiUser = ensureAiAssistantUser();
  assert(isAiAssistantUserId(aiUser.id), 'AI assistant flagged');
  const { user: aiPatient } = dbService.findOrCreateUser({
    telegramId: `idle_ai_patient_${stamp}`,
    name: 'IdleAiPatient',
    username: `idle_ai_patient_${stamp}`,
  });
  dbService.setUserRoles(aiPatient.id, ['pet_owner']);
  const aiConsult = dbService.createVetConsultation({
    vetUserId: aiUser.id,
    patientUserId: aiPatient.id,
    status: 'active',
    notes: 'idle-selftest-ai',
    serviceKind: 'trainer',
    feeCoins: 0,
  });
  assert(isAiAgentConsult(aiConsult), 'AI consult detected');
  gdb()
    .prepare(
      `UPDATE vet_consultations SET patient_last_activity_at = datetime('now', '-10 minutes') WHERE id = ?`
    )
    .run(aiConsult.id);

  assert(processOneIdleConsult(aiConsult.id, 60_000), 'nudge 1');
  let ai = dbService.getVetConsultation(aiConsult.id)!;
  assert((ai.idleNudgeCount ?? 0) === 1, 'nudge count 1');
  assert(ai.status === 'active' && !ai.chatEnded, 'still open after nudge 1');

  // Fresh nudge window — skip
  assert(processOneIdleConsult(aiConsult.id, 60_000) === false, 'skip while nudge fresh');

  // Age the nudge timestamp so next nudge is allowed
  gdb()
    .prepare(
      `UPDATE vet_consultations SET idle_nudge_at = datetime('now', '-10 minutes') WHERE id = ?`
    )
    .run(aiConsult.id);
  assert(processOneIdleConsult(aiConsult.id, 60_000), 'nudge 2');
  ai = dbService.getVetConsultation(aiConsult.id)!;
  assert((ai.idleNudgeCount ?? 0) === 2, 'nudge count 2');

  gdb()
    .prepare(
      `UPDATE vet_consultations SET idle_nudge_at = datetime('now', '-10 minutes') WHERE id = ?`
    )
    .run(aiConsult.id);
  assert(processOneIdleConsult(aiConsult.id, 60_000), 'nudge 3 + close');
  ai = dbService.getVetConsultation(aiConsult.id)!;
  assert(ai.status === 'completed' && ai.chatEnded === true, 'AI closed after 3 nudges');

  const msgs = dbService.listVetConsultChatMessages(aiConsult.id, { limit: 20 });
  const texts = msgs.map((m) => m.text);
  assert(
    texts.filter((t) => t.includes('آنلاین نیستی') || t.includes('اینجایی')).length >= 3,
    'three offline nudges posted'
  );
  assert(
    texts.some((t) => /بسته شد/.test(t)),
    'closing notice posted'
  );

  // Patient activity resets nudge counter
  const ai2 = dbService.createVetConsultation({
    vetUserId: aiUser.id,
    patientUserId: aiPatient.id,
    status: 'active',
    notes: 'idle-selftest-ai-reset',
    serviceKind: 'trainer',
    feeCoins: 0,
  });
  gdb()
    .prepare(
      `UPDATE vet_consultations
       SET patient_last_activity_at = datetime('now', '-10 minutes'),
           idle_nudge_count = 2,
           idle_nudge_at = datetime('now', '-10 minutes')
       WHERE id = ?`
    )
    .run(ai2.id);
  assert(dbService.touchVetConsultPatientActivity(ai2.id), 'touch ok');
  const reset = dbService.getVetConsultation(ai2.id)!;
  assert((reset.idleNudgeCount ?? 0) === 0, 'touch clears nudge count');

  const swept = sweepIdleConsultClosures(60_000);
  assert(typeof swept === 'number', 'sweep returns count');

  console.log('consult-idle-close.selftest: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
