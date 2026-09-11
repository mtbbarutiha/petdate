import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, Copy, ExternalLink, Link2, Radar, RefreshCw, Tags,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
type CatalogRow = {
  name: string;
  kind: string;
  descriptionFa: string;
  descriptionEn: string;
  whereFired: string;
};
type ChecklistItem = {
  id: string;
  titleFa: string;
  titleEn: string;
  type: string;
  detailFa: string;
  requiresGa4?: boolean;
};
type RecentEvent = {
  id: number;
  sessionId: string;
  eventType: string;
  eventName: string | null;
  path: string;
  device: string;
  createdAt: string;
};
type Report = {
  generatedAt: string;
  periodDays: number;
  clarity: { configured: boolean; projectId: string | null; dashboardUrl: string | null; note: string };
  gtm: {
    configured: boolean;
    containerId: string | null;
    dashboardUrl: string | null;
    tagAssistantUrl: string | null;
    note: string;
    htmlSnippetDetected: boolean;
    statusLabelFa: string;
  };
  ga4: { measurementId: string | null; configured: boolean; note: string };
  catalog: { variables: CatalogRow[]; triggers: CatalogRow[] };
  checklist: ChecklistItem[];
  metrics: {
    pageviews: number;
    customEvents: number;
    uniqueSessions: number;
    eventsByType: Bucket[];
    topPages: Bucket[];
    devices: Bucket[];
    recentEvents: RecentEvent[];
  };
  health: {
    lastEventAt: string | null;
    lastPageviewAt: string | null;
    eventsLast24h: number;
    note: string;
  };
};

const PERIODS = [
  { days: 7, label: '۷ روز' }, { days: 14, label: '۱۴ روز' },
  { days: 30, label: '۳۰ روز' }, { days: 90, label: '۹۰ روز' },
];

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  return <MotionChartTooltip active={active} payload={payload} label={label} />;
}

function deviceFa(d: string): string {
  if (d === 'desktop' || d === 'دسکتاپ') return 'دسکتاپ';
  if (d === 'mobile' || d === 'موبایل') return 'موبایل';
  if (d === 'tablet' || d === 'تبلت') return 'تبلت';
  return d;
}

