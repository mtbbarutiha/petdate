/**
 * ماژول تیکتینگ — هم‌تراز پروتوتایپ فانکشنال، تم Pepito LIGHT RTL.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CRM_PENDING_REASONS,
  CRM_PRIORITIES,
  CRM_RESOLUTION_CODES,
  CRM_REOPEN_REASONS,
  CRM_ROOT_CAUSES,
  CRM_SLA_POLICY,
  CRM_TICKET_CHANNELS,
  CRM_TICKET_OPEN_STATUSES,
  CRM_TICKET_QUEUES,
  CRM_TICKET_SEVERITIES,
  CRM_TICKET_STATUSES,
  CRM_TICKET_TAXONOMY,
  CRM_TICKET_TYPES,
  crmQueueOf,
  crmTicketCatsOf,
  crmTicketSubsOf,
  type CrmCustomer,
  type CrmFollowup,
  type CrmOrder,
  type CrmReferral,
  type CrmTicket,
  type CrmTicketActivity,
  type CrmTicketingAgent,
  type CrmTicketingOverview,
} from '@petdate/shared';
import { AdminModal } from '../../AdminModal';
import { adminCan } from '../../auth';
import { adminFetch, formatNumFa } from '../../api';

type View = 'dash' | 'tickets' | 'queue' | 'followups' | 'escalations' | 'reports' | 'settings' | 'detail';
type ModalKind =
  | null
  | { type: 'newticket' }
  | { type: 'assign'; ticketId: number }
  | { type: 'transfer'; ticketId: number }
  | { type: 'status'; ticketId: number }
  | { type: 'priority'; ticketId: number }
  | { type: 'escalate'; ticketId: number; module: 'finance' | 'sales' }
  | { type: 'respond_esc'; escId: number }
  | { type: 'followup'; ticketId: number }
  | { type: 'resolve'; ticketId: number }
  | { type: 'reopen'; ticketId: number };

const statusTone = (s: string) =>
  ({
    'جدید': 'info',
    'تخصیص‌یافته': 'info',
    'در حال بررسی': 'warn',
    'در انتظار مشتری': 'muted',
    'در انتظار داخلی': 'muted',
    'ارجاع به سطح بالاتر': 'error',
    'حل‌شده': 'ok',
    'بسته‌شده': 'muted',
    'بازگشایی‌شده': 'error',
  }[s] || 'muted');

const prioTone = (p: string) =>
  ({ بحرانی: 'error', بالا: 'warn', متوسط: 'info', پایین: 'muted' }[p] || 'muted');

function Tag({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`tk-tag tk-tag--${tone}`}>{children}</span>;
}

function faDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fa-IR');
  } catch {
    return iso;
  }
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`admin-stat${tone ? ` admin-stat--${tone}` : ''}`}>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function eventLabel(k: string) {
  return (
    {
      created: 'ایجاد تیکت',
      assigned: 'تخصیص',
      transferred: 'ارجاع بین‌تیمی',
      status_change: 'تغییر وضعیت',
      priority_change: 'تغییر اولویت',
      escalation: 'ارجاع بین‌واحدی',
      escalation_response: 'پاسخ ارجاع',
      call: 'تماس',
      resolved: 'حل‌شده',
      closed: 'بسته‌شده',
      reopened: 'بازگشایی',
      macro: 'اجرای ماکرو',
      followup: 'پیگیری',
      public_reply: 'پاسخ عمومی',
      internal_note: 'یادداشت داخلی',
      note: 'یادداشت',
    }[k] || k
  );
}

export function AdminCrmTicketingPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'dash';
  const openId = params.get('id') ? Number(params.get('id')) : null;
  const [data, setData] = useState<CrmTicketingOverview | null>(null);
  const [detail, setDetail] = useState<{
    ticket: CrmTicket;
    activities: CrmTicketActivity[];
    customer: CrmCustomer | null;
    orders: CrmOrder[];
    relatedTickets: CrmTicket[];
    followups: CrmFollowup[];
    referrals: CrmReferral[];
    orphanCustomer?: boolean;
  } | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteVis, setNoteVis] = useState<'public' | 'internal'>('public');
  const canWrite = adminCan('crm.write') || adminCan('admin.full');
  const canAdmin = adminCan('crm.admin') || adminCan('admin.full');

  const setView = (v: View, id?: number | null) => {
    const next = new URLSearchParams();
    next.set('view', v);
    if (id) next.set('id', String(id));
    setParams(next);
  };

  const say = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(() => {
    void adminFetch<CrmTicketingOverview>('/api/admin/crm/ticketing').then(setData);
  }, []);

  const loadDetail = useCallback((id: number) => {
    void adminFetch<{
      ticket: CrmTicket;
      activities: CrmTicketActivity[];
      customer: CrmCustomer | null;
      orders: CrmOrder[];
      relatedTickets: CrmTicket[];
      followups: CrmFollowup[];
      referrals: CrmReferral[];
      orphanCustomer?: boolean;
    }>(`/api/admin/crm/tickets/${id}`).then(setDetail);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view === 'detail' && openId) loadDetail(openId);
    else setDetail(null);
  }, [view, openId, loadDetail]);

  const tickets = data?.tickets || [];
  const openTk = tickets.filter((t) => (CRM_TICKET_OPEN_STATUSES as readonly string[]).includes(t.status));
  const agents = data?.agents || [];
  const uName = (id?: string | null) => agents.find((a) => a.id === id)?.name || id || '—';

  const patch = async (id: number, body: Record<string, unknown>, okMsg?: string) => {
    await adminFetch(`/api/admin/crm/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    load();
    if (view === 'detail' && openId === id) loadDetail(id);
    if (okMsg) say(okMsg);
  };

  const NAV: Array<{ k: View; fa: string; c?: number; hot?: boolean }> = [
    { k: 'dash', fa: 'داشبورد' },
    { k: 'tickets', fa: 'تیکت‌ها', c: openTk.length },
    { k: 'queue', fa: 'صف تیم', c: data?.stats.unassigned, hot: (data?.stats.breached || 0) > 0 },
    { k: 'followups', fa: 'پیگیری‌ها', c: data?.stats.openFollowups },
    { k: 'escalations', fa: 'ارجاعات', c: data?.stats.openReferrals },
    { k: 'reports', fa: 'گزارش‌ها' },
    { k: 'settings', fa: 'تنظیمات' },
  ];

  return (
    <div className="admin-page admin-page--wide tk-module">
      {toast ? <div className="tk-toast">{toast}</div> : null}
      <div className="tk-shell">
        <aside className="tk-side">
          <div className="tk-brand">
            <b>ماژول تیکتینگ</b>
            <span>امور مشتریان · Pet Date</span>
          </div>
          {NAV.map((n) => (
            <button
              key={n.k}
              type="button"
              className={`tk-nav${view === n.k ? ' is-on' : ''}`}
              onClick={() => setView(n.k)}
            >
              <span>{n.fa}</span>
              {n.c != null ? <span className={`tk-cnt${n.hot ? ' is-hot' : ''}`}>{formatNumFa(n.c)}</span> : null}
            </button>
          ))}
          {canWrite ? (
            <button type="button" className="admin-btn admin-btn--primary tk-new" onClick={() => setModal({ type: 'newticket' })}>
              + تیکت جدید
            </button>
          ) : null}
        </aside>

        <main className="tk-main">
          {!data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

          {data && view === 'dash' ? (
            <Dash stats={data.stats} tickets={tickets} openTk={openTk} agents={agents} />
          ) : null}

          {data && view === 'tickets' ? (
            <TicketList
              tickets={tickets}
              agents={agents}
              uName={uName}
              canWrite={canWrite}
              onOpen={(id) => setView('detail', id)}
              onNew={() => setModal({ type: 'newticket' })}
            />
          ) : null}

          {data && view === 'queue' ? (
            <TeamQueue
              tickets={openTk}
              uName={uName}
              canWrite={canWrite}
              onOpen={(id) => setView('detail', id)}
              onAssign={(id) => setModal({ type: 'assign', ticketId: id })}
            />
          ) : null}

          {data && view === 'followups' ? (
            <FollowupsView
              followups={data.followups}
              tickets={tickets}
              uName={uName}
              canWrite={canWrite}
              onOpen={(id) => setView('detail', id)}
              onComplete={(id) =>
                void adminFetch(`/api/admin/crm/followups/${id}/complete`, {
                  method: 'POST',
                  body: JSON.stringify({ result: 'انجام شد' }),
                }).then(() => {
                  load();
                  say('پیگیری تکمیل شد');
                })
              }
            />
          ) : null}

          {data && view === 'escalations' ? (
            <EscalationsView
              referrals={data.referrals}
              tickets={tickets}
              canWrite={canWrite}
              onOpen={(id) => setView('detail', id)}
              onRespond={(id) => setModal({ type: 'respond_esc', escId: id })}
            />
          ) : null}

          {data && view === 'reports' ? <ReportsView tickets={tickets} agents={agents} /> : null}

          {data && view === 'settings' ? (
            <SettingsView audit={data.audit} agents={agents} canAdmin={canAdmin} />
          ) : null}

          {view === 'detail' && detail ? (
            <DetailView
              detail={detail}
              uName={uName}
              canWrite={canWrite}
              canAdmin={canAdmin}
              note={note}
              noteVis={noteVis}
              setNote={setNote}
              setNoteVis={setNoteVis}
              onBack={() => setView('tickets')}
              setModal={setModal}
              onSendNote={() => {
                if (!note.trim()) return;
                void patch(
                  detail.ticket.id,
                  {
                    activityText: note.trim(),
                    activityKind: noteVis === 'public' ? 'public_reply' : 'internal_note',
                    activityVisibility: noteVis,
                    status: detail.ticket.status === 'جدید' ? 'در حال بررسی' : undefined,
                  },
                  noteVis === 'public' ? 'پاسخ ارسال شد' : 'یادداشت ثبت شد'
                ).then(() => setNote(''));
              }}
              onCloseTicket={() => void patch(detail.ticket.id, { status: 'بسته‌شده' }, 'تیکت بسته شد')}
              onMacro={(key) =>
                void adminFetch(`/api/admin/crm/tickets/${detail.ticket.id}/macro`, {
                  method: 'POST',
                  body: JSON.stringify({ key }),
                }).then(() => {
                  load();
                  loadDetail(detail.ticket.id);
                  say('ماکرو اجرا شد');
                })
              }
            />
          ) : null}
        </main>
      </div>

      <TicketingModals
        modal={modal}
        setModal={setModal}
        tickets={tickets}
        agents={agents}
        referrals={data?.referrals || []}
        canWrite={canWrite}
        onDone={(msg) => {
          setModal(null);
          load();
          if (openId) loadDetail(openId);
          if (msg) say(msg);
        }}
        onCreated={(id) => {
          setModal(null);
          load();
          setView('detail', id);
          say('تیکت ثبت شد');
        }}
      />
    </div>
  );
}

function Dash({
  stats,
  tickets,
  openTk,
  agents,
}: {
  stats: CrmTicketingOverview['stats'];
  tickets: CrmTicket[];
  openTk: CrmTicket[];
  agents: CrmTicketingAgent[];
}) {
  const byPrio = CRM_PRIORITIES.map((p) => ({
    label: p,
    value: openTk.filter((t) => t.priority === p).length,
  }));
  const byType = [...new Set(tickets.map((t) => t.type || 'سایر'))].map((tp) => ({
    label: tp,
    value: tickets.filter((t) => t.type === tp).length,
  }));
  const agentLoad = agents.slice(0, 8).map((a) => ({
    name: a.name,
    n: openTk.filter((t) => t.agentId === a.id).length,
  }));
  const maxLoad = Math.max(3, ...agentLoad.map((a) => a.n));

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>داشبورد تیکتینگ</h1>
          <p>وضعیت لحظه‌ای درخواست‌ها، SLA و بار کاری تیم</p>
        </div>
      </header>
      <div className="admin-stats tk-kpis">
        <Kpi label="تیکت باز" value={formatNumFa(stats.open)} tone="sky" />
        <Kpi label="جدید امروز" value={formatNumFa(stats.newToday)} tone="mint" />
        <Kpi label="حل‌شده امروز" value={formatNumFa(stats.resolvedToday)} tone="mint" />
        <Kpi label="در معرض ریسک SLA" value={formatNumFa(stats.atRisk)} tone="amber" />
        <Kpi label="نقض SLA" value={formatNumFa(stats.breached)} tone="rose" />
        <Kpi label="تخصیص‌نیافته" value={formatNumFa(stats.unassigned)} tone="violet" />
      </div>
      <div className="tk-split">
        <div className="admin-card">
          <b>پایبندی به SLA</b>
          <div className="tk-sla-big" style={{ color: stats.slaPct >= 90 ? '#0f9f7a' : stats.slaPct >= 70 ? '#c47a00' : '#c62828' }}>
            {formatNumFa(stats.slaPct)}٪
          </div>
          <div className="tk-bar"><i style={{ width: `${stats.slaPct}%` }} /></div>
          <b className="tk-subhead">بار کاری کارشناسان</b>
          {agentLoad.map((a) => (
            <div key={a.name} className="tk-hbar">
              <span>{a.name}</span>
              <span className="tk-bar"><i style={{ width: `${(a.n / maxLoad) * 100}%` }} /></span>
              <em>{formatNumFa(a.n)}</em>
            </div>
          ))}
        </div>
        <div className="admin-card">
          <b>باز به تفکیک اولویت</b>
          <ul className="tk-legend">
            {byPrio.map((d) => (
              <li key={d.label}><Tag tone={prioTone(d.label)}>{d.label}</Tag><strong>{formatNumFa(d.value)}</strong></li>
            ))}
          </ul>
          <b className="tk-subhead">به تفکیک نوع</b>
          <ul className="tk-legend">
            {byType.filter((d) => d.value).slice(0, 8).map((d) => (
              <li key={d.label}><span>{d.label}</span><strong>{formatNumFa(d.value)}</strong></li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function TicketList({
  tickets,
  agents,
  uName,
  canWrite,
  onOpen,
  onNew,
}: {
  tickets: CrmTicket[];
  agents: CrmTicketingAgent[];
  uName: (id?: string | null) => string;
  canWrite: boolean;
  onOpen: (id: number) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState('');
  const [fs, setFs] = useState('all');
  const [fp, setFp] = useState('all');
  const [fo, setFo] = useState('all');
  const rows = tickets
    .filter(
      (t) =>
        (fs === 'all' || t.status === fs) &&
        (fp === 'all' || t.priority === fp) &&
        (fo === 'all' || t.agentId === fo) &&
        (!q ||
          t.title.includes(q) ||
          t.publicId.includes(q) ||
          (t.tags || []).some((tg) => tg.includes(q)) ||
          (t.customerName || '').includes(q))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>تیکت‌ها</h1>
          <p>{formatNumFa(rows.length)} تیکت</p>
        </div>
        {canWrite ? (
          <button type="button" className="admin-btn admin-btn--primary" onClick={onNew}>+ تیکت جدید</button>
        ) : null}
      </header>
      <div className="admin-card tk-filters">
        <label>جستجو<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="شناسه، موضوع، مشتری…" /></label>
        <label>وضعیت
          <select value={fs} onChange={(e) => setFs(e.target.value)}>
            <option value="all">همه</option>
            {CRM_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>اولویت
          <select value={fp} onChange={(e) => setFp(e.target.value)}>
            <option value="all">همه</option>
            {CRM_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>مالک
          <select value={fo} onChange={(e) => setFo(e.target.value)}>
            <option value="all">همه</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>شناسه</th><th>موضوع</th><th>مشتری</th><th>نوع</th><th>وضعیت</th><th>اولویت</th><th>مالک</th><th>SLA</th><th>ایجاد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="tk-row" onClick={() => onOpen(t.id)} style={{ borderRight: `3px solid ${t.borderColor || '#ddd'}` }}>
                <td className="tk-mono">{t.publicId}</td>
                <td>
                  {t.title}
                  {t.reopenedCount > 0 ? <Tag tone="error">بازگشایی×{formatNumFa(t.reopenedCount)}</Tag> : null}
                  {t.nextAction?.includes('[orphan]') ? <Tag tone="error">مشتری یتیم</Tag> : null}
                </td>
                <td>
                  {t.customerId ? (
                    <Link to={`/admin/crm/customers/${t.customerId}`} onClick={(e) => e.stopPropagation()}>
                      {t.customerName || `CU-${t.customerId}`}
                    </Link>
                  ) : '—'}
                </td>
                <td className="admin-muted">{t.type}</td>
                <td><Tag tone={statusTone(t.status)}>{t.status}</Tag></td>
                <td><Tag tone={prioTone(t.priority)}>{t.priority}</Tag></td>
                <td>{t.agentId ? uName(t.agentId) : <span className="admin-muted">تخصیص‌نیافته</span>}</td>
                <td><Tag tone={t.slaState === 'breached' ? 'error' : t.slaState === 'at_risk' ? 'warn' : t.slaState === 'ok' ? 'ok' : 'muted'}>{t.slaLabel || t.slaState}</Tag></td>
                <td className="admin-muted">{faDate(t.createdAt)}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={9} className="admin-muted">موردی یافت نشد</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TeamQueue({
  tickets,
  uName,
  canWrite,
  onOpen,
  onAssign,
}: {
  tickets: CrmTicket[];
  uName: (id?: string | null) => string;
  canWrite: boolean;
  onOpen: (id: number) => void;
  onAssign: (id: number) => void;
}) {
  const cols = [
    { k: 'جدید', fa: 'جدید / تخصیص‌نیافته' },
    { k: 'تخصیص‌یافته', fa: 'تخصیص‌یافته' },
    { k: 'در حال بررسی', fa: 'در حال بررسی' },
    { k: 'در انتظار مشتری', fa: 'در انتظار مشتری' },
    { k: 'در انتظار داخلی', fa: 'در انتظار داخلی' },
    { k: 'ارجاع به سطح بالاتر', fa: 'ارجاع سطح بالاتر' },
  ];
  return (
    <>
      <header className="admin-header">
        <div><h1>صف تیم</h1><p>نمای عملیاتی — بار کاری، تخصیص‌نیافته‌ها و ریسک SLA</p></div>
      </header>
      <div className="tk-kanban">
        {cols.map((c) => {
          const items = tickets.filter((t) => t.status === c.k);
          return (
            <div key={c.k} className="tk-kcol">
              <h4>{c.fa}<span>{formatNumFa(items.length)}</span></h4>
              {items.map((t) => (
                <div key={t.id} className="tk-kcard" onClick={() => onOpen(t.id)} role="button" tabIndex={0}>
                  <div className="tk-kcard-top">
                    <span className="tk-mono">{t.publicId}</span>
                    <Tag tone={prioTone(t.priority)}>{t.priority}</Tag>
                  </div>
                  <div>{t.title}</div>
                  <div className="tk-kcard-bot">
                    <span className="admin-muted">{t.agentId ? uName(t.agentId) : 'بدون مالک'}</span>
                    <Tag tone={t.slaState === 'breached' ? 'error' : t.slaState === 'at_risk' ? 'warn' : 'ok'}>{t.slaLabel || 'SLA'}</Tag>
                  </div>
                  {canWrite && !t.agentId ? (
                    <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={(e) => { e.stopPropagation(); onAssign(t.id); }}>تخصیص سریع</button>
                  ) : null}
                </div>
              ))}
              {!items.length ? <div className="admin-muted tk-empty">خالی</div> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function FollowupsView({
  followups,
  tickets,
  uName,
  canWrite,
  onOpen,
  onComplete,
}: {
  followups: CrmFollowup[];
  tickets: CrmTicket[];
  uName: (id?: string | null) => string;
  canWrite: boolean;
  onOpen: (id: number) => void;
  onComplete: (id: number) => void;
}) {
  const [tab, setTab] = useState<'overdue' | 'today' | 'week' | 'done'>('today');
  const now = Date.now();
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const day = 24 * 3600_000;
  const t1 = t0.getTime() + day;
  const groups = {
    overdue: followups.filter((f) => f.status === 'باز' && new Date(f.dueAt).getTime() < now),
    today: followups.filter((f) => f.status === 'باز' && new Date(f.dueAt).getTime() >= now && new Date(f.dueAt).getTime() < t1),
    week: followups.filter((f) => f.status === 'باز' && new Date(f.dueAt).getTime() >= t1 && new Date(f.dueAt).getTime() < t0.getTime() + 7 * day),
    done: followups.filter((f) => f.status === 'انجام‌شده'),
  };
  return (
    <>
      <header className="admin-header"><div><h1>پیگیری‌ها</h1><p>اقدامات بعدی زمان‌بندی‌شده روی تیکت‌ها</p></div></header>
      <div className="tk-tabs">
        {([['overdue', 'عقب‌افتاده'], ['today', 'امروز'], ['week', 'این هفته'], ['done', 'انجام‌شده']] as const).map(([k, fa]) => (
          <button key={k} type="button" className={`admin-btn admin-btn--sm${tab === k ? ' admin-btn--primary' : ''}`} onClick={() => setTab(k)}>
            {fa} ({formatNumFa(groups[k].length)})
          </button>
        ))}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>تیکت</th><th>موضوع</th><th>نوع</th><th>شرح</th><th>مالک</th><th>زمان</th><th></th></tr></thead>
          <tbody>
            {groups[tab].map((f) => {
              const t = tickets.find((x) => x.id === f.ticketId);
              return (
                <tr key={f.id}>
                  <td className="tk-mono tk-link" onClick={() => f.ticketId && onOpen(f.ticketId)}>{t?.publicId || '—'}</td>
                  <td>{t?.title || f.customerName || '—'}</td>
                  <td>{f.kind}</td>
                  <td className="admin-muted">{f.description}</td>
                  <td>{f.ownerName || uName(f.ownerId)}</td>
                  <td className="admin-muted">{faDate(f.dueAt)}</td>
                  <td>
                    {f.status === 'باز' && canWrite ? (
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => onComplete(f.id)}>تکمیل</button>
                    ) : (
                      <Tag tone="ok">{f.result || 'انجام‌شده'}</Tag>
                    )}
                  </td>
                </tr>
              );
            })}
            {!groups[tab].length ? <tr><td colSpan={7} className="admin-muted">موردی نیست</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EscalationsView({
  referrals,
  tickets,
  canWrite,
  onOpen,
  onRespond,
}: {
  referrals: CrmReferral[];
  tickets: CrmTicket[];
  canWrite: boolean;
  onOpen: (id: number) => void;
  onRespond: (id: number) => void;
}) {
  return (
    <>
      <header className="admin-header">
        <div><h1>ارجاعات بین‌واحدی</h1><p>درخواست‌های مالی و فروش — نتیجه به تیکت اصلی بازمی‌گردد</p></div>
      </header>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>تیکت</th><th>واحد مقصد</th><th>اقدام</th><th>اولویت</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th><th></th></tr></thead>
          <tbody>
            {referrals.map((e) => {
              const t = tickets.find((x) => x.id === e.ticketId);
              return (
                <tr key={e.id}>
                  <td className="tk-mono tk-link" onClick={() => e.ticketId && onOpen(e.ticketId)}>{t?.publicId || '—'}</td>
                  <td><Tag tone="info">{e.targetTeam}</Tag></td>
                  <td>{e.requestedAction}</td>
                  <td><Tag tone={prioTone(e.priority)}>{e.priority}</Tag></td>
                  <td>{e.amount ? `${formatNumFa(e.amount)} ریال` : '—'}</td>
                  <td><Tag tone={e.status === 'تایید' || e.status === 'انجام‌شده' ? 'ok' : e.status === 'باز' ? 'info' : 'warn'}>{e.status}</Tag></td>
                  <td className="admin-muted">{faDate(e.createdAt)}</td>
                  <td>
                    {canWrite && e.status === 'باز' ? (
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => onRespond(e.id)}>پاسخ</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!referrals.length ? <tr><td colSpan={8} className="admin-muted">ارجاعی نیست</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ReportsView({ tickets, agents }: { tickets: CrmTicket[]; agents: CrmTicketingAgent[] }) {
  const closed = tickets.filter((t) => t.resolvedAt);
  const reopenRate = closed.length
    ? Math.round((closed.filter((t) => t.reopenedCount > 0).length / closed.length) * 100)
    : 0;
  const escRate = tickets.length
    ? Math.round(
        (tickets.filter((t) => t.status === 'ارجاع به سطح بالاتر').length / tickets.length) * 100
      )
    : 0;
  const avgFirst = (() => {
    const vals = tickets
      .filter((t) => t.firstResponseAt)
      .map((t) => (new Date(t.firstResponseAt!).getTime() - new Date(t.createdAt).getTime()) / 60000);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();
  const avgResolve = (() => {
    const vals = closed.map(
      (t) => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600_000
    );
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  })();
  const openAges = tickets
    .filter((t) => (CRM_TICKET_OPEN_STATUSES as readonly string[]).includes(t.status))
    .map((t) => Date.now() - new Date(t.createdAt).getTime());
  const buckets: Array<[string, number]> = [
    ['< ۱ ساعت', 3600_000],
    ['۱ تا ۴ ساعت', 4 * 3600_000],
    ['۴ تا ۲۴ ساعت', 24 * 3600_000],
    ['۱ تا ۳ روز', 3 * 24 * 3600_000],
    ['بیش از ۳ روز', Infinity],
  ];
  let prev = 0;
  const aging = buckets.map(([fa, upper]) => {
    const n = openAges.filter((a) => a >= prev && a < upper).length;
    prev = upper;
    return { label: fa, value: n };
  });
  const maxAge = Math.max(3, ...aging.map((a) => a.value));
  const agentPerf = agents.slice(0, 10).map((u) => {
    const T = tickets.filter((t) => t.agentId === u.id);
    const R = T.filter((t) => t.resolvedAt);
    const ok = R.filter((t) => new Date(t.resolvedAt!).getTime() <= new Date(t.slaDue).getTime()).length;
    return { u, total: T.length, resolved: R.length, sla: R.length ? Math.round((ok / R.length) * 100) : 100 };
  });

  return (
    <>
      <header className="admin-header"><div><h1>گزارش‌ها</h1><p>شاخص‌های اصلی عملکرد تیکتینگ</p></div></header>
      <div className="admin-stats">
        <Kpi label="میانگین پاسخ اول" value={`${formatNumFa(avgFirst)} دقیقه`} tone="sky" />
        <Kpi label="میانگین زمان حل" value={`${avgResolve} ساعت`} tone="mint" />
        <Kpi label="نرخ بازگشایی" value={`${formatNumFa(reopenRate)}٪`} tone="rose" />
        <Kpi label="نرخ ارجاع سطح بالاتر" value={`${formatNumFa(escRate)}٪`} tone="amber" />
      </div>
      <div className="tk-split">
        <div className="admin-card">
          <b>قدمت تیکت‌های باز</b>
          {aging.map((a) => (
            <div key={a.label} className="tk-hbar">
              <span>{a.label}</span>
              <span className="tk-bar"><i style={{ width: `${(a.value / maxAge) * 100}%` }} /></span>
              <em>{formatNumFa(a.value)}</em>
            </div>
          ))}
        </div>
        <div className="admin-card">
          <b>عملکرد کارشناسان</b>
          <table className="admin-table">
            <thead><tr><th>کارشناس</th><th>مجموع</th><th>حل‌شده</th><th>SLA</th></tr></thead>
            <tbody>
              {agentPerf.map((a) => (
                <tr key={a.u.id}>
                  <td>{a.u.name}</td>
                  <td>{formatNumFa(a.total)}</td>
                  <td>{formatNumFa(a.resolved)}</td>
                  <td><Tag tone={a.sla >= 90 ? 'ok' : a.sla >= 70 ? 'warn' : 'error'}>{formatNumFa(a.sla)}٪</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SettingsView({
  audit,
  agents,
  canAdmin,
}: {
  audit: CrmTicketingOverview['audit'];
  agents: CrmTicketingAgent[];
  canAdmin: boolean;
}) {
  const [tab, setTab] = useState<'sla' | 'queues' | 'taxonomy' | 'agents' | 'audit'>('sla');
  return (
    <>
      <header className="admin-header">
        <div>
          <h1>تنظیمات تیکتینگ</h1>
          <p>SLA · صف‌ها · دسته‌بندی · کارشناسان · لاگ{canAdmin ? '' : ' (فقط مشاهده)'}</p>
        </div>
      </header>
      <div className="tk-tabs">
        {([
          ['sla', 'سیاست‌های SLA'],
          ['queues', 'صف‌ها و تیم‌ها'],
          ['taxonomy', 'دسته‌بندی تیکت'],
          ['agents', 'کارشناسان'],
          ['audit', 'لاگ تغییرات'],
        ] as const).map(([k, fa]) => (
          <button key={k} type="button" className={`admin-btn admin-btn--sm${tab === k ? ' admin-btn--primary' : ''}`} onClick={() => setTab(k)}>{fa}</button>
        ))}
      </div>
      {tab === 'sla' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>اولویت</th><th>پاسخ اول (دقیقه)</th><th>حل (ساعت)</th></tr></thead>
          <tbody>
            {CRM_PRIORITIES.map((p) => (
              <tr key={p}>
                <td><Tag tone={prioTone(p)}>{p}</Tag></td>
                <td>{formatNumFa(CRM_SLA_POLICY[p][0])}</td>
                <td>{formatNumFa(CRM_SLA_POLICY[p][1])}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : null}
      {tab === 'queues' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>صف</th><th>تیم مسئول</th></tr></thead>
          <tbody>{CRM_TICKET_QUEUES.map((q) => <tr key={q.id}><td>{q.name}</td><td className="admin-muted">{q.team}</td></tr>)}</tbody>
        </table></div>
      ) : null}
      {tab === 'taxonomy' ? (
        <div className="admin-card">
          {Object.entries(CRM_TICKET_TAXONOMY).map(([type, cats]) => (
            <div key={type} className="tk-tax-row">
              <b>{type}</b>
              <span className="admin-muted">{Object.entries(cats).map(([c, subs]) => `${c} (${subs.join('، ')})`).join(' · ')}</span>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'agents' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>نام</th><th>تیم</th><th>نقش</th><th>شناسه</th></tr></thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.team}</td><td>{a.role}</td><td className="tk-mono">{a.id}</td></tr>
            ))}
            {!agents.length ? <tr><td colSpan={4} className="admin-muted">کارشناسی ثبت نشده — از منابع انسانی اضافه کنید</td></tr> : null}
          </tbody>
        </table></div>
      ) : null}
      {tab === 'audit' ? (
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>زمان</th><th>کاربر</th><th>موضوع</th><th>مرجع</th><th>اقدام</th></tr></thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="admin-muted">{faDate(a.at)}</td>
                <td>{a.userId}</td>
                <td>{a.entity}</td>
                <td className="tk-mono">{a.recordUuid}</td>
                <td>{a.action}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : null}
    </>
  );
}

function DetailView({
  detail,
  uName,
  canWrite,
  canAdmin,
  note,
  noteVis,
  setNote,
  setNoteVis,
  onBack,
  setModal,
  onSendNote,
  onCloseTicket,
  onMacro,
}: {
  detail: {
    ticket: CrmTicket;
    activities: CrmTicketActivity[];
    customer: CrmCustomer | null;
    orders: CrmOrder[];
    relatedTickets: CrmTicket[];
    followups: CrmFollowup[];
    referrals: CrmReferral[];
    orphanCustomer?: boolean;
  };
  uName: (id?: string | null) => string;
  canWrite: boolean;
  canAdmin: boolean;
  note: string;
  noteVis: 'public' | 'internal';
  setNote: (s: string) => void;
  setNoteVis: (s: 'public' | 'internal') => void;
  onBack: () => void;
  setModal: (m: ModalKind) => void;
  onSendNote: () => void;
  onCloseTicket: () => void;
  onMacro: (key: 'refund' | 'vip') => void;
}) {
  const t = detail.ticket;
  const cust = detail.customer;
  return (
    <>
      <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={onBack}>→ بازگشت به لیست</button>
      <header className="admin-header tk-detail-head">
        <div>
          <div className="tk-detail-meta">
            <span className="tk-mono">{t.publicId}</span>
            <Tag tone={statusTone(t.status)}>{t.status}</Tag>
            <Tag tone={prioTone(t.priority)}>{t.priority}</Tag>
            <Tag tone="muted">{t.severity}</Tag>
          </div>
          <h1>{t.title}</h1>
          <p>
            {t.type} · {t.category} · {t.subCategory} ·{' '}
            {CRM_TICKET_CHANNELS[t.channel as keyof typeof CRM_TICKET_CHANNELS] || t.channel} · مالک:{' '}
            {t.agentId ? uName(t.agentId) : 'تخصیص‌نیافته'}
          </p>
        </div>
        <div className="tk-detail-sla">
          <Tag tone={t.slaState === 'breached' ? 'error' : t.slaState === 'at_risk' ? 'warn' : 'ok'}>{t.slaLabel}</Tag>
          <div className="admin-muted">مهلت پاسخ اول: {faDate(t.firstResponseDueAt)}</div>
        </div>
      </header>

      {detail.orphanCustomer ? (
        <div className="tk-warn">هشدار رابطه: مشتری مرتبط یافت نشد (ارجاع یتیم). تیکت حفظ شده است.</div>
      ) : null}

      {canWrite ? (
        <div className="tk-actions">
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'assign', ticketId: t.id })}>تخصیص/تغییر مالک</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'transfer', ticketId: t.id })}>ارجاع بین‌تیمی</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'status', ticketId: t.id })}>تغییر وضعیت</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'priority', ticketId: t.id })}>تغییر اولویت</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'escalate', ticketId: t.id, module: 'finance' })}>ارجاع به مالی</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'escalate', ticketId: t.id, module: 'sales' })}>ارجاع به فروش</button>
          <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'followup', ticketId: t.id })}>ایجاد پیگیری</button>
          {!['حل‌شده', 'بسته‌شده'].includes(t.status) ? (
            <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setModal({ type: 'resolve', ticketId: t.id })}>حل تیکت</button>
          ) : null}
          {t.status === 'حل‌شده' ? (
            <button type="button" className="admin-btn admin-btn--sm" onClick={onCloseTicket}>بستن تیکت</button>
          ) : null}
          {['حل‌شده', 'بسته‌شده'].includes(t.status) ? (
            <button type="button" className="admin-btn admin-btn--sm" onClick={() => setModal({ type: 'reopen', ticketId: t.id })}>بازگشایی</button>
          ) : null}
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => onMacro('refund')}>ماکرو: بازگشت وجه</button>
          <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => onMacro('vip')}>ماکرو: VIP</button>
        </div>
      ) : null}

      <div className="tk-split">
        <div>
          <div className="admin-card">
            <b>شرح درخواست</b>
            <p className="tk-body">{t.description || '—'}</p>
          </div>
          <div className="admin-card">
            <b>تایم‌لاین گفتگو</b>
            <div className="tk-timeline">
              {detail.activities.map((ev) => (
                <div
                  key={ev.id}
                  className={`tk-msg tk-msg--${ev.visibility === 'public' ? 'public' : ev.kind === 'internal_note' || ev.visibility === 'internal' ? 'internal' : 'system'}`}
                >
                  <div className="tk-msg-h">
                    <span>
                      {ev.userName || uName(ev.userId) || 'سیستم'} ·{' '}
                      {ev.kind === 'public_reply'
                        ? 'پاسخ عمومی'
                        : ev.kind === 'internal_note'
                          ? 'یادداشت داخلی'
                          : eventLabel(ev.kind)}
                    </span>
                    <span>{faDate(ev.at)}</span>
                  </div>
                  <div>{ev.text}</div>
                </div>
              ))}
              {!detail.activities.length ? <p className="admin-muted">رویدادی نیست</p> : null}
            </div>
            {canWrite ? (
              <div className="tk-composer">
                <div className="tk-tabs">
                  <button type="button" className={`admin-btn admin-btn--sm${noteVis === 'public' ? ' admin-btn--primary' : ''}`} onClick={() => setNoteVis('public')}>پاسخ عمومی</button>
                  <button type="button" className={`admin-btn admin-btn--sm${noteVis === 'internal' ? ' admin-btn--primary' : ''}`} onClick={() => setNoteVis('internal')}>یادداشت داخلی</button>
                </div>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteVis === 'public' ? 'پاسخ برای مشتری…' : 'یادداشت داخلی…'} />
                <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" disabled={!note.trim()} onClick={onSendNote}>
                  {noteVis === 'public' ? 'ارسال پاسخ' : 'ثبت یادداشت'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <div className="admin-card">
            <b>مشتری ۳۶۰</b>
            {cust ? (
              <div className="tk-body">
                <div>
                  <strong>{cust.first} {cust.last}</strong>{' '}
                  <Tag tone="muted">{cust.level}</Tag>
                </div>
                <div className="admin-muted">{cust.mobile} · {cust.email || '—'}</div>
                <Link to={`/admin/crm/customers/${cust.id}`}>مشاهده پروفایل</Link>
                {cust.platformUserId ? (
                  <div><Link to={`/admin/users?q=${cust.platformUserId}`}>کاربر پلتفرم #{cust.platformUserId}</Link></div>
                ) : null}
                {cust.salesCustomerId ? (
                  <div><Link to={`/admin/sales/customers/${cust.salesCustomerId}`}>مشتری فروش</Link></div>
                ) : null}
                <hr />
                <b>فروش</b>
                <div className="admin-muted">محصول: {cust.product || '—'} · فروشنده: {cust.salesOwner || '—'} · سفارش‌ها: {formatNumFa(detail.orders.length)}</div>
                {canAdmin ? (
                  <>
                    <hr />
                    <b>مالی</b>
                    <div className="admin-muted">
                      {Object.entries(cust.financeSnapshot || {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || '—'}
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="admin-muted">مشتری یافت نشد</p>
            )}
          </div>
          <div className="admin-card">
            <b>ویژگی‌های تیکت</b>
            <div className="admin-muted tk-body">
              صف: {crmQueueOf(t.queueId)?.name || t.queueId}<br />
              تیم: {t.teamId || '—'}<br />
              برچسب‌ها: {(t.tags || []).join('، ') || '—'}<br />
              بازگشایی: {formatNumFa(t.reopenedCount)} بار
              {t.pendingReason ? <><br />دلیل تعلیق: {t.pendingReason}</> : null}
            </div>
          </div>
          {detail.referrals.length ? (
            <div className="admin-card">
              <b>ارجاعات این تیکت</b>
              {detail.referrals.map((e) => (
                <div key={e.id} className="tk-mini">
                  <Tag tone={e.status === 'تایید' ? 'ok' : 'warn'}>{e.targetTeam} · {e.status}</Tag>
                  <div className="admin-muted">{e.requestedAction}</div>
                </div>
              ))}
            </div>
          ) : null}
          {detail.relatedTickets.length ? (
            <div className="admin-card">
              <b>سایر تیکت‌های این مشتری</b>
              {detail.relatedTickets.map((r) => (
                <div key={r.id} className="tk-mini">
                  <span className="tk-mono">{r.publicId}</span> — {r.title}{' '}
                  <Tag tone={statusTone(r.status)}>{r.status}</Tag>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function TicketingModals({
  modal,
  setModal,
  tickets,
  agents,
  referrals,
  canWrite,
  onDone,
  onCreated,
}: {
  modal: ModalKind;
  setModal: (m: ModalKind) => void;
  tickets: CrmTicket[];
  agents: CrmTicketingAgent[];
  referrals: CrmReferral[];
  canWrite: boolean;
  onDone: (msg?: string) => void;
  onCreated: (id: number) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setF({});
    if (modal?.type === 'newticket') {
      void adminFetch<{ customers: CrmCustomer[] }>('/api/admin/crm/customers?limit=80').then((d) =>
        setCustomers(d.customers || [])
      );
    }
  }, [modal]);

  if (!modal || !canWrite) return null;
  const t = 'ticketId' in modal ? tickets.find((x) => x.id === modal.ticketId) : null;
  const titleMap: Record<string, string> = {
    newticket: 'ایجاد تیکت جدید',
    assign: 'تخصیص / تغییر مالک',
    transfer: 'ارجاع بین‌تیمی (صف)',
    status: 'تغییر وضعیت',
    priority: 'تغییر اولویت',
    escalate: modal.type === 'escalate' && modal.module === 'finance' ? 'ارجاع به واحد مالی' : 'ارجاع به تیم فروش',
    respond_esc: 'ثبت پاسخ ارجاع',
    followup: 'ایجاد پیگیری',
    resolve: 'حل تیکت',
    reopen: 'بازگشایی تیکت',
  };

  const close = () => setModal(null);

  return (
    <AdminModal open title={titleMap[modal.type]} onClose={close} size="lg" busy={busy}>
      {t ? <p className="admin-muted">{t.publicId} — {t.title}</p> : null}

      {modal.type === 'newticket' ? (
        <NewTicketForm
          customers={customers}
          busy={busy}
          onSubmit={async (body) => {
            setBusy(true);
            try {
              const res = await adminFetch<{ ticket: CrmTicket }>('/api/admin/crm/tickets', {
                method: 'POST',
                body: JSON.stringify(body),
              });
              onCreated(res.ticket.id);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {modal.type === 'assign' && t ? (
        <>
          <label className="tk-field">کارشناس
            <select value={f.owner || ''} onChange={(e) => setF({ ...f, owner: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.team}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.owner || busy}
            onClick={() => {
              const a = agents.find((x) => x.id === f.owner);
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  agentId: f.owner,
                  agentName: a?.name,
                  teamId: a?.team,
                  status: t.status === 'جدید' ? 'تخصیص‌یافته' : t.status,
                }),
              }).then(() => onDone('تیکت تخصیص یافت')).finally(() => setBusy(false));
            }}
          >تخصیص</button>
        </>
      ) : null}

      {modal.type === 'transfer' && t ? (
        <>
          <label className="tk-field">صف مقصد
            <select value={f.queue || ''} onChange={(e) => setF({ ...f, queue: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {CRM_TICKET_QUEUES.map((q) => <option key={q.id} value={q.id}>{q.name} — {q.team}</option>)}
            </select>
          </label>
          <p className="admin-muted">ارجاع بین‌تیمی تاریخچه و شناسه تیکت را حفظ می‌کند.</p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.queue || busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ queueId: f.queue, status: 'در حال بررسی' }),
              }).then(() => onDone('تیکت ارجاع شد')).finally(() => setBusy(false));
            }}
          >ارجاع</button>
        </>
      ) : null}

      {modal.type === 'status' && t ? (
        <>
          <label className="tk-field">وضعیت جدید
            <select value={f.status || ''} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {CRM_TICKET_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          {['در انتظار مشتری', 'در انتظار داخلی'].includes(f.status) ? (
            <label className="tk-field">دلیل تعلیق
              <select value={f.reason || ''} onChange={(e) => setF({ ...f, reason: e.target.value })}>
                <option value="">انتخاب کنید</option>
                {CRM_PENDING_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.status || (['در انتظار مشتری', 'در انتظار داخلی'].includes(f.status) && !f.reason) || busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: f.status, pendingReason: f.reason || null }),
              }).then(() => onDone('وضعیت به‌روزرسانی شد')).finally(() => setBusy(false));
            }}
          >ثبت وضعیت</button>
        </>
      ) : null}

      {modal.type === 'priority' && t ? (
        <>
          <label className="tk-field">اولویت جدید
            <select value={f.priority || t.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              {CRM_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <p className="admin-muted">تغییر اولویت مهلت SLA را بازمحاسبه می‌کند.</p>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ priority: f.priority || t.priority }),
              }).then(() => onDone('اولویت به‌روزرسانی شد')).finally(() => setBusy(false));
            }}
          >ثبت اولویت</button>
        </>
      ) : null}

      {modal.type === 'escalate' && t ? (
        <>
          <label className="tk-field">دلیل<input value={f.reason || ''} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
          <label className="tk-field">اقدام درخواستی<textarea rows={2} value={f.action || ''} onChange={(e) => setF({ ...f, action: e.target.value })} /></label>
          {modal.module === 'finance' ? (
            <label className="tk-field">مبلغ (ریال، اختیاری)<input type="number" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          ) : null}
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.action?.trim() || busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}/escalate`, {
                method: 'POST',
                body: JSON.stringify({
                  type: modal.module,
                  reason: f.reason,
                  requestedAction: f.action,
                  amount: f.amount ? Number(f.amount) : 0,
                  priority: t.priority,
                }),
              }).then(() => onDone('ارجاع ارسال شد')).finally(() => setBusy(false));
            }}
          >ارسال ارجاع</button>
        </>
      ) : null}

      {modal.type === 'respond_esc' ? (
        <>
          <label className="tk-field">پاسخ<textarea rows={3} value={f.response || ''} onChange={(e) => setF({ ...f, response: e.target.value })} /></label>
          <label className="tk-field">وضعیت
            <select value={f.status || 'تایید'} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option>تایید</option>
              <option>رد شد</option>
              <option>پاسخ داده‌شده</option>
            </select>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.response?.trim() || busy}
            onClick={() => {
              const esc = referrals.find((r) => r.id === modal.escId);
              setBusy(true);
              void adminFetch(`/api/admin/crm/referrals/${modal.escId}/respond`, {
                method: 'POST',
                body: JSON.stringify({
                  approve: f.status !== 'رد شد',
                  response: f.response,
                  status: f.status || 'تایید',
                }),
              }).then(() => onDone(`پاسخ ثبت شد${esc?.ticketId ? '' : ''}`)).finally(() => setBusy(false));
            }}
          >ثبت پاسخ</button>
        </>
      ) : null}

      {modal.type === 'followup' && t ? (
        <>
          <label className="tk-field">نوع اقدام
            <select value={f.type || 'تماس'} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option>تماس</option><option>پیامک</option><option>ایمیل</option><option>داخلی</option>
            </select>
          </label>
          <label className="tk-field">ساعت دیگر<input type="number" value={f.inH || '24'} onChange={(e) => setF({ ...f, inH: e.target.value })} /></label>
          <label className="tk-field">شرح<textarea rows={2} value={f.desc || ''} onChange={(e) => setF({ ...f, desc: e.target.value })} /></label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.desc?.trim() || busy}
            onClick={() => {
              const due = new Date(Date.now() + Number(f.inH || 24) * 3600_000).toISOString();
              setBusy(true);
              void adminFetch('/api/admin/crm/followups', {
                method: 'POST',
                body: JSON.stringify({
                  customerId: t.customerId,
                  ticketId: t.id,
                  kind: f.type || 'تماس',
                  dueAt: due,
                  priority: t.priority,
                  description: f.desc,
                }),
              }).then(() => onDone('پیگیری زمان‌بندی شد')).finally(() => setBusy(false));
            }}
          >ایجاد پیگیری</button>
        </>
      ) : null}

      {modal.type === 'resolve' && t ? (
        <>
          <label className="tk-field">کد راه‌حل
            <select value={f.code || ''} onChange={(e) => setF({ ...f, code: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {CRM_RESOLUTION_CODES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="tk-field">علت ریشه‌ای
            <select value={f.rootCause || ''} onChange={(e) => setF({ ...f, rootCause: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {CRM_ROOT_CAUSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="tk-field">خلاصه راه‌حل<textarea rows={3} value={f.summary || ''} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.code || !f.rootCause || !f.summary?.trim() || busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: 'حل‌شده',
                  resolutionCode: f.code,
                  rootCause: f.rootCause,
                  resolutionNote: f.summary,
                  activityText: `تیکت حل شد — کد: ${f.code}`,
                  activityKind: 'resolved',
                  activityVisibility: 'public',
                }),
              }).then(() => onDone('تیکت حل شد')).finally(() => setBusy(false));
            }}
          >ثبت به‌عنوان حل‌شده</button>
        </>
      ) : null}

      {modal.type === 'reopen' && t ? (
        <>
          <label className="tk-field">دلیل بازگشایی
            <select value={f.reason || ''} onChange={(e) => setF({ ...f, reason: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {CRM_REOPEN_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={!f.reason || busy}
            onClick={() => {
              setBusy(true);
              void adminFetch(`/api/admin/crm/tickets/${t.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status: 'بازگشایی‌شده',
                  activityText: `تیکت بازگشایی شد — دلیل: ${f.reason}`,
                  activityKind: 'reopened',
                }),
              }).then(() => onDone('تیکت بازگشایی شد')).finally(() => setBusy(false));
            }}
          >بازگشایی تیکت</button>
        </>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={close} disabled={busy}>انصراف</button>
      </div>
    </AdminModal>
  );
}

function NewTicketForm({
  customers,
  busy,
  onSubmit,
}: {
  customers: CrmCustomer[];
  busy: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [f, setF] = useState({
    customerId: 0,
    subject: '',
    description: '',
    ticketType: CRM_TICKET_TYPES[0] as string,
    category: '',
    subcategory: '',
    priority: 'متوسط',
    severity: 'متوسط S3',
    channel: 'manual',
    queueId: 'q_support',
  });
  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return customers.filter(
      (c) => c.mobile.includes(q) || `${c.first} ${c.last}`.includes(q)
    ).slice(0, 8);
  }, [q, customers]);
  const cats = crmTicketCatsOf(f.ticketType);
  const subs = f.category ? crmTicketSubsOf(f.ticketType, f.category) : [];

  return (
    <>
      <label className="tk-field">جستجوی مشتری
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="موبایل یا نام…" />
      </label>
      {matches.length && !f.customerId ? (
        <div className="tk-matches">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tk-opt"
              onClick={() => {
                setF({ ...f, customerId: c.id });
                setQ(`${c.first} ${c.last}`);
              }}
            >
              {c.first} {c.last} — {c.mobile}
            </button>
          ))}
        </div>
      ) : null}
      {f.customerId ? <Tag tone="ok">مشتری انتخاب شد</Tag> : null}
      <label className="tk-field">موضوع<input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></label>
      <label className="tk-field">شرح<textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="tk-f3">
        <label className="tk-field">نوع
          <select value={f.ticketType} onChange={(e) => setF({ ...f, ticketType: e.target.value, category: '', subcategory: '' })}>
            {CRM_TICKET_TYPES.map((tp) => <option key={tp}>{tp}</option>)}
          </select>
        </label>
        <label className="tk-field">دسته
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, subcategory: '' })}>
            <option value="">انتخاب</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="tk-field">زیردسته
          <select value={f.subcategory} onChange={(e) => setF({ ...f, subcategory: e.target.value })}>
            <option value="">انتخاب</option>
            {subs.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="tk-f3">
        <label className="tk-field">اولویت
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
            {CRM_PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="tk-field">شدت
          <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>
            {CRM_TICKET_SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="tk-field">کانال
          <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
            {Object.entries(CRM_TICKET_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <label className="tk-field">صف اولیه
        <select value={f.queueId} onChange={(e) => setF({ ...f, queueId: e.target.value })}>
          {CRM_TICKET_QUEUES.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>
      </label>
      <button
        type="button"
        className="admin-btn admin-btn--primary"
        disabled={!f.customerId || !f.subject.trim() || !f.category || busy}
        onClick={() =>
          void onSubmit({
            customerId: f.customerId,
            title: f.subject,
            description: f.description,
            type: f.ticketType,
            category: f.category,
            subCategory: f.subcategory,
            priority: f.priority,
            severity: f.severity,
            channel: f.channel,
            queueId: f.queueId,
          })
        }
      >ایجاد تیکت</button>
    </>
  );
}

export default AdminCrmTicketingPage;
