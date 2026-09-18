import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import {
  CALL_QA_INBOUND,
  CALL_QA_OUTBOUND,
  LEAD_FAILURE_REASONS,
  type SalesActivity,
  type SalesCall,
  type SalesFollowup,
  type SalesItem,
} from '@petdate/shared';
import { adminFetch } from '../../api';
import { AdminModal } from '../../AdminModal';
import { AdminBrandLoader } from '../../AdminBrandLoader';
import { tr } from '../../../i18n';

type ItemDetail = {
  item: SalesItem;
  activities: SalesActivity[];
  calls: SalesCall[];
  followups: SalesFollowup[];
  upgrades: SalesItem[];
  logs: SalesActivity[];
};

function intlMobile(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('98')) return d;
  if (d.startsWith('0')) return `98${d.slice(1)}`;
  return d;
}

export function LeadWorkspaceModal({
  itemId,
  onClose,
  onSaved,
}: {
  itemId: number | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [mobile, setMobile] = useState('');
  const [note, setNote] = useState('');
  const [petName, setPetName] = useState('');
  const [failure, setFailure] = useState('');
  const [remindAt, setRemindAt] = useState('');

  useEffect(() => {
    if (itemId == null) {
      setDetail(null);
      return;
    }
    setError(null);
    void adminFetch<ItemDetail>(`/api/admin/sales/items/${itemId}`)
      .then((d) => {
        setDetail(d);
        setFirst(d.item.first || '');
        setLast(d.item.last || '');
        setMobile(d.item.mobile || '');
        setFailure(d.item.failureOutcome || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, [itemId]);

  const phone = intlMobile(mobile);
  const logs = useMemo(() => detail?.logs || detail?.activities || [], [detail]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (itemId == null) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/items/${itemId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          first,
          last,
          mobile,
          note: note.trim() || undefined,
          petName: petName.trim() || undefined,
          failureOutcome: failure || undefined,
        }),
      });
      if (remindAt) {
        await adminFetch('/api/admin/sales/followups', {
          method: 'POST',
          body: JSON.stringify({
            refKind: detail?.item.kind || 'lead',
            refId: itemId,
            type: 'یادآوری',
            at: new Date(remindAt).toISOString(),
            desc: note.trim() || 'یادآوری پیگیری',
          }),
        });
      }
      onSaved?.();
      const next = await adminFetch<ItemDetail>(`/api/admin/sales/items/${itemId}`);
      setDetail(next);
      setNote('');
      setPetName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal open={itemId != null} onClose={onClose} title={tr('پرونده لید')} size="lg" busy={busy}>
      {error ? <p className="admin-error">{error}</p> : null}
      {!detail ? (error ? null : <AdminBrandLoader size="card" />) : (
        <form className="admin-form-grid" onSubmit={(e) => void save(e)}>
          <label>
            <span className="form-label">{tr('نام')}</span>
            <input className="form-input" value={first} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label>
            <span className="form-label">{tr('نام خانوادگی')}</span>
            <input className="form-input" value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
          <label>
            <span className="form-label">{tr('موبایل')}</span>
            <input className="form-input" dir="ltr" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </label>
          <label>
            <span className="form-label">{tr('منبع لید')}</span>
            <input className="form-input" readOnly value={detail.item.source || '—'} />
          </label>
          <p className="admin-muted admin-span-2">
            {tr('شناسه')} {detail.item.publicId} · {tr('کارشناس')} {detail.item.ownerName || '—'} · {tr('وضعیت پرداخت')} {detail.item.payStatus}
          </p>
          <div className="admin-span-2" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="admin-btn admin-btn--ghost" href={`sms:${phone || mobile}`}>{tr('پیامک')}</a>
            <a className="admin-btn admin-btn--ghost" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">{tr('واتساپ')}</a>
            <a className="admin-btn admin-btn--ghost" href={`https://t.me/+${phone}`} target="_blank" rel="noreferrer">{tr('تلگرام')}</a>
          </div>
          <label className="admin-span-2">
            <span className="form-label">{tr('یادداشت')}</span>
            <textarea className="form-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label>
            <span className="form-label">{tr('افزودن پت')}</span>
            <input className="form-input" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder={tr('نام پت')} />
          </label>
          <label>
            <span className="form-label">{tr('نتیجهٔ عدم موفقیت')}</span>
            <select className="admin-select" value={failure} onChange={(e) => setFailure(e.target.value)}>
              <option value="">{tr('انتخاب کنید')}</option>
              {LEAD_FAILURE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>
            <span className="form-label">{tr('یادآوری پیگیری')}</span>
            <input className="form-input" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          </label>
          <div className="admin-span-2">
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره پرونده')}</button>
          </div>
          <section className="admin-span-2">
            <h3>{tr('لاگ تماس و پیگیری')}</h3>
            <ul>
              {detail.calls.map((c) => (
                <li key={`c${c.id}`}>{c.startedAt} · {c.result} · {c.summary || c.dir}</li>
              ))}
              {detail.followups.map((f) => (
                <li key={`f${f.id}`}>{f.at} · {f.type} · {f.status}{f.note ? ` · ${f.note}` : ''}{f.parentId ? ` · ${tr('زنجیره')} #${f.parentId}` : ''}</li>
              ))}
              {!detail.calls.length && !detail.followups.length ? <li>{tr('لاگی نیست')}</li> : null}
            </ul>
          </section>
          <section className="admin-span-2">
            <h3>{tr('آپگرید و لاگ')}</h3>
            <ul>
              {detail.upgrades.map((u) => <li key={u.id}>{u.publicId} · {u.product} · {u.payStatus}</li>)}
              {logs.map((l) => <li key={l.id}>{l.at} · {l.kind} · {l.text}</li>)}
              {!detail.upgrades.length && !logs.length ? <li>{tr('رکوردی نیست')}</li> : null}
            </ul>
          </section>
        </form>
      )}
    </AdminModal>
  );
}

export function FollowupProgressModal({
  followup,
  onClose,
  onDone,
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [nextDesc, setNextDesc] = useState('');
  const [nextAt, setNextAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote('');
    setNextDesc(followup?.desc || '');
    setNextAt('');
    setError(null);
  }, [followup]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!followup) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/followups/${followup.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          note: note.trim() || 'ثبت شد',
          nextDesc: nextDesc.trim() || undefined,
          nextType: followup.type,
          nextAt: nextAt ? new Date(nextAt).toISOString() : undefined,
        }),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      open={!!followup}
      onClose={onClose}
      title={tr('پیگیری چندسطحی')}
      size="md"
      as="form"
      busy={busy}
      onSubmit={(e) => void submit(e)}
      footer={(
        <>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت و زنجیره')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>{tr('بستن')}</button>
        </>
      )}
    >
      {error ? <p className="admin-error">{error}</p> : null}
      <p className="admin-muted">{followup?.desc} · {followup?.type}</p>
      <label>
        <span className="form-label">{tr('یادداشت این مرحله')}</span>
        <textarea className="form-input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required />
      </label>
      <label>
        <span className="form-label">{tr('تعریف پیگیری بعدی')}</span>
        <input className="form-input" value={nextDesc} onChange={(e) => setNextDesc(e.target.value)} />
      </label>
      <label>
        <span className="form-label">{tr('زمان پیگیری بعدی')}</span>
        <input className="form-input" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
      </label>
    </AdminModal>
  );
}

function bucketOf(iso: string): 'today' | 'week' | 'later' {
  const t = new Date(iso).getTime();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const endToday = start.getTime() + 86400000;
  const endWeek = start.getTime() + 7 * 86400000;
  if (t < endToday) return 'today';
  if (t < endWeek) return 'week';
  return 'later';
}

export function FollowupTaskBoard({
  followups,
  onOpen,
  onMoved,
}: {
  followups: SalesFollowup[];
  onOpen: (f: SalesFollowup) => void;
  onMoved: () => void;
}) {
  const cols: Array<{ id: 'today' | 'week' | 'later'; title: string }> = [
    { id: 'today', title: 'امروز' },
    { id: 'week', title: 'این هفته' },
    { id: 'later', title: 'بعداً' },
  ];

  const drop = async (col: 'today' | 'week' | 'later', ev: DragEvent) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData('text/plain'));
    if (!id) return;
    const base = new Date();
    base.setHours(9, 0, 0, 0);
    if (col === 'week') base.setDate(base.getDate() + 2);
    if (col === 'later') base.setDate(base.getDate() + 8);
    await adminFetch(`/api/admin/sales/followups/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        note: 'جابه‌جایی در مدیریت وظایف',
        nextAt: base.toISOString(),
        nextDesc: 'ادامه پیگیری',
        nextType: 'پیگیری',
      }),
    });
    onMoved();
  };

  return (
    <div className="sales-pipe-board" aria-label={tr('مدیریت وظایف روزانه')}>
      {cols.map((col) => (
        <section
          key={col.id}
          className="sales-pipe-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void drop(col.id, e)}
        >
          <header className="sales-pipe-col-head"><h2>{tr(col.title)}</h2></header>
          <div className="sales-pipe-col-body">
            {followups.filter((f) => f.status === 'باز' && bucketOf(f.at) === col.id).map((f) => (
              <button
                key={f.id}
                type="button"
                className="sales-pipe-card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(f.id))}
                onClick={() => onOpen(f)}
              >
                <strong>{f.desc || f.type}</strong>
                <span className="admin-muted">{f.at}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CallScorecardModal({
  call,
  onClose,
  onSaved,
}: {
  call: SalesCall | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dims = call?.dir === 'call_in' ? CALL_QA_INBOUND : CALL_QA_OUTBOUND;
  const [scores, setScores] = useState<number[]>(() => dims.map(() => 8));
  const [customerScore, setCustomerScore] = useState('8');
  const [busy, setBusy] = useState(false);
  const [listen, setListen] = useState<{ liveListen?: boolean; recordingUrl?: string; stub?: string } | null>(null);

  useEffect(() => {
    setScores(dims.map(() => 8));
    setCustomerScore(call?.customerScore != null ? String(call.customerScore) : '8');
    if (!call) return;
    void adminFetch<{ liveListen?: boolean; recordingUrl?: string }>(`/api/admin/sales/calls/${call.id}/listen`)
      .then(setListen)
      .catch(() => setListen(null));
  }, [call, dims]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!call) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/calls/${call.id}/qa`, {
        method: 'POST',
        body: JSON.stringify({ scores, customerScore: Number(customerScore) }),
      });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const setListenFlag = async (live: boolean) => {
    if (!call) return;
    const saved = await adminFetch<{ liveListen?: boolean; recordingUrl?: string; stub?: string }>(
      `/api/admin/sales/calls/${call.id}/listen`,
      { method: 'POST', body: JSON.stringify({ liveListen: live, recordingUrl: listen?.recordingUrl || '' }) }
    );
    setListen(saved);
  };

  return (
    <AdminModal
      open={!!call}
      onClose={onClose}
      title={tr('کارت ارزیابی تماس')}
      size="lg"
      as="form"
      busy={busy}
      onSubmit={(e) => void save(e)}
      footer={(
        <>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره روی پرونده کارشناس')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>{tr('بستن')}</button>
        </>
      )}
    >
      <p className="admin-muted">{call?.dir === 'call_in' ? tr('شاخص‌های ورودی') : tr('شاخص‌های خروجی')} · {call?.agentName}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" className="admin-btn" onClick={() => void setListenFlag(true)}>{tr('شنود آنلاین')}</button>
        <button type="button" className="admin-btn" onClick={() => void setListenFlag(false)}>{tr('شنود بعد از پایان مکالمه')}</button>
      </div>
      {listen?.stub ? <p className="admin-muted">{listen.stub}</p> : <p className="admin-muted">{tr('PBX زنده وصل نیست — پرچم و آدرس ضبط ذخیره می‌شود.')}</p>}
      <label>
        <span className="form-label">{tr('آدرس ضبط')}</span>
        <input
          className="form-input"
          dir="ltr"
          value={listen?.recordingUrl || ''}
          onChange={(e) => setListen((prev) => ({ ...(prev || {}), recordingUrl: e.target.value }))}
          onBlur={() => {
            if (!call) return;
            void adminFetch(`/api/admin/sales/calls/${call.id}/listen`, {
              method: 'POST',
              body: JSON.stringify({ recordingUrl: listen?.recordingUrl || '', liveListen: Boolean(listen?.liveListen) }),
            });
          }}
        />
      </label>
      {listen?.recordingUrl ? <audio controls src={listen.recordingUrl} style={{ width: '100%', marginTop: 8 }} /> : null}
      {dims.map((label, i) => (
        <label key={label}>
          <span className="form-label">{label} (۰–۱۰)</span>
          <input
            className="form-input"
            type="number"
            min={0}
            max={10}
            value={scores[i] ?? 0}
            onChange={(e) => {
              const next = scores.slice();
              next[i] = Number(e.target.value);
              setScores(next);
            }}
          />
        </label>
      ))}
      <label>
        <span className="form-label">{tr('امتیاز مشتری')}</span>
        <input className="form-input" type="number" min={0} max={10} value={customerScore} onChange={(e) => setCustomerScore(e.target.value)} />
      </label>
    </AdminModal>
  );
}
