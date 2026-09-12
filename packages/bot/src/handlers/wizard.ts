import { menuKeyboardFor } from './helpers';
import type { Context } from 'grammy';
import type { BotStep, PetDraft, PetGender, PetSize, PetSpecies } from '@petdate/shared';
import {
  PET_AGE_CUSTOM_LABEL,
  PET_COLOR_CUSTOM_LABEL,
  PET_COLOR_OPTIONS,
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_SPECIES_LABELS,
  breedMatchesQuery,
  formatPetAge,
  normalizeBreedQuery,
  parsePetAgeInput,
  userHasRole,
} from '@petdate/shared';
import {
  createPet,
  getUserByTelegramId,
  listBreeds,
  listSpecies,
} from '../api-client';
import {
  BREED_PAGE_SIZE,
  LOOKING_NO_LABEL,
  LOOKING_YES_LABEL,
  MENU_LABELS,
  MY_PETS_SECTION,
  NEUTERED_NO_LABEL,
  NEUTERED_YES_LABEL,
  NO_LABEL,
  PET_FEMALE_LABEL,
  PET_MALE_LABEL,
  VACCINATED_NO_LABEL,
  VACCINATED_YES_LABEL,
  WIZARD_NAV,
  YES_LABEL,
  breedReplyKeyboard,
  lookingReplyKeyboard,
  mainMenuKeyboard,
  neuteredReplyKeyboard,
  petAgeReplyKeyboard,
  petColorReplyKeyboard,
  petGenderReplyKeyboard,
  petSizeReplyKeyboard,
  speciesReplyKeyboard,
  textStepKeyboard,
  vaccinatedReplyKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { resolveTelegramPhotoUrl } from '../urls';

const TOTAL_STEPS = 13;

const PET_BACK: Partial<Record<BotStep, BotStep>> = {
  pet_species: 'pet_name',
  pet_breed: 'pet_species',
  pet_gender: 'pet_breed',
  pet_age: 'pet_gender',
  pet_size: 'pet_age',
  pet_color: 'pet_size',
  pet_vaccinated: 'pet_color',
  pet_neutered: 'pet_vaccinated',
  pet_diseases: 'pet_neutered',
  pet_looking: 'pet_diseases',
  pet_bio: 'pet_looking',
  pet_photo: 'pet_bio',
};

function stepLabel(n: number): string {
  return `مرحله ${n} از ${TOTAL_STEPS}`;
}

async function cancelWizard(ctx: Context, telegramId: string): Promise<void> {
  const user = await getUserByTelegramId(telegramId);
  await upsertSession(telegramId, {
    step: 'ready',
    draftPet: undefined,
    breedPage: undefined,
    paymentPendingOrderId: undefined,
  });
  await ctx.reply('ثبت پت لغو شد.', { reply_markup: menuKeyboardFor(ctx, user) });
}

export async function startPetWizard(ctx: Context, telegramId: string): Promise<void> {
  const user = await getUserByTelegramId(telegramId);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  await upsertSession(telegramId, {
    step: 'pet_name',
    userId: user.id,
    role: user.role,
    draftPet: {},
    breedPage: 0,
    paymentPendingOrderId: undefined,
  });
  await askPetName(ctx);
}

async function askPetName(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      '🐾 **ثبت پت جدید**',
      '',
      `📝 ${stepLabel(1)}`,
      '',
      'نام پتت رو بنویس:',
    ].join('\n'),
    { parse_mode: 'Markdown', reply_markup: textStepKeyboard({ noBack: true }) }
  );
}

async function askSpecies(ctx: Context): Promise<void> {
  try {
    const species = await listSpecies();
    if (!species.length) {
      await ctx.reply('لیست نوع پت در دسترس نیست. کمی بعد دوباره امتحان کن.', {
        reply_markup: textStepKeyboard(),
      });
      return;
    }
    await ctx.reply(`🐾 **${stepLabel(2)}**\n\nنوع پت رو از منو انتخاب کن:`, {
      parse_mode: 'Markdown',
      reply_markup: speciesReplyKeyboard(species),
    });
  } catch (err) {
    console.error('askSpecies failed:', err);
    await ctx.reply('خطا در دریافت نوع پت. دوباره «➕ ثبت پت» رو بزن.', {
      reply_markup: mainMenuKeyboard('pet_owner', undefined, ctx.from?.id),
    });
  }
}

