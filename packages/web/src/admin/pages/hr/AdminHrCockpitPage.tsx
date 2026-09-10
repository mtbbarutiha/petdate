import { useCallback, useEffect, useState } from 'react';
import { adminFetch, formatNumFa } from '../../api';

type CockpitTask = { type: string; label: string; employeeName?: string; detail: string; daysLeft?: number };

export function AdminHrCockpitPage() {
  const [tasks, setTasks] = useState<CockpitTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ tasks: CockpitTask[] }>('/api/admin/hr/cockpit');
      setTasks(res.tasks); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>کارتابل فعالیت</h1>
          <p>وظایف جاری: تولد، تمدید قرارداد، دوره آزمایشی، درخواست‌ها و آنبوردینگ</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>نوع</th><th>برچسب</th><th>همکار</th><th>جزئیات</th></tr></thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={i}><td>{t.type}</td><td>{t.label}</td><td>{t.employeeName || '—'}</td><td>{t.detail}{t.daysLeft != null ? ` (${formatNumFa(t.daysLeft)} روز)` : ''}</td></tr>
            ))}
            {!tasks.length ? (
              <tr><td colSpan={4} className="admin-muted">وظیفه‌ای در کارتابل نیست</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
