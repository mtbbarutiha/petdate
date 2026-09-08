import type { Context } from 'grammy';
import { InlineKeyboard, InputFile } from 'grammy';
import type { PetBreed, PetProfile, PetSpecies } from '@petdate/shared';
import {
  PET_GENDER_LABELS,
  PET_SPECIES_LABELS,
  formatPetAge,
  petPublicIdOf,
  userCommandIdOf,
} from '@petdate/shared';
import {
  fetchNearbyListCardBuffer,
  fetchPetProfileCardBuffer,
  getPet,
  getUserById,
  listBreeds,
  listNearbyPets,
  listPets,
  listSpecies,
  saveUserLocation,
} from '../api-client';
import { formatPet } from '../format';
import {
  BREED_PAGE_SIZE,
  MENU_LABELS,
  NEARBY_RADII_KM,
  SEARCH_PETS_MENU,
  WIZARD_NAV,
  breedReplyKeyboard,
  nearbyLocationKeyboard,
  nearbyRadiusKeyboard,
  nearbySummaryKeyboard,
  nearbyVisualListKeyboard,
  searchPetDetailKeyboard,
  searchPetsListKeyboard,
  searchPetsMenuKeyboard,
  speciesReplyKeyboard,
  textStepKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { resolveTelegramPhotoUrl } from '../urls';
import { getCtxUser, pushMainMenuKeyboard, pushReplyKeyboard } from './helpers';
import { replyWithOwnerProfile } from './owner-chat';

const PAGE_SIZE = 8;
const NEARBY_LIMIT = 80;
const NEARBY_LIST_PAGE_SIZE = 8;

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

function toFaDigits(text: string | number): string {
  return String(text ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}

function formatDistanceCaption(km: number | undefined | null): string {
  if (km == null || !Number.isFinite(km)) return 'نامشخص';
  if (km < 0.1) return 'نزدیک';
  if (km < 1) return `${toFaDigits(Math.round(km * 1000))} متر`;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${toFaDigits(rounded)} کیلومتر`;
}

/** ورود به پت‌های نزدیک — اول دکمه ارسال موقعیت */
export async function handleNearbyPets(ctx: Context): Promise<void> {
  await askNearbyLocation(ctx);
}

/** درخواست موقعیت (منو یا دکمه «موقعیت دوباره») */
export async function askNearbyLocation(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  await upsertSession(String(ctx.from.id), {
    step: 'awaiting_location_for_nearby',
    searchMode: 'nearby',
    searchPage: 0,
    searchBreed: undefined,
    searchSpecies: undefined,
    searchLat: undefined,
    searchLng: undefined,
    searchRadiusKm: undefined,
  });

  const text = [
    '📍 <b>پت‌های نزدیک</b>',
    '',
    'موقعیتت رو بفرست تا اطراف تو رو برای پت و صاحب‌پتشون بگردم.',
    '',
    `دکمه <b>«${WIZARD_NAV.shareLocation}»</b> رو بزن.`,
  ].join('\n');

  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: nearbyLocationKeyboard(),
  });
}

export async function handleSearchNearbyAskLocCallback(ctx: Context): Promise<void> {
  await askNearbyLocation(ctx);
}

/** نمایش انتخاب شعاع بعد از ذخیره موقعیت */
export async function showNearbyRadiusPicker(ctx: Context): Promise<void> {
  const text = [
    '🛰️ <b>جستجوی پت‌های نزدیک</b>',
    '',
    'تا چه فاصله‌ای اطراف تو را بگردم؟ نتایج بر اساس فاصله واقعی لوکیشن (GPS) است.',
    'یکی از شعاع‌های ۵ تا ۱۰۰ کیلومتر را بزن:',
  ].join('\n');
  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: nearbyRadiusKeyboard(),
  });
}

/**
 * دریافت موقعیت تلگرام وقتی کاربر در حالت awaiting_location_for_nearby است.
 * @returns true اگر پیام مصرف شد
 */
export async function handleNearbyLocationMessage(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const loc = ctx.message?.location;
  if (!from || !loc) return false;

  const session = await getSession(String(from.id));
  if (!session || session.step !== 'awaiting_location_for_nearby') {
    return false;
  }

  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.reply('اول /start بزن.');
    return true;
  }

  const lat = loc.latitude;
  const lng = loc.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    await ctx.reply('موقعیت نامعتبر بود. دوباره «ارسال موقعیت» رو بزن.', {
      reply_markup: nearbyLocationKeyboard(),
    });
    return true;
  }

  await saveUserLocation(String(from.id), lat, lng);

  await upsertSession(String(from.id), {
    step: 'awaiting_nearby_radius',
    searchMode: 'nearby',
    searchLat: lat,
    searchLng: lng,
    searchPage: 0,
    searchRadiusKm: undefined,
  });

  await ctx.reply('✅ موقعیت ذخیره شد. حالا شعاع فاصله را انتخاب کن:');
  await showNearbyRadiusPicker(ctx);
  await pushMainMenuKeyboard(ctx, user);
  return true;
}

async function safeAnswerNearbyCallback(
  ctx: Context,
  opts?: { text?: string; show_alert?: boolean }
): Promise<void> {
  if (!ctx.callbackQuery) return;
  try {
    await ctx.answerCallbackQuery(opts);
  } catch {
    /* query expired / already answered */
  }
}

/** پاسخ روی همان پیام اینلاین (در صورت امکان) تا دکمه «مرده» به نظر نرسد */
async function replyNearbyMarkup(
  ctx: Context,
  text: string,
  reply_markup: InlineKeyboard
): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup });
      return;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // پیام عوض نشده — برای کاربر همان نتیجه است
      if (/message is not modified/i.test(msg)) return;
      /* fall through to reply */
    }
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup });
}

export async function handleNearbyPickRadiusCallback(ctx: Context): Promise<void> {
  await safeAnswerNearbyCallback(ctx);
  const session = ctx.from ? await getSession(String(ctx.from.id)) : null;
  if (
    session?.searchLat == null ||
    session?.searchLng == null ||
    !Number.isFinite(session.searchLat) ||
    !Number.isFinite(session.searchLng)
  ) {
    await askNearbyLocation(ctx);
    return;
  }
  await upsertSession(String(ctx.from!.id), { step: 'awaiting_nearby_radius' });
  await showNearbyRadiusPicker(ctx);
}

/**
 * انتخاب شعاع ۵/۱۰/۲۰/۵۰/۱۰۰ — باید فوراً callback را ACK کند
 * (force-join + getCtxUser قبل از answer باعث timeout و دکمه مرده در کلاینت می‌شود).
 */
export async function handleNearbyRadiusCallback(ctx: Context, radiusKm: number): Promise<void> {
  if (!(NEARBY_RADII_KM as readonly number[]).includes(radiusKm)) {
    await safeAnswerNearbyCallback(ctx, { text: 'شعاع نامعتبر', show_alert: true });
    return;
  }
  if (!ctx.from) {
    await safeAnswerNearbyCallback(ctx, { text: 'اول /start بزن', show_alert: true });
    return;
  }

  // فوری — قبل از هر I/O دیگر
  await safeAnswerNearbyCallback(ctx, {
    text: `جستجو تا ${toFaDigits(radiusKm)} کیلومتر…`,
  });

  console.log(`nearby:radius tapped by ${ctx.from.id} radiusKm=${radiusKm}`);

  try {
    const user = await getCtxUser(ctx);
    if (!user?.id) {
      await ctx.reply('اول /start بزن.');
      return;
    }

    const session = await getSession(String(ctx.from.id));
    const lat = session?.searchLat;
    const lng = session?.searchLng;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      await askNearbyLocation(ctx);
      return;
    }

    // step را روی awaiting نگه می‌داریم تا اگر خلاصه ۰ شد، دکمه‌های شعاع هنوز معنی‌دار باشند
    await upsertSession(String(ctx.from.id), {
      step: 'awaiting_nearby_radius',
      searchMode: 'nearby',
      searchRadiusKm: radiusKm,
      searchPage: 0,
    });

    await showNearbySummary(ctx, radiusKm);
  } catch (err) {
    console.warn('nearby radius callback failed:', (err as Error).message);
    try {
      await ctx.reply('خطا در جستجوی نزدیک. دوباره یکی از دکمه‌های شعاع را بزن.');
    } catch {
      /* ignore */
    }
  }
}

export async function handleNearbySummaryCallback(ctx: Context): Promise<void> {
  await safeAnswerNearbyCallback(ctx);
  const session = ctx.from ? await getSession(String(ctx.from.id)) : null;
  const radiusKm = session?.searchRadiusKm ?? 5;
  await showNearbySummary(ctx, radiusKm);
}

async function showNearbySummary(ctx: Context, radiusKm: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const session = await getSession(String(ctx.from.id));
  const lat = session?.searchLat;
  const lng = session?.searchLng;
  if (lat == null || lng == null) {
    await askNearbyLocation(ctx);
    return;
  }

  let pets: PetProfile[] = [];
  try {
    pets = await listNearbyPets({
      lat,
      lng,
      excludeOwnerId: user.id,
      limit: NEARBY_LIMIT,
      radiusKm,
    });
  } catch (err) {
    console.warn('nearby summary list failed:', (err as Error).message);
  }

  if (pets.length === 0) {
    await upsertSession(String(ctx.from.id), { step: 'awaiting_nearby_radius' });
    await replyNearbyMarkup(
      ctx,
      [
        `🛰️ <b>اطراف من ≤ ${toFaDigits(radiusKm)} کیلومتر (۰)</b>`,
        '',
        'هنوز کسی داخل این شعاع پیدا نشد.',
        'شعاع بزرگ‌تر انتخاب کن یا موقعیتت رو به‌روز کن.',
      ].join('\n'),
      nearbyRadiusKeyboard()
    );
    return;
  }

  await upsertSession(String(ctx.from.id), { step: 'ready' });

  const text = [
    `🛰️ <b>اطراف من ≤ ${toFaDigits(radiusKm)} کیلومتر (${toFaDigits(pets.length)})</b>`,
    '',
    'برای دیدن لیست، دکمه زیر را بزن و اسکرول کن.',
  ].join('\n');

  await replyNearbyMarkup(ctx, text, nearbySummaryKeyboard(radiusKm));
}

export async function handleNearbyListCallback(ctx: Context, page: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id || !ctx.from) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }

  const session = await getSession(String(ctx.from.id));
  const lat = session?.searchLat;
  const lng = session?.searchLng;
  const radiusKm = session?.searchRadiusKm ?? 5;
  if (lat == null || lng == null) {
    await ctx.answerCallbackQuery({ text: 'اول موقعیت بفرست', show_alert: true });
    await askNearbyLocation(ctx);
    return;
  }

  await ctx.answerCallbackQuery({ text: 'در حال ساخت لیست…' });

  let pets: PetProfile[] = [];
  try {
    pets = await listNearbyPets({
      lat,
      lng,
      excludeOwnerId: user.id,
      limit: NEARBY_LIMIT,
      radiusKm,
    });
  } catch (err) {
    console.warn('nearby list fetch failed:', (err as Error).message);
  }

  if (pets.length === 0) {
    await showNearbySummary(ctx, radiusKm);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(pets.length / NEARBY_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = pets.slice(
    safePage * NEARBY_LIST_PAGE_SIZE,
    safePage * NEARBY_LIST_PAGE_SIZE + NEARBY_LIST_PAGE_SIZE
  );

  await upsertSession(String(ctx.from.id), {
    searchMode: 'nearby',
    searchPage: safePage,
    searchRadiusKm: radiusKm,
  });

  const caption = [
    `🛰️ اطراف من ≤ ${toFaDigits(radiusKm)} کیلومتر (${toFaDigits(pets.length)})`,
    'روی هر مورد در دکمه‌ها بزن تا پروفایل پت باز بشه.',
  ].join('\n');

  const kb = nearbyVisualListKeyboard(slice, safePage, NEARBY_LIST_PAGE_SIZE, pets.length);

  try {
    const buf = await fetchNearbyListCardBuffer({
      lat,
      lng,
      radiusKm,
      excludeOwnerId: user.id,
      page: safePage,
      pageSize: NEARBY_LIST_PAGE_SIZE,
    });
    await ctx.replyWithPhoto(new InputFile(buf, 'nearby-list.jpg'), {
      caption,
      reply_markup: kb,
    });
    return;
  } catch (err) {
    console.warn('nearby list card failed, fallback inline:', (err as Error).message);
  }

  // Fallback: متن + اینلاین (اگر ساخت تصویر شکست بخورد)
  await ctx.reply(
    [`<b>${caption}</b>`, '', 'لیست متنی (پشتیبان):'].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: searchPetsListKeyboard(pets, 'nearby', safePage, NEARBY_LIST_PAGE_SIZE),
    }
  );
}

export async function handleSearchOwnerView(ctx: Context, ownerId: number): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user?.id) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن', show_alert: true });
    return;
  }
  const owner = await getUserById(ownerId);
  if (!owner) {
    await ctx.answerCallbackQuery({ text: 'صاحب پت پیدا نشد', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await replyWithOwnerProfile(ctx, owner, { heading: '👤 پروفایل صاحب پت' });
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
      searchLat: undefined,
      searchLng: undefined,
      searchRadiusKm: undefined,
    });
  }
  await pushMainMenuKeyboard(ctx, user);
}

function formatNearbyPetCaption(pet: PetProfile): string {
  const lines: string[] = [];
  const cmd = userCommandIdOf({ id: pet.ownerId });
  lines.push(`🐾 <b>${escapeHtml(pet.name)}</b>`);
  lines.push(`آیدی پت: <code>${escapeHtml(petPublicIdOf(pet))}</code>`);
  lines.push(`آیدی صاحب: /${escapeHtml(cmd.replace(/^\//, ''))}`);
  const species = PET_SPECIES_LABELS[pet.species] ?? pet.species;
  lines.push(`| ${species}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''}`);
  if (pet.gender) lines.push(`| ${PET_GENDER_LABELS[pet.gender] ?? pet.gender}`);
  if (pet.ageMonths != null) lines.push(`| 🎂 ${escapeHtml(formatPetAge(pet.ageMonths))}`);
  const loc = [pet.ownerCity || pet.city, pet.ownerProvince].filter(Boolean).join(' - ');
  if (loc) lines.push(`| 📍 ${escapeHtml(loc)}`);
  if (pet.ownerName) lines.push(`| 👤 صاحب: ${escapeHtml(pet.ownerName)}`);
  if (pet.ownerVerified) lines.push('| 🛡️✅ صاحب احراز شده');
  if (pet.distanceKm != null) {
    lines.push(`| 🏁 فاصله از شما: ${formatDistanceCaption(pet.distanceKm)}`);
  }
  if (pet.bio) lines.push(`| 💬 ${escapeHtml(pet.bio)}`);
  lines.push(pet.lookingForPlaymate ? '| 🔍 دنبال همبازی' : '| ⏸️ فعلاً همبازی نمی‌خواد');
  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  const text =
    mode === 'nearby'
      ? formatNearbyPetCaption(pet)
      : `🐾 <b>پروفایل پت</b>\n\n${formatPet(pet, true)}`;
  const kb = searchPetDetailKeyboard(mode, page, {
    petId: pet.id,
    ownerId: pet.ownerId,
  });

  if (mode === 'nearby') {
    try {
      const buf = await fetchPetProfileCardBuffer(pet.id, {
        viewerLat: session?.searchLat,
        viewerLng: session?.searchLng,
      });
      await ctx.replyWithPhoto(new InputFile(buf, 'pet-profile.jpg'), {
        caption: text.slice(0, 1024),
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    } catch (err) {
      console.warn('nearby profile card failed:', (err as Error).message);
    }
  }

  const photo = resolveTelegramPhotoUrl(pet.imageUrl) || defaultSearchPetPhoto(pet);
  try {
    await ctx.replyWithPhoto(photo, {
      caption: text.slice(0, 1024),
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
  species?: string,
  geo?: { lat: number; lng: number; radiusKm?: number }
): Promise<PetProfile[]> {
  const base = { excludeOwnerId: user.id as number | undefined };
  switch (mode) {
    case 'nearby': {
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
        try {
          const nearby = await listNearbyPets({
            lat: geo.lat,
            lng: geo.lng,
            excludeOwnerId: user.id,
            limit: NEARBY_LIMIT,
            radiusKm: geo.radiusKm,
          });
          if (nearby.length > 0) return nearby;
        } catch (err) {
          console.warn('listNearbyPets failed:', (err as Error).message);
        }
        // اگر هنوز کسی موقعیت نزده — fallback شهر/استان تا لیست خالی نماند
        if (user.city) {
          return listPets({ ...base, city: user.city });
        }
        if (user.province) {
          return listPets({ ...base, province: user.province });
        }
        return [];
      }
      if (user.city) {
        return listPets({ ...base, city: user.city });
      }
      if (user.province) {
        return listPets({ ...base, province: user.province });
      }
      return [];
    }
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
  const geo =
    session?.searchLat != null &&
    session?.searchLng != null &&
    Number.isFinite(session.searchLat) &&
    Number.isFinite(session.searchLng)
      ? {
          lat: session.searchLat,
          lng: session.searchLng,
          radiusKm: session.searchRadiusKm,
        }
      : undefined;
  const pets = await fetchPetsForMode(mode, user, breed, species, geo);
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
      mode === 'nearby' && geo
        ? 'هنوز کسی اطراف این موقعیت پیدا نشد. بعداً دوباره موقعیت بفرست یا «موقعیت دوباره» رو بزن.'
        : 'فعلاً پتی با این فیلتر پیدا نشد.',
    ].join('\n');
    if (mode === 'nearby') {
      await upsertSession(String(ctx.from.id), {
        step: 'awaiting_location_for_nearby',
      });
    }
    const emptyKb =
      mode === 'nearby'
        ? nearbyLocationKeyboard()
        : searchPetsMenuKeyboard();

    if (opts?.edit && ctx.callbackQuery) {
      try {
        await ctx.editMessageText(empty, { parse_mode: 'HTML' });
        await ctx.reply('⌨️', { reply_markup: emptyKb });
        return;
      } catch {
        /* fall through */
      }
    }
    await ctx.reply(empty, { parse_mode: 'HTML', reply_markup: emptyKb });
    return;
  }

  const hasGeoDistances = pets.some((p) => p.distanceKm != null);
  const text = [
    `<b>${modeTitle(mode, breed, species)}</b>`,
    hasGeoDistances
      ? `📋 ${pets.length} نفر/پت نزدیک — روی هر مورد بزن تا پروفایل باز بشه`
      : `📋 ${pets.length} پت — روی هر مورد بزن تا پروفایل باز بشه`,
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
      await pushMainMenuKeyboard(ctx, user);
    } else {
      await pushReplyKeyboard(ctx, searchPetsMenuKeyboard());
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