async function askBreed(ctx: Context, speciesCode: string, page = 0, filterQ?: string): Promise<void> {
  const breeds = await listBreeds(speciesCode, filterQ);
  if (breeds.length === 0 && !filterQ) {
    await ctx.reply(
      `🧬 **${stepLabel(3)}**\n\nنژادی در کاتالوگ این نوع نیست. نوع دیگری انتخاب کن یا «سایر» را بزن.`,
      {
        parse_mode: 'Markdown',
        reply_markup: textStepKeyboard(),
      }
    );
    return;
  }
  if (breeds.length === 0 && filterQ) {
    await ctx.reply(
      `چیزی با «${filterQ}» پیدا نشد.\nعبارت دیگری بنویس یا از لیست انتخاب کن:`,
      { reply_markup: breedReplyKeyboard(await listBreeds(speciesCode), 0) }
    );
    return;
  }
  const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const filterNote = filterQ ? `\n🔍 فیلتر: ${filterQ}` : '\nمی‌تونی نام نژاد رو برای جستجو تایپ کنی.';
  await ctx.reply(
    `🧬 **${stepLabel(3)}**\n\nنژاد رو از لیست انتخاب کن (صفحه ${safePage + 1}/${totalPages}):${filterNote}`,
    {
      parse_mode: 'Markdown',
      reply_markup: breedReplyKeyboard(breeds, safePage),
    }
  );
}

async function askGender(ctx: Context): Promise<void> {
  await ctx.reply(`⚧ **${stepLabel(4)}**\n\nجنسیت پت رو انتخاب کن:`, {
    parse_mode: 'Markdown',
    reply_markup: petGenderReplyKeyboard(),
  });
}

async function askAge(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      `🎂 **${stepLabel(5)}**`,
      '',
      'سن پت رو انتخاب کن:',
      '',
      '_یا بنویس مثل: ۸ ماهه · ۲ ساله · ۱ سال و ۳ ماه_',
    ].join('\n'),
    { parse_mode: 'Markdown', reply_markup: petAgeReplyKeyboard() }
  );
}

async function askSize(ctx: Context): Promise<void> {
  await ctx.reply(`📏 **${stepLabel(6)}**\n\nاندازه پت رو انتخاب کن:`, {
    parse_mode: 'Markdown',
    reply_markup: petSizeReplyKeyboard(),
  });
}

async function askColor(ctx: Context): Promise<void> {
  await ctx.reply(`🎨 **${stepLabel(7)}**\n\nرنگ پت رو انتخاب کن:`, {
    parse_mode: 'Markdown',
    reply_markup: petColorReplyKeyboard(),
  });
}

async function askVaccinated(ctx: Context): Promise<void> {
  await ctx.reply(`💉 **${stepLabel(8)}**\n\nوضعیت واکسن رو انتخاب کن:`, {
    parse_mode: 'Markdown',
    reply_markup: vaccinatedReplyKeyboard(),
  });
}

async function askNeutered(ctx: Context): Promise<void> {
  await ctx.reply(`✂️ **${stepLabel(9)}**\n\nوضعیت عقیم‌سازی رو انتخاب کن:`, {
    parse_mode: 'Markdown',
    reply_markup: neuteredReplyKeyboard(),
  });
}

async function askDiseases(ctx: Context): Promise<void> {
  await ctx.reply(
    `🏥 **${stepLabel(10)}**\n\nبیماری یا حساسیت خاصی داره؟ بنویس یا رد کن:`,
    { parse_mode: 'Markdown', reply_markup: textStepKeyboard({ skip: true }) }
  );
}

async function askLooking(ctx: Context): Promise<void> {
  await ctx.reply(`🤝 **${stepLabel(11)}**\n\nدنبال همبازی هست؟`, {
    parse_mode: 'Markdown',
    reply_markup: lookingReplyKeyboard(),
  });
}

async function askBio(ctx: Context): Promise<void> {
  await ctx.reply(
    `💬 **${stepLabel(12)}**\n\nچند خط درباره پت بنویس (شخصیت، عادت‌ها...) یا رد کن:`,
    { parse_mode: 'Markdown', reply_markup: textStepKeyboard({ skip: true }) }
  );
}

async function askPhoto(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      `🖼 **${stepLabel(13)}**`,
      '',
      'یک **عکس** از پت بفرست (همان عکس فشرده تلگرام کافی است).',
      'اگر خواستی می‌تونی عکس را به‌صورت فایل هم بفرستی.',
      '',
      'اگر فعلاً عکس نداری، «⏭ رد کردن» را بزن.',
      'برای خروج: «❌ انصراف» یا «📋 منو» یا /cancel',
    ].join('\n'),
    {
      parse_mode: 'Markdown',
      reply_markup: textStepKeyboard({ skip: true }),
    }
  );
}

