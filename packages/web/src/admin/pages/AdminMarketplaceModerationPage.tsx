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

type CredTab = 'vet' | 'trainer' | 'sitter' | 'photos';
type ViewMode = 'queue' | 'archive';

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

function credentialFileRef(u: User, tab: 'vet' | 'trainer' | 'sitter'): string | undefined {
  if (tab === 'trainer') return u.trainerCredentialFileId;
  if (tab === 'sitter') return u.sitterCredentialFileId;
  return u.vetCredentialFileId;
}

export function AdminMarketplaceModerationPage() {
  const [tab, setTab] = useState<CredTab>('vet');
  const [mode, setMode] = useState<ViewMode>('queue');
  const [pendingVets, setPendingVets] = useState<User[]>([]);
  const [pendingTrainers, setPendingTrainers] = useState<User[]>([]);
  const [pendingSitters, setPendingSitters] = useState<User[]>([]);
  const [archiveVets, setArchiveVets] = useState<User[]>([]);
  const [archiveTrainers, setArchiveTrainers] = useState<User[]>([]);
  const [archiveSitters, setArchiveSitters] = useState<User[]>([]);
  const [photos, setPhotos] = useState<PetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pv, pt, ps, av, at, as, p] = await Promise.all([
        adminFetch<User[]>('/api/users/vet-credentials/pending'),
        adminFetch<User[]>('/api/users/provider-credentials/pending?kind=trainer'),
        adminFetch<User[]>('/api/users/provider-credentials/pending?kind=sitter'),
        adminFetch<User[]>('/api/users/vet-credentials/verified'),
        adminFetch<User[]>('/api/users/provider-credentials/verified?kind=trainer'),
        adminFetch<User[]>('/api/users/provider-credentials/verified?kind=sitter'),
        adminFetch<PetRow[]>('/api/users/pet-photos/pending'),
      ]);
      setPendingVets(pv);
      setPendingTrainers(pt);
      setPendingSitters(ps);
      setArchiveVets(av);
      setArchiveTrainers(at);
      setArchiveSitters(as);
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

  const isArchive = mode === 'archive' && tab !== 'photos';
  const list =
    tab === 'photos'
      ? []
      : tab === 'vet'
        ? isArchive
          ? archiveVets
          : pendingVets
        : tab === 'trainer'
          ? isArchive
            ? archiveTrainers
            : pendingTrainers
          : isArchive
            ? archiveSitters
            : pendingSitters;

  const tabCounts = {
    vet: mode === 'archive' ? archiveVets.length : pendingVets.length,
    trainer: mode === 'archive' ? archiveTrainers.length : pendingTrainers.length,
    sitter: mode === 'archive' ? archiveSitters.length : pendingSitters.length,
    photos: photos.length,
  };

  return (
    <div className="admin-page" dir="rtl">
      <header className="admin-header">
        <div>
          <h1>تأیید مدارک و عکس‌ها</h1>
          <p>
            صف سریع تأیید مدرک دامپزشک / مربی / پرستار و عکس پت‌ها — مدارک تأییدشده در آرشیو
            می‌مانند.
          </p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>
          بروزرسانی
        </button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <div
        className="admin-tabs"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
      >
        {(
          [
            ['queue', 'صف بررسی'],
            ['archive', 'آرشیو تأییدشده'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? 'admin-btn primary' : 'admin-btn'}
            onClick={() => {
              setMode(key);
              if (key === 'archive' && tab === 'photos') setTab('vet');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="admin-tabs"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
      >
        {(
          [
            ['vet', `دامپزشک (${tabCounts.vet})`],
            ['trainer', `مربی (${tabCounts.trainer})`],
            ['sitter', `پرستار (${tabCounts.sitter})`],
            ...(mode === 'queue' ? ([['photos', `عکس پت (${tabCounts.photos})`]] as const) : []),
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
          {!list.length ? (
            <li>{isArchive ? 'آرشیو خالی است.' : 'صف خالی است.'}</li>
          ) : null}
          {list.map((u) => {
            const fileRef = credentialFileRef(u, tab);
            const src = credentialSrc(fileRef);
            const pdf = isPdfRef(fileRef);
            return (
              <li key={u.id} className="admin-credential-row" style={{ marginBottom: 16 }}>
                <strong>{u.name}</strong> · #{u.id}
                {u.telegramId ? ` · TG ${u.telegramId}` : ''}
                {isArchive ? (
                  <span
                    style={{
                      marginInlineStart: 8,
                      fontSize: 12,
                      color: '#166534',
                      background: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    تأیید شده
                  </span>
                ) : null}
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
                {!isArchive ? (
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
                ) : null}
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
