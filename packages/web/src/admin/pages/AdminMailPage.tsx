import { useCallback, useEffect, useState } from 'react';
import { Inbox, Mail, PenLine, RefreshCw, Reply, Send } from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';

type SmtpConfig = {
  configured: boolean;
  host: string | null;
  port: number;
  from: string;
  fromName: string;
  user: string | null;
  authConfigured: boolean;
  secure: boolean;
  ignoreTls: boolean;
  tlsRejectUnauthorized: boolean;
  localHost: boolean;
};

type SendRow = {
  id: number;
  to: string;
  subject: string;
  purpose: string | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
};

type OtpRow = {
  channel: string;
  target: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
};

type OtpMailer = {
  linked: boolean;
  purpose: string;
  pendingCount: number;
  ok24h: number;
  fail24h: number;
  detail: string;
};

type InboxMeta = {
  configured: boolean;
  path: string;
  address: string;
  total: number;
  unread: number;
};

type InboxListItem = {
  id: string;
  uid: string;
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  date: string | null;
  preview: string;
  unread: boolean;
  size: number;
};

type InboxMessage = InboxListItem & {
  text: string;
  html: string | null;
  messageId: string | null;
};

type MailStatus = {
  generatedAt: string;
  smtp: SmtpConfig;
  smtpReachable: { ok: boolean; detail: string };
  newsletter?: { from: string; subscribers: number };
  stats: {
    total: number;
    ok24h: number;
    fail24h: number;
    lastAt: string | null;
    otpOk24h?: number;
    otpFail24h?: number;
  };
  otpMailer?: OtpMailer;
  inbox?: InboxMeta;
  recentSends: SendRow[];
  pendingEmailOtps: OtpRow[];
};