async function promptPetStep(
  ctx: Context,
  step: BotStep,
  draft: PetDraft,
  breedPage = 0
): Promise<void> {
  switch (step) {
    case 'pet_name':
      await askPetName(ctx);
      return;
    case 'pet_species':
      await askSpecies(ctx);
      return;
    case 'pet_breed':
      await askBreed(ctx, draft.species ?? 'other', breedPage);
      return;
    case 'pet_gender':
      await askGender(ctx);
      return;
    case 'pet_age':
      await askAge(ctx);
      return;
    case 'pet_size':
      await askSize(ctx);
      return;
    case 'pet_color':
      await askColor(ctx);
      return;
    case 'pet_vaccinated':
      await askVaccinated(ctx);
      return;
    case 'pet_neutered':
      await askNeutered(ctx);
      return;
    case 'pet_diseases':
      await askDiseases(ctx);
      return;
    case 'pet_looking':
      await askLooking(ctx);
      return;
    case 'pet_bio':
      await askBio(ctx);
      return;
    case 'pet_photo':
      await askPhoto(ctx);
      return;
    default:
      return;
  }
}

function parseYesNo(text: string): boolean | null {
  const t = text.trim();
  if (t === YES_LABEL || t === 'بله' || t === 'آره') return true;
  if (t === NO_LABEL || t === 'خیر' || t === 'نه') return false;
  return null;
}

function parseVaccinated(text: string): boolean | null {
  const t = text.trim();
  if (t === VACCINATED_YES_LABEL || t === 'واکسن زده') return true;
  if (t === VACCINATED_NO_LABEL || t === 'واکسن نزده' || t === 'واکسن نخورده') return false;
  return parseYesNo(t);
}

function parseNeutered(text: string): boolean | null {
  const t = text.trim();
  if (t === NEUTERED_YES_LABEL || t === 'عقیم شده') return true;
  if (t === NEUTERED_NO_LABEL || t === 'عقیم نشده') return false;
  return parseYesNo(t);
}

function parseLooking(text: string): boolean | null {
  const t = text.trim();
  if (t === LOOKING_YES_LABEL || t === 'دنبال همبازی') return true;
  if (t === LOOKING_NO_LABEL || t === 'فعلاً نه') return false;
  return parseYesNo(t);
}

function parsePetGender(text: string): PetGender | null {
  const t = text.trim();
  if (t === PET_MALE_LABEL || t === PET_GENDER_LABELS.male || t === 'نر') return 'male';
  if (t === PET_FEMALE_LABEL || t === PET_GENDER_LABELS.female || t === 'ماده') return 'female';
  return null;
}

function parsePetSize(text: string): PetSize | null {
  const t = text.trim();
  if (t === PET_SIZE_LABELS.small || t === 'کوچک') return 'small';
  if (t === PET_SIZE_LABELS.medium || t === 'متوسط') return 'medium';
  if (t === PET_SIZE_LABELS.large || t === 'بزرگ') return 'large';
  return null;
}

function parsePetColor(text: string): string | null {
  const t = text.trim();
  if (!t || t === PET_COLOR_CUSTOM_LABEL) return null;
  if ((PET_COLOR_OPTIONS as readonly string[]).includes(t)) return t;
  // رنگ دستی بعد از «رنگ دیگر»
  if (t.length >= 1 && t.length <= 60) return t.slice(0, 60);
  return null;
}

function matchSpecies(text: string, species: PetSpecies[]): PetSpecies | null {
  const t = text.trim();
  return (
    species.find(
      (s) =>
        t === `${s.emoji} ${s.labelFa}` ||
        t === s.labelFa ||
        t === s.code ||
        t === PET_SPECIES_LABELS[s.code]
    ) ?? null
  );
}

