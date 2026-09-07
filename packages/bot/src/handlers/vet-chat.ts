import { InlineKeyboard, InputFile, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import type { PetMedicalEntry, PetMedicalRecord, PetProfile, User } from '@petdate/shared';
import {
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PET_SPECIES_LABELS,
  RX_CONDITION_CATEGORIES,
  formatMedicalEntryAttribution,
  formatPetAge,
  formatRxMedicationTemplate,
  formatVetAuthorName,
  getRxCategoryById,
  getRxMedication,
} from '@petdate/shared';
import {
  addPetMedicalEntry,
  createConsultationPrescription,
  fetchPrescriptionPdfBuffer,
  getPet,
  getPetMedical,
  getVetConsultation,
  listPets,
  updateVetConsultationStatus,
} from '../api-client';
import { telegramMediaUrl } from '../media-url';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor } from './helpers';
import { MENU_LABELS } from '../keyboards';
import { effectiveWebUrl, isTelegramInlineUrl } from '../urls';
import { claimWebChatCtaOnce } from '../web-chat-cta-once';

/** Reply-keyboard labels for vet chat (short so buttons stay compact). */
export const VET_CHAT_BTNS = {
  /** Keep on the first keyboard row — on Telegram mobile the 3rd row is easy to miss. */
  end: '🔌 بستن چت',
  petProfile: '🐾 پروفایل پت',
  medical: '📋 پرونده',
  addNote: '📝 ثبت پرونده',
  prescription: '💊 نسخه',
} as const;

/** Previous end-chat label — still accept it until clients get the new keyboard. */
const VET_CHAT_END_ALIASES = [VET_CHAT_BTNS.end, '🔌 قطع چت'] as const;

function isVetChatEndLabel(text: string): boolean {
  return (VET_CHAT_END_ALIASES as readonly string[]).includes(text);
}

function isVetChatControlLabel(text: string): boolean {
  return isVetChatEndLabel(text) || (Object.values(VET_CHAT_BTNS) as string[]).includes(text);
}

const RX_NOTE =
  '⚠️ پیشنهادها فقط راهنما هستند؛ دوز و مدت را خودتان تکمیل/ویرایش کنید.';

function clearPrescriptionSessionPatch() {
  return {
    prescriptionPetId: undefined as number | undefined,
    prescriptionDraft: undefined as string | undefined,
  };
}

function rxActionKeyboard(hasDraft: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (hasDraft) {
    kb.text('✅ تأیید و صدور نسخه', 'vchat:rxok').success().row();
  }
  kb.text('➕ داروی دیگر', 'vchat:rxmore').primary()
    .text('✏️ نوشتن دستی', 'vchat:rxmanual').primary()
    .row();
  return kb;
}

function rxCategoriesKeyboard(hasDraft: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const cat of RX_CONDITION_CATEGORIES) {
    kb.text(`${cat.emoji} ${cat.labelFa}`, `vchat:rxcat:${cat.id}`).primary().row();
  }
  kb.text('✏️ نوشتن دستی', 'vchat:rxmanual').primary();
  if (hasDraft) {
    kb.row().text('✅ تأیید و صدور نسخه', 'vchat:rxok').success();
  }
  return kb;
}

function rxMedsKeyboard(categoryId: string, hasDraft: boolean): InlineKeyboard | null {
  const cat = getRxCategoryById(categoryId);
  if (!cat) return null;
  const kb = new InlineKeyboard();
  for (const med of cat.medications) {
    kb.text(`💊 ${med.nameFa}`, `vchat:rxmed:${cat.id}:${med.id}`).primary().row();
  }
  kb.text('◀️ بازگشت به بیماری‌ها', 'vchat:rxmore').primary().row();
  kb.text('✏️ نوشتن دستی', 'vchat:rxmanual').primary();
  if (hasDraft) {
    kb.row().text('✅ تأیید و صدور نسخه', 'vchat:rxok').success();
  }
  return kb;
}

