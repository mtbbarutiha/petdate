import type {
  OnboardingStatus,
  PetMedicalEntry,
  PetMedicalRecord,
  PetProfile,
  PlaydateChatMessage,
  PlaydateRequest,
  PlaydateStatus,
  Prescription,
  User,
  UserPresence,
  UserRole,
  VetConsultChatMessage,
  VetConsultation,
  VetConsultStatus,
} from '@petdate/shared';

/** Empty = same-origin (Vite proxies /api → API). Override with VITE_API_URL if needed. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const WEB_AUTH_STORAGE_KEY = 'petdate_web_auth_v1';

function readStoredWebToken(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(WEB_AUTH_STORAGE_KEY);
    if (!raw) return undefined;
    const token = (JSON.parse(raw) as { token?: string }).token;
    return typeof token === 'string' && token.trim() ? token.trim() : undefined;
  } catch {
    return undefined;
  }
}

function storedAuthHeaders(): Record<string, string> {
  const token = readStoredWebToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Resolve stored media paths for <img src> / CSS backgrounds.
 * Relative `/api/...` must be prefixed with VITE_API_URL when the web origin differs.
 * Opaque Telegram file_ids are mapped to the pet/media image proxy when possible.
 */
export function resolvePublicMediaUrl(
  url?: string | null,
  opts?: { petId?: number }
): string {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('blob:') ||
    raw.startsWith('data:')
  ) {
    return raw;
  }
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  // Telegram Bot API file_id — not a browser URL
  if (/^(AgAC|AQAD|BAAC|BQAC|AwAC|CQAC|DQAC)/.test(raw) || /^[A-Za-z0-9_-]{24,}$/.test(raw)) {
    if (opts?.petId != null && Number.isFinite(opts.petId) && opts.petId > 0) {
      return `${API_BASE}/api/pets/${opts.petId}/image`;
    }
    return `${API_BASE}/api/media/telegram/${encodeURIComponent(raw)}`;
  }
  return '';
}

