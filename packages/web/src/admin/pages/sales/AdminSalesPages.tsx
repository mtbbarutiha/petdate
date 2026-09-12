import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  SalesCall, SalesCustomer, SalesGoal, SalesItem, SalesItemKind, SalesPattern, SalesProduct,
  SalesReportSummary, SalesSettings, SalesTicket,
} from '@petdate/shared';
import {
  SALES_CALL_RESULTS, SALES_LEAD_SOURCES, SALES_LOST_REASONS, SALES_MESSAGE_CHANNELS,
  SALES_PRIORITIES, SALES_STAGES, SALES_TICKET_CATEGORIES, SALES_TICKET_DEPTS,
  SALES_TICKET_STATUSES, salesStageLabel,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { formatAdminFaDate, formatAdminFaDateTime } from '../../JalaliDateSelect';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { usePlatformDropdownOptions } from '../../usePlatformDropdownOptions';
import { useSalesCallSimOptional } from './SalesCallSim';
import { tr } from '../../../i18n';

function ItemsPage({ kind }: { kind: SalesItemKind }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<SalesItem[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ first: '', last: '', mobile: '', product: '', source: '' });
  const canWrite = adminCan('sales.write');
  const title = kind === 'lead' ? 'لیدها' : 'آپگریدها';
  const { options: leadSourceOpts } = usePlatformDropdownOptions('sales', 'lead_sources', SALES_LEAD_SOURCES);
  const leadSources = leadSourceOpts.map((o) => o.label);
  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ kind, limit: '100' });
      if (q.trim()) qs.set('q', q.trim());
      if (stage) qs.set('stage', stage);
      if (unassignedOnly) qs.set('unassignedOnly', '1');
      const data = await adminFetch<{ total: number; items: SalesItem[] }>(`/api/admin/sales/items?${qs}`);
      setItems(data.items); setTotal(data.total); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'خطا'); }
  }, [kind, q, stage, unassignedOnly]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void adminFetch<{ products: SalesProduct[] }>('/api/admin/sales/products?activeOnly=1').then((d) => setProducts(d.products)).catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first.trim() || !form.mobile.trim()) return;
    setBusy(true);
    try {
      const d = await adminFetch<{ item: SalesItem }>('/api/admin/sales/items', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          first: form.first.trim(),
          last: form.last.trim() || undefined,
          mobile: form.mobile.trim(),
          product: form.product || products[0]?.name,
          source: form.source || (kind === 'lead' ? (leadSources[0] || SALES_LEAD_SOURCES[0]) : 'امور فروش'),
        }),
      });
      setOpen(false);
      navigate(`/admin/sales/${kind === 'lead' ? 'leads' : 'upgrades'}/${d.item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>{title}</h1><p>{formatNumFa(total)} {tr('مورد · Pet Date')}</p></div>
        {canWrite ? (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => {
              setForm({
                first: '',
                last: '',
                mobile: '',
                product: products[0]?.name || '',
                source: kind === 'lead' ? (leadSources[0] || SALES_LEAD_SOURCES[0]) : 'امور فروش',
              });
              setOpen(true);
            }}
          >
            {tr('+ جدید')}
          </button>
        ) : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-toolbar">
        <input className="admin-input" placeholder={tr("جستجو…")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="admin-select" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">{tr('همه مراحل')}</option>
          {SALES_STAGES.map((s, i) => <option key={s} value={String(i)}>{s}</option>)}
          <option value="lost">{tr('ازدست‌رفته')}</option>
        </select>
        <label className="admin-check"><input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} /> {tr('فقط بدون تخصیص')}</label>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>{tr('نام')}</th><th>{tr('محصول')}</th><th>{tr('منبع')}</th><th>{tr('امتیاز')}</th><th>{tr('مرحله')}</th><th>{tr('پرداخت')}</th><th>{tr('کارشناس')}</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id}>
            <td><Link to={`/admin/sales/${kind === 'lead' ? 'leads' : 'upgrades'}/${i.id}`}>{i.publicId}</Link><div>{i.first} {i.last}</div><div className="admin-muted">{i.mobile}</div></td>
            <td>{i.product}<div className="admin-muted">{formatNumFa(i.value)} {tr('ت')}</div></td>
            <td>{i.source}</td><td>{formatNumFa(i.score)}</td><td>{salesStageLabel(i.stage)}</td><td>{i.payStatus}</td>
            <td>{i.ownerName ? (
              <AdminEntityCell
                thumb={<AdminThumb src={i.ownerAvatarUrl} label={i.ownerName} kind="user" size={28} />}
                title={i.ownerName}
              />
            ) : (canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/sales/items/${i.id}/claim`, { method: 'POST', body: '{}' }).then(load)}>{tr('برداشتن')}</button> : '—')}</td>
          </tr>
        ))}{!items.length ? <tr><td colSpan={7}>{tr('خالی')}</td></tr> : null}</tbody>
      </table></div>

      <AdminModal
        open={open}
        title={kind === 'lead' ? tr('لید جدید') : tr('آپگرید جدید')}
        onClose={() => !busy && setOpen(false)}
        size="sm"
        as="form"
        onSubmit={(e) => void submit(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ایجاد')}</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>{tr('انصراف')}</button>
          </>
        }
      >
        <label>
          <span className="form-label">{tr('نام')}</span>
          <input className="form-input" required value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
        </label>
        <label>
          <span className="form-label">{tr('نام خانوادگی')}</span>
          <input className="form-input" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
        </label>
        <label>
          <span className="form-label">{tr('موبایل')}</span>
          <input className="form-input" dir="ltr" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </label>
        <label>
          <span className="form-label">{tr('محصول')}</span>
          <select className="admin-select" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
            <option value="">—</option>
            {products.map((pr) => <option key={pr.id} value={pr.name}>{pr.name}</option>)}
          </select>
        </label>
        {kind === 'lead' ? (
          <label>
            <span className="form-label">{tr('منبع')}</span>
            <select className="admin-select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        ) : null}
      </AdminModal>
    </div>
  );
}

export function AdminSalesLeadsPage() { return <ItemsPage kind="lead" />; }
export function AdminSalesUpgradesPage() { return <ItemsPage kind="upgrade" />; }

function ItemDetail({ kind }: { kind: SalesItemKind }) {
  const { id } = useParams();
  const { options: lostReasonOpts } = usePlatformDropdownOptions(
    kind === 'upgrade' ? 'upgrade' : 'sales',
    'lost_reasons',
    SALES_LOST_REASONS
  );
  const { options: callResultOpts } = usePlatformDropdownOptions(
    kind === 'upgrade' ? 'upgrade' : 'sales',
    'call_results',
    SALES_CALL_RESULTS
  );
  const lostReasons = lostReasonOpts.map((o) => o.label);
  const callResults = callResultOpts.map((o) => o.label);
  const [data, setData] = useState<{
    item: SalesItem; activities: { id: number; at: string; text: string }[];
    offers: { id: number; product: string; final: number; discount: number; approvalStatus: string }[];
    payments: { id: number; amount: number; type: string; status: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'call' | 'offer' | 'lost'>(null);
  const [busy, setBusy] = useState(false);
  const [callForm, setCallForm] = useState<{ result: string; summary: string }>({
    result: SALES_CALL_RESULTS[0],
    summary: '',
  });
  const [offerDiscount, setOfferDiscount] = useState('0');
  const [lostReason, setLostReason] = useState<string>(SALES_LOST_REASONS[0]);
  const canWrite = adminCan('sales.write');
  const canAdmin = adminCan('sales.admin');
  const base = kind === 'lead' ? '/admin/sales/leads' : '/admin/sales/upgrades';
  useEffect(() => {
    if (lostReasons[0]) setLostReason((prev) => (lostReasons.includes(prev) ? prev : lostReasons[0]));
  }, [lostReasons]);
  useEffect(() => {
    if (callResults[0]) {
      setCallForm((prev) =>
        callResults.includes(prev.result) ? prev : { ...prev, result: callResults[0] }
      );
    }
  }, [callResults]);
  const reload = useCallback(async () => {
    if (!id) return;
    try { setData(await adminFetch(`/api/admin/sales/items/${id}`)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'خطا'); }
  }, [id]);
  useEffect(() => { void reload(); }, [reload]);
  const act = async (path: string, body?: unknown) => {
    try { await adminFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'خطا'); throw e; }
  };
  if (!data) return <div className="admin-page"><p>{error || '…'}</p></div>;
  const { item } = data;
  const lastPayment = data.payments[0];
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><p className="admin-topbar-eyebrow"><Link to={base}>{tr('← بازگشت')}</Link></p>
          <h1>{item.first} {item.last} · {item.publicId}</h1>
          <p>{item.mobile} · {item.product} · {formatNumFa(item.value)} {tr('ت ·')} {salesStageLabel(item.stage)}</p></div>
        <span className="admin-topbar-chip">{item.payStatus}</span>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {canWrite ? (
        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="admin-btn" onClick={() => { setCallForm({ result: callResults[0] || SALES_CALL_RESULTS[0], summary: '' }); setModal('call'); }}>{tr('تماس')}</button>
          <button type="button" className="admin-btn" onClick={() => { setOfferDiscount('0'); setModal('offer'); }}>{tr('پیشنهاد')}</button>
          <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/items/${item.id}/advance`)}>{tr('پیشرفت')}</button>
          <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/items/${item.id}/payment-link`)}>{tr('لینک پرداخت')}</button>
          {lastPayment?.status === 'لینک ارسال‌شده' ? <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-inquiry`)}>{tr('استعلام مالی')}</button> : null}
          {canAdmin && lastPayment?.status === 'در حال بررسی مالی' ? (
            <>
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-decide`, { approve: true })}>{tr('تایید مالی')}</button>
              <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-decide`, { approve: false })}>{tr('رد مالی')}</button>
            </>
          ) : null}
          <button type="button" className="admin-btn" onClick={() => { setLostReason(lostReasons[0] || SALES_LOST_REASONS[0]); setModal('lost'); }}>{tr('ازدست‌رفته')}</button>
          {SALES_MESSAGE_CHANNELS.slice(0, 2).map((ch) => (
            <button key={ch} type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/items/${item.id}/messages`, { channel: ch, text: `پیام ${ch}` })}>{ch}</button>
          ))}
        </div>
      ) : null}
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head"><h2>{tr('تاریخچه')}</h2></div>
        <ul>{data.activities.map((a) => <li key={a.id}>{formatAdminFaDateTime(a.at)} — {tr(a.text)}</li>)}</ul>
        <div className="admin-card-head"><h2>{tr('پیشنهاد / پرداخت')}</h2></div>
        {data.offers.map((o) => <div key={o.id}>{o.product} · {formatNumFa(o.final)} · {o.discount}% · {o.approvalStatus}
          {canAdmin && o.approvalStatus === 'در انتظار تایید' ? (
            <><button type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/offers/${o.id}/decide`, { approve: true })}>{tr('تایید')}</button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/offers/${o.id}/decide`, { approve: false })}>{tr('رد')}</button></>
          ) : null}</div>)}
        {data.payments.map((p) => <div key={p.id}>{formatNumFa(p.amount)} · {p.type} · {p.status}</div>)}
      </section>

      <AdminModal open={modal === 'call'} title={tr("ثبت تماس")} onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (!callForm.summary.trim()) return;
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/calls`, { result: callForm.result, summary: callForm.summary, talk: 5, advance: true })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('نتیجه')}</span>
          <select className="admin-select" value={callForm.result} onChange={(e) => setCallForm({ ...callForm, result: e.target.value })}>
            {callResults.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <label><span className="form-label">{tr('خلاصه')}</span>
          <textarea className="form-input" required rows={3} value={callForm.summary} onChange={(e) => setCallForm({ ...callForm, summary: e.target.value })} /></label>
      </AdminModal>

      <AdminModal open={modal === 'offer'} title={tr("پیشنهاد تخفیف")} onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/offers`, { discount: Number(offerDiscount) || 0 })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('تخفیف ٪')}</span>
          <input className="form-input" type="number" value={offerDiscount} onChange={(e) => setOfferDiscount(e.target.value)} /></label>
      </AdminModal>

      <AdminModal open={modal === 'lost'} title={tr("علامت ازدست‌رفته")} onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/lost`, { reason: lostReason })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('دلیل')}</span>
          <select className="admin-select" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
            {lostReasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
      </AdminModal>
    </div>
  );
}
export function AdminSalesLeadDetailPage() { return <ItemDetail kind="lead" />; }
export function AdminSalesUpgradeDetailPage() { return <ItemDetail kind="upgrade" />; }

function salesPipeTone(stage: number | 'lost'): string {
  if (stage === 'lost') return 'lost';
  if (stage === 0) return 'new';
  if (stage === 1) return 'assigned';
  if (stage === 2 || stage === 3) return 'contact';
  if (stage === 4 || stage === 5) return 'qualify';
  if (stage === 6) return 'pay';
  if (stage === 7) return 'won';
  return 'new';
}

export function AdminSalesPipelinePage() {
  const [stages, setStages] = useState<{ stage: number | 'lost'; label: string; items: SalesItem[]; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SalesItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const canWrite = adminCan('sales.write');

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<{ stages: typeof stages }>('/api/admin/sales/pipeline');
      setStages(d.stages);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return null;
      return stages.flatMap((s) => s.items).find((i) => i.id === prev.id) || prev;
    });
  }, [stages]);

  const detailPath = (item: SalesItem) =>
    `/admin/sales/${item.kind === 'lead' ? 'leads' : 'upgrades'}/${item.id}`;

  const advanceSelected = async () => {
    if (!selected || !canWrite) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/items/${selected.id}/advance`, { method: 'POST', body: '{}' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const onDropAdvance = async (targetStage: number | 'lost') => {
    if (dragId == null || !canWrite || targetStage === 'lost') {
      setDragId(null);
      return;
    }
    const item = stages.flatMap((s) => s.items).find((i) => i.id === dragId);
    setDragId(null);
    if (!item || typeof item.stage !== 'number') return;
    // Preserve sales rules: only allow drop onto the immediate next stage.
    if (targetStage !== item.stage + 1) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/sales/items/${item.id}/advance`, { method: 'POST', body: '{}' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const totalDeals = stages.reduce((n, s) => n + s.items.length, 0);
  const totalValue = stages.reduce((n, s) => n + s.value, 0);
  const canAdvanceSelected =
    !!selected && typeof selected.stage === 'number' && selected.stage < 6;

  return (
    <div className="admin-page sales-pipe-page">
      <header className="admin-header">
        <div>
          <h1>{tr('پایپ‌لاین')}</h1>
          <p>{tr('قیف فروش Pet Date')}</p>
        </div>
        <div className="sales-pipe-summary" aria-live="polite">
          <span className="admin-topbar-chip">{formatNumFa(totalDeals)} {tr('معامله')}</span>
          <span className="admin-topbar-chip">{formatNumFa(totalValue)} {tr('ت')}</span>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {loading && !stages.length ? <p className="admin-muted">{tr('در حال بارگذاری…')}</p> : null}

      <div className="sales-pipe-board" role="list" aria-label={tr("مراحل قیف فروش")}>
        {stages.map((s) => {
          const tone = salesPipeTone(s.stage);
          return (
            <section
              key={String(s.stage)}
              className={`sales-pipe-col sales-pipe-col--${tone}`}
              role="listitem"
              onDragOver={(e) => {
                if (!canWrite || dragId == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                void onDropAdvance(s.stage);
              }}
            >
              <header className="sales-pipe-col-head">
                <div className="sales-pipe-col-title">
                  <h2>{tr(s.label)}</h2>
                  <span className="sales-pipe-count">{formatNumFa(s.items.length)}</span>
                </div>
                <p className="sales-pipe-col-value">{formatNumFa(s.value)} {tr('تومان')}</p>
              </header>

              <div className="sales-pipe-col-body">
                {s.items.length ? (
                  s.items.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`sales-pipe-card${dragId === i.id ? ' is-dragging' : ''}`}
                      draggable={canWrite && typeof i.stage === 'number' && i.stage < 6}
                      onDragStart={(e) => {
                        setDragId(i.id);
                        e.dataTransfer.setData('text/plain', String(i.id));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setSelected(i)}
                    >
                      <div className="sales-pipe-card-top">
                        <strong className="sales-pipe-card-name">{i.first} {i.last}</strong>
                        <span className={`sales-pipe-kind sales-pipe-kind--${i.kind}`}>
                          {i.kind === 'lead' ? tr('لید') : tr('آپگرید')}
                        </span>
                      </div>
                      <div className="sales-pipe-card-product">{i.product || '—'}</div>
                      <div className="sales-pipe-card-bot">
                        <span className="sales-pipe-card-value">{formatNumFa(i.value)} {tr('ت')}</span>
                        {i.ownerName ? (
                          <span className="sales-pipe-card-owner" title={i.ownerName}>
                            <AdminThumb src={i.ownerAvatarUrl} label={i.ownerName} kind="user" size={22} />
                            <span>{i.ownerName}</span>
                          </span>
                        ) : (
                          <span className="admin-muted">{tr('بدون کارشناس')}</span>
                        )}
                      </div>
                      <div className="sales-pipe-card-meta">
                        <span className="admin-muted">{i.publicId}</span>
                        <span className="admin-muted">{i.payStatus}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="sales-pipe-empty">
                    <p>{tr('معامله‌ای در این مرحله نیست')}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <AdminModal
        open={!!selected}
        title={selected ? `${selected.first} ${selected.last}` : tr('معامله')}
        onClose={() => !busy && setSelected(null)}
        size="md"
        busy={busy}
        footer={
          selected ? (
            <>
              {canWrite && canAdvanceSelected ? (
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void advanceSelected()}>
                  {tr('پیشرفت مرحله')}
                </button>
              ) : null}
              <Link className="admin-btn" to={detailPath(selected)} onClick={() => setSelected(null)}>
                {tr('صفحه جزئیات')}
              </Link>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setSelected(null)}>
                {tr('بستن')}
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="sales-pipe-detail">
            <div className="sales-pipe-detail-grid">
              <div>
                <span className="form-label">{tr('کد')}</span>
                <div>{selected.publicId}</div>
              </div>
              <div>
                <span className="form-label">{tr('نوع')}</span>
                <div>{selected.kind === 'lead' ? tr('لید') : tr('آپگرید')}</div>
              </div>
              <div>
                <span className="form-label">{tr('موبایل')}</span>
                <div dir="ltr">{selected.mobile}</div>
              </div>
              <div>
                <span className="form-label">{tr('مرحله')}</span>
                <div>{salesStageLabel(selected.stage)}</div>
              </div>
              <div>
                <span className="form-label">{tr('محصول')}</span>
                <div>{selected.product || '—'}</div>
              </div>
              <div>
                <span className="form-label">{tr('مبلغ')}</span>
                <div>{formatNumFa(selected.value)} {tr('تومان')}</div>
              </div>
              <div>
                <span className="form-label">{tr('منبع')}</span>
                <div>{selected.source || '—'}</div>
              </div>
              <div>
                <span className="form-label">{tr('پرداخت')}</span>
                <div>{selected.payStatus}</div>
              </div>
              <div>
                <span className="form-label">{tr('کارشناس')}</span>
                <div>
                  {selected.ownerName ? (
                    <AdminEntityCell
                      thumb={<AdminThumb src={selected.ownerAvatarUrl} label={selected.ownerName} kind="user" size={28} />}
                      title={selected.ownerName}
                    />
                  ) : '—'}
                </div>
              </div>
              <div>
                <span className="form-label">{tr('آخرین فعالیت')}</span>
                <div>{formatAdminFaDateTime(selected.lastActivity)}</div>
              </div>
            </div>
            {canWrite ? (
              <p className="sales-pipe-hint admin-muted">
                {tr('برای جابه‌جایی سریع، کارت را روی مرحلهٔ بعدی بکشید (فقط یک مرحله جلو).')}
              </p>
            ) : null}
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}

export function AdminSalesDealsPage() {
  const [items, setItems] = useState<SalesItem[]>([]);
  useEffect(() => { void adminFetch<{ items: SalesItem[] }>('/api/admin/sales/items?stage=7&limit=100').then((d) => setItems(d.items)).catch(() => undefined); }, []);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>{tr('معاملات برنده')}</h1><p>{tr('پس از تایید مالی')}</p></div></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tr('کد')}</th><th>{tr('نام')}</th><th>{tr('محصول')}</th><th>{tr('مبلغ')}</th><th>{tr('کارشناس')}</th></tr></thead>
        <tbody>{items.map((i) => <tr key={i.id}><td><Link to={`/admin/sales/${i.kind === 'lead' ? 'leads' : 'upgrades'}/${i.id}`}>{i.publicId}</Link></td><td>{i.first} {i.last}</td><td>{i.product}</td><td>{formatNumFa(i.value)}</td><td>{i.ownerName ? <AdminEntityCell thumb={<AdminThumb src={i.ownerAvatarUrl} label={i.ownerName} kind="user" size={28} />} title={i.ownerName} /> : '—'}</td></tr>)}
          {!items.length ? <tr><td colSpan={5}>{tr('خالی')}</td></tr> : null}</tbody></table></div>
    </div>
  );
}

export function AdminSalesCustomersPage() {
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    void adminFetch<{ customers: SalesCustomer[] }>(`/api/admin/sales/customers${qs}`).then((d) => setCustomers(d.customers)).catch(() => undefined);
  }, [q]);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>{tr('مشتریان')}</h1><p>{tr('Customer 360 سبک')}</p></div></header>
      <input className="admin-input" placeholder={tr("جستجو…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginTop: 12 }}>
        {customers.map((c) => (
          <Link key={c.id} to={`/admin/sales/customers/${c.id}`} className="admin-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>{c.first} {c.last}</strong><div className="admin-muted">{c.publicId} · {c.mobile}</div>
            <div>{c.level} · LTV {formatNumFa(c.orderSum || 0)}</div>
            {c.csat ? <div>{tr('رضایت:')} {formatNumFa(c.csat)}{tr('/۵')}</div> : null}
          </Link>
        ))}
        {!customers.length ? <p>{tr('مشتری‌ای نیست — بعد از تایید مالی ساخته می‌شود.')}</p> : null}
      </div>
    </div>
  );
}

export function AdminSalesCustomerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ customer: SalesCustomer; orders: { id: number; product: string; amount: number; at: string }[]; upgrades: SalesItem[] } | null>(null);
  useEffect(() => {
    if (!id) return;
    void adminFetch<{ customer: SalesCustomer; orders: { id: number; product: string; amount: number; at: string }[]; upgrades: SalesItem[] }>(`/api/admin/sales/customers/${id}`)
      .then(setData).catch(() => undefined);
  }, [id]);
  if (!data) return <div className="admin-page"><p>…</p></div>;
  const c = data.customer;
  return (
    <div className="admin-page">
      <header className="admin-header"><div><p className="admin-topbar-eyebrow"><Link to="/admin/sales/customers">{tr('← مشتریان')}</Link></p>
        <h1>{c.first} {c.last}</h1><p>{c.publicId} · {c.mobile} · {c.level}</p></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.orderSum || 0)}</div><div className="admin-stat-label">LTV</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.orderCount || 0)}</div><div className="admin-stat-label">{tr('سفارش')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.daysSinceLastPurchase ?? 0)}</div><div className="admin-stat-label">{tr('روز از آخرین خرید')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.csat || 0)}</div><div className="admin-stat-label">CSAT</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>{tr('سفارش‌ها')}</h2></div>
        {data.orders.map((o) => <div key={o.id}>{o.product} · {formatNumFa(o.amount)} · {formatAdminFaDate(o.at)}</div>)}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>{tr('آپگریدها')}</h2></div>
        {data.upgrades.map((u) => <div key={u.id}><Link to={`/admin/sales/upgrades/${u.id}`}>{u.publicId}</Link> · {salesStageLabel(u.stage)}</div>)}
      </section>
    </div>
  );
}

export function AdminSalesProductsPage() {
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', price: '0' });
  const canAdmin = adminCan('sales.admin');
  const load = () => void adminFetch<{ products: SalesProduct[] }>('/api/admin/sales/products').then((d) => setProducts(d.products));
  useEffect(() => { load(); }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/sales/products', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), price: Number(form.price) || 0 }) });
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>{tr('محصولات و قیمت')}</h1><p>{tr('کاتالوگ فروش Pet Date')}</p></div>
        {canAdmin ? <button type="button" className="admin-btn admin-btn--primary" onClick={() => { setForm({ name: '', price: '0' }); setOpen(true); }}>{tr('+ محصول')}</button> : null}
      </header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tr('نام')}</th><th>{tr('قیمت')}</th><th>{tr('وضعیت')}</th></tr></thead>
        <tbody>{products.map((p) => <tr key={p.id}><td>{p.name}</td><td>{formatNumFa(p.price)}</td><td>{p.active ? tr('فعال') : tr('غیرفعال')}</td></tr>)}</tbody></table></div>
      <AdminModal open={open} title={tr("محصول فروش جدید")} onClose={() => !busy && setOpen(false)} size="sm" as="form" onSubmit={(e) => void submit(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('نام')}</span><input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label><span className="form-label">{tr('قیمت تومان')}</span><input className="form-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
      </AdminModal>
    </div>
  );
}

export function AdminSalesTicketsPage() {
  const [tickets, setTickets] = useState<SalesTicket[]>([]);
  const [cat, setCat] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ title: string; cat: string; dept: string; priority: string; desc: string }>({ title: '', cat: SALES_TICKET_CATEGORIES[0], dept: SALES_TICKET_DEPTS[0], priority: 'متوسط', desc: '' });
  const canWrite = adminCan('sales.write') || adminCan('admin.full');
  const canAdmin = adminCan('sales.admin') || adminCan('admin.full');

  const load = useCallback(() => {
    const qs = cat !== 'all' ? `?cat=${encodeURIComponent(cat)}` : '';
    void adminFetch<{ tickets: SalesTicket[] }>(`/api/admin/sales/tickets${qs}`).then((d) => setTickets(d.tickets));
  }, [cat]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/sales/tickets', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setOpen(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (id: number, status: string) => {
    void adminFetch(`/api/admin/sales/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then(load);
  };

  const slaTone = (slaDue: string, status: string) => {
    if (['حل‌شده', 'بسته‌شده', 'رد شده'].includes(status)) return undefined;
    const ms = new Date(slaDue).getTime() - Date.now();
    if (ms < 0) return '#c62828';
    if (ms < 6 * 3600_000) return '#ef6c00';
    return undefined;
  };

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div><h1>{tr('تیکت‌های فروش')}</h1><p>{tr('استعلام مالی، پشتیبانی فنی و تحویل · Pet Date')}</p></div>
        {canWrite ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setOpen(true)}>{tr('+ تیکت')}</button>
        ) : null}
      </header>
      <div className="admin-tabs">
        <button type="button" className={`admin-tab${cat === 'all' ? ' is-on' : ''}`} onClick={() => setCat('all')}>{tr('همه')}</button>
        {SALES_TICKET_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`admin-tab${cat === c ? ' is-on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>{tr('کد')}</th><th>{tr('عنوان')}</th><th>{tr('مرتبط')}</th><th>{tr('واحد')}</th><th>{tr('دسته')}</th><th>{tr('اولویت')}</th><th>{tr('وضعیت')}</th><th>SLA</th><th></th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.publicId}</td>
                <td>{tr(t.title)}<div className="admin-muted">{t.desc || ''}</div></td>
                <td>
                  {t.refId ? (
                    <Link to={`/admin/sales/${t.refKind === 'upgrade' ? 'upgrades' : 'leads'}/${t.refId}`}>
                      {t.refKind}/{t.refId}
                    </Link>
                  ) : t.customerId ? (
                    <Link to={`/admin/sales/customers/${t.customerId}`}>CU-{t.customerId}</Link>
                  ) : '—'}
                </td>
                <td>{t.dept}</td>
                <td>{t.cat}</td>
                <td>{t.priority}</td>
                <td>{t.status}</td>
                <td style={{ color: slaTone(t.slaDue, t.status) }}>{formatAdminFaDateTime(t.slaDue)}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {canAdmin && t.cat === 'استعلام مالی' && t.status === 'جدید' && t.paymentId ? (
                    <>
                      <button type="button" className="admin-btn admin-btn--primary" onClick={() => void adminFetch(`/api/admin/sales/payments/${t.paymentId}/finance-decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }).then(load)}>{tr('تایید مالی')}</button>
                      <button type="button" className="admin-btn" onClick={() => void adminFetch(`/api/admin/sales/payments/${t.paymentId}/finance-decide`, { method: 'POST', body: JSON.stringify({ approve: false }) }).then(load)}>{tr('رد')}</button>
                    </>
                  ) : null}
                  {canWrite && ![tr('بسته‌شده'), tr('حل‌شده')].includes(t.status) ? (
                    <select
                      className="admin-select"
                      value={t.status}
                      onChange={(e) => setStatus(t.id, e.target.value)}
                      style={{ minWidth: 120 }}
                    >
                      {SALES_TICKET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : null}
                </td>
              </tr>
            ))}
            {!tickets.length ? <tr><td colSpan={9}>{tr('خالی')}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={open}
        title={tr("تیکت جدید")}
        onClose={() => !busy && setOpen(false)}
        size="sm"
        as="form"
        onSubmit={(e) => void submit(e)}
        busy={busy}
        footer={(
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ایجاد')}</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>{tr('انصراف')}</button>
          </>
        )}
      >
        <label><span className="form-label">{tr('عنوان')}</span>
          <input className="form-input" required value={tr(form.title)} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label><span className="form-label">{tr('دسته')}</span>
          <select className="admin-select" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
            {SALES_TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label><span className="form-label">{tr('واحد')}</span>
          <select className="admin-select" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
            {SALES_TICKET_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select></label>
        <label><span className="form-label">{tr('اولویت')}</span>
          <select className="admin-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {SALES_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select></label>
        <label><span className="form-label">{tr('شرح')}</span>
          <textarea className="form-input" rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
      </AdminModal>
    </div>
  );
}

export function AdminSalesCallsPage() {
  const [calls, setCalls] = useState<SalesCall[]>([]);
  const [dir, setDir] = useState<'all' | 'call_out' | 'call_in'>('all');
  const [qaOnly, setQaOnly] = useState(false);
  const [scoreOpen, setScoreOpen] = useState<number | null>(null);
  const [score, setScore] = useState('80');
  const [busy, setBusy] = useState(false);
  const sim = useSalesCallSimOptional();
  const canWrite = adminCan('sales.write') || adminCan('admin.full');

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (dir !== 'all') qs.set('dir', dir);
    if (qaOnly) qs.set('qaPendingOnly', '1');
    void adminFetch<{ calls: SalesCall[] }>(`/api/admin/sales/calls?${qs}`).then((d) => setCalls(d.calls));
  }, [dir, qaOnly]);
  useEffect(() => { load(); }, [load]);

  const out = calls.filter((c) => c.dir === 'call_out');
  const inn = calls.filter((c) => c.dir === 'call_in');
  const scored = calls.filter((c) => c.qaStatus === 'ارزیابی شد' && c.qaScore != null);
  const avgQa = scored.length ? Math.round(scored.reduce((s, c) => s + (c.qaScore || 0), 0) / scored.length) : 0;
  const pending = calls.filter((c) => c.qaStatus !== 'ارزیابی شد').length;

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div><h1>{tr('مرکز تماس و ارزیابی')}</h1><p>{tr('شنود، QA و شبیه‌سازی تماس ورودی · Pet Date')}</p></div>
        {canWrite && sim ? (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={Boolean(sim.call)}
            onClick={() => void sim.simulateIncoming()}
          >
            {tr('شبیه‌سازی تماس ورودی')}
          </button>
        ) : null}
      </header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(out.length)}</div><div className="admin-stat-label">{tr('خروجی (فیلتر)')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(inn.length)}</div><div className="admin-stat-label">{tr('ورودی')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(calls.reduce((s, c) => s + c.talk, 0))}</div><div className="admin-stat-label">{tr('دقایق')}</div></div>
        <div className="admin-stat admin-stat--mint"><div className="admin-stat-value">{formatNumFa(pending)}</div><div className="admin-stat-label">{tr('در انتظار QA')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(avgQa)}</div><div className="admin-stat-label">{tr('میانگین QA')}</div></div>
      </div>
      <div className="admin-toolbar" style={{ marginTop: 12 }}>
        <select className="admin-select" value={dir} onChange={(e) => setDir(e.target.value as typeof dir)}>
          <option value="all">{tr('همه جهت‌ها')}</option>
          <option value="call_out">{tr('خروجی')}</option>
          <option value="call_in">{tr('ورودی')}</option>
        </select>
        <label className="admin-check">
          <input type="checkbox" checked={qaOnly} onChange={(e) => setQaOnly(e.target.checked)} />
          {tr('فقط ارزیابی‌نشده')}
        </label>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 12 }}>
        <table className="admin-table">
          <thead><tr><th>{tr('نوع')}</th><th>{tr('کارشناس')}</th><th>{tr('نتیجه')}</th><th>{tr('مدت')}</th><th>{tr('زمان')}</th><th>QA</th><th></th></tr></thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id}>
                <td>{c.dir === 'call_out' ? tr('خروجی') : tr('ورودی')}</td>
                <td>{c.agentName}</td>
                <td>{c.result}</td>
                <td>{formatNumFa(c.talk)}</td>
                <td>{formatAdminFaDateTime(c.startedAt)}</td>
                <td>{c.qaStatus}{c.qaScore != null ? ` (${formatNumFa(c.qaScore)})` : ''}</td>
                <td>
                  {c.qaStatus !== 'ارزیابی شد' && canWrite ? (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setScore('80'); setScoreOpen(c.id); }}>{tr('ارزیابی')}</button>
                  ) : null}
                  <Link to={`/admin/sales/${c.refKind === 'upgrade' ? 'upgrades' : 'leads'}/${c.refId}`} style={{ marginInlineStart: 8 }}>{tr('پرونده')}</Link>
                </td>
              </tr>
            ))}
            {!calls.length ? <tr><td colSpan={7}>{tr('خالی')}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <AdminModal
        open={scoreOpen != null}
        title={tr("امتیاز QA")}
        onClose={() => !busy && setScoreOpen(null)}
        size="sm"
        as="form"
        busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (scoreOpen == null) return;
          setBusy(true);
          void adminFetch(`/api/admin/sales/calls/${scoreOpen}/score`, { method: 'POST', body: JSON.stringify({ score: Number(score) || 0 }) })
            .then(() => { setScoreOpen(null); load(); }).finally(() => setBusy(false));
        }}
        footer={(
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setScoreOpen(null)}>{tr('انصراف')}</button>
          </>
        )}
      >
        <label>
          <span className="form-label">{tr('امتیاز ۰–۱۰۰')}</span>
          <input className="form-input" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
        </label>
        <p className="admin-muted">{tr('نتایج تماس استاندارد:')} {SALES_CALL_RESULTS.slice(0, 4).join(tr('، '))}…</p>
      </AdminModal>
    </div>
  );
}

