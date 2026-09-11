import { Router, type Request } from 'express';
import type { OnboardingStatus, User, UserRole } from '@petdate/shared';
import {
  FACE_VERIFY_REWARD,
  ONBOARDING_STATUS_LABELS,
  USER_ROLES,
  toPeerPublicUser,
  userHasRole,
} from '@petdate/shared';
import { dbService } from '../db';
import { sendPhoneOtp, verifyPhoneOtp } from '../services/phone-otp';
import { sendVetEnabledSms } from '../services/vet-status-sms';
import {
  completeShopCardPayment,
  completeShopStarsXtrPayment,
  isShopXtrPackageId,
} from '../services/shop-checkout';
import { enqueueCard2CardFinanceOs } from '../services/card2card-finance';
import {
  ensureWebAccessibleAvatar,
  isWebAvatarUrl,
  looksLikeTelegramFileId,
  materializeTelegramFileIdAsAvatar,
  syncUserProfileFromTelegram,
} from '../services/telegram-profile-sync';

export const usersRouter = Router();

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

/**
 * Bot→API internal calls (need telegramId for notify/relay).
 * Header must match TELEGRAM_BOT_TOKEN. Public/web callers get peer DTO.
 */
function isTrustedBotRequest(req: Request): boolean {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) return false;
  const header = String(req.headers['x-petdate-bot-token'] || '').trim();
  return header.length > 0 && header === token;
}

/** Attach lastSeenAt when present for peer captions */
function withLastSeen(user: User): User & { lastSeenAt?: string } {
  const presence = dbService.getUserPresence(user.id);
  if (presence?.lastSeenAt) {
    return { ...user, lastSeenAt: presence.lastSeenAt };
  }
  return user;
}

/** Peer-facing serialization — strips phone / Telegram id / @username */
function serializePeerOrFull(req: Request, user: User) {
  const enriched = dbService.enrichUserProfileCard(withLastSeen(user));
  if (isTrustedBotRequest(req)) return enriched;
  return toPeerPublicUser(enriched);
}


/** Convert Telegram file_id avatars to /api/auth/avatar/... for web + absolute Telegram URLs. */
async function resolveAvatarUrlPatch(
  userId: number,
  avatarUrl: unknown
): Promise<string | undefined> {
  if (avatarUrl == null) return undefined;
  const raw = String(avatarUrl).trim();
  if (!raw) return '';
  if (isWebAvatarUrl(raw)) return raw;
  if (looksLikeTelegramFileId(raw)) {
    const path = await materializeTelegramFileIdAsAvatar(userId, raw);
    return path ?? raw;
  }
  return raw;
}

async function withEnsuredAvatar(user: User): Promise<User> {
  try {
    const ensured = await ensureWebAccessibleAvatar(user.id);
    return ensured ?? user;
  } catch (err) {
    console.warn('ensureWebAccessibleAvatar failed:', (err as Error).message);
    return user;
  }
}

usersRouter.post('/register', async (req, res) => {
  const { telegramId, name, username, referredBy: rawReferredBy } = req.body;
  if (!name) {
    res.status(400).json({ error: 'نام الزامی است' });
    return;
  }
  const referredBy =
    rawReferredBy != null && Number.isFinite(Number(rawReferredBy))
      ? Math.floor(Number(rawReferredBy))
      : null;
  const { user, created } = dbService.findOrCreateUser({ telegramId, name, username });
  // Pull Telegram profile photo (or materialize file_id) so bot/web profile views have a face.
  let synced = await withEnsuredAvatar(user);
  if (telegramId && !isWebAvatarUrl(synced.avatarUrl)) {
    try {
      const fromTg = await syncUserProfileFromTelegram(synced.id, String(telegramId));
      if (fromTg) synced = fromTg;
    } catch (err) {
      console.warn('register telegram profile sync failed:', (err as Error).message);
    }
  }
  if (!created) {
    res.json(synced);
    return;
  }
  const awards: NonNullable<User['awardedRewards']> = [];
  const bonus = dbService.claimSignupBonus(synced.id);
  if (bonus.awarded && bonus.user && bonus.award) {
    synced = bonus.user;
    awards.push(bonus.award);
  }
  let referralAward: { referrerId: number; amount: number } | undefined;
  if (referredBy != null && referredBy > 0) {
    const referral = dbService.applyReferralBonus(synced.id, referredBy);
    if (referral.awarded && referral.award) {
      referralAward = { referrerId: referredBy, amount: referral.award.amount };
      // اطلاع به معرف در پس‌زمینه
      void (async () => {
        try {
          const { notifyReferralBonusTelegram } = await import('../services/telegram-referral-notify');
          const referrer = referral.referrer;
          if (referrer?.telegramId) {
            await notifyReferralBonusTelegram({
              toTelegramId: referrer.telegramId,
              amount: referral.award!.amount,
              invitedName: synced.name,
            });
          }
        } catch (err) {
          console.warn('referral notify failed:', (err as Error).message);
        }
      })();
    }
  }
  if (awards.length || referralAward) {
    res.json({
      ...synced,
      awardedRewards: awards.length ? awards : undefined,
      referralAward,
    });
    return;
  }
  res.json(synced);
});

usersRouter.get('/telegram/:telegramId', async (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const ensured = await withEnsuredAvatar(user);
  res.json(dbService.enrichUserProfileCard(ensured));
});