export async function subscribeNewsletter(email: string, source = 'footer') {
  return request<{
    ok: true;
    created: boolean;
    from: string;
    message: string;
  }>('/api/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, source }),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    // headers must come after ...init so Authorization does not wipe Content-Type
    res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as {
        error?: string;
        message?: string;
        code?: string;
        requiresResendConfirm?: boolean;
      };
      const err = new Error(json.error || json.message || body || `خطای ${res.status}`) as Error & {
        code?: string;
        requiresResendConfirm?: boolean;
        status?: number;
      };
      err.code = json.code;
      err.requiresResendConfirm = Boolean(json.requiresResendConfirm || json.code === 'RESEND_CONFIRM_REQUIRED');
      err.status = res.status;
      throw err;
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{') && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json() as Promise<T>;
}

export async function registerUser(data: {
  telegramId?: string;
  name: string;
  username?: string;
}): Promise<User> {
  return request<User>('/api/users/register', {
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

export async function getUserById(userId: number): Promise<User | null> {
  try {
    return await request<User>(`/api/users/id/${userId}`);
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

export async function setUserRoles(telegramId: string, roles: UserRole[]): Promise<User> {
  return request<User>(`/api/users/telegram/${encodeURIComponent(telegramId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  });
}

export async function setUserRoleById(userId: number, role: UserRole): Promise<User> {
  return request<User>(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function setUserRolesById(userId: number, roles: UserRole[]): Promise<User> {
  return request<User>(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ roles }),
  });
}

export async function setUserOnboarding(
  userId: number,
  onboarding: OnboardingStatus
): Promise<User> {
  return request<User>(`/api/users/${userId}/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding }),
  });
}

export async function listPets(filters?: {
  ownerId?: number;
  lookingForPlaymate?: boolean;
  species?: string;
}): Promise<PetProfile[]> {
  const params = new URLSearchParams();
  if (filters?.ownerId) params.set('ownerId', String(filters.ownerId));
  if (filters?.lookingForPlaymate !== undefined) {
    params.set('lookingForPlaymate', String(filters.lookingForPlaymate));
  }
  if (filters?.species) params.set('species', filters.species);
  const qs = params.toString();
  return request<PetProfile[]>(`/api/pets${qs ? `?${qs}` : ''}`, {
    headers: storedAuthHeaders(),
  });
}

export async function getPet(idOrSlug: number | string): Promise<PetProfile | null> {
  try {
    const key = encodeURIComponent(String(idOrSlug).trim());
    return await request<PetProfile>(`/api/pets/${key}`, {
      headers: storedAuthHeaders(),
    });
  } catch {
    return null;
  }
}

export async function listPetDiary(
  idOrSlug: number | string
): Promise<{ petId: number; slug?: string; title: string; entries: import('@petdate/shared').PetDiaryEntry[] }> {
  const key = encodeURIComponent(String(idOrSlug).trim());
  return request(`/api/pets/${key}/diary`);
}

export async function createPetDiaryEntry(
  idOrSlug: number | string,
  body: string,
  ownerId: number
): Promise<import('@petdate/shared').PetDiaryEntry> {
  const key = encodeURIComponent(String(idOrSlug).trim());
  return request(`/api/pets/${key}/diary`, {
    method: 'POST',
    headers: storedAuthHeaders(),
    body: JSON.stringify({ body, ownerId }),
  });
}

export async function deletePetDiaryEntry(
  idOrSlug: number | string,
  entryId: number,
  ownerId: number
): Promise<void> {
  const key = encodeURIComponent(String(idOrSlug).trim());
  await request(`/api/pets/${key}/diary/${entryId}?ownerId=${ownerId}`, {
    method: 'DELETE',
    headers: storedAuthHeaders(),
  });
}

export async function createPet(data: Record<string, unknown>): Promise<PetProfile & { owner?: User }> {
  return request<PetProfile & { owner?: User }>('/api/pets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listBreeds(species?: string, q?: string): Promise<import('@petdate/shared').PetBreed[]> {
  const params = new URLSearchParams();
  if (species) params.set('species', species);
  if (q?.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return request(`/api/catalog/breeds${qs ? `?${qs}` : ''}`);
}

export async function updatePet(
  id: number,
  data: Record<string, unknown>
): Promise<PetProfile> {
  const ownerId = data.ownerId != null ? Number(data.ownerId) : undefined;
  const qs = ownerId ? `?ownerId=${ownerId}` : '';
  return request<PetProfile>(`/api/pets/${id}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function listPetPrescriptions(
  petId: number,
  viewerId: number
): Promise<Prescription[]> {
  return request<Prescription[]>(
    `/api/pets/${petId}/prescriptions?viewerId=${viewerId}`
  );
}

export async function listPetWishlist(petId: number): Promise<PetProfile[]> {
  return request<PetProfile[]>(`/api/pets/${petId}/wishlist`);
}

export async function addPetWishlistTarget(
  petId: number,
  targetPetId: number,
  ownerId: number
): Promise<{ ok: true }> {
  return request(`/api/pets/${petId}/wishlist`, {
    method: 'POST',
    body: JSON.stringify({ targetPetId, ownerId }),
  });
}

export async function removePetWishlistTarget(
  petId: number,
  targetPetId: number,
  ownerId: number
): Promise<{ ok: true }> {
  return request(`/api/pets/${petId}/wishlist/${targetPetId}?ownerId=${ownerId}`, {
    method: 'DELETE',
  });
}

/** Upload a pet profile photo; returns a public URL path under /api/pets/photos/... */
export async function uploadPetPhoto(
  ownerId: number,
  file: File
): Promise<{ ok: true; url: string; storageKey: string; mimeType?: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('ownerId', String(ownerId));

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/pets/photos/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: string; message?: string };
      throw new Error(json.error || json.message || body || `خطای ${res.status}`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{') && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json();
}

export async function listPlaydateRequests(filters?: {
  userId?: number;
  petId?: number;
  status?: PlaydateStatus;
}): Promise<PlaydateRequest[]> {
  const params = new URLSearchParams();
  if (filters?.userId) params.set('userId', String(filters.userId));
  if (filters?.petId) params.set('petId', String(filters.petId));
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return request<PlaydateRequest[]>(`/api/playdate-requests${qs ? `?${qs}` : ''}`, {
    headers: storedAuthHeaders(),
  });
}

export async function getPlaydateRequest(id: number): Promise<PlaydateRequest | null> {
  try {
    return await request<PlaydateRequest>(`/api/playdate-requests/${id}`, {
      headers: storedAuthHeaders(),
    });
  } catch {
    return null;
  }
}

export async function createPlaydateRequest(data: {
  fromPetId: number;
  toPetId: number;
  fromUserId: number;
  toUserId?: number;
  message?: string;
  scheduledAt?: string;
  location?: string;
  confirmResend?: boolean;
}): Promise<PlaydateRequest & { cost?: number; coins?: number; alreadyPending?: boolean }> {
  return request<PlaydateRequest & { cost?: number; coins?: number; alreadyPending?: boolean }>(
    '/api/playdate-requests',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/** پیدا کردن همبازی — یک‌بار ۲ سکه از درخواست‌کننده (هم‌تراز ربات) */
export async function findPlaymatesRequest(data: {
  fromPetId: number;
  fromUserId: number;
}): Promise<{
  ok: boolean;
  sent: number;
  skipped: number;
  cost: number;
  coins: number;
  speciesLabel: string;
  sourceName: string;
  sourcePetId: number;
  sampleLine?: string;
  message?: string;
}> {
  return request('/api/playdate-requests/find', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: storedAuthHeaders(),
  });
}

export async function updatePlaydateStatus(
  id: number,
  status: PlaydateStatus,
  userId: number
): Promise<PlaydateRequest> {
  return request<PlaydateRequest>(`/api/playdate-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, userId }),
  });
}

export async function listPlaydateChatMessages(
  playdateId: number,
  userId: number,
  afterId?: number
): Promise<PlaydateChatMessage[]> {
  const params = new URLSearchParams({ userId: String(userId) });
  if (afterId != null) params.set('afterId', String(afterId));
  return request(`/api/playdate-requests/${playdateId}/messages?${params}`);
}

export async function postPlaydateChatMessage(
  playdateId: number,
  senderUserId: number,
  text: string
): Promise<PlaydateChatMessage> {
  return request(`/api/playdate-requests/${playdateId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ senderUserId, text }),
  });
}

/** Upload a chat attachment (photo / video / audio / document). */
export async function uploadPlaydateChatFile(
  playdateId: number,
  senderUserId: number,
  file: File,
  caption = ''
): Promise<PlaydateChatMessage> {
  const form = new FormData();
  form.append('file', file);
  form.append('senderUserId', String(senderUserId));
  if (caption.trim()) form.append('caption', caption.trim());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/playdate-requests/${playdateId}/messages/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: string; message?: string };
      throw new Error(json.error || json.message || body || `خطای ${res.status}`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{') && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json() as Promise<PlaydateChatMessage>;
}

export async function clearPlaydateChatMessages(
  playdateId: number,
  userId: number
): Promise<{ ok: true; cleared: number }> {
  return request(`/api/playdate-requests/${playdateId}/messages?userId=${userId}`, {
    method: 'DELETE',
  });
}


export async function addUserContact(
  userId: number,
  contactUserId: number
): Promise<{ ok: true; created: boolean }> {
  return request(`/api/users/${userId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ contactUserId }),
  });
}

export async function listUserContacts(userId: number) {
  return request<
    Array<{
      id: number;
      userId: number;
      contactUserId: number;
      createdAt: string;
      contactName?: string;
      contactUsername?: string;
    }>
  >(`/api/users/${userId}/contacts`);
}

export async function listUserBlocks(userId: number) {
  return request<
    Array<{
      id: number;
      userId: number;
      blockedUserId: number;
      createdAt: string;
      blockedName?: string;
      blockedUsername?: string;
    }>
  >(`/api/users/${userId}/blocks`);
}

export async function fetchProfileCard(userId: number) {
  return request<{
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
  }>(`/api/users/${userId}/profile-card`);
}

export async function setSilentChatRequests(userId: number, enabled: boolean) {
  return request<User>(`/api/users/${userId}/silent-chat`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteUserAccountById(userId: number) {
  return request<{ ok: true }>(`/api/users/${userId}`, { method: 'DELETE' });
}

export async function endPlaydateChat(
  playdateId: number,
  userId: number
): Promise<{ ok: true; playdate: PlaydateRequest }> {
  return request(`/api/playdate-requests/${playdateId}/end-chat`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function setPlaydateChatSecure(
  playdateId: number,
  userId: number,
  secure: boolean
): Promise<PlaydateRequest> {
  return request(`/api/playdate-requests/${playdateId}/chat-secure`, {
    method: 'PATCH',
    body: JSON.stringify({ userId, secure }),
  });
}

export function playdateChatMediaUrl(
  playdateId: number,
  messageId: number,
  userId: number
): string {
  return `${API_BASE}/api/playdate-requests/${playdateId}/messages/${messageId}/file?userId=${userId}`;
}

export type WebOtpChannel = 'phone' | 'email';

export async function requestWebOtp(channel: WebOtpChannel, target: string) {
  return request<{
    ok: true;
    channel: WebOtpChannel;
    target: string;
    expiresAt: string;
    devCode?: string;
  }>('/api/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ channel, target }),
  });
}

export async function verifyWebOtp(
  channel: WebOtpChannel,
  target: string,
  code: string
) {
  return request<{ ok: true; token: string; user: User }>('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ channel, target, code }),
  });
}

/**
 * In-flight + short TTL coalesce for auth GETs.
 * Survives React remounts / accidental effect re-fires that used to storm
 * /api/auth/me + /api/auth/wallet (wallet page layout jump).
 */
const AUTH_GET_TTL_MS = 2500;
const authGetInflight = new Map<string, Promise<unknown>>();
const authGetCache = new Map<string, { at: number; value: unknown }>();

function authGetKey(path: string, token: string) {
  return `${path}::${token}`;
}

async function coalescedAuthGet<T>(path: string, token: string): Promise<T> {
  const key = authGetKey(path, token);
  const cached = authGetCache.get(key);
  if (cached && Date.now() - cached.at < AUTH_GET_TTL_MS) {
    return cached.value as T;
  }
  const pending = authGetInflight.get(key);
  if (pending) return pending as Promise<T>;

  const req = request<T>(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((value) => {
      authGetCache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      authGetInflight.delete(key);
    });

  authGetInflight.set(key, req);
  return req;
}

/** Drop coalesced auth GET cache (after logout / wallet mutation). */
export function invalidateAuthGetCache(token?: string) {
  if (!token) {
    authGetInflight.clear();
    authGetCache.clear();
    return;
  }
  for (const key of [...authGetInflight.keys()]) {
    if (key.endsWith(`::${token}`)) authGetInflight.delete(key);
  }
  for (const key of [...authGetCache.keys()]) {
    if (key.endsWith(`::${token}`)) authGetCache.delete(key);
  }
}

export async function fetchMe(token: string) {
  return coalescedAuthGet<{ ok: true; user: User }>('/api/auth/me', token);
}

export async function fetchWallet(token: string) {
  return coalescedAuthGet<{
    ok: true;
    wallet: {
      ton: number;
      stars: number;
      coins: number;
      toman: number;
    };
    coins: number;
    telegram?: {
      linked: boolean;
      telegramId: string | null;
      username: string | null;
    };
    telegramStars?: {
      linked: boolean;
      petdateBalance?: number;
      walletStars: number;
      topUpDeepLink: string | null;
    };
  }>('/api/auth/wallet', token);
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
  token: string,
  opts?: { limit?: number; offset?: number }
) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.offset != null) q.set('offset', String(opts.offset));
  const suffix = q.toString() ? `?${q}` : '';
  return request<{ ok: true; transactions: WalletTransactionDto[] }>(
    `/api/auth/wallet/transactions${suffix}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export type CoinPackageDto = {
  id: string; coins: number; toman: number; stars: number; vip?: boolean; label: string;
};
export type WalletPaymentOrderDto = {
  id: number; publicId?: string; packageId: string; coins: number; amountToman?: number;
  method: string; status: string; receiptUrl?: string; transferRef?: string;
  createdAt: string; reviewedAt?: string;
};
export async function fetchBuyCoinsCatalog(token: string) {
  return request<{ ok: true; packages: CoinPackageDto[]; card: { number: string; masked: string; grouped: string; holder: string }; openOrders: WalletPaymentOrderDto[]; message?: string }>(
    '/api/auth/wallet/buy-coins', { headers: { Authorization: `Bearer ${token}` } }
  );
}
export async function createCoinCardPayment(token: string, packageId: string) {
  return request<{ ok: true; order: WalletPaymentOrderDto; package: CoinPackageDto; card: { number: string; masked: string; grouped: string; holder: string }; message?: string }>(
    '/api/auth/wallet/buy-coins/card', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ packageId }) }
  );
}
export async function fetchMyWalletPayments(token: string, opts?: { limit?: number; method?: string }) {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set('limit', String(opts.limit));
  if (opts?.method) q.set('method', opts.method);
  const suffix = q.toString() ? `?${q}` : '';
  return request<{ ok: true; orders: WalletPaymentOrderDto[] }>(`/api/auth/wallet/payments${suffix}`, { headers: { Authorization: `Bearer ${token}` } });
}
export async function uploadWalletPaymentReceipt(token: string, orderId: number, file: File, transferRef?: string) {
  const form = new FormData(); form.append('file', file);
  if (transferRef?.trim()) form.append('transferRef', transferRef.trim());
  const res = await fetch(`${API_BASE}/api/auth/wallet/payments/${orderId}/receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const body = await res.text();
  const json = JSON.parse(body) as { ok?: boolean; order?: WalletPaymentOrderDto; error?: string };
  if (!res.ok || !json.ok || !json.order) throw new Error(json.error || body || `خطای ${res.status}`);
  return json.order;
}

export type EarnRequestSummary = {
  id: number;
  coins: number;
  rateToman: number;
  amountToman: number;
  cardMasked: string;
  status: 'open' | 'paid' | 'rejected' | 'cancelled';
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
};

export type EarnStatusResponse = {
  ok: true;
  coins: number;
  wallet: { ton: number; stars: number; coins: number; toman: number };
  rateToman: number;
  minCoins: number;
  estimatedToman: number;
  hasOpenRequest: boolean;
  openRequest: EarnRequestSummary | null;
  canSell: boolean;
  method: 'card';
  methodLabelFa: string;
  requests: EarnRequestSummary[];
};

export async function fetchEarnStatus(token: string) {
  return request<EarnStatusResponse>('/api/auth/earn', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function submitEarnWithdraw(
  token: string,
  data: { coins: number; cardNumber: string }
) {
  return request<{
    ok: true;
    requestId: number;
    amountToman: number;
    rateToman: number;
    coins: number;
    user: User;
    wallet?: { ton: number; stars: number; coins: number; toman: number };
    openRequest: EarnRequestSummary | null;
  }>('/api/auth/earn/withdraw', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/** Bot-signed deep link → web session (same users row). */
export async function exchangeTelegramWebLink(input: {
  telegramId: string;
  exp: string;
  sig: string;
}) {
  return request<{ ok: true; token: string; user: User }>('/api/auth/telegram/exchange', {
    method: 'POST',
    body: JSON.stringify({
      telegramId: input.telegramId,
      exp: input.exp,
      sig: input.sig,
    }),
  });
}

/** Mobile same-browser Telegram login: create pending + bot deep link. */
export async function startTelegramPendingLogin(next?: string | null) {
  return request<{
    ok: true;
    id: string;
    deepLink: string;
    botUsername: string;
    expiresAt: string;
    next: string;
  }>('/api/auth/telegram/login-start', {
    method: 'POST',
    body: JSON.stringify(next ? { next } : {}),
  });
}

/** Poll pending Telegram login until ready (token consumed once). */
export async function pollTelegramPendingLogin(id: string) {
  return request<{
    ok: true;
    status: 'pending' | 'ready' | 'expired' | 'consumed' | 'missing';
    token?: string;
    user?: User;
    next?: string;
    expiresAt?: string;
    error?: string;
  }>(`/api/auth/telegram/login-status/${encodeURIComponent(id)}`);
}

/** True when we should keep the browser tab and poll (mobile / touch). */
export function prefersSameBrowserTelegramLogin(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    const ua = navigator.userAgent || '';
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    return coarse || narrow || mobileUa;
  } catch {
    return true;
  }
}

/** Logged-in web user: one-time bot deep link to attach Telegram. */
export async function startTelegramAttach(token: string) {
  return request<{
    ok: true;
    token: string;
    deepLink: string;
    botUsername: string;
    expiresAt: string;
    alreadyLinked: boolean;
    telegramId?: string;
  }>('/api/auth/telegram/link-start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function logoutWebSession(token: string) {
  return request<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function patchWebProfile(token: string, patch: Record<string, unknown>) {
  return request<{ ok: true; user: User }>('/api/auth/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
}

/** Upload user profile avatar; returns public URL under /api/auth/avatar/... and updated user. */
export async function uploadUserAvatar(
  token: string,
  file: File
): Promise<{ ok: true; url: string; storageKey: string; mimeType?: string; user: User }> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: string; message?: string };
      throw new Error(json.error || json.message || body || `خطای ${res.status}`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{') && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json();
}

export async function patchWebRoles(token: string, roles: UserRole[], primary?: UserRole) {
  return request<{ ok: true; user: User }>('/api/auth/roles', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(primary ? { roles, role: primary } : { roles }),
  });
}

/** سوییچ نقش فعال بدون حذف بقیه نقش‌ها */
export async function patchWebPrimaryRole(token: string, role: UserRole) {
  return request<{ ok: true; user: User }>('/api/auth/roles', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role, primaryOnly: true }),
  });
}

/** آنلاین/آفلاین دامپزشک (وب — هم‌تراز ربات) */
export async function patchWebVetOnline(token: string, online: boolean) {
  return request<{ ok: true; user: User }>('/api/auth/vet-online', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ online }),
  });
}

export async function patchWebProviderOnline(
  token: string,
  kind: 'trainer' | 'sitter',
  online: boolean
) {
  return request<{ ok: true; user: User }>('/api/auth/provider-online', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, online }),
  });
}