export function AdminSalesReportsPage() {
  const [r, setR] = useState<SalesReportSummary | null>(null);
  useEffect(() => { void adminFetch<SalesReportSummary>('/api/admin/sales/reports').then(setR); }, []);
  if (!r) return <div className="admin-page"><p>…</p></div>;
  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header"><div><h1>{tr('گزارشات')}</h1><p>{tr('Pet Date · بدون تفکیک بیزنس‌لاین')}</p></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.aov)}</div><div className="admin-stat-label">AOV</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.revenue)}</div><div className="admin-stat-label">{tr('درآمد')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.salesCount)}</div><div className="admin-stat-label">{tr('فروش')}</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.callsCount)}</div><div className="admin-stat-label">{tr('تماس (')}{formatNumFa(r.callMinutes)} {tr('د)')}</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>{tr('بر اساس کارشناس')}</h2></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tr('کارشناس')}</th><th>{tr('تماس')}</th><th>{tr('فروش')}</th><th>{tr('درآمد')}</th></tr></thead>
          <tbody>{r.byAgent.map((a) => <tr key={a.agentId}><td>{a.agentName}</td><td>{formatNumFa(a.calls)}</td><td>{formatNumFa(a.sales)}</td><td>{formatNumFa(a.revenue)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>{tr('بر اساس منبع')}</h2></div>
        {r.bySource.map((s) => <div key={s.source}>{s.source}: {formatNumFa(s.value)}</div>)}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>{tr('روند ۱۴ روزه درآمد')}</h2></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{tr('روز')}</th><th>{tr('درآمد')}</th><th>{tr('تماس')}</th></tr></thead>
          <tbody>
            {r.dailyRevenue.map((d, i) => (
              <tr key={d.day}><td>{d.day}</td><td>{formatNumFa(d.value)}</td><td>{formatNumFa(r.dailyCalls[i]?.count || 0)}</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}

export function AdminSalesSettingsPage() {
  const [tab, setTab] = useState<'perf' | 'goals' | 'patterns' | 'admin'>('perf');
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [patterns, setPatterns] = useState<SalesPattern[]>([]);
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [dash, setDash] = useState<{ callsToday: number; salesTodayCount: number; aov: number; overdueFollowups: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [patternOpen, setPatternOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourcesRaw, setSourcesRaw] = useState('');
  const [lostRaw, setLostRaw] = useState('');
  const [patternForm, setPatternForm] = useState<{ channel: string; name: string; text: string }>({ channel: SALES_MESSAGE_CHANNELS[0], name: '', text: '' });
  const [goalForm, setGoalForm] = useState({ name: '', team: 'فروش Pet Date', revenue: '50000000', salesCount: '20', calls: '100' });
  const canAdmin = adminCan('sales.admin') || adminCan('admin.full');

  const load = useCallback(() => {
    void adminFetch<SalesSettings>('/api/admin/sales/settings').then(setSettings);
    void adminFetch<{ patterns: SalesPattern[] }>('/api/admin/sales/patterns').then((d) => setPatterns(d.patterns));
    void adminFetch<{ goals: SalesGoal[] }>('/api/admin/sales/goals').then((d) => setGoals(d.goals));
    void adminFetch<{ callsToday: number; salesTodayCount: number; aov: number; overdueFollowups: number }>('/api/admin/sales/dashboard')
      .then((d) => setDash({
        callsToday: d.callsToday,
        salesTodayCount: d.salesTodayCount,
        aov: d.aov,
        overdueFollowups: d.overdueFollowups,
      }))
      .catch(() => undefined);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!settings) return <div className="admin-page"><p>…</p></div>;

  const tabs: Array<{ k: typeof tab; fa: string; show?: boolean }> = [
    { k: 'perf', fa: 'عملکرد من' },
    { k: 'goals', fa: 'هدف‌گذاری', show: canAdmin },
    { k: 'patterns', fa: 'پترن‌های پیامکی', show: canAdmin },
    { k: 'admin', fa: 'پیکربندی عمومی', show: canAdmin },
  ];

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await adminFetch<SalesSettings>('/api/admin/sales/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          leadSources: sourcesRaw.split(',').map((s) => s.trim()).filter(Boolean),
          lostReasons: lostRaw.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      setSettings(next);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page admin-page--wide">
      <header className="admin-header">
        <div><h1>{tr('تنظیمات')}</h1><p>{tr('عملکرد، اهداف، پترن پیام و پیکربندی · خط محصول Pet Date')}</p></div>
      </header>
      <div className="admin-tabs">
        {tabs.filter((t) => t.show !== false).map((t) => (
          <button key={t.k} type="button" className={`admin-tab${tab === t.k ? ' is-on' : ''}`} onClick={() => setTab(t.k)}>{t.fa}</button>
        ))}
      </div>

      {tab === 'perf' ? (
        <div className="admin-stats">
          <div className="admin-stat admin-stat--mint"><div className="admin-stat-value">{formatNumFa(dash?.callsToday || 0)}</div><div className="admin-stat-label">{tr('تماس امروز')}</div></div>
          <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(dash?.salesTodayCount || 0)}</div><div className="admin-stat-label">{tr('فروش امروز')}</div></div>
          <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(dash?.aov || 0)}</div><div className="admin-stat-label">AOV</div></div>
          <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(dash?.overdueFollowups || 0)}</div><div className="admin-stat-label">{tr('پیگیری معوق')}</div></div>
        </div>
      ) : null}

      {tab === 'goals' ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>{tr('اهداف فعال')}</h2>
            {canAdmin ? <button type="button" className="admin-btn admin-btn--primary" onClick={() => setGoalOpen(true)}>{tr('+ هدف')}</button> : null}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{tr('نام')}</th><th>{tr('تیم')}</th><th>{tr('بازه')}</th><th>{tr('معیارها')}</th><th>{tr('وضعیت')}</th></tr></thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g.team}</td>
                    <td>{g.periodFrom || '—'} → {g.periodTo || '—'}</td>
                    <td className="admin-muted">{JSON.stringify(g.metrics)}</td>
                    <td>{g.active ? tr('فعال') : tr('غیرفعال')}</td>
                  </tr>
                ))}
                {!goals.length ? <tr><td colSpan={5}>{tr('هدفی تعریف نشده')}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'patterns' ? (
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>{tr('پترن‌های پیامکی')}</h2>
            {canAdmin ? <button type="button" className="admin-btn admin-btn--primary" onClick={() => { setPatternForm({ channel: SALES_MESSAGE_CHANNELS[0], name: '', text: '' }); setPatternOpen(true); }}>{tr('+ پترن')}</button> : null}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{tr('کانال')}</th><th>{tr('نام')}</th><th>{tr('متن')}</th><th>{tr('وضعیت')}</th></tr></thead>
              <tbody>
                {patterns.map((p) => (
                  <tr key={p.id}><td>{p.channel}</td><td>{p.name}</td><td>{tr(p.text)}</td><td>{p.active ? tr('فعال') : tr('غیرفعال')}</td></tr>
                ))}
                {!patterns.length ? <tr><td colSpan={4}>{tr('خالی')}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'admin' ? (
        <>
          <section className="admin-card">
            <div className="admin-card-head"><h2>{tr('منابع لید')}</h2></div>
            <p>{settings.leadSources.join(' · ')}</p>
            {canAdmin ? (
              <button type="button" className="admin-btn" onClick={() => {
                setSourcesRaw(settings.leadSources.join(','));
                setLostRaw(settings.lostReasons.join(','));
                setOpen(true);
              }}
              >
                {tr('ویرایش پیکربندی')}
              </button>
            ) : null}
          </section>
          <section className="admin-card" style={{ marginTop: 12 }}>
            <div className="admin-card-head"><h2>{tr('دلایل ازدست‌رفتن')}</h2></div>
            <p>{settings.lostReasons.join(' · ')}</p>
          </section>
          <section className="admin-card" style={{ marginTop: 12 }}>
            <div className="admin-card-head"><h2>{tr('سقف تخفیف نقش‌ها')}</h2></div>
            {Object.entries(settings.discountLimits).map(([k, v]) => <div key={k}>{k}: {formatNumFa(v)}{tr('٪')}</div>)}
          </section>
          <p className="admin-muted" style={{ marginTop: 12 }}>
            {tr('پیش‌فرض‌های سیستم:')} {SALES_LEAD_SOURCES.length} {tr('منبع ·')} {SALES_LOST_REASONS.length} {tr('دلیل')}
            {' · '}
            <Link to="/admin/settings">{tr('ویرایش ماژولار در تنظیمات پلتفرم')}</Link>
          </p>
        </>
      ) : null}

      <AdminModal open={open} title={tr("ویرایش پیکربندی")} onClose={() => !busy && setOpen(false)} size="sm" as="form" onSubmit={(e) => void saveSettings(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('منابع (با ویرگول)')}</span>
          <textarea className="form-input" rows={3} value={sourcesRaw} onChange={(e) => setSourcesRaw(e.target.value)} /></label>
        <label><span className="form-label">{tr('دلایل ازدست‌رفتن (با ویرگول)')}</span>
          <textarea className="form-input" rows={3} value={lostRaw} onChange={(e) => setLostRaw(e.target.value)} /></label>
      </AdminModal>

      <AdminModal open={patternOpen} title={tr("پترن جدید")} onClose={() => !busy && setPatternOpen(false)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void adminFetch('/api/admin/sales/patterns', { method: 'POST', body: JSON.stringify(patternForm) })
            .then(() => { setPatternOpen(false); load(); }).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setPatternOpen(false)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('کانال')}</span>
          <select className="admin-select" value={patternForm.channel} onChange={(e) => setPatternForm({ ...patternForm, channel: e.target.value })}>
            {SALES_MESSAGE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
        <label><span className="form-label">{tr('نام')}</span>
          <input className="form-input" required value={patternForm.name} onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })} /></label>
        <label><span className="form-label">{tr('متن')}</span>
          <textarea className="form-input" rows={3} required value={tr(patternForm.text)} onChange={(e) => setPatternForm({ ...patternForm, text: e.target.value })} /></label>
      </AdminModal>

      <AdminModal open={goalOpen} title={tr("هدف جدید")} onClose={() => !busy && setGoalOpen(false)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void adminFetch('/api/admin/sales/goals', {
            method: 'POST',
            body: JSON.stringify({
              name: goalForm.name,
              team: goalForm.team,
              metrics: {
                revenue: Number(goalForm.revenue) || 0,
                salesCount: Number(goalForm.salesCount) || 0,
                calls: Number(goalForm.calls) || 0,
              },
            }),
          }).then(() => { setGoalOpen(false); load(); }).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setGoalOpen(false)}>{tr('انصراف')}</button></>}>
        <label><span className="form-label">{tr('نام')}</span>
          <input className="form-input" required value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} /></label>
        <label><span className="form-label">{tr('تیم')}</span>
          <input className="form-input" value={goalForm.team} onChange={(e) => setGoalForm({ ...goalForm, team: e.target.value })} /></label>
        <label><span className="form-label">{tr('هدف درآمد')}</span>
          <input className="form-input" type="number" value={goalForm.revenue} onChange={(e) => setGoalForm({ ...goalForm, revenue: e.target.value })} /></label>
        <label><span className="form-label">{tr('تعداد فروش')}</span>
          <input className="form-input" type="number" value={goalForm.salesCount} onChange={(e) => setGoalForm({ ...goalForm, salesCount: e.target.value })} /></label>
        <label><span className="form-label">{tr('تعداد تماس')}</span>
          <input className="form-input" type="number" value={goalForm.calls} onChange={(e) => setGoalForm({ ...goalForm, calls: e.target.value })} /></label>
      </AdminModal>
    </div>
  );
}