/** Touch last_seen for Telegram bot activity (marks user online). */
usersRouter.post('/telegram/:telegramId/presence', async (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const lastSeenAt = dbService.touchUserLastSeen(user.id);
  try {
    const { notifyPresence } = await import('../ws/chatHub');
    notifyPresence(user.id, true, lastSeenAt);
  } catch {
    /* optional */
  }
  res.json(dbService.getUserPresence(user.id));
});

/**
 * ذخیرهٔ اتصال Telegram Business از آپدیت ربات
 * (برای خواندن موجودی Stars با getBusinessAccountStarBalance).
 */
usersRouter.post('/telegram/:telegramId/business-connection', (req, res) => {
  const telegramId = String(req.params.telegramId || '').trim();
  const connectionId = String(req.body?.connectionId ?? '').trim();
  const isEnabled = Boolean(req.body?.isEnabled);
  const canViewStars = Boolean(req.body?.canViewStars);
  if (!telegramId || !connectionId) {
    res.status(400).json({ error: 'connectionId لازم است' });
    return;
  }
  const result = dbService.upsertTelegramBusinessConnection({
    telegramId,
    connectionId,
    isEnabled,
    canViewStars,
  });
  if (!result.ok) {
    res.status(404).json({ error: 'کاربر پیدا نشد — اول /start بزن' });
    return;
  }
  res.json({
    ok: true,
    userId: result.userId,
    connection: dbService.getTelegramBusinessConnection(result.userId),
  });
});

usersRouter.get('/id/:id', async (req, res) => {
  const user = dbService.getUserById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const ensured = await withEnsuredAvatar(user);
  res.json(serializePeerOrFull(req, ensured));
});

/** خلاصه کارت پروفایل + آمار تعاملات */
usersRouter.get('/:id/profile-card', async (req, res) => {
  const userId = Number(req.params.id);
  const user = dbService.getUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const ensured = await withEnsuredAvatar(user);
  const extras = dbService.getProfileCardExtras(userId);
  res.json({
    user: serializePeerOrFull(req, ensured),
    // Peer viewers must not see contact/block counts of someone else
    extras: isTrustedBotRequest(req) ? extras : undefined,
  });
});

function isOnboardingStatus(value: unknown): value is OnboardingStatus {
  return typeof value === 'string' && value in ONBOARDING_STATUS_LABELS;
}

