import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CrmAgentReportRow, CrmChartPoint, CrmKpiRing, CrmReportSummary } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import {
  JalaliDateRange,
  currentJalaliParts,
  formatAdminFaDateTime,
  formatJalaliSlash,
  jalaliDaysAgo,
  jalaliPartsToGregorianIso,
  type JalaliDateValue,
} from '../../JalaliDateSelect';

type TabKey = 'team' | 'person' | 'quality' | 'changelog';
type AuditRow = Record<string, unknown>;

const STANDING_COLOR: Record<string, string> = {
  'در مسیر درست': '#15cca0',
  'نیازمند تلاش بیشتر': '#fd961e',
  ضعیف: '#c62828',
};

function GaugeSemi({ pct, standing, label }: { pct: number; standing: string; label: string }) {
  const color = STANDING_COLOR[standing] || '#c62828';
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 70;
  const c = Math.PI * r;
  const filled = (clamped / 100) * c;
  return (
    <div className="crm-report-gauge" aria-label={`${label} ${clamped} درصد`}>
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path d="M 20 95 A 70 70 0 0 1 160 95" fill="none" stroke="var(--admin-border)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 95 A 70 70 0 0 1 160 95"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
        />
        <text x="90" y="78" textAnchor="middle" fill={color} style={{ fontSize: 22, fontWeight: 800 }}>
          {formatNumFa(clamped)}٪
        </text>
        <text x="90" y="98" textAnchor="middle" fill="var(--admin-muted)" style={{ fontSize: 11 }}>
          {label}
        </text>
      </svg>
    </div>
  );
}

function MiniRing({ kpi }: { kpi: CrmKpiRing }) {
  const color = STANDING_COLOR[kpi.standing] || '#c62828';
  const r = 30;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, kpi.pct)) / 100) * circ;
  return (
    <div className="crm-report-mini-ring">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--admin-border)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="38" textAnchor="middle" fill="var(--admin-ink)" style={{ fontSize: 13, fontWeight: 800 }}>
          {formatNumFa(kpi.value)}
        </text>
        <text x="40" y="52" textAnchor="middle" fill="var(--admin-muted)" style={{ fontSize: 9 }}>
          {kpi.unit}
        </text>
      </svg>
      <strong>{kpi.label}</strong>
    </div>
  );
}

function AgentCard({ agent }: { agent: CrmAgentReportRow }) {
  const color = STANDING_COLOR[agent.standing] || '#c62828';
  return (
    <article className="crm-report-agent-card" style={{ borderInlineStartColor: color }}>
      <div className="crm-report-agent-card-top">
        <strong>{agent.agentName}</strong>
        <span style={{ color }}>{formatNumFa(agent.achievement)}٪</span>
      </div>
      <div className="crm-report-agent-bar">
        <i style={{ width: `${Math.min(100, agent.achievement)}%`, background: color }} />
      </div>
      <p className="admin-muted">
        {formatNumFa(agent.inbound)} ورودی · {formatNumFa(agent.minutes)} دقیقه
      </p>
      <span className="crm-report-standing" style={{ background: `${color}18`, color }}>
        {agent.standing}
      </span>
    </article>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="crm-chart-tooltip">
      {label ? <div className="crm-chart-tooltip-label">{label}</div> : null}
      <strong>{formatNumFa(Number(payload[0].value || 0))}</strong>
    </div>
  );
}

