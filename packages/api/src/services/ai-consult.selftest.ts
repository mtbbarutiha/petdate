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
  const {
    startAiFallbackConsult,
    isAiAssistantUserId,
    ensureAiAssistantUser,
    decorateAiConsultDisplay,
  } = await import('./ai-consult-session');
  const { dbService, getDb } = await import('../db');
  getDb();

  const tip = offlineAiAdvice({ kind: 'trainer', petName: 'رکس', petSpecies: 'dog' });
  assert(tip.includes('پاشا یزدانی'), 'offline trainer introduces as Pasha');
  const sitTip = offlineAiAdvice({
    kind: 'trainer',
    userMessage: 'چطور بشین یاد بگیره؟',
    petName: 'رکس',
  });
  assert(sitTip.includes('بشین'), 'trainer topic hint for sit');

  const vetTip = offlineAiAdvice({ kind: 'vet', petName: 'ملوس' });
  assert(vetTip.includes('دامپزشک'), 'offline vet tip');
  const supportTip = offlineAiAdvice({ kind: 'support', userMessage: 'OTP نیومد' });
  assert(supportTip.includes('پشتیبانی'), 'offline support tip');

  const tg = `selftest_ai_patient_${Date.now()}`;
  const { user: patient } = dbService.findOrCreateUser({
    telegramId: tg,
    name: 'PatientAI',
    username: 'patient_ai',
  });
  dbService.setUserRoles(patient.id, ['pet_owner']);
  dbService.createPet({ ownerId: patient.id, name: 'رکس', species: 'dog' });

  const aiUser = ensureAiAssistantUser();
  assert(isAiAssistantUserId(aiUser.id), 'ai user flagged');

  const session = await startAiFallbackConsult({ patient, serviceKind: 'trainer' });
  assert(session, 'ai session started');
  assert(decorateAiConsultDisplay(session!.consult).vetName === 'پاشا یزدانی', 'display name');
  const msgs = dbService.listVetConsultChatMessages(session!.consult.id);
  assert(msgs[0]!.text.includes('پاشا یزدانی'), 'intro mentions Pasha');

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