usersRouter.patch('/telegram/:telegramId/role', (req, res) => {
  const { role, roles, primaryOnly } = req.body ?? {};

  if (Array.isArray(roles)) {
    const parsed = roles.filter(isUserRole) as UserRole[];
    if (parsed.length === 0) {
      res.status(400).json({ error: 'حداقل یک نقش معتبر لازم است' });
      return;
    }
    const user = dbService.setUserRolesByTelegramId(req.params.telegramId, parsed);
    if (!user) {
      res.status(404).json({ error: 'کاربر پیدا نشد' });
      return;
    }
    res.json(user);
    return;
  }

  if (!isUserRole(role)) {
    res.status(400).json({ error: 'نقش نامعتبر است' });
    return;
  }

  if (primaryOnly) {
    const user = dbService.setUserPrimaryRoleByTelegramId(req.params.telegramId, role);
    if (!user) {
      res.status(400).json({ error: 'این نقش جزو نقش‌های کاربر نیست' });
      return;
    }
    res.json(user);
    return;
  }

  const user = dbService.setUserRoleByTelegramId(req.params.telegramId, role);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.patch('/:id/role', (req, res) => {
  const { role, roles, primaryOnly } = req.body ?? {};

  if (Array.isArray(roles)) {
    const parsed = roles.filter(isUserRole) as UserRole[];
    if (parsed.length === 0) {
      res.status(400).json({ error: 'حداقل یک نقش معتبر لازم است' });
      return;
    }
    const user = dbService.setUserRoles(Number(req.params.id), parsed);
    if (!user) {
      res.status(404).json({ error: 'کاربر پیدا نشد' });
      return;
    }
    res.json(user);
    return;
  }

  if (!isUserRole(role)) {
    res.status(400).json({ error: 'نقش نامعتبر است' });
    return;
  }

  if (primaryOnly) {
    const user = dbService.setUserPrimaryRole(Number(req.params.id), role);
    if (!user) {
      res.status(400).json({ error: 'این نقش جزو نقش‌های کاربر نیست' });
      return;
    }
    res.json(user);
    return;
  }

  const user = dbService.setUserRole(Number(req.params.id), role);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.patch('/telegram/:telegramId/onboarding', (req, res) => {
  const { onboarding } = req.body;
  if (!isOnboardingStatus(onboarding)) {
    res.status(400).json({ error: 'وضعیت آنبوردینگ نامعتبر است' });
    return;
  }
  const user = dbService.setUserOnboardingByTelegramId(req.params.telegramId, onboarding);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

/** ذخیره موقعیت GPS از ربات (دکمه ارسال موقعیت — پت‌های نزدیک) */
usersRouter.post('/telegram/:telegramId/location', (req, res) => {
  const lat = Number(req.body?.lat ?? req.body?.latitude);
  const lng = Number(req.body?.lng ?? req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat و lng الزامی است' });
    return;
  }
  const user = dbService.setUserLocationByTelegramId(req.params.telegramId, lat, lng);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد یا مختصات نامعتبر است' });
    return;
  }
  res.json(user);
});

usersRouter.patch('/:id/onboarding', (req, res) => {
  const { onboarding } = req.body;
  if (!isOnboardingStatus(onboarding)) {
    res.status(400).json({ error: 'وضعیت آنبوردینگ نامعتبر است' });
    return;
  }
  const user = dbService.setUserOnboarding(Number(req.params.id), onboarding);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.patch('/telegram/:telegramId/profile', async (req, res) => {
  const patch = req.body ?? {};
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const rawAvatar = patch.avatarUrl;
  const avatarUrl = await resolveAvatarUrlPatch(existing.id, rawAvatar);
  const user = dbService.updateUserProfileByTelegramId(req.params.telegramId, {
    name: patch.name,
    age: patch.age != null ? Number(patch.age) : undefined,
    gender: patch.gender,
    country: patch.country,
    city: patch.city,
    province: patch.province,
    phone: patch.phone,
    bio: patch.bio,
    interests: Array.isArray(patch.interests) ? patch.interests.map(String) : undefined,
    avatarUrl,
    // Bot/wizard photo upload → treat as custom so Telegram sync won't overwrite it
    avatarCustom:
      rawAvatar != null && looksLikeTelegramFileId(rawAvatar)
        ? true
        : undefined,
    coins: patch.coins != null ? Number(patch.coins) : undefined,
    onboarding: patch.onboarding,
    isActive: typeof patch.isActive === 'boolean' ? patch.isActive : undefined,
    silentChatRequests:
      typeof patch.silentChatRequests === 'boolean' ? patch.silentChatRequests : undefined,
  });
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(dbService.enrichUserProfileCard(user));
});

usersRouter.patch('/telegram/:telegramId/active', (req, res) => {
  const isActive = Boolean(req.body?.isActive);
  const user = dbService.setUserActiveByTelegramId(req.params.telegramId, isActive);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.delete('/telegram/:telegramId', (req, res) => {
  const ok = dbService.deleteUserByTelegramId(req.params.telegramId);
  if (!ok) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});

usersRouter.patch('/:id/profile', async (req, res) => {
  const patch = req.body ?? {};
  const userId = Number(req.params.id);
  const existing = dbService.getUserById(userId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const rawAvatar = patch.avatarUrl;
  const avatarUrl = await resolveAvatarUrlPatch(userId, rawAvatar);
  const user = dbService.updateUserProfile(userId, {
    name: patch.name,
    age: patch.age != null ? Number(patch.age) : undefined,
    gender: patch.gender,
    country: patch.country,
    city: patch.city,
    province: patch.province,
    phone: patch.phone,
    bio: patch.bio,
    interests: Array.isArray(patch.interests) ? patch.interests.map(String) : undefined,
    avatarUrl,
    avatarCustom:
      rawAvatar != null && looksLikeTelegramFileId(rawAvatar) ? true : undefined,
    coins: patch.coins != null ? Number(patch.coins) : undefined,
    onboarding: patch.onboarding,
    isActive: typeof patch.isActive === 'boolean' ? patch.isActive : undefined,
    silentChatRequests:
      typeof patch.silentChatRequests === 'boolean' ? patch.silentChatRequests : undefined,
  });
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(dbService.enrichUserProfileCard(user));
});

usersRouter.patch('/:id/section', (req, res) => {
  const { sectionId } = req.body;
  const user = dbService.setUserSection(Number(req.params.id), sectionId ?? null);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

/** صف احراز هویت در انتظار بررسی ادمین */
usersRouter.get('/verification/pending', (_req, res) => {
  res.json(dbService.listPendingVerifications());
});

/** ارسال درخواست احراز هویت (عکس پروفایل / سلفی) */
usersRouter.post('/telegram/:telegramId/verification', async (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const photoFileId = String(
    req.body?.photoFileId ?? req.body?.verificationPhotoFileId ?? user.avatarUrl ?? ''
  ).trim();
  const result = dbService.submitVerification(user.id, photoFileId);
  if (!result.ok) {
    const status =
      result.reason === 'missing'
        ? 404
        : result.reason === 'already_verified'
          ? 409
          : 400;
    res.status(status).json({
      ok: false,
      reason: result.reason,
      error:
        result.reason === 'already_verified'
          ? 'قبلاً احراز شده‌ای'
          : result.reason === 'no_photo'
            ? 'عکس احراز لازم است'
            : 'کاربر پیدا نشد',
    });
    return;
  }
  if (looksLikeTelegramFileId(photoFileId)) {
    try {
      await ensureWebAccessibleAvatar(user.id);
    } catch (err) {
      console.warn('verification avatar materialize failed:', (err as Error).message);
    }
  }
  res.json({ ok: true, user: dbService.getUserById(user.id) ?? result.user });
});

usersRouter.post('/:id/verification/approve', (req, res) => {
  const reward =
    req.body?.rewardCoins != null
      ? Number(req.body.rewardCoins)
      : Number(process.env.FACE_VERIFY_REWARD ?? FACE_VERIFY_REWARD);
  const amount = Number.isFinite(reward) ? reward : FACE_VERIFY_REWARD;
  const user = dbService.approveVerification(Number(req.params.id), amount);
  if (!user) {
    res.status(404).json({ error: 'درخواست احراز پیدا نشد یا در صف نیست' });
    return;
  }
  const awarded = user.awardedRewards?.find((a) => a.reason === 'face_verify')?.amount ?? 0;
  res.json({ ok: true, user, rewardCoins: awarded || amount });
});

/** دامپزشک‌های واجد شرایط اتصال سریع (نقش vet + آنلاین؛ ترجیح phoneVerified) */
usersRouter.get('/vets/verified', (_req, res) => {
  res.json(dbService.listVerifiedVets());
});

/** دامپزشک‌های آنلاین آماده پذیرش (برای نمایش لیست + مبلغ ویزیت قبل از اتصال سریع) */
usersRouter.get('/vets/online', (_req, res) => {
  res.json(dbService.listOnlineVetsForQuickConnect());
});

/** لیست همه دامپزشک‌ها برای پنل ادمین (فعال و غیرفعال) */
usersRouter.get('/vets', (_req, res) => {
  res.json(dbService.listAllVets());
});

/** فعال/غیرفعال کردن دامپزشک توسط ادمین + پیامک اطلاع‌رسانی */
usersRouter.post('/:id/vet-enabled', async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const user = dbService.setVetEnabled(Number(req.params.id), enabled);
  if (!user) {
    res.status(404).json({ error: 'دامپزشک پیدا نشد' });
    return;
  }
  const sms = await sendVetEnabledSms({
    phone: user.phone,
    enabled,
    vetName: user.name,
    customerId: user.id,
  });
  res.json({ ok: true, user, sms });
});

/** وضعیت آنلاین/آفلاین دامپزشک برای پذیرش بیمار */
usersRouter.post('/telegram/:telegramId/vet-online', (req, res) => {
  const raw = req.body?.online;
  const online =
    raw === true || raw === 1 || raw === '1' || raw === 'true';
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (online && existing.vetEnabled === false) {
    res.status(403).json({
      error: 'حساب دامپزشکی شما توسط مدیر غیرفعال شده است',
      reason: 'vet_disabled',
    });
    return;
  }
  if (online) {
    const cred = existing.vetCredentialStatus ?? 'none';
    if (cred === 'none') {
      res.status(403).json({
        error: 'اول مدرک دامپزشکی‌ات را آپلود کن تا پنل فعال شود.',
        reason: 'credential_required',
      });
      return;
    }
    if (cred !== 'verified') {
      res.status(403).json({
        error: 'مدرک دامپزشکی هنوز تأیید نشده؛ بعد از تأیید ادمین می‌توانی آنلاین شوی.',
        reason: 'credential_pending',
      });
      return;
    }
  }
  const user = dbService.setVetOnlineByTelegramId(req.params.telegramId, online);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

/** آنلاین مربی / پرستار پت */
usersRouter.post('/telegram/:telegramId/provider-online', (req, res) => {
  const kindRaw = String(req.body?.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  if (kind === 'sitter') {
    res.status(410).json({
      error: 'سرویس پرستار پت حذف شده است',
      reason: 'sitter_removed',
    });
    return;
  }
  const raw = req.body?.online;
  const online =
    raw === true || raw === 1 || raw === '1' || raw === 'true';
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const role = 'trainer' as const;
  if (!userHasRole(existing, role)) {
    res.status(403).json({ error: 'نقش لازم را نداری' });
    return;
  }
  const enabled = existing.trainerEnabled !== false;
  if (online && !enabled) {
    res.status(403).json({
      error: 'حساب شما توسط مدیر غیرفعال شده است',
      reason: 'provider_disabled',
    });
    return;
  }
  const cred = existing.trainerCredentialStatus ?? 'none';
  if (online && cred !== 'verified') {
    res.status(403).json({
      error:
        cred === 'none'
          ? 'اول مدرک را آپلود کن تا پنل فعال شود.'
          : 'مدرک هنوز تأیید نشده؛ بعد از تأیید ادمین آنلاین شو.',
      reason: cred === 'none' ? 'credential_required' : 'credential_pending',
    });
    return;
  }
  const user = dbService.setProviderOnline(existing.id, 'trainer', online);
  if (!user) {
    res.status(400).json({ error: 'تغییر وضعیت ممکن نشد' });
    return;
  }
  res.json(user);
});

/** صاحب پت: پذیرش مشورت خرید از دنبال‌کننده بدون پت */
usersRouter.patch('/:id/accept-seeker-advice', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const accept = Boolean(req.body?.accept ?? req.body?.acceptSeekerAdvice);
  const existing = dbService.getUserById(id);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (!userHasRole(existing, 'pet_owner')) {
    res.status(403).json({ error: 'این تنظیم مخصوص صاحب پت است' });
    return;
  }
  const user = dbService.setAcceptSeekerAdvice(id, accept);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.patch('/telegram/:telegramId/accept-seeker-advice', (req, res) => {
  const accept = Boolean(req.body?.accept ?? req.body?.acceptSeekerAdvice);
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (!userHasRole(existing, 'pet_owner')) {
    res.status(403).json({ error: 'این تنظیم مخصوص صاحب پت است' });
    return;
  }
  const user = dbService.setAcceptSeekerAdvice(existing.id, accept);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

/** آماده پذیرش پت — نقش دنبال‌کننده پت */
usersRouter.post('/telegram/:telegramId/ready-to-adopt', (req, res) => {
  const ready = Boolean(req.body?.ready ?? req.body?.readyToAdopt);
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (!userHasRole(existing, 'pet_seeker')) {
    res.status(403).json({ error: 'این بخش مخصوص نقش «دنبال پت» است' });
    return;
  }
  const user = dbService.setReadyToAdoptByTelegramId(req.params.telegramId, ready);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

/** مبلغ ویزیت دامپزشک (سکه) — پنل نقش پزشک در ربات/وب */
usersRouter.post('/telegram/:telegramId/visit-fee', (req, res) => {
  const existing = dbService.getUserByTelegramId(req.params.telegramId);
  if (!existing) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  if (!userHasRole(existing, 'vet')) {
    res.status(403).json({ error: 'این بخش مخصوص دامپزشکان است' });
    return;
  }
  const raw = req.body?.visitFeeCoins ?? req.body?.feeCoins ?? req.body?.fee;
  const fee = Number(raw);
  if (!Number.isFinite(fee) || fee < 1 || fee > 500) {
    res.status(400).json({
      error: 'مبلغ ویزیت باید بین ۱ تا ۵۰۰ سکه باشد',
      reason: 'invalid_visit_fee',
    });
    return;
  }
  const user = dbService.setVisitFeeCoinsByTelegramId(req.params.telegramId, fee);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(user);
});

usersRouter.post('/telegram/:telegramId/coins/debit', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const amount = Number(req.body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'مقدار نامعتبر' });
    return;
  }
  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : 'کسر سکه';
  const updated = dbService.debitCoins(user.id, amount, {
    reason,
    refType: 'telegram_api',
  });
  if (!updated) {
    res.status(400).json({ error: 'سکه کافی نیست', reason: 'insufficient' });
    return;
  }
  res.json(updated);
});

usersRouter.post('/telegram/:telegramId/coins/credit', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const amount = Number(req.body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'مقدار نامعتبر' });
    return;
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason) {
    const once = dbService.creditCoinsOnce(user.id, amount, reason);
    if (!once.user) {
      res.status(404).json({ error: 'کاربر پیدا نشد' });
      return;
    }
    res.json({
      ...once.user,
      awardedRewards: once.awarded ? [{ reason, amount: once.amount }] : [],
    });
    return;
  }
  const updated = dbService.creditCoins(user.id, amount, undefined, {
    reason: 'واریز سکه',
    refType: 'telegram_api',
  });
  res.json(updated);
});

/** ارسال OTP احراز موبایل (Candoo) */
usersRouter.post('/telegram/:telegramId/phone/send-otp', async (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const phone = String(req.body?.phone ?? '').trim();
  const result = await sendPhoneOtp(user.id, phone);
  if (!result.ok) {
    const status =
      result.reason === 'invalid_phone'
        ? 400
        : result.reason === 'not_configured'
          ? 503
          : result.reason === 'cooldown'
            ? 429
            : result.reason === 'send_failed'
              ? 502
              : 400;
    res.status(status).json({
      ok: false,
      reason: result.reason,
      error: result.error,
      retryAfterSec: result.retryAfterSec,
    });
    return;
  }
  res.json({
    ok: true,
    phone: result.phone,
    expiresAt: result.expiresAt,
  });
});

/** تأیید OTP احراز موبایل */
usersRouter.post('/telegram/:telegramId/phone/verify-otp', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const phone = String(req.body?.phone ?? '').trim();
  const code = String(req.body?.code ?? '').trim();
  const result = verifyPhoneOtp(user.id, phone, code);
  if (!result.ok) {
    const status =
      result.reason === 'invalid_phone' || result.reason === 'mismatch'
        ? 400
        : result.reason === 'expired' || result.reason === 'no_otp' || result.reason === 'too_many'
          ? 400
          : 400;
    res.status(status).json({
      ok: false,
      reason: result.reason,
      attemptsLeft: result.attemptsLeft,
      error:
        result.reason === 'mismatch'
          ? `کد نادرست است${result.attemptsLeft != null ? ` (${result.attemptsLeft} تلاش باقی‌مانده)` : ''}`
          : result.reason === 'expired'
            ? 'کد منقضی شده؛ دوباره درخواست بده'
            : result.reason === 'too_many'
              ? 'تعداد تلاش بیش از حد؛ دوباره درخواست کد بده'
              : result.reason === 'no_otp'
                ? 'کدی برای این شماره ثبت نشده'
                : 'تأیید ناموفق',
    });
    return;
  }
  res.json({ ok: true, user: result.user });
});

usersRouter.post('/:id/verification/reject', (req, res) => {
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const user = dbService.rejectVerification(Number(req.params.id), note);
  if (!user) {
    res.status(404).json({ error: 'درخواست احراز پیدا نشد یا در صف نیست' });
    return;
  }
  res.json({ ok: true, user });
});

/** صف مدارک دامپزشک در انتظار بررسی */
usersRouter.get('/vet-credentials/pending', (_req, res) => {
  res.json(dbService.listPendingVetCredentials());
});

/** آرشیو مدارک دامپزشک تأییدشده */
usersRouter.get('/vet-credentials/verified', (_req, res) => {
  res.json(dbService.listVerifiedVetCredentials());
});

/** آپلود مدرک دامپزشک */
usersRouter.post('/telegram/:telegramId/vet-credential', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const fileId = String(req.body?.fileId ?? req.body?.vetCredentialFileId ?? '').trim();
  const result = dbService.submitVetCredential(user.id, fileId);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json({
      ok: false,
      reason: result.reason,
      error: result.reason === 'no_file' ? 'فایل مدرک لازم است' : 'کاربر پیدا نشد',
    });
    return;
  }
  res.json({ ok: true, user: result.user });
});

usersRouter.post('/:id/vet-credential/approve', (req, res) => {
  const user = dbService.approveVetCredential(Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'مدرک در صف نیست' });
    return;
  }
  res.json({ ok: true, user });
});

usersRouter.post('/:id/vet-credential/reject', (req, res) => {
  const user = dbService.rejectVetCredential(Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: 'مدرک در صف نیست' });
    return;
  }
  res.json({ ok: true, user });
});

/** صف مدارک مربی / پرستار */
usersRouter.get('/provider-credentials/pending', (req, res) => {
  const kindRaw = String(req.query.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  res.json(dbService.listPendingProviderCredentials(kind));
});

/** آرشیو مدارک مربی / پرستار تأییدشده */
usersRouter.get('/provider-credentials/verified', (req, res) => {
  const kindRaw = String(req.query.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  res.json(dbService.listVerifiedProviderCredentials(kind));
});

usersRouter.post('/telegram/:telegramId/provider-credential', (req, res) => {
  const kindRaw = String(req.body?.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  if (kind === 'sitter') {
    res.status(410).json({
      error: 'سرویس پرستار پت حذف شده است',
      reason: 'sitter_removed',
    });
    return;
  }
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const fileId = String(req.body?.fileId ?? req.body?.credentialFileId ?? '').trim();
  const result = dbService.submitProviderCredential(user.id, 'trainer', fileId);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 400).json({
      ok: false,
      reason: result.reason,
      error: result.reason === 'no_file' ? 'فایل مدرک لازم است' : 'کاربر پیدا نشد',
    });
    return;
  }
  res.json({ ok: true, user: result.user });
});

usersRouter.post('/:id/provider-credential/approve', (req, res) => {
  const kindRaw = String(req.body?.kind ?? req.query.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  const user = dbService.approveProviderCredential(Number(req.params.id), kind);
  if (!user) {
    res.status(404).json({ error: 'مدرک در صف نیست' });
    return;
  }
  res.json({ ok: true, user });
});

usersRouter.post('/:id/provider-credential/reject', (req, res) => {
  const kindRaw = String(req.body?.kind ?? req.query.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  const user = dbService.rejectProviderCredential(Number(req.params.id), kind);
  if (!user) {
    res.status(404).json({ error: 'مدرک در صف نیست' });
    return;
  }
  res.json({ ok: true, user });
});

/** صف تأیید عکس پت */
usersRouter.get('/pet-photos/pending', (_req, res) => {
  res.json(dbService.listPendingPetPhotos());
});

usersRouter.post('/pets/:id/photo-moderation', (req, res) => {
  const petId = Number(req.params.id);
  const statusRaw = String(req.body?.status ?? '').trim();
  if (statusRaw !== 'approved' && statusRaw !== 'rejected') {
    res.status(400).json({ error: 'status باید approved یا rejected باشد' });
    return;
  }
  const pet = dbService.setPetPhotoModerationStatus(petId, statusRaw);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json({ ok: true, pet });
});

/** صف تأیید عکس پروفایل کاربران */
usersRouter.get('/user-avatars/pending', (_req, res) => {
  res.json(dbService.listPendingUserAvatars());
});

usersRouter.post('/:id/avatar-moderation', (req, res) => {
  const userId = Number(req.params.id);
  const statusRaw = String(req.body?.status ?? '').trim();
  if (statusRaw !== 'approved' && statusRaw !== 'rejected') {
    res.status(400).json({ error: 'status باید approved یا rejected باشد' });
    return;
  }
  const user = dbService.setAvatarModerationStatus(userId, statusRaw);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ ok: true, user });
});

usersRouter.get('/providers/online', (req, res) => {
  const kindRaw = String(req.query.kind ?? '').trim();
  const kind = kindRaw === 'sitter' ? 'sitter' : kindRaw === 'trainer' ? 'trainer' : null;
  if (!kind) {
    res.status(400).json({ error: 'kind باید trainer یا sitter باشد' });
    return;
  }
  if (kind === 'sitter') {
    res.json([]);
    return;
  }
  res.json(dbService.listOnlineProvidersForQuickConnect('trainer'));
});

/** دریافت سکه روزانه */
usersRouter.post('/telegram/:telegramId/coins/daily', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const amount = req.body?.amount != null ? Number(req.body.amount) : 10;
  const result = dbService.claimDailyCoins(user.id, Number.isFinite(amount) ? amount : 10);
  if (!result.ok) {
    res.status(result.reason === 'already' ? 409 : 404).json({
      error: result.reason === 'already' ? 'امروز سکه روزانه را گرفتی' : 'کاربر پیدا نشد',
      user: result.user,
      reason: result.reason,
    });
    return;
  }
  res.json({ ok: true, awarded: result.awarded, user: result.user });
});

/** تاریخچه کوتاه تراکنش‌های کیف برای ربات */
usersRouter.get('/telegram/:telegramId/wallet/transactions', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const limit = Number(req.query?.limit ?? 8);
  const transactions = dbService.listUserWalletTransactions(user.id, {
    limit: Number.isFinite(limit) ? limit : 8,
    offset: 0,
  });
  res.json({ ok: true, transactions });
});

/** وضعیت درخواست فروش باز */
usersRouter.get('/telegram/:telegramId/coins/sell/open', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ open: dbService.userHasOpenCoinSell(user.id) });
});

/** ثبت درخواست فروش سکه */
usersRouter.post('/telegram/:telegramId/coins/sell', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const coins = Number(req.body?.coins);
  const cardNumber = String(req.body?.cardNumber ?? '');
  const rateToman = req.body?.rateToman != null ? Number(req.body.rateToman) : 1000;
  const minCoins = req.body?.minCoins != null ? Number(req.body.minCoins) : 50;

  if (!cardNumber || cardNumber.length < 16) {
    res.status(400).json({ error: 'شماره کارت نامعتبر', reason: 'card' });
    return;
  }

  const result = dbService.submitCoinSell({
    userId: user.id,
    coins,
    rateToman: Number.isFinite(rateToman) ? rateToman : 1000,
    cardNumber,
    minCoins: Number.isFinite(minCoins) ? minCoins : 50,
  });

  if (!result.ok) {
    const status =
      result.reason === 'missing' ? 404 : result.reason === 'pending' ? 409 : 400;
    res.status(status).json({ ok: false, reason: result.reason });
    return;
  }

  res.status(201).json({
    ok: true,
    requestId: result.requestId,
    amountToman: result.amountToman,
    rateToman: result.rateToman,
    user: result.user,
  });
});

/** ایجاد سفارش خرید سکه (کارت یا Stars) */
usersRouter.post('/telegram/:telegramId/payments', (req, res) => {
  const user = dbService.getUserByTelegramId(req.params.telegramId);
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const packageId = String(req.body?.packageId ?? '').trim();
  const method = String(req.body?.method ?? '').trim() as 'card' | 'stars';
  const coins = Number(req.body?.coins);
  const amountToman =
    req.body?.amountToman != null ? Number(req.body.amountToman) : undefined;
  const amountStars =
    req.body?.amountStars != null ? Number(req.body.amountStars) : undefined;

  const isWalletStarsTopUp = packageId.startsWith('wstars:');
  if (!packageId) {
    res.status(400).json({ error: 'بسته نامعتبر', reason: 'package' });
    return;
  }
  if (isWalletStarsTopUp) {
    if (!Number.isFinite(amountStars) || Number(amountStars) <= 0) {
      res.status(400).json({ error: 'تعداد ستاره نامعتبر', reason: 'package' });
      return;
    }
  } else if (!Number.isFinite(coins) || coins <= 0) {
    res.status(400).json({ error: 'بسته نامعتبر', reason: 'package' });
    return;
  }
  if (method !== 'card' && method !== 'stars') {
    res.status(400).json({ error: 'روش پرداخت نامعتبر', reason: 'method' });
    return;
  }

  const status = method === 'card' ? 'awaiting_receipt' : 'awaiting_stars';
  const order = dbService.createPaymentOrder({
    userId: user.id,
    packageId,
    coins: isWalletStarsTopUp ? 0 : Math.floor(coins),
    amountToman: amountToman != null && Number.isFinite(amountToman) ? amountToman : undefined,
    amountStars: amountStars != null && Number.isFinite(amountStars) ? amountStars : undefined,
    method,
    status,
  });
  res.status(201).json({ ok: true, order });
});

usersRouter.get('/payments/pending/card', (_req, res) => {
  res.json(dbService.listPendingCardPayments());
});

usersRouter.get('/payments/:id', (req, res) => {
  const order = dbService.getPaymentOrder(Number(req.params.id));
  if (!order) {
    res.status(404).json({ error: 'سفارش پیدا نشد' });
    return;
  }
  res.json(order);
});

usersRouter.post('/payments/:id/receipt', (req, res) => {
  const fileId = String(req.body?.receiptFileId ?? req.body?.fileId ?? '').trim();
  const transferRef =
    req.body?.transferRef != null ? String(req.body.transferRef).trim().slice(0, 64) : undefined;
  const result = dbService.attachPaymentReceipt(Number(req.params.id), fileId, { transferRef });
  if (!result.ok) {
    const status =
      result.reason === 'missing' ? 404 : result.reason === 'no_file' ? 400 : 409;
    res.status(status).json({ ok: false, reason: result.reason });
    return;
  }
  res.json({ ok: true, order: result.order });
});

usersRouter.post('/payments/:id/approve', (req, res) => {
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const id = Number(req.params.id);
  const existing = dbService.getPaymentOrder(id);
  if (existing && String(existing.packageId) === 'shopcard') {
    const result = completeShopCardPayment({ orderId: id, adminNote: note });
    if (!result.ok) {
      res.status(result.reason === 'payment_missing' ? 404 : 409).json({
        ok: false,
        reason: result.reason,
        error: result.error,
      });
      return;
    }
    enqueueCard2CardFinanceOs({
      orderId: id,
      amountToman: result.paymentOrder.amountToman ?? 0,
      userId: result.paymentOrder.userId,
      kind: 'shopcard',
      packageId: result.paymentOrder.packageId,
    });
    res.json({
      ok: true,
      order: result.paymentOrder,
      user: result.user,
      shopOrder: result.shopOrder,
      kind: 'shopcard',
    });
    return;
  }
  const result = dbService.approveCardPayment(id, note);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 409).json({
      ok: false,
      reason: result.reason,
    });
    return;
  }
  enqueueCard2CardFinanceOs({
    orderId: id,
    amountToman: result.order.amountToman ?? 0,
    userId: result.order.userId,
    kind: 'coins',
    packageId: result.order.packageId,
  });
  res.json({ ok: true, order: result.order, user: result.user });
});

