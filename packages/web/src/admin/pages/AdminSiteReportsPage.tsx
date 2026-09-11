import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, ExternalLink, Globe2, MonitorSmartphone, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import {
  ADMIN_RTL_HBARS_CLASS, adminRtlHBarsCategoryAxis, adminRtlHBarsMargin, adminRtlHBarsRadius, adminRtlHBarsValueAxis,
} from '../rechartsRtlHBars';
import {
  MOTION_PALETTE,
  MotionBarGradientDefs,
  MotionChartTooltip,
  useRechartsMotion,
} from '../motionCharts';

type Bucket = { label: string; value: number };
type SessionRow = {
  sessionId: string; startedAt: string; lastSeenAt: string; pageviews: number;
  landingPath: string; exitPath: string; referrerHost: string; device: string; country: string;
};
type Report = {
  generatedAt: string; periodDays: number;
  overview: {
    pageviews: number; sessions: number; uniqueSessions: number; avgPagesPerSession: number;
    bounceRatePct: number; desktopPct: number; mobilePct: number; tabletPct: number;
  };
  trafficDaily: Bucket[]; sessionsDaily: Bucket[]; popularPages: Bucket[]; referrers: Bucket[];
  devices: Bucket[]; countries: Bucket[]; languages: Bucket[]; utmSources: Bucket[];
  recentSessions: SessionRow[];
  clarity: { configured: boolean; projectId: string | null; dashboardUrl: string | null; note: string };
  gtm: { configured: boolean; containerId: string | null; dashboardUrl: string | null; note: string };
  requestedAgentId: string | null;
};

const PERIODS = [
  { days: 7, label: '۷ روز' }, { days: 14, label: '۱۴ روز' },
  { days: 30, label: '۳۰ روز' }, { days: 90, label: '۹۰ روز' },
];
const PIE_COLORS = ['#5c4d91', '#15cca0', '#f59e0b', '#0ea5e9', '#ec4899', '#64748b'];

function deviceFa(d: string): string {
  if (d === 'desktop' || d === 'دسکتاپ') return 'دسکتاپ';
  if (d === 'mobile' || d === 'موبایل') return 'موبایل';
  if (d === 'tablet' || d === 'تبلت') return 'تبلت';
  return d;
}

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  return <MotionChartTooltip active={active} payload={payload} label={label} />;
}

