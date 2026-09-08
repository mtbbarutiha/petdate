import { useSyncExternalStore } from 'react';
import { authStore } from '../data/authStore';

/**
 * Stable action refs — NEVER .bind() inside the hook body.
 * Binding on every render creates new function identities that re-fire
 * useEffect deps (AuthGuard, WalletPage loadWallet loops → API storms).
 */
const authActions = {
  requestOtp: authStore.requestOtp.bind(authStore),
  verifyOtp: authStore.verifyOtp.bind(authStore),
  acceptSession: authStore.acceptSession.bind(authStore),
  refreshMe: authStore.refreshMe.bind(authStore),
  saveProfile: authStore.saveProfile.bind(authStore),
  uploadAvatar: authStore.uploadAvatar.bind(authStore),
  saveRoles: authStore.saveRoles.bind(authStore),
  setPrimaryRole: authStore.setPrimaryRole.bind(authStore),
  setVetOnline: authStore.setVetOnline.bind(authStore),
  setVisitFee: authStore.setVisitFee.bind(authStore),
  logout: authStore.logout.bind(authStore),
  setPending: authStore.setPending.bind(authStore),
  clearPending: authStore.clearPending.bind(authStore),
} as const;

export function useAuthStore() {
  const state = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot
  );

  return {
    token: state.token,
    user: state.user,
    pendingChannel: state.pendingChannel,
    pendingTarget: state.pendingTarget,
    pendingDevCode: state.pendingDevCode,
    isLoggedIn: authStore.isLoggedIn,
    hasRole: authStore.hasRole,
    isProfileComplete: authStore.isProfileComplete,
    ...authActions,
  };
}
