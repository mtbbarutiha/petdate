import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EVENT_CREATE_COST,
  EVENT_GAME_TYPES,
  GAME_PHOTO_STATUS_LABELS,
  GAME_STATUS_LABELS,
  GAME_TYPE_LABELS,
  IRAN_PROVINCES,
  type Game,
  type GamePhotoStatus,
  type GamePlayer,
  type GameStatus,
  type GameType,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { tr } from '../../i18n';

const STATUS_OPTIONS: Array<GameStatus | ''> = ['', 'open', 'full', 'cancelled', 'completed'];

type AdminGameDetail = Game & { players?: GamePlayer[] };

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '').slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type EventDraft = {
  title: string;
  gameType: GameType;
  hostName: string;
  hostUserId: string;
  location: string;
  province: string;
  city: string;
  joinFeeCoins: string;
  photoUrl: string;
  photoStatus: GamePhotoStatus;
  scheduledAt: string;
  maxPlayers: string;
  services: string;
  description: string;
  status: GameStatus;
};

function draftFromGame(g: Game): EventDraft {
  return {
    title: g.title || '',
    gameType: g.gameType,
    hostName: g.hostName || '',
    hostUserId: g.hostUserId ? String(g.hostUserId) : '',
    location: g.location || '',
    province: g.province || '',
    city: g.city || '',
    joinFeeCoins: String(g.joinFeeCoins ?? 0),
    photoUrl: g.photoUrl || '',
    photoStatus: g.photoStatus || 'approved',
    scheduledAt: toLocalInput(g.scheduledAt),
    maxPlayers: String(g.maxPlayers || 1),
    services: g.services || '',
    description: g.description || '',
    status: g.status,
  };
}

