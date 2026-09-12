import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LifeBuoy, Send } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { fetchSupportMessages, sendSupportMessage, type SupportChatMessage } from '../lib/api';
import { AI_ASSISTANT_DISPLAY_NAME } from './supportAgent';

export function SupportChatPage() {
  const { token, isLoggedIn } = useAuthStore();
  const { t, dir } = useI18n();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetchSupportMessages(token);
      setMessages(res.messages);
      setWelcome(res.welcome);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('support.loadFail'));
    }
  }, [token]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !draft.trim() || busy) return;
    const text = draft.trim();
    setDraft('');
    setBusy(true);
    setError(null);
    setWelcome(null);
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', text, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await sendSupportMessage(token, text);
      setMessages(res.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('support.sendFail'));
      await load();
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
              <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
              {t('support.chatCta')}
            </h1>
            <p>{t('support.chatPageLead', { name: AI_ASSISTANT_DISPLAY_NAME })}</p>
          </div>
        </header>
        <p className="pepito-support-gate">
          {t('support.chatLoginLead')}{' '}
          <Link to="/auth/login">{t('common.login')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pepito-support-chat" dir={dir}>
      <header className="pepito-support-head">
        <Link to="/support" className="tg-icon-btn" aria-label={t('support.backSupport')}>
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            {t('support.chatCta')}
          </h1>
          <p>{t('support.chatPageLead', { name: AI_ASSISTANT_DISPLAY_NAME })}</p>
        </div>
      </header>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="pepito-support-thread" role="log" aria-live="polite">
        {welcome ? (
          <div className="pepito-support-bubble is-assistant">
            <p>{welcome}</p>
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`pepito-support-bubble ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}
          >
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.text}</p>
          </div>
        ))}
        {busy ? (
          <div className="pepito-support-bubble is-assistant is-typing">
            <p>{t('support.typing')}</p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="pepito-support-composer" onSubmit={(e) => void onSubmit(e)}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('support.messagePh')}
          disabled={busy}
          maxLength={4000}
          aria-label={t('support.messageAria')}
        />
        <button type="submit" className="pepito-btn button-1" disabled={busy || !draft.trim()}>
          <Send size={16} />
          {t('common.send')}
        </button>
      </form>
    </div>
  );
}
