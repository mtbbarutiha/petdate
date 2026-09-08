import { InlineKeyboard, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import type { BotSession, User } from '@petdate/shared';
import {
  formatPeerOwnerProfileHtml,
  toUserCommandId,
  userCommandIdOf,
} from '@petdate/shared';
import {
  addUserContact,
  getActiveOwnerChat,
  getPet,
  getUserById,
  getUserByTelegramId,
  postPlaydateChatMessage,
  postPlaydateChatTgRefs,
  endPlaydateChatViaApi,
  setPlaydateChatSecureViaApi,
  type ActiveOwnerChat,
} from '../api-client';
import { getSession, upsertSession } from '../session';
import { getCtxUser, menuKeyboardFor, pushReplyKeyboardToChat } from './helpers';
import { formatPet } from '../format';
import { MAIN_MENU_ALIASES, MAIN_MENU_BTN, MENU_LABELS, mainMenuKeyboard } from '../keyboards';
import { effectiveWebUrl, isTelegramInlineUrl, resolveTelegramPhotoUrl } from '../urls';
import { claimWebChatCtaOnce } from '../web-chat-cta-once';

export const OWNER_CHAT_BTNS = {
  secureOn: '🔒 چت امن',
  secureOff: '🔓 خاموش‌کردن چت امن',
  peerProfile: '👤 پروفایل طرف مقابل',
  petProfile: '🐾 مشاهده پروفایل پت',
  addContact: '➕ افزودن مخاطب',
  end: '🔌 قطع چت همبازی',
} as const;

const OWNER_CHAT_ACTION_BTNS = new Set<string>([
  OWNER_CHAT_BTNS.secureOn,
  OWNER_CHAT_BTNS.secureOff,
  OWNER_CHAT_BTNS.peerProfile,
  OWNER_CHAT_BTNS.petProfile,
  OWNER_CHAT_BTNS.addContact,
  OWNER_CHAT_BTNS.end,
]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** کیبورد چت دو نفره — بدون منوی اصلی */
export function ownerChatReplyKeyboard(secure = false): Keyboard {
  return new Keyboard()
    .text(secure ? OWNER_CHAT_BTNS.secureOff : OWNER_CHAT_BTNS.secureOn)
    .text(OWNER_CHAT_BTNS.peerProfile)
    .row()
    .text(OWNER_CHAT_BTNS.petProfile)
    .text(OWNER_CHAT_BTNS.addContact)
    .row()
    .text(OWNER_CHAT_BTNS.end)
    .danger()
    .resized()
    .persistent();
}

function clearOwnerChatPatch() {
  return {
    step: 'ready' as const,
    ownerChatPlaydateId: undefined as number | undefined,
    ownerChatPeerTelegramId: undefined as string | undefined,
    ownerChatPeerUserId: undefined as number | undefined,
    ownerChatMyPetId: undefined as number | undefined,
    ownerChatPeerPetId: undefined as number | undefined,
    ownerChatSecure: undefined as boolean | undefined,
    ownerChatWebHintSent: undefined as boolean | undefined,
  };
}

/** web-cta-once-v2 — one-time web chat option for playmate sessions (never on relay/resume). */
async function sendOwnerChatWebHintOnce(
  ctx: Context,
  telegramId: string,
  playdateId: number | undefined
): Promise<void> {
  if (!playdateId) return;
  const allowed = await claimWebChatCtaOnce('playmate', playdateId, telegramId);
  if (!allowed) return;
  const webBase = effectiveWebUrl().replace(/\/$/, '');
  const webChatUrl = `${webBase}/chats/${playdateId}`;
  const canButton = isTelegramInlineUrl(webChatUrl);
  const text = canButton
    ? '🌐 می‌توانید در وب هم چت کنید — اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.'
    : [
        '🌐 می‌توانید در وب هم چت کنید:',
        webChatUrl,
        'اگر همین‌جا ادامه دهید، پیام‌ها در ربات رد و بدل می‌شوند.',
      ].join('\n');
  try {
    if (canButton) {
      await ctx.api.sendMessage(telegramId, text, {
        reply_markup: new InlineKeyboard().url('ورود به چت وب', webChatUrl),
      });
    } else {
      await ctx.api.sendMessage(telegramId, text);
    }
    await upsertSession(telegramId, { ownerChatWebHintSent: true });
  } catch {
    /* ignore */
  }
}

const CHAT_WIPE_HINT =
  '🗑 لطفاً کل این گفتگو را از تلگرام پاک کنید تا اثری از پیام‌ها (متن، عکس، ویس و …) نماند.';

/** Playmate chat: tappable bot-command آیدی (/u00042) — never Telegram @username. */
function playmatePeerIdLabel(user: { id: number; publicId?: string | null }): string {
  return userCommandIdOf(user);
}

function formatPeerOwnerCard(
  user: User,
  heading = '👤 <b>پروفایل طرف مقابل</b>'
): string {
  return formatPeerOwnerProfileHtml(user, { heading });
}

function protectOpts(secure: boolean): { protect_content?: true } {
  return secure ? { protect_content: true } : {};
}

/**
 * Show an owner profile card (with photo when possible).
 * Shared by owner-chat peer button and incoming playdate «مشاهده پروفایل صاحب پت».
 */
export async function replyWithOwnerProfile(
  ctx: Context,
  user: User,
  opts?: {
    heading?: string;
    protectContent?: boolean;
  }
): Promise<void> {
  const card = formatPeerOwnerCard(user, opts?.heading);
  const protect = protectOpts(Boolean(opts?.protectContent));
  const photo = resolveTelegramPhotoUrl(user.avatarUrl);
  if (photo) {
    try {
      await ctx.replyWithPhoto(photo, {
        caption: card,
        parse_mode: 'HTML',
        ...protect,
      });
      return;
    } catch (err) {
      console.warn('owner profile photo failed:', (err as Error).message);
    }
  }

  await ctx.reply(
    photo ? card : `${card}\n\n📷 عکس پروفایل ثبت نشده.`,
    {
      parse_mode: 'HTML',
      ...protect,
    }
  );
}

/**
 * بعد از قبول درخواست همبازی توسط گیرنده:
 * هر دو طرف بلافاصله وارد چت می‌شوند — بدون دکمه «شروع چت».
 *
 * مهم: intro را با ctx.api.sendMessage می‌فرستیم (نه ctx.reply) تا sticky-middleware
 * کیبورد را از پیام محتوا جدا نکند قبل از push؛ سپس کیبورد چت را sticky می‌کنیم.
 * notify هر طرف مستقل است تا خطای یکی، طرف دیگر را از دست ندهد.
 */
export async function startOwnerChat(
  ctx: Context,
  playdateId: number,
  accepter: User,
  requester: User,
  opts?: {
    fromPetName?: string;
    toPetName?: string;
    fromPetId?: number;
    toPetId?: number;
  }
): Promise<void> {
  const accepterTg = accepter.telegramId != null ? String(accepter.telegramId).trim() : '';
  const requesterTg = requester.telegramId != null ? String(requester.telegramId).trim() : '';
  if (!accepterTg || !requesterTg) {
    await ctx.reply('برای شروع چت، هر دو طرف باید از ربات استفاده کرده باشند.');
    return;
  }

  await upsertSession(accepterTg, {
    step: 'owner_chat',
    ownerChatPlaydateId: playdateId,
    ownerChatPeerTelegramId: requesterTg,
    ownerChatPeerUserId: requester.id,
    ownerChatMyPetId: opts?.toPetId,
    ownerChatPeerPetId: opts?.fromPetId,
    ownerChatSecure: false,
    ownerChatWebHintSent: false,
  });

  await upsertSession(requesterTg, {
    step: 'owner_chat',
    ownerChatPlaydateId: playdateId,
    ownerChatPeerTelegramId: accepterTg,
    ownerChatPeerUserId: accepter.id,
    ownerChatMyPetId: opts?.fromPetId,
    ownerChatPeerPetId: opts?.toPetId,
    ownerChatSecure: false,
    ownerChatWebHintSent: false,
  });

  const petLine =
    opts?.fromPetName && opts?.toPetName
      ? `پت‌ها: <b>${escapeHtml(opts.fromPetName)}</b> ↔ <b>${escapeHtml(opts.toPetName)}</b>`
      : null;

  const tipLines = [
    'دکمه‌های چت:',
    `• ${OWNER_CHAT_BTNS.secureOn} — پیام‌ها غیرقابل ذخیره/فوروارد`,
    `• ${OWNER_CHAT_BTNS.peerProfile} / ${OWNER_CHAT_BTNS.petProfile}`,
    `• ${OWNER_CHAT_BTNS.addContact}`,
    `• ${OWNER_CHAT_BTNS.end}`,
  ].join('\n');

  const accepterIntro = [
    '💬 <b>چت با صاحب پت فعال شد</b>',
    '',
    `طرف مقابل: ${escapeHtml(playmatePeerIdLabel(requester))}`,
    petLine,
    '',
    '👋 به همبازی جدید سلام کن!',
    'هر پیامی بفرستی مستقیم به صاحب پت همبازی می‌رسد.',
    '',
    tipLines,
  ]
    .filter(Boolean)
    .join('\n');

  const requesterIntro = [
    '✅ <b>درخواست همبازی پذیرفته شد!</b>',
    '',
    `طرف مقابل: ${escapeHtml(playmatePeerIdLabel(accepter))}`,
    petLine,
    '',
    '💬 چت همبازی همین الان فعال شد.',
    '👋 به همبازی جدید سلام کن!',
    '',
    tipLines,
  ]
    .filter(Boolean)
    .join('\n');

  const chatKeyboard = ownerChatReplyKeyboard(false);

  /**
   * Keyboard MUST stay on the content message. Never send+delete a carrier
   * afterward — deleting that message clears ReplyKeyboard on many clients.
   */
  const openChatFor = async (telegramId: string, intro: string, who: string): Promise<boolean> => {
    try {
      await ctx.api.sendMessage(telegramId, intro, {
        parse_mode: 'HTML',
        reply_markup: chatKeyboard,
      });
      return true;
    } catch (err) {
      console.warn(`owner chat intro+keyboard failed (${who}):`, err);
      try {
        await ctx.api.sendMessage(telegramId, intro, { parse_mode: 'HTML' });
      } catch (err2) {
        console.warn(`owner chat intro failed (${who}):`, err2);
        return false;
      }
      const kbOk = await pushReplyKeyboardToChat(ctx.api, telegramId, chatKeyboard);
      if (!kbOk) {
        console.warn(`owner chat keyboard fallback failed (${who})`);
      }
      return true;
    }
  };

  const accepterOk = await openChatFor(accepterTg, accepterIntro, 'accepter');
  if (accepterOk) {
    await sendOwnerChatWebHintOnce(ctx, accepterTg, playdateId);
  }

  const requesterOk = await openChatFor(requesterTg, requesterIntro, 'requester');
  if (requesterOk) {
    await sendOwnerChatWebHintOnce(ctx, requesterTg, playdateId);
  } else {
    console.warn('notify requester owner chat open failed for playdate', playdateId);
  }
}

async function handleSecureToggle(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat' || !session.ownerChatPeerTelegramId) {
    return false;
  }

  const nextSecure = !session.ownerChatSecure;
  const peerId = session.ownerChatPeerTelegramId;

  await upsertSession(String(from.id), { ownerChatSecure: nextSecure });
  await upsertSession(peerId, { ownerChatSecure: nextSecure });

  if (session.ownerChatPlaydateId) {
    const me = await getCtxUser(ctx);
    if (me?.id) {
      await setPlaydateChatSecureViaApi(session.ownerChatPlaydateId, me.id, nextSecure);
    }
  }

  const selfMsg = nextSecure
    ? '🔒 <b>چت امن فعال شد.</b>\nاز این به بعد پیام‌ها (متن، عکس، ویس و …) قابل ذخیره یا فوروارد نیستند.'
    : '🔓 چت امن خاموش شد. پیام‌های بعدی مثل قبل قابل ذخیره هستند.';
  const peerMsg = nextSecure
    ? '🔒 <b>طرف مقابل چت امن را فعال کرد.</b>\nپیام‌های این گفتگو قابل ذخیره یا فوروارد نیستند.'
    : '🔓 طرف مقابل چت امن را خاموش کرد.';

  await ctx.reply(selfMsg, {
    parse_mode: 'HTML',
    reply_markup: ownerChatReplyKeyboard(nextSecure),
  });

  try {
    await ctx.api.sendMessage(peerId, peerMsg, {
      parse_mode: 'HTML',
      reply_markup: ownerChatReplyKeyboard(nextSecure),
    });
  } catch {
    /* ignore */
  }
  return true;
}

async function handleShowPeerProfile(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat') return false;

  let peer: User | null = null;
  if (session.ownerChatPeerUserId) {
    peer = await getUserById(session.ownerChatPeerUserId);
  } else if (session.ownerChatPeerTelegramId) {
    peer = await getUserByTelegramId(session.ownerChatPeerTelegramId);
  }

  if (!peer) {
    await ctx.reply('پروفایل طرف مقابل پیدا نشد.');
    return true;
  }

  await replyWithOwnerProfile(ctx, peer, {
    protectContent: !!session.ownerChatSecure,
  });
  return true;
}

async function handleShowPeerPetProfile(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat') return false;

  const petId = session.ownerChatPeerPetId;
  if (!petId) {
    await ctx.reply('پروفایل پت طرف مقابل در این چت مشخص نیست.');
    return true;
  }

  const pet = await getPet(petId);
  if (!pet) {
    await ctx.reply('پروفایل پت پیدا نشد.');
    return true;
  }

  const text = `🐾 <b>پروفایل پت طرف مقابل</b>\n\n${formatPet(pet, true)}`;
  const secure = !!session.ownerChatSecure;
  const photo = resolveTelegramPhotoUrl(pet.imageUrl);
  if (photo) {
    try {
      await ctx.replyWithPhoto(photo, {
        caption: text,
        parse_mode: 'HTML',
        ...protectOpts(secure),
      });
      return true;
    } catch (err) {
      console.warn('owner peer pet photo failed:', (err as Error).message);
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...protectOpts(secure),
  });
  return true;
}

async function handleAddContact(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat') return false;

  const me = await getCtxUser(ctx);
  if (!me?.id) {
    await ctx.reply('حسابت پیدا نشد. دوباره /start بزن.');
    return true;
  }

  let peerUserId = session.ownerChatPeerUserId;
  if (!peerUserId && session.ownerChatPeerTelegramId) {
    const peer = await getUserByTelegramId(session.ownerChatPeerTelegramId);
    peerUserId = peer?.id;
  }

  if (!peerUserId) {
    await ctx.reply('طرف مقابل پیدا نشد.');
    return true;
  }

  try {
    const result = await addUserContact(me.id, peerUserId);
    await ctx.reply(
      result.created
        ? '➕ مخاطب با موفقیت اضافه شد.'
        : 'این شخص از قبل در مخاطبینت بود.'
    );
  } catch (err) {
    console.warn('add contact failed:', err);
    await ctx.reply('افزودن مخاطب ناموفق بود. کمی بعد دوباره امتحان کن.');
  }
  return true;
}

export async function handleOwnerChatEnd(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat') return false;

  const peerId = session.ownerChatPeerTelegramId;
  const wasSecure = !!session.ownerChatSecure;
  const user = await getCtxUser(ctx);

  const playdateId = session.ownerChatPlaydateId;
  await upsertSession(String(from.id), clearOwnerChatPatch());

  if (playdateId && user?.id) {
    await endPlaydateChatViaApi(playdateId, user.id);
  }

  const endSelf = [
    'چت همبازی پایان یافت.',
    '',
    CHAT_WIPE_HINT,
    wasSecure ? 'چت امن فعال بود — حتماً گفتگو را پاک کن.' : null,
  ]
    .filter(Boolean)
    .join('\n');

  const endPeer = [
    '🔌 چت همبازی قطع شد.',
    '',
    CHAT_WIPE_HINT,
    wasSecure ? 'چت امن فعال بود — حتماً گفتگو را پاک کن.' : null,
  ]
    .filter(Boolean)
    .join('\n');

  if (peerId) {
    await upsertSession(peerId, clearOwnerChatPatch());
    try {
      const peerUser = await getUserByTelegramId(peerId);
      await ctx.api.sendMessage(peerId, endPeer, {
        reply_markup: mainMenuKeyboard(peerUser?.role, peerUser?.roles, Number(peerId), {
          vetOnline: peerUser?.vetOnline,
        }),
      });
    } catch {
      try {
        await ctx.api.sendMessage(peerId, endPeer);
      } catch {
        /* ignore */
      }
    }
  }

  await ctx.reply(endSelf, {
    reply_markup: menuKeyboardFor(ctx, user),
  });
  return true;
}

async function handleOwnerChatAction(ctx: Context, text: string): Promise<boolean> {
  if (text === OWNER_CHAT_BTNS.end || MAIN_MENU_ALIASES.has(text) || text === MAIN_MENU_BTN) {
    return handleOwnerChatEnd(ctx);
  }
  if (text === OWNER_CHAT_BTNS.secureOn || text === OWNER_CHAT_BTNS.secureOff) {
    return handleSecureToggle(ctx);
  }
  if (text === OWNER_CHAT_BTNS.peerProfile) {
    return handleShowPeerProfile(ctx);
  }
  if (text === OWNER_CHAT_BTNS.petProfile) {
    return handleShowPeerPetProfile(ctx);
  }
  if (text === OWNER_CHAT_BTNS.addContact) {
    return handleAddContact(ctx);
  }
  return false;
}


/**
 * اگر همبازی پذیرفته‌شده و قطع‌نشده در API هست، سشن ربات را به owner_chat برگردان.
 * برای همگام‌سازی وقتی کاربر روی وب چت می‌کند ولی سشن تلگرام هنوز منوی اصلی است.
 */
export async function ensureOwnerChatSession(
  telegramId: string,
  userId?: number
): Promise<{ session: BotSession; active: ActiveOwnerChat; resumed: boolean } | null> {
  const existing = await getSession(telegramId);
  if (
    existing?.step === 'owner_chat' &&
    existing.ownerChatPeerTelegramId &&
    existing.ownerChatPlaydateId
  ) {
    return {
      session: existing,
      active: {
        playdateId: existing.ownerChatPlaydateId,
        peerTelegramId: existing.ownerChatPeerTelegramId,
        peerUserId: existing.ownerChatPeerUserId ?? 0,
        myPetId: existing.ownerChatMyPetId ?? 0,
        peerPetId: existing.ownerChatPeerPetId ?? 0,
        chatSecure: !!existing.ownerChatSecure,
      },
      resumed: false,
    };
  }

  const active = await getActiveOwnerChat(telegramId);
  if (!active?.peerTelegramId) return null;

  const session = await upsertSession(telegramId, {
    userId,
    step: 'owner_chat',
    ownerChatPlaydateId: active.playdateId,
    ownerChatPeerTelegramId: active.peerTelegramId,
    ownerChatPeerUserId: active.peerUserId,
    ownerChatMyPetId: active.myPetId,
    ownerChatPeerPetId: active.peerPetId,
    ownerChatSecure: Boolean(active.chatSecure),
  });

  return { session, active, resumed: true };
}

/** برای /start — اگر چت فعال است فقط اطلاع بده؛ منوی اصلی را جایگزین نکن */
export async function resumeOwnerChatOnStart(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;
  const active = await getActiveOwnerChat(String(from.id));
  if (!active?.peerTelegramId) return false;

  await ctx.reply(
    [
      '💬 چت همبازی هنوز فعاله.',
      active.peerPublicId
        ? `طرف مقابل: ${toUserCommandId(active.peerPublicId)}`
        : active.peerUserId
          ? `طرف مقابل: ${playmatePeerIdLabel({ id: active.peerUserId })}`
          : null,
      'از منوی اصلی استفاده کن؛ برای ادامه چت همین‌جا پیام عادی بفرست.',
      `قطع چت: ${OWNER_CHAT_BTNS.end}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return true;
}

/**
 * Explicit opt-in kept for older «شروع چت» buttons; new accepts auto-enter both sides.
 */
export async function enterOwnerChatFromCallback(
  ctx: Context,
  playdateId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const from = ctx.from;
  if (!from) return;
  const me = await getCtxUser(ctx);
  if (!me?.id) {
    await ctx.reply('اول /start بزن.');
    return;
  }

  const { getPlaydate, getUserById } = await import('../api-client');
  const pd = await getPlaydate(playdateId);
  if (!pd || pd.status !== 'accepted') {
    await ctx.reply('این همبازی هنوز تایید نشده یا پیدا نشد.');
    return;
  }

  const recipientId = pd.toUserId;
  const isParticipant = pd.fromUserId === me.id || recipientId === me.id;
  if (!isParticipant) {
    await ctx.reply('این چت مربوط به تو نیست.');
    return;
  }

  const peerUserId = pd.fromUserId === me.id ? recipientId : pd.fromUserId;
  if (!peerUserId) {
    await ctx.reply('طرف مقابل پیدا نشد.');
    return;
  }
  const peer = await getUserById(peerUserId);
  if (!peer?.telegramId) {
    await ctx.reply('طرف مقابل تلگرام ندارد؛ چت ربات ممکن نیست.');
    return;
  }

  const myPetId = pd.fromUserId === me.id ? pd.fromPetId : pd.toPetId;
  const peerPetId = pd.fromUserId === me.id ? pd.toPetId : pd.fromPetId;

  await upsertSession(String(from.id), {
    userId: me.id,
    step: 'owner_chat',
    ownerChatPlaydateId: playdateId,
    ownerChatPeerTelegramId: String(peer.telegramId),
    ownerChatPeerUserId: peer.id,
    ownerChatMyPetId: myPetId,
    ownerChatPeerPetId: peerPetId,
    ownerChatSecure: false,
  });

  await ctx.reply(
    [
      '💬 <b>چت همبازی فعال است</b>',
      '',
      `طرف مقابل: ${escapeHtml(playmatePeerIdLabel(peer))}`,
      '👋 به همبازی جدید سلام کن!',
      'از حالا پیام‌هایت مستقیم می‌رسد.',
    ].join('\n'),
    { parse_mode: 'HTML', reply_markup: ownerChatReplyKeyboard(false) }
  );
  await sendOwnerChatWebHintOnce(ctx, String(from.id), playdateId);
}

export async function handleOwnerChatRelay(ctx: Context): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const text = ctx.message?.text?.trim();
  // اگر هنوز در حالت چت نیستیم و کاربر دکمه منوی اصلی زده، وارد چت نشو
  // تا اکشن‌های منو (پیدا کردن همبازی و …) کار کنند.
  const lookingLikeMenu =
    Boolean(text) &&
    (MENU_LABELS.has(text!) || MAIN_MENU_ALIASES.has(text!) || text === MAIN_MENU_BTN);

  let session = await getSession(String(from.id));
  if (!session || session.step !== 'owner_chat' || !session.ownerChatPeerTelegramId) {
    if (lookingLikeMenu) return false;
    const me = await getCtxUser(ctx);
    const ensured = await ensureOwnerChatSession(String(from.id), me?.id);
    if (!ensured) return false;
    session = ensured.session;
    if (ensured.resumed) {
      await ctx.reply(
        [
          '💬 چت همبازی دوباره فعال شد.',
          ensured.active.peerPublicId
            ? `طرف مقابل: ${toUserCommandId(ensured.active.peerPublicId)}`
            : ensured.active.peerUserId
              ? `طرف مقابل: ${playmatePeerIdLabel({ id: ensured.active.peerUserId })}`
              : null,
          'پیام‌هایت مستقیم به طرف مقابل می‌رسد.',
        ]
          .filter(Boolean)
          .join('\n'),
        { reply_markup: ownerChatReplyKeyboard(!!session.ownerChatSecure) }
      );
    }
  }
  if (!session.ownerChatPeerTelegramId) return false;

  if (text && (OWNER_CHAT_ACTION_BTNS.has(text) || MAIN_MENU_ALIASES.has(text) || text === MAIN_MENU_BTN)) {
    return handleOwnerChatAction(ctx, text);
  }

  // Main-menu reply buttons (e.g. پیدا کردن همبازی) must not be relayed as chat text
  if (text && MENU_LABELS.has(text)) {
    await upsertSession(String(from.id), clearOwnerChatPatch());
    return false;
  }

  const peer = session.ownerChatPeerTelegramId;
  let playdateId = session.ownerChatPlaydateId;
  const secure = !!session.ownerChatSecure;
  const protect = protectOpts(secure);

  // Messages the API forwarded from the web app — do not re-relay
  if (text?.startsWith('💬 پیام همبازی از')) {
    return false;
  }

  /** Resolve playdate id from Redis session or live API (web↔TG sync). */
  async function resolvePlaydateId(): Promise<number | undefined> {
    if (playdateId && Number.isFinite(playdateId) && playdateId > 0) return playdateId;
    const active = await getActiveOwnerChat(String(from!.id));
    if (active?.playdateId && Number.isFinite(active.playdateId) && active.playdateId > 0) {
      playdateId = active.playdateId;
      await upsertSession(String(from!.id), {
        ownerChatPlaydateId: active.playdateId,
        ownerChatPeerTelegramId: active.peerTelegramId || peer,
        ownerChatPeerUserId: active.peerUserId,
        ownerChatMyPetId: active.myPetId,
        ownerChatPeerPetId: active.peerPetId,
        ownerChatSecure: Boolean(active.chatSecure),
        step: 'owner_chat',
      });
      return playdateId;
    }
    console.warn('owner chat persist skipped: no playdateId', { telegramId: from!.id });
    return undefined;
  }

  async function persistMedia(
    kind: string,
    fileId: string,
    caption?: string,
    mimeType?: string,
    fileName?: string
  ) {
    const pdId = await resolvePlaydateId();
    if (!pdId) return;
    const me = await getCtxUser(ctx);
    if (!me?.id) {
      console.warn('owner chat persist skipped: no sender user', { playdateId: pdId });
      return;
    }
    await postPlaydateChatMessage(pdId, me.id, caption || '', {
      mediaKind: kind,
      telegramFileId: fileId,
      mimeType,
      fileName,
    });
  }

  async function rememberPeerDelivery(messageId?: number) {
    const pdId = await resolvePlaydateId();
    if (!pdId || !messageId) return;
    await postPlaydateChatTgRefs(pdId, [
      { telegramChatId: String(peer), messageId },
    ]);
  }

  try {
    if (ctx.message?.photo?.length) {
      const fileId = ctx.message.photo[ctx.message.photo.length - 1]!.file_id;
      const sent = await ctx.api.sendPhoto(peer, fileId, {
        caption: ctx.message.caption || undefined,
        ...protect,
      });
      await rememberPeerDelivery(sent.message_id);
      await persistMedia('photo', fileId, ctx.message.caption || undefined, 'image/jpeg');
      return true;
    }
    if (ctx.message?.video) {
      const sent = await ctx.api.sendVideo(peer, ctx.message.video.file_id, {
        caption: ctx.message.caption || undefined,
        ...protect,
      });
      await rememberPeerDelivery(sent.message_id);
      await persistMedia(
        'video',
        ctx.message.video.file_id,
        ctx.message.caption || undefined,
        ctx.message.video.mime_type,
        ctx.message.video.file_name
      );
      return true;
    }
    if (ctx.message?.animation) {
      const sent = await ctx.api.sendAnimation(peer, ctx.message.animation.file_id, {
        caption: ctx.message.caption || undefined,
        ...protect,
      });
      await rememberPeerDelivery(sent.message_id);
      await persistMedia(
        'animation',
        ctx.message.animation.file_id,
        ctx.message.caption || undefined,
        ctx.message.animation.mime_type,
        ctx.message.animation.file_name
      );
      return true;
    }
    if (ctx.message?.video_note) {
      const sent = await ctx.api.sendVideoNote(peer, ctx.message.video_note.file_id, protect);
      await rememberPeerDelivery(sent.message_id);
      await persistMedia('video_note', ctx.message.video_note.file_id, undefined, 'video/mp4');
      return true;
    }
    if (ctx.message?.document) {
      const sent = await ctx.api.sendDocument(peer, ctx.message.document.file_id, {
        caption: ctx.message.caption || undefined,
        ...protect,
      });
      await rememberPeerDelivery(sent.message_id);
      await persistMedia(
        'document',
        ctx.message.document.file_id,
        ctx.message.caption || undefined,
        ctx.message.document.mime_type,
        ctx.message.document.file_name
      );
      return true;
    }
    if (ctx.message?.voice) {
      const sent = await ctx.api.sendVoice(peer, ctx.message.voice.file_id, protect);
      await rememberPeerDelivery(sent.message_id);
      await persistMedia('voice', ctx.message.voice.file_id, undefined, ctx.message.voice.mime_type);
      return true;
    }
    if (ctx.message?.audio) {
      const sent = await ctx.api.sendAudio(peer, ctx.message.audio.file_id, {
        caption: ctx.message.caption || undefined,
        ...protect,
      });
      await rememberPeerDelivery(sent.message_id);
      await persistMedia(
        'audio',
        ctx.message.audio.file_id,
        ctx.message.caption || undefined,
        ctx.message.audio.mime_type,
        ctx.message.audio.file_name
      );
      return true;
    }
    if (ctx.message?.sticker) {
      const sent = await ctx.api.sendSticker(peer, ctx.message.sticker.file_id, protect);
      await rememberPeerDelivery(sent.message_id);
      await persistMedia(
        'sticker',
        ctx.message.sticker.file_id,
        undefined,
        ctx.message.sticker.is_animated || ctx.message.sticker.is_video ? undefined : 'image/webp'
      );
      return true;
    }
    if (text) {
      const sent = await ctx.api.sendMessage(peer, text, protect);
      await rememberPeerDelivery(sent.message_id);
      // Persist so web ChatPage (WS + poll) sees Telegram → web
      const pdId = await resolvePlaydateId();
      if (pdId) {
        const me = await getCtxUser(ctx);
        if (me?.id) {
          await postPlaydateChatMessage(pdId, me.id, text);
        } else {
          console.warn('owner chat text persist skipped: no sender user', { playdateId: pdId });
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('owner chat relay failed:', err);
    await ctx.reply('ارسال به طرف مقابل ناموفق بود. ممکن است ربات را بلاک کرده باشد.');
    return true;
  }
  return false;
}
