import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { AdminWordmark } from '../AdminWordmark';
import { isAdminAuthenticated, loginAdmin } from '../auth';
import { sanitizeAdminNext } from '../redirect';
import { ThemeToggle } from '../../components/ThemeToggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useI18n } from '../../i18n';
import '../../styles/admin.css';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = sanitizeAdminNext(searchParams.get('next'));
  const { t } = useI18n();
  const [username, setUsername] = useState('');
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
    const result = await loginAdmin(password, username.trim() || undefined);
    setBusy(false);
    if (result.ok) {
      navigate(next);
      return;
    }
    setError(t('admin.loginError'));
  };

  return (
    <div className="admin-app admin-login-page">
      <div className="admin-login-theme">
        <LanguageToggle compact />
        <ThemeToggle compact />
      </div>
      <form className="admin-login-card" onSubmit={(e) => void handleSubmit(e)}>
        <AdminWordmark className="admin-login-brand" size="lg" />
        <p className="admin-login-subtitle">{t('admin.loginSubtitle')}</p>
        <div className="form-group">
          <label className="form-label">{t('admin.loginUserLabel')}</label>
          <div className="admin-input-icon">
            <User size={16} />
            <input
              className="form-input"
              type="text"
              placeholder={t('admin.loginUserPh')}
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('admin.loginPassLabel')}</label>
          <div className="admin-input-icon">
            <Lock size={16} />
            <input
              className="form-input"
              type="password"
              placeholder={t('admin.loginPassPh')}
              value={password}
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
          </div>
        </div>
        {error ? <p className="admin-error">{error}</p> : null}
        <button type="submit" className="cta-btn admin-btn--primary" disabled={busy}>
          {busy ? t('admin.loginBusy') : t('admin.loginSubmit')}
        </button>
      </form>
    </div>
  );
}