export function AdminGamesPage() {
  const [items, setItems] = useState<Game[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Game[]>([]);
  const [status, setStatus] = useState<GameStatus | ''>('');
  const [province, setProvince] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminGameDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (province) qs.set('province', province);
      if (organizer.trim()) qs.set('host', organizer.trim());
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const [data, pending] = await Promise.all([
        adminFetch<{ games: Game[]; total: number }>(`/api/admin/games${suffix}`),
        adminFetch<{ games: Game[]; total: number }>('/api/admin/games/photos/pending?limit=100'),
      ]);
      setItems(Array.isArray(data.games) ? data.games : []);
      setPendingPhotos(Array.isArray(pending.games) ? pending.games : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
      setItems([]);
      setPendingPhotos([]);
    }
  }, [status, province, organizer]);

  useEffect(() => {
    void load();
  }, [load]);

  const setGameStatus = async (id: number, next: GameStatus) => {
    try {
      await adminFetch(`/api/admin/games/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
      if (detail?.id === id) {
        setDetail((d) => (d ? { ...d, status: next } : d));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    }
  };

  const setPhotoStatus = async (id: number, next: 'approved' | 'rejected') => {
    try {
      await adminFetch(`/api/admin/games/${id}/photo`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await load();
      if (detail?.id === id) {
        setDetail((d) => (d ? { ...d, photoStatus: next } : d));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    }
  };

  const openDetail = async (id: number, edit = false) => {
    setDetailBusy(true);
    try {
      const data = await adminFetch<AdminGameDetail>(`/api/admin/games/${id}`);
      setDetail(data);
      setEditing(edit);
      setDraft(edit ? draftFromGame(data) : null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setDetailBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!detail || !draft) return;
    setSaveBusy(true);
    try {
      const saved = await adminFetch<AdminGameDetail>(`/api/admin/games/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draft.title,
          gameType: draft.gameType,
          hostName: draft.hostName,
          hostUserId: draft.hostUserId.trim() ? Number(draft.hostUserId) : undefined,
          location: draft.location,
          province: draft.province,
          city: draft.city,
          joinFeeCoins: Number(draft.joinFeeCoins) || 0,
          photoUrl: draft.photoUrl,
          photoStatus: draft.photoStatus,
          scheduledAt: draft.scheduledAt,
          maxPlayers: Number(draft.maxPlayers) || 1,
          services: draft.services,
          description: draft.description,
          status: draft.status,
        }),
      });
      setDetail(saved);
      setEditing(false);
      setDraft(null);
      setError(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setSaveBusy(false);
    }
  };

  const placeOf = (g: Game) =>
    [g.location, g.city, g.province].filter(Boolean).join(' · ') || '—';

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('ایونت‌ها')}</h1>
          <p>
            {formatNumFa(items.length)} {tr('مورد')} · {tr('هزینه ساخت')}:{' '}
            {formatNumFa(EVENT_CREATE_COST)} {tr('سکه')}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            className="admin-select"
            value={status}
            onChange={(e) => setStatus((e.target.value || '') as GameStatus | '')}
            aria-label={tr('وضعیت')}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s ? GAME_STATUS_LABELS[s] : tr('همه')}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            aria-label={tr('استان')}
          >
            <option value="">{tr('همه استان‌ها')}</option>
            {IRAN_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            className="admin-input"
            type="search"
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
            placeholder={tr('برگزارکننده')}
            aria-label={tr('برگزارکننده')}
            style={{ minWidth: '10rem' }}
          />
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      {pendingPhotos.length ? (
        <div className="admin-card" style={{ marginBottom: 16 }} data-testid="admin-event-photo-queue">
          <header className="admin-header" style={{ marginBottom: 8 }}>
            <div>
              <h2>{tr('صف تأیید عکس ایونت')}</h2>
              <p className="admin-muted">
                {formatNumFa(pendingPhotos.length)} {tr('مورد')}
              </p>
            </div>
          </header>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>{tr('عکس')}</th>
                  <th>{tr('عنوان')}</th>
                  <th>{tr('میزبان')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingPhotos.map((g) => (
                  <tr key={`pending-${g.id}`}>
                    <td>
                      {g.photoUrl ? (
                        <img
                          src={g.photoUrl}
                          alt=""
                          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <strong>{g.title}</strong>
                    </td>
                    <td>{g.hostName || '—'}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          onClick={() => void setPhotoStatus(g.id, 'approved')}
                          data-testid={`admin-event-photo-approve-${g.id}`}
                        >
                          {tr('تأیید')}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--danger"
                          onClick={() => void setPhotoStatus(g.id, 'rejected')}
                        >
                          {tr('رد')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>{tr('عنوان')}</th>
              <th>{tr('نوع')}</th>
              <th>{tr('میزبان')}</th>
              <th>{tr('مکان')}</th>
              <th>{tr('هزینه عضویت')}</th>
              <th>{tr('عکس')}</th>
              <th>{tr('زمان')}</th>
              <th>{tr('ظرفیت')}</th>
              <th>{tr('وضعیت')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id}>
                <td>
                  <strong>{g.title}</strong>
                  {g.services ? (
                    <div className="admin-muted" style={{ fontSize: 12 }}>
                      {tr('خدمات')}: {g.services}
                    </div>
                  ) : null}
                </td>
                <td>{GAME_TYPE_LABELS[g.gameType as GameType] || g.gameType}</td>
                <td>{g.hostName || '—'}</td>
                <td>{placeOf(g)}</td>
                <td className="admin-cell-nowrap">
                  {formatNumFa(g.joinFeeCoins ?? 0)} {tr('سکه')}
                </td>
                <td className="admin-cell-nowrap">
                  {g.photoUrl
                    ? GAME_PHOTO_STATUS_LABELS[g.photoStatus ?? 'approved'] || g.photoStatus
                    : '—'}
                </td>
                <td className="admin-cell-nowrap">{formatAdminFaDateTime(g.scheduledAt)}</td>
                <td className="admin-cell-nowrap">
                  {formatNumFa(g.currentPlayers)}/{formatNumFa(g.maxPlayers)}
                </td>
                <td>
                  <span className={`admin-status admin-status--${g.status}`}>
                    {GAME_STATUS_LABELS[g.status] || g.status}
                  </span>
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => void openDetail(g.id)}
                      disabled={detailBusy}
                    >
                      {tr('جزئیات')}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      onClick={() => void openDetail(g.id, true)}
                      disabled={detailBusy}
                      data-testid={`admin-event-edit-${g.id}`}
                    >
                      {tr('ویرایش')}
                    </button>
                    {g.status !== 'cancelled' ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => void setGameStatus(g.id, 'cancelled')}
                      >
                        {tr('لغو')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={() => void setGameStatus(g.id, 'open')}
                      >
                        {tr('باز کردن')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={10} className="admin-muted">
                  {tr('ایونتی ثبت نشده')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="admin-card" style={{ marginTop: 16 }} data-testid="admin-game-detail">
          <header className="admin-header" style={{ marginBottom: 8 }}>
            <div>
              <h2>{detail.title}</h2>
              <p className="admin-muted">
                {GAME_TYPE_LABELS[detail.gameType]} · {GAME_STATUS_LABELS[detail.status]}
              </p>
            </div>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setDetail(null); setEditing(false); }}>
              {tr('بستن')}
            </button>
          </header>
          {editing && draft ? (
            <form
              className="admin-event-edit"
              data-testid="admin-event-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
            >
              <label>{tr('عنوان')}<input className="admin-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required /></label>
              <label>{tr('نوع')}
                <select className="admin-select" value={draft.gameType} onChange={(e) => setDraft({ ...draft, gameType: e.target.value as GameType })}>
                  {EVENT_GAME_TYPES.map((t) => (
                    <option key={t} value={t}>{GAME_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label>{tr('میزبان')}<input className="admin-input" value={draft.hostName} onChange={(e) => setDraft({ ...draft, hostName: e.target.value, hostUserId: '' })} /></label>
              <label>{tr('شناسه میزبان')}<input className="admin-input" inputMode="numeric" value={draft.hostUserId} onChange={(e) => setDraft({ ...draft, hostUserId: e.target.value })} /></label>
              <label>{tr('مکان')}<input className="admin-input" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
              <label>{tr('شهر')}<input className="admin-input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></label>
              <label>{tr('استان')}
                <select className="admin-select" value={draft.province} onChange={(e) => setDraft({ ...draft, province: e.target.value })}>
                  <option value="">{tr('همه استان‌ها')}</option>
                  {IRAN_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>{tr('هزینه عضویت')}<input className="admin-input" inputMode="numeric" value={draft.joinFeeCoins} onChange={(e) => setDraft({ ...draft, joinFeeCoins: e.target.value })} /></label>
              <label>{tr('عکس')}<input className="admin-input" value={draft.photoUrl} onChange={(e) => setDraft({ ...draft, photoUrl: e.target.value })} dir="ltr" /></label>
              <label>{tr('وضعیت عکس')}
                <select className="admin-select" value={draft.photoStatus} onChange={(e) => setDraft({ ...draft, photoStatus: e.target.value as GamePhotoStatus })}>
                  {(['approved', 'pending', 'rejected'] as GamePhotoStatus[]).map((s) => (
                    <option key={s} value={s}>{GAME_PHOTO_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label>{tr('زمان')}<input className="admin-input" type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} /></label>
              <label>{tr('ظرفیت')}<input className="admin-input" inputMode="numeric" value={draft.maxPlayers} onChange={(e) => setDraft({ ...draft, maxPlayers: e.target.value })} /></label>
              <label>{tr('وضعیت')}
                <select className="admin-select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as GameStatus })}>
                  {STATUS_OPTIONS.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{GAME_STATUS_LABELS[s as GameStatus]}</option>
                  ))}
                </select>
              </label>
              <label className="admin-event-edit__wide">{tr('خدمات')}<textarea className="admin-input" rows={2} value={draft.services} onChange={(e) => setDraft({ ...draft, services: e.target.value })} /></label>
              <label className="admin-event-edit__wide">{tr('توضیح')}<textarea className="admin-input" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              <div className="admin-row-actions admin-event-edit__wide">
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saveBusy}>{saveBusy ? tr('در حال ذخیره…') : tr('ذخیره')}</button>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setEditing(false); setDraft(null); }}>{tr('انصراف')}</button>
              </div>
            </form>
          ) : (
            <>
          {detail.photoUrl ? (
            <p>
              <img
                src={detail.photoUrl}
                alt=""
                style={{ maxWidth: 240, borderRadius: 8, display: 'block', marginBottom: 8 }}
              />
              <strong>{tr('وضعیت عکس')}:</strong>{' '}
              {GAME_PHOTO_STATUS_LABELS[detail.photoStatus ?? 'approved']}
              {detail.photoStatus === 'pending' ? (
                <span className="admin-row-actions" style={{ display: 'inline-flex', marginInlineStart: 8 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={() => void setPhotoStatus(detail.id, 'approved')}
                  >
                    {tr('تأیید')}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => void setPhotoStatus(detail.id, 'rejected')}
                  >
                    {tr('رد')}
                  </button>
                </span>
              ) : null}
            </p>
          ) : null}
          <p>
            <strong>{tr('میزبان')}:</strong> {detail.hostName || '—'}
          </p>
          <p>
            <strong>{tr('مکان')}:</strong> {placeOf(detail)}
          </p>
          <p>
            <strong>{tr('هزینه عضویت')}:</strong> {formatNumFa(detail.joinFeeCoins ?? 0)}{' '}
            {tr('سکه')}
          </p>
          {detail.services ? (
            <p>
              <strong>{tr('خدمات')}:</strong> {detail.services}
            </p>
          ) : null}
          <p>
            <strong>{tr('زمان')}:</strong> {formatAdminFaDateTime(detail.scheduledAt)}
          </p>
          {detail.description ? (
            <p>
              <strong>{tr('توضیح')}:</strong> {detail.description}
            </p>
          ) : null}
          <p>
            <Link to="/admin/finance#event-revenue">{tr('درآمد ایونت')}</Link>
          </p>
          <h3 style={{ marginTop: 12 }}>{tr('شرکت‌کنندگان')}</h3>
          <div className="admin-event-people">
            {(detail.players ?? []).map((p) => (
              <article key={p.id} className="admin-event-person">
                <strong>{p.userName || tr('بدون نام')}</strong>
                <span className="admin-muted">
                  {p.username ? <span dir="ltr">@{p.username}</span> : null}
                  {p.mobile ? <span dir="ltr">{p.mobile}</span> : null}
                  {!p.username && !p.mobile ? <span>#{p.userId}</span> : null}
                </span>
                <span>{p.petName ? `${tr('پت')}: ${p.petName}${p.petSpecies ? ` · ${p.petSpecies}` : ''}` : tr('پت ثبت نشده')}</span>
                <span className="admin-mono" dir="ltr">{p.ticketCode || '—'}</span>
                <span className="admin-muted">{formatAdminFaDateTime(p.joinedAt)}</span>
              </article>
            ))}
            {!detail.players?.length ? <p className="admin-muted">{tr('شرکت‌کننده‌ای نیست')}</p> : null}
          </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
