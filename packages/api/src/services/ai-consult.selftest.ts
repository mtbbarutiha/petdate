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
    isTrainerGreetingMessage,
    trainerQuestionUnknownOffline,
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
  assert(tip.includes('دکتر لیلا کیانی'), 'offline trainer introduces as Pasha');
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

  assert(isTrainerGreetingMessage('سلام'), 'سلام is greeting');
  assert(isTrainerGreetingMessage('سلام خوبی؟'), 'سلام خوبی is greeting');
  assert(isTrainerGreetingMessage('صبح بخیر'), 'صبح بخیر is greeting');
  assert(isTrainerGreetingMessage('hi'), 'hi is greeting');
  assert(!isTrainerGreetingMessage('چطور بشین یاد بگیره؟'), 'sit question is not greeting');
  assert(!trainerQuestionUnknownOffline({ kind: 'trainer', userMessage: 'سلام' }), 'سلام must not be unknown');
  const salam = await generateAiConsultAdvice({
    kind: 'trainer',
    patientName: 'علی',
    petName: 'Teddy',
    userMessage: 'سلام',
  });
  assert(/سلام/.test(salam.text), 'سلام gets a سلام back');
  assert(/خوبی|حالت|چطوره|احوال|خوش/.test(salam.text), 'سلام reply continues احوال‌پرسی');
  assert(!/فاصلهٔ امن|جایزه برای آرومی|محرک یا موقعیت/.test(salam.text), 'سلام must not dump generic training tips');
  const salamMid = await generateAiConsultAdvice({
    kind: 'trainer',
    patientName: 'علی',
    petName: 'Teddy',
    userMessage: 'سلام',
    history: [
      { role: 'user', content: 'بشین بلد نیست' },
      { role: 'assistant', content: 'باشه بریم روی بشین کار کنیم.' },
    ],
  });
  assert(/سلام/.test(salamMid.text), 'mid-chat سلام still answered');
  assert(!/فاصلهٔ امن|محرک یا موقعیت/.test(salamMid.text), 'mid-chat سلام not unknown coaching dump');

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
  assert(
    !/گفتی که|پرسیدی که|این سؤال «|در مورد «/.test(sitTip),
    'sit tip must not echo/restate the user question'
  );

  const biteQ = 'سگم گاز می‌گیره دستمو';
  const biteTip = offlineAiAdvice({
    kind: 'trainer',
    userMessage: biteQ,
    petName: 'رکس',
    history: [{ role: 'user', content: 'سلام' }, { role: 'assistant', content: 'سلام خوبی؟' }],
  });
  assert(biteTip.length > 200, 'bite tip substantial');
  assert(
    !/گفتی که|پرسیدی که|این سؤال «|در مورد «|گاز می‌گیره/.test(biteTip.split('\n')[0] || ''),
    'bite tip opening must not restate user question'
  );
  assert(!biteTip.startsWith(biteQ) && !/گفتی.*گاز/.test(biteTip), 'bite tip must not paraphrase user Q');

  const unclearQ = 'یه مشکل عجیب داره نمی‌دونم چی بگم';
  const unclearTip = offlineAiAdvice({
    kind: 'trainer',
    userMessage: unclearQ,
    petName: 'رکس',
    history: [{ role: 'user', content: 'سلام' }, { role: 'assistant', content: 'سلام خوبی؟' }],
  });
  assert(
    !/نسخه|برای اینکه.*(درست|دقیق)|باید بدونم|سن تقریبی، محیط/.test(unclearTip),
    'unknown offline must not use نسخه/meta intake clarifiers'
  );
  assert(
    /تقویت مثبت|فاصله|جایزه/.test(unclearTip),
    'unknown offline should still give partial useful advice'
  );
  assert(
    /چند\s*ساله|چندساله‌ست/.test(unclearTip),
    'unknown offline asks age briefly when missing'
  );
  assert(
    !/اگه سن.*بگی.*تنظیم|حرفامون دقیق‌تر|تا دقیق‌تر جلو/.test(unclearTip),
    'unknown offline must not explain why it needs age'
  );

  const openingNoProfile = buildTrainerOpeningGreeting({
    patientName: 'علی',
    petName: 'باران',
  });
  assert(
    !/حرفامون دقیق‌تر|برای اینکه|نسخه/.test(openingNoProfile),
    'opening age/breed ask must not be meta'
  );
  assert(/چند سالشه/.test(openingNoProfile), 'opening asks age naturally when profile empty');

  const sitWithAge = offlineAiAdvice({
    kind: 'trainer',
    userMessage: 'چطور بشین یاد بگیره؟',
    petName: 'رکس',
    petSpecies: 'dog',
    petAgeMonths: 8,
  });
  assert(!/تقریباً چندساله‌ست|چند سالشه/.test(sitWithAge), 'known age must not re-ask age');
  assert(!/نسخهٔ?\s*درست|برای اینکه نسخه/.test(sitWithAge), 'topic reply must not use نسخه framing');

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
  assert(puppyCanon.includes('دکتر لیلا کیانی') || /توله|جامعه|جلسه/.test(puppyCanon), 'puppy canon topic');
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
  assert(vetTip.includes('دکتر لیلا کیانی'), 'offline vet introduces as Pasha');
  assert(!/دستیار هوشمند پت/.test(vetTip), 'vet tip must not use old smart-assistant brand');
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
  assert(aiUser.name === 'دکتر لیلا کیانی', 'ai user profile name is Pasha');

  const session = await startAiFallbackConsult({ patient, serviceKind: 'trainer' });
  assert(session, 'ai session started');
  assert(decorateAiConsultDisplay(session!.consult).vetName === 'دکتر لیلا کیانی', 'display name');
  const msgs = dbService.listVetConsultChatMessages(session!.consult.id);
  assert(msgs[0]!.text.includes('دکتر لیلا کیانی'), 'intro mentions Pasha');
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

  // Inbox dedupe: second quick-connect / «مشورت با پاشا» reuses the same active consult.
  const sessionAgain = await startAiFallbackConsult({ patient, serviceKind: 'trainer' });
  assert(sessionAgain, 'second ai session returned');
  assert(sessionAgain!.consult.id === session!.consult.id, 'second start reuses same consult id');
  assert(sessionAgain!.reused === true, 'second start marked reused');
  const activeTrainer = dbService
    .listVetConsultations({ patientUserId: patient.id, status: 'active', serviceKind: 'trainer' })
    .filter((c) => c.vetUserId === aiUser.id && !c.chatEnded);
  assert(activeTrainer.length === 1, 'only one ongoing AI trainer consult after reuse');

  // Vet AI fallback also displays as دکتر لیلا کیانی (not legacy «دستیار هوشمند»).
  const vetPatientTg = `selftest_ai_vet_${Date.now()}`;
  const { user: vetPatient } = dbService.findOrCreateUser({
    telegramId: vetPatientTg,
    name: 'VetPatientAI',
    username: 'vet_patient_ai',
  });
  dbService.setUserRoles(vetPatient.id, ['pet_owner']);
  dbService.createPet({ ownerId: vetPatient.id, name: 'ملوس', species: 'cat' });
  const vetSession = await startAiFallbackConsult({ patient: vetPatient, serviceKind: 'vet' });
  assert(vetSession, 'vet ai session started');
  assert(
    decorateAiConsultDisplay(vetSession!.consult).vetName === 'دکتر لیلا کیانی',
    'vet AI display name is Pasha'
  );
  const vetMsgs = dbService.listVetConsultChatMessages(vetSession!.consult.id);
  assert(vetMsgs[0]!.text.includes('دکتر لیلا کیانی'), 'vet opening mentions Pasha');
  assert(!/دستیار هوشمند/.test(vetMsgs[0]!.text), 'vet opening must not say smart assistant');

  // After user ends chat, a new start may create — but closes orphans.
  dbService.endVetConsultChat(session!.consult.id);
  dbService.updateVetConsultationStatus(session!.consult.id, 'completed');
  // Explicit close-all (keepId null) — must not throw on Postgres ("parameter $4" null-type bug).
  assert(
    dbService.closeActiveAiConsultsForPatient(patient.id, 'trainer', aiUser.id, null) >= 0,
    'closeActive with null keepId succeeds'
  );
  const sessionFresh = await startAiFallbackConsult({ patient, serviceKind: 'trainer' });
  assert(sessionFresh, 'new session after end');
  assert(sessionFresh!.consult.id !== session!.consult.id, 'new consult after prior ended');
  assert(!sessionFresh!.reused, 'fresh start is not reused');
  // keepId path: orphan sibling closed while keeping fresh open
  const orphan = dbService.createVetConsultation({
    vetUserId: aiUser.id,
    patientUserId: patient.id,
    status: 'active',
    notes: 'orphan selftest',
    feeCoins: 0,
    serviceKind: 'trainer',
    providerShareCoins: 0,
  });
  const closed = dbService.closeActiveAiConsultsForPatient(
    patient.id,
    'trainer',
    aiUser.id,
    sessionFresh!.consult.id
  );
  assert(closed >= 1, 'closeActive with keepId closes orphans');
  assert(
    dbService.getVetConsultation(sessionFresh!.consult.id)?.status === 'active',
    'kept consult stays active'
  );
  assert(
    dbService.getVetConsultation(orphan.id)?.status === 'completed',
    'orphan marked completed'
  );
  const activeAfterFresh = dbService
    .listVetConsultations({ patientUserId: patient.id, status: 'active', serviceKind: 'trainer' })
    .filter((c) => c.vetUserId === aiUser.id && !c.chatEnded);
  assert(activeAfterFresh.length === 1, 'still only one ongoing AI trainer after recreate');
  assert(activeAfterFresh[0]!.id === sessionFresh!.consult.id, 'only kept consult remains active');

  const leashTip = await generateAiConsultAdvice({
    kind: 'trainer',
    userMessage: 'قلاده می‌کشه',
    petName: 'رکس',
  });
  assert(leashTip.source === 'offline', 'known topic → offline without needing API');
  assert(!/دستیار هوشمند|ربات|هوش مصنوعی/i.test(leashTip.text), 'generated trainer text not robotic');
  assert(/قلاده|کشید|تشویقی|بند/.test(leashTip.text), 'leash topic covered');
  assert(leashTip.text.length > 280, 'leash offline advice is detailed');

  const { trainerShouldGoOnline } = await import('./ai-consult');
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

  {
    const { offlineUnknownBestEffortReply } = await import('./ai-consult');
    const unknownQ = 'سگم وقتی ماشین رد میشه یخ میزنه و زوزه عجیب میکشه بدون دلیل مشخص';
    assert(
      trainerQuestionUnknownOffline({ kind: 'trainer', userMessage: unknownQ }),
      'out-of-KB behavior question is unknown offline'
    );
    const noKey = await generateAiConsultAdvice({
      kind: 'trainer',
      userMessage: unknownQ,
      petName: 'رکس',
    });
    assert(noKey.source === 'offline', 'unknown without key stays offline');
    assert(!/اتصال آنلاین در دسترس نیست|دانش آنلاین مربی/.test(noKey.text), 'must not show online-unavailable wall');
    assert(/فاصله|جایزه|آفرین|تشویق/.test(noKey.text), 'unknown without key still coaches');

    process.env.AI_CONSULT_API_KEY = 'test-key-not-used';
    const failedOnline = await generateAiConsultAdvice({
      kind: 'trainer',
      userMessage: unknownQ,
      petName: 'رکس',
    });
    assert(failedOnline.source === 'offline', 'failed online returns offline');
    assert(!/اتصال آنلاین در دسترس نیست/.test(failedOnline.text), 'failed online must not wall the user');
    assert(/فاصله|جایزه|آفرین|تشویق/.test(failedOnline.text), 'failed online still coaches');
    delete process.env.AI_CONSULT_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const copy = offlineUnknownBestEffortReply({ kind: 'trainer', petName: 'Teddy', userMessage: unknownQ });
    assert(/Teddy/.test(copy), 'best-effort uses pet name');
    assert(/فاصله|جایزه/.test(copy), 'best-effort coaches');
  }

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
  assert(/بشین|سخت|تشویق|جایزه|دست خالی|بمان/.test(turn2.text), 'trainer follow-up stays on sit and digs deeper');
  assert(turn2.text.length > 200, 'deeper follow-up is substantial');
  assert(
    !/گفتی که|پرسیدی که|این سؤال «|در مورد «|روی «/.test(turn2.text.split('\n')[0] || ''),
    'follow-up opening must not echo question/topic title'
  );

  // Human sit coaching — conversational, not stiff worksheet.
  const sitHuman = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رِکس',
    userMessage: 'بشین بلد نیست',
    history: [],
  });
  assert(/بشین|تشویقی|آفرین|جایزه/.test(sitHuman.text), 'sit coaching covers core cues');
  assert(/ببین|خب|راستش|معمولاً|این‌جوری|اینجوری|اوکی|باشه/.test(sitHuman.text), 'sit coaching sounds spoken');
  assert(!/برنامهٔ?\s*عملی|معیار موفقیت|پروتکل|کاربر/.test(sitHuman.text), 'sit coaching must not sound like a worksheet');
  assert(!/^۱\)|\n۱\)/.test(sitHuman.text), 'sit coaching avoids numbered lesson list');


  // Multi-turn continuity: do not re-ask age; keep coaching after clarifying answers.
  const ageTurn1 = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رِکس',
    userMessage: 'سگم بشین بلد نیست',
    history: [],
  });
  assert(/چندسال|چند سال/.test(ageTurn1.text), 'first turn may ask age once when unknown');
  const ageTurn2 = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رِکس',
    userMessage: '۳ سالشه',
    history: [
      { role: 'user', content: 'سگم بشین بلد نیست' },
      { role: 'assistant', content: ageTurn1.text },
    ],
  });
  assert(!/چندسال|چند سال/.test(ageTurn2.text), 'after age answer must not re-ask age');
  assert(/بشین|جایزه|تشویق|تمرین|ادامه/.test(ageTurn2.text), 'age answer continues sit coaching');
  const ageTurn3 = await generateAiConsultAdvice({
    kind: 'trainer',
    petName: 'رِکس',
    userMessage: 'خب بعدش چی؟',
    history: [
      { role: 'user', content: 'سگم بشین بلد نیست' },
      { role: 'assistant', content: ageTurn1.text },
      { role: 'user', content: '۳ سالشه' },
      { role: 'assistant', content: ageTurn2.text },
    ],
  });
  assert(ageTurn3.text.length > 80, 'turn 3 still continues with substance');
  assert(!/چندسال|چند سال/.test(ageTurn3.text), 'turn 3 must not re-ask age');
  assert(ageTurn2.text !== ageTurn3.text, 'later turns should keep advancing');

  const { extractPetAgeMonthsFromText, extractHomeOrOutFromText } = await import('./ai-consult');
  assert(extractPetAgeMonthsFromText('۳ سالشه') === 36, 'parse 3 years');
  assert(extractPetAgeMonthsFromText('18 ماهه') === 18, 'parse 18 months');
  assert(extractHomeOrOutFromText('همش تو خونست') === 'home', 'parse همش تو خونست → home');
  assert(extractHomeOrOutFromText('خونه') === 'home', 'parse خونه → home');
  assert(extractHomeOrOutFromText('بیرون') === 'out', 'parse بیرون → out');
  assert(extractHomeOrOutFromText('هر دو') === 'both', 'parse هر دو → both');
  assert(
    extractHomeOrOutFromText('دستشویی توی خونه می‌کنه') == null,
    'toilet problem must not count as home clarifier'
  );

  // Screenshot bug: ask indoor/outdoor → user «همش تو خونست» → must NOT re-ask; acknowledge home.
  {
    const fearQ = 'سگم وقتی ماشین رد میشه یخ میزنه و زوزه عجیب میکشه بدون دلیل مشخص';
    const homeTurn1 = await generateAiConsultAdvice({
      kind: 'trainer',
      petName: 'Teddy',
      petAgeMonths: 24,
      userMessage: fearQ,
      history: [],
    });
    assert(
      /خونه‌?ست یا بیرون/.test(homeTurn1.text),
      'with known age, unknown topic may ask indoor/outdoor once'
    );
    const homeTurn2 = await generateAiConsultAdvice({
      kind: 'trainer',
      petName: 'Teddy',
      petAgeMonths: 24,
      userMessage: 'همش تو خونست',
      history: [
        { role: 'user', content: fearQ },
        { role: 'assistant', content: homeTurn1.text },
      ],
    });
    assert(
      !/خونه‌?ست یا بیرون/.test(homeTurn2.text),
      'after همش تو خونست must not re-ask indoor/outdoor'
    );
    assert(
      /خون|خانه|آپارتمان|راهرو|زنگ|مهمون|خونه/.test(homeTurn2.text),
      'home answer must reference indoor/home context'
    );
    assert(
      /باشه|پس|اوکی|تنظیم/.test(homeTurn2.text),
      'home answer should acknowledge and advance'
    );
    assert(
      !trainerQuestionUnknownOffline({
        kind: 'trainer',
        petName: 'Teddy',
        petAgeMonths: 24,
        userMessage: 'همش تو خونست',
        history: [
          { role: 'user', content: fearQ },
          { role: 'assistant', content: homeTurn1.text },
        ],
      }),
      'همش تو خونست after clarifier is not an unknown topic'
    );

    // Second pass through best-effort template must also not echo the clarifier.
    const { offlineUnknownBestEffortReply } = await import('./ai-consult');
    const bestEffortAfter = offlineUnknownBestEffortReply({
      kind: 'trainer',
      petName: 'Teddy',
      petAgeMonths: 24,
      userMessage: 'همش تو خونست',
      history: [
        { role: 'user', content: fearQ },
        { role: 'assistant', content: homeTurn1.text },
      ],
    });
    assert(
      !/خونه‌?ست یا بیرون/.test(bestEffortAfter),
      'offlineUnknownBestEffortReply must not re-ask after home answer'
    );
    assert(/خون|راهرو|زنگ|مهمون|خونه/.test(bestEffortAfter), 'best-effort after home uses indoor tips');
  }

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

  // Voice in AI consult without STT key → polite Persian fallback (no throw).
  {
    const { maybeTranscribeAndReplyAsAiAssistant } = await import('./ai-consult-session');
    const { STT_UNAVAILABLE_FA } = await import('./speech-to-text');
    const voiceConsultId = sessionFresh!.consult.id;
    const voiceMsg = dbService.createVetConsultChatMessage({
      consultId: voiceConsultId,
      senderUserId: patient.id,
      text: '',
      mediaKind: 'voice',
      telegramFileId: 'AgAC_fake_voice_file_id_for_selftest_only_xxxxxxxx',
      mimeType: 'audio/ogg',
    });
    assert(voiceMsg.text === '[پیام صوتی]', 'voice placeholder stored');
    await maybeTranscribeAndReplyAsAiAssistant({
      consultId: voiceConsultId,
      patientUserId: patient.id,
      message: voiceMsg,
    });
    const after = dbService.listVetConsultChatMessages(voiceConsultId);
    const last = after[after.length - 1]!;
    assert(last.senderUserId === aiUser.id, 'AI replied to voice');
    assert(last.text === STT_UNAVAILABLE_FA, 'STT fallback copy');
  }

  const { usableTelegramId, isSyntheticTelegramId } = await import('./telegram-id');
  assert(isSyntheticTelegramId('petdate_ai_assistant'), 'AI tg id synthetic');
  assert(!usableTelegramId('petdate_ai_assistant'), 'AI tg id not sendable');
  assert(usableTelegramId('123456789'), 'numeric tg id ok');

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
