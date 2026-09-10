import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { HrKpiGrid, HrLinkGrid } from './HrUi';

type ChartRow = { name: string; count: number };

type Dash = {
  kpis: {
    openJobs: number;
    totalOpenings: number;
    candidates: number;
    hired: number;
    onboardingActive: number;
    pipelineInterview: number;
    pipelineOffer: number;
    talentBank: number;
  };
  byStage: Record<string, number>;
  stageChart?: ChartRow[];
  links: Array<{ to: string; label: string }>;
  recentCandidates: HrCandidate[];
  openings: HrJobOpening[];
};

const COLORS = ['#5c4d91', '#15cca0', '#fd961e', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

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
    <div className="hr-chart-tooltip">
      <div className="hr-chart-tooltip-label">{label}</div>
      <strong>{formatNumFa(Number(payload[0].value || 0))} نفر</strong>
    </div>
  );
}

export function AdminHrRecruitmentDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await adminFetch<Dash>('/api/admin/hr/recruitment/dashboard'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const k = data?.kpis;
  const stageRows = useMemo(() => {
    if (data?.stageChart?.length) return data.stageChart;
    return Object.entries(data?.byStage || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  return (
    <div className="admin-page hr-dash">
      <header className="admin-header">
        <div>
          <h1>داشبورد جذب و استخدام</h1>
          <p>قیف متقاضیان، فرصت‌های باز و شروع به کار</p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/hr" className="admin-btn admin-btn--ghost">
            داشبورد HR
          </Link>
          <Link to="/admin/hr/ats" className="admin-btn">
            ATS
          </Link>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {k ? (
        <HrKpiGrid
          items={[
            { label: 'آگهی باز', value: k.openJobs, tone: 'mint' },
            { label: 'کل فرصت‌ها', value: k.totalOpenings, tone: 'slate' },
            { label: 'متقاضیان', value: k.candidates, tone: 'sky' },
            { label: 'استخدام‌شده', value: k.hired, tone: 'violet' },
            { label: 'آنبوردینگ فعال', value: k.onboardingActive, tone: 'orange' },
            { label: 'در مصاحبه', value: k.pipelineInterview, tone: 'sky' },
            { label: 'پیشنهاد شغلی', value: k.pipelineOffer, tone: 'mint' },
            { label: 'بانک استعداد', value: k.talentBank, tone: 'slate' },
          ]}
        />
      ) : null}

      <div className="hr-dash-main-row" style={{ marginTop: 16 }}>
        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>قیف / توزیع مراحل</h2>
          </div>
          <div className="hr-dash-chart" style={{ height: Math.max(220, 36 * Math.max(stageRows.length, 3)) }}>
            {stageRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={stageRows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--admin-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#757086' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#3d3558' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(92,77,145,0.06)' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={22}>
                    {stageRows.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="admin-muted">متقاضی‌ای نیست</p>
            )}
          </div>
        </article>

        <article className="admin-card hr-dash-panel">
          <div className="admin-card-head">
            <h2>آخرین متقاضیان</h2>
          </div>
          <ul className="admin-log-list">
            {(data?.recentCandidates || []).map((c) => (
              <li key={c.id}>
                <b>
                  {c.firstName} {c.lastName}
                </b>{' '}
                · {c.stage}
              </li>
            ))}
            {!data?.recentCandidates?.length ? <li className="admin-muted">موردی نیست</li> : null}
          </ul>
        </article>
      </div>

      {data ? <HrLinkGrid links={data.links.map((l) => ({ to: l.to, label: l.label, sub: 'ورود به ماژول' }))} /> : null}
    </div>
  );
}
