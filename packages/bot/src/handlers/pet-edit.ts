import type { Context } from 'grammy';
import type { BotStep, PetDraft, PetGender, PetProfile, PetSize, PetSpecies } from '@petdate/shared';
import {
  PET_AGE_CUSTOM_LABEL,
  PET_COLOR_CUSTOM_LABEL,
  PET_COLOR_OPTIONS,
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_SPECIES_LABELS,
  formatPetAge,
  parsePetAgeInput,
} from '@petdate/shared';
import { getPet, listBreeds, listSpecies, updatePet } from '../api-client';
import {
  BREED_PAGE_SIZE,
  LOOKING_NO_LABEL,
  LOOKING_YES_LABEL,
  MENU_LABELS,
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
  myPetsSectionKeyboard,
  neuteredReplyKeyboard,
  petAgeReplyKeyboard,
  petColorReplyKeyboard,
  petEditSectionsKeyboard,
  petGenderReplyKeyboard,
  petSizeReplyKeyboard,
  speciesReplyKeyboard,
  textStepKeyboard,
  vaccinatedReplyKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { getCtxUser } from './helpers';
import { handleMyPetView } from './playdates';

export type PetEditField =
  | 'name'
  | 'species'
  | 'age'
  | 'gender'
  | 'size'
  | 'color'
  | 'photo'
  | 'bio'
  | 'vaccinated'
  | 'neutered'
  | 'looking'
  | 'diseases';

function draftFromPet(pet: PetProfile): PetDraft {
  const diseases =
    typeof pet.health?.diseases === 'string' ? (pet.health.diseases as string) : undefined;
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    gender: pet.gender,
    ageMonths: pet.ageMonths,
    size: pet.size,
    color: pet.color,
    vaccinated: pet.vaccinated,
    neutered: pet.neutered,
    lookingForPlaymate: pet.lookingForPlaymate,
    diseases,
    bio: pet.bio,
    imageUrl: pet.imageUrl,
    city: pet.city,
    neighborhood: pet.neighborhood,
  };
}

async function requireOwnedPet(
  ctx: Context,
  petId: number
): Promise<{ userId: number; pet: PetProfile } | null> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    } else {
      await ctx.reply('اول /start بزن.');
    }
    return null;
  }
  const pet = await getPet(petId);
  if (!pet || pet.ownerId !== user.id) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'پت پیدا نشد', show_alert: true });
    } else {
      await ctx.reply('پت پیدا نشد یا مال تو نیست.');
    }
    return null;
  }
  return { userId: user.id, pet };
}

export async function showPetEditMenu(ctx: Context, petId: number): Promise<void> {
  const owned = await requireOwnedPet(ctx, petId);
  if (!owned) return;

  const from = ctx.from;
  if (from) {
    await upsertSession(String(from.id), {
      step: 'pet_edit_menu',
      selectedPetId: petId,
      petSectionEdit: true,
      draftPet: draftFromPet(owned.pet),
      breedPage: undefined,
    });
  }

  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }
  }

  await ctx.reply(
    [
      `✏️ <b>ویرایش پروفایل — ${escapeHtml(owned.pet.name)}</b>`,
      '',
      'کدام بخش رو می‌خوای تغییر بدی؟',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: petEditSectionsKeyboard(petId),
    }
  );
}

export async function startPetSectionEdit(
  ctx: Context,
  petId: number,
  field: PetEditField
): Promise<void> {
  const owned = await requireOwnedPet(ctx, petId);
  if (!owned) return;

  const from = ctx.from;
  if (!from) return;
  const telegramId = String(from.id);
  const draft = draftFromPet(owned.pet);

  const stepByField: Record<PetEditField, BotStep> = {
    name: 'pet_name',
    species: 'pet_species',
    age: 'pet_age',
    gender: 'pet_gender',
    size: 'pet_size',
    color: 'pet_color',
    photo: 'pet_photo',
    bio: 'pet_bio',
    vaccinated: 'pet_vaccinated',
    neutered: 'pet_neutered',
    looking: 'pet_looking',
    diseases: 'pet_diseases',
  };

  await upsertSession(telegramId, {
    userId: owned.userId,
    step: stepByField[field],
    selectedPetId: petId,
    petSectionEdit: true,
    draftPet: draft,
    breedPage: 0,
  });

  try {
    await ctx.answerCallbackQuery();
  } catch {
    /* ignore */
  }

  await promptPetEditField(ctx, stepByField[field], draft, 0);
}

