/** Shared admin API client — password from session (verified against ADMIN_PASSWORD / accounts). */

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export { API_BASE };
const PWD_KEY = 'petdate_admin_pwd';
const USER_KEY = 'petdate_admin_user';

export function getAdminPassword(): string {
  return sessionStorage.getItem(PWD_KEY) || '';
}

export function setAdminPassword(password: string) {
  sessionStorage.setItem(PWD_KEY, password);
}

export function clearAdminPassword() {
  sessionStorage.removeItem(PWD_KEY);
}

export function getAdminUsername(): string {
  return sessionStorage.getItem(USER_KEY) || '';
}

export function setAdminUsername(username: string) {
  sessionStorage.setItem(USER_KEY, username);
}

export function clearAdminUsername() {
  sessionStorage.removeItem(USER_KEY);
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const pwd = getAdminPassword();
  if (pwd) headers.set('x-admin-password', pwd);
  const user = getAdminUsername();
  if (user) headers.set('x-admin-username', user);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      try { msg = (await res.text()) || msg; } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Download admin CSV/binary with header auth (never put password in query string). */
export async function adminDownload(path: string, filename: string): Promise<void> {
  const headers = new Headers();
  const pwd = getAdminPassword();
  if (pwd) headers.set('x-admin-password', pwd);
  const user = getAdminUsername();
  if (user) headers.set('x-admin-username', user);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function formatTomanFa(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(Math.round(n)) + ' تومان';
}

export function formatNumFa(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}
