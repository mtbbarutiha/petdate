import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { adminFetch } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';

type LogRow = {
  id: number;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  createdAt: string;
};

type LogStats = {
  total: number;
  errors24h: number;
  warns24h: number;
  lastErrorAt: string | null;
};

const POLL_MS = 5000;

export function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const silentRef = useRef(false);

  const load = useCallback(async () => {
    const silent = silentRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '150' });
      if (level) qs.set('level', level);
      const data = await adminFetch<{ stats: LogStats; logs: LogRow[] }>(
        `/api/admin/logs?${qs}`
      );
      setStats(data.stats);
      setLogs(data.logs);
      setUpdatedAt(new Date().toLocaleTimeString('fa-IR'));
      setLive(true);
    } catch (err) {
      setLive(false);
      setError(err instanceof Error ? err.message : 'بارگذاری لاگ ناموفق بود');
    } finally {
      setLoading(false);
      silentRef.current = true;
    }
  }, [level]);

  useEffect(() => {
    silentRef.current = false;
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  async function clearOld() {
    if (!window.confirm('لاگ‌های قدیمی‌تر از ۷ روز پاک شوند؟')) return;
    try {
      await adminFetch('/api/admin/logs?olderThanDays=7', { method: 'DELETE' });
      silentRef.current = false;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک‌سازی ناموفق بود');
    }
  }

  async function clearAll() {
    if (!window.confirm('همهٔ لاگ‌های ثبت‌شده پاک شوند؟ این عمل برگشت‌ناپذیر است.')) return;
    try {
      await adminFetch('/api/admin/logs', { method: 'DELETE' });
      silentRef.current = false;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک‌سازی ناموفق بود');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>لاگ خطاها</h1>
          <p>
            خطاها و هشدارهای API و ربات — زنده
            {updatedAt ? ` · آخرین بروزرسانی ${updatedAt}` : ''}
            {live ? ' · متصل' : ' · قطع'}
          </p>
        </div>
        <div className="admin-header-actions">
          <select
            className="admin-select"
            value={level}
            onChange={(e) => {
              silentRef.current = false;
              setLevel(e.target.value);
            }}
            aria-label="فیلتر سطح"
          >
            <option value="">همه سطوح</option>
            <option value="error">error</option>
            <option value="warn">warn</option>
            <option value="info">info</option>
          </select>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              silentRef.current = false;
              void load();
            }}
          >
            <RefreshCw size={16} />
            بروزرسانی
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={() => void clearOld()}>
            <Trash2 size={16} />
            پاک‌سازی ۷روز
          </button>
          <button type="button" className="admin-btn admin-btn--danger" onClick={() => void clearAll()}>
            <Trash2 size={16} />
            پاک کردن همه
          </button>
        </div>
      </header>

      {stats ? (
        <div className="admin-stats">
          <div className="admin-stat admin-stat--slate">
            <div className="admin-stat-icon">
              <Activity size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.total}</div>
              <div className="admin-stat-label">کل لاگ‌ها</div>
            </div>
          </div>
          <div className="admin-stat admin-stat--orange">
            <div className="admin-stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.errors24h}</div>
              <div className="admin-stat-label">خطا ۲۴س</div>
            </div>
          </div>
          <div className="admin-stat admin-stat--blue">
            <div className="admin-stat-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="admin-stat-value">{stats.warns24h}</div>
              <div className="admin-stat-label">هشدار ۲۴س</div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="admin-error">{error}</p> : null}
      {loading && !logs.length ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      <section className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>سطح</th>
                <th>منبع</th>
                <th>پیام</th>
                <th>مسیر</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    className={`admin-log-row admin-log-row--${row.level}`}
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  >
                    <td className="admin-cell-nowrap">{formatAdminFaDateTime(row.createdAt)}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${row.level}`}>{row.level}</span>
                    </td>
                    <td>{row.source}</td>
                    <td className="admin-log-msg">{row.message}</td>
                    <td className="admin-mono">
                      {row.method ? `${row.method} ` : ''}
                      {row.path || '—'}
                      {row.statusCode ? ` · ${row.statusCode}` : ''}
                    </td>
                  </tr>
                  {expanded === row.id && row.stack ? (
                    <tr>
                      <td colSpan={5}>
                        <pre className="admin-stack">{row.stack}</pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {!logs.length && !loading ? (
                <tr>
                  <td colSpan={5} className="admin-muted">
                    لاگی ثبت نشده است.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
