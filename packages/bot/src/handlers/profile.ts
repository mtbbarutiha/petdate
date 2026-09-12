import type { Context } from 'grammy';
import type { BotStep, ProfileCardUser, ProfileDraft, User, UserGender } from '@petdate/shared';
import {
  COUNTRY_IRAN,
  FACE_VERIFY_REWARD,
  IRAN_PROVINCES,
  PROFILE_INTEREST_OPTIONS,
  PROFILE_WIZARD_STEP_LABELS_FA,
  USER_AGE_CUSTOM_LABEL,
  USER_AGE_MAX,
  USER_AGE_MIN,
  USER_GENDER_LABELS,
  USER_ROLE_LABELS,
  VET_CREDENTIAL_STATUS_LABELS,
  formatPeerOwnerProfileHtml,
  formatProfileCardHtml,
  isOptionalProfileWizardStep,
  isPhotoApproved,
  isProfileComplete,
  missingProfileWizardSteps,
  nextMissingProfileWizardStep,
  pendingPhotoApprovalMessage,
  pendingPhotoSubjects,
  normalizeRoles,
  parseUserAge,
  parseUserIdFromCommand,
  petPublicIdOf,
  toEnglishDigits,
  toPersianDigits,
  userCommandIdOf,
  userHasRole,
} from '@petdate/shared';
import {
  deleteUserAccount,
  getUserById,
  listPets,
  listUserBlocks,
  listUserContacts,
  fetchProfileCard,
  setSilentChatRequests,
  setUserActive,
  submitVetCredential,
  updateUserProfile,
} from '../api-client';
import { formatCoinAwardMessage } from '../economy';
import {
  PROFILE_AGE_CHIPS,
  USER_FEMALE_LABEL,
  USER_MALE_LABEL,
  WIZARD_NAV,
  ageChipKeyboard,
  cityReplyKeyboard,
  countryReplyKeyboard,
  genderReplyKeyboard,
  interestsReplyKeyboard,
  mainMenuKeyboard,
  phoneWizardKeyboard,
  profileActionsKeyboard,
  profileConfirmKeyboard,
  profileEditSectionsKeyboard,
  profileNavOpts,
  provinceReplyKeyboard,
  textStepKeyboard,
} from '../keyboards';
import { resolveTelegramPhotoUrl } from '../urls';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';

const PROFILE_TOTAL = 10;

const PROFILE_BACK: Partial<Record<BotStep, BotStep>> = {
  profile_age: 'profile_name',
  profile_gender: 'profile_age',
  profile_country: 'profile_gender',
  profile_province: 'profile_country',
  profile_city: 'profile_province',
  profile_phone: 'profile_city',
  profile_photo: 'profile_phone',
  profile_bio: 'profile_photo',
  profile_interests: 'profile_bio',
};

function stepTitle(n: number): string {
  return `مرحله ${n} از ${PROFILE_TOTAL}`;
}

function draftFromUser(user: User): ProfileDraft {
  return {
    name: user.name,
    age: user.age,
    gender: user.gender,
    country: user.country,
    province: user.province,
    city: user.city,
    phone: user.phone,
    bio: user.bio,
    avatarFileId: user.avatarUrl,
    interests: user.interests ?? [],
  };
}

function draftAsCardUser(draft: ProfileDraft): ProfileCardUser {
  return {
    id: 0,
    name: draft.name,
    age: draft.age,
    gender: draft.gender,
    country: draft.country,
    province: draft.province,
    city: draft.city,
    phone: draft.phone,
    bio: draft.bio,
    avatarUrl: draft.avatarFileId,
    interests: draft.interests,
  };
}

function clearGapSessionPatch() {
  return {
    profileGapFill: false,
    profileGapSkipped: undefined,
    profileGapHistory: undefined,
  };
}

function gapHeading(step: keyof typeof PROFILE_WIZARD_STEP_LABELS_FA): string {
  return `📋 <b>${PROFILE_WIZARD_STEP_LABELS_FA[step]}</b>`;
}

/** بعد از پر کردن / رد کردن یک مرحله در مسیر gap-fill، برو مرحلهٔ خالی بعدی */
async function continueGapFill(
  ctx: Context,
  telegramId: string,
  draft: ProfileDraft,
  justFinished?: BotStep,
  extraSkip: BotStep[] = []
): Promise<void> {
  const session = await getSession(telegramId);
  const skip = [...(session?.profileGapSkipped ?? []), ...extraSkip];
  const history = justFinished
    ? [...(session?.profileGapHistory ?? []), justFinished]
    : [...(session?.profileGapHistory ?? [])];
  const next = nextMissingProfileWizardStep(draftAsCardUser(draft), { skip });
  if (!next) {
    await finishProfileWizard(ctx, telegramId, draft);
    return;
  }
  await upsertSession(telegramId, {
    step: next,
    draftProfile: draft,
    profileGapFill: true,
    profileGapSkipped: skip,
    profileGapHistory: history,
  });
  await promptProfileStep(ctx, next, draft, false, true);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** کارت عمومی کاربر وقتی کسی `/u#####` را می‌زند — بدون موبایل / آیدی تلگرام */
function formatPublicUserCard(user: User, petNames: string[] = []): string {
  return formatPeerOwnerProfileHtml(user, {
    heading: '👤 <b>پروفایل کاربر</b>',
    includePets: petNames,
  });
}

/**
 * نمایش پروفایل عمومی با آیدی دستور (`/u00042` یا پی‌لود `u_00042`).
 * عکس پروفایل در صورت وجود با URL مطلق ارسال می‌شود.
 */
export async function showPublicUserById(ctx: Context, userId: number): Promise<void> {
  const user = await getUserById(userId);
  if (!user || user.isActive === false) {
    await ctx.reply('کاربری با این آیدی پیدا نشد.');
    return;
  }

  let pets: Awaited<ReturnType<typeof listPets>> = [];
  try {
    pets = await listPets({ ownerId: user.id });
  } catch {
    pets = [];
  }
  const text = formatPublicUserCard(
    user,
    pets.map((p) => `${p.name} · ${petPublicIdOf(p)}`)
  );
  const photo = isPhotoApproved(user.avatarModerationStatus)
    ? resolveTelegramPhotoUrl(user.avatarUrl)
    : undefined;
  if (photo) {
    try {
      await ctx.replyWithPhoto(photo, { caption: text, parse_mode: 'HTML' });
      return;
    } catch (err) {
      console.warn('public profile photo failed:', (err as Error).message);
    }
  }
  await ctx.reply(
    photo
      ? text
      : `${text}\n\n📷 عکس پروفایل ثبت نشده.`,
    { parse_mode: 'HTML' }
  );
}

/** هندلر `/u00042` / `/u00042@Petdatebot` */
export async function handleUserCommandId(ctx: Context): Promise<void> {
  const raw = ctx.message?.text?.trim() || '';
  const id = parseUserIdFromCommand(raw.split(/\s+/)[0] || '');
  if (!id) {
    await ctx.reply('آیدی نامعتبر است. مثال: PD-U00042 یا /u00042');
    return;
  }
  await showPublicUserById(ctx, id);
}

/** کارت کامل پروفایل کاربر — هم‌تراز وب/PWA */
function formatProfileCard(user: User, petCount: number, petNames: string[] = []): string {
  const isVet = userHasRole(user, 'vet');
  const vetCredStatus = user.vetCredentialStatus ?? 'none';
  const vetCredLine = isVet
    ? `📄 مدرک: ${VET_CREDENTIAL_STATUS_LABELS[vetCredStatus]}`
    : null;

  const card = formatProfileCardHtml(user, {
    contactsCount: user.contactsCount,
    petCount,
    petNames,
  });

  return [card, vetCredLine].filter(Boolean).join('\n');
}

async function sendOwnProfileCard(
  ctx: Context,
  user: User,
  petCount: number,
  caption: string
): Promise<void> {
  const kb = profileActionsKeyboard(
    isProfileComplete(user),
    user.isActive !== false,
    user.verificationStatus ?? 'none',
    {
      isVet: userHasRole(user, 'vet'),
      likesCount: user.likesCount ?? 0,
      contactsCount: user.contactsCount ?? 0,
      silentChatRequests: Boolean(user.silentChatRequests),
      faceReward: FACE_VERIFY_REWARD,
    }
  );
  if (user.avatarUrl) {
    const photo = resolveTelegramPhotoUrl(user.avatarUrl);
    if (photo) {
      try {
        await ctx.replyWithPhoto(photo, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      } catch {
        /* fall through */
      }
    }
  }
  await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: kb });
}

