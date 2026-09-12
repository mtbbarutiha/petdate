import type { Context } from 'grammy';
import {
  approveProviderCredential,
  approveVetCredential,
  listAllVets,
  listPendingCardPayments,
  listPendingPetPhotos,
  listPendingProviderCredentials,
  listPendingUserAvatars,
  listPendingVerifications,
  listPendingVetCredentials,
  rejectProviderCredential,
  rejectVetCredential,
  setPetPhotoModeration,
  setUserAvatarModeration,
  setVetEnabled,
  type PaymentOrder,
} from '../api-client';
import {
  checkAdminPassword,
  hasConfiguredAdminIds,
  isTelegramAdmin,
} from '../config';
import { formatNum, formatToman, paymentCardInfo } from '../economy';
import { isAdminAuthorized, requireAdminAuth } from './admin-auth';

export { isAdminAuthorized, requireAdminAuth } from './admin-auth';
import {
  ADMIN_MENU,
  adminPanelKeyboard,
  adminPaymentKeyboard,
  adminPetPhotoKeyboard,
  adminProviderCredentialKeyboard,
  adminUserAvatarKeyboard,
  adminVetCredentialKeyboard,
  adminVetListKeyboard,
  adminVetToggleKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor, pushMainMenuKeyboard } from './helpers';
import { handleAdminVerifyQueue } from './verification';
import type { User } from '@petdate/shared';
import { userPublicIdOf } from '@petdate/shared';
import { resolveTelegramPhotoUrl } from '../urls';

const ADMIN_VET_LIST_PAGE_SIZE = 10;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** شناسهٔ نمایشی پزشک — PD-U##### */
function adminVetPublicId(user: User): string {
  return userPublicIdOf(user);
}

export async function showAdminPanel(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      '🛠 <b>پنل ادمین</b>',
      '',
      'از دکمه‌های زیر برای مدیریت صف‌ها استفاده کن.',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: adminPanelKeyboard() }
  );
}

/** /admin یا دکمه منو */
export async function handleAdminEntry(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  if (isTelegramAdmin(from.id) || (await isAdminAuthorized(ctx))) {
    await showAdminPanel(ctx);
    return;
  }

  if (hasConfiguredAdminIds()) {
    await ctx.reply('این بخش فقط برای ادمین است.');
    return;
  }

  await upsertSession(String(from.id), { step: 'admin_password' });
  await ctx.reply('رمز پنل ادمین را وارد کن:');
}

export async function handleAdminPasswordText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'admin_password') return false;

  if (!checkAdminPassword(text)) {
    await upsertSession(String(from.id), { step: 'ready' });
    await ctx.reply('رمز نادرست بود.');
    return true;
  }

  await upsertSession(String(from.id), {
    step: 'ready',
    adminAuthed: true,
  });
  await ctx.reply('✅ ورود ادمین موفق.');
  await showAdminPanel(ctx);
  return true;
}

export async function handleAdminStats(ctx: Context): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let face = 0;
  let vet = 0;
  let trainer = 0;
  let photos = 0;
  let avatars = 0;
  let payments = 0;
  try {
    face = (await listPendingVerifications()).length;
  } catch (err) {
    console.error('admin stats face queue failed:', err);
  }
  try {
    vet = (await listPendingVetCredentials()).length;
  } catch (err) {
    console.error('admin stats vet queue failed:', err);
  }
  try {
    trainer = (await listPendingProviderCredentials('trainer')).length;
  } catch (err) {
    console.error('admin stats trainer queue failed:', err);
  }
  try {
    photos = (await listPendingPetPhotos()).length;
  } catch (err) {
    console.error('admin stats photo queue failed:', err);
  }
  try {
    avatars = (await listPendingUserAvatars()).length;
  } catch (err) {
    console.error('admin stats avatar queue failed:', err);
  }
  try {
    payments = (await listPendingCardPayments()).length;
  } catch (err) {
    console.error('admin stats payment queue failed:', err);
  }
  await ctx.reply(
    [
      '📊 <b>وضعیت صف‌ها</b>',
      '',
      `🛡 احراز چهره: <b>${face}</b>`,
      `📄 مدارک دامپزشک: <b>${vet}</b>`,
      `🎓 مدارک مربی: <b>${trainer}</b>`,
      `🖼 عکس پت: <b>${photos}</b>`,
      `👤 عکس کاربر: <b>${avatars}</b>`,
      `💳 پرداخت‌های در انتظار: <b>${payments}</b>`,
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: adminPanelKeyboard() }
  );
}

