import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { UserRole } from '@petdate/shared';
import {
  BRAND,
  ROLE_CONFIRM_LABEL,
  USER_ROLE_LABELS,
  USER_ROLES,
} from '@petdate/shared';
import { AuthShell } from '../../components/AuthShell';
import { useAuthStore } from '../../hooks/useAuthStore';
import { sanitizeNext } from '../../lib/authRedirect';

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  pet_owner: 'پت داری و دنبال همبازی برایش هستی',
  vet: 'دامپزشک هستی و می‌خوای مشاوره بدی',
  no_pet: 'فعلاً پت نداری ولی علاقه‌مند به دنیای پت‌ها هستی',
  pet_seeker: 'دنبال پت مناسب برای خانه‌ات هستی',
  trainer: 'مربی یا آموزش‌دهنده حیوانات هستی',
};

export function RoleSelectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = sanitizeNext((location.state as { next?: string } | null)?.next, '/home');
  const { saveRoles, isLoggedIn } = useAuthStore();
  const [selected, setSelected] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate(`/auth/login?next=${encodeURIComponent(next)}`, { replace: true });
    }
  }, [isLoggedIn, navigate, next]);

  useEffect(() => {
    setPortalReady(typeof document !== 'undefined');
  }, []);

  if (!isLoggedIn) return null;

  const toggleRole = (role: UserRole) => {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selected.length) {
      setError('حداقل یک نقش انتخاب کن');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRoles(selected);
      navigate('/onboarding/profile', { state: { next } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت نقش‌ها ناموفق بود. دوباره امتحان کن.');
    } finally {
      setSaving(false);
    }
  };

  const confirmLabel = saving
    ? 'در حال ثبت…'
    : selected.length
      ? ROLE_CONFIRM_LABEL
      : 'اول یک نقش انتخاب کن';

  const actions = (
    <div className="role-select-actions" role="region" aria-label={ROLE_CONFIRM_LABEL}>
      {error ? <p className="role-select-error">{error}</p> : null}
      {selected.length > 0 ? (
        <p className="role-select-hint">
          {selected.length} نقش انتخاب شد
        </p>
      ) : null}
      <button
        type="button"
        className="pepito-btn button-1 auth-submit"
        onClick={() => void handleConfirm()}
        disabled={saving || selected.length === 0}
        aria-label={ROLE_CONFIRM_LABEL}
      >
        {confirmLabel}
      </button>
    </div>
  );

  return (
    <AuthShell
      wide
      footer={false}
      bannerTitle="شروع کن"
      bannerLead="نقش‌هات را انتخاب کن — همه چیز در همان محیط لندینگ می‌ماند"
      bannerImage="/pepito/uploads/1.jpg"
    >
      <div className="role-select">
        <p className="pepito-auth-kicker">شروع</p>
        <h1>نقش‌هات رو انتخاب کن</h1>
        <p className="auth-lead">
          یک یا چند نقش انتخاب کن، بعد «{ROLE_CONFIRM_LABEL}» رو بزن · {BRAND.taglineFa}
        </p>

        <div className="role-grid" role="group" aria-label="انتخاب نقش">
          {USER_ROLES.map((role) => {
            const active = selected.includes(role);
            return (
              <button
                key={role}
                type="button"
                className={`role-card${active ? ' role-card--selected' : ''}`}
                onClick={() => toggleRole(role)}
                aria-pressed={active}
              >
                <span className="role-card-label">{USER_ROLE_LABELS[role]}</span>
                <span className="role-card-desc">{ROLE_DESCRIPTIONS[role]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {portalReady ? createPortal(actions, document.body) : actions}
    </AuthShell>
  );
}
