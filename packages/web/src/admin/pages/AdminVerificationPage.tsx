import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, RefreshCw } from 'lucide-react';
import type { User } from '@petdate/shared';
import { FACE_VERIFY_REWARD, VERIFIED_BADGE, formatFaInt, userPublicIdOf } from '@petdate/shared';
import { API_BASE, adminFetch, getAdminPassword, getAdminUsername } from '../api';
import { tr } from '../../i18n';

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

function mediaAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const pwd = getAdminPassword();
  if (pwd) headers['x-admin-password'] = pwd;
  const user = getAdminUsername();
  if (user) headers['x-admin-username'] = user;
  return headers;
}

/** True when mime/extension looks like a short KYC video (mp4/webm/mov). */
export function isVerificationVideoRef(raw: string, mime?: string | null): boolean {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(raw || ''));
}

type MediaLoadState =
  | { status: 'loading' }
  | { status: 'image'; url: string }
  | { status: 'video'; url: string }
  | { status: 'error'; message: string };

/**
 * Load face-verify media via authenticated admin endpoint (Bearer/header auth).
 * Same blob-URL pattern as payment receipts — `<img>`/`<video>` cannot send admin headers.
 * Renders `<video controls>` for video submissions, `<img>` for photo-only.
 */
function AdminVerificationMedia({ user }: { user: User }) {
  const [state, setState] = useState<MediaLoadState>({ status: 'loading' });
  const raw = String(user.verificationPhotoFileId || user.avatarUrl || '').trim();

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    if (!raw) {
      setState({ status: 'error', message: tr('فایل احراز ثبت نشده') });
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/${user.id}/verification/media`, {
          headers: mediaAuthHeaders(),
        });
        if (!res.ok) {
          let message = `خطا در دریافت فایل احراز (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j.error) message = j.error;
          } catch {
            /* ignore */
          }
          if (!cancelled) setState({ status: 'error', message });
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = '';
          return;
        }
        const mime = (blob.type || res.headers.get('content-type') || '').toLowerCase();
        if (isVerificationVideoRef(raw, mime)) {
          setState({ status: 'video', url: objectUrl });
        } else {
          setState({ status: 'image', url: objectUrl });
        }
      } catch {
        if (!cancelled) setState({ status: 'error', message: tr('دریافت فایل احراز ناموفق بود') });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user.id, user.verificationPhotoFileId, user.avatarUrl, raw]);

  if (state.status === 'loading') {
    return <p className="muted" style={{ marginTop: 10 }}>{tr('در حال بارگذاری فایل احراز…')}</p>;
  }
  if (state.status === 'error') {
    return (
      <p className="muted" style={{ marginTop: 10, color: '#b91c1c' }}>
        {tr(state.message)}
      </p>
    );
  }
  if (state.status === 'video') {
    return (
      <div className="admin-verification-media" style={{ marginTop: 10 }}>
        <video
          className="admin-verification-video"
          src={state.url}
          controls
          playsInline
          preload="metadata"
          style={{
            maxWidth: 280,
            maxHeight: 360,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'block',
            background: '#0f172a',
          }}
        >
          {tr('مرورگر شما پخش ویدیو را پشتیبانی نمی‌کند.')}
        </video>
        <a
          href={state.url}
          target="_blank"
          rel="noreferrer"
          className="muted"
          style={{ display: 'inline-block', marginTop: 6, fontSize: 13 }}
        >
          {tr('باز کردن ویدیو در تب جدید')}
        </a>
      </div>
    );
  }
  return (
    <div className="admin-verification-media" style={{ marginTop: 10 }}>
      <a href={state.url} target="_blank" rel="noreferrer">
        <img
          src={state.url}
          alt={`${tr('احراز ')}${user.name}`}
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
            {tr('احراز هویت')}
          </h1>
          <p>
            {tr('صف بررسی سلفی احراز — پس از تأیید،')} {VERIFIED_BADGE} {tr('و')}{' '}
            {formatFaInt(FACE_VERIFY_REWARD)} {tr('سکه جایزه')}
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          {tr('🔄 بروزرسانی')}
        </button>
      </header>

      {error && <p className="muted" style={{ color: '#b91c1c' }}>{error}</p>}
      {loading && <p className="muted">{tr('در حال بارگذاری…')}</p>}

      {!loading && items.length === 0 && (
        <div className="admin-card">
          <p className="muted">{tr('صف احراز خالی است.')}</p>
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
            {(user.verificationPhotoFileId || user.avatarUrl) && (
              <AdminVerificationMedia user={user} />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busyId === user.id}
                onClick={() => void onApprove(user.id)}
              >
                {tr('✅ تأیید (+')}{formatFaInt(FACE_VERIFY_REWARD)} {tr('سکه)')}
              </button>
              <button
                type="button"
                className="admin-btn"
                disabled={busyId === user.id}
                onClick={() => void onReject(user.id)}
              >
                {tr('❌ رد')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
