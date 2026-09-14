import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Send } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { fetchSupportMessages, sendSupportMessage, type SupportChatMessage } from '../lib/api';
import {
  ChatReplyActionButton,
  ChatReplyComposerBar,
  ChatReplyQuote,
  type ChatReplyTarget,
} from '../components/ChatReply';
import { AI_ASSISTANT_DISPLAY_NAME, AI_SUPPORT_AVATAR_URL } from './supportAgent';

export function SupportChatPage() {
  const { token, isLoggedIn } = useAuthStore();
  const { t, dir } = useI18n();
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatReplyTarget | null>(null);
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
  }, [token, t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  function beginReplyTo(m: SupportChatMessage) {
    setReplyTo({
      id: m.id,
      fromLabel:
        m.role === 'user' ? t('support.replyYou') : AI_ASSISTANT_DISPLAY_NAME,
      text: m.text,
    });
  }

  function scrollToMessage(id: number) {
    const el = document.getElementById(`support-msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('is-flash');
    window.setTimeout(() => el.classList.remove('is-flash'), 1200);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !draft.trim() || busy) return;
    const text = draft.trim();
    const replyId = replyTo?.id ?? null;
    const replySnapshot = replyTo;
    setDraft('');
    setReplyTo(null);
    setBusy(true);
    setError(null);
    setWelcome(null);
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
        replyToId: replyId,
        replyTo: replySnapshot
          ? {
              id: replySnapshot.id,
              text: replySnapshot.text,
              role: replySnapshot.fromLabel === AI_ASSISTANT_DISPLAY_NAME ? 'assistant' : 'user',
            }
          : null,
      },
    ]);
    try {
      const res = await sendSupportMessage(token, text, { replyToId: replyId });
      setMessages(res.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('support.sendFail'));
      if (replySnapshot) setReplyTo(replySnapshot);
      setDraft(text);
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img
              src={AI_SUPPORT_AVATAR_URL}
              alt={AI_ASSISTANT_DISPLAY_NAME}
              width={48}
              height={56}
              style={{ borderRadius: 12, objectFit: 'cover' }}
            />
            <div>
              <h1 style={{ margin: 0 }}>{AI_ASSISTANT_DISPLAY_NAME}</h1>
              <p style={{ margin: '4px 0 0' }}>{t('support.chatPageLead', { name: AI_ASSISTANT_DISPLAY_NAME })}</p>
            </div>
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img
            src={AI_SUPPORT_AVATAR_URL}
            alt={AI_ASSISTANT_DISPLAY_NAME}
            width={48}
            height={56}
            style={{ borderRadius: 12, objectFit: 'cover' }}
          />
          <div>
            <h1 style={{ margin: 0 }}>{AI_ASSISTANT_DISPLAY_NAME}</h1>
            <p style={{ margin: '4px 0 0' }}>{t('support.chatPageLead', { name: AI_ASSISTANT_DISPLAY_NAME })}</p>
          </div>
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
            id={m.id > 0 ? `support-msg-${m.id}` : undefined}
            className={`pepito-support-bubble ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}
          >
            {m.replyTo ? (
              <ChatReplyQuote
                fromLabel={
                  m.replyTo.role === 'assistant'
                    ? AI_ASSISTANT_DISPLAY_NAME
                    : t('support.replyYou')
                }
                text={m.replyTo.text}
                onClick={() => scrollToMessage(m.replyTo!.id)}
              />
            ) : null}
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.text}</p>
            {m.id > 0 ? (
              <div className="pepito-support-bubble-meta">
                <ChatReplyActionButton onClick={() => beginReplyTo(m)} />
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="pepito-support-bubble is-assistant is-typing">
            <p>{t('support.typing')}</p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {replyTo ? (
        <ChatReplyComposerBar target={replyTo} onCancel={() => setReplyTo(null)} />
      ) : null}

      <form className="pepito-support-composer" onSubmit={(e) => void onSubmit(e)}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={replyTo ? t('support.replyPh') : t('support.messagePh')}
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