export async function handleWizardText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const telegramId = String(from.id);
  let session = await getSession(telegramId);
  if (!session) return false;

  const step = session.step;
  if (!String(step).startsWith('pet_') && step !== 'playdate_message') return false;
  // ویرایش بخش‌به‌بخش پت توسط pet-edit.ts مدیریت می‌شود
  if (session.petSectionEdit) return false;

  // بعد از ری‌استارت/سشن ناقص، userId را بازیابی کن
  if (!session.userId) {
    const user = await getUserByTelegramId(telegramId);
    if (!user?.id) {
      await ctx.reply('نشست منقضی شده. دوباره /start بزن.');
      return true;
    }
    session = await upsertSession(telegramId, { userId: user.id, role: user.role });
  }

  const userId = session.userId!;
  const draft: PetDraft = { ...session.draftPet };

  if (step === 'playdate_message') {
    // پیام برای صاحب پت حذف شد — درخواست مستقیم ارسال می‌شود
    await upsertSession(telegramId, {
      step: 'ready',
      selectedPetId: undefined,
      selectedToPetId: undefined,
    });
    const u = await getUserByTelegramId(telegramId);
    await ctx.reply('برای پیدا کردن همبازی از منو «🔍 پیدا کردن همبازی» رو بزن.', {
      reply_markup: menuKeyboardFor(ctx, u),
    });
    return true;
  }

  if (text === WIZARD_NAV.cancel) {
    await cancelWizard(ctx, telegramId);
    return true;
  }

  if (text === WIZARD_NAV.back) {
    const prev = PET_BACK[step];
    if (!prev) {
      await cancelWizard(ctx, telegramId);
      return true;
    }
    const breedPage = prev === 'pet_breed' ? (session.breedPage ?? 0) : 0;
    await upsertSession(telegramId, { step: prev, draftPet: draft, breedPage });
    await ctx.reply('برگشتیم یک مرحله ↩️');
    await promptPetStep(ctx, prev, draft, breedPage);
    return true;
  }

  if (text === WIZARD_NAV.skip) {
    return handleSkipText(ctx, telegramId, userId, step, draft);
  }

  // دکمه‌های منوی اصلی/بخش پت‌ها را به‌عنوان دادهٔ ویزارد قبول نکن
  if (MENU_LABELS.has(text) || Object.values(MY_PETS_SECTION).includes(text as never)) {
    await ctx.reply('الان وسط ثبت پتی. از دکمه‌های همین مرحله استفاده کن یا «انصراف» بزن.', {
      reply_markup: textStepKeyboard({ skip: String(step) !== 'pet_name' && String(step) !== 'pet_species' }),
    });
    await promptPetStep(ctx, step, draft, session.breedPage ?? 0);
    return true;
  }

  if (step === 'pet_name') {
    const name = text.trim();
    if (name.length < 1) {
      await ctx.reply('نام پت رو بنویس.', { reply_markup: textStepKeyboard({ noBack: true }) });
      return true;
    }
    draft.name = name;
    await upsertSession(telegramId, { step: 'pet_species', draftPet: draft });
    await askSpecies(ctx);
    return true;
  }

  if (step === 'pet_species') {
    const speciesList = await listSpecies();
    const matched = matchSpecies(text, speciesList);
    if (!matched) {
      await ctx.reply('از دکمه‌های کیبورد نوع پت رو انتخاب کن:', {
        reply_markup: speciesReplyKeyboard(speciesList),
      });
      return true;
    }
    draft.species = matched.code;
    await upsertSession(telegramId, { step: 'pet_breed', draftPet: draft, breedPage: 0 });
    await askBreed(ctx, matched.code, 0);
    return true;
  }

  if (step === 'pet_breed') {
    return handleBreedText(ctx, telegramId, draft, text, session.breedPage ?? 0);
  }

  if (step === 'pet_gender') {
    const gender = parsePetGender(text);
    if (!gender) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: petGenderReplyKeyboard() });
      return true;
    }
    draft.gender = gender;
    await upsertSession(telegramId, { step: 'pet_age', draftPet: draft });
    await askAge(ctx);
    return true;
  }

  if (step === 'pet_age') {
    if (text.trim() === PET_AGE_CUSTOM_LABEL) {
      await ctx.reply(
        [
          'سن دقیق رو بنویس، مثلاً:',
          '• ۸ ماهه',
          '• ۲ ساله',
          '• فقط عدد ۲ (= ۲ ساله)',
          '• فقط عدد ۸ با واحد ماه: ۸ ماه',
        ].join('\n'),
        { reply_markup: textStepKeyboard() }
      );
      return true;
    }

    const ageMonths = parsePetAgeInput(text);
    if (ageMonths == null) {
      await ctx.reply(
        'سن رو از دکمه‌ها انتخاب کن یا با واحد بنویس؛ مثل «۶ ماهه» یا «۲ ساله».',
        { reply_markup: petAgeReplyKeyboard() }
      );
      return true;
    }
    draft.ageMonths = ageMonths;
    await upsertSession(telegramId, { step: 'pet_size', draftPet: draft });
    await ctx.reply(`✅ سن ثبت شد: **${formatPetAge(ageMonths)}**`, { parse_mode: 'Markdown' });
    await askSize(ctx);
    return true;
  }

  if (step === 'pet_size') {
    const size = parsePetSize(text);
    if (!size) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: petSizeReplyKeyboard() });
      return true;
    }
    draft.size = size;
    await upsertSession(telegramId, { step: 'pet_color', draftPet: draft });
    await askColor(ctx);
    return true;
  }

  if (step === 'pet_color') {
    if (text === PET_COLOR_CUSTOM_LABEL) {
      await ctx.reply('رنگ پت رو بنویس:', { reply_markup: textStepKeyboard({ skip: true }) });
      return true;
    }
    const color = parsePetColor(text);
    if (!color) {
      await ctx.reply('از دکمه‌ها انتخاب کن یا «رنگ دیگر» رو بزن:', {
        reply_markup: petColorReplyKeyboard(),
      });
      return true;
    }
    draft.color = color;
    await upsertSession(telegramId, { step: 'pet_vaccinated', draftPet: draft });
    await askVaccinated(ctx);
    return true;
  }

  if (step === 'pet_vaccinated') {
    const value = parseVaccinated(text);
    if (value == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: vaccinatedReplyKeyboard() });
      return true;
    }
    draft.vaccinated = value;
    await upsertSession(telegramId, { step: 'pet_neutered', draftPet: draft });
    await askNeutered(ctx);
    return true;
  }

  if (step === 'pet_neutered') {
    const value = parseNeutered(text);
    if (value == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: neuteredReplyKeyboard() });
      return true;
    }
    draft.neutered = value;
    await upsertSession(telegramId, { step: 'pet_diseases', draftPet: draft });
    await askDiseases(ctx);
    return true;
  }

  if (step === 'pet_diseases') {
    draft.diseases = text.trim().slice(0, 200);
    await upsertSession(telegramId, { step: 'pet_looking', draftPet: draft });
    await askLooking(ctx);
    return true;
  }

  if (step === 'pet_looking') {
    const value = parseLooking(text);
    if (value == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: lookingReplyKeyboard() });
      return true;
    }
    draft.lookingForPlaymate = value;
    await upsertSession(telegramId, { step: 'pet_bio', draftPet: draft });
    await askBio(ctx);
    return true;
  }

  if (step === 'pet_bio') {
    draft.bio = text.trim().slice(0, 400);
    await upsertSession(telegramId, { step: 'pet_photo', draftPet: draft });
    await askPhoto(ctx);
    return true;
  }

  if (step === 'pet_photo') {
    await ctx.reply(
      'الان مرحلهٔ عکسه.\nیک عکس (یا فایل تصویری) بفرست، یا «⏭ رد کردن» / «❌ انصراف» / «📋 منو» بزن.',
      { reply_markup: textStepKeyboard({ skip: true }) }
    );
    return true;
  }

  return false;
}

