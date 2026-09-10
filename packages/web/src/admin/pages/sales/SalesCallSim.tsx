import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SalesSimulateIncoming } from '@petdate/shared';
import { SALES_CALL_RESULTS } from '@petdate/shared';
import { adminFetch } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

type CallPhase = 'ringing' | 'active' | null;

type CallState = {
  phase: CallPhase;
  phone: string;
  matchedItem: SalesSimulateIncoming['matchedItem'];
};

type SalesCallSimApi = {
  call: CallState | null;
  simulateIncoming: () => Promise<void>;
  answer: () => void;
  reject: () => void;
  endCall: () => void;
};

const Ctx = createContext<SalesCallSimApi | null>(null);

export function useSalesCallSim(): SalesCallSimApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('SalesCallSimProvider missing');
  return v;
}

export function useSalesCallSimOptional(): SalesCallSimApi | null {
  return useContext(Ctx);
}

export function SalesCallSimProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<CallState | null>(null);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(SALES_CALL_RESULTS[0]);
  const [summary, setSummary] = useState('');
  const navigate = useNavigate();

  const simulateIncoming = useCallback(async () => {
    if (!adminCan('sales.write') && !adminCan('admin.full')) return;
    const data = await adminFetch<SalesSimulateIncoming>('/api/admin/sales/simulate-incoming', {
      method: 'POST',
      body: '{}',
    });
    setCall({ phase: 'ringing', phone: data.phone, matchedItem: data.matchedItem });
  }, []);

  const answer = useCallback(() => {
    setCall((c) => (c ? { ...c, phase: 'active' } : c));
  }, []);

  const reject = useCallback(() => {
    setCall(null);
    setWrapOpen(false);
  }, []);

  const endCall = useCallback(() => {
    setResult(SALES_CALL_RESULTS[0]);
    setSummary('');
    setWrapOpen(true);
  }, []);

  const finishWrap = useCallback(async () => {
    if (!call?.matchedItem || !summary.trim()) {
      setCall(null);
      setWrapOpen(false);
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/items/${call.matchedItem.id}/calls`, {
        method: 'POST',
        body: JSON.stringify({
          dir: 'call_in',
          result,
          summary: summary.trim(),
          talk: 3,
        }),
      });
      const kind = call.matchedItem.kind === 'upgrade' ? 'upgrades' : 'leads';
      navigate(`/admin/sales/${kind}/${call.matchedItem.id}`);
    } finally {
      setBusy(false);
      setCall(null);
      setWrapOpen(false);
    }
  }, [call, navigate, result, summary]);

  const api = useMemo(
    () => ({ call, simulateIncoming, answer, reject, endCall }),
    [call, simulateIncoming, answer, reject, endCall]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {call?.phase === 'ringing' ? (
        <div className="admin-sales-callbar" role="status">
          <span className="admin-sales-callbar-dot" />
          <b>تماس ورودی · {call.phone}</b>
          {call.matchedItem ? (
            <span className="admin-pill">
              {call.matchedItem.first} {call.matchedItem.last} · امتیاز {call.matchedItem.score}
            </span>
          ) : (
            <span className="admin-pill">لید ناشناس</span>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="admin-btn admin-btn--primary" onClick={answer}>پاسخ</button>
          <button type="button" className="admin-btn" onClick={reject}>رد</button>
        </div>
      ) : null}
      {call?.phase === 'active' ? (
        <div className="admin-sales-callbar admin-sales-callbar--active" role="status">
          <span className="admin-sales-callbar-dot admin-sales-callbar-dot--live" />
          <b>در تماس · {call.phone}</b>
          {call.matchedItem ? (
            <Link
              to={`/admin/sales/${call.matchedItem.kind === 'upgrade' ? 'upgrades' : 'leads'}/${call.matchedItem.id}`}
              className="admin-pill"
            >
              باز کردن پرونده
            </Link>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" className="admin-btn admin-btn--primary" onClick={endCall}>پایان و ثبت</button>
          <button type="button" className="admin-btn" onClick={reject}>قطع</button>
        </div>
      ) : null}
      <AdminModal
        open={wrapOpen}
        title="ثبت نتیجه تماس ورودی"
        onClose={() => !busy && setWrapOpen(false)}
        size="sm"
        as="form"
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          void finishWrap();
        }}
        footer={(
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || !summary.trim()}>
              ذخیره
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setWrapOpen(false)}>
              انصراف
            </button>
          </>
        )}
      >
        <label>
          <span className="form-label">نتیجه</span>
          <select className="admin-select" value={result} onChange={(e) => setResult(e.target.value)}>
            {SALES_CALL_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">خلاصه</span>
          <textarea className="form-input" rows={3} required value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        {!call?.matchedItem ? <p className="admin-muted">لید متناظر یافت نشد — فقط نوار تماس بسته می‌شود.</p> : null}
      </AdminModal>
    </Ctx.Provider>
  );
}
