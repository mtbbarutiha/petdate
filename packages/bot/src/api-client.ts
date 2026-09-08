import type {
  OnboardingStatus,
  PetBreed,
  PetGender,
  PetProfile,
  PetSize,
  PetSpecies,
  PlaydateRequest,
  PlaydateStatus,
  User,
  UserRole,
  VetConsultation,
} from '@petdate/shared';
import { config } from './config';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const botToken = config.telegramBotToken?.trim();
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(botToken ? { 'X-PetDate-Bot-Token': botToken } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function registerTelegramUser(data: {
  telegramId: string;
  name: string;
  username?: string;
}): Promise<User> {
  return request<User>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Mark Telegram user online (bot activity heartbeat). */
export async function touchTelegramPresence(telegramId: string): Promise<void> {
  try {
    await request(`/api/users/telegram/${encodeURIComponent(telegramId)}/presence`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  } catch {
    /* non-fatal */
  }
}

/** ذخیره اتصال Telegram Business (برای خواندن Stars حساب کاربر). */
export async function upsertTelegramBusinessConnection(data: {
  telegramId: string;
  connectionId: string;
  isEnabled: boolean;
  canViewStars: boolean;
}): Promise<{ ok: true; userId: number }> {
  return request(`/api/users/telegram/${encodeURIComponent(data.telegramId)}/business-connection`, {
    method: 'POST',
    body: JSON.stringify({
      connectionId: data.connectionId,
      isEnabled: data.isEnabled,
      canViewStars: data.canViewStars,
    }),
  });
}

/** Complete web→Telegram attach from /start wlink_<token>. */
export async function completeWebTelegramLink(data: {
  token: string;
  telegramId: string;
  username?: string;
  name?: string;
}): Promise<{
  ok: true;
  user: User;
  merged: boolean;
  wallet: { ton: number; stars: number; coins: number; toman: number };
}> {
  return request('/api/auth/telegram/link-complete', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Complete mobile pending Telegram login from callback confirm. */
export async function completeTelegramPendingLogin(data: {
  id: string;
  telegramId: string;
  username?: string;
  name?: string;
}): Promise<{
  ok: true;
  user: User;
  next: string;
}> {
  return request('/api/auth/telegram/login-complete', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getUserByTelegramId(telegramId: string): Promise<User | null> {
  try {
    return await request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}`);
  } catch {
    return null;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    return await request<User>(`/api/users/id/${id}`);
  } catch {
    return null;
  }
}

export async function setUserRole(telegramId: string, role: UserRole): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

/** سوییچ نقش فعال بدون حذف بقیه نقش‌ها */
export async function setUserPrimaryRole(telegramId: string, role: UserRole): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role, primaryOnly: true }),
  });
}

export async function setUserRoles(telegramId: string, roles: UserRole[]): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  });
}

export async function setUserOnboarding(telegramId: string, onboarding: OnboardingStatus): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding }),
  });
}

export async function updateUserProfile(
  telegramId: string,
  patch: Partial<{
    name: string;
    age: number;
    gender: import('@petdate/shared').UserGender;
    country: string;
    city: string;
    province: string;
    phone: string;
    bio: string;
    interests: string[];
    avatarUrl: string;
    coins: number;
    onboarding: OnboardingStatus;
    isActive: boolean;
  }>
): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function submitVerification(
  telegramId: string,
  photoFileId?: string
): Promise<{ ok: true; user: User }> {
  return request<{ ok: true; user: User }>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/verification`,
    {
      method: 'POST',
      body: JSON.stringify(photoFileId ? { photoFileId } : {}),
    }
  );
}

export async function listPendingVerifications(): Promise<User[]> {
  return request<User[]>('/api/users/verification/pending');
}

export async function approveVerification(
  userId: number,
  rewardCoins?: number
): Promise<{ ok: true; user: User; rewardCoins?: number }> {
  return request<{ ok: true; user: User; rewardCoins?: number }>(
    `/api/users/${userId}/verification/approve`,
    {
      method: 'POST',
      body: JSON.stringify(rewardCoins != null ? { rewardCoins } : {}),
    }
  );
}

export async function rejectVerification(
  userId: number,
  note?: string
): Promise<{ ok: true; user: User }> {
  return request<{ ok: true; user: User }>(`/api/users/${userId}/verification/reject`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export async function submitVetCredential(
  telegramId: string,
  fileId: string
): Promise<{ ok: true; user: User }> {
  return request<{ ok: true; user: User }>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/vet-credential`,
    {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    }
  );
}

export async function listPendingVetCredentials(): Promise<User[]> {
  return request<User[]>('/api/users/vet-credentials/pending');
}

export async function approveVetCredential(userId: number): Promise<{ ok: true; user: User }> {
  return request<{ ok: true; user: User }>(`/api/users/${userId}/vet-credential/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectVetCredential(userId: number): Promise<{ ok: true; user: User }> {
  return request<{ ok: true; user: User }>(`/api/users/${userId}/vet-credential/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function setUserActive(telegramId: string, isActive: boolean): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function deleteUserAccount(telegramId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/users/telegram/${encodeURIComponent(telegramId)}`, {
    method: 'DELETE',
  });
}

export async function listSpecies(): Promise<PetSpecies[]> {
  return request<PetSpecies[]>('/api/catalog/species');
}

export async function listBreeds(species?: string): Promise<PetBreed[]> {
  const qs = species ? `?species=${encodeURIComponent(species)}` : '';
  return request<PetBreed[]>(`/api/catalog/breeds${qs}`);
}

export async function listPets(filters?: {
  ownerId?: number;
  excludeOwnerId?: number;
  lookingForPlaymate?: boolean;
  species?: string;
  city?: string;
  province?: string;
  breed?: string;
  breeds?: string[];
  sort?: 'newest' | 'popular' | 'updated';
}): Promise<PetProfile[]> {
  const params = new URLSearchParams();
  if (filters?.ownerId) params.set('ownerId', String(filters.ownerId));
  if (filters?.excludeOwnerId) params.set('excludeOwnerId', String(filters.excludeOwnerId));
  if (filters?.species) params.set('species', filters.species);
  if (filters?.city) params.set('city', filters.city);
  if (filters?.province) params.set('province', filters.province);
  if (filters?.breed) params.set('breed', filters.breed);
  if (filters?.breeds?.length) params.set('breeds', filters.breeds.join(','));
  if (filters?.sort) params.set('sort', filters.sort);
  if (filters?.lookingForPlaymate !== undefined) {
    params.set('lookingForPlaymate', String(filters.lookingForPlaymate));
  }
  const qs = params.toString();
  return request<PetProfile[]>(`/api/pets${qs ? `?${qs}` : ''}`);
}

/** پت‌های نزدیک بر اساس مختصات GPS (مرتب‌شده بر اساس فاصله) */
export async function listNearbyPets(opts: {
  lat: number;
  lng: number;
  excludeOwnerId?: number;
  limit?: number;
  radiusKm?: number;
}): Promise<PetProfile[]> {
  const params = new URLSearchParams();
  params.set('lat', String(opts.lat));
  params.set('lng', String(opts.lng));
  if (opts.excludeOwnerId) params.set('excludeOwnerId', String(opts.excludeOwnerId));
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.radiusKm != null) params.set('radiusKm', String(opts.radiusKm));
  return request<PetProfile[]>(`/api/pets/nearby?${params.toString()}`);
}

/** کارت تصویری لیست نزدیک (JPEG) */
export async function fetchNearbyListCardBuffer(opts: {
  lat: number;
  lng: number;
  radiusKm: number;
  excludeOwnerId?: number;
  page?: number;
  pageSize?: number;
}): Promise<Buffer> {
  const params = new URLSearchParams();
  params.set('lat', String(opts.lat));
  params.set('lng', String(opts.lng));
  params.set('radiusKm', String(opts.radiusKm));
  if (opts.excludeOwnerId) params.set('excludeOwnerId', String(opts.excludeOwnerId));
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.pageSize != null) params.set('pageSize', String(opts.pageSize));
  const res = await fetch(`${config.apiUrl}/api/pets/nearby/list-card?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`list-card ${res.status}: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** کارت پروفایل پت با اورلی صاحب (JPEG) */
export async function fetchPetProfileCardBuffer(
  petId: number,
  opts?: { viewerLat?: number; viewerLng?: number }
): Promise<Buffer> {
  const params = new URLSearchParams();
  if (opts?.viewerLat != null) params.set('viewerLat', String(opts.viewerLat));
  if (opts?.viewerLng != null) params.set('viewerLng', String(opts.viewerLng));
  const qs = params.toString();
  const res = await fetch(
    `${config.apiUrl}/api/pets/${petId}/profile-card${qs ? `?${qs}` : ''}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`profile-card ${res.status}: ${body}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** ذخیره موقعیت کاربر از دکمه ارسال موقعیت تلگرام */
export async function saveUserLocation(
  telegramId: string,
  lat: number,
  lng: number
): Promise<User | null> {
  try {
    return await request<User>(
      `/api/users/telegram/${encodeURIComponent(telegramId)}/location`,
      {
        method: 'POST',
        body: JSON.stringify({ lat, lng }),
      }
    );
  } catch {
    return null;
  }
}

export async function getPet(id: number): Promise<PetProfile | null> {
  try {
    return await request<PetProfile>(`/api/pets/${id}`);
  } catch {
    return null;
  }
}

export async function createPet(data: {
  ownerId: number;
  name: string;
  species: string;
  breed?: string;
  gender?: PetGender;
  ageMonths?: number;
  size?: PetSize;
  color?: string;
  bio?: string;
  vaccinated?: boolean;
  neutered?: boolean;
  lookingForPlaymate?: boolean;
  health?: Record<string, unknown>;
  diseases?: string;
  imageUrl?: string;
  city?: string;
  neighborhood?: string;
}): Promise<PetProfile> {
  return request<PetProfile>('/api/pets', {
    method: 'POST',
    body: JSON.stringify({
      lookingForPlaymate: true,
      vaccinated: false,
      neutered: false,
      ...data,
    }),
  });
}

export async function listPlaydates(filters?: {
  userId?: number;
  status?: PlaydateStatus;
}): Promise<PlaydateRequest[]> {
  const params = new URLSearchParams();
  if (filters?.userId) params.set('userId', String(filters.userId));
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return request<PlaydateRequest[]>(`/api/playdate-requests${qs ? `?${qs}` : ''}`);
}

export async function createPlaydate(data: {
  fromPetId: number;
  toPetId: number;
  fromUserId: number;
  message?: string;
  /** Skip API resend-confirm gate after a prior expired request. */
  confirmResend?: boolean;
}): Promise<PlaydateRequest & { telegramNotified?: boolean }> {
  return request<PlaydateRequest & { telegramNotified?: boolean }>('/api/playdate-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePlaydateStatus(
  id: number,
  status: PlaydateStatus,
  userId: number
): Promise<PlaydateRequest> {
  return request<PlaydateRequest>(`/api/playdate-requests/${id}`, {
    method: 'PATCH',
    // Bot opens owner chat itself — API must not send a second intro.
    body: JSON.stringify({ status, userId, startOwnerChat: false }),
  });
}

export async function getPlaydate(id: number): Promise<PlaydateRequest | null> {
  try {
    return await request<PlaydateRequest>(`/api/playdate-requests/${id}`);
  } catch {
    return null;
  }
}

export type ActiveOwnerChat = {
  playdateId: number;
  peerTelegramId: string;
  peerUserId: number;
  myPetId: number;
  peerPetId: number;
  /** Stable tappable آیدی (/u#####) — never Telegram username */
  peerPublicId?: string;
  /** @deprecated use peerPublicId — kept for older API payloads */
  peerName?: string;
  chatSecure?: boolean;
};

export async function getActiveOwnerChat(telegramId: string): Promise<ActiveOwnerChat | null> {
  try {
    return await request<ActiveOwnerChat | null>(
      `/api/playdate-requests/active-owner-chat?telegramId=${encodeURIComponent(telegramId)}`
    );
  } catch {
    return null;
  }
}

/** Persist a Telegram owner-chat line so the web client can poll it. */
export async function postPlaydateChatMessage(
  playdateId: number,
  senderUserId: number,
  text: string,
  media?: {
    mediaKind: string;
    telegramFileId: string;
    mimeType?: string;
    fileName?: string;
  }
): Promise<void> {
  try {
    await request(`/api/playdate-requests/${playdateId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        senderUserId,
        text,
        skipTelegram: true,
        ...(media
          ? {
              mediaKind: media.mediaKind,
              telegramFileId: media.telegramFileId,
              mimeType: media.mimeType,
              fileName: media.fileName,
            }
          : {}),
      }),
    });
  } catch (err) {
    console.error('Failed to persist playdate chat message:', err);
  }
}

/** Record bot-delivered Telegram message ids for later web wipe. */
export async function postPlaydateChatTgRefs(
  playdateId: number,
  refs: Array<{ telegramChatId: string; messageId: number }>,
  userId?: number
): Promise<void> {
  if (!playdateId || refs.length === 0) return;
  try {
    await request(`/api/playdate-requests/${playdateId}/telegram-message-refs`, {
      method: 'POST',
      body: JSON.stringify({
        ...(Number.isFinite(userId) ? { userId } : {}),
        refs,
      }),
    });
  } catch (err) {
    console.error('Failed to record playdate chat tg refs:', err);
  }
}

export async function endPlaydateChatViaApi(playdateId: number, userId: number): Promise<void> {
  try {
    await request(`/api/playdate-requests/${playdateId}/end-chat`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.error('Failed to end playdate chat via API:', err);
  }
}

export async function setPlaydateChatSecureViaApi(
  playdateId: number,
  userId: number,
  secure: boolean
): Promise<void> {
  try {
    await request(`/api/playdate-requests/${playdateId}/chat-secure`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, secure }),
    });
  } catch (err) {
    console.error('Failed to set playdate chat secure via API:', err);
  }
}

export async function listVetConsultations(vetUserId: number): Promise<VetConsultation[]> {
  const params = new URLSearchParams({ vetUserId: String(vetUserId) });
  return request<VetConsultation[]>(`/api/consultations?${params.toString()}`);
}

export async function createVetConsultation(data: {
  vetUserId: number;
  patientUserId: number;
  petId?: number;
  notes?: string;
}): Promise<VetConsultation> {
  return request<VetConsultation>('/api/consultations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type QuickVetConnectResult = {
  ok: true;
  sent: number;
  notifiedTelegram?: number;
  cost: number;
  coins: number;
  consultations: VetConsultation[];
  message: string;
};

export type QuickVetConnectFailure = {
  ok: false;
  status: number;
  error: string;
  reason?: string;
  code?: string;
  requiresResendConfirm?: boolean;
  balance?: number;
  cost?: number;
  refunded?: boolean;
  coins?: number;
};

/**
 * اتصال سریع دامپزشک — کسر سکه و ایجاد درخواست فقط سمت API
 * (هم‌تراز وب؛ کلاینت ربات به debit جداگانه تکیه نکند).
 */
export async function quickVetConnect(
  patientUserId: number,
  opts?: { confirmResend?: boolean; purchaseAdvice?: boolean }
): Promise<QuickVetConnectResult | QuickVetConnectFailure> {
  const res = await fetch(`${config.apiUrl}/api/consultations/quick-connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientUserId,
      confirmResend: Boolean(opts?.confirmResend),
      purchaseAdvice: Boolean(opts?.purchaseAdvice),
      intent: opts?.purchaseAdvice ? 'purchase_advice' : undefined,
    }),
  });
  const body = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = body ? (JSON.parse(body) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        (typeof json.error === 'string' && json.error) ||
        (typeof json.message === 'string' && json.message) ||
        body ||
        `خطای ${res.status}`,
      reason: typeof json.reason === 'string' ? json.reason : undefined,
      code: typeof json.code === 'string' ? json.code : undefined,
      requiresResendConfirm: Boolean(
        json.requiresResendConfirm || json.code === 'RESEND_CONFIRM_REQUIRED'
      ),
      balance: typeof json.balance === 'number' ? json.balance : undefined,
      cost: typeof json.cost === 'number' ? json.cost : undefined,
      refunded: Boolean(json.refunded),
      coins: typeof json.coins === 'number' ? json.coins : undefined,
    };
  }
  return {
    ok: true,
    sent: Number(json.sent ?? 0),
    notifiedTelegram:
      typeof json.notifiedTelegram === 'number' ? json.notifiedTelegram : undefined,
    cost: Number(json.cost ?? 0),
    coins: Number(json.coins ?? 0),
    consultations: Array.isArray(json.consultations)
      ? (json.consultations as VetConsultation[])
      : [],
    message: typeof json.message === 'string' ? json.message : 'درخواست ارسال شد.',
  };
}

export async function updateVetConsultationStatus(
  id: number,
  status: 'requested' | 'active' | 'completed' | 'cancelled' | 'expired'
): Promise<VetConsultation> {
  return request<VetConsultation>(`/api/consultations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** دامپزشک‌های واجد شرایط اتصال سریع */
export async function listVerifiedVets(): Promise<User[]> {
  return request<User[]>('/api/users/vets/verified');
}

/** دامپزشک‌های آنلاین آماده پذیرش (+ مبلغ ویزیت) */
export async function listOnlineVets(): Promise<User[]> {
  return request<User[]>('/api/users/vets/online');
}

/** همه دامپزشک‌ها برای پنل ادمین */
export async function listAllVets(): Promise<User[]> {
  return request<User[]>('/api/users/vets');
}

export type SetVetEnabledResult = {
  ok: true;
  user: User;
  sms:
    | { sent: true; phone: string }
    | { sent: false; skipped?: true; reason: string };
};

/** فعال/غیرفعال کردن دامپزشک توسط ادمین (+ پیامک) */
export async function setVetEnabled(userId: number, enabled: boolean): Promise<SetVetEnabledResult> {
  return request<SetVetEnabledResult>(`/api/users/${userId}/vet-enabled`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

/** وضعیت آنلاین/آفلاین دامپزشک */
export async function setVetOnline(telegramId: string, online: boolean): Promise<User> {
  return request<User>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/vet-online`,
    {
      method: 'POST',
      body: JSON.stringify({ online }),
    }
  );
}

/** آماده پذیرش پت — نقش دنبال‌کننده */
export async function setReadyToAdopt(telegramId: string, ready: boolean): Promise<User> {
  return request<User>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/ready-to-adopt`,
    {
      method: 'POST',
      body: JSON.stringify({ ready }),
    }
  );
}

/** مبلغ ویزیت دامپزشک (سکه) */
export async function setVetVisitFee(telegramId: string, visitFeeCoins: number): Promise<User> {
  return request<User>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/visit-fee`,
    {
      method: 'POST',
      body: JSON.stringify({ visitFeeCoins }),
    }
  );
}

export async function debitUserCoins(telegramId: string, amount: number): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/coins/debit`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}


export type WalletTransactionDto = {
  id: number;
  currency: 'ton' | 'stars' | 'coins' | 'toman';
  amount: number;
  direction: 'credit' | 'debit';
  reason: string;
  labelFa: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
  delta: number;
};

export async function fetchWalletTransactions(
  telegramId: string,
  limit = 8
): Promise<WalletTransactionDto[]> {
  const res = await request<{ ok: true; transactions: WalletTransactionDto[] }>(
    `/api/users/telegram/${encodeURIComponent(telegramId)}/wallet/transactions?limit=${limit}`
  );
  return res.transactions ?? [];
}

export async function creditUserCoins(
  telegramId: string,
  amount: number,
  reason?: string
): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/coins/credit`, {
    method: 'POST',
    body: JSON.stringify(reason ? { amount, reason } : { amount }),
  });
}

export type SendPhoneOtpResult =
  | { ok: true; phone: string; expiresAt: string }
  | {
      ok: false;
      reason?: string;
      error?: string;
      retryAfterSec?: number;
    };

export async function sendPhoneOtp(
  telegramId: string,
  phone: string
): Promise<SendPhoneOtpResult> {
  const res = await fetch(
    `${config.apiUrl}/api/users/telegram/${encodeURIComponent(telegramId)}/phone/send-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }
  );
  const body = (await res.json().catch(() => ({}))) as SendPhoneOtpResult & {
    error?: string;
  };
  if (!res.ok || !body.ok) {
    return {
      ok: false,
      reason: (body as { reason?: string }).reason,
      error: body.error || `API ${res.status}`,
      retryAfterSec: (body as { retryAfterSec?: number }).retryAfterSec,
    };
  }
  return body as { ok: true; phone: string; expiresAt: string };
}

export type VerifyPhoneOtpResult =
  | { ok: true; user: User }
  | {
      ok: false;
      reason?: string;
      error?: string;
      attemptsLeft?: number;
    };

export async function verifyPhoneOtp(
  telegramId: string,
  phone: string,
  code: string
): Promise<VerifyPhoneOtpResult> {
  const res = await fetch(
    `${config.apiUrl}/api/users/telegram/${encodeURIComponent(telegramId)}/phone/verify-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }
  );
  const body = (await res.json().catch(() => ({}))) as VerifyPhoneOtpResult & {
    error?: string;
  };
  if (!res.ok || !body.ok) {
    return {
      ok: false,
      reason: (body as { reason?: string }).reason,
      error: body.error || `API ${res.status}`,
      attemptsLeft: (body as { attemptsLeft?: number }).attemptsLeft,
    };
  }
  return body as { ok: true; user: User };
}

export async function updatePet(
  id: number,
  ownerId: number,
  patch: Partial<{
    name: string;
    species: string;
    breed: string;
    gender: PetGender;
    ageMonths: number;
    size: PetSize;
    color: string;
    bio: string;
    vaccinated: boolean;
    neutered: boolean;
    lookingForPlaymate: boolean;
    health: Record<string, unknown>;
    diseases: string;
    imageUrl: string;
    city: string;
    neighborhood: string;
  }>
): Promise<PetProfile> {
  return request<PetProfile>(`/api/pets/${id}?ownerId=${ownerId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePet(id: number, ownerId: number): Promise<void> {
  await request<{ ok: boolean }>(`/api/pets/${id}?ownerId=${ownerId}`, {
    method: 'DELETE',
  });
}

export async function claimDailyCoins(
  telegramId: string,
  amount = 10
): Promise<{ ok: true; awarded: number; user: User } | { ok: false; reason: string; user?: User }> {
  const res = await fetch(
    `${config.apiUrl}/api/users/telegram/${encodeURIComponent(telegramId)}/coins/daily`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    }
  );
  const body = (await res.json()) as {
    ok?: boolean;
    awarded?: number;
    user?: User;
    reason?: string;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error', user: body.user };
  }
  return { ok: true, awarded: body.awarded ?? amount, user: body.user! };
}

export async function hasOpenCoinSell(telegramId: string): Promise<boolean> {
  try {
    const data = await request<{ open: boolean }>(
      `/api/users/telegram/${encodeURIComponent(telegramId)}/coins/sell/open`
    );
    return Boolean(data.open);
  } catch {
    return false;
  }
}

export async function submitCoinSell(
  telegramId: string,
  data: { coins: number; cardNumber: string; rateToman: number; minCoins: number }
): Promise<
  | { ok: true; requestId: number; amountToman: number; rateToman: number; user: User }
  | { ok: false; reason: string }
> {
  const res = await fetch(
    `${config.apiUrl}/api/users/telegram/${encodeURIComponent(telegramId)}/coins/sell`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  const body = (await res.json()) as {
    ok?: boolean;
    requestId?: number;
    amountToman?: number;
    rateToman?: number;
    user?: User;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return {
    ok: true,
    requestId: body.requestId!,
    amountToman: body.amountToman!,
    rateToman: body.rateToman!,
    user: body.user!,
  };
}

export type PaymentOrder = {
  id: number;
  userId: number;
  packageId: string;
  coins: number;
  amountToman?: number;
  amountStars?: number;
  method: 'card' | 'stars';
  status: string;
  receiptFileId?: string;
  telegramPaymentChargeId?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  userName?: string;
  userTelegramId?: string;
  userUsername?: string;
};

export async function createPaymentOrder(
  telegramId: string,
  data: {
    packageId: string;
    coins: number;
    amountToman?: number;
    amountStars?: number;
    method: 'card' | 'stars';
  }
): Promise<{ ok: true; order: PaymentOrder } | { ok: false; reason: string }> {
  const res = await fetch(
    `${config.apiUrl}/api/users/telegram/${encodeURIComponent(telegramId)}/payments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  const body = (await res.json()) as {
    ok?: boolean;
    order?: PaymentOrder;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.order) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return { ok: true, order: body.order };
}

export async function getPaymentOrder(orderId: number): Promise<PaymentOrder | null> {
  try {
    return await request<PaymentOrder>(`/api/users/payments/${orderId}`);
  } catch {
    return null;
  }
}

export async function listPendingCardPayments(): Promise<PaymentOrder[]> {
  return request<PaymentOrder[]>('/api/users/payments/pending/card');
}

export async function attachPaymentReceipt(
  orderId: number,
  receiptFileId: string
): Promise<{ ok: true; order: PaymentOrder } | { ok: false; reason: string }> {
  const res = await fetch(`${config.apiUrl}/api/users/payments/${orderId}/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptFileId }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    order?: PaymentOrder;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.order) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return { ok: true, order: body.order };
}

export async function approveCardPayment(
  orderId: number,
  note?: string
): Promise<
  | { ok: true; order: PaymentOrder; user: User; shopOrder?: { id: number }; kind?: string }
  | { ok: false; reason: string }
> {
  const res = await fetch(`${config.apiUrl}/api/users/payments/${orderId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    order?: PaymentOrder;
    user?: User;
    shopOrder?: { id: number };
    kind?: string;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.order || !body.user) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return {
    ok: true,
    order: body.order,
    user: body.user,
    shopOrder: body.shopOrder,
    kind: body.kind,
  };
}

export async function rejectCardPayment(
  orderId: number,
  note?: string
): Promise<{ ok: true; order: PaymentOrder; user: User | null } | { ok: false; reason: string }> {
  const res = await fetch(`${config.apiUrl}/api/users/payments/${orderId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    order?: PaymentOrder;
    user?: User | null;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.order) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return { ok: true, order: body.order, user: body.user ?? null };
}

export async function completeStarsPayment(
  orderId: number,
  telegramPaymentChargeId: string
): Promise<
  | {
      ok: true;
      order: PaymentOrder;
      user: User;
      credited: boolean;
      creditKind: 'coins' | 'wallet_stars' | 'shop_order';
      shopOrderId?: number;
      starsSpent?: number;
      totalToman?: number;
      webSuccessUrl?: string;
    }
  | { ok: false; reason: string }
> {
  const res = await fetch(`${config.apiUrl}/api/users/payments/${orderId}/stars/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramPaymentChargeId }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    order?: PaymentOrder;
    user?: User;
    credited?: boolean;
    creditKind?: 'coins' | 'wallet_stars' | 'shop_order';
    shopOrderId?: number;
    starsSpent?: number;
    totalToman?: number;
    webSuccessUrl?: string;
    reason?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.order || !body.user) {
    return { ok: false, reason: body.reason ?? body.error ?? 'error' };
  }
  return {
    ok: true,
    order: body.order,
    user: body.user,
    credited: Boolean(body.credited),
    creditKind:
      body.creditKind === 'wallet_stars'
        ? 'wallet_stars'
        : body.creditKind === 'shop_order'
          ? 'shop_order'
          : 'coins',
    shopOrderId: body.shopOrderId,
    starsSpent: body.starsSpent,
    totalToman: body.totalToman,
    webSuccessUrl: body.webSuccessUrl,
  };
}

export async function getPetMedical(
  petId: number,
  viewerId: number
): Promise<{
  record: import('@petdate/shared').PetMedicalRecord;
  entries: import('@petdate/shared').PetMedicalEntry[];
  pet: import('@petdate/shared').PetProfile;
}> {
  return request(`/api/pets/${petId}/medical-record?viewerId=${viewerId}`);
}

export async function updatePetMedical(
  petId: number,
  viewerId: number,
  patch: Partial<import('@petdate/shared').PetMedicalRecord>
): Promise<import('@petdate/shared').PetMedicalRecord> {
  return request(`/api/pets/${petId}/medical-record`, {
    method: 'PUT',
    body: JSON.stringify({ viewerId, ...patch }),
  });
}

export async function addPetMedicalEntry(
  petId: number,
  data: { authorUserId: number; text: string; consultId?: number; authorName?: string }
): Promise<import('@petdate/shared').PetMedicalEntry> {
  return request(`/api/pets/${petId}/medical-entries`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getVetConsultation(id: number): Promise<import('@petdate/shared').VetConsultation | null> {
  try {
    return await request(`/api/consultations/${id}`);
  } catch {
    return null;
  }
}

export type CreatePrescriptionResponse = {
  prescription: import('@petdate/shared').Prescription;
  pdfPath: string;
  pdfUrl: string;
  /** Relative public PDF path e.g. /rx/12.pdf (under PUBLIC_PDF_URL) */
  pdfPathPublic?: string;
  /** Absolute HTTPS PDF download URL under pdf.petdate.ir */
  pdfPublicUrl?: string;
  webPath?: string;
  webUrl?: string;
  chatMessage?: import('@petdate/shared').VetConsultChatMessage | null;
  /** True when API already relayed PDF/link to patient Telegram */
  telegramDelivered?: boolean;
  chatDeliveryNote?: string;
  sms:
    | { sent: true; phone: string; pdfUrl?: string; webUrl?: string }
    | {
        sent: false;
        skipped: true;
        reason: string;
        pdfUrl?: string;
        webUrl?: string;
        failed?: boolean;
      };
  patient: {
    id: number;
    name: string;
    telegramId?: string;
    phoneVerified?: boolean;
  };
  vet: { id: number; name: string; telegramId?: string };
  pet: { id: number; name: string; species?: string; breed?: string };
};

export async function createConsultationPrescription(
  consultId: number,
  data: { vetUserId: number; petId: number; text: string }
): Promise<CreatePrescriptionResponse> {
  return request(`/api/consultations/${consultId}/prescription`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** دانلود باینری PDF نسخه از API */
export async function fetchPrescriptionPdfBuffer(prescriptionId: number): Promise<Buffer> {
  const res = await fetch(`${config.apiUrl}/api/prescriptions/${prescriptionId}/pdf`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PDF ${res.status}: ${body}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** افزودن مخاطب (مالک↔مالک) */
export async function addUserContact(
  userId: number,
  contactUserId: number
): Promise<{ ok: true; created: boolean }> {
  const res = await fetch(`${config.apiUrl}/api/users/${userId}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactUserId }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`add contact ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { ok: true; created: boolean };
  return data;
}

export async function listUserContacts(userId: number): Promise<
  Array<{
    id: number;
    userId: number;
    contactUserId: number;
    createdAt: string;
    contactName?: string;
    contactUsername?: string;
  }>
> {
  return request(`/api/users/${userId}/contacts`);
}

export async function listUserBlocks(userId: number): Promise<
  Array<{
    id: number;
    userId: number;
    blockedUserId: number;
    createdAt: string;
    blockedName?: string;
    blockedUsername?: string;
  }>
> {
  return request(`/api/users/${userId}/blocks`);
}

export async function fetchProfileCard(userId: number): Promise<{
  user: User;
  extras: {
    contactsCount: number;
    blockedCount: number;
    interactions: {
      likes: number;
      views: number;
      playdatesTotal: number;
      playdatesPending: number;
      playdatesAccepted: number;
    };
  } | null;
}> {
  return request(`/api/users/${userId}/profile-card`);
}

export async function setSilentChatRequests(userId: number, enabled: boolean): Promise<User> {
  return request(`/api/users/${userId}/silent-chat`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

/* —— پت شاپ (کاتالوگ مشترک با وب از DB) —— */

export type ShopApiCategory = {
  slug: string;
  labelFa: string;
  petType: string;
  description: string;
  emoji: string;
  sortOrder: number;
};

export type ShopApiProduct = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  petTypes: string[];
  priceToman: number;
  compareAtToman?: number;
  image?: string;
  badge?: string;
  inStock: boolean;
  stockQty: number;
  params: Record<string, string>;
  description: string;
  featured: boolean;
  coins?: number;
};

export async function fetchShopCategories(petType?: string): Promise<{
  total: number;
  categories: ShopApiCategory[];
  coinPriceToman?: number;
}> {
  const qs = petType && petType !== 'all' ? `?petType=${encodeURIComponent(petType)}` : '';
  return request(`/api/shop/categories${qs}`);
}

export async function fetchShopProducts(filters?: {
  category?: string;
  petType?: string;
  q?: string;
  featured?: boolean;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  total: number;
  products: ShopApiProduct[];
  coinPriceToman?: number;
}> {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.petType) params.set('petType', filters.petType);
  if (filters?.q) params.set('q', filters.q);
  if (filters?.featured) params.set('featured', '1');
  if (filters?.inStock === true) params.set('inStock', '1');
  if (filters?.inStock === false) params.set('inStock', '0');
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  const qs = params.toString() ? `?${params}` : '';
  return request(`/api/shop/products${qs}`);
}

export async function fetchShopProduct(idOrSlug: string): Promise<{
  product: ShopApiProduct;
  category: ShopApiCategory | null;
} | null> {
  try {
    return await request(`/api/shop/products/${encodeURIComponent(idOrSlug)}`);
  } catch {
    return null;
  }
}

export async function checkoutShopWithCoinsTelegram(payload: {
  telegramId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
}): Promise<{
  ok: true;
  orderId: number;
  coinsSpent: number;
  coinsRemaining: number;
  totalToman: number;
  message?: string;
}> {
  return request('/api/shop/checkout/coins-telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkoutShopWithStarsTelegram(payload: {
  telegramId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
}): Promise<{
  ok: true;
  paymentOrderId: number;
  stars: number;
  starsNeeded: number;
  totalToman: number;
  titleHint: string;
  botDeepLink: string;
  requiresTelegramStars: true;
  message?: string;
}> {
  return request('/api/shop/checkout/stars-telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkoutShopWithWalletStarsTelegram(payload: {
  telegramId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
}): Promise<{
  ok: true;
  orderId: number;
  starsSpent: number;
  starsRemaining: number;
  totalToman: number;
  message?: string;
}> {
  return request('/api/shop/checkout/wallet-stars-telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkoutShopWithTomanTelegram(payload: {
  telegramId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
}): Promise<{
  ok: true;
  orderId: number;
  tomanSpent: number;
  tomanRemaining: number;
  totalToman: number;
  message?: string;
}> {
  return request('/api/shop/checkout/toman-telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function checkoutShopWithCardTelegram(payload: {
  telegramId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  address: string;
  note?: string;
}): Promise<{
  ok: true;
  paymentOrderId: number;
  totalToman: number;
  cardNumber: string;
  cardHolder: string;
  botDeepLink: string;
  message?: string;
}> {
  return request('/api/shop/checkout/card-telegram', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type BotShopOrder = {
  id: number;
  status: string;
  totalToman: number;
  paymentCurrency?: string;
  paymentAmount?: number;
  customerName?: string;
  items: Array<{ title?: string; productId?: string; qty?: number }>;
  createdAt: string;
};

export async function fetchMyShopOrdersTelegram(telegramId: string): Promise<{
  ok: true;
  total: number;
  orders: BotShopOrder[];
  statusLabelsFa?: Record<string, string>;
}> {
  return request(
    `/api/shop/orders-telegram?telegramId=${encodeURIComponent(telegramId)}&limit=15`
  );
}
