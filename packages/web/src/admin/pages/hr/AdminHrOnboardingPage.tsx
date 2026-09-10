import { useCallback, useEffect, useState } from 'react';
import type { HrOnboardingRecord } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

export function AdminHrOnboardingPage() {
  const [records, setRecords] = useState<HrOnboardingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ records: HrOnboardingRecord[] }>('/api/admin/hr/onboarding');
      setRecords(res.records); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggleTask = async (rec: HrOnboardingRecord, taskId: string) => {
    if (!canWrite) return;
    const tasks = rec.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    try {
      await adminFetch(`/api/admin/hr/onboarding/${rec.id}/tasks`, { method: 'PATCH', body: JSON.stringify({ tasks }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>شروع به کار (Onboarding)</h1><p>چک‌لیست ورود — با استخدام از ATS هم ساخته می‌شود</p></div></header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-settings-grid">
        {records.map((r) => {
          const done = r.tasks.filter((t) => t.done).length;
          const pct = r.tasks.length ? Math.round((done / r.tasks.length) * 100) : 0;
          return (
            <article key={r.id} className="admin-card" style={{ padding: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{r.name} · {r.jobTitle || '—'}</h2>
              <p className="admin-muted">شروع {r.startDate || '—'} · مدت {formatNumFa(r.durationDays)} روز · {formatNumFa(pct)}٪</p>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(0,0,0,.08)', overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--admin-mint, #2dd4bf)' }} />
              </div>
              <ul className="admin-log-list">
                {r.tasks.map((t) => (
                  <li key={t.id}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={t.done} disabled={!canWrite} onChange={() => void toggleTask(r, t.id)} />
                      <span>{t.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {records.length === 0 ? <p className="admin-muted">هنوز فرآیندی نیست — از ATS متقاضی را استخدام‌شده کنید</p> : null}
    </div>
  );
}
