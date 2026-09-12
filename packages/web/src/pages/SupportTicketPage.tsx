import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LifeBuoy, Send, Ticket } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { localeNum, useI18n } from '../i18n';
import {
  createSupportTicket,
  fetchSupportTickets,
  type SupportTicketSummary,
} from '../lib/api';

export function SupportTicketPage() {
  const { token, isLoggedIn } = useAuthStore();
  const { t, lang, dir } = useI18n();
  const ticketStatus = (status: string) => {
    if (status === 'open') return t('support.statusOpen');
    if (status === 'pending') return t('support.statusPending');
    if (status === 'closed') return t('support.statusClosed');
    if (status === 'answered') return t('support.statusAnswered');
    return status;
  };
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
        t('support.created', { id: localeNum(lang, res.ticket.publicId || String(res.ticket.id)) })
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('support.submitFail'));
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn || !token) {
    return (
      <div className="pepito-support-chat" dir={dir}>
        <header className="pepito-support-head">
          <Link to="/support" className="tg-icon-btn" aria-label={t('support.back')}>
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1>
              <Ticket size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
              {t('support.ticketCta')}
            </h1>
            <p>{t('support.ticketLoginLead')}</p>
          </div>
        </header>
        <p className="pepito-support-gate">
          <Link to="/auth/login">{t('common.login')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pepito-support-ticket" dir={dir}>
      <header className="pepito-support-head">
        <Link to="/support" className="tg-icon-btn" aria-label={t('support.backSupport')}>
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            {t('support.ticketCta')}
          </h1>
          <p>{t('support.ticketPageLead')}</p>
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
          <span>{t('support.subject')}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('support.subjectPh')}
            maxLength={200}
            disabled={busy}
            required
          />
        </label>
        <label>
          <span>{t('support.body')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('support.bodyPh')}
            rows={5}
            maxLength={4000}
            disabled={busy}
          />
        </label>
        <button type="submit" className="pepito-btn button-1" disabled={busy || !title.trim()}>
          <Send size={16} />
          {busy ? t('support.submitting') : t('support.submit')}
        </button>
      </form>

      {tickets.length ? (
        <section className="pepito-support-ticket-list" aria-label={t('support.myTickets')}>
          <h2>{t('support.recentTickets')}</h2>
          <ul>
            {tickets.map((row) => (
              <li key={row.uuid || row.id}>
                <strong>{row.title}</strong>
                <span>
                  {ticketStatus(row.status)} · {localeNum(lang, row.publicId || String(row.id))}
                </span>
                {row.lastPublicReply ? (
                  <p className="pepito-support-ticket-reply">{row.lastPublicReply}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="pepito-support-alt">
        {t('support.needBot')}{' '}
        <Link to="/support/chat">{t('support.chatCta')}</Link>
      </p>
    </div>
  );
}
