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
  const {
    offlineAiAdvice,
    generateAiConsultAdvice,
    trainerTopicHint,
    trainerTypingDelayMs,
    buildTrainerOpeningGreeting,
    speciesLabelFa,
  } = await import('./ai-consult');
  const {
    startAiFallbackConsult,
    isAiAssistantUserId,
    ensureAiAssistantUser,
    decorateAiConsultDisplay,
  } = await import('./ai-consult-session');
  const { dbService, getDb } = await import('../db');
  getDb();

  assert(speciesLabelFa('dog') === 'سگ', 'dog → سگ');
  assert(speciesLabelFa('DOG') === 'سگ', 'DOG → سگ');
  assert(speciesLabelFa('cat') === 'گربه', 'cat → گربه');
  assert(speciesLabelFa('CAT') === 'گربه', 'CAT → گربه');
  assert(speciesLabelFa('bird') === 'پرنده', 'bird → پرنده');

  const tip = offlineAiAdvice({ kind: 'trainer', petName: 'رکس', petSpecies: 'dog' });
  assert(tip.includes('پاشا یزدانی'), 'offline trainer introduces as Pasha');
  assert(/احوال|سلام|حالت چطوره/.test(tip), 'offline trainer opens with greeting/احوال‌پرسی');
  assert(!/\bDOG\b|\bdog\b/i.test(tip), 'offline greeting must not echo English species DOG');
  assert(/سگ/.test(tip), 'offline greeting uses Persian سگ for dog species');
  assert(
    !/برای شروع معمولاً این‌طور می‌چینم|۱\) روزی دو سه جلسه/.test(tip),
    'offline first intro must not dump numbered training curriculum'
  );
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی|\bAI\b/i.test(tip), 'offline trainer must not sound like a bot');
  const tipWithPhoto = offlineAiAdvice({
    kind: 'trainer',
    petName: 'رکس',
    petSpecies: 'dog',
    petImageUrl: 'https://cdn.example/pet.jpg',
  });
  assert(/عکس/.test(tipWithPhoto) && /دیدم/.test(tipWithPhoto), 'offline greeting acknowledges pet photo');
  const tipNoPhoto = offlineAiAdvice({ kind: 'trainer', petName: 'رکس', petSpecies: 'dog' });
  assert(/عکس/.test(tipNoPhoto) && /بفرست/.test(tipNoPhoto), 'offline greeting asks for pet photo when missing');

  const shortDelay = trainerTypingDelayMs('سلام');
  const longDelay = trainerTypingDelayMs('x'.repeat(500));
  assert(shortDelay >= 1500 && shortDelay <= 4000, 'typing delay lower bound');
  assert(longDelay >= shortDelay && longDelay <= 4000, 'typing delay scales and caps');
  const opening = buildTrainerOpeningGreeting({
    patientName: 'محمد',
    petName: 'رکس',
    petSpecies: 'DOG',
  });
  assert(/احوال|حالت چطوره|سلام|خوبی/.test(opening), 'opening greeting is احوال‌پرسی');
  assert(/سگ/.test(opening) && !/\bDOG\b|\bdog\b/i.test(opening), 'opening greeting uses سگ not DOG');
  const openingCat = buildTrainerOpeningGreeting({
    patientName: 'سارا',
    petName: 'ملوس',
    petSpecies: 'cat',
  });
  assert(/گربه/.test(openingCat) && !/\bCAT\b|\bcat\b/i.test(openingCat), 'opening greeting uses گربه not CAT');
  assert(
    !/اول احوال|احوال‌پرسی.*(بعد|بعداً).*(آموزش|تمرین)|اول یه کم بشناسم|الان احوال‌پرسی/.test(opening),
    'opening must not narrate greeting-then-train meta script'
  );
  assert(!/اول احوال|احوال‌پرسی.*(بعد|بعداً).*(آموزش|تمرین)|اول یه کم بشناسم/.test(tip), 'offline tip no meta greeting script');
  const sitTip = offlineAiAdvice({
    kind: 'trainer',
    userMessage: 'چطور بشین یاد بگیره؟',
    petName: 'رکس',
  });
  assert(sitTip.includes('بشین'), 'trainer topic hint for sit');
  assert(sitTip.length > 280, 'sit advice should be rich multi-paragraph');
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی/i.test(sitTip), 'sit tip must not sound like a bot');
  assert(
    /ببین|خودمونی|راستش|خب عملاً|آها/.test(sitTip),
    'sit tip uses spoken human openings/phrasing'
  );

  const richTopics: Array<{ q: string; needle: RegExp }> = [
    { q: 'قلاده می‌کشه تو خیابان', needle: /قلاده|بند|شل/ },
    { q: 'چطور بیا یادش بدم؟', needle: /بیا|برگشت|جایزه/ },
    { q: 'بمان بلد نیست', needle: /بمان|آزاد/ },
    { q: 'دستشویی توی خونه می‌کنه', needle: /دستشویی|جایزه|برنامه/ },
    { q: 'باکس قبول نمی‌کنه', needle: /باکس|پناهگاه|قفس/ },
    { q: 'خیلی پارس می‌کنه', needle: /پارس|محرک|آروم/ },
    { q: 'دستمو گاز می‌گیره', needle: /گاز|نیش|ایمنی|بازی/ },
    { q: 'روی مهمون می‌پره', needle: /پرید|چهار|توجه/ },
    { q: 'اضطراب جدایی داره وقتی می‌رم', needle: /جدایی|تنهایی|ثانیه/ },
    { q: 'توله دو ماهه از کجا شروع کنم', needle: /توله|جلسه|دستشویی|جامعه/ },
    { q: 'گربه‌ام litter نمی‌ره', needle: /گربه|بستر|Litter|انتخاب/ },
    { q: 'سر غذا غر می‌زنه محافظت منبع', needle: /منبع|فاصله|ایمن|کاسه/ },
    { q: 'روی قلاده به سگ دیگر واکنش نشون می‌ده', needle: /فاصله|محرک|واکنش/ },
    { q: 'کلیکر چطور بارگیری کنم؟', needle: /کلیکر|مارکر|جایزه/ },
    { q: 'enrichment و پازل غذایی می‌خوام', needle: /غنی|پازل|بینی|خوراکی/ },
    { q: 'ولش کن برای آشغال خیابان', needle: /ولش|رها|آشغال/ },
    { q: 'از صدای رعد می‌ترسه', needle: /ترس|فاصله|آرام/ },
    { q: 'جامعه‌پذیری توله', needle: /جامعه|فاصله|تجربه/ },
  ];
  for (const t of richTopics) {
    const text = offlineAiAdvice({ kind: 'trainer', userMessage: t.q, petName: 'رکس', petSpecies: 'dog' });
    assert(text.length > 220, `rich offline length for: ${t.q}`);
    assert(t.needle.test(text), `topic coverage for: ${t.q}`);
    assert(!/دستیار هوشمند|ربات|هوش مصنوعی|\bAI\b/i.test(text), `human voice for: ${t.q}`);
    const hint = trainerTopicHint(t.q);
    assert(hint && hint.length > 120, `trainerTopicHint exported for: ${t.q}`);
  }

  // Book-canon offline KB: substantial puppy + cat (+ bird/exotic/dominance/sources)
  const puppyCanon = offlineAiAdvice({
    kind: 'trainer',
    userMessage: 'توله دو ماهه از کجا شروع کنم برای جامعه‌پذیری؟',
    petName: 'رکس',
    petSpecies: 'dog',
  });
  assert(puppyCanon.includes('پاشا یزدانی') || /توله|جامعه|جلسه/.test(puppyCanon), 'puppy canon topic');
  assert(puppyCanon.length > 350, 'puppy offline reply substantial');
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی|\bAI\b/i.test(puppyCanon), 'puppy voice human');
  assert(!/Culture Clash|Puppy Primer|Think Like a Cat|Total Cat Mojo|Companion Parrot|Exotic Pet Practice/i.test(puppyCanon), 'do not spam book titles unless asked');

  const catCanon = offlineAiAdvice({
    kind: 'trainer',
    userMessage: 'گربه‌ام litter نمی‌ره و استرس داره',
    petName: 'ملوس',
    petSpecies: 'cat',
  });
  assert(catCanon.length > 350, 'cat offline reply substantial');
  assert(/بستر|litter|دامپزشک|خاک/i.test(catCanon), 'cat litter guidance present');
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی/i.test(catCanon), 'cat voice human');
  assert(!/Culture Clash|Puppy Primer|Johnson-Bennett|Jackson Galaxy/i.test(catCanon), 'no unsolicited book dump on cat');

  const mojo = offlineAiAdvice({ kind: 'trainer', userMessage: 'گربه ترسو پنهان می‌شه mojo نداره', petName: 'ملوس', petSpecies: 'cat' });
  assert(mojo.length > 280 && /عمودی|قلمرو|پنهان|شکار|mojo/i.test(mojo), 'cat mojo topic');

  const dominance = offlineAiAdvice({ kind: 'trainer', userMessage: 'می‌گن باید آلفا باشم و رهبر گله', petName: 'رکس' });
  assert(/آلفا|سلطه|تقویت|force-free|افسانه/i.test(dominance) && dominance.length > 280, 'dominance myth debunked');
  assert(!/Culture Clash/i.test(dominance), 'no book title spam on dominance');

  const bird = offlineAiAdvice({ kind: 'trainer', userMessage: 'طوطی زیاد جیغ می‌کشه و پر می‌کنه', petName: 'جیک', petSpecies: 'parrot' });
  assert(bird.length > 280 && /جیغ|foraging|پر|اگزوتیک|دامپزشک/i.test(bird), 'bird topic');

  const exotic = offlineAiAdvice({ kind: 'trainer', userMessage: 'خرگوشم نگهداری و تغذیه', petName: 'پف', petSpecies: 'rabbit' });
  assert(exotic.length > 250 && /خرگوش|یونجه|دامپزشک اگزوتیک|دارو/i.test(exotic), 'exotic husbandry');

  const sources = offlineAiAdvice({ kind: 'trainer', userMessage: 'منبع کتاب‌هات چیه؟', petName: 'رکس' });
  assert(/Culture Clash|Puppy Primer|Think Like a Cat|Total Cat Mojo|Companion Parrot|Exotic Pet Practice/i.test(sources), 'sources names books when asked');
  assert(/Donaldson|McConnell|Johnson-Bennett|Galaxy|Blanchard|Mitchell/i.test(sources), 'authors present when asked');

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
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی/i.test(msgs[0]!.text), 'trainer intro must not sound like a bot');
  assert(/احوال|سلام|حالت چطوره|خوبی/.test(msgs[0]!.text), 'trainer intro is greeting-first احوال‌پرسی');
  assert(
    !/برای شروع معمولاً این‌طور می‌چینم|۱\) روزی دو سه جلسه/.test(msgs[0]!.text),
    'session intro must not jump straight to numbered curriculum'
  );
  assert(
    !/اول احوال|احوال‌پرسی.*(بعد|بعداً).*(آموزش|تمرین)|اول یه کم بشناسم|الان احوال‌پرسی/.test(msgs[0]!.text),
    'session intro must not narrate greeting-then-train workflow'
  );
  assert(/عکس/.test(msgs[0]!.text), 'session intro mentions pet photo');
  assert(/سگ/.test(msgs[0]!.text) && !/\bDOG\b|\bdog\b/i.test(msgs[0]!.text), 'session intro uses سگ not dog/DOG');

  const leashTip = await generateAiConsultAdvice({
    kind: 'trainer',
    userMessage: 'قلاده می‌کشه',
    petName: 'رکس',
  });
  assert(leashTip.source === 'offline', 'known topic → offline without needing API');
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی/i.test(leashTip.text), 'generated trainer text not robotic');
  assert(/قلاده|کشید|تشویقی|بند/.test(leashTip.text), 'leash topic covered');
  assert(leashTip.text.length > 280, 'leash offline advice is detailed');

  const { trainerShouldGoOnline, trainerQuestionUnknownOffline } = await import('./ai-consult');
  assert(
    !trainerShouldGoOnline({ kind: 'trainer', userMessage: 'چطور بشین یاد بگیره؟' }),
    'without API key, known topic does not force online'
  );
  assert(
    trainerQuestionUnknownOffline({
      kind: 'trainer',
      userMessage: 'xyzzy plugh fnord 12345',
    }),
    'out-of-domain gibberish is unknown offline'
  );
  process.env.AI_CONSULT_API_KEY = 'test-key-not-used';
  assert(
    trainerShouldGoOnline({
      kind: 'trainer',
      userMessage: 'xyzzy plugh fnord 12345',
    }),
    'with API key, real questions go online'
  );
  assert(
    trainerShouldGoOnline({ kind: 'trainer', userMessage: 'چطور بشین یاد بگیره؟' }),
    'with API key, even known topics go online for richer answers'
  );
  delete process.env.AI_CONSULT_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const turn1 = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رکس',
    userMessage: 'چطور بشین یاد بگیره؟',
    history: [],
  });
  const turn2 = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رکس',
    userMessage: 'بیشتر توضیح بده',
    history: [
      { role: 'user', content: 'چطور بشین یاد بگیره؟' },
      { role: 'assistant', content: turn1.text },
    ],
  });
  assert(turn1.text !== turn2.text, 'trainer follow-up differs from first reply');
  assert(/بشین|معیار|عیب|سخت/.test(turn2.text), 'trainer follow-up stays on sit and digs deeper');
  assert(turn2.text.length > 200, 'deeper follow-up is substantial');

  const supportTurn1 = await generateAiConsultAdvice({
    kind: 'support',
    patientName: 'تست',
    userMessage: 'OTP نمیاد',
    history: [],
  });
  const supportTurn2 = await generateAiConsultAdvice({
    kind: 'support',
    patientName: 'تست',
    userMessage: 'بیشتر توضیح بده',
    history: [
      { role: 'user', content: 'OTP نمیاد' },
      { role: 'assistant', content: supportTurn1.text },
    ],
  });
  assert(supportTurn1.text !== supportTurn2.text, 'follow-up differs from first reply');
  assert(supportTurn2.text.includes('OTP') || supportTurn2.text.includes('پیامک'), 'follow-up stays on topic');

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