async function handleBreedText(
  ctx: Context,
  telegramId: string,
  draft: PetDraft,
  text: string,
  page: number
): Promise<boolean> {
  const species = draft.species ?? 'other';
  const breeds = await listBreeds(species);
  const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));

  if (text === WIZARD_NAV.nextPage) {
    const next = Math.min(page + 1, totalPages - 1);
    await upsertSession(telegramId, { breedPage: next });
    await askBreed(ctx, species, next);
    return true;
  }

  if (text === WIZARD_NAV.prevPage) {
    const prev = Math.max(page - 1, 0);
    await upsertSession(telegramId, { breedPage: prev });
    await askBreed(ctx, species, prev);
    return true;
  }

  // ignore page indicator taps like "1/2"
  if (/^\d+\/\d+$/.test(text.trim())) {
    await askBreed(ctx, species, page);
    return true;
  }

  if (text === WIZARD_NAV.custom) {
    await ctx.reply('نژاد را فقط از لیست انتخاب کن یا برای جستجو بخشی از نام را بنویس.', {
      reply_markup: breedReplyKeyboard(breeds, page),
    });
    return true;
  }

  const typed = text.trim();
  const needle = normalizeBreedQuery(typed);
  const matched =
    breeds.find((b) => b.nameFa === typed) ||
    breeds.find((b) => normalizeBreedQuery(b.nameFa) === needle) ||
    breeds.find((b) => b.nameEn && normalizeBreedQuery(b.nameEn) === needle);
  if (matched) {
    draft.breed = matched.nameFa;
    await upsertSession(telegramId, { step: 'pet_gender', draftPet: draft });
    await askGender(ctx);
    return true;
  }

  // Search / filter — never accept free-text breeds (FA or EN)
  if (typed.length >= 1) {
    const filtered = (await listBreeds(species, typed)).filter((b) =>
      breedMatchesQuery(b, typed)
    );
    if (filtered.length === 1) {
      draft.breed = filtered[0]!.nameFa;
      await upsertSession(telegramId, { step: 'pet_gender', draftPet: draft, breedPage: 0 });
      await askGender(ctx);
      return true;
    }
    await upsertSession(telegramId, { breedPage: 0 });
    await askBreed(ctx, species, 0, typed);
    return true;
  }

  await askBreed(ctx, species, page);
  return true;
}