async function promptPetEditField(
  ctx: Context,
  step: BotStep,
  draft: PetDraft,
  breedPage: number
): Promise<void> {
  switch (step) {
    case 'pet_name':
      await ctx.reply('✏️ <b>ویرایش نام</b>\n\nنام جدید پت رو بنویس:', {
        parse_mode: 'HTML',
        reply_markup: textStepKeyboard({ noBack: true }),
      });
      return;
    case 'pet_species': {
      const species = await listSpecies();
      if (!species.length) {
        await ctx.reply('لیست نوع پت در دسترس نیست.', { reply_markup: textStepKeyboard() });
        return;
      }
      await ctx.reply('🧬 <b>ویرایش نوع</b>\n\nنوع پت رو انتخاب کن:', {
        parse_mode: 'HTML',
        reply_markup: speciesReplyKeyboard(species),
      });
      return;
    }
    case 'pet_breed':
      await askEditBreed(ctx, draft.species ?? 'other', breedPage);
      return;
    case 'pet_gender':
      await ctx.reply('⚧ <b>ویرایش جنسیت</b>\n\nجنسیت پت رو انتخاب کن:', {
        parse_mode: 'HTML',
        reply_markup: petGenderReplyKeyboard(),
      });
      return;
    case 'pet_age':
      await ctx.reply('🎂 <b>ویرایش سن</b>\n\nسن پت رو انتخاب کن یا عدد بنویس:', {
        parse_mode: 'HTML',
        reply_markup: petAgeReplyKeyboard(),
      });
      return;
    case 'pet_size':
      await ctx.reply('📏 <b>ویرایش اندازه</b>\n\nاندازه پت رو انتخاب کن:', {
        parse_mode: 'HTML',
        reply_markup: petSizeReplyKeyboard(),
      });
      return;
    case 'pet_color':
      await ctx.reply('🎨 <b>ویرایش رنگ</b>\n\nرنگ پت رو انتخاب کن یا بنویس:', {
        parse_mode: 'HTML',
        reply_markup: petColorReplyKeyboard(),
      });
      return;
    case 'pet_vaccinated':
      await ctx.reply('💉 <b>ویرایش واکسن</b>\n\nوضعیت واکسن رو انتخاب کن:', {
        parse_mode: 'HTML',
        reply_markup: vaccinatedReplyKeyboard(),
      });
      return;
    case 'pet_neutered':
      await ctx.reply('✂️ <b>ویرایش عقیم‌سازی</b>\n\nوضعیت رو انتخاب کن:', {
        parse_mode: 'HTML',
        reply_markup: neuteredReplyKeyboard(),
      });
      return;
    case 'pet_diseases':
      await ctx.reply('🏥 <b>ویرایش بیماری/حساسیت</b>\n\nبنویس یا رد کن:', {
        parse_mode: 'HTML',
        reply_markup: textStepKeyboard({ skip: true, noBack: true }),
      });
      return;
    case 'pet_looking':
      await ctx.reply('🤝 <b>ویرایش همبازی</b>\n\nدنبال همبازی هست؟', {
        parse_mode: 'HTML',
        reply_markup: lookingReplyKeyboard(),
      });
      return;
    case 'pet_bio':
      await ctx.reply('💬 <b>ویرایش بیو</b>\n\nچند خط درباره پت بنویس یا رد کن:', {
        parse_mode: 'HTML',
        reply_markup: textStepKeyboard({ skip: true, noBack: true }),
      });
      return;
    case 'pet_photo':
      await ctx.reply('🖼 <b>ویرایش عکس</b>\n\nیک عکس جدید بفرست یا رد کن:', {
        parse_mode: 'HTML',
        reply_markup: textStepKeyboard({ skip: true, noBack: true }),
      });
      return;
    default:
      return;
  }
}