/** آپلود مدرک مربی / پرستار از وب (بعد از آپلود: pending تا تأیید ادمین) */
export async function uploadProviderCredential(
  token: string,
  kind: 'trainer' | 'sitter',
  file: File
): Promise<{ ok: true; url: string; user: User }> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/auth/provider-credential`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: string };
      throw new Error(json.error || body || `خطای ${res.status}`);
    } catch (err) {
      if (err instanceof Error && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json() as Promise<{ ok: true; url: string; user: User }>;
}

export async function patchWebAcceptSeekerAdvice(token: string, accept: boolean) {
  return request<{ ok: true; user: User }>('/api/auth/accept-seeker-advice', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accept }),
  });
}

/** مبلغ ویزیت دامپزشک (وب — هم‌تراز ربات) */
export async function patchWebVisitFee(token: string, visitFeeCoins: number) {
  return request<{ ok: true; user: User }>('/api/auth/visit-fee', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ visitFeeCoins }),
  });
}

/** دامپزشک‌های آنلاین آماده پذیرش (+ مبلغ ویزیت) */
export async function listOnlineVets(): Promise<User[]> {
  return request<User[]>('/api/users/vets/online');
}

/** مربی / پرستار آنلاین تأییدشده برای درخواست سریع */
export async function listOnlineProviders(
  kind: 'trainer' | 'sitter'
): Promise<User[]> {
  return request<User[]>(`/api/users/providers/online?kind=${encodeURIComponent(kind)}`);
}

export type QuickVetConnectResult = {
  ok: true;
  sent: number;
  cost: number;
  coins: number;
  consultations: VetConsultation[];
  message: string;
  aiFallback?: boolean;
  advice?: string;
  adviceSource?: 'llm' | 'offline';
  serviceKind?: string;
};

export async function quickVetConnect(
  patientUserId: number,
  token?: string | null,
  opts?: {
    confirmResend?: boolean;
    kind?: 'vet' | 'trainer' | 'sitter' | 'seeker_advice';
  }
): Promise<QuickVetConnectResult> {
  return request<QuickVetConnectResult>('/api/consultations/quick-connect', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({
      patientUserId,
      confirmResend: Boolean(opts?.confirmResend),
      kind: opts?.kind ?? 'vet',
    }),
  });
}

export async function listVetConsultations(filters: {
  patientUserId?: number;
  vetUserId?: number;
  status?: VetConsultStatus;
  kind?: string;
}): Promise<VetConsultation[]> {
  const params = new URLSearchParams();
  if (filters.patientUserId) params.set('patientUserId', String(filters.patientUserId));
  if (filters.vetUserId) params.set('vetUserId', String(filters.vetUserId));
  if (filters.status) params.set('status', filters.status);
  if (filters.kind) params.set('kind', filters.kind);
  const qs = params.toString();
  return request<VetConsultation[]>(`/api/consultations${qs ? `?${qs}` : ''}`);
}

export async function getVetConsultation(consultId: number): Promise<VetConsultation> {
  return request<VetConsultation>(`/api/consultations/${consultId}`);
}

export async function acceptVetConsultation(
  consultId: number,
  token?: string | null
): Promise<VetConsultation> {
  return request<VetConsultation>(`/api/consultations/${consultId}/accept`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function rejectVetConsultation(
  consultId: number,
  token?: string | null
): Promise<VetConsultation> {
  return request<VetConsultation>(`/api/consultations/${consultId}/reject`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function listVetConsultChatMessages(
  consultId: number,
  opts?: { afterId?: number; token?: string | null }
): Promise<VetConsultChatMessage[]> {
  const params = new URLSearchParams();
  if (opts?.afterId != null) params.set('afterId', String(opts.afterId));
  const qs = params.toString();
  return request<VetConsultChatMessage[]>(
    `/api/consultations/${consultId}/messages${qs ? `?${qs}` : ''}`,
    {
      headers: opts?.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
    }
  );
}

export async function postVetConsultChatMessage(
  consultId: number,
  text: string,
  token?: string | null
): Promise<VetConsultChatMessage> {
  return request<VetConsultChatMessage>(`/api/consultations/${consultId}/messages`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ text }),
  });
}

/** Upload a vet consult chat attachment (photo / video / audio / document). */
export async function uploadVetConsultChatFile(
  consultId: number,
  senderUserId: number,
  file: File,
  caption = '',
  token?: string | null
): Promise<VetConsultChatMessage> {
  const form = new FormData();
  form.append('file', file);
  form.append('senderUserId', String(senderUserId));
  if (caption.trim()) form.append('caption', caption.trim());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/consultations/${consultId}/messages/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  if (!res.ok) {
    const body = await res.text();
    try {
      const json = JSON.parse(body) as { error?: string; message?: string };
      throw new Error(json.error || json.message || body || `خطای ${res.status}`);
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('{') && err.message !== body) throw err;
      throw new Error(body || `خطای ${res.status}`);
    }
  }
  return res.json() as Promise<VetConsultChatMessage>;
}

export async function clearVetConsultChatMessages(
  consultId: number,
  userId: number,
  token?: string | null
): Promise<{ ok: true; cleared: number }> {
  return request(`/api/consultations/${consultId}/messages?userId=${userId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function endVetConsultChat(
  consultId: number,
  userId: number,
  token?: string | null
): Promise<{ ok: true; consultation: VetConsultation }> {
  return request(`/api/consultations/${consultId}/end-chat`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ userId }),
  });
}

