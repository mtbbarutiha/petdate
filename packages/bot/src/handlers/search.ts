import type { Context } from 'grammy';
import type { PetBreed, PetProfile, PetSpecies } from '@petdate/shared';
import { PET_SPECIES_LABELS } from '@petdate/shared';
import { getPet, listBreeds, listPets, listSpecies } from '../api-client';
import { formatPet } from '../format';
import {
  BREED_PAGE_SIZE,
  MENU_LABELS,
  SEARCH_PETS_MENU,
  WIZARD_NAV,
  breedReplyKeyboard,
  mainMenuKeyboard,
  searchPetDetailKeyboard,
  searchPetsListKeyboard,
  searchPetsMenuKeyboard,
  speciesReplyKeyboard,
  textStepKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { resolveTelegramPhotoUrl } from '../urls';
import { getCtxUser, menuKeyboardFor } from './helpers';

const PAGE_SIZE = 8;

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

function speciesTitle(code?: string): string {
  if (!code) return '—';
  return PET_SPECIES_LABELS[code] ?? code;
}

export async function handleNearbyPets(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  await upsertSession(String(ctx.from!.id), {
    step: 'ready',
    searchMode: 'nearby',
    searchPage: 0,
    searchBreed: undefined,
    searchSpecies: undefined,
  });

  if (!user.city && !user.province) {
    await ctx.reply(
      [
        '📍 <b>پت‌های نزدیک من</b>',
        '',
        'اول در پروفایل، شهر یا استانت رو ثبت کن تا پت‌های نزدیک رو نشون بدیم.',
      ].join('\n'),
      {
        parse_mode: 'HTML',
        reply_markup: menuKeyboardFor(ctx, user),
      }
    );
    return;
  }

  await showSearchResults(ctx, 'nearby', 0);
}

export async function handleSearchPetsMenu(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (ctx.from) {
    await upsertSession(String(ctx.from.id), {
      step: 'ready',
      searchMode: undefined,
      searchBreed: undefined,
      searchSpecies: undefined,
      searchPage: 0,
      searchBreedPage: undefined,
    });
  }
  await ctx.reply(
    [
      '🔎 <b>جستجوی پت</b>',
      '',
      'یکی رو انتخاب کن:',
      '• گونه → نژاد',
      '• هم‌استان',
      '• مشهد',
      '• همه پت‌ها',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: searchPetsMenuKeyboard(),
    }
  );
  if (user) {
    /* keep search submenu keyboard as primary */
  }
}

/** شروع جستجو بر اساس نژاد: اول گونه */
export async function handleSearchByBreedStart(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  let species: PetSpecies[];
  try {
    species = await listSpecies();
  } catch (err) {
    console.error('listSpecies failed:', err);
    await ctx.reply('لیست گونه در دسترس نیست. کمی بعد دوباره امتحان کن.', {
      reply_markup: searchPetsMenuKeyboard(),
    });
    return;
  }

  if (!species.length) {
    await ctx.reply('لیست گونه خالی است. کمی بعد دوباره امتحان کن.', {
      reply_markup: searchPetsMenuKeyboard(),
    });
    return;
  }

  await upsertSession(String(ctx.from.id), {
    step: 'search_species',
    searchMode: 'breed',
    searchSpecies: undefined,
    searchBreed: undefined,
    searchBreedPage: 0,
    searchPage: 0,
  });
  await ctx.reply('🐾 اول گونه پت رو انتخاب کن (سگ، گربه، …):', {
    reply_markup: speciesReplyKeyboard(species),
  });
}

async function askSearchBreed(ctx: Context, speciesCode: string, page = 0): Promise<void> {
  const breeds = await listBreeds(speciesCode);
  if (breeds.length === 0) {
    await ctx.reply(
      `🧬 نژادی برای «${speciesTitle(speciesCode)}» در کاتالوگ نیست.\nنام نژاد رو بنویس:`,
      { reply_markup: textStepKeyboard() }
    );
    return;
  }
  const totalPages = Math.max(1, Math.ceil(breeds.length / BREED_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  await ctx.reply(
    `🧬 نژاد «${speciesTitle(speciesCode)}» رو انتخاب کن (صفحه ${safePage + 1}/${totalPages}):`,
    { reply_markup: breedReplyKeyboard(breeds, safePage) }
  );
}

export async function handleSearchSameProvince(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!user.province) {
    await ctx.reply('اول در پروفایل استانت رو ثبت کن.', {
      reply_markup: searchPetsMenuKeyboard(),
    });
    return;
  }
  await upsertSession(String(ctx.from!.id), {
    step: 'ready',
    searchMode: 'province',
    searchPage: 0,
  });
  await showSearchResults(ctx, 'province', 0);
}

export async function handleSearchMashhad(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await upsertSession(String(ctx.from.id), {
    step: 'ready',
    searchMode: 'mashhad',
    searchPage: 0,
  });
  await showSearchResults(ctx, 'mashhad', 0);
}

export async function handleSearchAll(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await upsertSession(String(ctx.from.id), {
    step: 'ready',
    searchMode: 'all',
    searchPage: 0,
  });
  await showSearchResults(ctx, 'all', 0);
}

export async function handleSearchPage(
  ctx: Context,
  mode: string,
  page: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showSearchResults(ctx, mode as SearchMode, page, { edit: true });
}

export async function handleSearchMenuCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await handleSearchPetsMenu(ctx);
}

export async function handleSearchHomeCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const user = await getCtxUser(ctx);
  if (ctx.from) {
    await upsertSession(String(ctx.from.id), {
      step: 'ready',
      searchMode: undefined,
      searchPage: undefined,
    });
  }
  await ctx.reply('منوی اصلی 👇', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

/** باز کردن کارت پروفایل پت از لیست جستجو */
export async function handleSearchPetView(ctx: Context, petId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const pet = await getPet(petId);
  if (!pet) {
    await ctx.answerCallbackQuery({ text: 'پت پیدا نشد', show_alert: true });
    return;
  }

  const session = await getSession(String(ctx.from.id));
  const mode = (session?.searchMode ?? 'all') as SearchMode;
  const page = session?.searchPage ?? 0;

  await ctx.answerCallbackQuery();
  const text = `🐾 <b>پروفایل پت</b>\n\n${formatPet(pet, true)}`;
  const kb = searchPetDetailKeyboard(mode, page);
  const photo = resolveTelegramPhotoUrl(pet.imageUrl) || defaultSearchPetPhoto(pet);

  try {
    await ctx.replyWithPhoto(photo, {
      caption: text,
      parse_mode: 'HTML',
      reply_markup: kb,
    });
    return;
  } catch (err) {
    console.warn('search pet photo failed:', (err as Error).message);
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
}

function defaultSearchPetPhoto(pet: { species?: string; id: number }): string {
  const dogs = [
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
  ];
  const cats = [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
  ];
  const pool = pet.species === 'cat' ? cats : dogs;
  return pool[pet.id % pool.length]!;
}

type SearchMode = 'nearby' | 'breed' | 'province' | 'mashhad' | 'all';

async function fetchPetsForMode(
  mode: SearchMode,
  user: { id: number; city?: string; province?: string },
  breed?: string,
  species?: string
): Promise<PetProfile[]> {
  const base = { excludeOwnerId: user.id as number | undefined };
  switch (mode) {
    case 'nearby':
      if (user.city) {
        return listPets({ ...base, city: user.city });
      }
      if (user.province) {
        return listPets({ ...base, province: user.province });
      }
      return [];
    case 'breed':
      if (!breed) return [];
      return listPets({ ...base, breed, ...(species ? { species } : {}) });
    case 'province':
      if (!user.province) return [];
      return listPets({ ...base, province: user.province });
    case 'mashhad':
      return listPets({ ...base, city: 'مشهد' });
    case 'all':
      return listPets({ ...base });
    default:
      return [];
  }
}

function modeTitle(mode: SearchMode, breed?: string, species?: string): string {
  switch (mode) {
    case 'nearby':
      return '📍 پت‌های نزدیک من';
    case 'breed':
      return `🧬 ${speciesTitle(species)}${breed ? ` · ${breed}` : ''}`;
    case 'province':
      return '🗺 پت‌های هم‌استان';
    case 'mashhad':
      return '🏙 پت‌های مشهد';
    case 'all':
      return '🐾 همه پت‌ها';
    default:
      return '🔎 جستجو';
  }
}

async function showSearchResults(
  ctx: Context,
  mode: SearchMode,
  page: number,
  opts?: { edit?: boolean }
): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const session = await getSession(String(ctx.from.id));
  const breed = session?.searchBreed;
  const species = session?.searchSpecies;
  const pets = await fetchPetsForMode(mode, user, breed, species);
  const totalPages = Math.max(1, Math.ceil(pets.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), Math.max(0, totalPages - 1));

  await upsertSession(String(ctx.from.id), {
    searchMode: mode,
    searchPage: safePage,
  });

  if (pets.length === 0) {
    const empty = [
      `<b>${modeTitle(mode, breed, species)}</b>`,
      '',
      'فعلاً پتی با این فیلتر پیدا نشد.',
    ].join('\n');
    const emptyKb =
      mode === 'nearby'
        ? menuKeyboardFor(ctx, user)
        : searchPetsMenuKeyboard();

    if (opts?.edit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(empty, { parse_mode: 'HTML' });
        await ctx.reply(
          mode === 'nearby' ? 'منوی اصلی 👇' : 'جستجوی پت 👇',
          { reply_markup: emptyKb }
        );
        return;
      } catch {
        /* fall through */
      }
    }
    await ctx.reply(empty, {
      parse_mode: 'HTML',
      reply_markup: emptyKb,
    });
    return;
  }

  const text = [
    `<b>${modeTitle(mode, breed, species)}</b>`,
    `📋 ${pets.length} پت — روی هر مورد بزن تا پروفایل باز بشه`,
    totalPages > 1 ? `صفحه ${safePage + 1} از ${totalPages}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const kb = searchPetsListKeyboard(pets, mode, safePage, PAGE_SIZE);

  if (opts?.edit && ctx.callbackQuery) {
    try {
      const msg = ctx.callbackQuery.message;
      if (msg && 'photo' in msg && msg.photo) {
        // برگشت از کارت عکس — پیام جدید لیست
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
        return;
      }
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* fall through to reply */
    }
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });

  // کیبورد reply منو را یک‌بار نگه می‌داریم (نه روی هر صفحه)
  if (!opts?.edit) {
    if (mode === 'nearby') {
      await ctx.reply('منوی اصلی 👇', {
        reply_markup: menuKeyboardFor(ctx, user),
      });
    } else {
      await ctx.reply('جستجوی پت 👇', { reply_markup: searchPetsMenuKeyboard() });
    }
  }
}

function isSearchSubmenuNav(text: string): boolean {
  return (
    text === SEARCH_PETS_MENU.sameProvince ||
    text === SEARCH_PETS_MENU.mashhad ||
    text === SEARCH_PETS_MENU.allPets ||
    text === SEARCH_PETS_MENU.backToMenu
  );
}

/** متن در حالت انتخاب گونه / نژاد برای جستجو */
export async function handleSearchBreedText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getSession(String(from.id));
  if (!session) return false;

  if (session.step === 'search_species') {
    return handleSearchSpeciesText(ctx, text);
  }
  if (session.step === 'search_breed') {
    return handleSearchBreedPickText(ctx, text, session);
  }
  return false;
}

async function handleSearchSpeciesText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from!;
  const telegramId = String(from.id);

  if (MENU_LABELS.has(text) && !Object.values(SEARCH_PETS_MENU).includes(text as never)) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchSpecies: undefined,
      searchBreed: undefined,
      searchBreedPage: undefined,
    });
    return false;
  }

  if (text === SEARCH_PETS_MENU.byBreed) {
    return true;
  }
  if (isSearchSubmenuNav(text)) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchSpecies: undefined,
      searchBreedPage: undefined,
    });
    return false;
  }

  if (text === WIZARD_NAV.cancel || text === WIZARD_NAV.back || text === SEARCH_PETS_MENU.backToMenu) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchSpecies: undefined,
      searchBreedPage: undefined,
    });
    await handleSearchPetsMenu(ctx);
    return true;
  }

  let speciesList: PetSpecies[];
  try {
    speciesList = await listSpecies();
  } catch {
    await ctx.reply('خطا در دریافت گونه. دوباره امتحان کن.', {
      reply_markup: searchPetsMenuKeyboard(),
    });
    return true;
  }

  const matched = matchSpecies(text, speciesList);
  if (!matched) {
    await ctx.reply('از دکمه‌ها گونه رو انتخاب کن:', {
      reply_markup: speciesReplyKeyboard(speciesList),
    });
    return true;
  }

  await upsertSession(telegramId, {
    step: 'search_breed',
    searchMode: 'breed',
    searchSpecies: matched.code,
    searchBreed: undefined,
    searchBreedPage: 0,
    searchPage: 0,
  });
  await askSearchBreed(ctx, matched.code, 0);
  return true;
}

async function handleSearchBreedPickText(
  ctx: Context,
  text: string,
  session: { searchSpecies?: string; searchBreedPage?: number }
): Promise<boolean> {
  const from = ctx.from!;
  const telegramId = String(from.id);
  const speciesCode = session.searchSpecies;

  if (MENU_LABELS.has(text) && !Object.values(SEARCH_PETS_MENU).includes(text as never)) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchBreedPage: undefined,
      searchSpecies: undefined,
    });
    return false;
  }

  if (text === SEARCH_PETS_MENU.byBreed) {
    // شروع دوباره از گونه
    await handleSearchByBreedStart(ctx);
    return true;
  }
  if (isSearchSubmenuNav(text)) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchBreedPage: undefined,
      searchSpecies: undefined,
    });
    return false;
  }

  if (text === WIZARD_NAV.cancel || text === SEARCH_PETS_MENU.backToMenu) {
    await upsertSession(telegramId, {
      step: 'ready',
      searchBreedPage: undefined,
      searchSpecies: undefined,
    });
    await handleSearchPetsMenu(ctx);
    return true;
  }

  if (text === WIZARD_NAV.back) {
    // بازگشت به انتخاب گونه
    let speciesList: PetSpecies[];
    try {
      speciesList = await listSpecies();
    } catch {
      await handleSearchPetsMenu(ctx);
      return true;
    }
    await upsertSession(telegramId, {
      step: 'search_species',
      searchBreed: undefined,
      searchBreedPage: undefined,
    });
    await ctx.reply('🐾 گونه پت رو انتخاب کن:', {
      reply_markup: speciesReplyKeyboard(speciesList),
    });
    return true;
  }

  const breeds = speciesCode ? await listBreeds(speciesCode) : await listBreeds();
  const page = session.searchBreedPage ?? 0;
  const totalPages = Math.max(1, Math.ceil(Math.max(breeds.length, 1) / BREED_PAGE_SIZE));

  if (text === WIZARD_NAV.custom) {
    await ctx.reply('نام نژاد را بنویس:', {
      reply_markup: breedReplyKeyboard(breeds, page),
    });
    return true;
  }

  if (/^\d+\/\d+$/.test(text.trim())) {
    return true;
  }

  if (text === WIZARD_NAV.nextPage) {
    const next = Math.min(totalPages - 1, page + 1);
    await upsertSession(telegramId, { searchBreedPage: next });
    if (speciesCode) await askSearchBreed(ctx, speciesCode, next);
    return true;
  }

  if (text === WIZARD_NAV.prevPage) {
    const prev = Math.max(0, page - 1);
    await upsertSession(telegramId, { searchBreedPage: prev });
    if (speciesCode) await askSearchBreed(ctx, speciesCode, prev);
    return true;
  }

  const matched = breeds.find((b: PetBreed) => b.nameFa === text.trim());
  const breedName = matched?.nameFa ?? (text.trim().length >= 2 ? text.trim().slice(0, 80) : null);
  if (!breedName) {
    await ctx.reply('از لیست نژاد انتخاب کن یا نام نژاد رو بنویس.', {
      reply_markup: breedReplyKeyboard(breeds, page),
    });
    return true;
  }

  await upsertSession(telegramId, {
    step: 'ready',
    searchMode: 'breed',
    searchBreed: breedName,
    searchPage: 0,
    searchBreedPage: undefined,
  });
  await showSearchResults(ctx, 'breed', 0);
  return true;
}
