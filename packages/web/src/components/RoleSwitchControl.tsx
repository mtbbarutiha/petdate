import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '@petdate/shared';
import {
  USER_ROLES,
  dashboardPathForRole,
  normalizeRoles,
  primaryRole,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';

type Mode = 'closed' | 'switch' | 'add';

export interface RoleSwitchControlProps {
  /** Compact trigger for tight nav spaces */
  compact?: boolean;
  /** Extra class on the trigger button */
  className?: string;
  /** Prefer inline rail-style button instead of nav chrome; profile = full-width page block */
  variant?: 'nav' | 'rail' | 'profile';
}

/**
 * Post-login role switcher (bot parity: «نقش‌های من»).
 * Switch active/primary role among owned roles, or add more without full re-onboarding.
 * Profile + rail variants stay inline (no floating overlay that overflows chrome).
 */
export function RoleSwitchControl({
  compact = false,
  className = '',
  variant = 'nav',
}: RoleSwitchControlProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, isLoggedIn, setPrimaryRole, saveRoles } = useAuthStore();
  const roleName = (role: UserRole) => t(`roles.${role}`);
  const roleDesc = (role: UserRole) => t(`roles.desc_${role}`);
  const [mode, setMode] = useState<Mode>(variant === 'profile' ? 'switch' : 'closed');
  const [draft, setDraft] = useState<UserRole[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const roles = normalizeRoles(user?.roles, user?.role);
  const active = primaryRole(roles, user?.role);
  const isProfile = variant === 'profile';
  const isRail = variant === 'rail';
  const staysOpen = isProfile;

  useEffect(() => {
    if (staysOpen || mode === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('closed');
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMode('closed');
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [mode, staysOpen]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!isLoggedIn || !user) return null;

  const openSwitch = () => {
    setError(null);
    setMode((m) => (m === 'switch' ? 'closed' : 'switch'));
  };

  const openAdd = () => {
    setDraft(roles.length ? [...roles] : []);
    setError(null);
    setMode('add');
  };

  const goToRoleDashboard = (nextActive: UserRole | undefined) => {
    const path = dashboardPathForRole(nextActive);
    navigate(path, { replace: false });
  };

  const afterRoleChange = (nextActive: UserRole | undefined, message: string) => {
    if (!staysOpen) setMode('closed');
    else setMode('switch');
    setToast(message);
    goToRoleDashboard(nextActive);
  };

  const handleSwitch = async (role: UserRole) => {
    if (busy) return;
    if (active === role) {
      setToast(t('roles.activeToast', { role: roleName(role) }));
      if (!staysOpen) setMode('closed');
      goToRoleDashboard(role);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await setPrimaryRole(role);
      const next = primaryRole(updated.roles, updated.role);
      afterRoleChange(next, t('roles.activeToast', { role: roleName(next ?? role) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('roles.switchFailed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleDraft = (role: UserRole) => {
    setDraft((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setError(null);
  };

  const handleSaveRoles = async () => {
    if (!draft.length) {
      setError(t('roles.needOneRole'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const keep =
        active && draft.includes(active)
          ? active
          : primaryRole(draft);
      const updated = await saveRoles(draft, keep);
      const next = primaryRole(updated.roles, updated.role);
      afterRoleChange(next, t('roles.rolesUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('roles.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const toastNode = toast
    ? createPortal(
        <div className="pepito-role-switch-toast" role="status">
          {toast}
        </div>,
        document.body
      )
    : null;

  const renderAddBody = (prefix: 'board' | 'switch' | 'rail') => {
    const leadClass =
      prefix === 'board'
        ? 'pepito-role-board-add-lead'
        : prefix === 'rail'
          ? 'pepito-role-rail-add-lead'
          : 'pepito-role-switch-add-lead';
    const gridClass =
      prefix === 'board'
        ? 'pepito-role-board-add-grid'
        : prefix === 'rail'
          ? 'pepito-role-rail-add-grid'
          : 'pepito-role-switch-add-grid';
    const itemClass =
      prefix === 'board'
        ? 'pepito-role-board-add-item'
        : prefix === 'rail'
          ? 'pepito-role-rail-add-item'
          : 'pepito-role-switch-add-card';
    const labelClass =
      prefix === 'board'
        ? 'pepito-role-board-add-label'
        : prefix === 'rail'
          ? 'pepito-role-rail-add-label'
          : 'pepito-role-switch-add-label';
    const descClass =
      prefix === 'board'
        ? 'pepito-role-board-add-desc'
        : prefix === 'rail'
          ? 'pepito-role-rail-add-desc'
          : 'pepito-role-switch-add-desc';

    return (
      <>
        <p className={leadClass}>
          {t('roles.addLead')}
        </p>
        <div className={gridClass}>
          {USER_ROLES.map((role) => {
            const on = draft.includes(role);
            return (
              <button
                key={role}
                type="button"
                className={`${itemClass}${on ? ' is-on' : ''}`}
                aria-pressed={on}
                disabled={busy}
                onClick={() => toggleDraft(role)}
              >
                {prefix === 'board' ? (
                  <span className="pepito-role-board-add-check" aria-hidden>
                    {on ? <Check size={14} strokeWidth={2.5} /> : null}
                  </span>
                ) : null}
                <span className={labelClass}>{roleName(role)}</span>
                <span className={descClass}>{roleDesc(role)}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  };

  /* ── Profile: always-visible inline role board ── */
  if (isProfile) {
    return (
      <div className={`pepito-role-board${className ? ` ${className}` : ''}`} ref={rootRef}>
        <div className="pepito-role-board-active">
          <span className="pepito-role-board-active-label">{t('roles.activeRole')}</span>
          <strong className="pepito-role-board-active-value">
            {active ? roleName(active) : t('roles.noneSelected')}
          </strong>
          {active ? (
            <p className="pepito-role-board-active-desc">{roleDesc(active)}</p>
          ) : (
            <p className="pepito-role-board-active-desc">{t('roles.addFirst')}</p>
          )}
        </div>

        {mode === 'add' ? (
          <div className="pepito-role-board-add" aria-label={t('roles.addRole')}>
            {renderAddBody('board')}
            <div className="pepito-role-board-footer">
              <button
                type="button"
                className="pepito-btn pepito-btn--ghost"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setMode('switch');
                }}
              >
                {t('common.back')}
              </button>
              <button
                type="button"
                className="pepito-btn button-1"
                disabled={busy || draft.length === 0}
                onClick={() => void handleSaveRoles()}
              >
                {busy ? t('roles.saving') : t('roles.confirmRoles')}
              </button>
            </div>
            {error ? <p className="pepito-role-switch-error">{error}</p> : null}
          </div>
        ) : (
          <>
            <ul className="pepito-role-board-list" aria-label={t('roles.myRoles')}>
              {roles.length === 0 ? (
                <li className="pepito-role-board-empty">{t('roles.emptyRoles')}</li>
              ) : (
                roles.map((role) => {
                  const isActive = role === active;
                  return (
                    <li key={role}>
                      <button
                        type="button"
                        className={`pepito-role-board-item${isActive ? ' is-active' : ''}`}
                        disabled={busy}
                        onClick={() => void handleSwitch(role)}
                        aria-current={isActive ? 'true' : undefined}
                      >
                        <span className="pepito-role-board-item-text">
                          <span className="pepito-role-board-item-label">{roleName(role)}</span>
                          <span className="pepito-role-board-item-desc">{roleDesc(role)}</span>
                        </span>
                        {isActive ? (
                          <span className="pepito-role-board-badge">{t('roles.activeBadge')}</span>
                        ) : (
                          <span className="pepito-role-board-switch-hint">
                            <RefreshCw size={14} strokeWidth={2.25} aria-hidden />
                            {t('roles.select')}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            <button
              type="button"
              className="pepito-role-board-add-btn"
              disabled={busy}
              onClick={openAdd}
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden />
              {t('roles.addRole')}
            </button>
            {error ? <p className="pepito-role-switch-error">{error}</p> : null}
          </>
        )}

        {toastNode}
      </div>
    );
  }

  /* ── Rail: compact inline card (fits 220px rail — no absolute overflow panel) ── */
  if (isRail) {
    const open = mode !== 'closed';
    return (
      <div
        className={`pepito-role-rail${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        ref={rootRef}
      >
        <button
          type="button"
          className="pepito-role-rail-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={openSwitch}
          title={t('roles.myRoles')}
        >
          <span className="pepito-role-rail-trigger-text">
            <span className="pepito-role-rail-trigger-label">
              {active ? roleName(active) : t('roles.myRoles')}
            </span>
            <span className="pepito-role-rail-trigger-hint">{t('roles.switchTitle')}</span>
          </span>
          <ChevronDown
            className="pepito-role-rail-chevron"
            size={16}
            strokeWidth={2.25}
            aria-hidden
          />
        </button>

        {open ? (
          <div
            id={panelId}
            className={`pepito-role-rail-card${mode === 'add' ? ' is-add' : ''}`}
            role="dialog"
            aria-label={t('roles.myRoles')}
          >
            <div className="pepito-role-rail-head">
              <p className="pepito-role-rail-title">{t('roles.myRoles')}</p>
              {active ? (
                <p className="pepito-role-rail-active">
                  {t('roles.activeRoleNamed', { role: roleName(active) })}
                </p>
              ) : (
                <p className="pepito-role-rail-active">{t('roles.noRoleYet')}</p>
              )}
            </div>

            {mode === 'switch' ? (
              <>
                <ul className="pepito-role-rail-list">
                  {roles.length === 0 ? (
                    <li className="pepito-role-rail-empty">{t('roles.emptyRoles')}</li>
                  ) : (
                    roles.map((role) => {
                      const isActive = role === active;
                      return (
                        <li key={role}>
                          <button
                            type="button"
                            className={`pepito-role-rail-item${isActive ? ' is-active' : ''}`}
                            disabled={busy}
                            onClick={() => void handleSwitch(role)}
                            aria-current={isActive ? 'true' : undefined}
                          >
                            <span className="pepito-role-rail-item-label">
                              {roleName(role)}
                            </span>
                            {isActive ? (
                              <span className="pepito-role-rail-badge">
                                <Check size={12} strokeWidth={2.5} aria-hidden />
                                {t('roles.activeBadge')}
                              </span>
                            ) : (
                              <span className="pepito-role-rail-pick">{t('roles.select')}</span>
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
                <button
                  type="button"
                  className="pepito-role-rail-add"
                  disabled={busy}
                  onClick={openAdd}
                >
                  <Plus size={14} strokeWidth={2.5} aria-hidden />
                  {t('roles.addRole')}
                </button>
              </>
            ) : (
              <>
                {renderAddBody('rail')}
                <div className="pepito-role-rail-footer">
                  <button
                    type="button"
                    className="pepito-role-rail-back"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setMode('switch');
                    }}
                  >
                    {t('common.back')}
                  </button>
                  <button
                    type="button"
                    className="pepito-btn button-1 pepito-role-rail-confirm"
                    disabled={busy || draft.length === 0}
                    onClick={() => void handleSaveRoles()}
                  >
                    {busy ? t('roles.saving') : t('roles.confirmRoles')}
                  </button>
                </div>
              </>
            )}

            {error ? <p className="pepito-role-switch-error">{error}</p> : null}
          </div>
        ) : null}

        {toastNode}
      </div>
    );
  }

  /* ── Nav: compact trigger + dropdown panel ── */
  const triggerClass = `pepito-nav-login pepito-nav-login--btn pepito-role-switch-trigger${className ? ` ${className}` : ''}`;

  const triggerLabel = compact
    ? t('roles.shortRole')
    : active
      ? roleName(active)
      : t('roles.myRoles');

  return (
    <div className="pepito-role-switch" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={mode !== 'closed'}
        aria-controls={panelId}
        onClick={openSwitch}
        title={t('roles.myRoles')}
      >
        <span className="pepito-role-switch-trigger-label">{triggerLabel}</span>
        <span className="pepito-role-switch-trigger-hint" aria-hidden>
          {t('roles.switchTitle')}
        </span>
      </button>

      {mode !== 'closed' ? (
        <div
          id={panelId}
          className={`pepito-role-switch-panel${mode === 'add' ? ' is-add' : ''}`}
          role="dialog"
          aria-label={t('roles.myRoles')}
        >
          <div className="pepito-role-switch-panel-head">
            <p className="pepito-role-switch-panel-title">{t('roles.myRoles')}</p>
            {active ? (
              <p className="pepito-role-switch-panel-active">
                {t('roles.activeRoleNamed', { role: roleName(active) })}
              </p>
            ) : (
              <p className="pepito-role-switch-panel-active">{t('roles.noRoleYet')}</p>
            )}
          </div>

          {mode === 'switch' ? (
            <>
              <ul className="pepito-role-switch-list">
                {roles.length === 0 ? (
                  <li className="pepito-role-switch-empty">{t('roles.emptyRoles')}</li>
                ) : (
                  roles.map((role) => {
                    const isActive = role === active;
                    return (
                      <li key={role}>
                        <button
                          type="button"
                          className={`pepito-role-switch-item${isActive ? ' is-active' : ''}`}
                          disabled={busy}
                          onClick={() => void handleSwitch(role)}
                        >
                          <span className="pepito-role-switch-item-label">
                            {roleName(role)}
                          </span>
                          {isActive ? (
                            <span className="pepito-role-switch-badge">
                              <Check size={12} strokeWidth={2.5} aria-hidden />
                              {t('roles.activeBadge')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="pepito-role-switch-footer">
                <button
                  type="button"
                  className="pepito-role-switch-add"
                  disabled={busy}
                  onClick={openAdd}
                >
                  {t('roles.addRole')}
                </button>
              </div>
            </>
          ) : (
            <>
              {renderAddBody('switch')}
              <div className="pepito-role-switch-footer pepito-role-switch-footer--row">
                <button
                  type="button"
                  className="pepito-role-switch-back"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setMode('switch');
                  }}
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  className="pepito-btn button-1 pepito-role-switch-confirm"
                  disabled={busy || draft.length === 0}
                  onClick={() => void handleSaveRoles()}
                >
                  {busy ? t('roles.saving') : t('roles.confirmRoles')}
                </button>
              </div>
            </>
          )}

          {error ? <p className="pepito-role-switch-error">{error}</p> : null}
        </div>
      ) : null}

      {toastNode}
    </div>
  );
}