export async function setVetConsultChatSecure(
  consultId: number,
  userId: number,
  secure: boolean,
  token?: string | null
): Promise<VetConsultation> {
  return request(`/api/consultations/${consultId}/chat-secure`, {
    method: 'PATCH',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ userId, secure }),
  });
}

export function vetConsultChatMediaUrl(
  consultId: number,
  messageId: number,
  userId: number
): string {
  return `${API_BASE}/api/consultations/${consultId}/messages/${messageId}/media?userId=${userId}`;
}

export type CreatePrescriptionResponse = {
  prescription: Prescription;
  pdfPath: string;
  pdfUrl: string;
  /** Relative public PDF path e.g. /rx/12/pdf */
  pdfPathPublic?: string;
  /** Absolute HTTPS PDF download URL under petdate.ir */
  pdfPublicUrl?: string;
  webPath?: string;
  webUrl?: string;
  /** Persisted consult chat message that carries the PDF (web thread). */
  chatMessage?: VetConsultChatMessage | null;
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

/** صدور نسخه در مشاوره فعال (هم‌تراز ربات) */
export async function createConsultationPrescription(
  consultId: number,
  data: { vetUserId: number; petId: number; text: string },
  token?: string | null
): Promise<CreatePrescriptionResponse> {
  return request<CreatePrescriptionResponse>(`/api/consultations/${consultId}/prescription`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(data),
  });
}

