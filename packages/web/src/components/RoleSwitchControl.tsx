import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '@petdate/shared';
import {
  MY_ROLES_LABEL,
  ROLE_ADD_LABEL,
  ROLE_CONFIRM_LABEL,
  USER_ROLE_LABELS,
  USER_ROLES,
  dashboardPathForRole,
  normalizeRoles,
  primaryRole,
} from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  pet_owner: 'پت داری و دنبال همبازی برایش هستی',
  vet: 'دامپزشک هستی و می‌خوای مشاوره بدی',
  no_pet: 'فعلاً پت نداری ولی علاقه‌مند به دنیای پت‌ها هستی',
  pet_seeker: 'دنبال پت مناسب برای خانه‌ات هستی',
  trainer: 'مربی یا آموزش‌دهنده حیوانات هستی',
};

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
 * Profile variant is always-inline (mobile + desktop) — no floating dropdown.
 */
export function RoleSwitchControl({
  compact = false,
  className = '',
  variant = 'nav',
}: RoleSwitchControlProps) {
  const navigate = useNavigate();
  const { user, isLoggedIn, setPrimaryRole, saveRoles } = useAuthStore();
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

  useEffect(() => {
    if (isProfile || mode === 'closed') return;
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
  }, [mode, isProfile]);

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
    if (!isProfile) setMode('closed');
    else setMode('switch');
    setToast(message);
    goToRoleDashboard(nextActive);
  };

  const handleSwitch = async (role: UserRole) => {
    if (busy) return;
    if (active === role) {
      setToast(`نقش فعال: ${USER_ROLE_LABELS[role]}`);
      if (!isProfile) setMode('closed');
      goToRoleDashboard(role);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await setPrimaryRole(role);
      const next = primaryRole(updated.roles, updated.role);
      afterRoleChange(next, `نقش فعال: ${USER_ROLE_LABELS[next ?? role]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعویض نقش ناموفق بود');
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
      setError('حداقل یک نقش انتخاب کن');
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
      afterRoleChange(next, 'نقش‌ها به‌روز شد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت نقش‌ها ناموفق بود');
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

  /* ── Profile: always-visible inline role board ── */
  if (isProfile) {
    return (
      <div className={`pepito-role-board${className ? ` ${className}` : ''}`} ref={rootRef}>
        <div className="pepito-role-board-active">
          <span className="pepito-role-board-active-label">نقش فعال</span>
          <strong className="pepito-role-board-active-value">
            {active ? USER_ROLE_LABELS[active] : 'انتخاب نشده'}
          </strong>
          {active ? (
            <p className="pepito-role-board-active-desc">{ROLE_DESCRIPTIONS[active]}</p>
          ) : (
            <p className="pepito-role-board-active-desc">اول یک نقش اضافه کن تا بتوانی سوییچ کنی.</p>
          )}
        </div>

        {mode === 'add' ? (
          <div className="pepito-role-board-add" aria-label={ROLE_ADD_LABEL}>
            <p className="pepito-role-board-add-lead">
              نقش‌های فعلی را نگه دار یا نقش جدید اضافه کن، بعد ثبت کن.
            </p>
            <div className="pepito-role-board-add-grid">
              {USER_ROLES.map((role) => {
                const on = draft.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    className={`pepito-role-board-add-item${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => toggleDraft(role)}
                  >
                    <span className="pepito-role-board-add-check" aria-hidden>
                      {on ? <Check size={14} strokeWidth={2.5} /> : null}
                    </span>
                    <span className="pepito-role-board-add-label">{USER_ROLE_LABELS[role]}</span>
                    <span className="pepito-role-board-add-desc">{ROLE_DESCRIPTIONS[role]}</span>
                  </button>
                );
              })}
            </div>
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
                بازگشت
              </button>
              <button
                type="button"
                className="pepito-btn button-1"
                disabled={busy || draft.length === 0}
                onClick={() => void handleSaveRoles()}
              >
                {busy ? 'در حال ثبت…' : ROLE_CONFIRM_LABEL}
              </button>
            </div>
            {error ? <p className="pepito-role-switch-error">{error}</p> : null}
          </div>
        ) : (
          <>
            <ul className="pepito-role-board-list" aria-label={MY_ROLES_LABEL}>
              {roles.length === 0 ? (
                <li className="pepito-role-board-empty">نقشی ثبت نشده — اول نقش اضافه کن.</li>
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
                          <span className="pepito-role-board-item-label">{USER_ROLE_LABELS[role]}</span>
                          <span className="pepito-role-board-item-desc">{ROLE_DESCRIPTIONS[role]}</span>
                        </span>
                        {isActive ? (
                          <span className="pepito-role-board-badge">فعال</span>
                        ) : (
                          <span className="pepito-role-board-switch-hint">
                            <RefreshCw size={14} strokeWidth={2.25} aria-hidden />
                            انتخاب
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
              {ROLE_ADD_LABEL}
            </button>
            {error ? <p className="pepito-role-switch-error">{error}</p> : null}
          </>
        )}

        {toastNode}
      </div>
    );
  }

  /* ── Nav / rail: compact trigger + dropdown panel ── */
  const triggerClass =
    variant === 'rail'
      ? `pepito-app-rail-link pepito-role-switch-trigger--rail${className ? ` ${className}` : ''}`
      : `pepito-nav-login pepito-nav-login--btn pepito-role-switch-trigger${className ? ` ${className}` : ''}`;

  const triggerLabel = compact
    ? 'نقش'
    : active
      ? USER_ROLE_LABELS[active]
      : MY_ROLES_LABEL;

  const rootMod = variant === 'rail' ? ' pepito-role-switch--rail' : '';

  return (
    <div className={`pepito-role-switch${rootMod}`} ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-haspopup="dialog"
        aria-expanded={mode !== 'closed'}
        aria-controls={panelId}
        onClick={openSwitch}
        title={MY_ROLES_LABEL}
      >
        <span className="pepito-role-switch-trigger-label">{triggerLabel}</span>
        <span className="pepito-role-switch-trigger-hint" aria-hidden>
          تغییر نقش
        </span>
      </button>

      {mode !== 'closed' ? (
        <div
          id={panelId}
          className={`pepito-role-switch-panel${mode === 'add' ? ' is-add' : ''}`}
          role="dialog"
          aria-label={MY_ROLES_LABEL}
        >
          <div className="pepito-role-switch-panel-head">
            <p className="pepito-role-switch-panel-title">{MY_ROLES_LABEL}</p>
            {active ? (
              <p className="pepito-role-switch-panel-active">
                نقش فعال: <strong>{USER_ROLE_LABELS[active]}</strong>
              </p>
            ) : (
              <p className="pepito-role-switch-panel-active">هنوز نقشی نداری</p>
            )}
          </div>

          {mode === 'switch' ? (
            <>
              <ul className="pepito-role-switch-list">
                {roles.length === 0 ? (
                  <li className="pepito-role-switch-empty">نقشی ثبت نشده — اول نقش اضافه کن.</li>
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
                          <span>{USER_ROLE_LABELS[role]}</span>
                          {isActive ? <span className="pepito-role-switch-badge">فعال</span> : null}
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
                  {ROLE_ADD_LABEL}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="pepito-role-switch-add-lead">
                نقش‌های فعلی را نگه دار یا نقش جدید اضافه کن، بعد ثبت کن.
              </p>
              <div className="pepito-role-switch-add-grid">
                {USER_ROLES.map((role) => {
                  const on = draft.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      className={`pepito-role-switch-add-card${on ? ' is-on' : ''}`}
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => toggleDraft(role)}
                    >
                      <span className="pepito-role-switch-add-label">{USER_ROLE_LABELS[role]}</span>
                      <span className="pepito-role-switch-add-desc">{ROLE_DESCRIPTIONS[role]}</span>
                    </button>
                  );
                })}
              </div>
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
                  بازگشت
                </button>
                <button
                  type="button"
                  className="pepito-btn button-1 pepito-role-switch-confirm"
                  disabled={busy || draft.length === 0}
                  onClick={() => void handleSaveRoles()}
                >
                  {busy ? 'در حال ثبت…' : ROLE_CONFIRM_LABEL}
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