function formatPendingPaymentCard(order: PaymentOrder): string {
  const card = paymentCardInfo();
  return [
    '💳 <b>پرداخت کارت‌به‌کارت — در انتظار</b>',
    '',
    `<b>سفارش:</b> #${order.id}`,
    `<b>کاربر:</b> ${escapeHtml(order.userName || '—')}`,
    order.userUsername ? `<b>یوزرنیم:</b> @${escapeHtml(order.userUsername)}` : null,
    order.userTelegramId
      ? `<b>تلگرام:</b> <code>${escapeHtml(order.userTelegramId)}</code>`
      : null,
    `<b>بسته:</b> ${escapeHtml(order.packageId)} · ${formatNum(order.coins)} سکه`,
    `<b>مبلغ:</b> ${formatToman(order.amountToman ?? 0)}`,
    `<b>کارت مقصد:</b> <code>${card.number}</code>`,
    `<b>به‌نام:</b> ${escapeHtml(card.holder)}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function sendPendingPaymentItem(ctx: Context, order: PaymentOrder): Promise<void> {
  const caption = formatPendingPaymentCard(order);
  const kb = adminPaymentKeyboard(order.id);
  if (order.receiptFileId) {
    try {
      await ctx.replyWithPhoto(order.receiptFileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(
    order.receiptFileId ? `${caption}\n\n⚠️ رسید در دسترس نیست.` : `${caption}\n\n⚠️ هنوز رسیدی ثبت نشده.`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
}

/** صف پرداخت‌های کارت‌به‌کارت در انتظار تأیید */
export async function handleAdminPendingPayments(ctx: Context): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let pending: PaymentOrder[];
  try {
    pending = await listPendingCardPayments();
  } catch (err) {
    console.error('listPendingCardPayments failed:', err);
    await ctx.reply('خطا در دریافت صف پرداخت‌ها.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  if (pending.length === 0) {
    await ctx.reply('📭 پرداخت در انتظاری نیست.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  await ctx.reply(`💳 ${pending.length} پرداخت در صف بررسی:`, {
    reply_markup: adminPanelKeyboard(),
  });
  const limit = Math.min(pending.length, 5);
  for (let i = 0; i < limit; i++) {
    await sendPendingPaymentItem(ctx, pending[i]!);
  }
  if (pending.length > limit) {
    await ctx.reply(`+ ${pending.length - limit} مورد دیگر — دوباره «${ADMIN_MENU.pendingPayments}» را بزن.`);
  }
}

export async function handleAdminBackToMenu(ctx: Context): Promise<void> {
  const user = await getCtxUser(ctx);
  await pushMainMenuKeyboard(ctx, user);
}

function formatVetCard(user: Awaited<ReturnType<typeof listPendingVetCredentials>>[number]): string {
  const loc = [user.province, user.city].filter(Boolean).join('، ') || '—';
  return [
    '📄 <b>درخواست مدرک دامپزشکی</b>',
    '',
    `<b>نام:</b> ${escapeHtml(user.name)}`,
    user.username ? `<b>یوزرنیم:</b> @${escapeHtml(user.username)}` : null,
    `<b>آیدی:</b> <code>${user.id}</code>`,
    user.telegramId ? `<b>تلگرام:</b> <code>${escapeHtml(user.telegramId)}</code>` : null,
    `<b>شهر:</b> ${escapeHtml(loc)}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function sendVetCredentialItem(
  ctx: Context,
  user: Awaited<ReturnType<typeof listPendingVetCredentials>>[number]
): Promise<void> {
  const caption = formatVetCard(user);
  const kb = adminVetCredentialKeyboard(user.id);
  const fileId = user.vetCredentialFileId;
  if (fileId) {
    try {
      await ctx.replyWithPhoto(fileId, { caption, parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* try document */
    }
    try {
      await ctx.replyWithDocument(fileId, { caption, parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(`${caption}\n\n⚠️ فایل در دسترس نیست.`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleAdminVetCredentialQueue(ctx: Context): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let pending: Awaited<ReturnType<typeof listPendingVetCredentials>>;
  try {
    pending = await listPendingVetCredentials();
  } catch (err) {
    console.error('listPendingVetCredentials failed:', err);
    await ctx.reply('خطا در دریافت صف مدارک.');
    return;
  }
  if (pending.length === 0) {
    await ctx.reply('📭 صف مدارک دامپزشک خالی است.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  await ctx.reply(`📋 ${pending.length} مدرک در صف بررسی:`, { reply_markup: adminPanelKeyboard() });
  await sendVetCredentialItem(ctx, pending[0]!);
  if (pending.length > 1) {
    await ctx.reply(`+ ${pending.length - 1} مورد دیگر — «⏭ بعدی» را بزن.`);
  }
}

export async function handleAdminVetCredentialNext(ctx: Context): Promise<void> {
  await handleAdminVetCredentialQueue(ctx);
}

export async function handleAdminVetCredentialApprove(ctx: Context, userId: number): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let result: Awaited<ReturnType<typeof approveVetCredential>>;
  try {
    result = await approveVetCredential(userId);
  } catch (err) {
    console.error('approveVetCredential failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا یا دیگر در صف نیست', show_alert: true }).catch(() => undefined);
    return;
  }
  await ctx.answerCallbackQuery({ text: 'مدرک تأیید شد ✅' }).catch(() => undefined);
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
  const user = result.user;
  await ctx.reply(`✅ مدرک ${escapeHtml(user.name)} (#${user.id}) تأیید شد.`, { parse_mode: 'HTML' });
  if (user.telegramId) {
    try {
      await ctx.api.sendMessage(user.telegramId, '✅ مدرک دامپزشکی‌ات تأیید شد.');
    } catch (err) {
      console.warn('notify vet approve failed:', err);
    }
  }
}

export async function handleAdminVetCredentialReject(ctx: Context, userId: number): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let result: Awaited<ReturnType<typeof rejectVetCredential>>;
  try {
    result = await rejectVetCredential(userId);
  } catch (err) {
    console.error('rejectVetCredential failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا یا دیگر در صف نیست', show_alert: true }).catch(() => undefined);
    return;
  }
  await ctx.answerCallbackQuery({ text: 'مدرک رد شد' }).catch(() => undefined);
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* ignore */
  }
  const user = result.user;
  await ctx.reply(`❌ مدرک ${escapeHtml(user.name)} (#${user.id}) رد شد.`, { parse_mode: 'HTML' });
  if (user.telegramId) {
    try {
      await ctx.api.sendMessage(
        user.telegramId,
        '❌ مدرک دامپزشکی‌ات رد شد. از پروفایل دوباره آپلود کن.'
      );
    } catch (err) {
      console.warn('notify vet reject failed:', err);
    }
  }
}

function formatAdminVetCard(user: User): string {
  const enabled = user.vetEnabled !== false;
  const online = Boolean(user.vetOnline);
  const cred = user.vetCredentialStatus ?? 'none';
  const loc = [user.province, user.city].filter(Boolean).join('، ') || '—';
  const phone = user.phone
    ? `${escapeHtml(user.phone)}${user.phoneVerified ? ' ✅' : ''}`
    : '—';
  return [
    `🩺 <b>${escapeHtml(user.name)}</b>`,
    user.username ? `@${escapeHtml(user.username)}` : null,
    `<b>آیدی:</b> ${escapeHtml(adminVetPublicId(user))}`,
    user.telegramId ? `<b>تلگرام:</b> <code>${escapeHtml(user.telegramId)}</code>` : null,
    `<b>وضعیت:</b> ${enabled ? '✅ فعال' : '⏸ غیرفعال'}`,
    `<b>آنلاین:</b> ${online ? '🟢 بله' : '🔴 خیر'}`,
    `<b>مدرک:</b> ${escapeHtml(String(cred))}`,
    `<b>شهر:</b> ${escapeHtml(loc)}`,
    `<b>موبایل:</b> ${phone}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function formatAdminVetListLine(user: User, index: number): string {
  const enabled = user.vetEnabled !== false;
  const online = Boolean(user.vetOnline);
  const phone = user.phone ? escapeHtml(user.phone) : null;
  const parts = [
    `${index}. <b>${escapeHtml(user.name)}</b>`,
    escapeHtml(adminVetPublicId(user)),
    enabled ? '✅ فعال' : '⏸ غیرفعال',
    online ? '🟢 آنلاین' : '🔴 آفلاین',
  ];
  if (phone) parts.push(phone);
  return parts.join(' · ');
}

function formatAdminVetListPage(vets: User[], page: number): string {
  const enabledCount = vets.filter((v) => v.vetEnabled !== false).length;
  const totalPages = Math.max(1, Math.ceil(vets.length / ADMIN_VET_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * ADMIN_VET_LIST_PAGE_SIZE;
  const slice = vets.slice(start, start + ADMIN_VET_LIST_PAGE_SIZE);
  const lines = slice.map((v, i) => formatAdminVetListLine(v, start + i + 1));
  return [
    '🩺 <b>مدیریت پزشک‌ها</b>',
    `کل: <b>${vets.length}</b> · فعال: <b>${enabledCount}</b> · غیرفعال: <b>${vets.length - enabledCount}</b>`,
    totalPages > 1 ? `صفحه <b>${safePage + 1}</b> از <b>${totalPages}</b>` : null,
    '',
    ...lines,
    '',
    'برای فعال/غیرفعال کردن، پزشک را از دکمه‌های زیر انتخاب کن.',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

async function loadAdminVets(ctx: Context): Promise<User[] | null> {
  try {
    return await listAllVets();
  } catch (err) {
    console.error('listAllVets failed:', err);
    await ctx.reply('خطا در دریافت لیست پزشک‌ها.', { reply_markup: adminPanelKeyboard() });
    return null;
  }
}

/** لیست پزشک‌ها — یک پیام خلاصه + دکمه‌های انتخاب/صفحه‌بندی */
export async function handleAdminVetList(ctx: Context, page = 0): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;

  const vets = await loadAdminVets(ctx);
  if (!vets) return;

  if (vets.length === 0) {
    const empty = '📭 هنوز دامپزشکی ثبت نشده.';
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery().catch(() => undefined);
      try {
        await ctx.editMessageText(empty);
      } catch {
        await ctx.reply(empty, { reply_markup: adminPanelKeyboard() });
      }
    } else {
      await ctx.reply(empty, { reply_markup: adminPanelKeyboard() });
    }
    return;
  }

  const totalPages = Math.max(1, Math.ceil(vets.length / ADMIN_VET_LIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const text = formatAdminVetListPage(vets, safePage);
  const kb = adminVetListKeyboard(vets, safePage, ADMIN_VET_LIST_PAGE_SIZE);

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery().catch(() => undefined);
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* fall through to reply */
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

/** جزئیات یک پزشک از لیست ادمین */
export async function handleAdminVetView(
  ctx: Context,
  userId: number,
  listPage = 0
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;

  const vets = await loadAdminVets(ctx);
  if (!vets) return;

  const vet = vets.find((v) => v.id === userId);
  if (!vet) {
    await ctx.answerCallbackQuery({ text: 'پزشک پیدا نشد', show_alert: true }).catch(() => undefined);
    return;
  }

  await ctx.answerCallbackQuery().catch(() => undefined);
  const enabled = vet.vetEnabled !== false;
  try {
    await ctx.editMessageText(formatAdminVetCard(vet), {
      parse_mode: 'HTML',
      reply_markup: adminVetToggleKeyboard(vet.id, enabled, listPage),
    });
  } catch {
    await ctx.reply(formatAdminVetCard(vet), {
      parse_mode: 'HTML',
      reply_markup: adminVetToggleKeyboard(vet.id, enabled, listPage),
    });
  }
}

export async function handleAdminVetToggle(
  ctx: Context,
  userId: number,
  enabled: boolean,
  listPage = 0
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;

  let result: Awaited<ReturnType<typeof setVetEnabled>>;
  try {
    result = await setVetEnabled(userId, enabled);
  } catch (err) {
    console.error('setVetEnabled failed:', err);
    await ctx.answerCallbackQuery({ text: 'خطا در به‌روزرسانی', show_alert: true }).catch(() => undefined);
    return;
  }

  const user = result.user;
  const sms = result.sms;
  const smsLine = sms.sent
    ? `📱 پیامک ارسال شد به ${sms.phone}`
    : `📱 پیامک ارسال نشد: ${'reason' in sms ? sms.reason : 'نامشخص'}`;

  await ctx.answerCallbackQuery({
    text: enabled ? 'پزشک فعال شد ✅' : 'پزشک غیرفعال شد',
  }).catch(() => undefined);

  try {
    await ctx.editMessageText(
      `${formatAdminVetCard(user)}\n\n${enabled ? '✅ فعال شد.' : '⏸ غیرفعال شد.'}\n${escapeHtml(smsLine)}`,
      {
        parse_mode: 'HTML',
        reply_markup: adminVetToggleKeyboard(user.id, user.vetEnabled !== false, listPage),
      }
    );
  } catch {
    await ctx.reply(
      `${formatAdminVetCard(user)}\n\n${enabled ? '✅ فعال شد.' : '⏸ غیرفعال شد.'}\n${escapeHtml(smsLine)}`,
      {
        parse_mode: 'HTML',
        reply_markup: adminVetToggleKeyboard(user.id, user.vetEnabled !== false, listPage),
      }
    );
  }

  // اطلاع تلگرامی به پزشک (علاوه بر پیامک)
  if (user.telegramId) {
    try {
      await ctx.api.sendMessage(
        user.telegramId,
        enabled
          ? '✅ حساب دامپزشکی‌ات توسط مدیر فعال شد. می‌تونی دوباره آنلاین بشی.'
          : '⏸ حساب دامپزشکی‌ات توسط مدیر غیرفعال شد. تا اطلاع بعدی در لیست پزشک‌ها نیستی.'
      );
    } catch (err) {
      console.warn('notify vet enabled toggle failed:', err);
    }
  }
}

/** هندل دکمه‌های کیبورد پنل ادمین */
export async function handleAdminMenuText(ctx: Context, text: string): Promise<boolean> {
  const m = ADMIN_MENU;
  switch (text) {
    case m.panel:
      await handleAdminEntry(ctx);
      return true;
    case m.faceQueue:
      if (!(await requireAdminAuth(ctx))) return true;
      await handleAdminVerifyQueue(ctx);
      return true;
    case m.vetQueue:
      await handleAdminVetCredentialQueue(ctx);
      return true;
    case m.trainerQueue:
      await handleAdminProviderCredentialQueue(ctx, 'trainer');
      return true;
    case '🏠 صف مدارک پرستار':
      await ctx.reply('صف مدارک پرستار حذف شده است.', {
        reply_markup: adminPanelKeyboard(),
      });
      return true;
    case m.photoQueue:
      await handleAdminPetPhotoQueue(ctx);
      return true;
    case m.avatarQueue:
      await handleAdminUserAvatarQueue(ctx);
      return true;
    case m.vetList:
      await handleAdminVetList(ctx);
      return true;
    case m.stats:
      await handleAdminStats(ctx);
      return true;
    case m.pendingPayments:
      await handleAdminPendingPayments(ctx);
      return true;
    case m.back:
    case m.menu:
      await handleAdminBackToMenu(ctx);
      return true;
    default:
      return false;
  }
}

export async function handleAdminProviderCredentialQueue(
  ctx: Context,
  kind: 'trainer' | 'sitter'
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let pending: Awaited<ReturnType<typeof listPendingProviderCredentials>>;
  try {
    pending = await listPendingProviderCredentials(kind);
  } catch (err) {
    console.error('listPendingProviderCredentials failed:', err);
    await ctx.reply('خطا در دریافت صف مدارک.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  const label = kind === 'trainer' ? 'مربی' : 'پرستار';
  if (!pending.length) {
    await ctx.reply(`📭 صف مدارک ${label} خالی است.`, {
      reply_markup: adminPanelKeyboard(),
    });
    return;
  }
  await ctx.reply(`📋 ${pending.length} مدرک ${label} در صف:`, {
    reply_markup: adminPanelKeyboard(),
  });
  const user = pending[0]!;
  const fileId =
    kind === 'trainer' ? user.trainerCredentialFileId : user.sitterCredentialFileId;
  const caption = [
    `📄 <b>مدرک ${label}</b>`,
    '',
    `<b>نام:</b> ${escapeHtml(user.name)}`,
    user.telegramId ? `<b>تلگرام:</b> <code>${escapeHtml(user.telegramId)}</code>` : null,
    `<b>آیدی:</b> <code>${user.id}</code>`,
  ]
    .filter(Boolean)
    .join('\n');
  const kb = adminProviderCredentialKeyboard(user.id, kind);
  if (fileId) {
    const webPath = String(fileId).startsWith('/api/') ? String(fileId) : null;
    if (webPath) {
      const base = (process.env.PUBLIC_WEB_URL || process.env.WEB_URL || 'https://petdate.ir').replace(
        /\/$/,
        ''
      );
      const url = `${base}${webPath}`;
      await ctx.reply(`${caption}\n\n🔗 <a href="${escapeHtml(url)}">مشاهده مدرک</a>`, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    }
    try {
      await ctx.replyWithPhoto(fileId, { caption, parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* try document */
    }
    try {
      await ctx.replyWithDocument(fileId, { caption, parse_mode: 'HTML', reply_markup: kb });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(`${caption}\n\n⚠️ فایل در دسترس نیست.`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleAdminProviderCredentialAction(
  ctx: Context,
  kind: 'trainer' | 'sitter',
  userId: number,
  approve: boolean
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  try {
    if (approve) await approveProviderCredential(userId, kind);
    else await rejectProviderCredential(userId, kind);
    await ctx.reply(approve ? '✅ مدرک تأیید شد.' : '❌ مدرک رد شد.');
  } catch (err) {
    console.error('provider credential action failed:', err);
    await ctx.reply('عملیات ناموفق بود.');
  }
  await handleAdminProviderCredentialQueue(ctx, kind);
}

export async function handleAdminPetPhotoQueue(ctx: Context): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let pending: Awaited<ReturnType<typeof listPendingPetPhotos>>;
  try {
    pending = await listPendingPetPhotos();
  } catch (err) {
    console.error('listPendingPetPhotos failed:', err);
    await ctx.reply('خطا در دریافت صف عکس.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  if (!pending.length) {
    await ctx.reply('📭 صف عکس پت خالی است.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  await ctx.reply(`🖼 ${pending.length} عکس در صف تأیید:`, {
    reply_markup: adminPanelKeyboard(),
  });
  const pet = pending[0]!;
  const caption = [
    '🖼 <b>عکس پت در انتظار تأیید</b>',
    '',
    `<b>پت:</b> ${escapeHtml(pet.name)}`,
    pet.ownerName ? `<b>صاحب:</b> ${escapeHtml(pet.ownerName)}` : null,
    `<b>آیدی پت:</b> <code>${pet.id}</code>`,
  ]
    .filter(Boolean)
    .join('\n');
  const kb = adminPetPhotoKeyboard(pet.id);
  if (pet.imageUrl) {
    const ref = resolveTelegramPhotoUrl(pet.imageUrl) || pet.imageUrl;
    try {
      await ctx.replyWithPhoto(ref, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(`${caption}\n\n⚠️ عکس در دسترس نیست.`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleAdminPetPhotoAction(
  ctx: Context,
  petId: number,
  approve: boolean
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  try {
    await setPetPhotoModeration(petId, approve ? 'approved' : 'rejected');
    await ctx.reply(approve ? '✅ عکس تأیید شد.' : '❌ عکس رد شد.');
  } catch (err) {
    console.error('pet photo moderation failed:', err);
    await ctx.reply('عملیات ناموفق بود.');
  }
  await handleAdminPetPhotoQueue(ctx);
}

export async function handleAdminUserAvatarQueue(ctx: Context): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  let pending: Awaited<ReturnType<typeof listPendingUserAvatars>>;
  try {
    pending = await listPendingUserAvatars();
  } catch (err) {
    console.error('listPendingUserAvatars failed:', err);
    await ctx.reply('خطا در دریافت صف عکس کاربر.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  if (!pending.length) {
    await ctx.reply('📭 صف عکس کاربر خالی است.', { reply_markup: adminPanelKeyboard() });
    return;
  }
  await ctx.reply(`👤 ${pending.length} عکس کاربر در صف تأیید:`, {
    reply_markup: adminPanelKeyboard(),
  });
  const user = pending[0]!;
  const caption = [
    '👤 <b>عکس پروفایل در انتظار تأیید</b>',
    '',
    `<b>نام:</b> ${escapeHtml(user.name)}`,
    user.username ? `<b>یوزرنیم:</b> @${escapeHtml(user.username)}` : null,
    `<b>آیدی:</b> <code>${user.id}</code>`,
    user.city ? `<b>شهر:</b> ${escapeHtml(user.city)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const kb = adminUserAvatarKeyboard(user.id);
  const photo = user.avatarUrl;
  if (photo) {
    const ref = resolveTelegramPhotoUrl(photo) || photo;
    try {
      await ctx.replyWithPhoto(ref, {
        caption,
        parse_mode: 'HTML',
        reply_markup: kb,
      });
      return;
    } catch {
      /* fall through */
    }
  }
  await ctx.reply(`${caption}\n\n⚠️ عکس در دسترس نیست.`, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleAdminUserAvatarAction(
  ctx: Context,
  userId: number,
  approve: boolean
): Promise<void> {
  if (!(await requireAdminAuth(ctx))) return;
  try {
    await setUserAvatarModeration(userId, approve ? 'approved' : 'rejected');
    await ctx.reply(approve ? '✅ عکس کاربر تأیید شد.' : '❌ عکس کاربر رد شد.');
  } catch (err) {
    console.error('user avatar moderation failed:', err);
    await ctx.reply('عملیات ناموفق بود.');
  }
  await handleAdminUserAvatarQueue(ctx);
}
