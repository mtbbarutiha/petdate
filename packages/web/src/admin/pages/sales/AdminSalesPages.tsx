import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  SalesCall, SalesCustomer, SalesItem, SalesItemKind, SalesProduct, SalesReportSummary, SalesSettings, SalesTicket,
} from '@petdate/shared';
import {
  SALES_CALL_RESULTS, SALES_LEAD_SOURCES, SALES_LOST_REASONS, SALES_MESSAGE_CHANNELS, SALES_STAGES, salesStageLabel,
} from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

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
          source: form.source || (kind === 'lead' ? SALES_LEAD_SOURCES[0] : 'امور فروش'),
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
        <div><h1>{title}</h1><p>{formatNumFa(total)} مورد · Pet Date</p></div>
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
                source: kind === 'lead' ? SALES_LEAD_SOURCES[0] : 'امور فروش',
              });
              setOpen(true);
            }}
          >
            + جدید
          </button>
        ) : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-toolbar">
        <input className="admin-input" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="admin-select" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">همه مراحل</option>
          {SALES_STAGES.map((s, i) => <option key={s} value={String(i)}>{s}</option>)}
          <option value="lost">ازدست‌رفته</option>
        </select>
        <label className="admin-check"><input type="checkbox" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} /> فقط بدون تخصیص</label>
      </div>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>نام</th><th>محصول</th><th>منبع</th><th>امتیاز</th><th>مرحله</th><th>پرداخت</th><th>کارشناس</th></tr></thead>
        <tbody>{items.map((i) => (
          <tr key={i.id}>
            <td><Link to={`/admin/sales/${kind === 'lead' ? 'leads' : 'upgrades'}/${i.id}`}>{i.publicId}</Link><div>{i.first} {i.last}</div><div className="admin-muted">{i.mobile}</div></td>
            <td>{i.product}<div className="admin-muted">{formatNumFa(i.value)} ت</div></td>
            <td>{i.source}</td><td>{formatNumFa(i.score)}</td><td>{salesStageLabel(i.stage)}</td><td>{i.payStatus}</td>
            <td>{i.ownerName || (canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/sales/items/${i.id}/claim`, { method: 'POST', body: '{}' }).then(load)}>برداشتن</button> : '—')}</td>
          </tr>
        ))}{!items.length ? <tr><td colSpan={7}>خالی</td></tr> : null}</tbody>
      </table></div>

      <AdminModal
        open={open}
        title={kind === 'lead' ? 'لید جدید' : 'آپگرید جدید'}
        onClose={() => !busy && setOpen(false)}
        size="sm"
        as="form"
        onSubmit={(e) => void submit(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ایجاد</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button>
          </>
        }
      >
        <label>
          <span className="form-label">نام</span>
          <input className="form-input" required value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
        </label>
        <label>
          <span className="form-label">نام خانوادگی</span>
          <input className="form-input" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
        </label>
        <label>
          <span className="form-label">موبایل</span>
          <input className="form-input" dir="ltr" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </label>
        <label>
          <span className="form-label">محصول</span>
          <select className="admin-select" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
            <option value="">—</option>
            {products.map((pr) => <option key={pr.id} value={pr.name}>{pr.name}</option>)}
          </select>
        </label>
        {kind === 'lead' ? (
          <label>
            <span className="form-label">منبع</span>
            <select className="admin-select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SALES_LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <div><p className="admin-topbar-eyebrow"><Link to={base}>← بازگشت</Link></p>
          <h1>{item.first} {item.last} · {item.publicId}</h1>
          <p>{item.mobile} · {item.product} · {formatNumFa(item.value)} ت · {salesStageLabel(item.stage)}</p></div>
        <span className="admin-topbar-chip">{item.payStatus}</span>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {canWrite ? (
        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="admin-btn" onClick={() => { setCallForm({ result: SALES_CALL_RESULTS[0], summary: '' }); setModal('call'); }}>تماس</button>
          <button type="button" className="admin-btn" onClick={() => { setOfferDiscount('0'); setModal('offer'); }}>پیشنهاد</button>
          <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/items/${item.id}/advance`)}>پیشرفت</button>
          <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/items/${item.id}/payment-link`)}>لینک پرداخت</button>
          {lastPayment?.status === 'لینک ارسال‌شده' ? <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-inquiry`)}>استعلام مالی</button> : null}
          {canAdmin && lastPayment?.status === 'در حال بررسی مالی' ? (
            <>
              <button type="button" className="admin-btn admin-btn--primary" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-decide`, { approve: true })}>تایید مالی</button>
              <button type="button" className="admin-btn" onClick={() => void act(`/api/admin/sales/payments/${lastPayment.id}/finance-decide`, { approve: false })}>رد مالی</button>
            </>
          ) : null}
          <button type="button" className="admin-btn" onClick={() => { setLostReason(SALES_LOST_REASONS[0]); setModal('lost'); }}>ازدست‌رفته</button>
          {SALES_MESSAGE_CHANNELS.slice(0, 2).map((ch) => (
            <button key={ch} type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/items/${item.id}/messages`, { channel: ch, text: `پیام ${ch}` })}>{ch}</button>
          ))}
        </div>
      ) : null}
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head"><h2>تاریخچه</h2></div>
        <ul>{data.activities.map((a) => <li key={a.id}>{new Date(a.at).toLocaleString('fa-IR')} — {a.text}</li>)}</ul>
        <div className="admin-card-head"><h2>پیشنهاد / پرداخت</h2></div>
        {data.offers.map((o) => <div key={o.id}>{o.product} · {formatNumFa(o.final)} · {o.discount}% · {o.approvalStatus}
          {canAdmin && o.approvalStatus === 'در انتظار تایید' ? (
            <><button type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/offers/${o.id}/decide`, { approve: true })}>تایید</button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void act(`/api/admin/sales/offers/${o.id}/decide`, { approve: false })}>رد</button></>
          ) : null}</div>)}
        {data.payments.map((p) => <div key={p.id}>{formatNumFa(p.amount)} · {p.type} · {p.status}</div>)}
      </section>

      <AdminModal open={modal === 'call'} title="ثبت تماس" onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (!callForm.summary.trim()) return;
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/calls`, { result: callForm.result, summary: callForm.summary, talk: 5, advance: true })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ثبت</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>انصراف</button></>}>
        <label><span className="form-label">نتیجه</span>
          <select className="admin-select" value={callForm.result} onChange={(e) => setCallForm({ ...callForm, result: e.target.value })}>
            {SALES_CALL_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <label><span className="form-label">خلاصه</span>
          <textarea className="form-input" required rows={3} value={callForm.summary} onChange={(e) => setCallForm({ ...callForm, summary: e.target.value })} /></label>
      </AdminModal>

      <AdminModal open={modal === 'offer'} title="پیشنهاد تخفیف" onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/offers`, { discount: Number(offerDiscount) || 0 })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ثبت</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>انصراف</button></>}>
        <label><span className="form-label">تخفیف ٪</span>
          <input className="form-input" type="number" value={offerDiscount} onChange={(e) => setOfferDiscount(e.target.value)} /></label>
      </AdminModal>

      <AdminModal open={modal === 'lost'} title="علامت ازدست‌رفته" onClose={() => !busy && setModal(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void act(`/api/admin/sales/items/${item.id}/lost`, { reason: lostReason })
            .then(() => setModal(null)).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ثبت</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setModal(null)}>انصراف</button></>}>
        <label><span className="form-label">دلیل</span>
          <select className="admin-select" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
            {SALES_LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select></label>
      </AdminModal>
    </div>
  );
}
export function AdminSalesLeadDetailPage() { return <ItemDetail kind="lead" />; }
export function AdminSalesUpgradeDetailPage() { return <ItemDetail kind="upgrade" />; }

export function AdminSalesPipelinePage() {
  const [stages, setStages] = useState<{ stage: number | 'lost'; label: string; items: SalesItem[]; value: number }[]>([]);
  useEffect(() => { void adminFetch<{ stages: typeof stages }>('/api/admin/sales/pipeline').then((d) => setStages(d.stages)).catch(() => undefined); }, []);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>پایپ‌لاین</h1><p>قیف فروش Pet Date</p></div></header>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {stages.map((s) => (
          <div key={String(s.stage)} className="admin-card" style={{ minWidth: 190, flex: '0 0 190px' }}>
            <h2 style={{ fontSize: 14 }}>{s.label}</h2>
            <p className="admin-muted">{formatNumFa(s.items.length)} · {formatNumFa(s.value)} ت</p>
            {s.items.map((i) => <Link key={i.id} to={`/admin/sales/${i.kind === 'lead' ? 'leads' : 'upgrades'}/${i.id}`} style={{ display: 'block', marginTop: 6 }}>{i.first} {i.last}</Link>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminSalesDealsPage() {
  const [items, setItems] = useState<SalesItem[]>([]);
  useEffect(() => { void adminFetch<{ items: SalesItem[] }>('/api/admin/sales/items?stage=7&limit=100').then((d) => setItems(d.items)).catch(() => undefined); }, []);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>معاملات برنده</h1><p>پس از تایید مالی</p></div></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>کد</th><th>نام</th><th>محصول</th><th>مبلغ</th><th>کارشناس</th></tr></thead>
        <tbody>{items.map((i) => <tr key={i.id}><td><Link to={`/admin/sales/${i.kind === 'lead' ? 'leads' : 'upgrades'}/${i.id}`}>{i.publicId}</Link></td><td>{i.first} {i.last}</td><td>{i.product}</td><td>{formatNumFa(i.value)}</td><td>{i.ownerName || '—'}</td></tr>)}
          {!items.length ? <tr><td colSpan={5}>خالی</td></tr> : null}</tbody></table></div>
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
      <header className="admin-header"><div><h1>مشتریان</h1><p>Customer 360 سبک</p></div></header>
      <input className="admin-input" placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginTop: 12 }}>
        {customers.map((c) => (
          <Link key={c.id} to={`/admin/sales/customers/${c.id}`} className="admin-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>{c.first} {c.last}</strong><div className="admin-muted">{c.publicId} · {c.mobile}</div>
            <div>{c.level} · LTV {formatNumFa(c.orderSum || 0)}</div>
            {c.csat ? <div>رضایت: {formatNumFa(c.csat)}/۵</div> : null}
          </Link>
        ))}
        {!customers.length ? <p>مشتری‌ای نیست — بعد از تایید مالی ساخته می‌شود.</p> : null}
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
      <header className="admin-header"><div><p className="admin-topbar-eyebrow"><Link to="/admin/sales/customers">← مشتریان</Link></p>
        <h1>{c.first} {c.last}</h1><p>{c.publicId} · {c.mobile} · {c.level}</p></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.orderSum || 0)}</div><div className="admin-stat-label">LTV</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.orderCount || 0)}</div><div className="admin-stat-label">سفارش</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.daysSinceLastPurchase ?? 0)}</div><div className="admin-stat-label">روز از آخرین خرید</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(c.csat || 0)}</div><div className="admin-stat-label">CSAT</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>سفارش‌ها</h2></div>
        {data.orders.map((o) => <div key={o.id}>{o.product} · {formatNumFa(o.amount)} · {new Date(o.at).toLocaleDateString('fa-IR')}</div>)}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>آپگریدها</h2></div>
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
      <header className="admin-header"><div><h1>محصولات و قیمت</h1><p>کاتالوگ فروش Pet Date</p></div>
        {canAdmin ? <button type="button" className="admin-btn admin-btn--primary" onClick={() => { setForm({ name: '', price: '0' }); setOpen(true); }}>+ محصول</button> : null}
      </header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>نام</th><th>قیمت</th><th>وضعیت</th></tr></thead>
        <tbody>{products.map((p) => <tr key={p.id}><td>{p.name}</td><td>{formatNumFa(p.price)}</td><td>{p.active ? 'فعال' : 'غیرفعال'}</td></tr>)}</tbody></table></div>
      <AdminModal open={open} title="محصول فروش جدید" onClose={() => !busy && setOpen(false)} size="sm" as="form" onSubmit={(e) => void submit(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></>}>
        <label><span className="form-label">نام</span><input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label><span className="form-label">قیمت تومان</span><input className="form-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
      </AdminModal>
    </div>
  );
}

export function AdminSalesTicketsPage() {
  const [tickets, setTickets] = useState<SalesTicket[]>([]);
  const canAdmin = adminCan('sales.admin');
  const load = () => void adminFetch<{ tickets: SalesTicket[] }>('/api/admin/sales/tickets').then((d) => setTickets(d.tickets));
  useEffect(() => { load(); }, []);
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>تیکتینگ فروش</h1><p>استعلام مالی و پشتیبانی</p></div></header>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>کد</th><th>عنوان</th><th>دسته</th><th>اولویت</th><th>وضعیت</th><th>SLA</th><th></th></tr></thead>
        <tbody>{tickets.map((t) => (
          <tr key={t.id}><td>{t.publicId}</td><td>{t.title}</td><td>{t.cat}</td><td>{t.priority}</td><td>{t.status}</td>
            <td>{new Date(t.slaDue).toLocaleString('fa-IR')}</td>
            <td>{canAdmin && t.cat === 'استعلام مالی' && t.status === 'جدید' && t.paymentId ? (
              <><button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/sales/payments/${t.paymentId}/finance-decide`, { method: 'POST', body: JSON.stringify({ approve: true }) }).then(load)}>تایید</button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/sales/payments/${t.paymentId}/finance-decide`, { method: 'POST', body: JSON.stringify({ approve: false }) }).then(load)}>رد</button></>
            ) : null}</td></tr>
        ))}{!tickets.length ? <tr><td colSpan={7}>خالی</td></tr> : null}</tbody></table></div>
    </div>
  );
}

export function AdminSalesCallsPage() {
  const [calls, setCalls] = useState<SalesCall[]>([]);
  const [scoreOpen, setScoreOpen] = useState<number | null>(null);
  const [score, setScore] = useState('80');
  const [busy, setBusy] = useState(false);
  const load = () => void adminFetch<{ calls: SalesCall[] }>('/api/admin/sales/calls').then((d) => setCalls(d.calls));
  useEffect(() => { load(); }, []);
  const out = calls.filter((c) => c.dir === 'call_out');
  const inn = calls.filter((c) => c.dir === 'call_in');
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>مرکز تماس و ارزیابی</h1><p>QA فروش</p></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(out.length)}</div><div className="admin-stat-label">خروجی</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(inn.length)}</div><div className="admin-stat-label">ورودی</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(calls.reduce((s, c) => s + c.talk, 0))}</div><div className="admin-stat-label">دقایق</div></div>
      </div>
      <div className="admin-table-wrap" style={{ marginTop: 12 }}><table className="admin-table">
        <thead><tr><th>نوع</th><th>کارشناس</th><th>نتیجه</th><th>مدت</th><th>QA</th><th></th></tr></thead>
        <tbody>{calls.map((c) => (
          <tr key={c.id}><td>{c.dir === 'call_out' ? 'خروجی' : 'ورودی'}</td><td>{c.agentName}</td><td>{c.result}</td><td>{formatNumFa(c.talk)}</td>
            <td>{c.qaStatus}{c.qaScore != null ? ` (${formatNumFa(c.qaScore)})` : ''}</td>
            <td>{c.qaStatus !== 'ارزیابی شد' ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setScore('80'); setScoreOpen(c.id); }}>ارزیابی</button> : null}</td></tr>
        ))}</tbody></table></div>
      <AdminModal open={scoreOpen != null} title="امتیاز QA" onClose={() => !busy && setScoreOpen(null)} size="sm" as="form" busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          if (scoreOpen == null) return;
          setBusy(true);
          void adminFetch(`/api/admin/sales/calls/${scoreOpen}/score`, { method: 'POST', body: JSON.stringify({ score: Number(score) || 0 }) })
            .then(() => { setScoreOpen(null); load(); }).finally(() => setBusy(false));
        }}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setScoreOpen(null)}>انصراف</button></>}>
        <label><span className="form-label">امتیاز ۰–۱۰۰</span>
          <input className="form-input" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} /></label>
      </AdminModal>
    </div>
  );
}

export function AdminSalesReportsPage() {
  const [r, setR] = useState<SalesReportSummary | null>(null);
  useEffect(() => { void adminFetch<SalesReportSummary>('/api/admin/sales/reports').then(setR); }, []);
  if (!r) return <div className="admin-page"><p>…</p></div>;
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>گزارشات فروش</h1><p>Pet Date · بدون تفکیک بیزنس‌لاین</p></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.aov)}</div><div className="admin-stat-label">AOV</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.revenue)}</div><div className="admin-stat-label">درآمد</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.salesCount)}</div><div className="admin-stat-label">فروش</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(r.callsCount)}</div><div className="admin-stat-label">تماس ({formatNumFa(r.callMinutes)} د)</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>بر اساس کارشناس</h2></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>کارشناس</th><th>تماس</th><th>فروش</th><th>درآمد</th></tr></thead>
          <tbody>{r.byAgent.map((a) => <tr key={a.agentId}><td>{a.agentName}</td><td>{formatNumFa(a.calls)}</td><td>{formatNumFa(a.sales)}</td><td>{formatNumFa(a.revenue)}</td></tr>)}</tbody></table></div>
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>بر اساس منبع</h2></div>
        {r.bySource.map((s) => <div key={s.source}>{s.source}: {formatNumFa(s.value)}</div>)}
      </section>
    </div>
  );
}

export function AdminSalesSettingsPage() {
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourcesRaw, setSourcesRaw] = useState('');
  const canAdmin = adminCan('sales.admin');
  useEffect(() => { void adminFetch<SalesSettings>('/api/admin/sales/settings').then(setSettings); }, []);
  if (!settings) return <div className="admin-page"><p>…</p></div>;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await adminFetch<SalesSettings>('/api/admin/sales/settings', {
        method: 'PATCH',
        body: JSON.stringify({ leadSources: sourcesRaw.split(',').map((s) => s.trim()).filter(Boolean) }),
      });
      setSettings(next);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>تنظیمات فروش</h1><p>منابع لید، دلایل ازدست‌رفتن، سقف تخفیف</p></div></header>
      <section className="admin-card"><div className="admin-card-head"><h2>منابع لید</h2></div><p>{settings.leadSources.join(' · ')}</p>
        {canAdmin ? <button type="button" className="admin-btn" onClick={() => { setSourcesRaw(settings.leadSources.join(',')); setOpen(true); }}>ویرایش</button> : null}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>دلایل ازدست‌رفتن</h2></div><p>{settings.lostReasons.join(' · ')}</p></section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>سقف تخفیف نقش‌ها</h2></div>
        {Object.entries(settings.discountLimits).map(([k, v]) => <div key={k}>{k}: {formatNumFa(v)}٪</div>)}
      </section>
      <AdminModal open={open} title="ویرایش منابع لید" onClose={() => !busy && setOpen(false)} size="sm" as="form" onSubmit={(e) => void submit(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button></>}>
        <label><span className="form-label">منابع (با ویرگول)</span>
          <textarea className="form-input" rows={3} value={sourcesRaw} onChange={(e) => setSourcesRaw(e.target.value)} /></label>
      </AdminModal>
    </div>
  );
}