async function askEditBreed(ctx: Context, species: string, page: number, filterQ?: string): Promise<void> {
  const breeds = await listBreeds(species, filterQ);
  if (!breeds.length && !filterQ) {
    await ctx.reply('🧬 <b>ویرایش نژاد</b>\n\nنژادی در کاتالوگ این نوع نیست.', {
      parse_mode: 'HTML',
      reply_markup: textStepKeyboard({ noBack: true }),
    });
    return;
  }
  if (!breeds.length && filterQ) {
    await ctx.reply(`چیزی با «${filterQ}» پیدا نشد. عبارت دیگری بنویس:`, {
      reply_markup: breedReplyKeyboard(await listBreeds(species), 0),
    });
    return;
  }
  const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const filterNote = filterQ ? `\n🔍 فیلتر: ${filterQ}` : '\nبرای جستجو بخشی از نام را بنویس.';
  await ctx.reply(
    `🧬 <b>ویرایش نژاد</b>\n\nنژاد رو از لیست انتخاب کن (صفحه ${safePage + 1}/${totalPages}):${filterNote}`,
    {
      parse_mode: 'HTML',
      reply_markup: breedReplyKeyboard(breeds, safePage),
    }
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function finishPetField(
  ctx: Context,
  telegramId: string,
  ownerId: number,
  petId: number,
  patch: Parameters<typeof updatePet>[2],
  successMsg: string
): Promise<void> {
  try {
    await updatePet(petId, ownerId, patch);
  } catch (err) {
    console.error('updatePet failed:', err);
    await ctx.reply('ذخیره نشد. دوباره تلاش کن.');
    return;
  }

  await upsertSession(telegramId, {
    step: 'ready',
    draftPet: undefined,
    petSectionEdit: false,
    selectedPetId: undefined,
    breedPage: undefined,
  });

  await ctx.reply(`✅ ${successMsg}`, { reply_markup: myPetsSectionKeyboard() });
  await handleMyPetView(ctx, petId);
}

function parseYesNo(text: string): boolean | null {
  const t = text.trim();
  if (t === 'بله' || t === 'آره' || t === YES_LABEL) return true;
  if (t === 'خیر' || t === 'نه' || t === NO_LABEL) return false;
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

/** true اگر در حالت ویرایش پت هستیم و پیام را خوردیم */
export async function handlePetEditText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session?.petSectionEdit || !session.selectedPetId) return false;
  if (session.step === 'pet_edit_menu') return false;
  if (!String(session.step).startsWith('pet_')) return false;

  const petId = session.selectedPetId;
  const owned = await requireOwnedPet(ctx, petId);
  if (!owned) {
    await upsertSession(telegramId, {
      step: 'ready',
      petSectionEdit: false,
      selectedPetId: undefined,
      draftPet: undefined,
    });
    return true;
  }

  const draft: PetDraft = { ...session.draftPet };
  let breedPage = session.breedPage ?? 0;

  if (text === WIZARD_NAV.cancel) {
    await upsertSession(telegramId, {
      step: 'pet_edit_menu',
      draftPet: draftFromPet(owned.pet),
      breedPage: undefined,
    });
    await ctx.reply('ویرایش این بخش لغو شد.');
    await showPetEditMenu(ctx, petId);
    return true;
  }

  if (text === WIZARD_NAV.back) {
    if (session.step === 'pet_breed') {
      await upsertSession(telegramId, { step: 'pet_species', draftPet: draft, breedPage: 0 });
      await promptPetEditField(ctx, 'pet_species', draft, 0);
      return true;
    }
    await upsertSession(telegramId, {
      step: 'pet_edit_menu',
      draftPet: draftFromPet(owned.pet),
      breedPage: undefined,
    });
    await showPetEditMenu(ctx, petId);
    return true;
  }

  if (text === WIZARD_NAV.skip) {
    if (session.step === 'pet_breed') {
      await finishPetField(
        ctx,
        telegramId,
        owned.userId,
        petId,
        { species: draft.species!, breed: '' },
        'نوع پت ذخیره شد'
      );
      return true;
    }
    if (session.step === 'pet_diseases') {
      await finishPetField(ctx, telegramId, owned.userId, petId, { diseases: '' }, 'بیماری‌ها پاک شد');
      return true;
    }
    if (session.step === 'pet_bio') {
      await finishPetField(ctx, telegramId, owned.userId, petId, { bio: '' }, 'بیو پاک شد');
      return true;
    }
    if (session.step === 'pet_photo') {
      await upsertSession(telegramId, {
        step: 'ready',
        petSectionEdit: false,
        selectedPetId: undefined,
        draftPet: undefined,
      });
      await ctx.reply('عکس تغییر نکرد.', { reply_markup: myPetsSectionKeyboard() });
      await handleMyPetView(ctx, petId);
      return true;
    }
    if (session.step === 'pet_color') {
      await finishPetField(ctx, telegramId, owned.userId, petId, { color: '' }, 'رنگ پاک شد');
      return true;
    }
    await showPetEditMenu(ctx, petId);
    return true;
  }

  // Pagination for breeds
  if (session.step === 'pet_breed') {
    const breeds = draft.species ? await listBreeds(draft.species) : [];
    const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));
    if (text === WIZARD_NAV.nextPage && breedPage < totalPages - 1) {
      breedPage += 1;
      await upsertSession(telegramId, { breedPage });
      await askEditBreed(ctx, draft.species ?? 'other', breedPage);
      return true;
    }
    if (text === WIZARD_NAV.prevPage && breedPage > 0) {
      breedPage -= 1;
      await upsertSession(telegramId, { breedPage });
      await askEditBreed(ctx, draft.species ?? 'other', breedPage);
      return true;
    }
    if (text === WIZARD_NAV.custom) {
      await ctx.reply('نژاد را فقط از لیست انتخاب کن یا برای جستجو بخشی از نام را بنویس.', {
        reply_markup: breedReplyKeyboard(breeds, breedPage),
      });
      return true;
    }
    if (breeds.some((b) => b.nameFa === text)) {
      await finishPetField(
        ctx,
        telegramId,
        owned.userId,
        petId,
        { species: draft.species, breed: text },
        `نژاد ذخیره شد: ${text}`
      );
      return true;
    }
    if (text.length >= 1 && text.length <= 60 && !MENU_LABELS.has(text)) {
      const filtered = draft.species ? await listBreeds(draft.species, text) : [];
      if (filtered.length === 1) {
        const nameFa = filtered[0]!.nameFa;
        await finishPetField(
          ctx,
          telegramId,
          owned.userId,
          petId,
          { species: draft.species, breed: nameFa },
          `نژاد ذخیره شد: ${nameFa}`
        );
        return true;
      }
      await upsertSession(telegramId, { breedPage: 0 });
      await askEditBreed(ctx, draft.species ?? 'other', 0, text);
      return true;
    }
    await askEditBreed(ctx, draft.species ?? 'other', breedPage);
    return true;
  }

  if (session.step === 'pet_name') {
    const name = text.trim().slice(0, 40);
    if (name.length < 1 || MENU_LABELS.has(text)) {
      await ctx.reply('یک نام معتبر بنویس:', { reply_markup: textStepKeyboard({ noBack: true }) });
      return true;
    }
    await finishPetField(ctx, telegramId, owned.userId, petId, { name }, `نام ذخیره شد: ${name}`);
    return true;
  }

  if (session.step === 'pet_species') {
    const speciesList = await listSpecies();
    const matched = matchSpecies(text, speciesList);
    if (!matched) {
      await ctx.reply('از دکمه‌ها نوع پت رو انتخاب کن:', {
        reply_markup: speciesReplyKeyboard(speciesList),
      });
      return true;
    }
    draft.species = matched.code;
    draft.breed = undefined;
    await upsertSession(telegramId, { step: 'pet_breed', draftPet: draft, breedPage: 0 });
    await askEditBreed(ctx, matched.code, 0);
    return true;
  }

  if (session.step === 'pet_gender') {
    const gender = parsePetGender(text);
    if (!gender) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: petGenderReplyKeyboard() });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { gender },
      `جنسیت: ${PET_GENDER_LABELS[gender]}`
    );
    return true;
  }

  if (session.step === 'pet_age') {
    if (text === PET_AGE_CUSTOM_LABEL) {
      await ctx.reply(
        [
          'سن رو بنویس، مثلاً:',
          '• ۱۸ ماه / ۸ ماهه',
          '• ۲ سال / ۲ ساله',
          '• فقط عدد ۲ (= ۲ ساله)',
        ].join('\n'),
        { reply_markup: textStepKeyboard({ noBack: true }) }
      );
      return true;
    }
    const ageMonths = parsePetAgeInput(text);
    if (ageMonths == null || ageMonths < 0 || ageMonths > 600) {
      await ctx.reply('سن معتبر نیست. از دکمه‌ها انتخاب کن یا عدد بنویس:', {
        reply_markup: petAgeReplyKeyboard(),
      });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { ageMonths },
      `سن ذخیره شد: ${formatPetAge(ageMonths)}`
    );
    return true;
  }

  if (session.step === 'pet_size') {
    const size = parsePetSize(text);
    if (!size) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: petSizeReplyKeyboard() });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { size },
      `اندازه: ${PET_SIZE_LABELS[size]}`
    );
    return true;
  }

  if (session.step === 'pet_color') {
    if (text === PET_COLOR_CUSTOM_LABEL) {
      await ctx.reply('رنگ رو بنویس:', { reply_markup: textStepKeyboard({ skip: true }) });
      return true;
    }
    const t = text.trim();
    if (!t || MENU_LABELS.has(t)) {
      await ctx.reply('رنگ رو انتخاب کن یا بنویس:', { reply_markup: petColorReplyKeyboard() });
      return true;
    }
    const color =
      (PET_COLOR_OPTIONS as readonly string[]).includes(t) || (t.length >= 1 && t.length <= 60)
        ? t.slice(0, 60)
        : null;
    if (!color) {
      await ctx.reply('رنگ معتبر نیست.', { reply_markup: petColorReplyKeyboard() });
      return true;
    }
    await finishPetField(ctx, telegramId, owned.userId, petId, { color }, `رنگ ذخیره شد: ${color}`);
    return true;
  }

  if (session.step === 'pet_vaccinated') {
    const vaccinated = parseVaccinated(text);
    if (vaccinated == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: vaccinatedReplyKeyboard() });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { vaccinated },
      `واکسن: ${vaccinated ? 'بله' : 'خیر'}`
    );
    return true;
  }

  if (session.step === 'pet_neutered') {
    const neutered = parseNeutered(text);
    if (neutered == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: neuteredReplyKeyboard() });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { neutered },
      `عقیم: ${neutered ? 'بله' : 'خیر'}`
    );
    return true;
  }

  if (session.step === 'pet_looking') {
    const looking = parseLooking(text);
    if (looking == null) {
      await ctx.reply('از دکمه‌ها انتخاب کن:', { reply_markup: lookingReplyKeyboard() });
      return true;
    }
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { lookingForPlaymate: looking },
      looking ? 'دنبال همبازی: بله' : 'دنبال همبازی: فعلاً نه'
    );
    return true;
  }

  if (session.step === 'pet_diseases') {
    const diseases = text.trim().slice(0, 200);
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { diseases },
      diseases ? 'بیماری/حساسیت ذخیره شد' : 'بیماری‌ها پاک شد'
    );
    return true;
  }

  if (session.step === 'pet_bio') {
    const bio = text.trim().slice(0, 500);
    await finishPetField(
      ctx,
      telegramId,
      owned.userId,
      petId,
      { bio },
      bio ? 'بیو ذخیره شد' : 'بیو پاک شد'
    );
    return true;
  }

  if (session.step === 'pet_photo') {
    await ctx.reply('لطفاً یک عکس بفرست یا «⏭ رد کردن» بزن.', {
      reply_markup: textStepKeyboard({ skip: true, noBack: true }),
    });
    return true;
  }

  return true;
}

export async function handlePetEditPhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const photos = ctx.message?.photo;
  if (!from || !photos?.length) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session?.petSectionEdit || session.step !== 'pet_photo' || !session.selectedPetId) {
    return false;
  }

  const petId = session.selectedPetId;
  const owned = await requireOwnedPet(ctx, petId);
  if (!owned) return true;

  const best = photos[photos.length - 1]!;
  await finishPetField(
    ctx,
    telegramId,
    owned.userId,
    petId,
    { imageUrl: best.file_id },
    'عکس پروفایل پت ذخیره شد'
  );
  return true;
}
