/**
 * Admin Platform Settings — feature flags + modular dropdowns + per-module goals.
 * RTL Persian Pepito UX.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PLATFORM_MODULE_LABELS,
  getPlatformGoalMetrics,
  type PlatformDropdownAuditEntry,
  type PlatformDropdownOption,
  type PlatformGoalMetricDef,
  type PlatformModuleGoals,
  type PlatformModuleKey,
} from '@petdate/shared';
import { adminFetch } from '../api';
import { adminCan } from '../auth';

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

const ANALYTICS_TEXT: { key: string; label: string; hint: string; placeholder: string }[] = [
  {
    key: 'ga4MeasurementId',
    label: 'GA4 Measurement ID',
    hint: 'شناسه G-XXXXXXXX — اختیاری؛ بدون اختراع شناسه. اولویت با env است.',
    placeholder: 'G-XXXXXXXX',
  },
];

type ModuleInfo = { key: PlatformModuleKey; label: string; dropdownCount: number; goalCount: number };
type FieldInfo = { fieldKey: string; label: string; defaultCount: number };
type Tab = 'flags' | 'dropdowns' | 'goals';

const PERIOD_FA: Record<string, string> = { weekly: 'هفتگی', monthly: 'ماهانه' };

function actorCanWrite(): boolean {
  return adminCan('platform.write') || adminCan('admin.full');
}

export function AdminSettingsPage() {
  const canWrite = actorCanWrite();
  const [tab, setTab] = useState<Tab>('dropdowns');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [moduleKey, setModuleKey] = useState<PlatformModuleKey>('ats');
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [fieldKey, setFieldKey] = useState<string>('');
  const [options, setOptions] = useState<PlatformDropdownOption[]>([]);
  const [audit, setAudit] = useState<PlatformDropdownAuditEntry[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState<PlatformModuleGoals | null>(null);
  const [goalDraft, setGoalDraft] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<PlatformGoalMetricDef[]>([]);

  const loadFlags = useCallback(async () => {
    try {
      const data = await adminFetch<{ settings: Record<string, string> }>('/api/admin/settings');
      setSettings(data.settings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  const loadModules = useCallback(async () => {
    try {
      const data = await adminFetch<{ modules: ModuleInfo[] }>('/api/admin/platform-settings/modules');
      setModules(data.modules);
      if (data.modules.length && !data.modules.some((m) => m.key === moduleKey)) {
        setModuleKey(data.modules[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, [moduleKey]);

  const loadFields = useCallback(async (mod: string) => {
    try {
      const data = await adminFetch<{ fields: FieldInfo[] }>(
        `/api/admin/platform-settings/modules/${encodeURIComponent(mod)}/fields`
      );
      setFields(data.fields);
      setFieldKey((prev) =>
        data.fields.some((f) => f.fieldKey === prev) ? prev : data.fields[0]?.fieldKey || ''
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  const loadOptions = useCallback(async (mod: string, field: string) => {
    if (!mod || !field) {
      setOptions([]);
      return;
    }
    try {
      const data = await adminFetch<{ options: PlatformDropdownOption[] }>(
        `/api/admin/platform-settings/modules/${encodeURIComponent(mod)}/fields/${encodeURIComponent(field)}/options`
      );
      setOptions(data.options);
      const a = await adminFetch<{ audit: PlatformDropdownAuditEntry[] }>(
        `/api/admin/platform-settings/audit?moduleKey=${encodeURIComponent(mod)}&fieldKey=${encodeURIComponent(field)}&limit=40`
      );
      setAudit(a.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  const loadGoals = useCallback(async (mod: string) => {
    try {
      const data = await adminFetch<{
        goals: PlatformModuleGoals;
        metrics: PlatformGoalMetricDef[];
      }>(`/api/admin/platform-settings/modules/${encodeURIComponent(mod)}/goals`);
      setGoals(data.goals);
      setMetrics(data.metrics.length ? data.metrics : getPlatformGoalMetrics(mod));
      const draft: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.goals.targets || {})) {
        draft[k] = String(v ?? 0);
      }
      setGoalDraft(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void loadFlags();
    void loadModules();
  }, [loadFlags, loadModules]);

  useEffect(() => {
    void loadFields(moduleKey);
    void loadGoals(moduleKey);
  }, [moduleKey, loadFields, loadGoals]);

  useEffect(() => {
    if (fieldKey) void loadOptions(moduleKey, fieldKey);
  }, [moduleKey, fieldKey, loadOptions]);

  const toggle = (key: string) => {
    setSettings((s) => ({ ...s, [key]: s[key] === '1' ? '0' : '1' }));
    setSaved(false);
  };

  const saveFlags = async () => {
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

  const addOption = async () => {
    if (!canWrite || !newLabel.trim() || !fieldKey) return;
    setBusy(true);
    try {
      await adminFetch(
        `/api/admin/platform-settings/modules/${encodeURIComponent(moduleKey)}/fields/${encodeURIComponent(fieldKey)}/options`,
        { method: 'POST', body: JSON.stringify({ label: newLabel.trim() }) }
      );
      setNewLabel('');
      await loadOptions(moduleKey, fieldKey);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const softDelete = async (id: number) => {
    if (!canWrite) return;
    if (!window.confirm('حذف نرم؟ گزینه در گزارش‌های تاریخی باقی می‌ماند و فقط از انتخاب جدید مخفی می‌شود.')) {
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/api/admin/platform-settings/options/${id}`, { method: 'DELETE' });
      await loadOptions(moduleKey, fieldKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: number) => {
    if (!canWrite) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/platform-settings/options/${id}/restore`, { method: 'POST' });
      await loadOptions(moduleKey, fieldKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const saveGoals = async () => {
    if (!canWrite) return;
    setBusy(true);
    try {
      const targets: Record<string, number> = {};
      for (const [k, v] of Object.entries(goalDraft)) {
        targets[k] = Math.max(0, Number(v) || 0);
      }
      const data = await adminFetch<{
        goals: PlatformModuleGoals;
        metrics: PlatformGoalMetricDef[];
      }>(`/api/admin/platform-settings/modules/${encodeURIComponent(moduleKey)}/goals`, {
        method: 'PUT',
        body: JSON.stringify({ targets }),
      });
      setGoals(data.goals);
      setMetrics(data.metrics);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const moduleLabel = useMemo(
    () => PLATFORM_MODULE_LABELS[moduleKey] || modules.find((m) => m.key === moduleKey)?.label || moduleKey,
    [moduleKey, modules]
  );

  const activeOpts = options.filter((o) => o.active);
  const inactiveOpts = options.filter((o) => !o.active);

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>تنظیمات پلتفرم</h1>
          <p>فلگ‌ها، دراپ‌داون‌های ماژولار و هدف‌گذاری — حذف نرم برای حفظ گزارش‌ها</p>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {saved ? <p className="admin-success">ذخیره شد</p> : null}

      <div className="admin-tabs">
        {(
          [
            { k: 'dropdowns' as const, fa: 'دراپ‌داون‌ها' },
            { k: 'goals' as const, fa: 'هدف‌گذاری' },
            { k: 'flags' as const, fa: 'فلگ‌ها و مالی' },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            className={`admin-tab${tab === t.k ? ' is-on' : ''}`}
            onClick={() => {
              setTab(t.k);
              setSaved(false);
            }}
          >
            {t.fa}
          </button>
        ))}
      </div>

      {tab === 'flags' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {canWrite ? (
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => void saveFlags()}>
                ذخیره فلگ‌ها
              </button>
            ) : null}
          </div>
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
                  onClick={() => canWrite && toggle(f.key)}
                  aria-pressed={settings[f.key] === '1'}
                  disabled={!canWrite}
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
                    disabled={!canWrite}
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
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>آنالیتیکس / GA4</h2>
            <div className="admin-form-grid" style={{ marginTop: 12 }}>
              {ANALYTICS_TEXT.map((f) => (
                <label key={f.key}>
                  <span className="form-label">{f.label}</span>
                  <input
                    className="form-input"
                    dir="ltr"
                    placeholder={f.placeholder}
                    value={settings[f.key] ?? ''}
                    disabled={!canWrite}
                    onChange={(e) => {
                      setSettings((s) => ({ ...s, [f.key]: e.target.value.trim() }));
                      setSaved(false);
                    }}
                  />
                  <small className="admin-muted">{f.hint}</small>
                </label>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {tab === 'dropdowns' || tab === 'goals' ? (
        <section className="admin-card" style={{ marginBottom: 16, padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>انتخاب ماژول</h2>
          <p className="admin-muted" style={{ marginBottom: 12 }}>
            هر ماژول دراپ‌داون‌ها و هدف‌گذاری مخصوص خود را دارد.
          </p>
          <div className="admin-tabs" style={{ flexWrap: 'wrap' }}>
            {(modules.length
              ? modules
              : (Object.keys(PLATFORM_MODULE_LABELS) as PlatformModuleKey[]).map((k) => ({
                  key: k,
                  label: PLATFORM_MODULE_LABELS[k],
                  dropdownCount: 0,
                  goalCount: 0,
                }))
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                className={`admin-tab${moduleKey === m.key ? ' is-on' : ''}`}
                onClick={() => setModuleKey(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'dropdowns' ? (
        <>
          <section className="admin-card" style={{ padding: 16 }}>
            <div className="admin-card-head" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: '1rem' }}>فیلدهای دراپ‌داون · {moduleLabel}</h2>
            </div>
            <div className="admin-tabs admin-tabs--modal" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
              {fields.map((f) => (
                <button
                  key={f.fieldKey}
                  type="button"
                  className={`admin-tab${fieldKey === f.fieldKey ? ' is-on' : ''}`}
                  onClick={() => setFieldKey(f.fieldKey)}
                >
                  {f.label}
                </button>
              ))}
              {!fields.length ? <span className="admin-muted">فیلدی تعریف نشده</span> : null}
            </div>

            {canWrite ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <input
                  className="form-input"
                  style={{ flex: '1 1 220px' }}
                  placeholder="برچسب گزینه جدید…"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  disabled={busy || !fieldKey}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={busy || !newLabel.trim() || !fieldKey}
                  onClick={() => void addOption()}
                >
                  افزودن
                </button>
              </div>
            ) : null}

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>برچسب</th>
                    <th>مقدار</th>
                    <th>ترتیب</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOpts.map((o) => (
                    <tr key={o.id}>
                      <td>{o.label}</td>
                      <td>
                        <code className="admin-mono">{o.value}</code>
                      </td>
                      <td>{o.sortOrder}</td>
                      <td>
                        <span className="admin-badge">فعال</span>
                      </td>
                      <td>
                        {canWrite ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            disabled={busy}
                            onClick={() => void softDelete(o.id)}
                          >
                            حذف نرم
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {!activeOpts.length ? (
                    <tr>
                      <td colSpan={5}>گزینه فعالی نیست</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {inactiveOpts.length ? (
              <>
                <h3 style={{ fontSize: '0.95rem', marginTop: 20 }}>غیرفعال (حفظ‌شده برای گزارش)</h3>
                <p className="admin-muted">
                  این مقادیر در انتخاب جدید دیده نمی‌شوند ولی در گزارش‌های تاریخی با برچسب درست نمایش داده می‌شوند.
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>برچسب</th>
                        <th>مقدار</th>
                        <th>حذف در</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveOpts.map((o) => (
                        <tr key={o.id}>
                          <td>{o.label}</td>
                          <td>
                            <code className="admin-mono">{o.value}</code>
                          </td>
                          <td>{o.deletedAt || '—'}</td>
                          <td>
                            {canWrite ? (
                              <button
                                type="button"
                                className="admin-btn"
                                disabled={busy}
                                onClick={() => void restore(o.id)}
                              >
                                بازگردانی
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>

          <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>تاریخچه تغییرات</h2>
            <ul className="admin-log-list">
              {audit.map((a) => (
                <li key={a.id}>
                  <b>{a.action}</b> · {a.detail}
                  <div className="admin-muted">
                    {a.actor} · {a.createdAt}
                  </div>
                </li>
              ))}
              {!audit.length ? <li className="admin-muted">هنوز تغییری ثبت نشده</li> : null}
            </ul>
          </section>
        </>
      ) : null}

      {tab === 'goals' ? (
        <section className="admin-card" style={{ padding: 16 }}>
          <div className="admin-card-head" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>هدف‌گذاری {moduleLabel}</h2>
            {canWrite ? (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={busy}
                onClick={() => void saveGoals()}
              >
                ذخیره اهداف
              </button>
            ) : null}
          </div>
          <p className="admin-muted" style={{ marginBottom: 16 }}>
            اهداف دوره‌ای برای این ماژول. مقایسه با عملکرد واقعی در نسخه‌های بعدی داشبورد اضافه می‌شود.
          </p>
          <div className="admin-form-grid">
            {(metrics.length ? metrics : getPlatformGoalMetrics(moduleKey)).map((m) => (
              <label key={m.key}>
                <span className="form-label">
                  {m.label}
                  <span className="admin-muted"> · {PERIOD_FA[m.period] || m.period}
                    {m.unit ? ` · ${m.unit}` : ''}
                  </span>
                </span>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step="any"
                  disabled={!canWrite}
                  value={goalDraft[m.key] ?? '0'}
                  onChange={(e) => {
                    setGoalDraft((d) => ({ ...d, [m.key]: e.target.value }));
                    setSaved(false);
                  }}
                />
              </label>
            ))}
          </div>
          {goals?.updatedAt ? (
            <p className="admin-muted" style={{ marginTop: 12 }}>
              آخرین به‌روزرسانی: {goals.updatedAt}
              {goals.updatedBy ? ` · ${goals.updatedBy}` : ''}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
