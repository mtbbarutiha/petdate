import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Coins,
  Gamepad2,
  ImageIcon,
  MapPin,
  Plus,
  Users,
  UserRound,
} from 'lucide-react';
import {
  EVENT_CREATE_COST,
  EVENT_GAME_TYPES,
  IRAN_PROVINCES,
  citiesForProvince,
  formatPersianDateTime,
  type Game,
  type GameStatus,
  type GameType,
} from '@petdate/shared';
import { LandingChrome } from '../components/LandingChrome';
import { PageHelpLink } from '../components/PageHelpLink';
import { useAppToast } from '../hooks/useAppToast';
import { useAuthStore } from '../hooks/useAuthStore';
import { gameStatusKey, gameTypeKey, useI18n } from '../i18n';
import { createGame, joinGame, listGames, uploadEventPhoto } from '../lib/api';
import { loginPath } from '../lib/authRedirect';

const GAME_TYPES: GameType[] = [...EVENT_GAME_TYPES];

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

function emptyForm() {
  return {
    title: '',
    gameType: 'pet_dating' as GameType,
    province: '',
    city: '',
    location: '',
    scheduledAt: '',
    maxPlayers: '10',
    joinFeeCoins: '0',
    services: '',
    description: '',
    photoUrl: '',
  };
}

