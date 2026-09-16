import type { Context, NextFunction } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { config } from './config';
import { fetchPublicPlatformConfig } from './runtime-config';

export type RequiredChannel = {
  username: string;
  title: string;
  url: string;
};

const MEMBERSHIP_CHECK_TIMEOUT_MS = 2500;
const MEMBERSHIP_CACHE_TTL_MS = 90_000;
const NEGATIVE_CACHE_TTL_MS = 5_000;
const PROMPT_THROTTLE_MS = 15 * 60_000;
const TELEGRAM_SERVICE_USER_ID = 777000;

const MEMBER_OK = new Set(['creator', 'administrator', 'member', 'restricted']);

/** کش عضویت — نتیجهٔ مثبت طولانی، نتیجهٔ منفی خیلی کوتاه تا بعد از جوین قفل نماند */
const membershipCache = new Map<string, { status: 'yes' | 'no'; expiresAt: number }>();
const lastPromptAt = new Map<number, number>();

function membershipCacheKey(userId: number, channelUsername: string): string {
  return `${userId}:${channelUsername.replace(/^@/, '').toLowerCase()}`;
}

function isNonPrivateChat(ctx: Context): boolean {
  const type = ctx.chat?.type;
  return Boolean(type && type !== 'private');
}

function isSystemUpdate(ctx: Context): boolean {
  return Boolean(
    ctx.chatMember ||
      ctx.myChatMember ||
      ctx.channelPost ||
      ctx.editedChannelPost ||
      ctx.inlineQuery ||
      ctx.chosenInlineResult ||
      ctx.preCheckoutQuery
  );
}

/** کانال‌های اجباری برای استفاده از بات (فعلاً فقط petdate) */
export function requiredChannels(): RequiredChannel[] {
  const raw = config.forceJoinPetdateChannel ?? 'petdating';
  const petdate = raw.trim();
  // empty / off / none / false / disabled → force-join خاموش (ربات قفل نشود)
  if (!petdate || /^(off|none|false|0|disabled|-)$/i.test(petdate)) {
    return [];
  }
  return [
    {
      username: petdate.replace(/^@/, ''),
      title: 'کانال petdate',
      url: `https://t.me/${petdate.replace(/^@/, '')}`,
    },
  ];
}

