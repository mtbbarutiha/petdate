import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { adminCan } from '../auth';
import { tr } from '../../i18n';

type Thread = {
  userId: number;
  userName: string;
  userPhone?: string | null;
  userTelegramId?: string | null;
  updatedAt: string;
  lastRole: string;
  lastText: string;
  messageCount: number;
};

type Msg = { id: number; role: string; text: string; createdAt: string };

export function AdminSupportInboxPage() {
  const canWrite = adminCan('support.write') || adminCan('crm.write') || adminCan('platform.write') || adminCan('admin.full');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const data = await adminFetch<{ threads: Thread[] }>('/api/admin/support/threads');
      setThreads(data.threads);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  const loadThread = useCallback(async (userId: number) => {
    try {
      const data = await adminFetch<{ messages: Msg[] }>(`/api/admin/support/threads/${userId}`);
      setMessages(data.messages);
      setActiveId(userId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const send = async () => {
    if (!activeId || !reply.trim() || !canWrite) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/support/threads/${activeId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: reply.trim() }),
      });
      setReply('');
      await loadThread(activeId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div>
          <h1>{tr('اینباکس پشتیبانی')}</h1>
          <p>{tr('گفتگوهای پشتیبانی وب و ربات — پاسخ انسانی در همان نخ ذخیره می‌شود')}</p>
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16 }}>
        <div className="admin-card" style={{ padding: 0, maxHeight: 640, overflow: 'auto' }}>
          {threads.map((t) => (
            <button
              key={t.userId}
              type="button"
              className={`admin-btn admin-btn--ghost${activeId === t.userId ? ' is-on' : ''}`}
              style={{ display: 'block', width: '100%', textAlign: 'right', padding: 12, borderRadius: 0 }}
              onClick={() => void loadThread(t.userId)}
            >
              <strong>{t.userName || `#${t.userId}`}</strong>
              <div className="admin-muted">{t.lastText.slice(0, 80) || tr('بدون پیام')}</div>
              <div className="admin-muted">
                {formatAdminFaDateTime(t.updatedAt)} · {t.messageCount}
              </div>
            </button>
          ))}
          {!threads.length ? <p className="admin-muted" style={{ padding: 16 }}>{tr('گفتگویی نیست')}</p> : null}
        </div>
        <div className="admin-card" style={{ padding: 16 }}>
          {!activeId ? (
            <p className="admin-muted">{tr('یک گفتگو را از سمت راست انتخاب کن')}</p>
          ) : (
            <>
              <div style={{ maxHeight: 440, overflow: 'auto', marginBottom: 12 }}>
                {messages.map((m) => (
                  <article key={m.id} style={{ marginBottom: 10 }}>
                    <div className="admin-muted">
                      {m.role === 'user' ? tr('کاربر') : tr('پشتیبانی / هوش مصنوعی')} ·{' '}
                      {formatAdminFaDateTime(m.createdAt)}
                    </div>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{m.text}</p>
                  </article>
                ))}
              </div>
              {canWrite ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ flex: 1 }}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={tr('پاسخ انسانی…')}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={busy || !reply.trim()}
                    onClick={() => void send()}
                  >
                    {tr('ارسال')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
