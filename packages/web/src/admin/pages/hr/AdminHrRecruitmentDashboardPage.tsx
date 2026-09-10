import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HrCandidate, HrJobOpening } from '@petdate/shared';
import { adminFetch } from '../../api';
import { HrKpiGrid, HrLinkGrid } from './HrUi';

type Dash = {
  kpis: { openJobs: number; totalOpenings: number; candidates: number; hired: number; onboardingActive: number; pipelineInterview: number; pipelineOffer: number; talentBank: number };
  byStage: Record<string, number>;
  links: Array<{ to: string; label: string }>;
  recentCandidates: HrCandidate[];
  openings: HrJobOpening[];
};

export function AdminHrRecruitmentDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await adminFetch<Dash>('/api/admin/hr/recruitment/dashboard')); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const k = data?.kpis;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>داشبورد جذب و استخدام</h1><p>قیف متقاضیان، فرصت‌های باز و شروع به کار</p></div>
        <div className="admin-header-actions">
          <Link to="/admin/hr" className="admin-btn admin-btn--ghost">داشبورد HR</Link>
          <Link to="/admin/hr/ats" className="admin-btn">ATS</Link>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {k ? <HrKpiGrid items={[
        { label: 'آگهی باز', value: k.openJobs, tone: 'mint' },
        { label: 'کل فرصت‌ها', value: k.totalOpenings, tone: 'slate' },
        { label: 'متقاضیان', value: k.candidates, tone: 'sky' },
        { label: 'استخدام‌شده', value: k.hired, tone: 'violet' },
        { label: 'آنبوردینگ فعال', value: k.onboardingActive, tone: 'orange' },
        { label: 'در مصاحبه', value: k.pipelineInterview, tone: 'sky' },
        { label: 'پیشنهاد شغلی', value: k.pipelineOffer, tone: 'mint' },
        { label: 'بانک استعداد', value: k.talentBank, tone: 'slate' },
      ]} /> : null}
      {data ? <HrLinkGrid links={data.links.map((l) => ({ to: l.to, label: l.label, sub: 'ورود به ماژول' }))} /> : null}
      <div className="admin-settings-grid" style={{ marginTop: 16 }}>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>توزیع مراحل</h2>
          <ul className="admin-log-list">
            {Object.entries(data?.byStage || {}).map(([stage, n]) => <li key={stage}><b>{stage}</b> · {n}</li>)}
          </ul>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>آخرین متقاضیان</h2>
          <ul className="admin-log-list">
            {(data?.recentCandidates || []).map((c) => <li key={c.id}><b>{c.firstName} {c.lastName}</b> · {c.stage}</li>)}
          </ul>
        </article>
      </div>
    </div>
  );
}
