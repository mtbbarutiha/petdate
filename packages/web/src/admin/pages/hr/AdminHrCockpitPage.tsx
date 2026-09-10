import { useCallback, useEffect, useState } from 'react';
import type { HrNotification } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

type CockpitTask = { type: string; label: string; employeeName?: string; detail: string; daysLeft?: number };

export function AdminHrCockpitPage() {
  const [tasks, setTasks] = useState<CockpitTask[]>([]);
  const [notifications, setNotifications] = useState<HrNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ tasks: CockpitTask[]; notifications: HrNotification[] }>('/api/admin/hr/cockpit');
      setTasks(res.tasks); setNotifications(res.notifications); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>کارتابل فعالیت</h1><p>تولد، تمدید، آزمایشی، درخواست و آنبوردینگ</p></div>
        {canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch('/api/admin/hr/notifications/read-all', { method: 'POST', body: '{}' }).then(load)}>علامت‌گذاری همه</button> : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <section className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>اعلان‌ها ({formatNumFa(notifications.filter((n) => !n.read).length)} خوانده‌نشده)</h2>
        <ul className="admin-log-list">
          {notifications.map((n) => (
            <li key={n.id} style={{ opacity: n.read ? 0.55 : 1 }}>
              <b>[{n.kind}]</b> {n.text}
              {!n.read && canWrite ? <> <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/notifications/${n.id}/read`, { method: 'POST', body: '{}' }).then(load)}>خواندم</button></> : null}
            </li>
          ))}
          {notifications.length === 0 ? <li className="admin-muted">اعلانی نیست</li> : null}
        </ul>
      </section>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>نوع</th><th>برچسب</th><th>همکار</th><th>جزئیات</th></tr></thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={i}><td>{t.type}</td><td>{t.label}</td><td>{t.employeeName || '—'}</td><td>{t.detail}{t.daysLeft != null ? ` (${formatNumFa(t.daysLeft)} روز)` : ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
