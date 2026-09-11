import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getTeamAgentBySlug, teamAgentChatPath } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { startTeamAgentChat } from '../lib/api';
import { loginPath } from '../lib/authRedirect';

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function TeamChatStartPage() {
  const { agentSlug = '' } = useParams();
  const navigate = useNavigate();
  const { user, token, isLoggedIn, hasRole, isProfileComplete } = useAuthStore();
  const agent = getTeamAgentBySlug(agentSlug);
  const [error, setError] = useState<string | null>(null);
  const ready = isLoggedIn && hasRole && isProfileComplete;
  const next = teamAgentChatPath(agentSlug);

  useEffect(() => {
    if (!agent || !ready || !user?.id || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await startTeamAgentChat(agent.slug, user.id, token);
        const id = res.consultations?.[0]?.id;
        if (!id) throw new Error('گفتگو ساخته نشد');
        if (!cancelled) navigate(`/vet-chats/${id}`, { replace: true });
      } catch (err) {
        if (!cancelled) setError(errMessage(err, 'شروع گفتگو ناموفق بود'));
      }
    })();
    return () => { cancelled = true; };
  }, [agent, ready, user?.id, token, navigate]);

  if (!agent) {
    return (
      <main className="pepito-section" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1>ایجنت پیدا نشد</h1>
        <p><Link to="/#team" className="pepito-btn button-3">بازگشت به تیم</Link></p>
      </main>
    );
  }
  if (!isLoggedIn || !hasRole || !isProfileComplete) {
    return <Navigate to={loginPath(next)} replace />;
  }
  return (
    <main className="pepito-section" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <img src={agent.avatarUrl} alt={agent.name} width={120} height={140} style={{ borderRadius: 16, objectFit: 'cover' }} />
      <h1 style={{ marginTop: 16 }}>{agent.name}</h1>
      <p>{agent.role}</p>
      {error ? (
        <>
          <p style={{ color: '#c0392b' }}>{error}</p>
          <button type="button" className="pepito-btn button-3" onClick={() => { setError(null); navigate(0); }}>تلاش دوباره</button>
        </>
      ) : (
        <p>در حال باز کردن مشاوره آنلاین…</p>
      )}
    </main>
  );
}