async function handleSkipText(
  ctx: Context,
  telegramId: string,
  userId: number,
  step: BotStep,
  draft: PetDraft
): Promise<boolean> {
  if (step === 'pet_breed') {
    await ctx.reply('نژاد الزامی است — از لیست انتخاب کن یا برای جستجو تایپ کن.', {
      reply_markup: breedReplyKeyboard(await listBreeds(draft.species ?? 'other'), 0),
    });
    return true;
  }
  if (step === 'pet_color') {
    await upsertSession(telegramId, { step: 'pet_vaccinated', draftPet: draft });
    await askVaccinated(ctx);
    return true;
  }
  if (step === 'pet_diseases') {
    await upsertSession(telegramId, { step: 'pet_looking', draftPet: draft });
    await askLooking(ctx);
    return true;
  }
  if (step === 'pet_looking') {
    // looking is required via buttons — skip not used
    return true;
  }
  if (step === 'pet_bio') {
    await upsertSession(telegramId, { step: 'pet_photo', draftPet: draft });
    await askPhoto(ctx);
    return true;
  }
  if (step === 'pet_photo') {
    await finishPetWizard(ctx, telegramId, userId, draft);
    return true;
  }
  return true;
}

async function handlePlaydateMessage(
  _ctx: Context,
  _telegramId: string,
  _userId: number,
  _text: string
): Promise<boolean> {
  return false;
}

/** Legacy inline callbacks — keep working for old messages */
export async function handleSpeciesSelect(ctx: Context, species: string): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'pet_species') return;

  const draft: PetDraft = { ...session.draftPet, species };
  await upsertSession(telegramId, { step: 'pet_breed', draftPet: draft, breedPage: 0 });
  await ctx.answerCallbackQuery();
  await askBreed(ctx, species, 0);
}

export async function handleBreedSelect(ctx: Context, breedId: number): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'pet_breed') return;

  const species = session.draftPet?.species;
  const breeds = species ? await listBreeds(species) : await listBreeds();
  const breed = breeds.find((b) => b.id === breedId);
  if (!breed) {
    await ctx.answerCallbackQuery({ text: 'نژاد پیدا نشد', show_alert: true });
    return;
  }

  const draft: PetDraft = { ...session.draftPet, breed: breed.nameFa };
  await upsertSession(telegramId, { step: 'pet_gender', draftPet: draft });
  await ctx.answerCallbackQuery({ text: breed.nameFa });
  await askGender(ctx);
}

export async function handleBreedCustom(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'pet_breed') return;

  await ctx.answerCallbackQuery({ text: 'نژاد را از لیست انتخاب کن' });
  const species = session.draftPet?.species ?? 'other';
  await askBreed(ctx, species, session.breedPage ?? 0);
}

export async function handlePetGenderSelect(ctx: Context, gender: PetGender): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'pet_gender') return;

  const draft: PetDraft = { ...session.draftPet, gender };
  await upsertSession(telegramId, { step: 'pet_age', draftPet: draft });
  await ctx.answerCallbackQuery({ text: PET_GENDER_LABELS[gender] });
  await askAge(ctx);
}

export async function handlePetSizeSelect(ctx: Context, size: PetSize): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'pet_size') return;

  const draft: PetDraft = { ...session.draftPet, size };
  await upsertSession(telegramId, { step: 'pet_color', draftPet: draft });
  await ctx.answerCallbackQuery({ text: PET_SIZE_LABELS[size] });
  await askColor(ctx);
}

