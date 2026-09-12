import { useCallback, useEffect, useState } from 'react';
import {
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
  const [status, setStatus] = useState<GameStatus | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminGameDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await adminFetch<{ games: Game[]; total: number }>(`/api/admin/games${qs}`);
      setItems(Array.isArray(data.games) ? data.games : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
      setItems([]);
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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('بازی‌ها')}</h1>
          <p>
            {formatNumFa(items.length)} {tr('مورد')}
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
      <div className="admin-table-wrap admin-card">
        <table className="admin-table admin-table--dense">
          <thead>
            <tr>
              <th>{tr('عنوان')}</th>
              <th>{tr('نوع')}</th>
              <th>{tr('میزبان')}</th>
              <th>{tr('مکان')}</th>
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
                </td>
                <td>{GAME_TYPE_LABELS[g.gameType as GameType] || g.gameType}</td>
                <td>{g.hostName || '—'}</td>
                <td>{g.location}</td>
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
                <td colSpan={8} className="admin-muted">
                  {tr('بازی‌ای ثبت نشده')}
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
          <p>
            <strong>{tr('میزبان')}:</strong> {detail.hostName || '—'}
          </p>
          <p>
            <strong>{tr('مکان')}:</strong> {detail.location}
          </p>
          <p>
            <strong>{tr('زمان')}:</strong> {formatAdminFaDateTime(detail.scheduledAt)}
          </p>
          {detail.description ? (
            <p>
              <strong>{tr('توضیح')}:</strong> {detail.description}
            </p>
          ) : null}
          <h3 style={{ marginTop: 12 }}>{tr('بازیکنان')}</h3>
          <ul>
            {(detail.players ?? []).map((p) => (
              <li key={p.id}>
                {p.userName || `#${p.userId}`} · {formatAdminFaDateTime(p.joinedAt)}
              </li>
            ))}
            {!detail.players?.length ? <li className="admin-muted">{tr('بازیکنی نیست')}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