usersRouter.post('/payments/:id/reject', (req, res) => {
  const note = req.body?.note != null ? String(req.body.note) : undefined;
  const result = dbService.rejectCardPayment(Number(req.params.id), note);
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 409).json({
      ok: false,
      reason: result.reason,
    });
    return;
  }
  res.json({ ok: true, order: result.order, user: result.user });
});

usersRouter.post('/payments/:id/stars/complete', (req, res) => {
  const chargeId = String(req.body?.telegramPaymentChargeId ?? '').trim();
  const orderId = Number(req.params.id);
  const existing = dbService.getPaymentOrder(orderId);

  if (existing && isShopXtrPackageId(existing.packageId)) {
    const result = completeShopStarsXtrPayment({
      orderId,
      telegramPaymentChargeId: chargeId,
    });
    if (!result.ok) {
      const status = result.reason === 'missing' ? 404 : 409;
      res.status(status).json({ ok: false, reason: result.reason, error: result.error });
      return;
    }
    const user = dbService.getUserById(result.paymentOrder.userId);
    if (!user) {
      res.status(404).json({ ok: false, reason: 'user_missing' });
      return;
    }
    res.json({
      ok: true,
      order: result.paymentOrder,
      user,
      credited: result.credited,
      creditKind: 'shop_order',
      shopOrderId: result.shopOrder.id,
      shopOrder: result.shopOrder,
      starsSpent: result.starsSpent,
      totalToman: result.totalToman,
      webSuccessUrl: (() => {
        const meta = (() => {
          try {
            return JSON.parse(String(result.paymentOrder.adminNote || '{}')) as {
              receiptToken?: string;
            };
          } catch {
            return {};
          }
        })();
        const web = String(process.env.PUBLIC_WEB_URL || process.env.WEB_URL || 'https://petdate.ir').replace(
          /\/$/,
          ''
        );
        const base = `${web}/shop/stars-pay/${result.paymentOrder.id}`;
        return meta.receiptToken
          ? `${base}?t=${encodeURIComponent(meta.receiptToken)}`
          : base;
      })(),
    });
    return;
  }

  const result = dbService.completeStarsPayment({
    orderId,
    telegramPaymentChargeId: chargeId,
  });
  if (!result.ok) {
    res.status(result.reason === 'missing' ? 404 : 409).json({
      ok: false,
      reason: result.reason,
    });
    return;
  }
  res.json({
    ok: true,
    order: result.order,
    user: result.user,
    credited: result.credited,
    creditKind: result.creditKind,
  });
});