function formatDraftPreview(draft: string): string {
  const trimmed = draft.trim();
  if (!trimmed) return '— (خالی)';
  return escapeHtml(trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}…` : trimmed);
}

async function promptPrescriptionComposer(
  ctx: Context,
  petName: string,
  draft?: string
): Promise<void> {
  const hasDraft = Boolean(draft?.trim());
  const lines = [
    `💊 <b>نوشتن نسخه برای «${escapeHtml(petName)}»</b>`,
    '',
    '<b>پیشنهاد داروها</b> — یک بیماری را انتخاب کنید:',
    RX_NOTE,
  ];
  if (hasDraft) {
    lines.push('', '<b>پیش‌نویس فعلی:</b>', formatDraftPreview(draft!));
  } else {
    lines.push(
      '',
      'می‌توانید از پیشنهادها انتخاب کنید یا «نوشتن دستی» را بزنید.',
      `انصراف: ${VET_CHAT_BTNS.end}`
    );
  }
  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: rxCategoriesKeyboard(hasDraft),
  });
}

/**
 * Vet chat reply keyboard.
 * Doctor: end chat first (always visible on mobile) → pet/medical → note/Rx.
 * Patient: end-chat only (no medical / prescription tools).
 */
export function vetChatReplyKeyboard(isVet: boolean): Keyboard {
  if (!isVet) {
    return new Keyboard()
      .text(VET_CHAT_BTNS.end)
      .danger()
      .resized()
      .persistent();
  }
  return new Keyboard()
    .text(VET_CHAT_BTNS.end)
    .danger()
    .row()
    .text(VET_CHAT_BTNS.petProfile)
    .primary()
    .text(VET_CHAT_BTNS.medical)
    .primary()
    .row()
    .text(VET_CHAT_BTNS.addNote)
    .success()
    .text(VET_CHAT_BTNS.prescription)
    .success()
    .resized()
    .persistent();
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMedicalRecord(
  pet: PetProfile,
  record: PetMedicalRecord,
  entries: PetMedicalEntry[]
): string {
  const lines = [
    `📋 <b>پرونده پزشکی — ${escapeHtml(pet.name)}</b>`,
    pet.species ? `گونه: ${escapeHtml(pet.species)}` : null,
    pet.breed ? `نژاد: ${escapeHtml(pet.breed)}` : null,
    '',
    `📝 یادداشت: ${escapeHtml(record.notes || '—')}`,
    `💉 واکسن‌ها: ${escapeHtml(record.vaccinations || '—')}`,
    `⚠️ آلرژی: ${escapeHtml(record.allergies || '—')}`,
    `🩺 بیماری مزمن: ${escapeHtml(record.chronicConditions || '—')}`,
    `📅 آخرین معاینه: ${escapeHtml(record.lastCheckup || '—')}`,
    `💊 دارو: ${escapeHtml(record.medications || '—')}`,
  ].filter((l): l is string => l != null);

  if (record.lastUpdatedByName || record.lastUpdatedByUserId != null) {
    const who = formatVetAuthorName(record.lastUpdatedByName, record.lastUpdatedByUserId);
    lines.push(`— آخرین ویرایشگر فیلدها: ${escapeHtml(who)}`);
  }

  if (entries.length) {
    lines.push('', '<b>ثبت‌های بالینی:</b>');
    for (const e of entries.slice(0, 12)) {
      lines.push(escapeHtml(formatMedicalEntryAttribution(e)), escapeHtml(e.text), '');
    }
  }
  return lines.join('\n').trim();
}

const CHAT_STEPS = new Set(['vet_chat', 'vet_medical_note', 'vet_prescription']);
const CHAT_INACTIVE_FA =
  'چت فقط بعد از قبول دامپزشک فعال است — هنوز وارد گفتگو نشده‌ای.';
const CHAT_ENDED_FA = 'چت پایان یافته — پیام جدید در این گفتگو پذیرفته نمی‌شود.';

function clearVetChatPatch() {
  return {
    step: 'ready' as const,
    vetChatConsultId: undefined as number | undefined,
    vetChatPeerTelegramId: undefined as string | undefined,
    vetChatRole: undefined as 'vet' | 'patient' | undefined,
    vetChatWebHintSent: undefined as boolean | undefined,
    medicalNotePetId: undefined as number | undefined,
    prescriptionPetId: undefined as number | undefined,
    prescriptionDraft: undefined as string | undefined,
  };
}

async function exitInactiveVetChat(
  ctx: Context,
  telegramId: string,
  reason: 'pending' | 'ended'
): Promise<void> {
  const user = await getCtxUser(ctx);
  await upsertSession(telegramId, clearVetChatPatch());
  const text = reason === 'ended' ? CHAT_ENDED_FA : CHAT_INACTIVE_FA;
  try {
    await ctx.reply(text, {
      reply_markup: menuKeyboardFor(ctx, user),
    });
  } catch {
    try {
      await ctx.reply(text);
    } catch {
      /* ignore */
    }
  }
}

export async function startVetChat(
  ctx: Context,
  consultId: number,
  vet: User,
  patient: User
): Promise<void> {
  // Never open bot chat sessions while consult is still pending/requested.
  const current = await getVetConsultation(consultId).catch(() => null);
  if (!current || current.status !== 'active' || current.chatEnded) {
    await ctx.reply(
      current?.chatEnded
        ? CHAT_ENDED_FA
        : 'چت فقط بعد از قبول درخواست فعال می‌شود.'
    );
    return;
  }

  const webBase = effectiveWebUrl().replace(/\/$/, '');
  const webChatUrl = `${webBase}/vet-chats/${consultId}`;
  const canWebButton = isTelegramInlineUrl(webChatUrl);

  if (!vet.telegramId) {
    await ctx.reply('برای شروع چت تلگرام، دامپزشک باید ربات را استارت کرده باشد.');
    return;
  }

  await upsertSession(String(vet.telegramId), {
    step: 'vet_chat',
    vetChatConsultId: consultId,
    vetChatPeerTelegramId: patient.telegramId ? String(patient.telegramId) : undefined,
    vetChatRole: 'vet',
    vetChatWebHintSent: true,
    medicalNotePetId: undefined,
    prescriptionPetId: undefined,
    prescriptionDraft: undefined,
  });

  if (patient.telegramId) {
    await upsertSession(String(patient.telegramId), {
      step: 'vet_chat',
      vetChatConsultId: consultId,
      vetChatPeerTelegramId: String(vet.telegramId),
      vetChatRole: 'patient',
      vetChatWebHintSent: true,
      medicalNotePetId: undefined,
      prescriptionPetId: undefined,
      prescriptionDraft: undefined,
    });
  }

  const vetIntro = [
    '💬 <b>چت با صاحب پت فعال شد</b>',
    '',
    `صاحب پت: <b>${escapeHtml(patient.name)}</b>`,
    'هر پیامی بفرستی مستقیم به صاحب پت می‌رسد.',
    '',
    `• ${VET_CHAT_BTNS.petProfile}`,
    `• ${VET_CHAT_BTNS.medical}`,
    `• ${VET_CHAT_BTNS.addNote}`,
    `• ${VET_CHAT_BTNS.prescription}`,
    `• ${VET_CHAT_BTNS.end}`,
  ].join('\n');

  const patientIntro = [
    '💬 <b>چت با دامپزشک فعال شد</b>',
    '',
    `پزشک: <b>${escapeHtml(vet.name)}</b>`,
    'هر پیامی بفرستی مستقیم به پزشک می‌رسد.',
    '',
    `پایان چت: ${VET_CHAT_BTNS.end}`,
  ].join('\n');

  /** web-cta-once-v2 — one-time web option (Redis SETNX); never on later relay messages. */
  const webHintText = canWebButton
    ? '🌐 می‌توانید در وب هم چت کنید — اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.'
    : [
        '🌐 می‌توانید در وب هم چت کنید:',
        webChatUrl,
        'اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.',
      ].join('\n');
  const webHintOpts = canWebButton
    ? { reply_markup: new InlineKeyboard().url('ورود به چت وب', webChatUrl) }
    : {};

  await ctx.reply(vetIntro, {
    parse_mode: 'HTML',
    reply_markup: vetChatReplyKeyboard(true),
  });
  if (await claimWebChatCtaOnce('vet', consultId, String(vet.telegramId))) {
    try {
      await ctx.reply(webHintText, webHintOpts);
    } catch {
      /* ignore */
    }
  }

  if (!patient.telegramId) {
    await ctx.reply(
      'بیمار تلگرام ندارد — چت وب برای او فعال است. پیام‌های وب از همین جلسه هم قابل پیگیری‌اند.'
    );
    return;
  }

  try {
    await ctx.api.sendMessage(patient.telegramId, patientIntro, {
      parse_mode: 'HTML',
      reply_markup: vetChatReplyKeyboard(false),
    });
    if (await claimWebChatCtaOnce('vet', consultId, String(patient.telegramId))) {
      await ctx.api.sendMessage(patient.telegramId, webHintText, webHintOpts);
    }
  } catch (err) {
    console.warn('notify patient chat start failed:', err);
  }
}

export async function handleVetChatEnd(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || !CHAT_STEPS.has(session.step)) {
    return false;
  }

  const consultId = session.vetChatConsultId;
  const peerId = session.vetChatPeerTelegramId;
  const user = await getCtxUser(ctx);

  if (consultId) {
    try {
      await updateVetConsultationStatus(consultId, 'completed');
    } catch (err) {
      console.warn('complete consult on chat end failed:', err);
    }
  }

  await upsertSession(String(from.id), clearVetChatPatch());

  if (peerId) {
    await upsertSession(peerId, clearVetChatPatch());
    try {
      await ctx.api.sendMessage(peerId, '🔌 چت مشاوره قطع شد.');
    } catch {
      /* ignore */
    }
  }

  await ctx.reply('چت مشاوره پایان یافت.', {
    reply_markup: menuKeyboardFor(ctx, user),
  });
  return true;
}

function formatVetPetProfileCard(pet: PetProfile): string {
  const species =
    PET_SPECIES_LABELS[pet.species] ?? pet.species;
  const city =
    [pet.ownerProvince, pet.ownerCity || pet.city].filter(Boolean).join('، ') ||
    pet.city ||
    null;
  const lines = [
    `🐾 <b>پروفایل پت — ${escapeHtml(pet.name)}</b>`,
    '',
    `گونه: ${escapeHtml(species)}`,
    pet.breed ? `نژاد: ${escapeHtml(pet.breed)}` : 'نژاد: —',
    pet.ageMonths != null ? `سن: ${escapeHtml(formatPetAge(pet.ageMonths))}` : 'سن: —',
    pet.gender
      ? `جنسیت: ${escapeHtml(PET_GENDER_LABELS[pet.gender] ?? pet.gender)}`
      : 'جنسیت: —',
    pet.size
      ? `جثه: ${escapeHtml(PET_SIZE_LABELS[pet.size] ?? pet.size)}`
      : 'جثه: —',
    city ? `شهر: ${escapeHtml(city)}` : 'شهر: —',
    `واکسن: ${pet.vaccinated ? '✅ زده' : '❌ نزده'}`,
    `عقیم‌سازی: ${pet.neutered ? '✅ شده' : '❌ نشده'}`,
    pet.bio ? `بیو: ${escapeHtml(pet.bio)}` : 'بیو: —',
  ];
  return lines.join('\n');
}

async function showPetProfile(ctx: Context, petId: number): Promise<void> {
  const pet = await getPet(petId);
  if (!pet) {
    await ctx.reply('پروفایل پت پیدا نشد.');
    return;
  }

  const text = formatVetPetProfileCard(pet);
  if (pet.imageUrl) {
    try {
      await ctx.replyWithPhoto(telegramMediaUrl(pet.imageUrl)!, {
        caption: text,
        parse_mode: 'HTML',
      });
      return;
    } catch (err) {
      console.warn('vet pet profile photo failed:', (err as Error).message);
    }
  }

  await ctx.reply(text, { parse_mode: 'HTML' });
}

async function showProfileForPatientPets(
  ctx: Context,
  patientUserId: number
): Promise<void> {
  let pets: PetProfile[] = [];
  try {
    pets = await listPets({ ownerId: patientUserId });
  } catch (err) {
    console.error('list pets for profile failed:', err);
    await ctx.reply('خطا در دریافت لیست پت‌ها.');
    return;
  }

  if (!pets.length) {
    await ctx.reply('این بیمار هنوز پتی ثبت نکرده.');
    return;
  }

  if (pets.length === 1) {
    await showPetProfile(ctx, pets[0]!.id);
    return;
  }

  const kb = new InlineKeyboard();
  for (const pet of pets.slice(0, 12)) {
    kb.text(`🐾 ${pet.name}`, `vchat:prof:${pet.id}`).primary().row();
  }
  await ctx.reply('پروفایل کدام پت؟', { reply_markup: kb });
}

export async function handleVetChatPetProfileView(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session?.vetChatConsultId) return false;
  if (!CHAT_STEPS.has(session.step)) return false;
  if (session.vetChatRole !== 'vet') {
    await ctx.reply('این دکمه فقط برای دامپزشک است.');
    return true;
  }

  const consult = await getVetConsultation(session.vetChatConsultId);
  if (!consult) {
    await ctx.reply('مشاوره پیدا نشد.');
    return true;
  }

  if (consult.petId) {
    await showPetProfile(ctx, consult.petId);
    return true;
  }

  await showProfileForPatientPets(ctx, consult.patientUserId);
  return true;
}

export async function handleVetChatPetProfilePetPick(
  ctx: Context,
  petId: number
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await showPetProfile(ctx, petId);
}

async function showPetMedical(ctx: Context, petId: number, viewerId: number): Promise<void> {
  try {
    const data = await getPetMedical(petId, viewerId);
    await ctx.reply(formatMedicalRecord(data.pet, data.record, data.entries), {
      parse_mode: 'HTML',
    });
  } catch (err) {
    console.error('get medical failed:', err);
    await ctx.reply('دسترسی به پرونده ممکن نشد.');
  }
}

async function showMedicalForPatientPets(
  ctx: Context,
  patientUserId: number,
  viewer: User
): Promise<void> {
  let pets: PetProfile[] = [];
  try {
    pets = await listPets({ ownerId: patientUserId });
  } catch (err) {
    console.error('list pets for medical failed:', err);
    await ctx.reply('خطا در دریافت لیست پت‌ها.');
    return;
  }

  if (!pets.length) {
    await ctx.reply('این بیمار هنوز پتی ثبت نکرده.');
    return;
  }

  if (pets.length === 1) {
    await showPetMedical(ctx, pets[0]!.id, viewer.id);
    return;
  }

  const kb = new InlineKeyboard();
  for (const pet of pets.slice(0, 12)) {
    kb.text(`🐾 ${pet.name}`, `vchat:med:${pet.id}`).primary().row();
  }
  await ctx.reply('کدام پت؟', { reply_markup: kb });
}

export async function handleVetChatMedicalView(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session?.vetChatConsultId) return false;
  if (!CHAT_STEPS.has(session.step)) return false;

  if (session.vetChatRole !== 'vet') {
    await ctx.reply('این دکمه فقط برای دامپزشک است.');
    return true;
  }

  const user = await getCtxUser(ctx);
  if (!user) return true;

  const consult = await getVetConsultation(session.vetChatConsultId);
  if (!consult) {
    await ctx.reply('مشاوره پیدا نشد.');
    return true;
  }

  if (consult.petId) {
    await showPetMedical(ctx, consult.petId, user.id);
    return true;
  }

  await showMedicalForPatientPets(ctx, consult.patientUserId, user);
  return true;
}

export async function handleVetChatMedicalPetPick(ctx: Context, petId: number): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }
  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'اول /start', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await showPetMedical(ctx, petId, user.id);
}

export async function handleVetChatAddNoteStart(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_chat' || session.vetChatRole !== 'vet') {
    return false;
  }
  if (!session.vetChatConsultId) return false;

  const consult = await getVetConsultation(session.vetChatConsultId);
  if (!consult) {
    await ctx.reply('مشاوره پیدا نشد.');
    return true;
  }

  let pets: PetProfile[] = [];
  try {
    pets = await listPets({ ownerId: consult.patientUserId });
  } catch {
    await ctx.reply('لیست پت‌ها در دسترس نیست.');
    return true;
  }

  if (!pets.length) {
    await ctx.reply('بیمار پتی ندارد؛ اول از او بخواه پت ثبت کند.');
    return true;
  }

  if (pets.length === 1) {
    await upsertSession(String(from.id), {
      step: 'vet_medical_note',
      medicalNotePetId: pets[0]!.id,
      prescriptionPetId: undefined,
      prescriptionDraft: undefined,
    });
    await ctx.reply(
      `✍️ مورد بالینی برای «${pets[0]!.name}» را بنویس و بفرست.\nانصراف با: ${VET_CHAT_BTNS.end}`,
      { reply_markup: vetChatReplyKeyboard(true) }
    );
    return true;
  }

  const kb = new InlineKeyboard();
  for (const pet of pets.slice(0, 12)) {
    kb.text(`✍️ ${pet.name}`, `vchat:note:${pet.id}`).primary().row();
  }
  await ctx.reply('ثبت مورد برای کدام پت؟', { reply_markup: kb });
  return true;
}

export async function handleVetChatNotePetPick(ctx: Context, petId: number): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }
  await upsertSession(String(from.id), {
    step: 'vet_medical_note',
    medicalNotePetId: petId,
    prescriptionPetId: undefined,
    prescriptionDraft: undefined,
  });
  await ctx.answerCallbackQuery();
  await ctx.reply('متن مورد بالینی را بنویس و بفرست (تشخیص، دارو، توصیه…).', {
    reply_markup: vetChatReplyKeyboard(true),
  });
}

export async function handleVetChatNoteText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_medical_note' || !session.medicalNotePetId) {
    return false;
  }

  if (isVetChatControlLabel(text)) {
    return false;
  }

  const user = await getCtxUser(ctx);
  if (!user) return true;

  try {
    await addPetMedicalEntry(session.medicalNotePetId, {
      authorUserId: user.id,
      authorName: user.name,
      text,
      consultId: session.vetChatConsultId,
    });
  } catch (err) {
    console.error('add medical entry failed:', err);
    await ctx.reply('ثبت در پرونده ناموفق بود.');
    return true;
  }

  await upsertSession(String(from.id), {
    step: 'vet_chat',
    medicalNotePetId: undefined,
  });

  await ctx.reply('✅ مورد در پرونده پزشکی پت ثبت شد. می‌تونی ادامه چت بدی.', {
    reply_markup: vetChatReplyKeyboard(true),
  });

  if (session.vetChatPeerTelegramId) {
    try {
      const who = formatVetAuthorName(user.name, user.id);
      await ctx.api.sendMessage(
        session.vetChatPeerTelegramId,
        `📋 ${who} موردی در پرونده پزشکی پت ثبت کرد:\n«${text.slice(0, 400)}»`
      );
    } catch {
      /* ignore */
    }
  }
  return true;
}

export async function handleVetChatPrescriptionStart(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_chat' || session.vetChatRole !== 'vet') {
    return false;
  }
  if (!session.vetChatConsultId) return false;

  const consult = await getVetConsultation(session.vetChatConsultId);
  if (!consult) {
    await ctx.reply('مشاوره پیدا نشد.');
    return true;
  }

  let pets: PetProfile[] = [];
  try {
    pets = await listPets({ ownerId: consult.patientUserId });
  } catch {
    await ctx.reply('لیست پت‌ها در دسترس نیست.');
    return true;
  }

  if (!pets.length) {
    await ctx.reply('بیمار پتی ندارد؛ اول از او بخواه پت ثبت کند.');
    return true;
  }

  // Prefer consult.petId when set and still owned by patient
  if (consult.petId) {
    const linked = pets.find((p) => p.id === consult.petId);
    if (linked) {
      await upsertSession(String(from.id), {
        step: 'vet_prescription',
        prescriptionPetId: linked.id,
        prescriptionDraft: undefined,
        medicalNotePetId: undefined,
      });
      await promptPrescriptionComposer(ctx, linked.name);
      return true;
    }
  }

  if (pets.length === 1) {
    await upsertSession(String(from.id), {
      step: 'vet_prescription',
      prescriptionPetId: pets[0]!.id,
      prescriptionDraft: undefined,
      medicalNotePetId: undefined,
    });
    await promptPrescriptionComposer(ctx, pets[0]!.name);
    return true;
  }

  const kb = new InlineKeyboard();
  for (const pet of pets.slice(0, 12)) {
    kb.text(`💊 ${pet.name}`, `vchat:rx:${pet.id}`).primary().row();
  }
  await ctx.reply('نسخه برای کدام پت؟', { reply_markup: kb });
  return true;
}

export async function handleVetChatPrescriptionPetPick(
  ctx: Context,
  petId: number
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'فقط دامپزشک', show_alert: true });
    return;
  }

  let petName = `پت #${petId}`;
  if (session.vetChatConsultId) {
    try {
      const consult = await getVetConsultation(session.vetChatConsultId);
      if (consult) {
        const pets = await listPets({ ownerId: consult.patientUserId });
        const found = pets.find((p) => p.id === petId);
        if (found) petName = found.name;
      }
    } catch {
      /* keep fallback */
    }
  }

  await upsertSession(String(from.id), {
    step: 'vet_prescription',
    prescriptionPetId: petId,
    prescriptionDraft: undefined,
    medicalNotePetId: undefined,
  });
  await ctx.answerCallbackQuery();
  await promptPrescriptionComposer(ctx, petName);
}

