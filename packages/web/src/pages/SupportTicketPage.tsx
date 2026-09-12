import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LifeBuoy, Send, Ticket } from 'lucide-react';
import { toPersianDigits } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import {
  createSupportTicket,
  fetchSupportTickets,
  type SupportTicketSummary,
} from '../lib/api';

export function SupportTicketPage() {
  const { token, isLoggedIn } = useAuthStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchSupportTickets(token);
      setTickets(res.tickets);
    } catch {
      /* list is secondary */
    }
  }, [token]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || busy) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await createSupportTicket(token, {
        title: title.trim(),
        description: description.trim(),
      });
      setTitle('');
      setDescription('');
      setOkMsg(
        `تیکت ثبت شد — کد ${toPersianDigits(res.ticket.publicId || String(res.ticket.id))}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت تیکت ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn || !token) {
    return (
      <div className="pepito-support-chat" dir="rtl">
        <header className="pepito-support-head">
          <Link to="/support" className="tg-icon-btn" aria-label="بازگشت">
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1>
              <Ticket size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
              ثبت تیکت
            </h1>
            <p>برای ثبت تیکت اول وارد حساب شو.</p>
          </div>
        </header>
        <p className="pepito-support-gate">
          <Link to="/auth/login">ورود</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pepito-support-ticket" dir="rtl">
      <header className="pepito-support-head">
        <Link to="/support" className="tg-icon-btn" aria-label="بازگشت به پشتیبانی">
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            ثبت تیکت
          </h1>
          <p>موضوع و شرح را بنویس — تیم پشتیبانی پیگیری می‌کند</p>
        </div>
      </header>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="pepito-support-ok" role="status">
          {okMsg}
        </p>
      ) : null}

      <form className="pepito-support-ticket-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          <span>موضوع</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً مشکل ورود یا پرداخت"
            maxLength={200}
            disabled={busy}
            required
          />
        </label>
        <label>
          <span>شرح</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="جزئیات را بنویس…"
            rows={5}
            maxLength={4000}
            disabled={busy}
          />
        </label>
        <button type="submit" className="pepito-btn button-1" disabled={busy || !title.trim()}>
          <Send size={16} />
          {busy ? 'در حال ثبت…' : 'ثبت تیکت'}
        </button>
      </form>

      {tickets.length ? (
        <section className="pepito-support-ticket-list" aria-label="تیکت‌های من">
          <h2>تیکت‌های اخیر</h2>
          <ul>
            {tickets.map((t) => (
              <li key={t.uuid || t.id}>
                <strong>{t.title}</strong>
                <span>
                  {t.status} · {toPersianDigits(t.publicId || String(t.id))}
                </span>
                {t.lastPublicReply ? (
                  <p className="pepito-support-ticket-reply">{t.lastPublicReply}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="pepito-support-alt">
        نیاز به پاسخ فوری داری؟{' '}
        <Link to="/support/chat">صحبت با بات پشتیبانی</Link>
      </p>
    </div>
  );
}
