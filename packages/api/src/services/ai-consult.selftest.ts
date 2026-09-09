/**
 * AI consult offline advisor + assistant user — selftest.
 * Run: cd packages/api && npx tsx src/services/ai-consult.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-ai-consult-${process.pid}.db`;
delete process.env.AI_CONSULT_API_KEY;
delete process.env.OPENAI_API_KEY;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { offlineAiAdvice } = await import('./ai-consult');
  const { startAiFallbackConsult, isAiAssistantUserId, ensureAiAssistantUser } =
    await import('./ai-consult-session');
  const { dbService, getDb } = await import('../db');
  getDb();

  const tip = offlineAiAdvice({ kind: 'trainer', petName: 'رکس', petSpecies: 'dog' });
  assert(tip.includes('دستیار هوشمند'), 'offline trainer tip');
  const vetTip = offlineAiAdvice({ kind: 'vet', petName: 'ملوس' });
  assert(vetTip.includes('دامپزشک'), 'offline vet tip');

  const tg = `selftest_ai_patient_${Date.now()}`;
  const { user: patient } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'PatientAI',
    username: 'patient_ai',
  });
  dbService.setUserRoles(patient.id, ['pet_owner']);
  dbService.createPet({
    ownerId: patient.id,
    name: 'رکس',
    species: 'dog',
  });

  const aiUser = ensureAiAssistantUser();
  assert(isAiAssistantUserId(aiUser.id), 'ai user flagged');

  const session = await startAiFallbackConsult({
    patient,
    serviceKind: 'trainer',
  });
  assert(session, 'ai session started');
  assert(session!.consult.status === 'active', 'active consult');
  assert(session!.consult.vetUserId === aiUser.id, 'provider is AI');
  assert(session!.consult.feeCoins === 0 || session!.consult.feeCoins == null, 'free');
  const msgs = dbService.listVetConsultChatMessages(session!.consult.id);
  assert(msgs.length >= 1, 'intro message');

  const vetSession = await startAiFallbackConsult({
    patient,
    serviceKind: 'vet',
  });
  assert(vetSession, 'vet ai session');

  dbService.deleteUserByTelegramId(tg);
  console.log('ai-consult.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
