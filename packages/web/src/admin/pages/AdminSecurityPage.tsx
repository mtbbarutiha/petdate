import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch } from '../api';
import { adminCan } from '../auth';
import { tr } from '../../i18n';

type Ban = { id: number; ip: string; reason: string; createdBy: string; createdAt: string };
type Snapshot = {
  ssl: { status: string; detail: string; expiresAt: string | null };
  frequentLogins: Array<{ ip: string; count: number }>;
  bot: { bot: boolean; reason: string };
  bans: Ban[];
  note?: string;
};

export function AdminSecurityPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canBan = adminCan('admin.full');

  const load = useCallback(async () => {
    try {
      const snap = await adminFetch<Snapshot>('/api/admin/ops/security');
      setData(snap);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addBan = async (e: FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/ops/security/bans', {
        method: 'POST',
        body: JSON.stringify({ ip: ip.trim(), reason: reason.trim() }),
      });
      setIp('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const removeBan = async (id: number) => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/ops/security/bans/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const sslTone = data?.ssl.status === 'up' ? 'mint' : data?.ssl.status === 'down' ? 'orange' : 'sky';

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>{tr('امنیت')}</h1>
          <p>{tr('وضعیت SSL، ورود پرتکرار، ربات و فهرست مسدودسازی IP ادمین')}</p>
        </div>
        <button type="button" className="admin-btn" onClick={() => void load()}>{tr('بروزرسانی')}</button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-stats">
        <div className={`admin-stat admin-stat--${sslTone}`}>
          <div className="admin-stat-value">{data?.ssl.status || '…'}</div>
          <div className="admin-stat-label">{tr('وضعیت SSL')}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-value">{data?.frequentLogins.length ?? '—'}</div>
          <div className="admin-stat-label">{tr('IP ورود پرتکرار')}</div>
        </div>
        <div className={`admin-stat admin-stat--${data?.bot.bot ? 'orange' : 'mint'}`}>
          <div className="admin-stat-value">{data?.bot.bot ? tr('ربات') : tr('عادی')}</div>
          <div className="admin-stat-label">{tr('تشخیص ربات')}</div>
        </div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}>
        <h2>{tr('گواهی SSL')}</h2>
        <p>{data?.ssl.detail || tr('در حال بررسی…')}</p>
        {data?.ssl.expiresAt ? <p className="admin-muted">{tr('انقضا:')} {data.ssl.expiresAt}</p> : null}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}>
        <h2>{tr('ورود پرتکرار')}</h2>
        {data?.frequentLogins.length ? (
          <ul>
            {data.frequentLogins.map((row) => (
              <li key={row.ip}>{row.ip} · {row.count}</li>
            ))}
          </ul>
        ) : (
          <p className="admin-muted">{tr('الگوی ورود پرتکرار در ۱۵ دقیقه اخیر نیست.')}</p>
        )}
        {data?.bot.reason ? <p>{tr('ربات:')} {data.bot.reason}</p> : null}
        {data?.note ? <p className="admin-muted">{data.note}</p> : null}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}>
        <h2>{tr('مسدودسازی IP ادمین')}</h2>
        {canBan ? (
          <form className="admin-toolbar" onSubmit={(e) => void addBan(e)}>
            <input className="admin-input" dir="ltr" placeholder="IP" value={ip} onChange={(e) => setIp(e.target.value)} required />
            <input className="admin-input" placeholder={tr('دلیل')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('مسدود کردن')}</button>
          </form>
        ) : (
          <p className="admin-muted">{tr('فقط مدیر کامل می‌تواند IP را مسدود یا رفع کند.')}</p>
        )}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>{tr('دلیل')}</th>
                <th>{tr('توسط')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.bans || []).map((b) => (
                <tr key={b.id}>
                  <td className="admin-mono" dir="ltr">{b.ip}</td>
                  <td>{b.reason || '—'}</td>
                  <td>{b.createdBy || '—'}</td>
                  <td>
                    {canBan ? (
                      <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => void removeBan(b.id)}>
                        {tr('رفع مسدودیت')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!data?.bans.length ? <tr><td colSpan={4}>{tr('فهرست خالی است')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