export async function handleVetChatRxCategory(ctx: Context, categoryId: string): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'الان در حالت نسخه نیستید', show_alert: true });
    return;
  }
  const cat = getRxCategoryById(categoryId);
  if (!cat) {
    await ctx.answerCallbackQuery({ text: 'دسته نامعتبر', show_alert: true });
    return;
  }
  const hasDraft = Boolean(session.prescriptionDraft?.trim());
  const kb = rxMedsKeyboard(categoryId, hasDraft);
  if (!kb) {
    await ctx.answerCallbackQuery({ text: 'دسته نامعتبر', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.reply(
    [
      `💊 <b>${escapeHtml(cat.emoji)} ${escapeHtml(cat.labelFa)}</b>`,
      'داروی پیشنهادی را انتخاب کنید (چند دارو مجاز است):',
      RX_NOTE,
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: kb }
  );
}

export async function handleVetChatRxMore(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'الان در حالت نسخه نیستید', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const hasDraft = Boolean(session.prescriptionDraft?.trim());
  await ctx.reply(
    [
      '<b>پیشنهاد داروها</b> — بیماری را انتخاب کنید:',
      RX_NOTE,
      hasDraft ? `\n<b>پیش‌نویس فعلی:</b>\n${formatDraftPreview(session.prescriptionDraft!)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    { parse_mode: 'HTML', reply_markup: rxCategoriesKeyboard(hasDraft) }
  );
}

export async function handleVetChatRxManual(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'الان در حالت نسخه نیستید', show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  const hasDraft = Boolean(session.prescriptionDraft?.trim());
  await ctx.reply(
    [
      '✏️ <b>نوشتن دستی</b>',
      hasDraft
        ? 'متن جدید را بفرستید تا جایگزین پیش‌نویس شود، یا خط تازه اضافه کنید و دوباره تأیید کنید.'
        : 'نام دارو، دوز، فاصله و مدت را بنویسید و بفرستید.',
      'مثال:',
      'آموکسی‌سیلین ۲۵۰mg — هر ۱۲ ساعت — ۷ روز',
      'با غذا داده شود',
      '',
      'بعد از ارسال متن، می‌توانید دارو اضافه کنید یا «تأیید و صدور» بزنید.',
      `انصراف: ${VET_CHAT_BTNS.end}`,
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: vetChatReplyKeyboard(true) }
  );
}

export async function handleVetChatRxMedPick(
  ctx: Context,
  categoryId: string,
  medId: string
): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || session.vetChatRole !== 'vet') {
    await ctx.answerCallbackQuery({ text: 'الان در حالت نسخه نیستید', show_alert: true });
    return;
  }
  const med = getRxMedication(categoryId, medId);
  if (!med) {
    await ctx.answerCallbackQuery({ text: 'دارو پیدا نشد', show_alert: true });
    return;
  }
  const line = formatRxMedicationTemplate(med);
  const prev = (session.prescriptionDraft || '').trim();
  const nextDraft = prev ? `${prev}\n${line}` : line;
  await upsertSession(String(from.id), { prescriptionDraft: nextDraft });
  await ctx.answerCallbackQuery({ text: 'اضافه شد ✅' });
  await ctx.reply(
    [
      `✅ اضافه شد: <b>${escapeHtml(med.nameFa)}</b>`,
      RX_NOTE,
      '',
      '<b>پیش‌نویس نسخه:</b>',
      formatDraftPreview(nextDraft),
      '',
      'داروی دیگر، نوشتن دستی، یا تأیید صدور را انتخاب کنید.',
      'می‌توانید پیش‌نویس را با ارسال پیام متنی ویرایش/جایگزین کنید.',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: rxActionKeyboard(true) }
  );
}

export async function handleVetChatPrescriptionText(
  ctx: Context,
  text: string
): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || !session.prescriptionPetId) {
    return false;
  }
  if (!session.vetChatConsultId) return false;

  if (isVetChatControlLabel(text)) {
    return false;
  }

  const trimmed = text.trim();
  if (!trimmed) return true;

  await upsertSession(String(from.id), { prescriptionDraft: trimmed });
  await ctx.reply(
    [
      '✏️ پیش‌نویس ذخیره شد.',
      RX_NOTE,
      '',
      '<b>پیش‌نویس نسخه:</b>',
      formatDraftPreview(trimmed),
      '',
      'در صورت نیاز دوزها را در پیام بعدی اصلاح کنید، دارو اضافه کنید، یا تأیید کنید.',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: rxActionKeyboard(true) }
  );
  return true;
}

export async function handleVetChatRxConfirm(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'vet_prescription' || !session.prescriptionPetId) {
    await ctx.answerCallbackQuery({ text: 'الان در حالت نسخه نیستید', show_alert: true });
    return;
  }
  if (!session.vetChatConsultId) {
    await ctx.answerCallbackQuery({ text: 'مشاوره نامعتبر', show_alert: true });
    return;
  }

  const text = (session.prescriptionDraft || '').trim();
  if (!text) {
    await ctx.answerCallbackQuery({
      text: 'پیش‌نویس خالی است — دارو انتخاب یا متن بنویسید',
      show_alert: true,
    });
    return;
  }

  const user = await getCtxUser(ctx);
  if (!user) {
    await ctx.answerCallbackQuery({ text: 'کاربر پیدا نشد', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.reply('⏳ در حال ساخت PDF و ارسال نسخه…');

  let created;
  try {
    created = await createConsultationPrescription(session.vetChatConsultId, {
      vetUserId: user.id,
      petId: session.prescriptionPetId,
      text,
    });
  } catch (err) {
    console.error('create prescription failed:', err);
    await ctx.reply('صدور نسخه ناموفق بود. دوباره تلاش کن.');
    return;
  }

  let pdfBuf: Buffer;
  try {
    pdfBuf = await fetchPrescriptionPdfBuffer(created.prescription.id);
  } catch (err) {
    console.error('fetch prescription pdf failed:', err);
    await upsertSession(String(from.id), {
      step: 'vet_chat',
      ...clearPrescriptionSessionPatch(),
    });
    await ctx.reply('نسخه ثبت شد ولی دریافت PDF ناموفق بود.', {
      reply_markup: vetChatReplyKeyboard(true),
    });
    return;
  }

  const fileName = `petdate-dr-rx-${created.prescription.id}.pdf`;
  const pdfLink =
    created.pdfPublicUrl ||
    (created.pdfPathPublic
      ? `${process.env.PUBLIC_PDF_URL || process.env.PDF_PUBLIC_URL || 'https://pdf.petdate.ir'}${created.pdfPathPublic}`
      : created.prescription?.id
        ? `${process.env.PUBLIC_PDF_URL || process.env.PDF_PUBLIC_URL || 'https://pdf.petdate.ir'}/rx/${created.prescription.id}.pdf`
        : '');

  // API already posts PDF into consult chat and relays to patient Telegram when linked.
  // Only send Telegram document from bot if API did not already deliver.
  const peerId = session.vetChatPeerTelegramId || created.patient.telegramId;
  let telegramOk = Boolean(created.telegramDelivered);
  if (!telegramOk && peerId) {
    const captionPatient = [
      'نسخه صادر شد — دانلود PDF:',
      pdfLink || '',
      `پت: ${created.pet.name}`,
      `پزشک: ${created.vet.name}`,
    ]
      .filter((line) => line !== '')
      .join('\n');
    try {
      await ctx.api.sendDocument(peerId, new InputFile(pdfBuf, fileName), {
        caption: captionPatient.slice(0, 1024),
      });
      telegramOk = true;
    } catch (err) {
      console.warn('send prescription to patient failed:', err);
      if (pdfLink) {
        try {
          await ctx.api.sendMessage(peerId, captionPatient);
          telegramOk = true;
        } catch (err2) {
          console.warn('send prescription link to patient failed:', err2);
        }
      }
    }
  }

  try {
    await ctx.api.sendDocument(from.id, new InputFile(pdfBuf, fileName), {
      caption: `✅ کپی نسخه برای شما — «${created.pet.name}»`,
    });
  } catch (err) {
    console.warn('send prescription copy to vet failed:', err);
  }

  await upsertSession(String(from.id), {
    step: 'vet_chat',
    ...clearPrescriptionSessionPatch(),
  });

  const noPhone =
    created.sms.sent === false &&
    created.sms.skipped &&
    /موبایل|شماره/.test(created.sms.reason || '');

  const smsLine =
    created.sms.sent === true
      ? `📱 پیامک به ${created.sms.phone} ارسال شد.`
      : noPhone
        ? `💬 ${'reason' in created.sms ? created.sms.reason : 'شماره موبایل نیست — نسخه در چت ارسال شد'}`
        : `⚠️ پیامک ارسال نشد: ${'reason' in created.sms ? created.sms.reason : '—'}`;

  await ctx.reply(
    [
      '✅ نسخه صادر شد.',
      telegramOk
        ? '✉️ PDF/لینک برای بیمار در تلگرام ارسال شد.'
        : '💬 نسخه در چت وب ثبت شد' +
          (peerId ? ' (ارسال تلگرام به بیمار ناموفق بود).' : ' (بیمار تلگرام ندارد).'),
      smsLine,
      created.chatDeliveryNote ? `ℹ️ ${created.chatDeliveryNote}` : '',
      pdfLink ? `📄 ${pdfLink}` : '',
      'می‌تونی ادامه چت بدی.',
    ]
      .filter(Boolean)
      .join('\n'),
    { reply_markup: vetChatReplyKeyboard(true) }
  );
}

export async function handleVetChatRelay(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || !session.vetChatPeerTelegramId) return false;
  if (!CHAT_STEPS.has(session.step)) return false;

  const text = ctx.message?.text?.trim();
  if (text) {
    if (isVetChatEndLabel(text)) return handleVetChatEnd(ctx);
    if (text === VET_CHAT_BTNS.petProfile) return handleVetChatPetProfileView(ctx);
    if (text === VET_CHAT_BTNS.medical) return handleVetChatMedicalView(ctx);
    if (text === VET_CHAT_BTNS.addNote) return handleVetChatAddNoteStart(ctx);
    if (text === VET_CHAT_BTNS.prescription) return handleVetChatPrescriptionStart(ctx);
    // Main-menu buttons must not be relayed into the consultation chat
    if (MENU_LABELS.has(text)) {
      await upsertSession(String(from.id), clearVetChatPatch());
      return false;
    }
    if (session.step === 'vet_medical_note') return handleVetChatNoteText(ctx, text);
    if (session.step === 'vet_prescription') return handleVetChatPrescriptionText(ctx, text);
  }

  if (session.step !== 'vet_chat') return false;

  // Hard lock: never relay until consult is accepted (active) / after end.
  if (session.vetChatConsultId) {
    const consult = await getVetConsultation(session.vetChatConsultId).catch(() => null);
    if (!consult || consult.status !== 'active' || consult.chatEnded) {
      await exitInactiveVetChat(
        ctx,
        String(from.id),
        consult?.chatEnded || consult?.status === 'completed' ? 'ended' : 'pending'
      );
      return true;
    }
  } else {
    await exitInactiveVetChat(ctx, String(from.id), 'pending');
    return true;
  }

  const peer = session.vetChatPeerTelegramId;

  try {
    if (ctx.message?.photo?.length) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1]!.file_id;
      await ctx.api.sendPhoto(peer, fileId, {
        caption: ctx.message.caption || undefined,
      });
      return true;
    }
    if (ctx.message?.document) {
      await ctx.api.sendDocument(peer, ctx.message.document.file_id, {
        caption: ctx.message.caption || undefined,
      });
      return true;
    }
    if (ctx.message?.voice) {
      await ctx.api.sendVoice(peer, ctx.message.voice.file_id);
      return true;
    }
    if (text) {
      await ctx.api.sendMessage(peer, text);
      return true;
    }
  } catch (err) {
    console.warn('vet chat relay failed:', err);
    await ctx.reply('ارسال به طرف مقابل ناموفق بود. ممکن است ربات را بلاک کرده باشد.');
    return true;
  }
  return false;
}
