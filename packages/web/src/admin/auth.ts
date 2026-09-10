import {
  clearAdminPassword,
  getAdminPassword,
  setAdminPassword,
  clearAdminUsername,
  setAdminUsername,
  adminFetch,
} from './api';
import type { AdminPermission } from '@petdate/shared';

const AUTH_KEY = 'petdate_admin_auth';
const ROLE_KEY = 'petdate_admin_role';
const PERMS_KEY = 'petdate_admin_perms';
const NAME_KEY = 'petdate_admin_name';

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === '1' && Boolean(getAdminPassword());
}

export function getAdminRole(): string {
  return sessionStorage.getItem(ROLE_KEY) || 'admin';
}

export function getAdminPermissions(): string[] {
  try {
    const raw = sessionStorage.getItem(PERMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function getAdminDisplayName(): string {
  return sessionStorage.getItem(NAME_KEY) || '';
}

export function adminCan(permission: AdminPermission | string): boolean {
  const role = getAdminRole();
  if (role === 'admin') return true;
  const perms = getAdminPermissions();
  return perms.includes('admin.full') || perms.includes(permission);
}

export async function loginAdmin(
  password: string,
  username?: string
): Promise<{ ok: boolean; role?: string }> {
  try {
    setAdminPassword(password);
    if (username?.trim()) setAdminUsername(username.trim());
    else clearAdminUsername();
    const data = await adminFetch<{
      ok: boolean;
      role: string;
      permissions: string[];
      displayName: string;
      username?: string | null;
    }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        password,
        ...(username?.trim() ? { username: username.trim() } : {}),
      }),
    });
    sessionStorage.setItem(AUTH_KEY, '1');
    sessionStorage.setItem(ROLE_KEY, data.role || 'admin');
    sessionStorage.setItem(PERMS_KEY, JSON.stringify(data.permissions || []));
    sessionStorage.setItem(NAME_KEY, data.displayName || '');
    // Only persist username when the operator typed one. Env bootstrap login
    // returns username "admin" which must NOT be sent as x-admin-username
    // (that path looks up admin_accounts and 401s for ADMIN_PASSWORD).
    if (username?.trim()) setAdminUsername(username.trim());
    else clearAdminUsername();
    return { ok: true, role: data.role };
  } catch {
    clearAdminPassword();
    clearAdminUsername();
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(PERMS_KEY);
    sessionStorage.removeItem(NAME_KEY);
    return { ok: false };
  }
}

export function logoutAdmin() {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(PERMS_KEY);
  sessionStorage.removeItem(NAME_KEY);
  clearAdminPassword();
  clearAdminUsername();
}

/** @deprecated kept for older imports */
export const ADMIN_PASSWORD = '';