function exportAgentsCsv(agents: CrmAgentReportRow[]) {
  const headers = [
    'کارشناس', 'تیم', 'ورودی', 'خروجی', 'دقیقه', 'AHT', 'FCR', 'SLA',
    'حل‌شده', 'باز', 'کیفیت', 'رضایت', 'تحقق', 'وضعیت',
  ];
  const lines = agents.map((a) =>
    [
      a.agentName, a.teamLabel, a.inbound, a.outbound, a.minutes, a.aht, a.fcrPct, a.slaPct,
      a.ticketsResolved, a.ticketsOpen, a.qaAvg ?? '', a.csatAvg ?? '', a.achievement, a.standing,
    ].join(',')
  );
  const blob = new Blob(['\uFEFF' + [headers.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = 'crm-team-report.csv';
  el.click();
  URL.revokeObjectURL(url);
}

export function AdminCrmReportsPage() {
  const [tab, setTab] = useState<TabKey>('team');
  const [from, setFrom] = useState<JalaliDateValue>(() => jalaliDaysAgo(6));
  const [to, setTo] = useState<JalaliDateValue>(() => currentJalaliParts());
  const [agentId, setAgentId] = useState('');
  const [summary, setSummary] = useState<CrmReportSummary | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const fromIso = jalaliPartsToGregorianIso(from) || '';
    const toIso = jalaliPartsToGregorianIso(to) || '';
    const qs = new URLSearchParams({ from: fromIso, to: toIso });
    if (agentId) qs.set('agentId', agentId);
    void adminFetch<{ summary: CrmReportSummary; audit?: AuditRow[] }>(`/api/admin/crm/reports?${qs}`)
      .then((d) => {
        setSummary(d.summary);
        setAudit(d.audit || []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'))
      .finally(() => setLoading(false));
  }, [from, to, agentId]);

  useEffect(() => {
    load();
  }, [load]);

  const reasonPie = useMemo(
    () => (summary?.callReasons || []).map((r: CrmChartPoint) => ({ ...r, name: r.label })),
    [summary],
  );
  const ageBars = useMemo(() => summary?.ticketAge || [], [summary]);
  const agents = summary?.agents || [];
  const visibleAgents = agentId ? agents.filter((a) => a.agentId === agentId) : agents;

  if (error) {
    return (
      <div className="admin-page">
        <p className="admin-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-page--wide crm-report">
      <header className="admin-header">
        <div>
          <h1>گزارشات باشگاه مشتریان</h1>
          <p>گزارش تیم · کارت عملکرد · کیفیت · تاریخچه تغییرات · خط محصول Pet Date</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={() => summary && exportAgentsCsv(summary.agents)}
          disabled={!summary?.agents?.length}
        >
          خروجی CSV
        </button>
      </header>

      <nav className="crm-report-tabs" aria-label="نوع گزارش">
        {(
          [
            ['team', 'گزارش تیم'],
            ['person', 'کارت گزارش فردی'],
            ['quality', 'کیفیت'],
            ['changelog', 'تاریخچه تغییرات'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'is-active' : undefined} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="crm-report-filters">
        <JalaliDateRange
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          fromLabel="از تاریخ"
          toLabel="تا تاریخ"
        />
        <div className="crm-report-quick">
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={() => {
              setFrom(jalaliDaysAgo(6));
              setTo(currentJalaliParts());
            }}
          >
            ۷ روز
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={() => {
              setFrom(jalaliDaysAgo(29));
              setTo(currentJalaliParts());
            }}
          >
            ۳۰ روز
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={() => {
              setFrom(jalaliDaysAgo(6));
              setTo(currentJalaliParts());
              setAgentId('');
            }}
          >
            پاک‌کردن
          </button>
        </div>
        <label>
          کارشناسان
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">همه کارشناسان</option>
            {agents.map((a) => (
              <option key={a.agentId} value={a.agentId}>{a.agentName}</option>
            ))}
          </select>
        </label>
      </div>

      {loading || !summary ? (
        <p>در حال بارگذاری…</p>
      ) : tab === 'changelog' ? (
        <section className="admin-card">
          <div className="admin-card-head"><h2>تاریخچه تغییرات</h2></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>زمان</th><th>کاربر</th><th>دسته</th><th>اقدام</th><th>رکورد</th></tr>
              </thead>
              <tbody>
                {audit.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.at ? formatAdminFaDateTime(String(row.at)) : '—'}</td>
                    <td>{String(row.user_id || '—')}</td>
                    <td>{String(row.category || '—')}</td>
                    <td>{String(row.action || '—')}</td>
                    <td>{String(row.record_uuid || row.entity || '—')}</td>
                  </tr>
                ))}
                {!audit.length ? <tr><td colSpan={5}>رویدادی ثبت نشده</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : tab === 'quality' ? (
        <div className="crm-report-quality">
          <section className="admin-card">
            <div className="admin-card-head"><h2>شاخص‌های کیفیت</h2></div>
            <div className="crm-report-kpi-rings">
              {summary.kpiRings.map((k) => <MiniRing key={k.key} kpi={k} />)}
              <div className="crm-report-stat-tile">
                <span className="admin-muted">میانگین QA</span>
                <strong>{summary.qaAvg != null ? formatNumFa(summary.qaAvg) : '—'}</strong>
              </div>
              <div className="crm-report-stat-tile">
                <span className="admin-muted">شکایات بازه</span>
                <strong>{formatNumFa(summary.totals.complaints)}</strong>
              </div>
            </div>
          </section>
          <section className="admin-card">
            <div className="admin-card-head"><h2>کیفیت به تفکیک کارشناس</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>کارشناس</th><th>QA</th><th>رضایت</th><th>FCR</th><th>SLA</th><th>وضعیت</th></tr>
                </thead>
                <tbody>
                  {visibleAgents.map((a) => {
                    const color = STANDING_COLOR[a.standing] || '#c62828';
                    return (
                      <tr key={a.agentId}>
                        <td>{a.agentName}</td>
                        <td>{a.qaAvg != null ? formatNumFa(a.qaAvg) : '—'}</td>
                        <td>{a.csatAvg != null ? formatNumFa(a.csatAvg) : '—'}</td>
                        <td>{formatNumFa(a.fcrPct)}٪</td>
                        <td>{formatNumFa(a.slaPct)}٪</td>
                        <td><span className="crm-report-standing" style={{ background: `${color}18`, color }}>{a.standing}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <>
          <section className="crm-report-hero">
            <div className="admin-card crm-report-overall">
              <GaugeSemi pct={summary.overallAchievement} standing={summary.overallStanding} label="تحقق کلی شاخص‌های تیم" />
              <div className="crm-report-legend">
                <div><strong style={{ color: '#0f9a78' }}>در مسیر درست</strong><span>۹۰٪ و بالاتر</span></div>
                <div><strong style={{ color: '#c77810' }}>نیازمند تلاش بیشتر</strong><span>۷۰٪ تا ۹۰٪</span></div>
                <div><strong style={{ color: '#c62828' }}>ضعیف</strong><span>زیر ۷۰٪</span></div>
              </div>
            </div>
            <div className="crm-report-agent-strip">
              {visibleAgents.slice(0, 6).map((a) => <AgentCard key={a.agentId} agent={a} />)}
              {!visibleAgents.length ? <p className="admin-muted">کارشناسی در این بازه نیست</p> : null}
            </div>
          </section>

          <div className="crm-report-charts">
            <section className="admin-card">
              <div className="admin-card-head"><h2>دلیل تماس‌ها</h2></div>
              <div className="crm-report-chart-box">
                {reasonPie.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={reasonPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {reasonPie.map((r) => <Cell key={r.key} fill={r.color || '#15cca0'} />)}
                      </Pie>
                      <Tooltip content={<ChartTip />} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="var(--admin-ink)" style={{ fontSize: 13, fontWeight: 700 }}>
                        {formatNumFa(summary.totals.interactions)} تعامل
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="admin-muted">دلیلی ثبت نشده</p>
                )}
                <ul className="crm-report-reason-legend">
                  {reasonPie.map((r) => (
                    <li key={r.key}><i style={{ background: r.color }} />{r.label}<span>{formatNumFa(r.value)}</span></li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="admin-card">
              <div className="admin-card-head"><h2>سن صف تیکت‌های باز</h2></div>
              <div className="crm-report-chart-box" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={36}>
                      {ageBars.map((b) => <Cell key={b.key} fill={b.color || '#3b82f6'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="admin-card">
              <div className="admin-card-head"><h2>شاخص‌های کلیدی</h2></div>
              <div className="crm-report-kpi-rings">
                {summary.kpiRings.map((k) => <MiniRing key={k.key} kpi={k} />)}
              </div>
              <div className="crm-report-counters">
                <div><span>تعامل</span><b>{formatNumFa(summary.totals.interactions)}</b></div>
                <div><span>دقیقه</span><b>{formatNumFa(summary.totals.minutes)}</b></div>
                <div><span>تیکت</span><b>{formatNumFa(summary.totals.tickets)}</b></div>
                <div><span>شکایت</span><b>{formatNumFa(summary.totals.complaints)}</b></div>
              </div>
            </section>
          </div>

          <section className="admin-card" style={{ marginTop: 14 }}>
            <div className="admin-card-head">
              <h2>{tab === 'person' ? 'کارت گزارش فردی' : 'جزئیات عملکرد کارشناسان'}</h2>
              <span className="admin-muted">
                {formatJalaliSlash(from) || '…'} → {formatJalaliSlash(to) || '…'}
              </span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>کارشناس</th><th>ورودی</th><th>خروجی</th><th>دقیقه</th><th>AHT</th><th>FCR</th><th>SLA</th>
                    <th>حل‌شده</th><th>باز</th><th>کیفیت</th><th>رضایت</th><th>تحقق شاخص</th><th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAgents.map((a) => {
                    const color = STANDING_COLOR[a.standing] || '#c62828';
                    return (
                      <tr key={a.agentId}>
                        <td><strong>{a.agentName}</strong><div className="admin-muted">{a.teamLabel}</div></td>
                        <td>{formatNumFa(a.inbound)}</td>
                        <td>{formatNumFa(a.outbound)}</td>
                        <td>{formatNumFa(a.minutes)}</td>
                        <td>{formatNumFa(a.aht)}</td>
                        <td>{formatNumFa(a.fcrPct)}٪</td>
                        <td>{formatNumFa(a.slaPct)}٪</td>
                        <td>{formatNumFa(a.ticketsResolved)}</td>
                        <td>{formatNumFa(a.ticketsOpen)}</td>
                        <td>{a.qaAvg != null ? formatNumFa(a.qaAvg) : '—'}</td>
                        <td>{a.csatAvg != null ? formatNumFa(a.csatAvg) : '—'}</td>
                        <td>
                          <div className="crm-report-mini-progress">
                            <span>{formatNumFa(a.achievement)}٪</span>
                            <i><b style={{ width: `${Math.min(100, a.achievement)}%`, background: color }} /></i>
                          </div>
                        </td>
                        <td><span className="crm-report-standing" style={{ background: `${color}18`, color }}>{a.standing}</span></td>
                      </tr>
                    );
                  })}
                  {!visibleAgents.length ? <tr><td colSpan={13}>داده‌ای نیست</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