export async function handlePetBoolSelect(
  ctx: Context,
  field: 'vaccinated' | 'neutered' | 'looking',
  value: boolean
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session) return;

  const draft: PetDraft = { ...session.draftPet };
  await ctx.answerCallbackQuery({ text: value ? 'بله' : 'خیر' });

  if (field === 'vaccinated' && session.step === 'pet_vaccinated') {
    draft.vaccinated = value;
    await upsertSession(telegramId, { step: 'pet_neutered', draftPet: draft });
    await askNeutered(ctx);
    return;
  }

  if (field === 'neutered' && session.step === 'pet_neutered') {
    draft.neutered = value;
    await upsertSession(telegramId, { step: 'pet_diseases', draftPet: draft });
    await askDiseases(ctx);
    return;
  }

  if (field === 'looking' && session.step === 'pet_looking') {
    draft.lookingForPlaymate = value;
    await upsertSession(telegramId, { step: 'pet_bio', draftPet: draft });
    await askBio(ctx);
  }
}

export async function handleWizardSkip(
  ctx: Context,
  field: 'breed' | 'color' | 'diseases' | 'bio' | 'photo'
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session?.userId) return;

  await ctx.answerCallbackQuery();
  const draft: PetDraft = { ...session.draftPet };

  if (field === 'breed') {
    await upsertSession(telegramId, { step: 'pet_gender', draftPet: draft });
    await askGender(ctx);
    return;
  }

  if (field === 'color') {
    await upsertSession(telegramId, { step: 'pet_vaccinated', draftPet: draft });
    await askVaccinated(ctx);
    return;
  }

  if (field === 'diseases') {
    await upsertSession(telegramId, { step: 'pet_looking', draftPet: draft });
    await askLooking(ctx);
    return;
  }

  if (field === 'bio') {
    await upsertSession(telegramId, { step: 'pet_photo', draftPet: draft });
    await askPhoto(ctx);
    return;
  }

  await finishPetWizard(ctx, telegramId, session.userId, draft);
}

function extractImageFileId(ctx: Context): string | null {
  const photos = ctx.message?.photo;
  if (photos?.length) {
    return photos[photos.length - 1]!.file_id;
  }
  const doc = ctx.message?.document;
  if (!doc?.file_id) return null;
  const mime = (doc.mime_type ?? '').toLowerCase();
  const name = (doc.file_name ?? '').toLowerCase();
  if (mime.startsWith('image/')) return doc.file_id;
  if (/\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(name)) return doc.file_id;
  // بعضی کلاینت‌ها mime/نام نمی‌فرستند — فقط اگر پسوند خطرناک نباشد بپذیر
  if (!mime && !name) return doc.file_id;
  return null;
}

/**
 * عکس / فایل تصویری در مرحلهٔ ثبت پت.
 * true = پیام مصرف شد (حتی اگر فقط راهنمایی دادیم).
 */
export async function handlePetPhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const telegramId = String(from.id);
  let session = await getSession(telegramId);
  if (!session || session.step !== 'pet_photo') return false;

  // بازیابی userId بعد از ری‌استارت / سشن ناقص (مثل ویزارد متنی)
  if (!session.userId) {
    const user = await getUserByTelegramId(telegramId);
    if (!user?.id) {
      await ctx.reply('نشست منقضی شده. دوباره /start بزن و ثبت پت را از اول شروع کن.');
      await upsertSession(telegramId, { step: 'ready', draftPet: undefined, breedPage: undefined });
      return true;
    }
    session = await upsertSession(telegramId, { userId: user.id, role: user.role });
  }

  const fileId = extractImageFileId(ctx);
  if (!fileId) {
    await ctx.reply(
      'لطفاً یک عکس بفرست (یا فایل تصویری)، یا «⏭ رد کردن» بزن.\nخروج: «❌ انصراف» / «📋 منو» / /cancel',
      { reply_markup: textStepKeyboard({ skip: true }) }
    );
    return true;
  }

  const draft: PetDraft = {
    ...session.draftPet,
    imageUrl: fileId,
  };

  try {
    await finishPetWizard(ctx, telegramId, session.userId!, draft);
  } catch (err) {
    console.error('handlePetPhoto/finishPetWizard failed:', err);
    await ctx.reply('ثبت عکس پت با خطا مواجه شد. دوباره عکس بفرست یا «⏭ رد کردن» بزن.', {
      reply_markup: textStepKeyboard({ skip: true }),
    });
  }
  return true;
}