export function AdminMailPage() {
  const [data, setData] = useState<MailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFrom, setComposeFrom] = useState<'default' | 'newsletter'>('default');
  const [composeMsg, setComposeMsg] = useState<string | null>(null);
  const [composeOk, setComposeOk] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);

  const [inboxItems, setInboxItems] = useState<InboxListItem[]>([]);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyMsg, setReplyMsg] = useState<string | null>(null);
  const [replyOk, setReplyOk] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const res = await adminFetch<{ messages: InboxListItem[] }>('/api/admin/mail/inbox?limit=80');
      setInboxItems(res.messages || []);
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'خواندن صندوق ورودی ناموفق بود');
      setInboxItems([]);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<MailStatus>('/api/admin/mail'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری وضعیت ایمیل ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadInbox();
  }, [load, loadInbox]);

  async function openMessage(id: string) {
    setSelectedId(id);
    setSelected(null);
    setReplyBody('');
    setReplyMsg(null);
    try {
      const res = await adminFetch<{ message: InboxMessage }>(`/api/admin/mail/inbox/${encodeURIComponent(id)}`);
      setSelected(res.message);
      setInboxItems((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    } catch (err) {
      setInboxError(err instanceof Error ? err.message : 'باز کردن پیام ناموفق بود');
    }
  }

  async function sendReply() {
    if (!selectedId || !replyBody.trim()) return;
    setReplyBusy(true);
    setReplyMsg(null);
    setReplyOk(false);
    try {
      await adminFetch(`/api/admin/mail/inbox/${encodeURIComponent(selectedId)}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody }),
      });
      setReplyOk(true);
      setReplyMsg('پاسخ ارسال شد.');
      setReplyBody('');
      void load();
    } catch (err) {
      setReplyOk(false);
      setReplyMsg(err instanceof Error ? err.message : 'ارسال پاسخ ناموفق بود');
    } finally {
      setReplyBusy(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestMsg(null);
    setTestOk(false);
    try {
      await adminFetch('/api/admin/mail/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      });
      setTestOk(true);
      setTestMsg('ارسال تست موفق بود — صندوق ورودی (و اسپم) را چک کنید.');
      void load();
    } catch (err) {
      setTestOk(false);
      setTestMsg(err instanceof Error ? err.message : 'ارسال تست ناموفق بود');
    } finally {
      setTestBusy(false);
    }
  }

  async function sendCompose() {
    setComposeBusy(true);
    setComposeMsg(null);
    setComposeOk(false);
    try {
      await adminFetch('/api/admin/mail/send', {
        method: 'POST',
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          body: composeBody,
          from: composeFrom,
        }),
      });
      setComposeOk(true);
      setComposeMsg('ایمیل ارسال شد و در لاگ ثبت شد.');
      setComposeBody('');
      void load();
    } catch (err) {
      setComposeOk(false);
      setComposeMsg(err instanceof Error ? err.message : 'ارسال ایمیل ناموفق بود');
    } finally {
      setComposeBusy(false);
    }
  }

  const smtp = data?.smtp;
  const otpMailer = data?.otpMailer;
  const inbox = data?.inbox;
  const composeReady =
    Boolean(composeTo.trim()) &&
    Boolean(composeSubject.trim()) &&
    Boolean(composeBody.trim()) &&
    Boolean(smtp?.configured);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={20} /> ایمیل / SMTP
          </h2>
          <p className="admin-muted" style={{ margin: '6px 0 0' }}>
            صندوق ورودی، نوشتن/پاسخ، پیکربندی SMTP و وضعیت OTP
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => {
            void load();
            void loadInbox();
          }}
          disabled={loading || inboxLoading}
        >
          <RefreshCw size={16} /> بروزرسانی
        </button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-stats admin-stats--dense">
        <div className={`admin-stat admin-stat--${smtp?.configured ? 'mint' : 'orange'}`}>
          <div className="admin-stat-value">{smtp?.configured ? 'فعال' : 'خاموش'}</div>
          <div className="admin-stat-label">SMTP</div>
        </div>
        <div className={`admin-stat admin-stat--${inbox?.configured ? 'sky' : 'slate'}`}>
          <div className="admin-stat-value">{formatNumFa(inbox?.unread ?? 0)}</div>
          <div className="admin-stat-label">خوانده‌نشده</div>
        </div>
        <div className={`admin-stat admin-stat--${otpMailer?.linked ? 'mint' : 'orange'}`}>
          <div className="admin-stat-value">{otpMailer?.linked ? 'وصل' : 'قطع'}</div>
          <div className="admin-stat-label">OTP ایمیل</div>
        </div>
        <div className="admin-stat admin-stat--violet">
          <div className="admin-stat-value">{formatNumFa(data?.stats.ok24h ?? 0)}</div>
          <div className="admin-stat-label">موفق ۲۴س</div>
        </div>
        <div className="admin-stat admin-stat--orange">
          <div className="admin-stat-value">{formatNumFa(data?.stats.fail24h ?? 0)}</div>
          <div className="admin-stat-label">ناموفق ۲۴س</div>
        </div>
      </div>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={18} /> صندوق ورودی
            <span className="admin-muted" style={{ fontWeight: 400, fontSize: 13 }}>
              {inbox?.address || 'info@petdate.ir'} — {formatNumFa(inboxItems.length)} پیام
            </span>
          </h2>
        </div>
        {inboxError ? <p className="admin-error">{inboxError}</p> : null}
        <div className="admin-mail-inbox">
          <div className="admin-mail-list" role="list" aria-label="لیست پیام‌ها">
            {inboxItems.map((row) => {
              const fromLabel = row.fromName
                ? `${row.fromName} <${row.from}>`
                : row.from || '—';
              const when = formatAdminFaDateTime(row.date);
              return (
                <button
                  key={row.id}
                  type="button"
                  role="listitem"
                  className={[
                    'admin-mail-item',
                    selectedId === row.id ? 'is-selected' : '',
                    row.unread ? 'is-unread' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => void openMessage(row.id)}
                >
                  <span className="admin-mail-item-dot" aria-hidden="true">
                    {row.unread ? '●' : ''}
                  </span>
                  <span className="admin-mail-item-body">
                    <span className="admin-mail-item-top">
                      <span className="admin-mail-item-from admin-mono" dir="ltr" title={fromLabel}>
                        {fromLabel}
                      </span>
                      <span className="admin-mail-item-date admin-mono" dir="ltr" title={when}>
                        {when}
                      </span>
                    </span>
                    <span className="admin-mail-item-subject" title={row.subject || undefined}>
                      {row.subject || '(بدون موضوع)'}
                    </span>
                    <span className="admin-mail-item-preview admin-muted" title={row.preview || undefined}>
                      {row.preview || '—'}
                    </span>
                  </span>
                </button>
              );
            })}
            {!inboxItems.length ? (
              <p className="admin-mail-list-empty admin-muted">
                {inboxLoading ? 'در حال بارگذاری…' : 'پیامی در صندوق نیست'}
              </p>
            ) : null}
          </div>

          <div className="admin-mail-reading">
            {selected ? (
              <>
                <ul className="admin-kv">
                  <li>
                    <span>از</span>
                    <strong className="admin-mono" dir="ltr">
                      {selected.fromName ? `${selected.fromName} <${selected.from}>` : selected.from}
                    </strong>
                  </li>
                  <li>
                    <span>موضوع</span>
                    <strong>{selected.subject}</strong>
                  </li>
                  <li>
                    <span>زمان</span>
                    <strong className="admin-mono">{selected.date || '—'}</strong>
                  </li>
                </ul>
                <pre className="admin-mail-body">
                  {selected.text || '(بدون متن ساده — ممکن است فقط HTML باشد)'}
                </pre>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Reply size={14} /> پاسخ به {selected.from}
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={5}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="متن پاسخ را بنویسید…"
                  />
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={replyBusy || !replyBody.trim() || !smtp?.configured}
                  onClick={() => void sendReply()}
                >
                  <Send size={16} /> {replyBusy ? 'در حال ارسال…' : 'ارسال پاسخ'}
                </button>
                {replyMsg ? (
                  <p className={replyOk ? 'admin-muted' : 'admin-error'} style={{ marginTop: 12 }}>
                    {replyMsg}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="admin-mail-empty admin-muted">
                یک پیام از لیست پیام‌ها انتخاب کنید تا بخوانید و پاسخ دهید.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="admin-dash-grid" style={{ marginTop: 16 }}>
        <section className="admin-card">
          <div className="admin-card-head"><h2>پیکربندی SMTP</h2></div>
          {smtp ? (
            <ul className="admin-kv">
              <li><span>Host</span><strong className="admin-mono">{smtp.host || '—'}</strong></li>
              <li><span>Port</span><strong className="admin-mono">{smtp.port}</strong></li>
              <li><span>From</span><strong className="admin-mono">{smtp.fromName} &lt;{smtp.from}&gt;</strong></li>
              <li><span>Inbox</span><strong className="admin-mono">{inbox?.address || 'info@petdate.ir'}</strong></li>
              <li><span>User</span><strong className="admin-mono">{smtp.user || 'بدون auth'}</strong></li>
              <li><span>Auth</span><strong>{smtp.authConfigured ? 'بله (رمز مخفی)' : 'خیر'}</strong></li>
              <li><span>Reachability</span><strong>{data?.smtpReachable.detail}</strong></li>
            </ul>
          ) : (
            <p className="admin-muted">{loading ? '…' : 'داده‌ای نیست'}</p>
          )}
        </section>

        <section className="admin-card">
          <div className="admin-card-head"><h2>وضعیت OTP ایمیل</h2></div>
          <ul className="admin-kv">
            <li>
              <span>اتصال به SMTP</span>
              <strong>{otpMailer?.linked ? 'بله — همان میلر' : 'خیر'}</strong>
            </li>
            <li>
              <span>purpose</span>
              <strong className="admin-mono">{otpMailer?.purpose || 'login_otp'}</strong>
            </li>
            <li>
              <span>OTP موفق ۲۴س</span>
              <strong>{formatNumFa(otpMailer?.ok24h ?? data?.stats.otpOk24h ?? 0)}</strong>
            </li>
            <li>
              <span>OTP ناموفق ۲۴س</span>
              <strong>{formatNumFa(otpMailer?.fail24h ?? data?.stats.otpFail24h ?? 0)}</strong>
            </li>
            <li>
              <span>OTP فعال</span>
              <strong>{formatNumFa(otpMailer?.pendingCount ?? data?.pendingEmailOtps.length ?? 0)}</strong>
            </li>
          </ul>
          <p className="admin-muted" style={{ marginTop: 12 }}>
            {otpMailer?.detail ||
              'ورود وب با کانال ایمیل از همین SMTP می‌رود. کد در لاگ سرور چاپ نمی‌شود.'}
          </p>
        </section>
      </div>

      <div className="admin-dash-grid" style={{ marginTop: 16 }}>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PenLine size={18} /> نوشتن و ارسال ایمیل
            </h2>
          </div>
          <div className="form-group">
            <label className="form-label">فرستنده</label>
            <select
              className="form-input"
              value={composeFrom}
              onChange={(e) =>
                setComposeFrom(e.target.value === 'newsletter' ? 'newsletter' : 'default')
              }
            >
              <option value="default">
                پیش‌فرض SMTP ({smtp?.from || 'no-reply@petdate.ir'})
              </option>
              <option value="newsletter">
                خبرنامه ({data?.newsletter?.from || 'news@petdate.ir'})
              </option>
            </select>
            {data?.newsletter ? (
              <p className="admin-muted" style={{ marginTop: 6 }}>
                اعضای خبرنامه: {formatNumFa(data.newsletter.subscribers)} · Reply-To → info@
              </p>
            ) : null}
          </div>
          <div className="form-group">
            <label className="form-label">گیرنده</label>
            <input
              className="form-input"
              type="email"
              dir="ltr"
              placeholder="you@example.com"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">موضوع</label>
            <input
              className="form-input"
              type="text"
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              maxLength={200}
              placeholder="موضوع ایمیل"
            />
          </div>
          <div className="form-group">
            <label className="form-label">متن</label>
            <textarea
              className="form-textarea"
              rows={8}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="متن ایمیل را بنویسید…"
            />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={composeBusy || !composeReady}
            onClick={() => void sendCompose()}
          >
            <Send size={16} /> {composeBusy ? 'در حال ارسال…' : 'ارسال ایمیل'}
          </button>
          {composeMsg ? (
            <p className={composeOk ? 'admin-muted' : 'admin-error'} style={{ marginTop: 12 }}>
              {composeMsg}
            </p>
          ) : null}
        </section>

        <section className="admin-card">
          <div className="admin-card-head"><h2>ارسال تست سریع</h2></div>
          <div className="form-group">
            <label className="form-label">آدرس گیرنده</label>
            <input
              className="form-input"
              type="email"
              dir="ltr"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={testBusy || !testTo.trim() || !smtp?.configured}
            onClick={() => void sendTest()}
          >
            <Send size={16} /> {testBusy ? 'در حال ارسال…' : 'ارسال ایمیل تست'}
          </button>
          {testMsg ? (
            <p className={testOk ? 'admin-muted' : 'admin-error'} style={{ marginTop: 12 }}>
              {testMsg}
            </p>
          ) : null}
          <p className="admin-muted" style={{ marginTop: 12 }}>
            تست فقط وضعیت SMTP را چک می‌کند. برای پیام دلخواه از «نوشتن و ارسال ایمیل» استفاده کنید.
          </p>
        </section>
      </div>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>تلاش‌های اخیر ارسال</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>به</th>
                <th>موضوع</th>
                <th>نوع</th>
                <th>وضعیت</th>
                <th>خطا</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentSends ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="admin-cell-nowrap">{formatAdminFaDateTime(row.createdAt)}</td>
                  <td className="admin-mono" dir="ltr">{row.to}</td>
                  <td>{row.subject}</td>
                  <td><span className="admin-badge">{row.purpose || '—'}</span></td>
                  <td>
                    <span className={`admin-status admin-status--${row.ok ? 'accepted' : 'rejected'}`}>
                      {row.ok ? 'موفق' : 'ناموفق'}
                    </span>
                  </td>
                  <td className="admin-muted">{row.error || '—'}</td>
                </tr>
              ))}
              {!data?.recentSends?.length ? (
                <tr><td colSpan={6} className="admin-muted">هنوز لاگی ثبت نشده — بعد از OTP یا ارسال اینجا می‌آید</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>OTP ایمیل فعال (بدون کد)</h2></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>هدف</th>
                <th>ساخته</th>
                <th>انقضا</th>
                <th>تلاش</th>
              </tr>
            </thead>
            <tbody>
              {(data?.pendingEmailOtps ?? []).map((row) => (
                <tr key={`${row.target}-${row.createdAt}`}>
                  <td className="admin-mono" dir="ltr">{row.target}</td>
                  <td className="admin-cell-nowrap">{formatAdminFaDateTime(row.createdAt)}</td>
                  <td className="admin-mono">{row.expiresAt}</td>
                  <td>{formatNumFa(row.attempts)}</td>
                </tr>
              ))}
              {!data?.pendingEmailOtps?.length ? (
                <tr><td colSpan={4} className="admin-muted">OTP فعالی نیست</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
