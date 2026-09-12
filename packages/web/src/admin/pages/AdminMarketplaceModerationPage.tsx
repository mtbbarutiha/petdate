import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, FileText, ImageOff, RefreshCw, X } from 'lucide-react';
import { API_BASE, adminFetch } from '../api';
import { petPublicIdOf, userPublicIdOf, type User } from '@petdate/shared';
import { tr } from '../../i18n';

type PetRow = {
  id: number;
  name: string;
  imageUrl?: string;
  ownerName?: string;
  ownerId: number;
};

type CredTab = 'vet' | 'trainer' | 'photos' | 'avatars';
type ViewMode = 'queue' | 'archive';

function looksLikeTelegramFileId(value: string): boolean {
  const v = value.trim();
  if (!v || /^https?:\/\//i.test(v) || v.startsWith('/')) return false;
  if (/^(AgAC|AQAD|BAAC|BQAC|AwAC|CQAC|DQAC)/.test(v)) return true;
  return /^[A-Za-z0-9_-]{24,}$/.test(v);
}

/** Resolve credential / photo storage ref → browser-loadable URL. */
function mediaSrc(fileRef?: string | null): string | null {
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

function credentialFileRef(u: User, tab: 'vet' | 'trainer'): string | undefined {
  if (tab === 'trainer') return u.trainerCredentialFileId;
  return u.vetCredentialFileId;
}

function petImageSrc(imageUrl?: string | null): string | null {
  const raw = String(imageUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${API_BASE}${raw}`;
  return mediaSrc(raw);
}

function ModEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-card admin-mod-empty" role="status">
      <p className="admin-muted">{children}</p>
    </div>
  );
}

function ModThumb({
  src,
  alt,
  href,
  pdf,
}: {
  src: string | null;
  alt: string;
  href?: string | null;
  pdf?: boolean;
}) {
  if (pdf && href) {
    return (
      <a
        className="admin-mod-card__thumb admin-mod-card__thumb--pdf"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={tr("مشاهده PDF")}
      >
        <FileText size={28} aria-hidden />
        <span>PDF</span>
      </a>
    );
  }

  if (!src) {
    return (
      <div className="admin-mod-card__thumb admin-mod-card__thumb--empty" aria-hidden>
        <ImageOff size={26} />
      </div>
    );
  }

  return (
    <a
      className="admin-mod-card__thumb-link"
      href={href ?? src}
      target="_blank"
      rel="noreferrer"
      title={tr("باز کردن تمام‌صفحه")}
    >
      <img
        className="admin-mod-card__thumb"
        src={src}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const wrap = img.parentElement;
          if (!wrap) return;
          const fallback = wrap.querySelector('.admin-mod-card__thumb-fallback') as HTMLElement | null;
          if (fallback) fallback.hidden = false;
        }}
      />
      <span className="admin-mod-card__thumb-fallback" hidden>
        {tr('بارگذاری ناموفق — لینک مستقیم')}
      </span>
    </a>
  );
}

function ModActions({
  busy,
  onApprove,
  onReject,
  approveLabel = 'تأیید',
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  approveLabel?: string;
}) {
  return (
    <div className="admin-mod-card__actions">
      <button
        type="button"
        className="admin-btn admin-btn--primary admin-mod-card__action"
        disabled={busy}
        onClick={onApprove}
      >
        <Check size={16} aria-hidden />
        {approveLabel}
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--danger admin-mod-card__action"
        disabled={busy}
        onClick={onReject}
      >
        <X size={16} aria-hidden />
        {tr('رد')}
      </button>
    </div>
  );
}

export function AdminMarketplaceModerationPage() {
  const [tab, setTab] = useState<CredTab>('vet');
  const [mode, setMode] = useState<ViewMode>('queue');
  const [pendingVets, setPendingVets] = useState<User[]>([]);
  const [pendingTrainers, setPendingTrainers] = useState<User[]>([]);
  const [archiveVets, setArchiveVets] = useState<User[]>([]);
  const [archiveTrainers, setArchiveTrainers] = useState<User[]>([]);
  const [photos, setPhotos] = useState<PetRow[]>([]);
  const [avatars, setAvatars] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (includeArchive = mode === 'archive') => {
    setError(null);
    setLoading(true);
    try {
      const queue = await Promise.all([
        adminFetch<User[]>('/api/users/vet-credentials/pending?limit=100'),
        adminFetch<User[]>('/api/users/provider-credentials/pending?kind=trainer&limit=100'),
        adminFetch<PetRow[]>('/api/users/pet-photos/pending?limit=100'),
        adminFetch<User[]>('/api/users/user-avatars/pending?limit=100'),
      ]);
      setPendingVets(queue[0]);
      setPendingTrainers(queue[1]);
      setPhotos(queue[2]);
      setAvatars(queue[3]);

      if (includeArchive) {
        const [av, at] = await Promise.all([
          adminFetch<User[]>('/api/users/vet-credentials/verified?limit=100'),
          adminFetch<User[]>('/api/users/provider-credentials/verified?kind=trainer&limit=100'),
        ]);
        setArchiveVets(av);
        setArchiveTrainers(at);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load(mode === 'archive');
  }, [load, mode]);

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

  async function actProvider(id: number, kind: 'trainer', approve: boolean) {
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

  async function actAvatar(id: number, approve: boolean) {
    setBusyId(`avatar-${id}`);
    try {
      await adminFetch(`/api/users/${id}/avatar-moderation`, {
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

  const isArchive = mode === 'archive' && tab !== 'photos' && tab !== 'avatars';
  const list =
    tab === 'photos' || tab === 'avatars'
      ? []
      : tab === 'vet'
        ? isArchive
          ? archiveVets
          : pendingVets
        : isArchive
          ? archiveTrainers
          : pendingTrainers;

  const tabCounts = {
    vet: mode === 'archive' ? archiveVets.length : pendingVets.length,
    trainer: mode === 'archive' ? archiveTrainers.length : pendingTrainers.length,
    photos: photos.length,
    avatars: avatars.length,
  };

  const busy = busyId != null;

  return (
    <div className="admin-page admin-page--wide admin-mod-page">
      <header className="admin-header">
        <div>
          <h1>{tr('تأیید مدارک و عکس‌ها')}</h1>
          <p>
            {tr(`صف تأیید مدرک دامپزشک / مربی و عکس پت و کاربر — مدارک تأییدشده در آرشیو
            می‌مانند. عکس‌ها تا تأیید ادمین عمومی نیستند.`)}
          </p>
        </div>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw size={16} aria-hidden />
          {tr('بروزرسانی')}
        </button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-mod-toolbar" role="toolbar" aria-label={tr("حالت صف")}>
        <div className="admin-tabs admin-mod-mode-tabs" role="tablist" aria-label={tr("صف یا آرشیو")}>
          {(
            [
              ['queue', 'صف بررسی'],
              ['archive', 'آرشیو تأییدشده'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`admin-tab${mode === key ? ' is-on' : ''}`}
              onClick={() => {
                setMode(key);
                if (key === 'archive' && (tab === 'photos' || tab === 'avatars')) setTab('vet');
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="admin-tabs admin-mod-filter-tabs" role="tablist" aria-label={tr("نوع مدرک")}>
          {(
            [
              ['vet', 'دامپزشک', tabCounts.vet],
              ['trainer', 'مربی', tabCounts.trainer],
              ...(mode === 'queue'
                ? ([
                    ['photos', 'عکس پت', tabCounts.photos],
                    ['avatars', 'عکس کاربر', tabCounts.avatars],
                  ] as const)
                : []),
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`admin-tab${tab === key ? ' is-on' : ''}`}
              onClick={() => setTab(key)}
            >
              <span>{label}</span>
              <span className="admin-mod-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ModEmpty>{tr('در حال بارگذاری…')}</ModEmpty>
      ) : tab === 'photos' ? (
        photos.length === 0 ? (
          <ModEmpty>{tr('صف عکس پت خالی است.')}</ModEmpty>
        ) : (
          <div className="admin-mod-grid" data-testid="admin-mod-photo-grid">
            {photos.map((p) => {
              const src = petImageSrc(p.imageUrl);
              const idLabel = petPublicIdOf(p);
              return (
                <article key={p.id} className="admin-mod-card admin-mod-card--photo">
                  <ModThumb src={src} alt={p.name} href={src} />
                  <div className="admin-mod-card__body">
                    <div className="admin-mod-card__meta">
                      <h3 className="admin-mod-card__title">{p.name}</h3>
                      <p className="admin-mod-card__id">
                        <code dir="ltr">{idLabel}</code>
                      </p>
                      {p.ownerName ? (
                        <p className="admin-mod-card__sub">{tr('صاحب:')} {p.ownerName}</p>
                      ) : (
                        <p className="admin-mod-card__sub admin-muted">{tr('صاحب نامشخص')}</p>
                      )}
                    </div>
                    <ModActions
                      busy={busy}
                      approveLabel="تأیید عکس"
                      onApprove={() => void actPhoto(p.id, true)}
                      onReject={() => void actPhoto(p.id, false)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : tab === 'avatars' ? (
        avatars.length === 0 ? (
          <ModEmpty>{tr('صف عکس کاربر خالی است.')}</ModEmpty>
        ) : (
          <div className="admin-mod-grid" data-testid="admin-mod-avatar-grid">
            {avatars.map((u) => {
              const src = mediaSrc(u.avatarUrl);
              return (
                <article key={u.id} className="admin-mod-card admin-mod-card--avatar">
                  <ModThumb src={src} alt={u.name} href={src} />
                  <div className="admin-mod-card__body">
                    <div className="admin-mod-card__meta">
                      <h3 className="admin-mod-card__title">{u.name}</h3>
                      <p className="admin-mod-card__id">
                        <code dir="ltr">{userPublicIdOf(u)}</code>
                      </p>
                      <p className="admin-mod-card__sub">
                        {u.telegramId ? `TG ${u.telegramId}` : tr('بدون تلگرام')}
                      </p>
                    </div>
                    <ModActions
                      busy={busy}
                      approveLabel="تأیید عکس"
                      onApprove={() => void actAvatar(u.id, true)}
                      onReject={() => void actAvatar(u.id, false)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : list.length === 0 ? (
        <ModEmpty>{isArchive ? tr('آرشیو خالی است.') : tr('صف خالی است.')}</ModEmpty>
      ) : (
        <div className="admin-mod-grid" data-testid="admin-mod-credential-grid">
          {list.map((u) => {
            const fileRef = credentialFileRef(u, tab);
            const src = mediaSrc(fileRef);
            const pdf = isPdfRef(fileRef);
            return (
              <article key={u.id} className="admin-mod-card admin-mod-card--credential">
                <ModThumb src={pdf ? null : src} alt={`${tr('مدرک ')}${u.name}`} href={src} pdf={pdf} />
                <div className="admin-mod-card__body">
                  <div className="admin-mod-card__meta">
                    <div className="admin-mod-card__title-row">
                      <h3 className="admin-mod-card__title">{u.name}</h3>
                      {isArchive ? (
                        <span className="admin-mod-badge admin-mod-badge--ok">{tr('تأیید شده')}</span>
                      ) : null}
                    </div>
                    <p className="admin-mod-card__id">
                      <code dir="ltr">{userPublicIdOf(u)}</code>
                    </p>
                    <p className="admin-mod-card__sub">
                      {u.telegramId ? `TG ${u.telegramId}` : tr('بدون تلگرام')}
                    </p>
                    {!src ? (
                      <p className="admin-mod-card__warn">{tr('فایل مدرک در دسترس نیست.')}</p>
                    ) : null}
                  </div>
                  {!isArchive ? (
                    <ModActions
                      busy={busy}
                      onApprove={() =>
                        void (tab === 'vet' ? actVet(u.id, true) : actProvider(u.id, 'trainer', true))
                      }
                      onReject={() =>
                        void (tab === 'vet' ? actVet(u.id, false) : actProvider(u.id, 'trainer', false))
                      }
                    />
                  ) : src ? (
                    <a
                      className="admin-btn admin-mod-card__action"
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tr('مشاهده مدرک')}
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