usersRouter.get('/:id/contacts', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || !dbService.getUserById(userId)) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(dbService.listUserContacts(userId));
});

usersRouter.post('/:id/contacts', (req, res) => {
  const userId = Number(req.params.id);
  const contactUserId = Number(req.body?.contactUserId);
  if (!Number.isFinite(userId) || !Number.isFinite(contactUserId)) {
    res.status(400).json({ error: 'شناسه کاربر نامعتبر است' });
    return;
  }
  const result = dbService.addUserContact(userId, contactUserId);
  if (!result.ok) {
    const status =
      result.reason === 'self' ? 400 : result.reason === 'missing_user' ? 404 : 404;
    const message =
      result.reason === 'self'
        ? 'نمی‌توانید خودتان را به مخاطبین اضافه کنید'
        : result.reason === 'missing_user'
          ? 'کاربر پیدا نشد'
          : 'مخاطب پیدا نشد';
    res.status(status).json({ error: message, reason: result.reason });
    return;
  }
  res.status(result.created ? 201 : 200).json(result);
});

usersRouter.get('/:id/blocks', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || !dbService.getUserById(userId)) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(dbService.listUserBlocks(userId));
});

usersRouter.post('/:id/blocks', (req, res) => {
  const userId = Number(req.params.id);
  const blockedUserId = Number(req.body?.blockedUserId);
  if (!Number.isFinite(userId) || !Number.isFinite(blockedUserId)) {
    res.status(400).json({ error: 'شناسه کاربر نامعتبر است' });
    return;
  }
  const result = dbService.addUserBlock(userId, blockedUserId);
  if (!result.ok) {
    const status = result.reason === 'self' ? 400 : 404;
    const message =
      result.reason === 'self'
        ? 'نمی‌توانید خودتان را بلاک کنید'
        : result.reason === 'missing_user'
          ? 'کاربر پیدا نشد'
          : 'کاربر هدف پیدا نشد';
    res.status(status).json({ error: message, reason: result.reason });
    return;
  }
  res.status(result.created ? 201 : 200).json(result);
});

