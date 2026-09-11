import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, ExternalLink, Globe2, MonitorSmartphone, RefreshCw, Smartphone, Tablet, Tags,
} from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { adminCan } from '../auth';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import {
  ADMIN_RTL_HBARS_CLASS, adminRtlHBarsCategoryAxis, adminRtlHBarsMargin, adminRtlHBarsRadius, adminRtlHBarsValueAxis,
} from '../rechartsRtlHBars';
import {
  MOTION_PALETTE,
  MotionChartTooltip,
  useRechartsMotion,
} from '../motionCharts';

type Bucket = { label: string; value: number };
type SessionRow = {
  sessionId: string; startedAt: string; lastSeenAt: string; pageviews: number;
  landingPath: string; exitPath: string; referrerHost: string; device: string; country: string;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
};
type UtmPerf = { source: string; medium: string; campaign: string; sessions: number; pageviews: number };
type SavedUtm = {
  id: number; name: string; path: string; utmSource: string; utmMedium: string;
  utmCampaign: string; utmContent: string | null; utmTerm: string | null;
  previewUrl: string; createdAt: string;
};
type Integration = {
  configured: boolean;
  projectId?: string | null;
  containerId?: string | null;
  measurementId?: string | null;
  dashboardUrl: string | null;
  tagAssistantUrl?: string | null;
  source?: 'env' | 'settings' | null;
  note: string;
};
type Report = {
  generatedAt: string; periodDays: number;
  overview: {
    pageviews: number; sessions: number; uniqueSessions: number; avgPagesPerSession: number;
    bounceRatePct: number; engagementRatePct: number;
    desktopPct: number; mobilePct: number; tabletPct: number;
  };
  trafficDaily: Bucket[]; sessionsDaily: Bucket[]; popularPages: Bucket[]; referrers: Bucket[];
  devices: Bucket[]; countries: Bucket[]; languages: Bucket[];
  utmSources: Bucket[]; utmMediums: Bucket[]; utmCampaigns: Bucket[];
  utmPerformance?: UtmPerf[];
  savedUtmCampaigns?: SavedUtm[];
  events: Bucket[];
  recentSessions: SessionRow[];
  clarity: Integration;
  gtm: Integration;
  ga4: Integration;
  requestedAgentId: string | null;
};

type TagManagerReport = {
  generatedAt: string;
  periodDays: number;
  clarity: Integration;
  gtm: Integration & { htmlSnippetDetected: boolean; statusLabelFa: string };
  ga4: { measurementId: string | null; configured: boolean; note: string };
  catalog: {
    variables: Array<{ name: string; kind: string; descriptionFa: string; whereFired: string }>;
    triggers: Array<{ name: string; kind: string; descriptionFa: string; whereFired: string }>;
  };
  checklist: Array<{ id: string; titleFa: string; type: string; detailFa: string; requiresGa4?: boolean }>;
  metrics: {
    pageviews: number; customEvents: number; uniqueSessions: number;
    eventsByType: Bucket[]; topPages: Bucket[]; devices: Bucket[];
    recentEvents: Array<{
      id: number; sessionId: string; eventType: string; eventName: string | null;
      path: string; device: string; createdAt: string;
    }>;
  };
  health: { lastEventAt: string | null; lastPageviewAt: string | null; eventsLast24h: number; note: string };
};

type Tab = 'overview' | 'events' | 'utm' | 'setup' | 'tag-manager' | 'clarity';

const PERIODS = [
  { days: 7, label: '۷ روز' }, { days: 14, label: '۱۴ روز' },
  { days: 30, label: '۳۰ روز' }, { days: 90, label: '۹۰ روز' },
];
const PIE_COLORS = ['#5c4d91', '#15cca0', '#f59e0b', '#0ea5e9', '#ec4899', '#64748b'];
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نمای کلی' },
  { id: 'events', label: 'رویدادها' },
  { id: 'utm', label: 'UTM' },
  { id: 'setup', label: 'راه‌اندازی' },
  { id: 'tag-manager', label: 'Tag Manager' },
  { id: 'clarity', label: 'Clarity' },
];

