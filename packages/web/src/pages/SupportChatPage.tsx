import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LifeBuoy, Send } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';
import { fetchSupportMessages, sendSupportMessage, type SupportChatMessage } from '../lib/api';

export function SupportChatPage() {
  const { token, isLoggedIn } = useAuthStore();
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
      setError(err instanceof Error ? err.message : 'بارگذاری ناموفق');
    }
  }, [token]);

  useEffect(() => {
    void load();
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
    // Optimistic user bubble
    const tempId = -Date.now();
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', text, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await sendSupportMessage(token, text);
      setMessages(res.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال ناموفق بود');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn || !token) {
    return (
      <div className="pepito-support-chat" dir="rtl">
        <header className="pepito-support-head">
          <Link to="/home" className="tg-icon-btn" aria-label="بازگشت">
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1>
              <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
              چت با پشتیبانی
            </h1>
            <p>دستیار هوشمند پت‌دیت راهنمایی‌ات می‌کند.</p>
          </div>
        </header>
        <p className="pepito-support-gate">
          برای گفتگو با پشتیبانی اول{' '}
          <Link to="/auth/login">وارد حساب</Link> شو.
        </p>
      </div>
    );
  }

  return (
    <div className="pepito-support-chat" dir="rtl">
      <header className="pepito-support-head">
        <Link to="/home" className="tg-icon-btn" aria-label="بازگشت">
          <ArrowRight size={18} />
        </Link>
        <div>
          <h1>
            <LifeBuoy size={22} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            چت با پشتیبانی
          </h1>
          <p>دستیار هوشمند — ورود، پت، همبازی، مربی، دامپزشک، شاپ و سکه</p>
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
            <p>در حال نوشتن…</p>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form className="pepito-support-composer" onSubmit={(e) => void onSubmit(e)}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="سؤالت را بنویس…"
          disabled={busy}
          maxLength={4000}
          aria-label="پیام پشتیبانی"
        />
        <button type="submit" className="pepito-btn button-1" disabled={busy || !draft.trim()}>
          <Send size={16} />
          ارسال
        </button>
      </form>
    </div>
  );
}
