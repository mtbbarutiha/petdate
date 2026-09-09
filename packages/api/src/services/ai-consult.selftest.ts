/**
 * AI consult offline advisor + assistant user + support thread — selftest.
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
  const { offlineAiAdvice, generateAiConsultAdvice } = await import('./ai-consult');
  const { startAiFallbackConsult, isAiAssistantUserId, ensureAiAssistantUser } =
    await import('./ai-consult-session');
  const { dbService, getDb } = await import('../db');
  getDb();

  const tip = offlineAiAdvice({ kind: 'trainer', petName: 'رکس', petSpecies: 'dog' });
  assert(tip.includes('دستیار هوشمند'), 'offline trainer tip');
  const vetTip = offlineAiAdvice({ kind: 'vet', petName: 'ملوس' });
  assert(vetTip.includes('دامپزشک'), 'offline vet tip');
  const supportTip = offlineAiAdvice({ kind: 'support', userMessage: 'OTP نیومد' });
  assert(supportTip.includes('پشتیبانی'), 'offline support tip');
  assert(supportTip.includes('OTP') || supportTip.includes('ورود'), 'support mentions topic');

  const generated = await generateAiConsultAdvice({
    kind: 'support',
    patientName: 'تست',
    userMessage: 'چطور پت ثبت کنم؟',
  });
  assert(generated.source === 'offline', 'no key → offline');
  assert(generated.text.includes('پشتیبانی') || generated.text.includes('پت'), 'support advice');

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

  // Support chat persistence
  assert(dbService.listSupportMessages(patient.id).length === 0, 'empty support thread');
  const uMsg = dbService.addSupportMessage(patient.id, 'user', 'سلام؛ شاپ کار نمی‌کنه');
  const aMsg = dbService.addSupportMessage(
    patient.id,
    'assistant',
    offlineAiAdvice({ kind: 'support', userMessage: 'شاپ کار نمی‌کنه' })
  );
  const supportMsgs = dbService.listSupportMessages(patient.id);
  assert(supportMsgs.length === 2, 'two support messages');
  assert(supportMsgs[0]!.id === uMsg.id && supportMsgs[0]!.role === 'user', 'user first');
  assert(supportMsgs[1]!.id === aMsg.id && supportMsgs[1]!.role === 'assistant', 'assistant second');

  const turn1 = await generateAiConsultAdvice({
    kind: 'support',
    patientName: 'تست',
    userMessage: 'OTP نمیاد',
    history: [],
  });
  const turn2 = await generateAiConsultAdvice({
    kind: 'support',
    patientName: 'تست',
    userMessage: 'بیشتر توضیح بده',
    history: [
      { role: 'user', content: 'OTP نمیاد' },
      { role: 'assistant', content: turn1.text },
    ],
  });
  assert(turn1.text !== turn2.text, 'follow-up differs from first reply');
  assert(turn2.text.includes('OTP') || turn2.text.includes('پیامک'), 'follow-up stays on topic');

  for (let i = 0; i < 25; i++) {
    dbService.addSupportMessage(patient.id, 'user', `msg ${i}`);
    dbService.addSupportMessage(patient.id, 'assistant', `reply ${i}`);
  }
  const recent = dbService.listSupportMessages(patient.id, 4);
  assert(recent.length === 4, 'recent limit');
  assert(recent[0]!.text === 'msg 23', 'oldest of recent window');
  assert(recent[3]!.text === 'reply 24', 'newest message in window');

  dbService.deleteUserByTelegramId(tg);
  console.log('ai-consult.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