export function prescriptionPdfUrl(prescriptionId: number): string {
  return `/rx/${prescriptionId}/pdf`;
}

export function prescriptionWebPath(prescriptionId: number): string {
  return `/rx/${prescriptionId}`;
}

export async function getPetMedical(
  petId: number,
  viewerId: number
): Promise<{ record: PetMedicalRecord; entries: PetMedicalEntry[]; pet: PetProfile }> {
  return request(`/api/pets/${petId}/medical-record?viewerId=${viewerId}`);
}

export async function addPetMedicalEntry(
  petId: number,
  data: {
    authorUserId: number;
    authorName?: string;
    consultId?: number;
    text: string;
  },
  token?: string | null
): Promise<PetMedicalEntry> {
  return request<PetMedicalEntry>(`/api/pets/${petId}/medical-entries`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(data),
  });
}

export async function heartbeatPresence(userId: number): Promise<UserPresence> {
  return request<UserPresence>(`/api/users/${userId}/presence`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getUserPresence(userId: number): Promise<UserPresence> {
  return request<UserPresence>(`/api/users/${userId}/presence`);
}

export async function getUsersPresence(ids: number[]): Promise<UserPresence[]> {
  const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return [];
  return request<UserPresence[]>(`/api/presence?ids=${unique.join(',')}`);
}

export function telegramBotDeepLink(path = ''): string {
  const username =
    (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.replace(/^@/, '') ||
    'Petdatebot';
  const clean = path.replace(/^\//, '');
  return clean
    ? `https://t.me/${username}?start=${encodeURIComponent(clean)}`
    : `https://t.me/${username}`;
}

const SAFE_WEB_LOGIN_NEXT = /^\/(?!\/)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;

function sanitizeTelegramLoginNext(raw: string | null | undefined, fallback = '/home'): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.startsWith('/auth') || value.startsWith('/welcome')) return fallback;
  if (value === '/') return '/home';
  if (!SAFE_WEB_LOGIN_NEXT.test(value)) return fallback;
  return value;
}

function toBase64UrlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Deep link that opens the bot; bot replies with a signed `/auth/telegram` URL
 * (HMAC) so the user returns logged-in on the same users row.
 * Start payload: `weblogin` or `weblogin_<base64url(next)>` (≤64 chars).
 */
export function telegramWebLoginDeepLink(next?: string | null): string {
  const safeNext = sanitizeTelegramLoginNext(next, '/home');
  if (safeNext === '/home') return telegramBotDeepLink('weblogin');
  const encoded = toBase64UrlUtf8(safeNext);
  const payload = `weblogin_${encoded}`;
  if (payload.length > 64) return telegramBotDeepLink('weblogin');
  return telegramBotDeepLink(payload);
}

export type ShopCoinCheckoutItem = { productId: string; qty: number };

export type ShopCoinCheckoutResult = {
  ok: true;
  orderId: number;
  order: {
    id: number;
    status: string;
    totalToman: number;
    paymentCurrency?: string;
    paymentAmount?: number;
  };
  coinsSpent: number;
  coinsRemaining: number;
  totalToman: number;
  message: string;
  wallet?: { ton: number; stars: number; coins: number; toman: number };
  coins?: number;
};

export type ShopStarsCheckoutResult = {
  ok: true;
  paymentOrderId: number;
  stars: number;
  starsNeeded: number;
  totalToman: number;
  titleHint?: string;
  botDeepLink: string;
  webSuccessUrl?: string;
  receiptToken?: string;
  requiresTelegramStars: true;
  message?: string;
};

export type ShopWalletStarsCheckoutResult = {
  ok: true;
  orderId: number;
  order: {
    id: number;
    status: string;
    totalToman: number;
    paymentCurrency?: string;
    paymentAmount?: number;
  };
  starsSpent: number;
  starsRemaining: number;
  totalToman: number;
  message: string;
  wallet?: { ton: number; stars: number; coins: number; toman: number };
};

export type ShopStarsPaymentStatus = {
  ok: true;
  paymentOrderId: number;
  status: string;
  stars: number;
  totalToman: number;
  titleHint?: string;
  shopOrderId?: number;
  chargeId?: string;
  paidAt?: string;
  botDeepLink: string;
  webSuccessUrl: string;
  paid: boolean;
};

export async function fetchShopStarsPaymentStatus(
  token: string | null | undefined,
  paymentOrderId: number,
  receiptToken?: string | null
): Promise<ShopStarsPaymentStatus> {
  const qs = receiptToken ? `?t=${encodeURIComponent(receiptToken)}` : '';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/shop/checkout/stars-status/${paymentOrderId}${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد.');
  }
  const json = (await res.json()) as ShopStarsPaymentStatus & { error?: string; ok?: boolean };
  if (!res.ok || json.ok !== true) {
    throw new Error(json.error || `خطای ${res.status}`);
  }
  return json;
}

export type MyShopOrder = {
  id: number;
  status: string;
  totalToman: number;
  paymentCurrency?: string;
  paymentAmount?: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items: unknown[];
  createdAt: string;
  updatedAt?: string;
};

export async function fetchMyShopOrders(token: string): Promise<{
  ok: true;
  total: number;
  orders: MyShopOrder[];
  statusLabelsFa?: Record<string, string>;
}> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/shop/my-orders?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد.');
  }
  const json = (await res.json()) as {
    ok?: boolean;
    total?: number;
    orders?: MyShopOrder[];
    statusLabelsFa?: Record<string, string>;
    error?: string;
  };
  if (!res.ok || json.ok !== true) {
    throw new Error(json.error || `خطای ${res.status}`);
  }
  return {
    ok: true,
    total: json.total ?? json.orders?.length ?? 0,
    orders: json.orders ?? [],
    statusLabelsFa: json.statusLabelsFa,
  };
}

