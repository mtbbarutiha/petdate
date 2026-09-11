/**
 * consult idle-close — 1 min without patient typing/messages → notice + completed.
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
  } = await import('@petdate/shared');
  assert(VET_CONSULT_IDLE_CLOSE_MS === 60_000, 'idle window is 1 minute');
  assert(
    /آنلاین نیستی|می‌بندم/.test(VET_CONSULT_IDLE_CLOSE_MESSAGE_FA),
    'Persian close copy'
  );

  const { dbService, getDb } = await import('../db');
  const { closeOneIdleConsult, sweepIdleConsultClosures } = await import(
    './consult-idle-close'
  );
  getDb();

  const stamp = Date.now();
  const patient = dbService.findOrCreateUser({
    telegramId: `idle_patient_${stamp}`,
    name: 'Idle Patient',
    username: `idle_patient_${stamp}`,
  }).user;
  const vet = dbService.findOrCreateUser({
    telegramId: `idle_vet_${stamp}`,
    name: 'Idle Vet',
    username: `idle_vet_${stamp}`,
  }).user;
  assert(patient?.id && vet?.id, 'users');

  const fresh = dbService.createVetConsultation({
    vetUserId: vet.id,
    patientUserId: patient.id,
    status: 'active',
    serviceKind: 'vet',
    notes: 'idle-selftest-fresh',
  });
  assert(fresh.status === 'active', 'fresh active');
  assert(!fresh.chatEnded, 'fresh not ended');

  // Not idle yet — activity is "now"
  assert(
    dbService.listIdleActiveVetConsultIds(60_000).includes(fresh.id) === false,
    'fresh consult must not be idle'
  );

  const stale = dbService.createVetConsultation({
    vetUserId: vet.id,
    patientUserId: patient.id,
    status: 'active',
    serviceKind: 'trainer',
    notes: 'idle-selftest-stale',
  });

  // Force patient activity into the past (SQLite datetime).
  getDb()
    .prepare(
      `UPDATE vet_consultations
       SET patient_last_activity_at = datetime('now', '-120 seconds')
       WHERE id = ?`
    )
    .run(stale.id);

  const idleIds = dbService.listIdleActiveVetConsultIds(60_000);
  assert(idleIds.includes(stale.id), 'stale consult listed as idle');
  assert(!idleIds.includes(fresh.id), 'fresh still excluded');

  // Typing / message touch keeps session open
  assert(dbService.touchVetConsultPatientActivity(stale.id), 'touch ok');
  assert(
    !dbService.listIdleActiveVetConsultIds(60_000).includes(stale.id),
    'touch clears idle'
  );

  getDb()
    .prepare(
      `UPDATE vet_consultations
       SET patient_last_activity_at = datetime('now', '-120 seconds')
       WHERE id = ?`
    )
    .run(stale.id);

  const closedOk = closeOneIdleConsult(stale.id);
  assert(closedOk, 'closeOneIdleConsult returns true');
  const after = dbService.getVetConsultation(stale.id);
  assert(after?.status === 'completed', 'status completed');
  assert(after?.chatEnded === true, 'chatEnded true');

  const msgs = dbService.listVetConsultChatMessages(stale.id);
  assert(
    msgs.some((m) => m.text.includes('می‌بندم') || m.text.includes('آنلاین')),
    'closing notice persisted'
  );

  // Idempotent — already closed
  assert(closeOneIdleConsult(stale.id) === false, 'second close is no-op');

  // Sweep should close the other stale path via message-only fallback
  const msgOnly = dbService.createVetConsultation({
    vetUserId: vet.id,
    patientUserId: patient.id,
    status: 'active',
    serviceKind: 'vet',
    notes: 'idle-msg-fallback',
  });
  dbService.createVetConsultChatMessage({
    consultId: msgOnly.id,
    senderUserId: patient.id,
    text: 'سلام',
  });
  // Clear explicit activity column so fallback uses last patient message time
  getDb()
    .prepare(
      `UPDATE vet_consultations SET patient_last_activity_at = NULL WHERE id = ?`
    )
    .run(msgOnly.id);
  getDb()
    .prepare(
      `UPDATE vet_consult_chat_messages
       SET created_at = datetime('now', '-120 seconds')
       WHERE consult_id = ?`
    )
    .run(msgOnly.id);

  const swept = sweepIdleConsultClosures(60_000);
  assert(swept >= 1, 'sweep closed at least one');
  const msgOnlyAfter = dbService.getVetConsultation(msgOnly.id);
  assert(msgOnlyAfter?.chatEnded === true, 'message-fallback idle closed');
  assert(msgOnlyAfter?.status === 'completed', 'message-fallback completed');

  // Fresh must still be open
  const stillFresh = dbService.getVetConsultation(fresh.id);
  assert(stillFresh?.status === 'active' && !stillFresh.chatEnded, 'fresh stays open');

  // AI agent consults (لیلا / team agents) also idle-close after 1 minute.
  const { ensureAiAssistantUser, isAiAssistantUserId } = await import(
    './ai-consult-session'
  );
  const aiUser = ensureAiAssistantUser();
  assert(isAiAssistantUserId(aiUser.id), 'AI assistant flagged');
  const aiPatient = dbService.findOrCreateUser({
    telegramId: `idle_ai_patient_${stamp}`,
    name: 'AI Idle Patient',
    username: `idle_ai_patient_${stamp}`,
  }).user;
  assert(aiPatient?.id, 'ai patient');
  const aiStale = dbService.createVetConsultation({
    vetUserId: aiUser.id,
    patientUserId: aiPatient.id,
    status: 'active',
    serviceKind: 'trainer',
    notes: 'idle-selftest-ai-agent',
    feeCoins: 0,
    providerShareCoins: 0,
  });
  getDb()
    .prepare(
      `UPDATE vet_consultations
       SET patient_last_activity_at = datetime('now', '-120 seconds')
       WHERE id = ?`
    )
    .run(aiStale.id);
  assert(
    dbService.listIdleActiveVetConsultIds(60_000).includes(aiStale.id),
    'AI consult listed as idle'
  );
  assert(closeOneIdleConsult(aiStale.id), 'AI idle close ok');
  const aiAfter = dbService.getVetConsultation(aiStale.id);
  assert(aiAfter?.status === 'completed', 'AI status completed (not active)');
  assert(aiAfter?.chatEnded === true, 'AI chatEnded true');

  console.log('consult-idle-close.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
