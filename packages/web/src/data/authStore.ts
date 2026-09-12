import type { OnboardingStatus, User, UserRole } from '@petdate/shared';
import { isProfileComplete as sharedProfileComplete, normalizeRoles, primaryRole } from '@petdate/shared';
import {
  fetchMe,
  invalidateAuthGetCache,
  logoutWebSession,
  patchWebPrimaryRole,
  patchWebProfile,
  patchWebRoles,
  patchWebVetOnline,
  patchWebVisitFee,
  claimReferral,
  requestWebOtp,
  uploadUserAvatar,
  verifyWebOtp,
  type WebOtpChannel,
} from '../lib/api';
import { clearStoredReferralRef, readStoredReferralRef } from '../lib/referral';
import { userStore } from './userStore';

const STORAGE_KEY = 'petdate_web_auth_v1';

/** Single-flight refreshMe — AuthGuard + pages must not overlap /me calls. */
let refreshMeInflight: Promise<User | null> | null = null;

/**
 * Bumped on local user mutations (vet online, visit fee, …).
 * In-flight refreshMe started before a mutation must not clobber fresher state —
 * that race made the vet online/offline toggle look stuck after AuthGuard /me.
 */
let userMutationSeq = 0;

export interface WebAuthState {
  token?: string;
  user?: User;
  pendingChannel?: WebOtpChannel;
  pendingTarget?: string;
  pendingDevCode?: string;
}

function load(): WebAuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WebAuthState;
  } catch {
    return {};
  }
}

class AuthStore {
  private listeners = new Set<() => void>();
  private data: WebAuthState = load();

  constructor() {
    if (this.data.user) {
      userStore.linkApiUser({
        id: this.data.user.id,
        telegramId: this.data.user.telegramId,
        name: this.data.user.name,
        role: this.data.user.role,
        roles: this.data.user.roles,
        onboarding: this.data.user.onboarding,
      });
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.data;

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    if (this.data.user) {
      userStore.linkApiUser({
        id: this.data.user.id,
        telegramId: this.data.user.telegramId,
        name: this.data.user.name,
        role: this.data.user.role,
        roles: this.data.user.roles,
        onboarding: this.data.user.onboarding,
      });
    }
    this.listeners.forEach((l) => l());
  }

  get isLoggedIn() {
    return Boolean(this.data.token && this.data.user);
  }

  get hasRole() {
    return normalizeRoles(this.data.user?.roles, this.data.user?.role).length > 0;
  }

  get isProfileComplete() {
    const u = this.data.user;
    if (!u) return false;
    if (u.onboarding === 'profile_complete') return true;
    return sharedProfileComplete(u);
  }

  setPending(channel: WebOtpChannel, target: string, devCode?: string) {
    this.data = {
      ...this.data,
      pendingChannel: channel,
      pendingTarget: target,
      pendingDevCode: devCode,
    };
    this.persist();
  }

  /** Merge server user (e.g. after first-pet role upgrade). */
  applyUser(user: User) {
    userMutationSeq += 1;
    this.data = { ...this.data, user };
    this.persist();
    if (this.data.token) invalidateAuthGetCache(this.data.token);
  }

  clearPending() {
    this.data = {
      ...this.data,
      pendingChannel: undefined,
      pendingTarget: undefined,
      pendingDevCode: undefined,
    };
    this.persist();
  }

  async requestOtp(channel: WebOtpChannel, target: string) {
    const result = await requestWebOtp(channel, target);
    this.setPending(channel, result.target, result.devCode);
    return result;
  }

  async verifyOtp(code: string) {
    if (!this.data.pendingChannel || !this.data.pendingTarget) {
      throw new Error('ابتدا شماره یا ایمیل را وارد کن');
    }
    const result = await verifyWebOtp(
      this.data.pendingChannel,
      this.data.pendingTarget,
      code,
      readStoredReferralRef()
    );
    this.data = { token: result.token, user: result.user };
    this.persist();
    await this.claimStoredReferral();
    return this.data.user ?? result.user;
  }

  /** Apply a session from bot-signed Telegram exchange (same users row). */
  acceptSession(token: string, user: User) {
    this.data = { token, user };
    this.persist();
    void this.claimStoredReferral();
  }

  /** Attribute invite after web signup/login if the account is brand-new. */
  async claimStoredReferral() {
    const ref = readStoredReferralRef();
    const token = this.data.token;
    if (ref == null || !token) return;
    try {
      const res = await claimReferral(token, ref);
      if (res.user && this.data.token === token) {
        this.data = { ...this.data, user: res.user };
        this.persist();
      }
      if (res.awarded || res.reason === 'already' || res.reason === 'too_old' || res.reason === 'self') {
        clearStoredReferralRef();
      }
    } catch {
      /* non-fatal — OTP/register path may already have credited */
    }
  }

  async refreshMe() {
    if (!this.data.token) return null;
    if (refreshMeInflight) return refreshMeInflight;
    const startedAt = userMutationSeq;
    refreshMeInflight = (async () => {
      try {
        const me = await fetchMe(this.data.token!);
        // A newer local mutation won the race (e.g. vet online toggle) — keep it.
        if (userMutationSeq !== startedAt) {
          return this.data.user ?? me.user;
        }
        // Skip persist/notify when payload is unchanged — avoids subscriber thrash
        // (WalletChip / guards re-render storms that look like layout jump).
        if (this.data.user && JSON.stringify(this.data.user) === JSON.stringify(me.user)) {
          return me.user;
        }
        this.data = { ...this.data, user: me.user };
        this.persist();
        return me.user;
      } catch (err) {
        const status = (err as Error & { status?: number })?.status;
        // After DB wipe / expired session, never keep a stale user id in localStorage.
        if (status === 401 || status === 403) {
          invalidateAuthGetCache(this.data.token);
          this.data = {};
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
          userStore.reset();
          this.listeners.forEach((l) => l());
          return null;
        }
        throw err;
      } finally {
        refreshMeInflight = null;
      }
    })();
    return refreshMeInflight;
  }

  async saveProfile(patch: Record<string, unknown>) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const res = await patchWebProfile(this.data.token, patch);
    this.data = { ...this.data, user: res.user };
    this.persist();
    return res.user;
  }