async function postShopCheckout<T extends { ok?: boolean; error?: string }>(
  path: string,
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('اتصال به سرور برقرار نشد. مطمئن شو API روشن است.');
  }
  const body = await res.text();
  let json: (T & { error?: string; ok?: boolean }) | null = null;
  try {
    json = JSON.parse(body) as T & { error?: string; ok?: boolean };
  } catch {
    throw new Error(body || `خطای ${res.status}`);
  }
  if (!json || json.ok !== true) {
    throw new Error(json?.error || body || `خطای ${res.status}`);
  }
  return json;
}

export async function checkoutShopWithCoins(
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<ShopCoinCheckoutResult> {
  return postShopCheckout<ShopCoinCheckoutResult>('/api/shop/checkout/coins', token, payload);
}

/** فاکتور Telegram Stars (XTR → ربات) */
export async function checkoutShopWithStars(
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<ShopStarsCheckoutResult> {
  return postShopCheckout<ShopStarsCheckoutResult>('/api/shop/checkout/stars', token, payload);
}

/** کسر ستاره پنل پت‌دیت (wallet_stars) */
export async function checkoutShopWithWalletStars(
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<ShopWalletStarsCheckoutResult> {
  return postShopCheckout<ShopWalletStarsCheckoutResult>('/api/shop/checkout/wallet-stars', token, payload);
}

export type ShopTomanCheckoutResult = {
  ok: true;
  orderId: number;
  tomanSpent: number;
  tomanRemaining: number;
  totalToman: number;
  message?: string;
};

export type ShopCardCheckoutResult = {
  ok: true;
  paymentOrderId: number;
  totalToman: number;
  botDeepLink: string;
  webSuccessUrl?: string;
  cardNumber: string;
  cardHolder: string;
  receiptToken?: string;
  message?: string;
};

export type ShopCardPaymentStatus = {
  ok: true;
  paid: boolean;
  status: string;
  totalToman: number;
  shopOrderId?: number;
  botDeepLink: string;
  cardNumber: string;
  cardMasked?: string;
  cardGrouped?: string;
  cardHolder: string;
  transferRef?: string;
  receiptUrl?: string;
  paidAt?: string;
};

/** پرداخت با تومان پنل */
export async function checkoutShopWithToman(
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<ShopTomanCheckoutResult> {
  return postShopCheckout<ShopTomanCheckoutResult>('/api/shop/checkout/toman', token, payload);
}

/** کارت‌به‌کارت شاپ */
export async function checkoutShopWithCard(
  token: string,
  payload: {
    items: ShopCoinCheckoutItem[];
    customerName: string;
    customerPhone: string;
    address: string;
    note?: string;
  }
): Promise<ShopCardCheckoutResult> {
  return postShopCheckout<ShopCardCheckoutResult>('/api/shop/checkout/card', token, payload);
}

export async function fetchShopCardPaymentStatus(
  token: string | null | undefined,
  paymentOrderId: number,
  receiptToken?: string
): Promise<ShopCardPaymentStatus> {
  const qs = receiptToken ? `?t=${encodeURIComponent(receiptToken)}` : '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/shop/checkout/card-status/${paymentOrderId}${qs}`, {
    headers,
  });
  const body = await res.text();
  let json: ShopCardPaymentStatus & { error?: string; ok?: boolean };
  try {
    json = JSON.parse(body) as ShopCardPaymentStatus & { error?: string; ok?: boolean };
  } catch {
    throw new Error(body || `خطای ${res.status}`);
  }
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || body || `خطای ${res.status}`);
  }
  return json;
}

