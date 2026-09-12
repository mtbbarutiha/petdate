import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Gamepad2,
  MapPin,
  Plus,
  Users,
  UserRound,
} from 'lucide-react';
import {
  GAME_STATUS_LABELS,
  GAME_TYPE_LABELS,
  formatPersianDateTime,
  type Game,
  type GameStatus,
  type GameType,
} from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { useAppToast } from '../hooks/useAppToast';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { createGame, joinGame, listGames } from '../lib/api';
import { loginPath } from '../lib/authRedirect';

const GAME_TYPES = Object.keys(GAME_TYPE_LABELS) as GameType[];

function toLocalInputValue(isoOrSql: string): string {
  const d = new Date(isoOrSql.includes('T') ? isoOrSql : isoOrSql.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toISOString();
}

export function GamesPage() {
  const { t, dir, lang } = useI18n();
  const { isLoggedIn, user } = useAuthStore();
  const { toastSuccess, toastError } = useAppToast();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GameStatus | ''>('open');
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    gameType: 'football' as GameType,
    location: '',
    scheduledAt: '',
    maxPlayers: '10',
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listGames(statusFilter ? { status: statusFilter } : undefined);
      setGames(Array.isArray(rows) ? rows : []);
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeLabel = useMemo(
    () => (gt: GameType) => (lang === 'en' ? gt : GAME_TYPE_LABELS[gt] || gt),
    [lang]
  );
  const statusLabel = useMemo(
    () => (st: GameStatus) =>
      lang === 'en' ? st : GAME_STATUS_LABELS[st] || st,
    [lang]
  );

  const onJoin = async (game: Game) => {
    if (!isLoggedIn || !user?.id) {
      toastError(t('games.loginToJoin'));
      return;
    }
    setJoiningId(game.id);
    try {
      await joinGame(game.id, user.id);
      toastSuccess(t('games.joinOk'));
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('games.joinFail'));
    } finally {
      setJoiningId(null);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !user?.id) {
      toastError(t('games.loginToCreate'));
      return;
    }
    const title = form.title.trim();
    const location = form.location.trim();
    if (!title || !location || !form.scheduledAt) {
      toastError(t('games.required'));
      return;
    }
    const maxPlayers = Number(form.maxPlayers);
    setCreating(true);
    try {
      await createGame({
        title,
        gameType: form.gameType,
        hostUserId: user.id,
        location,
        scheduledAt: fromLocalInputValue(form.scheduledAt),
        maxPlayers: Number.isFinite(maxPlayers) && maxPlayers > 0 ? maxPlayers : 10,
        description: form.description.trim() || undefined,
      });
      toastSuccess(t('games.createOk'));
      setShowForm(false);
      setForm({
        title: '',
        gameType: 'football',
        location: '',
        scheduledAt: '',
        maxPlayers: '10',
        description: '',
      });
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('games.createFail'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <LandingChrome className="pepito-games-page" hideBanner>
      <section className="pepito-section pepito-games" dir={dir}>
        <div className="pepito-section-head pepito-section-head--center">
          <p className="pepito-eyebrow">
            <span className="pepito-eyebrow-icon" aria-hidden>
              <Gamepad2 size={16} strokeWidth={2.25} />
            </span>
            {t('games.eyebrow')}
          </p>
          <h1>{t('games.title')}</h1>
          <p className="pepito-games-lead">{t('games.lead')}</p>
        </div>

        <div className="pepito-games-toolbar">
          <label className="pepito-games-filter">
            <span>{t('games.filterStatus')}</span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter((e.target.value || '') as GameStatus | '')}
            >
              <option value="">{t('games.filterAll')}</option>
              <option value="open">{statusLabel('open')}</option>
              <option value="full">{statusLabel('full')}</option>
              <option value="completed">{statusLabel('completed')}</option>
              <option value="cancelled">{statusLabel('cancelled')}</option>
            </select>
          </label>
          {isLoggedIn ? (
            <button
              type="button"
              className="pepito-btn button-1"
              onClick={() => setShowForm((v) => !v)}
              data-testid="games-toggle-create"
            >
              <Plus size={16} strokeWidth={2.25} aria-hidden />
              {showForm ? t('games.hideForm') : t('games.createCta')}
            </button>
          ) : (
            <Link to={loginPath('/games')} className="pepito-btn button-1" data-testid="games-login">
              {t('games.loginToCreate')}
            </Link>
          )}
        </div>

        {showForm && isLoggedIn ? (
          <form
            id="games-create"
            className="pepito-games-form"
            onSubmit={(e) => void onCreate(e)}
            data-testid="games-create-form"
          >
            <h2>{t('games.createTitle')}</h2>
            <div className="pepito-games-form-grid">
              <label className="form-group">
                <span className="form-label">{t('games.fieldTitle')}</span>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  maxLength={120}
                />
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldType')}</span>
                <select
                  className="form-select"
                  value={form.gameType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gameType: e.target.value as GameType }))
                  }
                >
                  {GAME_TYPES.map((gt) => (
                    <option key={gt} value={gt}>
                      {typeLabel(gt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldLocation')}</span>
                <input
                  className="form-input"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  required
                  maxLength={160}
                />
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldWhen')}</span>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  required
                />
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldSeats')}</span>
                <input
                  className="form-input"
                  type="number"
                  min={2}
                  max={50}
                  value={form.maxPlayers}
                  onChange={(e) => setForm((f) => ({ ...f, maxPlayers: e.target.value }))}
                />
              </label>
              <label className="form-group pepito-games-form-span">
                <span className="form-label">{t('games.fieldDesc')}</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={500}
                />
              </label>
            </div>
            <div className="pepito-games-form-actions">
              <button type="submit" className="pepito-btn button-1" disabled={creating}>
                {creating ? t('games.creating') : t('games.createSubmit')}
              </button>
              <button
                type="button"
                className="pepito-btn button-2"
                onClick={() => setShowForm(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : null}

        {loading ? (
          <p className="pepito-games-loading" role="status">
            {t('games.loading')}
          </p>
        ) : games.length === 0 ? (
          <div className="empty-state pepito-games-empty" data-testid="games-empty">
            <Gamepad2 size={36} strokeWidth={1.5} aria-hidden />
            <h3>{t('games.emptyTitle')}</h3>
            <p>{t('games.emptyLead')}</p>
          </div>
        ) : (
          <ul className="pepito-games-list" data-testid="games-list">
            {games.map((g) => {
              const seatsLeft = Math.max(0, g.maxPlayers - g.currentPlayers);
              const canJoin = g.status === 'open' && seatsLeft > 0;
              const isHost = user?.id === g.hostUserId;
              return (
                <li key={g.id} className="pepito-games-item">
                  <div className="pepito-games-item-main">
                    <div className="pepito-games-item-head">
                      <h2>{g.title}</h2>
                      <span className={`pepito-games-status is-${g.status}`}>
                        {statusLabel(g.status)}
                      </span>
                    </div>
                    <p className="pepito-games-type">{typeLabel(g.gameType)}</p>
                    <ul className="pepito-games-meta">
                      <li>
                        <MapPin size={14} aria-hidden />
                        <span>{g.location}</span>
                      </li>
                      <li>
                        <CalendarDays size={14} aria-hidden />
                        <span>
                          {g.scheduledAt
                            ? formatPersianDateTime(g.scheduledAt) ||
                              toLocalInputValue(g.scheduledAt)
                            : '—'}
                        </span>
                      </li>
                      <li>
                        <UserRound size={14} aria-hidden />
                        <span>
                          {t('games.host')}: {g.hostName || '—'}
                        </span>
                      </li>
                      <li>
                        <Users size={14} aria-hidden />
                        <span>
                          {g.currentPlayers}/{g.maxPlayers} {t('games.seats')}
                          {seatsLeft > 0 ? ` · ${seatsLeft} ${t('games.seatsLeft')}` : ''}
                        </span>
                      </li>
                    </ul>
                    {g.description ? (
                      <p className="pepito-games-desc">{g.description}</p>
                    ) : null}
                  </div>
                  <div className="pepito-games-item-actions">
                    {!isLoggedIn ? (
                      <Link
                        to={loginPath('/games')}
                        className="pepito-btn button-1"
                        data-testid={`games-join-login-${g.id}`}
                      >
                        {t('games.loginToJoin')}
                      </Link>
                    ) : canJoin && !isHost ? (
                      <button
                        type="button"
                        className="pepito-btn button-1"
                        disabled={joiningId === g.id}
                        onClick={() => void onJoin(g)}
                        data-testid={`games-join-${g.id}`}
                      >
                        {joiningId === g.id ? t('games.joining') : t('games.join')}
                      </button>
                    ) : (
                      <span className="pepito-games-item-note">
                        {isHost
                          ? t('games.youHost')
                          : g.status === 'full'
                            ? t('games.full')
                            : statusLabel(g.status)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </LandingChrome>
  );
}