async function cancelWizard(ctx: Context, telegramId: string): Promise<void> {
  const session = await getSession(telegramId);
  if (session?.profileSectionEdit || session?.step === 'profile_edit_menu') {
    await upsertSession(telegramId, {
      step: 'profile_edit_menu',
      draftProfile: undefined,
      profileSectionEdit: false,
      breedPage: undefined,
    });
    await ctx.reply('ویرایش این بخش لغو شد.');
    await showProfileEditMenu(ctx);
    return;
  }

  const user = await getCtxUser(ctx);
  await upsertSession(telegramId, {
    step: 'ready',
    draftProfile: undefined,
    profileSectionEdit: false,
    breedPage: undefined,
    ...clearGapSessionPatch(),
  });
  await ctx.reply('انصراف دادی. هر وقت خواستی از منو «پروفایل خودم» دوباره شروع کن.', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
}

/** رد کردن کل ویزارد — پروفایل ناقص می‌ماند */
async function skipProfileWizardLater(ctx: Context, telegramId: string): Promise<void> {
  const session = await getSession(telegramId);
  if (session?.profileSectionEdit) {
    await upsertSession(telegramId, {
      step: 'profile_edit_menu',
      draftProfile: undefined,
      profileSectionEdit: false,
      breedPage: undefined,
    });
    await showProfileEditMenu(ctx);
    return;
  }

  const user = await getCtxUser(ctx);
  await upsertSession(telegramId, {
    step: 'ready',
    draftProfile: undefined,
    profileSectionEdit: false,
    breedPage: undefined,
    ...clearGapSessionPatch(),
  });
  await ctx.reply(
    'باشه، پروفایل رو فعلاً رد کردی.\nهر وقت خواستی از منو «👤 پروفایل خودم» تکمیلش کن.',
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

export async function showProfileEditMenu(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  const from = ctx.from;
  if (from) {
    await upsertSession(String(from.id), {
      step: 'profile_edit_menu',
      draftProfile: undefined,
      profileSectionEdit: false,
    });
  }
  const incomplete = !isProfileComplete(user);
  await ctx.reply(
    [
      '✏️ <b>ویرایش پروفایل</b>',
      '',
      'کدام بخش رو می‌خوای تغییر بدی؟',
      incomplete ? '\n⚠️ پروفایلت هنوز کامل نیست — «تکمیل بخش‌های خالی» فقط همان‌ها را می‌پرسد.' : '',
    ]
      .filter(Boolean)
      .join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: profileEditSectionsKeyboard({
        incomplete,
        isVet: userHasRole(user, 'vet'),
      }),
    }
  );
}

export async function handleProfile(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  let cardUser = user;
  try {
    const card = await fetchProfileCard(user.id);
    cardUser = card.user;
  } catch {
    /* keep local user */
  }

  const pets = await listPets({ ownerId: cardUser.id });
  const petNames = pets.map((p) => `${p.name} · ${petPublicIdOf(p)}`);
  const pendingNote = pendingPhotoApprovalMessage(
    pendingPhotoSubjects({
      hasAvatar: Boolean(cardUser.avatarUrl?.trim()),
      avatarStatus: cardUser.avatarModerationStatus,
      petStatuses: pets.map((p) => ({
        hasPhoto: Boolean(p.imageUrl?.trim()),
        status: p.photoModerationStatus,
      })),
    }),
    'fa'
  );
  const card = [
    formatProfileCard(cardUser, pets.length, petNames),
    pendingNote ? `\n⚠️ <b>${pendingNote}</b>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (!isProfileComplete(cardUser)) {
    // اگر onboarding اشتباه کامل علامت خورده، اصلاح کن
    if (cardUser.onboarding === 'profile_complete') {
      try {
        await updateUserProfile(String(ctx.from!.id), { onboarding: 'profile_incomplete' });
      } catch {
        /* ignore */
      }
    }
    await sendOwnProfileCard(
      ctx,
      cardUser,
      pets.length,
      `${card}\n\n⚠️ <b>پروفایلت هنوز کامل نیست.</b>\n«تکمیل پروفایل» فقط بخش‌های خالی رو جداگانه می‌پرسه — نه ثبت‌نام دوباره.`
    );
    return;
  }

  await sendOwnProfileCard(ctx, cardUser, pets.length, card);
  await pushMainMenuKeyboard(ctx, cardUser);
}

export async function startProfileWizard(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  await upsertSession(telegramId, {
    userId: user.id,
    role: user.role,
    step: 'profile_name',
    profileSectionEdit: false,
    draftProfile: draftFromUser(user),
    ...clearGapSessionPatch(),
  });

  await askProfileName(ctx, user.name);
}

/**
 * CTA «تکمیل پروفایل» — فقط فیلدهای خالی، هر کدام یک مرحلهٔ جدا.
 * ویزارد ثبت‌نام از اول راه‌اندازی نمی‌شود و دادهٔ پرشده پاک/دوباره پرسیده نمی‌شود.
 */
export async function startProfileGapFill(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const draft = draftFromUser(user);
  const missing = missingProfileWizardSteps(draftAsCardUser(draft));
  if (!missing.length) {
    await upsertSession(telegramId, {
      step: 'ready',
      draftProfile: undefined,
      profileSectionEdit: false,
      ...clearGapSessionPatch(),
    });
    await ctx.reply(
      [
        '✅ <b>پروفایلت کامله</b> — چیزی برای تکمیل نمونده.',
        'از «ویرایش پروفایل» می‌تونی هر بخش رو جداگانه عوض کنی.',
      ].join('\n'),
      { parse_mode: 'HTML', reply_markup: menuKeyboardFor(ctx, user) }
    );
    return;
  }

  const labels = missing.map((s) => PROFILE_WIZARD_STEP_LABELS_FA[s]).join(' · ');
  await upsertSession(telegramId, {
    userId: user.id,
    role: user.role,
    step: missing[0],
    profileSectionEdit: false,
    draftProfile: draft,
    profileGapFill: true,
    profileGapSkipped: [],
    profileGapHistory: [],
  });

  await ctx.reply(
    [
      '📋 <b>تکمیل پروفایل</b>',
      '',
      'فقط بخش‌هایی که وارد نکردی رو جداگانه می‌پرسیم — بقیه اطلاعاتت دست نمی‌خوره.',
      '',
      `باقی‌مانده: ${labels}`,
    ].join('\n'),
    { parse_mode: 'HTML' }
  );
  await promptProfileStep(ctx, missing[0]!, draft, false, true);
}

type ProfileEditField =
  | 'name'
  | 'age'
  | 'gender'
  | 'location'
  | 'phone'
  | 'photo'
  | 'bio'
  | 'interests';

export async function startProfileSectionEdit(
  ctx: Context,
  field: ProfileEditField
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const draft: ProfileDraft = draftFromUser(user);

  const stepByField: Record<ProfileEditField, BotStep> = {
    name: 'profile_name',
    age: 'profile_age',
    gender: 'profile_gender',
    location: 'profile_country',
    phone: 'profile_phone',
    photo: 'profile_photo',
    bio: 'profile_bio',
    interests: 'profile_interests',
  };

  const step = stepByField[field];
  await upsertSession(telegramId, {
    userId: user.id,
    role: user.role,
    step,
    profileSectionEdit: true,
    draftProfile: draft,
    ...clearGapSessionPatch(),
  });

  await promptProfileStep(ctx, step, draft, true);
}

async function finishSectionField(
  ctx: Context,
  telegramId: string,
  patch: Parameters<typeof updateUserProfile>[1],
  successMsg: string
): Promise<void> {
  try {
    const user = await updateUserProfile(telegramId, patch);
    // Keep onboarding in sync when profile becomes complete via section edits
    if (isProfileComplete(user) && user.onboarding !== 'profile_complete') {
      try {
        await updateUserProfile(telegramId, { onboarding: 'profile_complete' });
      } catch {
        /* ignore */
      }
    }
    await upsertSession(telegramId, {
      step: 'profile_edit_menu',
      draftProfile: undefined,
      profileSectionEdit: false,
      ...clearGapSessionPatch(),
    });
    await ctx.reply(`✅ ${successMsg}`);
    if (user.awardedRewards?.length) {
      const msg = formatCoinAwardMessage(user.awardedRewards);
      if (msg) await ctx.reply(msg);
    }
    await showProfileEditMenu(ctx);
  } catch (err) {
    console.error('finishSectionField failed:', err);
    await ctx.reply('ذخیره نشد. دوباره تلاش کن.');
  }
}

export async function startVetCredentialUpload(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.reply('اول /start بزن.');
    return;
  }
  if (!userHasRole(user, 'vet')) {
    await ctx.reply('آپلود مدرک فقط برای دامپزشک است.');
    return;
  }

  const telegramId = String(from.id);
  await upsertSession(telegramId, {
    step: 'vet_credential',
    profileSectionEdit: false,
    draftProfile: undefined,
  });

  const status = user.vetCredentialStatus ?? 'none';
  const lines = [
    '📄 <b>آپلود مدرک دامپزشکی</b>',
    '',
    'عکس یا فایل مدرک / پروانهٔ طبابت رو بفرست.',
    `وضعیت فعلی: <b>${VET_CREDENTIAL_STATUS_LABELS[status]}</b>`,
    '',
    'بعد از ارسال، مدرک برای بررسی ذخیره می‌شه.',
  ];
  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: textStepKeyboard({ ...profileNavOpts({ noBack: true }), skip: false }),
  });
}

export async function handleVetCredentialPhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const photos = ctx.message?.photo;
  if (!from || !photos?.length) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'vet_credential') return false;

  const best = photos[photos.length - 1]!;
  await finishVetCredentialUpload(ctx, telegramId, best.file_id);
  return true;
}

export async function handleVetCredentialDocument(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const doc = ctx.message?.document;
  if (!from || !doc?.file_id) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'vet_credential') return false;

  await finishVetCredentialUpload(ctx, telegramId, doc.file_id);
  return true;
}

async function finishVetCredentialUpload(
  ctx: Context,
  telegramId: string,
  fileId: string
): Promise<void> {
  try {
    const { user } = await submitVetCredential(telegramId, fileId);
    await upsertSession(telegramId, { step: 'ready' });
    await ctx.reply(
      `✅ مدرکت ثبت شد و در صف بررسی است.\nوضعیت: ${VET_CREDENTIAL_STATUS_LABELS[user.vetCredentialStatus ?? 'pending']}`,
      { reply_markup: menuKeyboardFor(ctx, user) }
    );
  } catch (err) {
    console.error('submitVetCredential failed:', err);
    await ctx.reply('ارسال مدرک ناموفق بود. دوباره عکس یا فایل بفرست.');
  }
}

export async function handleVetCredentialText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'vet_credential') return false;

  if (text === WIZARD_NAV.cancel) {
    const user = await getCtxUser(ctx);
    await upsertSession(telegramId, { step: 'ready' });
    await ctx.reply('آپلود مدرک لغو شد.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return true;
  }

  await ctx.reply('لطفاً عکس یا فایل مدرک رو بفرست، یا «❌ انصراف» بزن.', {
    reply_markup: textStepKeyboard({ ...profileNavOpts({ noBack: true }), skip: false }),
  });
  return true;
}

async function askProfileName(
  ctx: Context,
  currentName?: string,
  section = false,
  gap = false
): Promise<void> {
  const lines = [
    section
      ? '✏️ <b>ویرایش نام</b>'
      : gap
        ? gapHeading('profile_name')
        : `✨ <b>تکمیل پروفایل</b> (${stepTitle(1)})`,
    '',
    'نام نمایشی‌ات رو بنویس:',
  ];
  if (currentName && !gap) {
    lines.push(`<i>الان: ${escapeHtml(currentName)}</i>`);
    lines.push('یا «✓ همین نام» رو بزن.');
  }
  if (!section) {
    lines.push('', 'اگر الان وقت نداری «⏭ فعلاً رد کن» رو بزن.');
  }

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: textStepKeyboard({
      ...profileNavOpts({ noBack: true, skipLater: !section }),
      keepName: currentName && !gap ? currentName : undefined,
    }),
  });
}

async function askProfileAge(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '🎂 <b>ویرایش سن</b>'
    : gap
      ? gapHeading('profile_age')
      : `🎂 <b>${stepTitle(2)}</b>`;
  await ctx.reply(
    [
      title,
      '',
      'سنت چند سالِ؟',
      section
        ? 'از دکمه‌ها یکی را بزن، یا «✏️ سن دیگر» و بعد عدد بنویس.'
        : 'از دکمه‌ها یکی را بزن، یا «✏️ سن دیگر» و بعد عدد بنویس (مثلاً ۲۷).',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: ageChipKeyboard(PROFILE_AGE_CHIPS) }
  );
}

async function askProfileGender(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '⚧ <b>ویرایش جنسیت</b>'
    : gap
      ? gapHeading('profile_gender')
      : `⚧ <b>${stepTitle(3)}</b>`;
  await ctx.reply(`${title}\n\nجنسیتت رو از منو انتخاب کن:`, {
    parse_mode: 'HTML',
    reply_markup: genderReplyKeyboard(),
  });
}

async function askProfileCountry(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '🌍 <b>ویرایش موقعیت</b>'
    : gap
      ? gapHeading('profile_country')
      : `🌍 <b>${stepTitle(4)}</b>`;
  await ctx.reply(`${title}\n\nکشورت رو انتخاب کن:`, {
    parse_mode: 'HTML',
    reply_markup: countryReplyKeyboard(),
  });
}

async function askProfileProvince(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '🗺 <b>ویرایش موقعیت</b>'
    : gap
      ? gapHeading('profile_province')
      : `🗺 <b>${stepTitle(5)}</b>`;
  await ctx.reply(`${title}\n\nاستانت رو انتخاب کن:`, {
    parse_mode: 'HTML',
    reply_markup: provinceReplyKeyboard(),
  });
}

async function askProfileCity(
  ctx: Context,
  province?: string,
  section = false,
  gap = false
): Promise<void> {
  const title = section
    ? '🏙 <b>ویرایش موقعیت</b>'
    : gap
      ? gapHeading('profile_city')
      : `🏙 <b>${stepTitle(6)}</b>`;
  await ctx.reply(`${title}\n\nشهرت رو انتخاب کن یا «شهر دیگر» بزن:`, {
    parse_mode: 'HTML',
    reply_markup: cityReplyKeyboard({ province, skipLater: !section }),
  });
}

async function askProfilePhone(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '📱 <b>ویرایش موبایل</b>'
    : gap
      ? gapHeading('profile_phone')
      : `📱 <b>${stepTitle(7)}</b>`;
  await ctx.reply(`${title}\n\nشماره موبایلت رو بفرست یا دکمه اشتراک‌گذاری رو بزن:`, {
    parse_mode: 'HTML',
    reply_markup: phoneWizardKeyboard(),
  });
}

async function askProfilePhoto(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '🖼 <b>ویرایش عکس</b>'
    : gap
      ? gapHeading('profile_photo')
      : `🖼 <b>${stepTitle(8)}</b>`;
  await ctx.reply(`${title}\n\nیک عکس پروفایل بفرست:`, {
    parse_mode: 'HTML',
    reply_markup: textStepKeyboard(profileNavOpts({ skip: true })),
  });
}

async function askProfileBio(ctx: Context, section = false, gap = false): Promise<void> {
  const title = section
    ? '💬 <b>ویرایش بیو</b>'
    : gap
      ? gapHeading('profile_bio')
      : `💬 <b>${stepTitle(9)}</b>`;
  await ctx.reply(`${title}\n\nچند خط درباره خودت بنویس:\n<i>علاقه‌ها، پت‌ها، محله...</i>`, {
    parse_mode: 'HTML',
    reply_markup: textStepKeyboard(profileNavOpts({ skip: true })),
  });
}

async function askProfileInterests(
  ctx: Context,
  selected: string[] = [],
  section = false,
  gap = false
): Promise<void> {
  const picked = selected.length ? `\nانتخاب‌شده: ${escapeHtml(selected.join(' · '))}` : '';
  const title = section
    ? '💚 <b>ویرایش علایق</b>'
    : gap
      ? gapHeading('profile_interests')
      : `💚 <b>${stepTitle(10)}</b>`;
  await ctx.reply(
    `${title}\n\nعلایقت رو از منو انتخاب کن (چندتا اوکیه)، بعد «ثبت علایق» بزن:${picked}`,
    { parse_mode: 'HTML', reply_markup: interestsReplyKeyboard(selected) }
  );
}

async function promptProfileStep(
  ctx: Context,
  step: BotStep,
  draft: ProfileDraft,
  section = false,
  gap = false
): Promise<void> {
  switch (step) {
    case 'profile_name':
      await askProfileName(ctx, draft.name, section, gap);
      return;
    case 'profile_age':
      await askProfileAge(ctx, section, gap);
      return;
    case 'profile_gender':
      await askProfileGender(ctx, section, gap);
      return;
    case 'profile_country':
      await askProfileCountry(ctx, section, gap);
      return;
    case 'profile_province':
      await askProfileProvince(ctx, section, gap);
      return;
    case 'profile_city':
      if (draft.country && draft.country !== COUNTRY_IRAN) {
        const title = section
          ? '🏙 <b>ویرایش موقعیت</b>'
          : gap
            ? gapHeading('profile_city')
            : `🏙 <b>${stepTitle(6)}</b>`;
        await ctx.reply(`${title}\n\nشهرت رو بنویس:`, {
          parse_mode: 'HTML',
          reply_markup: textStepKeyboard(profileNavOpts({ skipLater: !section })),
        });
        return;
      }
      await askProfileCity(ctx, draft.province, section, gap);
      return;
    case 'profile_phone':
      await askProfilePhone(ctx, section, gap);
      return;
    case 'profile_photo':
      await askProfilePhoto(ctx, section, gap);
      return;
    case 'profile_bio':
      await askProfileBio(ctx, section, gap);
      return;
    case 'profile_interests':
      await askProfileInterests(ctx, draft.interests ?? [], section, gap);
      return;
    default:
      return;
  }
}

export async function handleProfileWizardText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const telegramId = String(from.id);
  let session = await getSession(telegramId);
  if (!session) return false;
  if (!String(session.step).startsWith('profile_')) return false;
  if (session.step === 'profile_edit_menu') return false;

  if (!session.userId) {
    const user = await getCtxUser(ctx);
    if (!user) {
      await ctx.reply('اول /start بزن.');
      return true;
    }
    session = await upsertSession(telegramId, { userId: user.id, role: user.role });
  }

  const draft: ProfileDraft = { ...session.draftProfile };
  const section = Boolean(session.profileSectionEdit);
  const gap = Boolean(session.profileGapFill);

  if (text === WIZARD_NAV.skipLater) {
    await skipProfileWizardLater(ctx, telegramId);
    return true;
  }

  if (text === WIZARD_NAV.cancel) {
    await cancelWizard(ctx, telegramId);
    return true;
  }

  if (text === WIZARD_NAV.back) {
    if (gap) {
      const history = [...(session.profileGapHistory ?? [])];
      const prev = history.pop();
      if (!prev) {
        await cancelWizard(ctx, telegramId);
        return true;
      }
      await upsertSession(telegramId, {
        step: prev,
        draftProfile: draft,
        profileGapFill: true,
        profileGapHistory: history,
      });
      await ctx.reply('برگشتیم یک مرحله ↩️');
      await promptProfileStep(ctx, prev, draft, false, true);
      return true;
    }
    let prev = PROFILE_BACK[session.step];
    if (session.step === 'profile_city' && !draft.province) {
      prev = 'profile_country';
    }
    if (!prev) {
      await cancelWizard(ctx, telegramId);
      return true;
    }
    await upsertSession(telegramId, { step: prev, draftProfile: draft });
    await ctx.reply('برگشتیم یک مرحله ↩️');
    await promptProfileStep(ctx, prev, draft, section);
    return true;
  }

  if (text === WIZARD_NAV.skip) {
    if (section) {
      await cancelWizard(ctx, telegramId);
      return true;
    }
    if (gap) {
      if (isOptionalProfileWizardStep(session.step)) {
        await continueGapFill(ctx, telegramId, draft, undefined, [session.step]);
        return true;
      }
      await skipProfileWizardLater(ctx, telegramId);
      return true;
    }
    if (session.step === 'profile_phone') {
      await upsertSession(telegramId, { step: 'profile_photo', draftProfile: draft });
      await askProfilePhoto(ctx);
      return true;
    }
    if (session.step === 'profile_photo') {
      await upsertSession(telegramId, { step: 'profile_bio', draftProfile: draft });
      await askProfileBio(ctx);
      return true;
    }
    if (session.step === 'profile_bio') {
      await upsertSession(telegramId, { step: 'profile_interests', draftProfile: draft });
      await askProfileInterests(ctx, draft.interests ?? []);
      return true;
    }
    if (session.step === 'profile_interests') {
      await finishProfileWizard(ctx, telegramId, draft);
      return true;
    }
    // در مراحل اجباری، رد کردن فیلد = رد کردن کل ویزارد
    await skipProfileWizardLater(ctx, telegramId);
    return true;
  }

  if (session.step === 'profile_name') {
    let name = text.trim();
    if (text === WIZARD_NAV.keepName) {
      name = (draft.name ?? '').trim();
    }
    if (name.length < 2) {
      await ctx.reply('نام خیلی کوتاهه. حداقل ۲ حرف بنویس.', {
        reply_markup: textStepKeyboard({
          ...profileNavOpts({ noBack: true, skipLater: !section }),
          keepName: draft.name,
        }),
      });
      return true;
    }
    draft.name = name;
    if (section) {
      await finishSectionField(ctx, telegramId, { name }, 'نام به‌روز شد.');
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_name');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_age', draftProfile: draft });
    await askProfileAge(ctx);
    return true;
  }

  if (session.step === 'profile_age') {
    if (text.trim() === USER_AGE_CUSTOM_LABEL) {
      await ctx.reply(
        [
          'سنت رو با عدد بنویس:',
          `مثلاً ${toPersianDigits(27)} یا ۲۷ ساله`,
          `(از ${toPersianDigits(USER_AGE_MIN)} تا ${toPersianDigits(USER_AGE_MAX)})`,
        ].join('\n'),
        { reply_markup: textStepKeyboard(profileNavOpts({ skipLater: !section })) }
      );
      return true;
    }

    const age = parseUserAge(text);
    if (age == null) {
      await ctx.reply(
        `سن معتبر انتخاب کن (${toPersianDigits(USER_AGE_MIN)} تا ${toPersianDigits(USER_AGE_MAX)}) یا از دکمه‌ها بزن.`,
        { reply_markup: ageChipKeyboard(PROFILE_AGE_CHIPS) }
      );
      return true;
    }
    draft.age = age;
    if (section) {
      await finishSectionField(ctx, telegramId, { age }, 'سن به‌روز شد.');
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_age');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_gender', draftProfile: draft });
    await askProfileGender(ctx);
    return true;
  }

  if (session.step === 'profile_gender') {
    const gender = parseUserGender(text);
    if (!gender) {
      await ctx.reply('از دکمه‌های کیبورد انتخاب کن:', { reply_markup: genderReplyKeyboard() });
      return true;
    }
    draft.gender = gender;
    if (section) {
      await finishSectionField(ctx, telegramId, { gender }, 'جنسیت به‌روز شد.');
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_gender');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_country', draftProfile: draft });
    await askProfileCountry(ctx);
    return true;
  }

  if (session.step === 'profile_country') {
    if (text === 'سایر کشورها' || text === '🌍 سایر کشورها') {
      await ctx.reply('نام کشور رو بنویس:', {
        reply_markup: textStepKeyboard(profileNavOpts({ skipLater: !section })),
      });
      return true;
    }
    let country = text.trim();
    if (country === '🇮🇷 ایران' || country === COUNTRY_IRAN) {
      country = COUNTRY_IRAN;
    }
    if (country.startsWith('🌍 ')) {
      country = country.slice(2).trim();
    }
    if (country.length < 2) {
      await ctx.reply('کشور رو از منو انتخاب کن یا بنویس.', {
        reply_markup: countryReplyKeyboard(),
      });
      return true;
    }
    draft.country = country;
    if (!gap) {
      draft.province = undefined;
    } else if (country !== COUNTRY_IRAN) {
      draft.province = undefined;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_country');
      return true;
    }
    if (country === COUNTRY_IRAN) {
      await upsertSession(telegramId, { step: 'profile_province', draftProfile: draft });
      await askProfileProvince(ctx, section);
    } else {
      await upsertSession(telegramId, { step: 'profile_city', draftProfile: draft });
      await ctx.reply(
        section
          ? '🏙 <b>ویرایش موقعیت</b>\n\nشهرت رو بنویس:'
          : `🏙 <b>${stepTitle(6)}</b>\n\nشهرت رو بنویس:`,
        {
          parse_mode: 'HTML',
          reply_markup: textStepKeyboard(profileNavOpts({ skipLater: !section })),
        }
      );
    }
    return true;
  }

  if (session.step === 'profile_province') {
    const province = text.trim();
    if (!(IRAN_PROVINCES as readonly string[]).includes(province)) {
      await ctx.reply('استان رو از دکمه‌ها انتخاب کن:', {
        reply_markup: provinceReplyKeyboard(),
      });
      return true;
    }
    draft.province = province;
    if (!gap) {
      draft.city = undefined;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_province');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_city', draftProfile: draft });
    await askProfileCity(ctx, province, section);
    return true;
  }

  if (session.step === 'profile_city') {
    if (text === WIZARD_NAV.otherCity) {
      await ctx.reply('نام شهرت رو بنویس:', {
        reply_markup: textStepKeyboard(profileNavOpts({ skipLater: !section })),
      });
      return true;
    }
    const city = text.trim();
    if (city.length < 2) {
      await ctx.reply('نام شهر رو درست بنویس یا از منو انتخاب کن.', {
        reply_markup: cityReplyKeyboard({ province: draft.province, skipLater: !section }),
      });
      return true;
    }
    draft.city = city;
    if (section) {
      await finishSectionField(
        ctx,
        telegramId,
        { country: draft.country, province: draft.province, city: draft.city },
        'موقعیت به‌روز شد.'
      );
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_city');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_phone', draftProfile: draft });
    await askProfilePhone(ctx);
    return true;
  }

  if (session.step === 'profile_phone') {
    const phone = text.trim().replace(/\s+/g, '');
    if (!/^(\+98|0)?9\d{9}$/.test(toEnglishDigits(phone)) && !/^\+?\d{10,13}$/.test(toEnglishDigits(phone))) {
      await ctx.reply('شماره معتبر نیست. مثلاً ۰۹۱۲۳۴۵۶۷۸۹ یا دکمه اشتراک‌گذاری.', {
        reply_markup: phoneWizardKeyboard(),
      });
      return true;
    }
    draft.phone = toEnglishDigits(phone);
    if (section) {
      await finishSectionField(ctx, telegramId, { phone: draft.phone }, 'موبایل به‌روز شد.');
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_phone');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_photo', draftProfile: draft });
    await askProfilePhoto(ctx);
    return true;
  }

  if (session.step === 'profile_photo') {
    await ctx.reply('لطفاً یک عکس بفرست یا «رد کردن» بزن.', {
      reply_markup: textStepKeyboard(profileNavOpts({ skip: true, skipLater: !section })),
    });
    return true;
  }

  if (session.step === 'profile_bio') {
    draft.bio = text.trim().slice(0, 300);
    if (section) {
      await finishSectionField(ctx, telegramId, { bio: draft.bio }, 'بیو به‌روز شد.');
      return true;
    }
    if (gap) {
      await continueGapFill(ctx, telegramId, draft, 'profile_bio');
      return true;
    }
    await upsertSession(telegramId, { step: 'profile_interests', draftProfile: draft });
    await askProfileInterests(ctx, draft.interests ?? []);
    return true;
  }

  if (session.step === 'profile_interests') {
    if (text === WIZARD_NAV.interestsDone) {
      if (section) {
        await finishSectionField(
          ctx,
          telegramId,
          { interests: draft.interests ?? [] },
          'علایق به‌روز شد.'
        );
        return true;
      }
      if (gap) {
        await continueGapFill(ctx, telegramId, draft, 'profile_interests');
        return true;
      }
      await finishProfileWizard(ctx, telegramId, draft);
      return true;
    }

    const cleaned = text.replace(/^✓\s*/, '').trim();
    const option = PROFILE_INTEREST_OPTIONS.find((o) => o === cleaned || o === text);
    if (!option) {
      await ctx.reply('از دکمه‌های کیبورد انتخاب کن یا «ثبت علایق» بزن.', {
        reply_markup: interestsReplyKeyboard(draft.interests ?? []),
      });
      return true;
    }

    const current = new Set(draft.interests ?? []);
    if (current.has(option)) current.delete(option);
    else current.add(option);
    draft.interests = [...current];
    await upsertSession(telegramId, { draftProfile: draft });
    await askProfileInterests(ctx, draft.interests, section, gap);
    return true;
  }

  return false;
}

function parseUserGender(text: string): UserGender | null {
  const t = text.trim();
  if (t === USER_MALE_LABEL || t === USER_GENDER_LABELS.male || t === 'آقا' || t === '👨 آقا') {
    return 'male';
  }
  if (t === USER_FEMALE_LABEL || t === USER_GENDER_LABELS.female || t === 'خانم' || t === '👩 خانم') {
    return 'female';
  }
  return null;
}

export async function handleProfileGender(ctx: Context, gender: UserGender): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session) return;

  const draft: ProfileDraft = { ...session.draftProfile, gender };
  const section = Boolean(session.profileSectionEdit);
  await ctx.answerCallbackQuery({ text: USER_GENDER_LABELS[gender] });
  if (section) {
    await finishSectionField(ctx, telegramId, { gender }, 'جنسیت به‌روز شد.');
    return;
  }
  if (session.profileGapFill) {
    await continueGapFill(ctx, telegramId, draft, 'profile_gender');
    return;
  }
  await upsertSession(telegramId, { step: 'profile_country', draftProfile: draft });
  await askProfileCountry(ctx);
}

export async function handleProfileContact(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const contact = ctx.message?.contact;
  if (!from || !contact) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'profile_phone') return false;

  const draft: ProfileDraft = {
    ...session.draftProfile,
    phone: contact.phone_number,
  };
  if (session.profileSectionEdit) {
    await finishSectionField(ctx, telegramId, { phone: contact.phone_number }, 'موبایل به‌روز شد.');
    return true;
  }
  if (session.profileGapFill) {
    await continueGapFill(ctx, telegramId, draft, 'profile_phone');
    return true;
  }
  await upsertSession(telegramId, { step: 'profile_photo', draftProfile: draft });
  await askProfilePhoto(ctx);
  return true;
}

export async function handleProfilePhoto(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  const photos = ctx.message?.photo;
  if (!from || !photos?.length) return false;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session || session.step !== 'profile_photo') return false;

  const best = photos[photos.length - 1]!;
  const draft: ProfileDraft = {
    ...session.draftProfile,
    avatarFileId: best.file_id,
  };
  if (session.profileSectionEdit) {
    await finishSectionField(ctx, telegramId, { avatarUrl: best.file_id }, 'عکس پروفایل به‌روز شد.');
    return true;
  }
  if (session.profileGapFill) {
    await continueGapFill(ctx, telegramId, draft, 'profile_photo');
    return true;
  }
  await upsertSession(telegramId, { step: 'profile_bio', draftProfile: draft });
  await askProfileBio(ctx);
  return true;
}

export async function handleProfileSkip(
  ctx: Context,
  field: 'phone' | 'photo' | 'bio'
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const telegramId = String(from.id);
  const session = await getSession(telegramId);
  if (!session) return;

  await ctx.answerCallbackQuery();
  if (session.profileSectionEdit) {
    await cancelWizard(ctx, telegramId);
    return;
  }
  const draft: ProfileDraft = { ...session.draftProfile };
  const skipStep: BotStep =
    field === 'phone' ? 'profile_phone' : field === 'photo' ? 'profile_photo' : 'profile_bio';

  if (session.profileGapFill) {
    await continueGapFill(ctx, telegramId, draft, undefined, [skipStep]);
    return;
  }

  if (field === 'phone') {
    await upsertSession(telegramId, { step: 'profile_photo', draftProfile: draft });
    await askProfilePhoto(ctx);
    return;
  }

  if (field === 'photo') {
    await upsertSession(telegramId, { step: 'profile_bio', draftProfile: draft });
    await askProfileBio(ctx);
    return;
  }

  await upsertSession(telegramId, { step: 'profile_interests', draftProfile: draft });
  await askProfileInterests(ctx, draft.interests ?? []);
}

export async function handleProfileDeactivate(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    '⏸ حسابت موقتاً غیرفعال بشه؟\nدیگه تو جستجو نشون داده نمی‌شی.',
    { reply_markup: profileConfirmKeyboard('deactivate') }
  );
}

/** alias */
export const handleProfileDeactivateAsk = handleProfileDeactivate;

export async function handleProfileDeleteAsk(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply('⚠️ مطمئنی حسابت حذف شود؟ این کار برگشت‌پذیر نیست.', {
    reply_markup: profileConfirmKeyboard('delete'),
  });
}

export async function handleProfileDeactivateConfirm(ctx: Context, yes: boolean): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  await ctx.answerCallbackQuery();
  if (!yes) {
    const user = await getCtxUser(ctx);
    await ctx.reply('باشه، حسابت همون‌طور موند.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  await setUserActive(String(from.id), false);
  const user = await getCtxUser(ctx);
  await ctx.reply(
    '⏸ حسابت غیرفعال شد.\nبرای فعال‌سازی دوباره از پروفایل «فعال‌سازی» رو بزن.',
    { reply_markup: menuKeyboardFor(ctx, user) }
  );
}

export async function handleProfileActivate(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  await setUserActive(String(from.id), true);
  await ctx.answerCallbackQuery({ text: 'حساب فعال شد' });
  await handleProfile(ctx);
}

export async function handleProfileLikes(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن' });
    return;
  }
  const likes = user.likesCount ?? 0;
  await ctx.answerCallbackQuery();
  await ctx.reply(
    [
      '❤️ <b>لایک‌های پروفایل</b>',
      '',
      `تعداد لایک دریافتی: <b>${new Intl.NumberFormat('fa-IR').format(likes)}</b>`,
      '',
      'لایک‌ها از بازدید و تعامل دیگران روی پروفایل/پت‌ات جمع می‌شه.',
    ].join('\n'),
    { parse_mode: 'HTML' }
  );
}

export async function handleProfileContacts(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن' });
    return;
  }
  await ctx.answerCallbackQuery();
  try {
    const contacts = await listUserContacts(user.id);
    if (!contacts.length) {
      await ctx.reply('👥 هنوز مخاطبی نداری.\nاز چت همبازی می‌تونی مخاطب اضافه کنی.');
      return;
    }
    const lines = contacts.slice(0, 30).map((c, i) => {
      const name = c.contactName || 'بدون نام';
      const un = c.contactUsername ? ` @${c.contactUsername}` : '';
      return `${new Intl.NumberFormat('fa-IR').format(i + 1)}. ${name}${un}`;
    });
    await ctx.reply(
      [`👥 <b>مخاطبین</b> (${new Intl.NumberFormat('fa-IR').format(contacts.length)})`, '', ...lines].join(
        '\n'
      ),
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('listUserContacts failed:', err);
    await ctx.reply('لیست مخاطبین در دسترس نیست. کمی بعد دوباره امتحان کن.');
  }
}

export async function handleProfileInteractions(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن' });
    return;
  }
  await ctx.answerCallbackQuery();
  try {
    const card = await fetchProfileCard(user.id);
    const ix = card.extras?.interactions;
    const fa = new Intl.NumberFormat('fa-IR');
    await ctx.reply(
      [
        '🔄 <b>تعاملات</b>',
        '',
        `❤️ لایک: ${fa.format(ix?.likes ?? user.likesCount ?? 0)}`,
        `👁️ بازدید پروفایل: ${fa.format(ix?.views ?? user.profileViews ?? 0)}`,
        `🐾 درخواست همبازی: ${fa.format(ix?.playdatesTotal ?? 0)}`,
        `⏳ در انتظار: ${fa.format(ix?.playdatesPending ?? 0)}`,
        `✅ پذیرفته: ${fa.format(ix?.playdatesAccepted ?? 0)}`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('interactions failed:', err);
    await ctx.reply('آمار تعاملات الان در دسترس نیست.');
  }
}

export async function handleProfileBlocked(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن' });
    return;
  }
  await ctx.answerCallbackQuery();
  try {
    const blocks = await listUserBlocks(user.id);
    if (!blocks.length) {
      await ctx.reply('🚫 لیست بلاک خالی است.');
      return;
    }
    const lines = blocks.slice(0, 30).map((b, i) => {
      const name = b.blockedName || 'بدون نام';
      const un = b.blockedUsername ? ` @${b.blockedUsername}` : '';
      return `${new Intl.NumberFormat('fa-IR').format(i + 1)}. ${name}${un}`;
    });
    await ctx.reply(
      [`🚫 <b>بلاک‌شده‌ها</b> (${new Intl.NumberFormat('fa-IR').format(blocks.length)})`, '', ...lines].join(
        '\n'
      ),
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('listUserBlocks failed:', err);
    await ctx.reply('لیست بلاک در دسترس نیست.');
  }
}

export async function handleProfileSilentToggle(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start بزن' });
    return;
  }
  const next = !user.silentChatRequests;
  try {
    await setSilentChatRequests(user.id, next);
    await ctx.answerCallbackQuery({
      text: next ? 'سایلنت روشن شد' : 'سایلنت خاموش شد',
    });
    await ctx.reply(
      next
        ? '🔇 سایلنت درخواست چت/همبازی روشن شد.\nاعلان‌های مزاحم کمتر می‌شه؛ درخواست‌ها همچنان در لیست می‌مونه.'
        : '🔔 سایلنت خاموش شد — اعلان درخواست‌ها دوباره فعال است.'
    );
  } catch (err) {
    console.error('silent toggle failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا' });
    await ctx.reply('تغییر سایلنت ناموفق بود.');
  }
}

export async function handleProfileAccountMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const user = await getCtxUser(ctx);
  const active = user?.isActive !== false;
  const rows: { text: string; callback_data: string }[][] = [
    [
      { text: '⏸ غیرفعال‌سازی', callback_data: 'profile:deactivate' },
      { text: '🗑 حذف حساب', callback_data: 'profile:delete' },
    ],
  ];
  if (!active) {
    rows.push([{ text: '▶️ فعال‌سازی', callback_data: 'profile:activate' }]);
  }
  await ctx.reply(
    [
      '🔴 <b>حذف / غیرفعال‌سازی حساب</b>',
      '',
      'غیرفعال: موقتاً از جستجو خارج می‌شی.',
      'حذف: حساب ناشناس می‌شه و برگشت‌پذیر نیست.',
    ].join('\n'),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: rows },
    }
  );
}

export async function handleProfileDeleteConfirm(ctx: Context, yes: boolean): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  await ctx.answerCallbackQuery();
  if (!yes) {
    const user = await getCtxUser(ctx);
    await ctx.reply('حذف لغو شد.', {
      reply_markup: menuKeyboardFor(ctx, user),
    });
    return;
  }
  const telegramId = String(from.id);
  await deleteUserAccount(telegramId);
  await upsertSession(telegramId, {
    step: 'start',
    userId: undefined,
    role: undefined,
    draftProfile: undefined,
    draftPet: undefined,
  });
  await ctx.reply('🗑 حسابت حذف شد.\nبرای ساخت حساب جدید /start بزن.');
}

async function finishProfileWizard(
  ctx: Context,
  telegramId: string,
  draft: ProfileDraft
): Promise<void> {
  const session = await getSession(telegramId);
  const gap = Boolean(session?.profileGapFill);
  const stillMissing = nextMissingProfileWizardStep(draftAsCardUser(draft), {
    skip: session?.profileGapSkipped,
  });

  if (!draft.name || !draft.age || !draft.gender || !draft.country || !draft.city) {
    const next = stillMissing ?? 'profile_name';
    await ctx.reply('اطلاعات لازم هنوز ناقصه. فقط همان بخش خالی رو کامل کن.');
    await upsertSession(telegramId, {
      step: next,
      draftProfile: draft,
      profileGapFill: gap || undefined,
    });
    await promptProfileStep(ctx, next, draft, false, gap);
    return;
  }

  if (draft.country === COUNTRY_IRAN && !draft.province) {
    await ctx.reply('برای ایران باید استان رو هم انتخاب کنی.');
    await upsertSession(telegramId, {
      step: 'profile_province',
      draftProfile: draft,
      profileGapFill: gap || undefined,
    });
    await askProfileProvince(ctx, false, gap);
    return;
  }

  try {
    const user = await updateUserProfile(telegramId, {
      name: draft.name,
      age: draft.age,
      gender: draft.gender,
      country: draft.country,
      province: draft.province,
      city: draft.city,
      phone: draft.phone,
      bio: draft.bio,
      interests: draft.interests,
      avatarUrl: draft.avatarFileId,
      onboarding: 'profile_complete',
    });

    await upsertSession(telegramId, {
      step: 'ready',
      draftProfile: undefined,
      profileSectionEdit: false,
      ...clearGapSessionPatch(),
    });

    if (user.awardedRewards?.length) {
      const msg = formatCoinAwardMessage(user.awardedRewards);
      if (msg) await ctx.reply(msg);
    }

    const pets = await listPets({ ownerId: user.id });
    const doneLine = gap
      ? '✅ بخش‌های خالی پروفایل ذخیره شد.'
      : '✅ پروفایلت کامل شد!';
    const text = `${doneLine}\n\n${formatProfileCard(
      user,
      pets.length,
      pets.map((p) => p.name)
    )}`;
    await sendOwnProfileCard(ctx, user, pets.length, text);
    await pushMainMenuKeyboard(ctx, user);
  } catch (err) {
    console.error('finishProfileWizard failed:', err);
    await ctx.reply('ثبت پروفایل با خطا مواجه شد. یک بار دیگه «✅ ثبت علایق» رو بزن یا از /profile دوباره شروع کن.');
  }
}