export async function uploadShopCardReceipt(
  token: string,
  paymentOrderId: number,
  file: File,
  opts?: { transferRef?: string; receiptToken?: string }
) {
  const form = new FormData();
  form.append('file', file);
  if (opts?.transferRef?.trim()) form.append('transferRef', opts.transferRef.trim());
  if (opts?.receiptToken) form.append('receiptToken', opts.receiptToken);
  const res = await fetch(`${API_BASE}/api/shop/checkout/card-receipt/${paymentOrderId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await res.text();
  const json = JSON.parse(body) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || body || `خطای ${res.status}`);
  return json;
}

export type PublicShopProduct = {
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

export type PublicShopCategory = {
  slug: string;
  labelFa: string;
  petType: string;
  description: string;
  emoji: string;
  sortOrder?: number;
};

/** Public shop catalog from API/DB — same source the Telegram bot uses. */
export async function fetchPublicShopCatalog(): Promise<{
  products: PublicShopProduct[];
  categories: PublicShopCategory[];
  coinPriceToman?: number;
}> {
  const [productsRes, categoriesRes] = await Promise.all([
    request<{
      ok?: boolean;
      products: PublicShopProduct[];
      coinPriceToman?: number;
    }>('/api/shop/products?limit=300'),
    request<{
      ok?: boolean;
      categories: PublicShopCategory[];
      coinPriceToman?: number;
    }>('/api/shop/categories'),
  ]);
  return {
    products: productsRes.products ?? [],
    categories: categoriesRes.categories ?? [],
    coinPriceToman: productsRes.coinPriceToman ?? categoriesRes.coinPriceToman,
  };
}


export type SupportChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
};

export async function fetchSupportMessages(
  token: string
): Promise<{ ok: true; messages: SupportChatMessage[]; welcome: string | null }> {
  return request('/api/support/messages', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendSupportMessage(
  token: string,
  text: string
): Promise<{
  ok: true;
  messages: SupportChatMessage[];
  userMessage: SupportChatMessage;
  assistantMessage: SupportChatMessage;
  adviceSource?: 'llm' | 'offline';
}> {
  return request('/api/support/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
}