  async uploadAvatar(file: File) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const res = await uploadUserAvatar(this.data.token, file);
    this.data = { ...this.data, user: res.user };
    this.persist();
    return res;
  }

  async saveRoles(roles: UserRole[], primary?: UserRole) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const res = await patchWebRoles(this.data.token, roles, primary);
    this.data = { ...this.data, user: res.user };
    this.persist();
    return res.user;
  }

  /** سوییچ نقش فعال بین نقش‌های موجود (بدون حذف بقیه) */
  async setPrimaryRole(role: UserRole) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const res = await patchWebPrimaryRole(this.data.token, role);
    this.data = { ...this.data, user: res.user };
    this.persist();
    return res.user;
  }

  /** آنلاین/آفلاین دامپزشک برای پذیرش بیمار */
  async setVetOnline(online: boolean) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const token = this.data.token;
    const prevUser = this.data.user;
    // Optimistic flip so the segmented control never looks jammed while waiting.
    if (prevUser) {
      userMutationSeq += 1;
      this.data = { ...this.data, user: { ...prevUser, vetOnline: online } };
      this.persist();
    }
    try {
      invalidateAuthGetCache(token);
      const res = await patchWebVetOnline(token, online);
      userMutationSeq += 1;
      // Merge so we keep enriched /me fields the PATCH body may omit.
      const merged: User = {
        ...(prevUser ?? ({} as User)),
        ...res.user,
        vetOnline: Boolean(res.user?.vetOnline ?? online),
      };
      this.data = { ...this.data, user: merged };
      this.persist();
      invalidateAuthGetCache(token);
      return merged;
    } catch (err) {
      if (prevUser) {
        userMutationSeq += 1;
        this.data = { ...this.data, user: prevUser };
        this.persist();
      }
      throw err;
    }
  }

  /** مبلغ ویزیت دامپزشک */
  async setVisitFee(visitFeeCoins: number) {
    if (!this.data.token) throw new Error('وارد نشده‌اید');
    const token = this.data.token;
    invalidateAuthGetCache(token);
    const res = await patchWebVisitFee(token, visitFeeCoins);
    userMutationSeq += 1;
    const prevUser = this.data.user;
    const merged: User = {
      ...(prevUser ?? ({} as User)),
      ...res.user,
      visitFeeCoins: res.user?.visitFeeCoins ?? visitFeeCoins,
    };
    this.data = { ...this.data, user: merged };
    this.persist();
    invalidateAuthGetCache(token);
    return merged;
  }

  setOnboardingLocal(onboarding: OnboardingStatus) {
    if (!this.data.user) return;
    this.data = { ...this.data, user: { ...this.data.user, onboarding } };
    this.persist();
  }

  async logout() {
    const prevToken = this.data.token;
    if (prevToken) {
      try {
        await logoutWebSession(prevToken);
      } catch {
        /* ignore */
      }
    }
    invalidateAuthGetCache(prevToken);
    refreshMeInflight = null;
    this.data = {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    userStore.reset();
    this.listeners.forEach((l) => l());
  }
}

export const authStore = new AuthStore();

export function userPrimaryRole(user?: User | null): UserRole | undefined {
  return primaryRole(user?.roles, user?.role);
}
