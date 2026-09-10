import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import type { AdminHeaderNotification, AdminNotificationsPayload } from '@petdate/shared';
import { adminFetch, formatNumFa } from './api';

const POLL_MS = 45_000;

function kindClass(kind: AdminHeaderNotification['kind']): string {
  if (kind === 'warn') return 'admin-notif-item--warn';
  if (kind === 'bad') return 'admin-notif-item--bad';
  if (kind === 'success') return 'admin-notif-item--ok';
  return '';
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function AdminHeaderNotifications() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminHeaderNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminFetch<AdminNotificationsPayload>('/api/admin/notifications');
      setItems(data.items || []);
      setUnread(Number(data.unreadCount) || 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری اعلان‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markOne = async (id: string) => {
    try {
      await adminFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        body: '{}',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const markAll = async () => {
    try {
      await adminFetch('/api/admin/notifications/read-all', { method: 'POST', body: '{}' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const openItem = async (item: AdminHeaderNotification) => {
    if (!item.read && item.canMarkRead) {
      try {
        await adminFetch(`/api/admin/notifications/${encodeURIComponent(item.id)}/read`, {
          method: 'POST',
          body: '{}',
        });
      } catch {
        /* navigate anyway */
      }
    }
    setOpen(false);
    navigate(item.href || '/admin/dashboard');
  };

  const badge = unread > 99 ? '۹۹+' : unread > 0 ? formatNumFa(unread) : null;

  return (
    <div className={`admin-notif${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="admin-icon-btn admin-notif-bell"
        aria-label="اعلان‌ها"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Bell size={18} strokeWidth={2} />
        {badge ? <span className="admin-notif-badge">{badge}</span> : null}
      </button>
      {open ? (
        <div className="admin-notif-panel" role="dialog" aria-label="اعلان‌های ادمین">
          <div className="admin-notif-panel-head">
            <div>
              <strong>اعلان‌ها</strong>
              <span className="admin-muted">
                {unread > 0 ? `${formatNumFa(unread)} خوانده‌نشده` : 'همه خوانده شده'}
              </span>
            </div>
            {unread > 0 ? (
              <button type="button" className="admin-btn admin-btn--ghost admin-notif-mark-all" onClick={() => void markAll()}>
                <CheckCheck size={14} /> همه خوانده شد
              </button>
            ) : null}
          </div>
          <div className="admin-notif-list">
            {loading && items.length === 0 ? <p className="admin-muted admin-notif-empty">در حال بارگذاری…</p> : null}
            {error ? <p className="admin-notif-error">{error}</p> : null}
            {!loading && !error && items.length === 0 ? (
              <p className="admin-muted admin-notif-empty">اعلانی نیست</p>
            ) : null}
            {items.map((item) => (
              <div
                key={item.id}
                className={`admin-notif-item${item.read ? ' is-read' : ''}${kindClass(item.kind) ? ` ${kindClass(item.kind)}` : ''}`}
              >
                <button type="button" className="admin-notif-item-main" onClick={() => void openItem(item)}>
                  <span className="admin-notif-item-title">{item.title}</span>
                  {item.body ? <span className="admin-notif-item-body">{item.body}</span> : null}
                  <span className="admin-notif-item-meta">
                    <span>{formatWhen(item.date)}</span>
                    <span className="admin-notif-module">{item.module}</span>
                  </span>
                </button>
                {!item.read && item.canMarkRead ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost admin-notif-read-btn"
                    onClick={() => void markOne(item.id)}
                  >
                    خواندم
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="admin-notif-panel-foot">
            <Link to="/admin/hr/cockpit" onClick={() => setOpen(false)}>
              کارتابل HR
            </Link>
            <Link to="/admin/sales/tickets" onClick={() => setOpen(false)}>
              تیکت فروش
            </Link>
            <Link to="/admin/mail" onClick={() => setOpen(false)}>
              ایمیل
            </Link>
            <Link to="/admin/content" onClick={() => setOpen(false)}>
              محتوا
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