export function AdminSiteReportsPage() {
  const motion = useRechartsMotion();
  const [period, setPeriod] = useState(14);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await adminFetch<Report>(`/api/admin/site-analytics/reports?days=${period}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری گزارشات سایت ناموفق بود');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const trafficChart = useMemo(
    () => (data?.trafficDaily || []).map((r) => ({ ...r, labelShort: r.label.slice(5) })),
    [data],
  );
  const pageBars = data?.popularPages || [];
  const refBars = data?.referrers || [];

  return (
    <div className="admin-page site-reports-page">
      <header className="admin-header">
        <div>
          <h1>گزارشات سایت</h1>
          <p>آنالیتیکس رفتار کاربران روی petdate.ir — بازدید، ارجاع، دستگاه و نشست‌ها</p>
        </div>
        <div className="hr-reports-filters" role="group" aria-label="بازه گزارش">
          {PERIODS.map((p) => (
            <button key={p.days} type="button"
              className={`admin-btn${period === p.days ? ' admin-btn--primary' : ''}`}
              onClick={() => setPeriod(p.days)}>{p.label}</button>
          ))}
          <button type="button" className="admin-btn" onClick={() => void load()}>
            <RefreshCw size={16} /> بروزرسانی
          </button>
        </div>
      </header>

      {error ? <div className="admin-banner is-bad">{error}</div> : null}
      {loading && !data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      {data ? (
        <>
          <section className="admin-stats admin-stats--dense" aria-label="شاخص‌های کلی">
            <article className="admin-stat admin-stat--violet">
              <div className="admin-stat-icon"><Activity size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.overview.pageviews)}</div>
              <div className="admin-stat-label">بازدید صفحه</div>
            </article>
            <article className="admin-stat admin-stat--mint">
              <div className="admin-stat-icon"><Globe2 size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.overview.uniqueSessions)}</div>
              <div className="admin-stat-label">نشست یکتا</div>
            </article>
            <article className="admin-stat admin-stat--orange">
              <div className="admin-stat-icon"><MonitorSmartphone size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.overview.avgPagesPerSession)}</div>
              <div className="admin-stat-label">صفحه / نشست</div>
            </article>
            <article className="admin-stat admin-stat--sky">
              <div className="admin-stat-icon"><Smartphone size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.overview.bounceRatePct)}٪</div>
              <div className="admin-stat-label">نرخ پرش</div>
            </article>
            <article className="admin-stat admin-stat--slate">
              <div className="admin-stat-icon"><Tablet size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.overview.mobilePct)}٪ / {formatNumFa(data.overview.desktopPct)}٪</div>
              <div className="admin-stat-label">موبایل / دسکتاپ</div>
            </article>
          </section>

          <section className="admin-card site-reports-clarity" aria-label="وضعیت Clarity">
            <div className="admin-card-head">
              <h2>Microsoft Clarity</h2>
              <span className={`admin-status ${data.clarity.configured ? 'admin-status--accepted' : 'admin-status--pending'}`}>
                {data.clarity.configured ? 'فعال' : 'پیکربندی نشده'}
              </span>
            </div>
            <p className="admin-muted">{data.clarity.note}</p>
            {data.clarity.dashboardUrl ? (
              <a className="admin-btn admin-btn--primary" href={data.clarity.dashboardUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> باز کردن داشبورد Clarity
              </a>
            ) : null}
            {data.requestedAgentId ? (
              <p className="admin-muted" style={{ marginTop: 10, fontSize: '0.78rem' }}>
                شناسهٔ ارجاع‌شده توسط کاربر (ایجنت Cursor، غیرقابل دسترس):{' '}
                <code dir="ltr">{data.requestedAgentId}</code>
              </p>
            ) : null}
            <p className="admin-muted" style={{ fontSize: '0.75rem' }}>
              آخرین بروزرسانی: {formatAdminFaDateTime(data.generatedAt)} · بازه {formatNumFa(data.periodDays)} روز
            </p>
          </section>

          <section className="admin-card site-reports-gtm" aria-label="وضعیت Google Tag Manager">
            <div className="admin-card-head">
              <h2>Google Tag Manager</h2>
              <span className={`admin-status ${data.gtm.configured ? 'admin-status--accepted' : 'admin-status--pending'}`}>
                {data.gtm.configured ? 'فعال' : 'پیکربندی نشده'}
              </span>
            </div>
            <p className="admin-muted">{data.gtm.note}</p>
            {data.gtm.containerId ? (
              <p className="admin-muted" style={{ marginTop: 6 }}>
                Container ID: <code dir="ltr">{data.gtm.containerId}</code>
              </p>
            ) : null}
            {data.gtm.dashboardUrl ? (
              <a className="admin-btn admin-btn--primary" href={data.gtm.dashboardUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> باز کردن Google Tag Manager
              </a>
            ) : null}
          </section>

          <div className="crm-report-charts">
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>ترافیک روزانه</h2></div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={trafficChart}>
                    <MotionBarGradientDefs id="siteTrafficBar" from={MOTION_PALETTE.purple} to={MOTION_PALETTE.mint} />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                    <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="بازدید" fill="url(#siteTrafficBar)" radius={[6, 6, 0, 0]} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>توزیع دستگاه</h2></div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.devices} dataKey="value" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2} {...motion}>
                      {data.devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="crm-report-reason-legend">
                {data.devices.map((d, i) => (
                  <li key={d.label}><i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{d.label}<span>{formatNumFa(d.value)}</span></li>
                ))}
              </ul>
            </article>
          </div>

          <div className="crm-report-charts">
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>صفحات پربازدید</h2></div>
              <div className={ADMIN_RTL_HBARS_CLASS} style={{ width: '100%', height: Math.max(180, Math.max(pageBars.length, 1) * 32), direction: 'ltr' }}>
                <ResponsiveContainer>
                  <BarChart data={pageBars} layout="vertical" margin={adminRtlHBarsMargin}>
                    <MotionBarGradientDefs id="sitePagesBar" from={MOTION_PALETTE.mint} to={MOTION_PALETTE.blue} />
                    <XAxis {...adminRtlHBarsValueAxis} />
                    <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" fill="url(#sitePagesBar-h)" radius={adminRtlHBarsRadius} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>ارجاع‌دهنده‌ها</h2></div>
              <div className={ADMIN_RTL_HBARS_CLASS} style={{ width: '100%', height: Math.max(180, Math.max(refBars.length, 1) * 32), direction: 'ltr' }}>
                <ResponsiveContainer>
                  <BarChart data={refBars} layout="vertical" margin={adminRtlHBarsMargin}>
                    <MotionBarGradientDefs id="siteRefBar" from={MOTION_PALETTE.blue} to={MOTION_PALETTE.teal} />
                    <XAxis {...adminRtlHBarsValueAxis} />
                    <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" fill="url(#siteRefBar-h)" radius={adminRtlHBarsRadius} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!data.referrers.length ? <p className="admin-muted">هنوز ارجاع خارجی ثبت نشده.</p> : null}
            </article>
          </div>

          <div className="crm-report-charts">
            <article className="admin-card">
              <div className="admin-card-head"><h2>کشور / منطقه</h2></div>
              <ul className="crm-report-reason-legend">
                {data.countries.length ? data.countries.map((c, i) => (
                  <li key={c.label}><i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{c.label}<span>{formatNumFa(c.value)}</span></li>
                )) : <li>داده‌ای نیست</li>}
              </ul>
            </article>
            <article className="admin-card">
              <div className="admin-card-head"><h2>زبان مرورگر</h2></div>
              <ul className="crm-report-reason-legend">
                {data.languages.length ? data.languages.map((c, i) => (
                  <li key={c.label}><i style={{ background: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} /><span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                )) : <li>داده‌ای نیست</li>}
              </ul>
            </article>
            <article className="admin-card">
              <div className="admin-card-head"><h2>UTM Source</h2></div>
              <ul className="crm-report-reason-legend">
                {data.utmSources.length ? data.utmSources.map((c, i) => (
                  <li key={c.label}><i style={{ background: PIE_COLORS[(i + 1) % PIE_COLORS.length] }} /><span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                )) : <li>کمپینی ثبت نشده</li>}
              </ul>
            </article>
          </div>

          <section className="admin-card">
            <div className="admin-card-head"><h2>نشست‌های اخیر</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>شروع</th><th>آخرین بازدید</th><th>صفحات</th><th>ورود</th>
                    <th>خروج</th><th>ارجاع</th><th>دستگاه</th><th>کشور</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.length ? data.recentSessions.map((s) => (
                    <tr key={s.sessionId}>
                      <td>{formatAdminFaDateTime(s.startedAt)}</td>
                      <td>{formatAdminFaDateTime(s.lastSeenAt)}</td>
                      <td>{formatNumFa(s.pageviews)}</td>
                      <td dir="ltr">{s.landingPath}</td>
                      <td dir="ltr">{s.exitPath}</td>
                      <td dir="ltr">{s.referrerHost}</td>
                      <td>{deviceFa(s.device)}</td>
                      <td>{s.country}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8}>هنوز نشستی ثبت نشده — پس از دیپلوی، ترافیک سایت اینجا می‌آید.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
