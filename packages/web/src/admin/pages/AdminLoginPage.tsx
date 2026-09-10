import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, User } from 'lucide-react';
import { AdminWordmark } from '../AdminWordmark';
import { isAdminAuthenticated, loginAdmin } from '../auth';
import { sanitizeAdminNext } from '../redirect';
import '../../styles/admin.css';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = sanitizeAdminNext(searchParams.get('next'));
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
    setError('رمز عبور یا نام کاربری اشتباه است');
  };

  return (
    <div className="admin-app admin-login-page">
      <form className="admin-login-card" onSubmit={(e) => void handleSubmit(e)}>
        <AdminWordmark className="admin-login-brand" size="lg" />
        <p className="admin-login-subtitle">ورود اپراتور Pet Date — ربات، فروشگاه، وب و منابع انسانی</p>
        <div className="form-group">
          <label className="form-label">نام کاربری (اختیاری — نقش پشتیبانی)</label>
          <div className="admin-input-icon">
            <User size={16} />
            <input
              className="form-input"
              type="text"
              placeholder="خالی = ورود مدیر با ADMIN_PASSWORD"
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
          <label className="form-label">رمز عبور</label>
          <div className="admin-input-icon">
            <Lock size={16} />
            <input
              className="form-input"
              type="password"
              placeholder="رمز عبور را وارد کنید"
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
          {busy ? 'در حال ورود…' : 'ورود به کنسول'}
        </button>
        <p className="admin-login-hint">
          مدیر کامل: <code>ADMIN_PASSWORD</code> · پشتیبانی: <code>ADMIN_SUPPORT_PASSWORD</code> یا حساب جدول نقش‌ها
        </p>
      </form>
    </div>
  );
}