usersRouter.delete('/:id/blocks/:blockedUserId', (req, res) => {
  const userId = Number(req.params.id);
  const blockedUserId = Number(req.params.blockedUserId);
  if (!Number.isFinite(userId) || !Number.isFinite(blockedUserId)) {
    res.status(400).json({ error: 'شناسه کاربر نامعتبر است' });
    return;
  }
  const ok = dbService.removeUserBlock(userId, blockedUserId);
  if (!ok) {
    res.status(404).json({ error: 'بلاک پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});

usersRouter.patch('/:id/silent-chat', (req, res) => {
  const userId = Number(req.params.id);
  const enabled = Boolean(req.body?.enabled ?? req.body?.silentChatRequests);
  const user = dbService.updateUserProfile(userId, { silentChatRequests: enabled });
  if (!user) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(dbService.enrichUserProfileCard(user));
});

usersRouter.delete('/:id', (req, res) => {
  const userId = Number(req.params.id);
  const ok = dbService.deleteUserById(userId);
  if (!ok) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});

/** Heartbeat — touch last_seen_at (online window = 90s). */
usersRouter.post('/:id/presence', async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const lastSeenAt = dbService.touchUserLastSeen(userId);
  if (lastSeenAt == null) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  const presence = dbService.getUserPresence(userId);
  try {
    const { notifyPresence } = await import('../ws/chatHub');
    notifyPresence(userId, true, lastSeenAt);
  } catch {
    /* ws hub optional */
  }
  res.json(presence);
});

usersRouter.get('/:id/presence', (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const presence = dbService.getUserPresence(userId);
  if (!presence) {
    res.status(404).json({ error: 'کاربر پیدا نشد' });
    return;
  }
  res.json(presence);
});
