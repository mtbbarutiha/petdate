import { useCallback, useEffect, useState } from 'react';
import { API_BASE, adminFetch } from '../api';
import type { User } from '@petdate/shared';

type PetRow = {
  id: number;
  name: string;
  imageUrl?: string;
  ownerName?: string;
  ownerId: number;
};

function looksLikeTelegramFileId(value: string): boolean {
  const v = value.trim();
  if (!v || /^https?:\/\//i.test(v) || v.startsWith('/')) return false;
  if (/^(AgAC|AQAD|BAAC|BQAC|AwAC|CQAC|DQAC)/.test(v)) return true;
  return /^[A-Za-z0-9_-]{24,}$/.test(v);
}

/** Resolve credential storage ref → browser-loadable URL. */
function credentialSrc(fileRef?: string | null): string | null {
  const raw = String(fileRef ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  if (looksLikeTelegramFileId(raw)) {
    return `${API_BASE}/api/media/telegram/${encodeURIComponent(raw)}`;
  }
  return null;
}

function isPdfRef(fileRef?: string | null): boolean {
  return /\.pdf($|\?)/i.test(String(fileRef ?? ''));
}

export function AdminMarketplaceModerationPage() {
  const [tab, setTab] = useState<'vet' | 'trainer' | 'sitter' | 'photos'>('vet');
  const [vets, setVets] = useState<User[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [sitters, setSitters] = useState<User[]>([]);
  const [photos, setPhotos] = useState<PetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [v, t, s, p] = await Promise.all([
        adminFetch<User[]>('/api/users/vet-credentials/pending'),
        adminFetch<User[]>('/api/users/provider-credentials/pending?kind=trainer'),
        adminFetch<User[]>('/api/users/provider-credentials/pending?kind=sitter'),
        adminFetch<PetRow[]>('/api/users/pet-photos/pending'),
      ]);
      setVets(v);
      setTrainers(t);
      setSitters(s);
      setPhotos(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function actVet(id: number, approve: boolean) {
    setBusyId(`vet-${id}`);
    try {
      await adminFetch(`/api/users/${id}/vet-credential/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: '{}',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusyId(null);
    }
  }

  async function actProvider(id: number, kind: 'trainer' | 'sitter', approve: boolean) {
    setBusyId(`${kind}-${id}`);
    try {
      await adminFetch(
        `/api/users/${id}/provider-credential/${approve ? 'approve' : 'reject'}`,
        {
          method: 'POST',
          body: JSON.stringify({ kind }),
        }
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusyId(null);
    }
  }

  async function actPhoto(id: number, approve: boolean) {
    setBusyId(`photo-${id}`);
    try {
      await adminFetch(`/api/users/pets/${id}/photo-moderation`, {
        method: 'POST',
        body: JSON.stringify({ status: approve ? 'approved' : 'rejected' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusyId(null);
    }
  }

  const list =
    tab === 'vet' ? vets : tab === 'trainer' ? trainers : tab === 'sitter' ? sitters : [];

  return (
    <div className="admin-page" dir="rtl">
      <header className="admin-header">
        <div>
          <h1>تأیید مدارک و عکس‌ها</h1>
          <p>صف سریع تأیید مدرک دامپزشک / مربی / پرستار و عکس پت‌ها.</p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          بروزرسانی
        </button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(
          [
            ['vet', `دامپزشک (${vets.length})`],
            ['trainer', `مربی (${trainers.length})`],
            ['sitter', `پرستار (${sitters.length})`],
            ['photos', `عکس پت (${photos.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'admin-btn primary' : 'admin-btn'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'photos' ? (
        <ul className="admin-list">
          {!list.length ? <li>صف خالی است.</li> : null}
          {list.map((u) => {
            const fileRef =
              tab === 'trainer'
                ? u.trainerCredentialFileId
                : tab === 'sitter'
                  ? u.sitterCredentialFileId
                  : u.vetCredentialFileId;
            const src = credentialSrc(fileRef);
            const pdf = isPdfRef(fileRef);
            return (
              <li key={u.id} className="admin-credential-row" style={{ marginBottom: 16 }}>
                <strong>{u.name}</strong> · #{u.id}
                {u.telegramId ? ` · TG ${u.telegramId}` : ''}
                <div className="admin-credential-preview" style={{ marginTop: 8 }}>
                  {src && !pdf ? (
                    <a href={src} target="_blank" rel="noreferrer" title="باز کردن تمام‌صفحه">
                      <img
                        src={src}
                        alt={`مدرک ${u.name}`}
                        style={{
                          display: 'block',
                          maxWidth: 280,
                          maxHeight: 360,
                          width: 'auto',
                          height: 'auto',
                          borderRadius: 10,
                          border: '1px solid rgba(0,0,0,0.08)',
                          background: '#f6f6f8',
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.hidden = false;
                        }}
                      />
                      <span hidden style={{ color: '#b91c1c', fontSize: 13 }}>
                        بارگذاری تصویر ناموفق بود —{' '}
                        <a href={src} target="_blank" rel="noreferrer">
                          لینک مستقیم
                        </a>
                      </span>
                    </a>
                  ) : null}
                  {src && pdf ? (
                    <a href={src} target="_blank" rel="noreferrer" className="admin-btn primary">
                      مشاهده PDF مدرک
                    </a>
                  ) : null}
                  {!src ? (
                    <p className="muted" style={{ margin: 0 }}>
                      فایل مدرک در دسترس نیست.
                    </p>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={busyId != null}
                    onClick={() =>
                      void (tab === 'vet' ? actVet(u.id, true) : actProvider(u.id, tab, true))
                    }
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busyId != null}
                    onClick={() =>
                      void (tab === 'vet' ? actVet(u.id, false) : actProvider(u.id, tab, false))
                    }
                  >
                    رد
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="admin-list">
          {!photos.length ? <li>صف خالی است.</li> : null}
          {photos.map((p) => {
            const src = p.imageUrl
              ? p.imageUrl.startsWith('http')
                ? p.imageUrl
                : p.imageUrl.startsWith('/')
                  ? `${API_BASE}${p.imageUrl}`
                  : credentialSrc(p.imageUrl)
              : null;
            return (
              <li key={p.id} style={{ marginBottom: 12 }}>
                <strong>{p.name}</strong> · پت #{p.id}
                {p.ownerName ? ` · صاحب: ${p.ownerName}` : ''}
                {src ? (
                  <div style={{ marginTop: 6 }}>
                    <a href={src} target="_blank" rel="noreferrer">
                      <img
                        src={src}
                        alt={p.name}
                        style={{ maxWidth: 180, borderRadius: 8 }}
                      />
                    </a>
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    type="button"
                    className="admin-btn primary"
                    disabled={busyId != null}
                    onClick={() => void actPhoto(p.id, true)}
                  >
                    تأیید عکس
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busyId != null}
                    onClick={() => void actPhoto(p.id, false)}
                  >
                    رد
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
