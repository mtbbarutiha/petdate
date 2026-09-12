import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import { adminFetch } from '../../api';
import { AdminFunnelChart } from '../../FinanceCharts';
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
  funnel?: ChartRow[];
  links: Array<{ to: string; label: string }>;
  recentCandidates: HrCandidate[];
  openings: HrJobOpening[];
};

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
    if (data?.funnel?.length) return data.funnel;
    if (data?.stageChart?.length) return data.stageChart;
    return Object.entries(data?.byStage || {})
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const funnelPoints = stageRows.map((r) => ({ label: r.name, value: r.count }));

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
            <h2>قیف مراحل جذب</h2>
            <span className="admin-muted">از متقاضی جدید تا استخدام</span>
          </div>
          <div className="hr-dash-chart admin-chart-box">
            {funnelPoints.length ? (
              <AdminFunnelChart points={funnelPoints} />
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
                · <span className="admin-pill">{c.stage}</span>
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
