import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
  CrmComplaint,
  CrmCustomer,
  CrmFollowup,
  CrmInboxRow,
  CrmInteraction,
  CrmQaReview,
  CrmReferral,
  CrmReportSummary,
  CrmSettings,
  CrmSmsPattern,
  CrmSurvey,
  CrmTicket,
} from '@petdate/shared';
import { CRM_CHANNEL_LABELS, CRM_OUTCOMES, CRM_PRIORITIES, CRM_REASON_TREE, CRM_SCORECARD } from '@petdate/shared';
import { adminCan } from '../../auth';
import { adminFetch, formatNumFa } from '../../api';

function Err({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="admin-error">{error}</p>;
}

export function AdminCrmInboxPage() {
  const [rows, setRows] = useState<CrmInboxRow[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [sla, setSla] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('crm.write');

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set('q', q.trim());
    if (kind) qs.set('kind', kind);
    if (sla) qs.set('sla', sla);
    void adminFetch<{ rows: CrmInboxRow[] }>(`/api/admin/crm/inbox?${qs}`)
      .then((d) => { setRows(d.rows); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, [q, kind, sla]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>اینباکس یکپارچه</h1><p>تیکت · پیگیری · Wrap-up · وظیفه</p></div>
      </header>
      <Err error={error} />
      <div className="admin-filters" style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginBottom: 12 }}>
        <input className="form-input" placeholder="جستجو" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">همه انواع</option>
          <option value="ticket">تیکت</option>
          <option value="followup">پیگیری</option>
          <option value="interaction">تعامل</option>
          <option value="task">وظیفه</option>
        </select>
        <select className="form-input" value={sla} onChange={(e) => setSla(e.target.value)}>
          <option value="">همه SLA</option>
          <option value="breached">نقض</option>
          <option value="at_risk">در معرض</option>
          <option value="ok">سالم</option>
        </select>
        <button type="button" className="admin-btn" onClick={load}>اعمال</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>شناسه</th><th>عنوان</th><th>مشتری</th><th>کارشناس</th><th>اولویت</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} style={{ borderRight: `3px solid ${r.borderColor}` }}>
                <td className="admin-muted">{r.publicId}<div>{r.kind}</div></td>
                <td>{r.title}</td>
                <td>{r.customerName}</td>
                <td>{r.agentName}</td>
                <td>{r.priority}</td>
                <td>{r.status} · {r.slaState}</td>
                <td>
                  {canWrite ? (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/crm/inbox/${r.kind}/${r.id}/assign-me`, { method: 'POST', body: '{}' }).then(load)}>
                      تخصیص به من
                    </button>
                  ) : null}
                  {r.kind === 'interaction' ? <Link to={`/admin/crm/calls?wrap=${r.id}`}>Wrap-up</Link> : null}
                  {r.kind === 'ticket' ? <Link to={`/admin/crm/cases?tab=tickets`}>پرونده</Link> : null}
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7}>ردیفی نیست</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCrmCustomersPage() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [q, setQ] = useState('');
  const [mobile, setMobile] = useState('');
  const [first, setFirst] = useState('');
  const canWrite = adminCan('crm.write');

  const load = useCallback(() => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    void adminFetch<{ customers: CrmCustomer[] }>(`/api/admin/crm/customers${qs}`).then((d) => setCustomers(d.customers));
  }, [q]);
  useEffect(() => { load(); }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await adminFetch('/api/admin/crm/customers', {
      method: 'POST',
      body: JSON.stringify({ mobile, first }),
    });
    setMobile('');
    setFirst('');
    load();
  };

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>مشتریان</h1><p>پرونده ۳۶۰ و اتصال به فروش/پلتفرم</p></div></header>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input className="form-input" placeholder="جستجو" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="admin-btn" onClick={load}>جستجو</button>
      </div>
      {canWrite ? (
        <form onSubmit={(e) => void create(e)} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="form-input" dir="ltr" placeholder="09…" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          <input className="form-input" placeholder="نام" value={first} onChange={(e) => setFirst(e.target.value)} />
          <button type="submit" className="admin-btn admin-btn--primary">افزودن / یافتن</button>
        </form>
      ) : null}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
        {customers.map((c) => (
          <Link key={c.id} to={`/admin/crm/customers/${c.id}`} className="admin-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <strong>{c.first} {c.last}</strong>
            <div className="admin-muted" dir="ltr">{c.mobile}</div>
            <div>{c.level} · {c.product || '—'}</div>
            <div className="admin-muted">{c.publicId}{c.salesCustomerId ? ' · از فروش' : ''}{c.platformUserId ? ' · کاربر پلتفرم' : ''}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminCrmCustomerDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<{
    customer: CrmCustomer;
    orders: { id: number; product: string; amount: number; orderedAt: string }[];
    interactions: CrmInteraction[];
    tickets: CrmTicket[];
    followups: CrmFollowup[];
    complaints: CrmComplaint[];
    referrals: CrmReferral[];
    surveys: CrmSurvey[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminFetch<{
      customer: CrmCustomer;
      orders: { id: number; product: string; amount: number; orderedAt: string }[];
      interactions: CrmInteraction[];
      tickets: CrmTicket[];
      followups: CrmFollowup[];
      complaints: CrmComplaint[];
      referrals: CrmReferral[];
      surveys: CrmSurvey[];
    }>(`/api/admin/crm/customers/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, [id]);

  if (error) return <div className="admin-page"><Err error={error} /></div>;
  if (!data) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;
  const c = data.customer;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-topbar-eyebrow"><Link to="/admin/crm/customers">← مشتریان</Link></p>
          <h1>{c.first} {c.last}</h1>
          <p dir="ltr">{c.mobile} · {c.publicId} · سطح {c.level}</p>
        </div>
      </header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.orders.length)}</div><div className="admin-stat-label">سفارش</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{c.csat != null ? formatNumFa(c.csat) : '—'}</div><div className="admin-stat-label">CSAT</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(data.tickets.length)}</div><div className="admin-stat-label">تیکت</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>سفارشات</h2></div>
        {data.orders.map((o) => <div key={o.id}>{o.product} · {formatNumFa(o.amount)} ت · {o.orderedAt.slice(0, 10)}</div>)}
        {!data.orders.length ? <p>سفارشی نیست</p> : null}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>تیکت‌ها</h2></div>
        {data.tickets.map((t) => <div key={t.id}>{t.publicId} · {t.title} · {t.status}</div>)}
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}><div className="admin-card-head"><h2>تعاملات</h2></div>
        {data.interactions.slice(0, 10).map((i) => (
          <div key={i.id}>{i.publicId} · {CRM_CHANNEL_LABELS[i.channel] || i.channel} · {i.wrapDone ? 'Wrap ✓' : 'ناتمام'} · {i.summary || '—'}</div>
        ))}
      </section>
    </div>
  );
}