function buildPreviewUrl(input: {
  path: string; utmSource: string; utmMedium: string; utmCampaign: string;
  utmContent: string; utmTerm: string;
}): string {
  const path = (input.path.trim() || '/').startsWith('/')
    ? (input.path.trim() || '/')
    : `/${input.path.trim()}`;
  const u = new URL(path.split('?')[0] || '/', 'https://petdate.ir');
  if (input.utmSource) u.searchParams.set('utm_source', input.utmSource);
  if (input.utmMedium) u.searchParams.set('utm_medium', input.utmMedium);
  if (input.utmCampaign) u.searchParams.set('utm_campaign', input.utmCampaign);
  if (input.utmContent) u.searchParams.set('utm_content', input.utmContent);
  if (input.utmTerm) u.searchParams.set('utm_term', input.utmTerm);
  return u.toString();
}

function deviceFa(d: string): string {
  if (d === 'desktop' || d === 'دسکتاپ') return 'دسکتاپ';
  if (d === 'mobile' || d === 'موبایل') return 'موبایل';
  if (d === 'tablet' || d === 'تبلت') return 'تبلت';
  return d;
}

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  return <MotionChartTooltip active={active} payload={payload} label={label} />;
}

function StatusCard({
  title, status, note, href, hrefLabel, extra,
}: {
  title: string; status: boolean; note: string;   href?: string | null; hrefLabel?: string; extra?: ReactNode;
}) {
  return (
    <section className="admin-card" aria-label={title}>
      <div className="admin-card-head">
        <h2>{title}</h2>
        <span className={`admin-status ${status ? 'admin-status--accepted' : 'admin-status--pending'}`}>
          {status ? 'فعال' : 'پیکربندی نشده'}
        </span>
      </div>
      <p className="admin-muted">{note}</p>
      {extra}
      {href ? (
        <a className="admin-btn admin-btn--primary" href={href} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
          <ExternalLink size={16} /> {hrefLabel || 'باز کردن داشبورد'}
        </a>
      ) : null}
    </section>
  );
}