/** دستورات/مسیرهایی که همیشه از گیت عضویت عبور می‌کنند تا ربات قفل نشود */
function isForceJoinBypass(ctx: Context): boolean {
  const data = ctx.callbackQuery?.data;
  if (data === 'join:check') return true;

  const text = ctx.message?.text?.trim();
  if (text) {
    // /start@BotName و مشابه
    if (/^\/(start|menu|help|cancel|u_?\d+)(@\w+)?(\s|$)/i.test(text)) return true;
    // دکمه‌های خروج از جریان گیرکرده
    if (text === '📋 منو' || text === 'منو' || text === 'منوی اصلی' || text === '❌ انصراف') {
      return true;
    }
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function safeAnswerCallback(
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

export async function isMemberOfChannel(
  ctx: Context,
  channelUsername: string
): Promise<'yes' | 'no' | 'error'> {
  const userId = ctx.from?.id;
  if (!userId) return 'no';
  const cacheKey = membershipCacheKey(userId, channelUsername);
  const cached = membershipCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }
  const chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
  try {
    const member = await withTimeout(
      ctx.api.getChatMember(chatId, userId),
      MEMBERSHIP_CHECK_TIMEOUT_MS
    );
    const status: 'yes' | 'no' = MEMBER_OK.has(member.status) ? 'yes' : 'no';
    membershipCache.set(cacheKey, {
      status,
      expiresAt: Date.now() + (status === 'yes' ? MEMBERSHIP_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
    });
    return status;
  } catch (err) {
    const msg = (err as { description?: string }).description ?? (err as Error).message;
    console.warn(`force-join check failed for ${chatId}:`, msg);
    return 'error';
  }
}

export async function missingChannels(ctx: Context): Promise<{
  missing: RequiredChannel[];
  errors: RequiredChannel[];
}> {
  const missing: RequiredChannel[] = [];
  const errors: RequiredChannel[] = [];
  for (const ch of requiredChannels()) {
    const status = await isMemberOfChannel(ctx, ch.username);
    if (status === 'no') missing.push(ch);
    // error/timeout را بلاک نمی‌کنیم تا ربات قفل نشود
    if (status === 'error') errors.push(ch);
  }
  return { missing, errors };
}

export function forceJoinKeyboard(channels: RequiredChannel[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  channels.forEach((ch) => {
    kb.url(`📢 عضویت در ${ch.title}`, ch.url).row();
  });
  kb.text('✅ عضو شدم — بررسی', 'join:check').success();
  return kb;
}

export function clearMembershipCache(userId: number): void {
  const prefix = `${userId}:`;
  for (const key of [...membershipCache.keys()]) {
    if (key.startsWith(prefix)) membershipCache.delete(key);
  }
}

export async function sendForceJoinPrompt(
  ctx: Context,
  missing: RequiredChannel[],
  _errors: RequiredChannel[] = []
): Promise<void> {
  if (isNonPrivateChat(ctx) || isSystemUpdate(ctx)) return;
  const userId = ctx.from?.id;
  if (!userId) return;
  const now = Date.now();
  const prev = lastPromptAt.get(userId) ?? 0;
  if (now - prev < PROMPT_THROTTLE_MS) {
    if (ctx.callbackQuery) {
      try {
        const channels = missing.length ? missing : requiredChannels();
        await ctx.editMessageText(
          [
            '🔒 عضویت اجباری',
            '',
            'برای استفاده از petdate باید عضو کانال بشی:',
            '',
            ...requiredChannels().map((c) => `📢 ${c.title}: ${c.url}`),
            '',
            missing.length ? `هنوز عضو نیستی:\n${missing.map((c) => `• ${c.title}`).join('\n')}` : '',
            '',
            'بعد از عضویت، دکمه «عضو شدم» رو بزن 👇',
          ]
            .filter((line) => line !== '')
            .join('\n'),
          { reply_markup: forceJoinKeyboard(channels) }
        );
      } catch {
        /* already showing prompt */
      }
    }
    return;
  }
  lastPromptAt.set(userId, now);

  const channels = missing.length ? missing : requiredChannels();
  if (!channels.length) return;

  const lines = [
    '🔒 عضویت اجباری',
    '',
    'برای استفاده از petdate باید عضو کانال بشی:',
    '',
    ...requiredChannels().map((c) => `📢 ${c.title}: ${c.url}`),
    '',
    missing.length ? `هنوز عضو نیستی:\n${missing.map((c) => `• ${c.title}`).join('\n')}\n` : '',
    'بعد از عضویت، دکمه «عضو شدم» رو بزن 👇',
    '',
    'اگر گیر کردی /start یا /cancel بزن.',
  ].filter((line) => line !== '');

  const kb = forceJoinKeyboard(channels);
  const text = lines.join('\n');

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { reply_markup: kb });
      return;
    } catch {
      /* fall through */
    }
  }
  try {
    await ctx.reply(text, { reply_markup: kb });
  } catch (err) {
    console.error('force-join prompt failed:', (err as Error).message);
  }
}

/** true = می‌تواند ادامه دهد */
export async function ensureForceJoined(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  if (!requiredChannels().length) return true;
  const { missing } = await missingChannels(ctx);
  if (missing.length === 0) return true;
  await sendForceJoinPrompt(ctx, missing);
  return false;
}

/**
 * Middleware: تا عضویت در کانال‌های اجباری، بقیهٔ بات را مسدود می‌کند
 * (به‌جز /start /menu /help /cancel و دکمه بررسی عضویت).
 * خطای API / timeout چک عضویت باعث قفل کامل نمی‌شود (fail-open).
 */
export async function forceJoinMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  try {
    if (!ctx.from) return next();
    if (ctx.from.is_bot || ctx.from.id === TELEGRAM_SERVICE_USER_ID) return next();
    // عضویت کانال را در کش به‌روز کن، ولی هرگز داخل کانال/گروه پیام نفرست
    if (ctx.chatMember) {
      const uid = ctx.chatMember.new_chat_member.user.id;
      for (const ch of requiredChannels()) {
        const status = ctx.chatMember.new_chat_member.status;
        const ok = MEMBER_OK.has(status) ? 'yes' : 'no';
        membershipCache.set(membershipCacheKey(uid, ch.username), {
          status: ok,
          expiresAt: Date.now() + (ok === 'yes' ? MEMBERSHIP_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
        });
      }
      return next();
    }
    if (isSystemUpdate(ctx) || isNonPrivateChat(ctx)) return next();

    const runtime = await fetchPublicPlatformConfig();
    if (!runtime.botForceJoin) return next();
    if (!requiredChannels().length) return next();
    if (isForceJoinBypass(ctx)) return next();

    const { missing } = await missingChannels(ctx);
    if (missing.length === 0) return next();

    await safeAnswerCallback(ctx, { text: 'اول عضو کانال شو', show_alert: true });
    await sendForceJoinPrompt(ctx, missing);
  } catch (err) {
    // هرگز کل بات را قفل نکن — fail-open
    console.error('force-join middleware failed (fail-open):', (err as Error).message);
    return next();
  }
}
