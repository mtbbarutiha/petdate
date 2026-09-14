import { useCallback, useEffect, useState } from 'react';
import {
  EVENT_CREATE_COST,
  GAME_PHOTO_STATUS_LABELS,
  GAME_STATUS_LABELS,
  GAME_TYPE_LABELS,
  type Game,
  type GamePlayer,
  type GameStatus,
  type GameType,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { tr } from '../../i18n';

const STATUS_OPTIONS: Array<GameStatus | ''> = ['', 'open', 'full', 'cancelled', 'completed'];

type AdminGameDetail = Game & { players?: GamePlayer[] };

export function AdminGamesPage() {
  const [items, setItems] = useState<Game[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<Game[]>([]);
  const [status, setStatus] = useState<GameStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminGameDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const [data, pending] = await Promise.all([
        adminFetch<{ games: Game[]; total: number }>(`/api/admin/games${qs}`),
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
  }, [status]);

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

  const openDetail = async (id: number) => {
    setDetailBusy(true);
    try {
      const data = await adminFetch<AdminGameDetail>(`/api/admin/games/${id}`);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setDetailBusy(false);
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
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setDetail(null)}>
              {tr('بستن')}
            </button>
          </header>
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
          <h3 style={{ marginTop: 12 }}>{tr('شرکت‌کنندگان')}</h3>
          <ul>
            {(detail.players ?? []).map((p) => (
              <li key={p.id}>
                {p.userName || `#${p.userId}`} · {formatAdminFaDateTime(p.joinedAt)}
              </li>
            ))}
            {!detail.players?.length ? <li className="admin-muted">{tr('شرکت‌کننده‌ای نیست')}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