export function AdminSiteReportsPage() {
  const motion = useRechartsMotion();
  const canWrite = adminCan('platform.write') || adminCan('admin.full');
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState(14);
  const [data, setData] = useState<Report | null>(null);
  const [tm, setTm] = useState<TagManagerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ga4Draft, setGa4Draft] = useState('');
  const [ga4SaveMsg, setGa4SaveMsg] = useState<string | null>(null);
  const [gtmCopyMsg, setGtmCopyMsg] = useState<string | null>(null);
  const [utmForm, setUtmForm] = useState({
    name: '', path: '/', utmSource: 'telegram', utmMedium: 'social',
    utmCampaign: '', utmContent: '', utmTerm: '',
  });
  const [utmMsg, setUtmMsg] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [report, tagManager] = await Promise.all([
        adminFetch<Report>(`/api/admin/site-analytics/reports?days=${period}`),
        adminFetch<TagManagerReport>(`/api/admin/site-analytics/tag-manager?days=${period}`).catch(() => null),
      ]);
      setData(report);
      setTm(tagManager);
      setGa4Draft(report.ga4.measurementId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری آنالیتیکس ناموفق بود');
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const saveGa4 = useCallback(async () => {
    if (!canWrite) return;
    const trimmed = ga4Draft.trim();
    if (trimmed && !/^G-[A-Z0-9]{6,20}$/i.test(trimmed)) {
      setGa4SaveMsg('شناسه باید شبیه G-XXXXXXXX باشد');
      return;
    }
    try {
      await adminFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: { ga4MeasurementId: trimmed.toUpperCase() } }),
      });
      setGa4SaveMsg('ذخیره شد');
      await load();
    } catch (err) {
      setGa4SaveMsg(err instanceof Error ? err.message : 'ذخیره ناموفق');
    }
    window.setTimeout(() => setGa4SaveMsg(null), 2500);
  }, [canWrite, ga4Draft, load]);

  const copyGtmId = useCallback(async (id: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
        setGtmCopyMsg('شناسه کپی شد');
      } else {
        setGtmCopyMsg('کپی پشتیبانی نمی‌شود');
      }
    } catch {
      setGtmCopyMsg('کپی ناموفق بود');
    }
    window.setTimeout(() => setGtmCopyMsg(null), 2200);
  }, []);

  const saveUtmCampaign = useCallback(async () => {
    if (!canWrite) return;
    try {
      await adminFetch('/api/admin/site-analytics/utm-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: utmForm.name || utmForm.utmCampaign || 'کمپین',
          path: utmForm.path || '/',
          utmSource: utmForm.utmSource,
          utmMedium: utmForm.utmMedium,
          utmCampaign: utmForm.utmCampaign,
          utmContent: utmForm.utmContent || null,
          utmTerm: utmForm.utmTerm || null,
        }),
      });
      setUtmMsg('کمپین ذخیره شد');
      await load();
    } catch (err) {
      setUtmMsg(err instanceof Error ? err.message : 'ذخیره ناموفق');
    }
    window.setTimeout(() => setUtmMsg(null), 2500);
  }, [canWrite, utmForm, load]);

  const deleteUtm = useCallback(async (id: number) => {
    if (!canWrite) return;
    try {
      await adminFetch(`/api/admin/site-analytics/utm-campaigns/${id}`, { method: 'DELETE' });
      await load();
    } catch {
      /* ignore */
    }
  }, [canWrite, load]);

  const previewUrl = useMemo(
    () => buildPreviewUrl(utmForm),
    [utmForm],
  );

  const trafficChart = useMemo(
    () => (data?.trafficDaily || []).map((r) => ({ ...r, labelShort: r.label.slice(5) })),
    [data],
  );
  const sessionsChart = useMemo(
    () => (data?.sessionsDaily || []).map((r) => ({ ...r, labelShort: r.label.slice(5) })),
    [data],
  );
  const pageBars = data?.popularPages || [];
  const refBars = data?.referrers || [];
  const eventBars = data?.events || tm?.metrics.eventsByType || [];
  const utmPerf = data?.utmPerformance || [];
  const savedUtms = data?.savedUtmCampaigns || [];

  const gtmSteps = useMemo(() => {
    const mid = data?.ga4.measurementId || 'از تنظیمات پلتفرم / Measurement ID';
    return [
      {
        title: '۱) Variables در GTM',
        body: `در tagmanager.google.com کانتینر GTM-KQPJT9Q4 را باز کنید. Variables → New → Data Layer Variable برای: page_path, page_title, page_location, page_type, user_id, user_status, utm_source, utm_medium, utm_campaign, click_url, click_text. سپس Constant با نام GA4 Measurement ID و مقدار ${mid}.`,
      },
      {
        title: '۲) Triggers',
        body: 'Triggers → New → Custom Event برای هر کدام: page_view، link_click، outbound_click، login، sign_up، generate_lead، view_item، add_to_cart، begin_checkout، purchase، scroll. (سایت SPA خودش این eventها را به dataLayer می‌فرستد.)',
      },
      {
        title: '۳) Tags',
        body: `Tag: Google Analytics → GA4 Configuration با Measurement ID = ${mid} و Send page view = False. سپس GA4 Event tags با Event Name = page_view / {{Event}} و Triggerهای بالا. Tag: Conversion Linker با Trigger All Pages.`,
      },
      {
        title: '۴) UTM و تست',
        body: 'از تب UTM لینک بسازید → در تب ناشناس باز کنید → در آنالیتیکس نشست و UTM را ببینید. Tag Assistant را روی petdate.ir وصل کنید و event page_view را تأیید کنید.',
      },
    ];
  }, [data?.ga4.measurementId]);

  return (
    <div className="admin-page site-reports-page">
      <header className="admin-header">
        <div>
          <h1>آنالیتیکس</h1>
          <p>گزارش رفتار کاربران روی petdate.ir — اول‌شخص + وضعیت GA4 / GTM / Clarity</p>
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

      <div className="admin-tabs" role="tablist" aria-label="بخش آنالیتیکس" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? ' is-on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="admin-banner is-bad">{error}</div> : null}
      {loading && !data ? <p className="admin-muted">در حال بارگذاری…</p> : null}

      {data && tab === 'overview' ? (
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
              <div className="admin-stat-value">{formatNumFa(data.overview.engagementRatePct)}٪</div>
              <div className="admin-stat-label">نرخ تعامل</div>
            </article>
          </section>

          <div className="crm-report-charts" style={{ marginBottom: 16 }}>
            <StatusCard
              title="Google Analytics (GA4)"
              status={data.ga4.configured}
              note={data.ga4.note}
              href={data.ga4.dashboardUrl}
              hrefLabel="باز کردن Google Analytics"
              extra={(
                <div style={{ marginTop: 10 }}>
                  {data.ga4.measurementId ? (
                    <p className="admin-muted">Measurement ID: <code dir="ltr">{data.ga4.measurementId}</code>
                      {data.ga4.source ? ` · منبع: ${data.ga4.source === 'settings' ? 'تنظیمات' : 'env'}` : null}
                    </p>
                  ) : null}
                  {canWrite ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <input
                        className="form-input"
                        dir="ltr"
                        placeholder="G-XXXXXXXX"
                        value={ga4Draft}
                        onChange={(e) => setGa4Draft(e.target.value)}
                        style={{ maxWidth: 220 }}
                      />
                      <button type="button" className="admin-btn admin-btn--primary" onClick={() => void saveGa4()}>
                        ذخیره Measurement ID
                      </button>
                      {ga4SaveMsg ? <span className="admin-muted">{ga4SaveMsg}</span> : null}
                    </div>
                  ) : null}
                </div>
              )}
            />
            <StatusCard
              title="Google Tag Manager"
              status={data.gtm.configured}
              note={data.gtm.note}
              href={data.gtm.dashboardUrl}
              hrefLabel="باز کردن Tag Manager"
              extra={(
                <div style={{ marginTop: 6 }}>
                  {data.gtm.containerId ? (
                    <p className="admin-muted">
                      Container: <code dir="ltr">{data.gtm.containerId}</code>
                      <button type="button" className="admin-btn" style={{ marginInlineStart: 8 }}
                        onClick={() => void copyGtmId(data.gtm.containerId!)}>کپی</button>
                      {gtmCopyMsg ? <span className="admin-muted" style={{ marginInlineStart: 8 }}>{gtmCopyMsg}</span> : null}
                    </p>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {data.gtm.tagAssistantUrl ? (
                      <a className="admin-btn" href={data.gtm.tagAssistantUrl} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} /> Tag Assistant
                      </a>
                    ) : null}
                    <Link to="/admin/tag-manager" className="admin-btn">
                      گزارش کامل Tag Manager
                    </Link>
                  </div>
                </div>
              )}
            />
            <StatusCard
              title="Microsoft Clarity"
              status={data.clarity.configured}
              note={data.clarity.note}
              href={data.clarity.dashboardUrl}
              hrefLabel="باز کردن Clarity"
            />
          </div>

          <div className="crm-report-charts">
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>ترافیک روزانه</h2></div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={trafficChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                    <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="بازدید" fill={MOTION_PALETTE.purple} radius={[6, 6, 0, 0]} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>نشست روزانه</h2></div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={sessionsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                    <XAxis dataKey="labelShort" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="نشست" fill={MOTION_PALETTE.teal} radius={[6, 6, 0, 0]} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="crm-report-charts">
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
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>صفحات پربازدید</h2></div>
              <div className={ADMIN_RTL_HBARS_CLASS} style={{ width: '100%', height: Math.max(180, Math.max(pageBars.length, 1) * 32), direction: 'ltr' }}>
                <ResponsiveContainer>
                  <BarChart data={pageBars} layout="vertical" margin={adminRtlHBarsMargin}>
                    <XAxis {...adminRtlHBarsValueAxis} />
                    <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" fill={MOTION_PALETTE.mint} radius={adminRtlHBarsRadius} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="crm-report-charts">
            <article className="admin-card crm-report-chart-box">
              <div className="admin-card-head"><h2>ارجاع‌دهنده‌ها</h2></div>
              <div className={ADMIN_RTL_HBARS_CLASS} style={{ width: '100%', height: Math.max(180, Math.max(refBars.length, 1) * 32), direction: 'ltr' }}>
                <ResponsiveContainer>
                  <BarChart data={refBars} layout="vertical" margin={adminRtlHBarsMargin}>
                    <XAxis {...adminRtlHBarsValueAxis} />
                    <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" fill={MOTION_PALETTE.blue} radius={adminRtlHBarsRadius} {...motion} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {!data.referrers.length ? <p className="admin-muted">هنوز ارجاع خارجی ثبت نشده.</p> : null}
            </article>
            <article className="admin-card">
              <div className="admin-card-head"><h2>کشور / زبان / UTM</h2></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                <ul className="crm-report-reason-legend">
                  <li style={{ fontWeight: 600 }}>کشور</li>
                  {data.countries.length ? data.countries.map((c, i) => (
                    <li key={c.label}><i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{c.label}<span>{formatNumFa(c.value)}</span></li>
                  )) : <li>داده‌ای نیست</li>}
                </ul>
                <ul className="crm-report-reason-legend">
                  <li style={{ fontWeight: 600 }}>زبان</li>
                  {data.languages.length ? data.languages.map((c, i) => (
                    <li key={c.label}><i style={{ background: PIE_COLORS[(i + 2) % PIE_COLORS.length] }} /><span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                  )) : <li>داده‌ای نیست</li>}
                </ul>
                <ul className="crm-report-reason-legend">
                  <li style={{ fontWeight: 600 }}>UTM Source</li>
                  {data.utmSources.length ? data.utmSources.map((c, i) => (
                    <li key={c.label}><i style={{ background: PIE_COLORS[(i + 1) % PIE_COLORS.length] }} /><span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                  )) : <li>کمپینی ثبت نشده — از تب UTM لینک بسازید</li>}
                  {(data.utmMediums || []).slice(0, 5).map((c, i) => (
                    <li key={`m-${c.label}`}><i style={{ background: PIE_COLORS[(i + 3) % PIE_COLORS.length] }} />medium <span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                  ))}
                  {(data.utmCampaigns || []).slice(0, 5).map((c, i) => (
                    <li key={`c-${c.label}`}><i style={{ background: PIE_COLORS[(i + 4) % PIE_COLORS.length] }} />campaign <span dir="ltr">{c.label}</span><span>{formatNumFa(c.value)}</span></li>
                  ))}
                </ul>
              </div>
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
                      <td className="admin-cell-nowrap">{s.startedAt ? formatAdminFaDateTime(s.startedAt) : '—'}</td>
                      <td className="admin-cell-nowrap">{s.lastSeenAt ? formatAdminFaDateTime(s.lastSeenAt) : '—'}</td>
                      <td>{formatNumFa(s.pageviews)}</td>
                      <td dir="ltr">{s.landingPath || '/'}</td>
                      <td dir="ltr">{s.exitPath || '/'}</td>
                      <td dir="ltr">
                        {s.referrerHost || '(direct)'}
                        {s.utmCampaign ? <span className="admin-muted"> · {s.utmCampaign}</span> : null}
                      </td>
                      <td>{deviceFa(s.device)}</td>
                      <td>{s.country || 'نامشخص'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8}>هنوز نشستی ثبت نشده — پس از دیپلوی، ترافیک سایت اینجا می‌آید.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="admin-muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
              آخرین بروزرسانی: {formatAdminFaDateTime(data.generatedAt)} · بازه {formatNumFa(data.periodDays)} روز
            </p>
          </section>
        </>
      ) : null}

      {data && tab === 'events' ? (
        <>
          <article className="admin-card crm-report-chart-box">
            <div className="admin-card-head"><h2>تفکیک رویدادها</h2></div>
            <p className="admin-muted">رویدادهای dataLayer / اول‌شخص (page_view، link_click، login، …)</p>
            <div className={ADMIN_RTL_HBARS_CLASS} style={{ width: '100%', height: Math.max(220, Math.max(eventBars.length, 1) * 28), direction: 'ltr' }}>
              <ResponsiveContainer>
                <BarChart data={eventBars} layout="vertical" margin={adminRtlHBarsMargin}>
                  <XAxis {...adminRtlHBarsValueAxis} />
                  <YAxis dataKey="label" {...adminRtlHBarsCategoryAxis} />
                  <Tooltip content={<Tip />} />
                    <Bar dataKey="value" fill={MOTION_PALETTE.mint} radius={adminRtlHBarsRadius} {...motion} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {!eventBars.length ? <p className="admin-muted">هنوز رویدادی ثبت نشده.</p> : null}
          </article>
          {tm?.metrics.recentEvents?.length ? (
            <section className="admin-card" style={{ marginTop: 16 }}>
              <div className="admin-card-head"><h2>رویدادهای اخیر</h2></div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>زمان</th><th>نوع</th><th>نام</th><th>مسیر</th><th>دستگاه</th></tr>
                  </thead>
                  <tbody>
                    {tm.metrics.recentEvents.slice(0, 40).map((e) => (
                      <tr key={e.id}>
                        <td>{formatAdminFaDateTime(e.createdAt)}</td>
                        <td dir="ltr">{e.eventType}</td>
                        <td dir="ltr">{e.eventName || '—'}</td>
                        <td dir="ltr">{e.path}</td>
                        <td>{deviceFa(e.device)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {data && tab === 'utm' ? (
        <>
          <section className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-head"><h2>سازنده لینک UTM</h2></div>
            <p className="admin-muted">لینک کمپین برای petdate.ir بسازید؛ با باز شدن لینک، utm_* در session ذخیره و در هر collect ارسال می‌شود.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginTop: 12 }}>
              {([
                ['name', 'نام کمپین (اختیاری)'],
                ['path', 'مسیر (مثل /shop)'],
                ['utmSource', 'utm_source'],
                ['utmMedium', 'utm_medium'],
                ['utmCampaign', 'utm_campaign'],
                ['utmContent', 'utm_content'],
                ['utmTerm', 'utm_term'],
              ] as const).map(([key, label]) => (
                <label key={key} style={{ display: 'grid', gap: 4 }}>
                  <span className="admin-muted">{label}</span>
                  <input
                    className="form-input"
                    dir="ltr"
                    value={utmForm[key]}
                    onChange={(e) => setUtmForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <p style={{ marginTop: 12 }} dir="ltr"><code>{previewUrl}</code></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <button type="button" className="admin-btn" onClick={() => void copyGtmId(previewUrl)}>کپی لینک</button>
              {canWrite ? (
                <button type="button" className="admin-btn admin-btn--primary" onClick={() => void saveUtmCampaign()}>
                  ذخیره کمپین
                </button>
              ) : null}
              {utmMsg ? <span className="admin-muted">{utmMsg}</span> : null}
            </div>
          </section>

          <section className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-head"><h2>عملکرد UTM</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>source</th><th>medium</th><th>campaign</th><th>نشست</th><th>بازدید</th></tr>
                </thead>
                <tbody>
                  {utmPerf.length ? utmPerf.map((u) => (
                    <tr key={`${u.source}-${u.medium}-${u.campaign}`}>
                      <td dir="ltr">{u.source}</td>
                      <td dir="ltr">{u.medium}</td>
                      <td dir="ltr">{u.campaign}</td>
                      <td>{formatNumFa(u.sessions)}</td>
                      <td>{formatNumFa(u.pageviews)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>هنوز ترافیک UTM ثبت نشده — یک لینک بسازید و در تب ناشناس باز کنید.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-card-head"><h2>کمپین‌های ذخیره‌شده</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>نام</th><th>لینک</th><th>زمان</th><th></th></tr>
                </thead>
                <tbody>
                  {savedUtms.length ? savedUtms.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td dir="ltr"><a href={c.previewUrl} target="_blank" rel="noreferrer">{c.previewUrl}</a></td>
                      <td className="admin-cell-nowrap">{formatAdminFaDateTime(c.createdAt)}</td>
                      <td>
                        {canWrite ? (
                          <button type="button" className="admin-btn" onClick={() => void deleteUtm(c.id)}>حذف</button>
                        ) : null}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}>کمپین ذخیره‌شده‌ای نیست.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {data && tab === 'setup' ? (
        <section className="admin-card">
          <div className="admin-card-head"><h2>راه‌اندازی مرحله‌به‌مرحله UTM و GTM</h2></div>
          <p className="admin-muted">
            دسترسی API به Google Tag Manager در این محیط نیست — تگ‌ها را با این ویزارد در UI بسازید.
            کانتینر زنده: <code dir="ltr">{data.gtm.containerId || 'GTM-KQPJT9Q4'}</code>
            {data.ga4.measurementId ? <> · GA4: <code dir="ltr">{data.ga4.measurementId}</code></> : ' · ابتدا Measurement ID را در نمای کلی ذخیره کنید'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
            {gtmSteps.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`admin-btn${setupStep === i ? ' admin-btn--primary' : ''}`}
                onClick={() => setSetupStep(i)}
              >
                {formatNumFa(i + 1)}
              </button>
            ))}
          </div>
          <article className="admin-card" style={{ boxShadow: 'none', border: '1px solid var(--admin-border)' }}>
            <h3>{gtmSteps[setupStep]?.title}</h3>
            <p style={{ lineHeight: 1.7 }}>{gtmSteps[setupStep]?.body}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="admin-btn" disabled={setupStep <= 0} onClick={() => setSetupStep((s) => Math.max(0, s - 1))}>قبلی</button>
              <button type="button" className="admin-btn admin-btn--primary" disabled={setupStep >= gtmSteps.length - 1} onClick={() => setSetupStep((s) => Math.min(gtmSteps.length - 1, s + 1))}>بعدی</button>
              <Link to="/admin/tag-manager" className="admin-btn">کاتالوگ کامل Tag Manager</Link>
            </div>
          </article>
          {tm?.checklist?.length ? (
            <ul className="crm-report-reason-legend" style={{ marginTop: 16 }}>
              {tm.checklist.map((item) => (
                <li key={item.id}>
                  <strong>{item.titleFa}</strong>
                  <span className="admin-muted" style={{ display: 'block' }}>{item.detailFa}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tab === 'tag-manager' ? (
        <div>
          {tm ? (
            <>
              <div className="crm-report-charts" style={{ marginBottom: 16 }}>
                <StatusCard title="GTM" status={tm.gtm.configured} note={`${tm.gtm.statusLabelFa} — ${tm.gtm.note}`} href={tm.gtm.dashboardUrl} hrefLabel="Tag Manager" />
                <StatusCard title="GA4 در GTM" status={tm.ga4.configured} note={tm.ga4.note} href={tm.ga4.configured ? 'https://analytics.google.com/' : null} />
                <StatusCard title="سلامت beacon" status={tm.health.eventsLast24h > 0} note={tm.health.note} />
              </div>
              <section className="admin-card" style={{ marginBottom: 16 }}>
                <div className="admin-card-head"><h2><Tags size={16} /> چک‌لیست پیکربندی GTM UI</h2></div>
                <ul className="crm-report-reason-legend">
                  {tm.checklist.map((item) => (
                    <li key={item.id}>
                      <strong>{item.titleFa}</strong>
                      <span className="admin-muted" style={{ display: 'block' }}>{item.detailFa}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="crm-report-charts">
                <article className="admin-card">
                  <div className="admin-card-head"><h2>Variables (dataLayer)</h2></div>
                  <ul className="crm-report-reason-legend">
                    {tm.catalog.variables.map((v) => (
                      <li key={v.name}><code dir="ltr">{v.name}</code> — {v.descriptionFa}</li>
                    ))}
                  </ul>
                </article>
                <article className="admin-card">
                  <div className="admin-card-head"><h2>Triggers / Custom Events</h2></div>
                  <ul className="crm-report-reason-legend">
                    {tm.catalog.triggers.map((v) => (
                      <li key={v.name}><code dir="ltr">{v.name}</code> — {v.descriptionFa}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </>
          ) : (
            <p className="admin-muted">گزارش Tag Manager در دسترس نیست — از تب نمای کلی وضعیت GTM را ببینید.</p>
          )}
        </div>
      ) : null}

      {data && tab === 'clarity' ? (
        <StatusCard
          title="Microsoft Clarity"
          status={data.clarity.configured}
          note={data.clarity.note}
          href={data.clarity.dashboardUrl}
          hrefLabel="باز کردن داشبورد Clarity"
          extra={data.clarity.projectId ? (
            <p className="admin-muted" style={{ marginTop: 8 }}>
              Project ID: <code dir="ltr">{data.clarity.projectId}</code>
            </p>
          ) : null}
        />
      ) : null}
    </div>
  );
}
