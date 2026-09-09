import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../api';
import type { User } from '@petdate/shared';

type PetRow = {
  id: number;
  name: string;
  imageUrl?: string;
  ownerName?: string;
  ownerId: number;
};

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
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
        fetchJson<User[]>('/api/users/vet-credentials/pending'),
        fetchJson<User[]>('/api/users/provider-credentials/pending?kind=trainer'),
        fetchJson<User[]>('/api/users/provider-credentials/pending?kind=sitter'),
        fetchJson<PetRow[]>('/api/users/pet-photos/pending'),
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
      await fetchJson(`/api/users/${id}/vet-credential/${approve ? 'approve' : 'reject'}`, {
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
      await fetchJson(
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
      await fetchJson(`/api/users/pets/${id}/photo-moderation`, {
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
      <h1>تأیید مدارک و عکس‌ها</h1>
      <p>صف سریع تأیید مدرک دامپزشک / مربی / پرستار و عکس پت‌ها.</p>
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
          {list.map((u) => (
            <li key={u.id} style={{ marginBottom: 12 }}>
              <strong>{u.name}</strong> · #{u.id}
              {u.telegramId ? ` · TG ${u.telegramId}` : ''}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="admin-btn primary"
                  disabled={busyId != null}
                  onClick={() =>
                    void (tab === 'vet'
                      ? actVet(u.id, true)
                      : actProvider(u.id, tab, true))
                  }
                >
                  تأیید
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busyId != null}
                  onClick={() =>
                    void (tab === 'vet'
                      ? actVet(u.id, false)
                      : actProvider(u.id, tab, false))
                  }
                >
                  رد
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="admin-list">
          {!photos.length ? <li>صف خالی است.</li> : null}
          {photos.map((p) => (
            <li key={p.id} style={{ marginBottom: 12 }}>
              <strong>{p.name}</strong> · پت #{p.id}
              {p.ownerName ? ` · صاحب: ${p.ownerName}` : ''}
              {p.imageUrl ? (
                <div style={{ marginTop: 6 }}>
                  <img
                    src={p.imageUrl.startsWith('http') ? p.imageUrl : `${API_BASE}${p.imageUrl}`}
                    alt={p.name}
                    style={{ maxWidth: 180, borderRadius: 8 }}
                  />
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
          ))}
        </ul>
      )}
    </div>
  );
}