async function finishPetWizard(
  ctx: Context,
  telegramId: string,
  userId: number,
  draft: PetDraft
): Promise<void> {
  if (!draft.name || !draft.species) {
    await ctx.reply(
      'اطلاعات ثبت ناقص موند (احتمالاً ربات وسط کار ری‌استارت شده).\nلطفاً دوباره «➕ ثبت پت جدید» رو بزن و مراحل رو کامل کن.'
    );
    await upsertSession(telegramId, { step: 'ready', draftPet: undefined, breedPage: undefined });
    return;
  }
  if (!draft.breed?.trim()) {
    await upsertSession(telegramId, { step: 'pet_breed', draftPet: draft, breedPage: 0 });
    await ctx.reply('نژاد الزامی است — لطفاً از لیست انتخاب کن:', {
      reply_markup: breedReplyKeyboard(await listBreeds(draft.species), 0),
    });
    return;
  }

  const health: Record<string, unknown> = {};
  if (draft.diseases) health.diseases = draft.diseases;

  let pet;
  let owner;
  try {
    owner = await getUserByTelegramId(telegramId);
    pet = await createPet({
      ownerId: userId,
      name: draft.name,
      species: draft.species,
      breed: draft.breed,
      gender: draft.gender,
      ageMonths: draft.ageMonths,
      size: draft.size,
      color: draft.color,
      bio: draft.bio,
      vaccinated: draft.vaccinated ?? false,
      neutered: draft.neutered ?? false,
      lookingForPlaymate: draft.lookingForPlaymate ?? true,
      health,
      diseases: draft.diseases,
      imageUrl: draft.imageUrl,
      // مکان از پروفایل مالک می‌آید
      city: owner?.city,
      neighborhood: draft.neighborhood,
    });
    // Refresh owner after no_pet → pet_owner promotion
    owner = await getUserByTelegramId(telegramId);
  } catch (err) {
    console.error('createPet failed:', err);
    await ctx.reply('ثبت پت با خطا مواجه شد. دوباره امتحان کن یا انصراف بزن.', {
      reply_markup: textStepKeyboard(),
    });
    return;
  }

  await upsertSession(telegramId, { step: 'ready', draftPet: undefined, breedPage: undefined });

  const gender = pet.gender ? PET_GENDER_LABELS[pet.gender] : null;
  const size = pet.size ? PET_SIZE_LABELS[pet.size] : null;
  const speciesLabel = PET_SPECIES_LABELS[pet.species] ?? pet.species;
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = [
    `🎉 <b>${escape(pet.name)}</b> با موفقیت ثبت شد!`,
    '',
    `نوع: ${escape(speciesLabel)}`,
    pet.breed ? `نژاد: ${escape(pet.breed)}` : null,
    gender ? `جنسیت: ${gender}` : null,
    pet.ageMonths != null ? `سن: ${formatPetAge(pet.ageMonths)}` : null,
    size ? `اندازه: ${size}` : null,
    pet.color ? `رنگ: ${escape(pet.color)}` : null,
    pet.ownerCity || pet.city
      ? `📍 ${escape([pet.ownerProvince, pet.ownerCity || pet.city].filter(Boolean).join('، '))}`
      : null,
    `واکسن: ${pet.vaccinated ? 'بله' : 'خیر'} · عقیم: ${pet.neutered ? 'بله' : 'خیر'}`,
    pet.lookingForPlaymate ? '🤝 دنبال همبازی' : null,
    owner?.role === 'pet_owner' ? '🐾 نقش فعال: صاحب پت' : null,
  ].filter(Boolean);

  const caption = lines.join('\n');
  const kb = mainMenuKeyboard(owner?.role, owner?.roles, ctx.from?.id, {
    vetOnline: owner?.vetOnline,
    readyToAdopt: owner?.readyToAdopt,
    trainerOnline: owner?.trainerOnline,
    sitterOnline: owner?.sitterOnline,
    acceptSeekerAdvice: owner?.acceptSeekerAdvice,
  });
  const photo = resolveTelegramPhotoUrl(pet.imageUrl);

  if (photo) {
    try {
      await ctx.replyWithPhoto(photo, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    } catch (err) {
      console.warn('pet create photo reply failed:', (err as Error).message);
    }
  }

  try {
    await ctx.reply(caption, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.warn('pet create text reply failed:', (err as Error).message);
    await ctx.reply(`🎉 ${pet.name} ثبت شد!`, { reply_markup: kb });
  }
}

export async function handleAddPetCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const user = await getUserByTelegramId(String(from.id));
    if (!user) {
      await ctx.reply('اول /start بزن.');
      return;
    }
    if (!userHasRole(user, 'pet_owner')) {
      await ctx.reply('ثبت پت فقط برای **صاحب پت** فعاله. نقشت رو در /start عوض کن.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    await startPetWizard(ctx, String(from.id));
  } catch (err) {
    console.error('handleAddPetCommand failed:', err);
    await ctx.reply('شروع ثبت پت با خطا مواجه شد. دوباره امتحان کن.');
  }
}
