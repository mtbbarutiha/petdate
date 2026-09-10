import { useState } from 'react';
import { adminFetch } from '../../api';

type Msg = { role: 'user' | 'assistant'; text: string };

export function AdminHrArmitaPage() {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: 'assistant',
    text: 'سلام، من آرمیتا هستم — دستیار قاعده‌محور (نه مدل زبانی واقعی). درباره پرسنل، مرخصی + نام همکار، کارتابل، استخدام یا مسیر شغلی بپرس.',
  }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await adminFetch<{ answer: string }>('/api/admin/hr/armita', { method: 'POST', body: JSON.stringify({ message }) });
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer }]);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>آرمیتا (دستیار هوشمند)</h1><p>پاسخ‌ها با تطبیق الگو از داده HR — صریحاً mock</p></div></header>
      {error ? <p className="admin-error">{error}</p> : null}
      <section className="admin-card" style={{ padding: 16, maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-start' : 'flex-end',
              background: m.role === 'user' ? 'rgba(99,102,241,.12)' : 'rgba(45,212,191,.12)',
              padding: '10px 12px', borderRadius: 12, maxWidth: '90%',
            }}>{m.text}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input className="admin-input" style={{ flex: 1 }} value={input} placeholder="سوال خود را بنویس…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} />
          <button type="button" className="admin-btn" disabled={busy} onClick={() => void send()}>ارسال</button>
        </div>
      </section>
    </div>
  );
}