export function GamesPage() {
  const { t, dir } = useI18n();
  const { isLoggedIn, user } = useAuthStore();
  const { toastSuccess, toastError } = useAppToast();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<GameStatus | ''>('open');
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState(emptyForm);

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

  const typeLabel = useMemo(() => (gt: GameType) => t(gameTypeKey(gt)), [t]);
  const statusLabel = useMemo(() => (st: GameStatus) => t(gameStatusKey(st)), [t]);
  const cities = useMemo(
    () => (form.province ? citiesForProvince(form.province) : []),
    [form.province]
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

  const onPhotoChange = async (file: File | null) => {
    if (!file || !user?.id) return;
    setUploadingPhoto(true);
    try {
      const { url } = await uploadEventPhoto(file, user.id);
      setForm((f) => ({ ...f, photoUrl: url }));
      toastSuccess(t('games.photoHint'));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('games.createFail'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !user?.id) {
      toastError(t('games.loginToCreate'));
      return;
    }
    const title = form.title.trim();
    const province = form.province.trim();
    const city = form.city.trim();
    if (!title || !province || !city || !form.scheduledAt) {
      toastError(t('games.required'));
      return;
    }
    const balance = user.coins ?? 0;
    if (balance < EVENT_CREATE_COST) {
      toastError(t('games.createNeedCoins'));
      return;
    }
    const maxPlayers = Number(form.maxPlayers);
    const joinFeeCoins = Number(form.joinFeeCoins);
    setCreating(true);
    try {
      await createGame({
        title,
        gameType: form.gameType,
        hostUserId: user.id,
        province,
        city,
        location: form.location.trim() || undefined,
        scheduledAt: fromLocalInputValue(form.scheduledAt),
        maxPlayers: Number.isFinite(maxPlayers) && maxPlayers > 0 ? maxPlayers : 10,
        joinFeeCoins: Number.isFinite(joinFeeCoins) && joinFeeCoins > 0 ? joinFeeCoins : 0,
        services: form.services.trim() || undefined,
        description: form.description.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
      });
      toastSuccess(t('games.createOk'));
      setShowForm(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t('games.createFail'));
    } finally {
      setCreating(false);
    }
  };

  const placeLabel = (g: Game) => {
    const parts = [g.location, g.city, g.province].filter(Boolean);
    const unique = [...new Set(parts.map((p) => String(p).trim()).filter(Boolean))];
    return unique.join(' · ') || '—';
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
          <PageHelpLink section="games" />
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
            <Link to={loginPath('/events')} className="pepito-btn button-1" data-testid="games-login">
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
            <p className="pepito-games-create-hint">{t('games.createCostHint')}</p>
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
                  data-testid="games-type-select"
                >
                  {GAME_TYPES.map((gt) => (
                    <option key={gt} value={gt}>
                      {typeLabel(gt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldProvince')}</span>
                <select
                  className="form-select"
                  value={form.province}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, province: e.target.value, city: '' }))
                  }
                  required
                  data-testid="games-province"
                >
                  <option value="">{t('games.fieldProvince')}</option>
                  {IRAN_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">{t('games.fieldCity')}</span>
                <select
                  className="form-select"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  required
                  disabled={!form.province}
                  data-testid="games-city"
                >
                  <option value="">{t('games.fieldCity')}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
              <label className="form-group">
                <span className="form-label">{t('games.fieldJoinFee')}</span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={10000}
                  value={form.joinFeeCoins}
                  onChange={(e) => setForm((f) => ({ ...f, joinFeeCoins: e.target.value }))}
                  data-testid="games-join-fee"
                />
              </label>
              <label className="form-group pepito-games-form-span">
                <span className="form-label">{t('games.fieldServices')}</span>
                <input
                  className="form-input"
                  value={form.services}
                  onChange={(e) => setForm((f) => ({ ...f, services: e.target.value }))}
                  maxLength={240}
                  data-testid="games-services"
                />
              </label>
              <label className="form-group pepito-games-form-span">
                <span className="form-label">{t('games.fieldPhoto')}</span>
                <input
                  className="form-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPhotoChange(e.target.files?.[0] ?? null)}
                  disabled={uploadingPhoto}
                  data-testid="games-photo"
                />
                <span className="pepito-games-photo-hint">{t('games.photoHint')}</span>
                {form.photoUrl ? (
                  <img
                    className="pepito-games-photo-preview"
                    src={form.photoUrl}
                    alt=""
                  />
                ) : null}
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
              <button
                type="submit"
                className="pepito-btn button-1"
                disabled={creating || uploadingPhoto}
              >
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
          <div className="pepito-games-loading" role="status" data-testid="games-loading">
            <div className="pepito-games-loading-grid" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="pepito-games-skeleton-card">
                  <div className="pepito-games-skeleton-cover" />
                  <div className="pepito-games-skeleton-lines">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ))}
            </div>
            <p>{t('games.loading')}</p>
          </div>
        ) : games.length === 0 ? (
          <div className="empty-state pepito-games-empty" data-testid="games-empty">
            <Gamepad2 size={36} strokeWidth={1.5} aria-hidden />
            <h3>{t('games.emptyTitle')}</h3>
            <p>{t('games.emptyLead')}</p>
          </div>
        ) : (
          <ul className="pepito-games-grid" data-testid="games-list">
            {games.map((g) => {
              const seatsLeft = Math.max(0, g.maxPlayers - g.currentPlayers);
              const canJoin = g.status === 'open' && seatsLeft > 0;
              const isHost = user?.id === g.hostUserId;
              const fee = Math.max(0, Math.floor(Number(g.joinFeeCoins) || 0));
              const showPhoto = Boolean(g.photoUrl);
              const pendingOwnPhoto =
                isHost && g.photoStatus === 'pending' && Boolean(g.photoUrl);
              const servicesSnippet = g.services
                ? String(g.services)
                    .replace(/\s*·\s*catalog:sample-events\s*/gi, '')
                    .replace(/\s*catalog:sample-events\s*/gi, '')
                    .trim()
                : '';
              return (
                <li key={g.id} className="pepito-games-card">
                  <div className="pepito-games-card-media">
                    {showPhoto ? (
                      <img
                        src={g.photoUrl}
                        alt=""
                        className="pepito-games-card-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="pepito-games-card-cover-ph" aria-hidden>
                        <ImageIcon size={40} strokeWidth={1.5} />
                        {pendingOwnPhoto || g.photoStatus === 'pending' ? (
                          <span>{t('games.photoPending')}</span>
                        ) : null}
                      </div>
                    )}
                    <span className={`pepito-games-status is-${g.status}`}>
                      {statusLabel(g.status)}
                    </span>
                  </div>
                  <div className="pepito-games-card-body">
                    <p className="pepito-games-type">{typeLabel(g.gameType)}</p>
                    <h2 className="pepito-games-card-title">{g.title}</h2>
                    <ul className="pepito-games-meta">
                      <li>
                        <MapPin size={14} aria-hidden />
                        <span>{placeLabel(g)}</span>
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
                      <li>
                        <Coins size={14} aria-hidden />
                        <span>
                          {fee > 0
                            ? t('games.feeCoins', { n: fee })
                            : t('games.feeFree')}
                        </span>
                      </li>
                    </ul>
                    {servicesSnippet ? (
                      <p className="pepito-games-services">
                        <strong>{t('games.fieldServices')}:</strong> {servicesSnippet}
                      </p>
                    ) : null}
                    {g.description ? (
                      <p className="pepito-games-desc">{g.description}</p>
                    ) : null}
                    <div className="pepito-games-card-actions">
                      {!isLoggedIn ? (
                        <Link
                          to={loginPath('/events')}
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
                          {joiningId === g.id
                            ? t('games.joining')
                            : fee > 0
                              ? t('games.joinWithFee', { n: fee })
                              : t('games.join')}
                        </button>
                      ) : (
                        <span className="pepito-games-card-note">
                          {isHost
                            ? t('games.youHost')
                            : g.status === 'full'
                              ? t('games.full')
                              : statusLabel(g.status)}
                        </span>
                      )}
                    </div>
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
