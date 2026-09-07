import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck } from 'lucide-react';
import { AdminWordmark } from '../AdminWordmark';
import { isAdminAuthenticated, loginAdmin } from '../auth';
import { sanitizeAdminNext } from '../redirect';
import '../../styles/admin.css';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = sanitizeAdminNext(searchParams.get('next'));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (isAdminAuthenticated()) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const ok = await loginAdmin(password);
    setBusy(false);
    if (ok) {
      navigate(next);
      return;
    }
    setError('رمز عبور اشتباه است');
  };

  return (
    <div className="admin-app admin-login-page" dir="rtl">
      <div className="admin-login-atmosphere" aria-hidden>
        <div className="admin-login-orb admin-login-orb--a" />
        <div className="admin-login-orb admin-login-orb--b" />
        <div className="admin-login-orb admin-login-orb--c" />
        <div className="admin-login-mesh" />
        <div className="admin-login-grain" />
      </div>

      <div className="admin-login-stage">
        <header className="admin-login-brand-block">
          <AdminWordmark className="admin-login-brand" size="lg" />
          <p className="admin-login-kicker">کنسول عملیات</p>
        </header>

        <form
          className="admin-login-panel"
          onSubmit={(e) => void handleSubmit(e)}
          aria-labelledby="admin-login-heading"
        >
          <div className="admin-login-panel-head">
            <span className="admin-login-secure" aria-hidden>
              <ShieldCheck size={16} strokeWidth={2.25} />
            </span>
            <h1 id="admin-login-heading" className="admin-login-heading">
              ورود امن ادمین
            </h1>
            <p className="admin-login-subtitle">
              دسترسی به ربات، فروشگاه، وب و محتوا
            </p>
          </div>

          <div className="form-group admin-login-field">
            <label className="form-label" htmlFor="admin-password">
              رمز عبور ادمین
            </label>
            <div className="admin-input-icon">
              <Lock size={16} aria-hidden />
              <input
                id="admin-password"
                className="form-input"
                type="password"
                placeholder="رمز عبور را وارد کنید"
                value={password}
                autoComplete="current-password"
                autoFocus
                disabled={busy}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'admin-login-error' : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
            </div>
          </div>

          {error ? (
            <p id="admin-login-error" className="admin-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="cta-btn admin-btn--primary admin-login-submit"
            disabled={busy || !password.trim()}
          >
            {busy ? 'در حال ورود…' : 'ورود به کنسول'}
          </button>
        </form>
      </div>
    </div>
  );
}
