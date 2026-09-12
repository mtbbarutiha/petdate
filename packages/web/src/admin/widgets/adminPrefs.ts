import { adminFetch } from '../api';

export async function fetchAdminPref<T>(key: string): Promise<T | null> {
  const res = await adminFetch<{ key: string; value: T | null }>(
    `/api/admin/prefs/${encodeURIComponent(key)}`,
  );
  return (res.value ?? null) as T | null;
}

export async function putAdminPref(key: string, value: unknown): Promise<void> {
  await adminFetch(`/api/admin/prefs/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function deleteAdminPref(key: string): Promise<void> {
  await adminFetch(`/api/admin/prefs/${encodeURIComponent(key)}`, { method: 'DELETE' });
}
