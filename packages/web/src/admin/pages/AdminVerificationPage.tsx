import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, RefreshCw } from 'lucide-react';
import type { User } from '@petdate/shared';
import { FACE_VERIFY_REWARD, VERIFIED_BADGE, formatFaInt, userPublicIdOf } from '@petdate/shared';
import { API_BASE, adminFetch } from '../api';

async function fetchPending(): Promise<User[]> {
  return adminFetch<User[]>('/api/users/verification/pending');
}

async function approve(id: number): Promise<void> {
  await adminFetch(`/api/users/${id}/verification/approve`, {
    method: 'POST',
    body: JSON.stringify({ rewardCoins: FACE_VERIFY_REWARD }),
  });
}

async function reject(id: number, note?: string): Promise<void> {
  await adminFetch(`/api/users/${id}/verification/reject`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export function AdminVerificationPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchPending());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onApprove = async (id: number) => {
    setBusyId(id);
    try {
      await approve(id);
      setItems((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (id: number) => {
    const note = window.prompt('علت ❌ رد (اختیاری):') ?? undefined;
    setBusyId(id);
    try {
      await reject(id, note?.trim() || undefined);
      setItems((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>
            <BadgeCheck size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            احراز هویت
          </h1>
          <p>
            صف بررسی سلفی احراز — پس از تأیید، {VERIFIED_BADGE} و{' '}
            {formatFaInt(FACE_VERIFY_REWARD)} سکه جایزه
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          🔄 بروزرسانی
        </button>
      </header>

      {error && <p className="muted" style={{ color: '#b91c1c' }}>{error}</p>}
      {loading && <p className="muted">در حال بارگذاری…</p>}

      {!loading && items.length === 0 && (
        <div className="admin-card">
          <p className="muted">صف احراز خالی است.</p>
        </div>
      )}

      <div className="admin-grid admin-grid--users">
        {items.map((user) => (
          <article key={user.id} className="admin-user-card">
            <div className="admin-user-head">
              <h3>{user.name}</h3>
              <span className="admin-badge">{user.city || '—'}</span>
            </div>
            <p className="muted">
              <code dir="ltr">{userPublicIdOf(user)}</code>
              {user.telegramId ? ` · tg ${user.telegramId}` : ''}
              {user.username ? ` · @${user.username}` : ''}
            </p>
            {(user.verificationPhotoFileId || user.avatarUrl) && (() => {
              const raw = String(user.verificationPhotoFileId || user.avatarUrl || '').trim();
              const src = /^https?:\/\//i.test(raw)
                ? raw
                : raw.startsWith('/')
                  ? `${API_BASE}${raw}`
                  : `${API_BASE}/api/media/telegram/${encodeURIComponent(raw)}`;
              return (
                <div style={{ marginTop: 10 }}>
                  <a href={src} target="_blank" rel="noreferrer">
                    <img
                      src={src}
                      alt={`احراز ${user.name}`}
                      style={{
                        maxWidth: 220,
                        maxHeight: 280,
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.08)',
                        display: 'block',
                      }}
                    />
                  </a>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busyId === user.id}
                onClick={() => void onApprove(user.id)}
              >
                ✅ تأیید (+{formatFaInt(FACE_VERIFY_REWARD)} سکه)
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={busyId === user.id}
                onClick={() => void onReject(user.id)}
              >
                ❌ رد
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