export function AdminTagManagerPage() {
  const motion = useRechartsMotion();
  const [period, setPeriod] = useState(14);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'metrics' | 'catalog' | 'checklist'>('metrics');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<Report>(`/api/admin/site-analytics/tag-manager?days=${period}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری گزارش Tag Manager ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyMsg('کپی شد');
      } else {
        setCopyMsg('کپی پشتیبانی نمی‌شود');
      }
    } catch {
      setCopyMsg('کپی ناموفق بود');
    }
    window.setTimeout(() => setCopyMsg(null), 2000);
  }, []);

  const eventBars = useMemo(() => data?.metrics.eventsByType || [], [data]);
  const pageBars = useMemo(() => data?.metrics.topPages || [], [data]);

  return (
    <div className="admin-page site-reports-page">
      <header className="admin-header">
        <div>
          <h1>گزارش Tag Manager</h1>
          <p>
            کاتالوگ Variables / Triggers / Events که سایت به dataLayer می‌فرستد + متریک‌های اول‌شخص — تگ‌های داخل کانتینر Google در UI ساخته می‌شوند.
          </p>
        </div>
        <div className="hr-reports-filters" role="group" aria-label="بازه گزارش">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={`admin-btn${period === p.days ? ' admin-btn--primary' : ''}`}
              onClick={() => setPeriod(p.days)}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className="admin-btn" onClick={() => void load()}>
            <RefreshCw size={16} /> بروزرسانی
          </button>
          <Link to="/admin/site-reports" className="admin-btn">
            گزارشات سایت
          </Link>
        </div>
      </header>

      {error ? <div className="admin-banner is-bad">{error}</div> : null}
      {loading && !data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      {data ? (
        <>
          <section className="admin-stats admin-stats--dense" aria-label="وضعیت کانتینر">
            <article className="admin-stat admin-stat--violet">
              <div className="admin-stat-icon"><Tags size={18} /></div>
              <div className="admin-stat-value" dir="ltr">{data.gtm.containerId || '—'}</div>
              <div className="admin-stat-label">Container ID</div>
            </article>
            <article className="admin-stat admin-stat--mint">
              <div className="admin-stat-icon"><Radar size={18} /></div>
              <div className="admin-stat-value">{data.gtm.configured ? 'فعال' : 'خاموش'}</div>
              <div className="admin-stat-label">{data.gtm.statusLabelFa}</div>
            </article>
            <article className="admin-stat admin-stat--orange">
              <div className="admin-stat-icon"><Activity size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.metrics.pageviews)}</div>
              <div className="admin-stat-label">page_view (اول‌شخص)</div>
            </article>
            <article className="admin-stat admin-stat--sky">
              <div className="admin-stat-icon"><Link2 size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.metrics.customEvents)}</div>
              <div className="admin-stat-label">رویداد سفارشی</div>
            </article>
            <article className="admin-stat admin-stat--slate">
              <div className="admin-stat-icon"><Activity size={18} /></div>
              <div className="admin-stat-value">{formatNumFa(data.health.eventsLast24h)}</div>
              <div className="admin-stat-label">رویداد ۲۴ساعت</div>
            </article>
          </section>

          <div className="crm-report-charts">
            <section className="admin-card site-reports-gtm" aria-label="Google Tag Manager">
              <div className="admin-card-head">
                <h2>Google Tag Manager</h2>
                <span className={`admin-status ${data.gtm.configured ? 'admin-status--accepted' : 'admin-status--pending'}`}>
                  {data.gtm.configured ? 'detected' : 'missing'}
                </span>
              </div>
              <p className="admin-muted">{data.gtm.note}</p>
              {data.gtm.containerId ? (
                <p className="admin-muted" style={{ marginTop: 8 }}>
                  Container:{' '}
                  <code dir="ltr" style={{ userSelect: 'all' }}>{data.gtm.containerId}</code>
                  {copyMsg ? <span className="admin-muted" style={{ marginInlineStart: 8 }}>{copyMsg}</span> : null}
                </p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {data.gtm.containerId ? (
                  <button type="button" className="admin-btn" onClick={() => void copyText(data.gtm.containerId!)}>
                    <Copy size={16} /> کپی ID
                  </button>
                ) : null}
                {data.gtm.dashboardUrl ? (
                  <a className="admin-btn admin-btn--primary" href={data.gtm.dashboardUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> Tag Manager
                  </a>
                ) : null}
                {data.gtm.tagAssistantUrl ? (
                  <a className="admin-btn" href={data.gtm.tagAssistantUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> Tag Assistant
                  </a>
                ) : null}
              </div>
            </section>

            <section className="admin-card site-reports-clarity" aria-label="Clarity و GA4">
              <div className="admin-card-head">
                <h2>Clarity + GA4</h2>
                <span className={`admin-status ${data.clarity.configured ? 'admin-status--accepted' : 'admin-status--pending'}`}>
                  {data.clarity.configured ? 'Clarity فعال' : 'Clarity خاموش'}
                </span>
              </div>
              <p className="admin-muted">{data.clarity.note}</p>
              {data.clarity.dashboardUrl ? (
                <a className="admin-btn admin-btn--primary" href={data.clarity.dashboardUrl} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>
                  <ExternalLink size={16} /> داشبورد Clarity
                </a>
              ) : null}
              <p className="admin-muted" style={{ marginTop: 12 }}>{data.ga4.note}</p>
              {data.ga4.measurementId ? (
                <p className="admin-muted">
                  Measurement ID: <code dir="ltr">{data.ga4.measurementId}</code>
                </p>
              ) : (
                <p className="admin-muted" dir="ltr">PLACEHOLDER_G-XXXXXXXX</p>
              )}
              <p className="admin-muted" style={{ fontSize: '0.75rem', marginTop: 10 }}>
                سلامت: {data.health.note}
                {data.health.lastEventAt ? ` · آخرین: ${formatAdminFaDateTime(data.health.lastEventAt)}` : null}
              </p>
            </section>
          </div>

          <div className="hr-reports-filters" role="tablist" aria-label="بخش‌های گزارش" style={{ marginBottom: 12 }}>
            {(
              [
                ['metrics', 'متریک زنده'],
                ['catalog', 'Variables / Triggers'],
                ['checklist', 'چک‌لیست GTM UI'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`admin-btn${tab === id ? ' admin-btn--primary' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'metrics' ? (
            <>
              <div className="crm-report-charts">
                <article className="admin-card crm-report-chart-box">
                  <div className="admin-card-head"><h2>رویدادها بر اساس نوع</h2></div>
                  <div
                    className={ADMIN_RTL_HBARS_CLASS}
                    style={{ width: '100%', height: Math.max(180, Math.max(eventBars.length, 1) * 28), direction: 'ltr' }}
                  >
                    <ResponsiveContainer>
                      <BarChart data={eventBars} layout="vertical" margin={adminRtlHBarsMargin}>
                        <MotionBarGradientDefs id="tmEventsBar" from={MOTION_PALETTE.purple} to={MOTION_PALETTE.mint} />
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                        <XAxis {...adminRtlHBarsValueAxis} />
                        <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="value" fill="url(#tmEventsBar-h)" radius={adminRtlHBarsRadius} {...motion} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {!eventBars.length ? <p className="admin-muted">هنوز رویدادی ثبت نشده.</p> : null}
                </article>
                <article className="admin-card crm-report-chart-box">
                  <div className="admin-card-head"><h2>صفحات پربازدید</h2></div>
                  <div
                    className={ADMIN_RTL_HBARS_CLASS}
                    style={{ width: '100%', height: Math.max(180, Math.max(pageBars.length, 1) * 28), direction: 'ltr' }}
                  >
                    <ResponsiveContainer>
                      <BarChart data={pageBars} layout="vertical" margin={adminRtlHBarsMargin}>
                        <MotionBarGradientDefs id="tmPagesBar" from={MOTION_PALETTE.mint} to={MOTION_PALETTE.blue} />
                        <XAxis {...adminRtlHBarsValueAxis} />
                        <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="value" fill="url(#tmPagesBar-h)" radius={adminRtlHBarsRadius} {...motion} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>

              <section className="admin-card">
                <div className="admin-card-head"><h2>تایم‌لاین رویدادهای اخیر</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>زمان</th>
                        <th>رویداد</th>
                        <th>مسیر</th>
                        <th>دستگاه</th>
                        <th>نشست</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.metrics.recentEvents.length ? data.metrics.recentEvents.map((e) => (
                        <tr key={e.id}>
                          <td>{formatAdminFaDateTime(e.createdAt)}</td>
                          <td dir="ltr">{e.eventName || e.eventType}</td>
                          <td dir="ltr">{e.path}</td>
                          <td>{deviceFa(e.device)}</td>
                          <td dir="ltr" style={{ fontSize: '0.75rem' }}>{e.sessionId.slice(0, 12)}…</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5}>هنوز رویدادی نیست — پس از ترافیک عمومی اینجا پر می‌شود.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <ul className="crm-report-reason-legend" style={{ marginTop: 12 }}>
                  {data.metrics.devices.map((d, i) => (
                    <li key={d.label}>
                      <i style={{ background: ['#5c4d91', '#15cca0', '#f59e0b'][i % 3] }} />
                      {d.label}
                      <span>{formatNumFa(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : null}

          {tab === 'catalog' ? (
            <>
              <section className="admin-card">
                <div className="admin-card-head"><h2>Variables (dataLayer keys)</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>نام</th>
                        <th>توضیح</th>
                        <th>کجا ست می‌شود</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.catalog.variables.map((v) => (
                        <tr key={v.name}>
                          <td dir="ltr"><code>{v.name}</code></td>
                          <td>{v.descriptionFa}</td>
                          <td className="admin-muted">{v.whereFired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="admin-card" style={{ marginTop: 16 }}>
                <div className="admin-card-head"><h2>Triggers / Events (سایت)</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>event</th>
                        <th>توضیح</th>
                        <th>محل شلیک</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.catalog.triggers.map((t) => (
                        <tr key={t.name}>
                          <td dir="ltr"><code>{t.name}</code></td>
                          <td>{t.descriptionFa}</td>
                          <td className="admin-muted">{t.whereFired}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {tab === 'checklist' ? (
            <section className="admin-card">
              <div className="admin-card-head"><h2>چک‌لیست ساخت تگ در GTM UI</h2></div>
              <p className="admin-muted" style={{ marginBottom: 12 }}>
                این موارد را داخل{' '}
                <a href={data.gtm.dashboardUrl || 'https://tagmanager.google.com/'} target="_blank" rel="noreferrer">
                  tagmanager.google.com
                </a>{' '}
                برای کانتینر <code dir="ltr">{data.gtm.containerId}</code> بسازید. Measurement ID ساختگی وارد نکنید.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>نوع</th>
                      <th>عنوان</th>
                      <th>جزئیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.checklist.map((c) => (
                      <tr key={c.id}>
                        <td>{c.type}</td>
                        <td>{c.titleFa}</td>
                        <td className="admin-muted">
                          {c.detailFa}
                          {c.requiresGa4 && !data.ga4.configured ? (
                            <span> · <code dir="ltr">PLACEHOLDER_G-XXXXXXXX</code></span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="admin-muted" style={{ marginTop: 12, fontSize: '0.75rem' }}>
                سند کامل: <code dir="ltr">docs/gtm-setup-checklist.md</code> · بروزرسانی گزارش:{' '}
                {formatAdminFaDateTime(data.generatedAt)}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
