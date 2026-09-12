import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react';
import type { SalesSimulateIncoming } from '@petdate/shared';
import { SALES_CALL_RESULTS } from '@petdate/shared';
import { adminFetch } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { tr } from '../../../i18n';

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

function leadPath(item: NonNullable<CallState['matchedItem']>): string {
  const kind = item.kind === 'upgrade' ? 'upgrades' : 'leads';
  return `/admin/sales/${kind}/${item.id}`;
}

export function SalesCallSimProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<CallState | null>(null);
  const [wrapOpen, setWrapOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>(SALES_CALL_RESULTS[0]);
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
      navigate(leadPath(call.matchedItem));
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

  const matched = call?.matchedItem;
  const matchedName = matched ? `${matched.first} ${matched.last}`.trim() : '';

  return (
    <Ctx.Provider value={api}>
      {children}

      {call?.phase === 'ringing' ? (
        <div className="admin-sales-call-overlay" role="dialog" aria-modal="true" aria-label={tr("تماس ورودی")}>
          <div className="admin-sales-call-popup admin-sales-call-popup--ringing">
            <div className="admin-sales-call-popup-pulse" aria-hidden>
              <span />
              <span />
              <div className="admin-sales-call-popup-avatar">
                <PhoneIncoming size={36} strokeWidth={2} />
              </div>
            </div>
            <p className="admin-sales-call-popup-eyebrow">{tr('تماس ورودی')}</p>
            <h2 className="admin-sales-call-popup-phone" dir="ltr">
              {call.phone}
            </h2>
            {matched ? (
              <div className="admin-sales-call-popup-match">
                <strong>{matchedName || tr('لید شناسایی‌شده')}</strong>
                <span>
                  {tr('امتیاز')} {matched.score} · {matched.kind === 'upgrade' ? tr('آپگرید') : tr('لید')} · Pet Date
                </span>
              </div>
            ) : (
              <p className="admin-sales-call-popup-unknown">{tr('شماره در کارتابل پیدا نشد')}</p>
            )}
            <div className="admin-sales-call-popup-actions">
              <button type="button" className="admin-sales-call-btn admin-sales-call-btn--reject" onClick={reject}>
                <PhoneOff size={20} />
                {tr('رد')}
              </button>
              <button type="button" className="admin-sales-call-btn admin-sales-call-btn--answer" onClick={answer}>
                <Phone size={20} />
                {tr('پاسخ')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {call?.phase === 'active' ? (
        <div className="admin-sales-call-overlay" role="dialog" aria-modal="true" aria-label={tr("تماس فعال")}>
          <div className="admin-sales-call-popup admin-sales-call-popup--active">
            <div className="admin-sales-call-popup-avatar admin-sales-call-popup-avatar--live" aria-hidden>
              <Phone size={32} strokeWidth={2} />
            </div>
            <p className="admin-sales-call-popup-eyebrow">{tr('در حال مکالمه')}</p>
            <h2 className="admin-sales-call-popup-phone" dir="ltr">
              {call.phone}
            </h2>
            {matched ? (
              <div className="admin-sales-call-popup-match">
                <strong>{matchedName}</strong>
                <Link to={leadPath(matched)} className="admin-sales-call-popup-link">
                  {tr('باز کردن پرونده')}
                </Link>
              </div>
            ) : (
              <p className="admin-sales-call-popup-unknown">{tr('لید ناشناس · فقط ثبت نتیجه دستی')}</p>
            )}
            <div className="admin-sales-call-popup-actions">
              <button type="button" className="admin-sales-call-btn admin-sales-call-btn--reject" onClick={reject}>
                <PhoneOff size={20} />
                {tr('قطع')}
              </button>
              <button type="button" className="admin-sales-call-btn admin-sales-call-btn--answer" onClick={endCall}>
                <Phone size={20} />
                {tr('پایان و ثبت')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminModal
        open={wrapOpen}
        title={tr("ثبت نتیجه تماس ورودی")}
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
              {tr('ذخیره')}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setWrapOpen(false)}>
              {tr('انصراف')}
            </button>
          </>
        )}
      >
        <label>
          <span className="form-label">{tr('نتیجه')}</span>
          <select className="admin-select" value={result} onChange={(e) => setResult(e.target.value)}>
            {SALES_CALL_RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="form-label">{tr('خلاصه')}</span>
          <textarea
            className="form-input"
            rows={3}
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        {!call?.matchedItem ? (
          <p className="admin-muted">{tr('لید متناظر یافت نشد — فقط پاپ‌آپ بسته می‌شود.')}</p>
        ) : null}
      </AdminModal>
    </Ctx.Provider>
  );
}