export function AdminCrmExperiencePage() {
  const [surveys, setSurveys] = useState<CrmSurvey[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [form, setForm] = useState({ customerId: '', q1: '5', q2: '4', q3: '4', q4: '4', q5: '5', notes: '' });
  const canWrite = adminCan('crm.write');

  const load = () => {
    void adminFetch<{ surveys: CrmSurvey[] }>('/api/admin/crm/experience').then((d) => setSurveys(d.surveys));
    void adminFetch<{ customers: CrmCustomer[] }>('/api/admin/crm/customers?limit=50').then((d) => {
      setCustomers(d.customers);
      if (!form.customerId && d.customers[0]) setForm((f) => ({ ...f, customerId: String(d.customers[0].id) }));
    });
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await adminFetch('/api/admin/crm/surveys', {
      method: 'POST',
      body: JSON.stringify({
        customerId: Number(form.customerId),
        answers: { q1: Number(form.q1), q2: Number(form.q2), q3: Number(form.q3), q4: Number(form.q4), q5: Number(form.q5) },
        notes: form.notes,
      }),
    });
    load();
  };

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>تجربه مشتری</h1><p>نظرسنجی پنج‌پرسشی و CSAT</p></div></header>
      {canWrite ? (
        <form className="admin-card" onSubmit={(e) => void submit(e)} style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
          <label><span className="form-label">مشتری</span>
            <select className="form-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.first} {c.last} · {c.mobile}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
            {(['q1', 'q2', 'q3', 'q4', 'q5'] as const).map((k) => (
              <label key={k}><span className="form-label">{k}</span>
                <input className="form-input" dir="ltr" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <input className="form-input" placeholder="یادداشت" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="admin-btn admin-btn--primary">ثبت نظرسنجی</button>
        </form>
      ) : null}
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>شناسه</th><th>مشتری</th><th>امتیاز</th><th>تاریخ</th></tr></thead>
        <tbody>{surveys.map((s) => (
          <tr key={s.id}><td>{s.publicId}</td><td>{s.customerName || s.customerId}</td><td>{formatNumFa(s.rating)}</td><td>{s.createdAt.slice(0, 10)}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

export function AdminCrmCallsPage() {
  const [search] = useSearchParams();
  const wrapId = search.get('wrap');
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [mobile, setMobile] = useState('0912');
  const [wrapForm, setWrapForm] = useState({
    reason: 'اطلاعات محصول',
    subReason: 'ویژگی‌ها',
    outcome: 'حل‌شده',
    summary: '',
    requestedAction: '',
    createTicket: false,
    priority: 'متوسط',
  });
  const [activeWrap, setActiveWrap] = useState<number | null>(wrapId ? Number(wrapId) : null);
  const canWrite = adminCan('crm.write');

  const load = () => void adminFetch<{ interactions: CrmInteraction[] }>('/api/admin/crm/calls').then((d) => setInteractions(d.interactions));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (wrapId) setActiveWrap(Number(wrapId)); }, [wrapId]);

  const reasons = Object.keys(CRM_REASON_TREE);
  const subReasons = Object.keys(CRM_REASON_TREE[wrapForm.reason] || { عمومی: [] });

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>مرکز تماس</h1><p>آرشیو VoIP و شبیه‌سازی ورودی</p></div>
        {canWrite ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => void adminFetch('/api/admin/crm/calls/simulate-inbound', {
            method: 'POST', body: JSON.stringify({ mobile: mobile.length > 4 ? mobile : `0912${String(Date.now()).slice(-7)}` }),
          }).then(load)}>شبیه‌سازی تماس ورودی</button>
        ) : null}
      </header>
      {canWrite ? (
        <div style={{ marginBottom: 12 }}>
          <input className="form-input" dir="ltr" style={{ maxWidth: 200 }} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="موبایل" />
        </div>
      ) : null}
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>شناسه</th><th>کانال</th><th>مشتری</th><th>کارشناس</th><th>دقیقه</th><th>Wrap</th><th></th></tr></thead>
        <tbody>
          {interactions.map((i) => (
            <tr key={i.id}>
              <td>{i.publicId}</td>
              <td>{CRM_CHANNEL_LABELS[i.channel] || i.channel}</td>
              <td>{i.customerName || '—'}<div className="admin-muted" dir="ltr">{i.customerMobile}</div></td>
              <td>{i.agentName}</td>
              <td>{formatNumFa(i.talkMinutes)}</td>
              <td>{i.wrapDone ? '✓' : 'ناتمام'}</td>
              <td>{!i.wrapDone && canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setActiveWrap(i.id)}>Wrap-up</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {activeWrap && canWrite ? (
        <form className="admin-card" style={{ marginTop: 16, display: 'grid', gap: 8 }} onSubmit={(e) => {
          e.preventDefault();
          void adminFetch(`/api/admin/crm/interactions/${activeWrap}/wrapup`, {
            method: 'POST',
            body: JSON.stringify(wrapForm),
          }).then(() => { setActiveWrap(null); load(); });
        }}>
          <h2>ثبت Wrap-up #{activeWrap}</h2>
          <label><span className="form-label">دلیل</span>
            <select className="form-input" value={wrapForm.reason} onChange={(e) => setWrapForm({ ...wrapForm, reason: e.target.value, subReason: Object.keys(CRM_REASON_TREE[e.target.value] || {})[0] || '' })}>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label><span className="form-label">زیردلیل</span>
            <select className="form-input" value={wrapForm.subReason} onChange={(e) => setWrapForm({ ...wrapForm, subReason: e.target.value })}>
              {subReasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label><span className="form-label">نتیجه</span>
            <select className="form-input" value={wrapForm.outcome} onChange={(e) => setWrapForm({ ...wrapForm, outcome: e.target.value })}>
              {CRM_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label><span className="form-label">خلاصه (≥۴ کاراکتر)</span>
            <textarea className="form-input" value={wrapForm.summary} onChange={(e) => setWrapForm({ ...wrapForm, summary: e.target.value })} rows={3} />
          </label>
          {(wrapForm.outcome === 'ارجاع به مالی' || wrapForm.outcome === 'ارجاع به فروش') ? (
            <label><span className="form-label">اقدام درخواستی</span>
              <input className="form-input" value={wrapForm.requestedAction} onChange={(e) => setWrapForm({ ...wrapForm, requestedAction: e.target.value })} />
            </label>
          ) : null}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={wrapForm.createTicket} onChange={(e) => setWrapForm({ ...wrapForm, createTicket: e.target.checked })} />
            ایجاد تیکت
          </label>
          <label><span className="form-label">اولویت</span>
            <select className="form-input" value={wrapForm.priority} onChange={(e) => setWrapForm({ ...wrapForm, priority: e.target.value })}>
              {CRM_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="admin-btn admin-btn--primary">ثبت</button>
            <button type="button" className="admin-btn" onClick={() => setActiveWrap(null)}>انصراف</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function AdminCrmCasesPage() {
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') || 'tickets';
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [followups, setFollowups] = useState<CrmFollowup[]>([]);
  const [complaints, setComplaints] = useState<CrmComplaint[]>([]);
  const [referrals, setReferrals] = useState<CrmReferral[]>([]);
  const canWrite = adminCan('crm.write');

  const load = useCallback(() => {
    void adminFetch<{ tickets?: CrmTicket[]; followups?: CrmFollowup[]; complaints?: CrmComplaint[]; referrals?: CrmReferral[] }>(
      `/api/admin/crm/cases?tab=${tab}`
    ).then((d) => {
      setTickets(d.tickets || []);
      setFollowups(d.followups || []);
      setComplaints(d.complaints || []);
      setReferrals(d.referrals || []);
    });
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  const setTab = (t: string) => {
    const next = new URLSearchParams(search);
    next.set('tab', t);
    setSearch(next);
  };

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>هاب پرونده‌ها</h1><p>تیکت · پیگیری · شکایت · ارجاع</p></div></header>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          ['tickets', 'تیکت‌ها'],
          ['follow', 'پیگیری‌ها'],
          ['complaints', 'شکایات'],
          ['referrals', 'ارجاعات'],
        ].map(([k, label]) => (
          <button key={k} type="button" className={`admin-btn${tab === k ? ' admin-btn--primary' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'tickets' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>شناسه</th><th>عنوان</th><th>مشتری</th><th>اولویت</th><th>وضعیت</th><th>SLA</th><th></th></tr></thead>
          <tbody>{tickets.map((t) => (
            <tr key={t.id} style={{ borderRight: `3px solid ${t.borderColor || '#ddd'}` }}>
              <td>{t.publicId}</td><td>{t.title}</td><td>{t.customerName}</td><td>{t.priority}</td><td>{t.status}</td><td>{t.slaState}</td>
              <td>{canWrite && t.status !== 'حل‌شده' ? (
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                  method: 'PATCH', body: JSON.stringify({ status: 'حل‌شده', resolutionCode: 'DONE', resolutionNote: 'از پنل' }),
                }).then(load)}>حل</button>
              ) : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {tab === 'follow' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>شناسه</th><th>شرح</th><th>سررسید</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{followups.map((f) => (
            <tr key={f.id}>
              <td>{f.publicId}</td><td>{f.description}</td><td>{f.dueAt.slice(0, 16)}</td><td>{f.status}</td>
              <td>{canWrite && f.status === 'باز' ? (
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/crm/followups/${f.id}/complete`, {
                  method: 'POST', body: JSON.stringify({ result: 'انجام شد' }),
                }).then(load)}>تکمیل</button>
              ) : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {tab === 'complaints' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>شناسه</th><th>دسته</th><th>مشتری</th><th>شدت</th><th>وضعیت</th></tr></thead>
          <tbody>{complaints.map((c) => (
            <tr key={c.id}><td>{c.publicId}</td><td>{c.category}/{c.subCategory}</td><td>{c.customerName}</td><td>{c.severity}</td><td>{c.status}</td></tr>
          ))}</tbody>
        </table></div>
      ) : null}
      {tab === 'referrals' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>شناسه</th><th>نوع</th><th>اقدام</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{referrals.map((r) => (
            <tr key={r.id}>
              <td>{r.publicId}</td><td>{r.type}</td><td>{r.requestedAction}</td><td>{r.status}</td>
              <td>{canWrite && r.status === 'باز' ? (
                <>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/crm/referrals/${r.id}/respond`, { method: 'POST', body: JSON.stringify({ approve: true }) }).then(load)}>تایید</button>
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/crm/referrals/${r.id}/respond`, { method: 'POST', body: JSON.stringify({ approve: false, response: 'رد' }) }).then(load)}>رد</button>
                </>
              ) : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : null}
    </div>
  );
}

export function AdminCrmSmsPage() {
  const [patterns, setPatterns] = useState<CrmSmsPattern[]>([]);
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [send, setSend] = useState({ patternId: '', customerId: '' });
  const [form, setForm] = useState({ name: '', text: '', trigger: 'manual', auto: false });
  const canAdmin = adminCan('crm.admin');
  const canWrite = adminCan('crm.write');

  const load = () => {
    void adminFetch<{ patterns: CrmSmsPattern[] }>('/api/admin/crm/sms').then((d) => {
      setPatterns(d.patterns);
      if (!send.patternId && d.patterns[0]) setSend((s) => ({ ...s, patternId: String(d.patterns[0].id) }));
    });
    void adminFetch<{ customers: CrmCustomer[] }>('/api/admin/crm/customers?limit=50').then((d) => {
      setCustomers(d.customers);
      if (!send.customerId && d.customers[0]) setSend((s) => ({ ...s, customerId: String(d.customers[0].id) }));
    });
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>پیامک و پترن‌ها</h1><p>قالب‌های خودکار رویدادمحور</p></div></header>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>نام</th><th>تریگر</th><th>خودکار</th><th>متن</th></tr></thead>
        <tbody>{patterns.map((p) => (
          <tr key={p.id}><td>{p.name}</td><td>{p.trigger}</td><td>{p.auto ? 'بله' : 'خیر'}</td><td>{p.text}</td></tr>
        ))}</tbody>
      </table></div>
      {canWrite ? (
        <form className="admin-card" style={{ marginTop: 16, display: 'grid', gap: 8 }} onSubmit={(e) => {
          e.preventDefault();
          void adminFetch('/api/admin/crm/sms/send', {
            method: 'POST',
            body: JSON.stringify({ patternId: Number(send.patternId), customerId: Number(send.customerId) }),
          }).then(() => alert('ارسال شد'));
        }}>
          <h2>ارسال گروهی / تکی</h2>
          <select className="form-input" value={send.patternId} onChange={(e) => setSend({ ...send, patternId: e.target.value })}>
            {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="form-input" value={send.customerId} onChange={(e) => setSend({ ...send, customerId: e.target.value })}>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.first} {c.last}</option>)}
          </select>
          <button type="submit" className="admin-btn admin-btn--primary">ارسال</button>
        </form>
      ) : null}
      {canAdmin ? (
        <form className="admin-card" style={{ marginTop: 16, display: 'grid', gap: 8 }} onSubmit={(e) => {
          e.preventDefault();
          void adminFetch('/api/admin/crm/sms/patterns', { method: 'POST', body: JSON.stringify(form) }).then(() => { setForm({ name: '', text: '', trigger: 'manual', auto: false }); load(); });
        }}>
          <h2>پترن جدید</h2>
          <input className="form-input" placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="form-input" placeholder="متن با {نام} {محصول} {شناسه}" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} required />
          <input className="form-input" placeholder="تریگر" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} />
          <label><input type="checkbox" checked={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.checked })} /> خودکار</label>
          <button type="submit" className="admin-btn">ذخیره پترن</button>
        </form>
      ) : null}
    </div>
  );
}

export function AdminCrmQaPage() {
  const [reviews, setReviews] = useState<CrmQaReview[]>([]);
  const [pending, setPending] = useState<CrmInteraction[]>([]);
  const [form, setForm] = useState({ interactionId: '', coaching: false, critical: false });
  const canAdmin = adminCan('crm.admin');

  const load = () => void adminFetch<{ reviews: CrmQaReview[]; pending: CrmInteraction[] }>('/api/admin/crm/qa').then((d) => {
    setReviews(d.reviews);
    setPending(d.pending);
    if (!form.interactionId && d.pending[0]) setForm((f) => ({ ...f, interactionId: String(d.pending[0].id) }));
  });
  useEffect(() => { load(); }, []);

  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>کنترل کیفیت</h1><p>اسکورکارت و کوچینگ</p></div></header>
      {canAdmin && pending.length ? (
        <form className="admin-card" style={{ marginBottom: 16, display: 'grid', gap: 8 }} onSubmit={(e) => {
          e.preventDefault();
          const scores: Record<string, number> = {};
          for (const s of CRM_SCORECARD) scores[s.key] = 80;
          void adminFetch('/api/admin/crm/qa/reviews', {
            method: 'POST',
            body: JSON.stringify({
              interactionId: Number(form.interactionId),
              scores,
              critical: form.critical ? ['توهین به مشتری'] : [],
              coaching: form.coaching,
              comment: 'ارزیابی از پنل',
            }),
          }).then(load);
        }}>
          <h2>ارزیابی جدید</h2>
          <select className="form-input" value={form.interactionId} onChange={(e) => setForm({ ...form, interactionId: e.target.value })}>
            {pending.map((i) => <option key={i.id} value={i.id}>{i.publicId} · {i.agentName}</option>)}
          </select>
          <label><input type="checkbox" checked={form.coaching} onChange={(e) => setForm({ ...form, coaching: e.target.checked })} /> کوچینگ</label>
          <label><input type="checkbox" checked={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.checked })} /> خطای بحرانی</label>
          <button type="submit" className="admin-btn admin-btn--primary">ثبت ارزیابی</button>
        </form>
      ) : null}
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>شناسه</th><th>عامل</th><th>امتیاز</th><th>وضعیت</th><th>بحرانی</th></tr></thead>
        <tbody>{reviews.map((r) => (
          <tr key={r.id}><td>{r.publicId}</td><td>{r.agentId}</td><td>{formatNumFa(r.total)}</td><td>{r.status}</td><td>{r.critical.join('، ') || '—'}</td></tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

export function AdminCrmReportsPage() {
  const [summary, setSummary] = useState<CrmReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void adminFetch<{ summary: CrmReportSummary }>('/api/admin/crm/reports')
      .then((d) => setSummary(d.summary))
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'));
  }, []);
  if (error) return <div className="admin-page"><Err error={error} /></div>;
  if (!summary) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>گزارش‌های امور مشتریان</h1></div></header>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(summary.ticketsOpen)}</div><div className="admin-stat-label">تیکت باز</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{formatNumFa(summary.ticketsResolved)}</div><div className="admin-stat-label">حل‌شده</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{summary.csatAvg != null ? formatNumFa(summary.csatAvg) : '—'}</div><div className="admin-stat-label">CSAT</div></div>
        <div className="admin-stat"><div className="admin-stat-value">{summary.qaAvg != null ? formatNumFa(summary.qaAvg) : '—'}</div><div className="admin-stat-label">میانگین QA</div></div>
      </div>
      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-card-head"><h2>بر اساس کارشناس</h2></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>کارشناس</th><th>تیکت</th><th>تماس</th><th>QA</th></tr></thead>
          <tbody>{summary.byAgent.map((a) => (
            <tr key={a.agentId}><td>{a.agentName}</td><td>{formatNumFa(a.tickets)}</td><td>{formatNumFa(a.calls)}</td><td>{a.qaAvg != null ? formatNumFa(a.qaAvg) : '—'}</td></tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}

export function AdminCrmSettingsPage() {
  const [settings, setSettings] = useState<CrmSettings | null>(null);
  const canAdmin = adminCan('crm.admin');
  useEffect(() => {
    void adminFetch<{ settings: CrmSettings }>('/api/admin/crm/settings').then((d) => setSettings(d.settings));
  }, []);
  if (!settings) return <div className="admin-page"><p>در حال بارگذاری…</p></div>;
  return (
    <div className="admin-page">
      <header className="admin-header"><div><h1>تنظیمات امور مشتریان</h1><p>SLA · دلایل · اسکورکارت</p></div></header>
      <section className="admin-card">
        <div className="admin-card-head"><h2>سیاست SLA (ساعت حل)</h2></div>
        <ul>{Object.entries(settings.slaPolicy).map(([k, v]) => (
          <li key={k}>{k}: پاسخ اول {formatNumFa(v[0])} دقیقه · حل {formatNumFa(v[1])} ساعت</li>
        ))}</ul>
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head"><h2>درخت دلایل</h2></div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(settings.reasonTree, null, 2)}</pre>
      </section>
      <section className="admin-card" style={{ marginTop: 12 }}>
        <div className="admin-card-head"><h2>اسکورکارت QA</h2></div>
        <ul>{settings.scorecard.map((s) => <li key={s.key}>{s.label} · وزن {formatNumFa(s.weight)}</li>)}</ul>
      </section>
      {canAdmin ? (
        <button type="button" className="admin-btn" style={{ marginTop: 12 }} onClick={() => void adminFetch('/api/admin/crm/sla/watch', { method: 'POST', body: '{}' }).then((d) => alert(JSON.stringify(d)))}>
          اجرای ناظر SLA
        </button>
      ) : null}
    </div>
  );
}
