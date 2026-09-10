import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../api';

const FLAGS: { key: string; label: string; hint: string }[] = [
  { key: 'shopEnabled', label: 'فروشگاه', hint: 'فعال بودن مسیر /shop' },
  { key: 'playdatesEnabled', label: 'همبازی', hint: 'درخواست‌های playdate' },
  { key: 'vetConsultEnabled', label: 'مشاوره دامپزشک', hint: 'صف ارتباط با پزشک' },
  { key: 'botForceJoin', label: 'اجبار عضویت کانال', hint: 'force-join ربات' },
  { key: 'paymentCardEnabled', label: 'پرداخت کارت', hint: 'placeholder درگاه کارت' },
  { key: 'paymentStarsEnabled', label: 'پرداخت Stars', hint: 'Telegram Stars' },
  { key: 'maintenanceMode', label: 'حالت تعمیرات', hint: 'بنر نگهداری (placeholder)' },
];

const FINANCE_NUMS: { key: string; label: string; hint: string }[] = [
  { key: 'financeMarginPercent', label: 'حاشیه سود پیش‌فرض (%)', hint: 'اگر cost محصول خالی باشد برای COGS' },
  {
    key: 'vetConsultFeePercent',
    label: 'کارمزد مشاوره (%)',
    hint: 'درصدی از مبلغ فاکتور مشاوره (fee_coins → تومان)',
  },
  { key: 'playdateFeeToman', label: 'کارمزد همبازی (تومان)', hint: 'درآمد تخمینی هر همبازی پذیرفته' },
  { key: 'financeOpExMonthlyToman', label: 'هزینه عملیاتی ماهانه', hint: 'برای P&L دوره' },
];

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ settings: Record<string, string> }>('/api/admin/settings');
      setSettings(data.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (key: string) => {
    setSettings((s) => ({ ...s, [key]: s[key] === '1' ? '0' : '1' }));
    setSaved(false);
  };

  const save = async () => {
    try {
      const data = await adminFetch<{ settings: Record<string, string> }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
      setSettings(data.settings);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>تنظیمات</h1>
          <p>فلگ‌های ویژگی، مالی و placeholder پرداخت</p>
        </div>
        <button type="button" className="admin-btn admin-btn--primary" onClick={() => void save()}>
          ذخیره
        </button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {saved ? <p className="admin-success">ذخیره شد</p> : null}

      <div className="admin-settings-grid">
        {FLAGS.map((f) => (
          <article key={f.key} className="admin-card admin-setting-card">
            <div>
              <h3>{f.label}</h3>
              <p className="admin-muted">{f.hint}</p>
              <code className="admin-mono">{f.key}</code>
            </div>
            <button
              type="button"
              className={`admin-toggle${settings[f.key] === '1' ? ' is-on' : ''}`}
              onClick={() => toggle(f.key)}
              aria-pressed={settings[f.key] === '1'}
            >
              {settings[f.key] === '1' ? 'روشن' : 'خاموش'}
            </button>
          </article>
        ))}
      </div>

      <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>پارامترهای مالی</h2>
        <div className="admin-form-grid" style={{ marginTop: 12 }}>
          {FINANCE_NUMS.map((f) => (
            <label key={f.key}>
              <span className="form-label">{f.label}</span>
              <input
                className="form-input"
                type="number"
                value={settings[f.key] ?? ''}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, [f.key]: e.target.value }));
                  setSaved(false);
                }}
              />
              <small className="admin-muted">{f.hint}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>یادداشت پرداخت</h2>
        <p className="admin-muted">
          درگاه واقعی هنوز وصل نیست — فلگ‌های payment* فقط برای آماده‌سازی UI/ربات هستند.
          رمز ادمین از <code>ADMIN_PASSWORD</code> در سرور خوانده می‌شود.
        </p>
      </section>
    </div>
  );
}
