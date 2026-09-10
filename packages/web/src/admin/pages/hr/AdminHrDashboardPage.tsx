import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch, formatNumFa } from '../../api';
import { AdminEntityCell, AdminThumb } from '../../AdminThumb';
import { HrKpiGrid, HrLinkGrid, formatHrMoney } from './HrUi';

type Dash = {
  kpis: {
    personnel: number; activeAccess: number; inactiveAccess: number; cockpitTasks: number;
    serviceHoursMonth: number; orgCostMonth: number; unreadNotifications: number;
    openRequests: number; openOnboarding: number;
  };
  links: Array<{ to: string; label: string }>;
  recentLogs: Array<{ personName: string; avatarUrl?: string; field: string; oldValue: string; newValue: string; date: string }>;
  cockpitPreview: Array<{ type: string; employeeName?: string; detail: string }>;
};

export function AdminHrDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setData(await adminFetch<Dash>('/api/admin/hr/dashboard')); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const k = data?.kpis;
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>پیوند · داشبورد منابع انسانی</h1><p>نمای کلی پرسنل، هزینه، کارتابل و دسترسی‌ها</p></div>
        <div className="admin-header-actions">
          <Link to="/admin/hr/recruitment" className="admin-btn admin-btn--ghost">داشبورد جذب</Link>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {k ? <HrKpiGrid items={[
        { label: 'کل پرسنل', value: k.personnel, tone: 'mint' },
        { label: 'دسترسی فعال', value: k.activeAccess, tone: 'sky' },
        { label: 'دسترسی غیرفعال', value: k.inactiveAccess, tone: 'orange' },
        { label: 'وظایف کارتابل', value: k.cockpitTasks, tone: 'violet' },
        { label: 'ساعت فعالیت این ماه', value: k.serviceHoursMonth, tone: 'slate' },
        { label: 'هزینه سازمانی ماه', value: formatHrMoney(k.orgCostMonth), tone: 'mint' },
        { label: 'درخواست‌های باز', value: k.openRequests, tone: 'orange' },
        { label: 'آنبوردینگ باز', value: k.openOnboarding, tone: 'sky' },
      ]} /> : null}
      {data ? <HrLinkGrid links={data.links.map((l) => ({ to: l.to, label: l.label, sub: 'باز کردن ماژول' }))} /> : null}
      <div className="admin-settings-grid" style={{ marginTop: 16 }}>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>کارتابل (پیش‌نمایش)</h2>
          {data?.cockpitPreview?.length ? (
            <ul className="admin-log-list">{data.cockpitPreview.map((t, i) => (
              <li key={i}><b>{t.type}</b>{t.employeeName ? ` · ${t.employeeName}` : ''}<div className="admin-muted">{t.detail}</div></li>
            ))}</ul>
          ) : <p className="admin-muted">وظیفه‌ای نیست</p>}
          <Link to="/admin/hr/cockpit">مشاهده کارتابل کامل →</Link>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>آخرین تغییرات ({formatNumFa(data?.recentLogs.length || 0)})</h2>
          {data?.recentLogs?.length ? (
            <ul className="admin-log-list">{data.recentLogs.map((l, i) => (
              <li key={i}>
                <AdminEntityCell
                  thumb={<AdminThumb src={l.avatarUrl} label={l.personName} kind="user" size={28} />}
                  title={<b>{l.personName}</b>}
                  subtitle={`${l.field}: ${l.oldValue || '—'} ← ${l.newValue || '—'}`}
                />
              </li>
            ))}</ul>
          ) : <p className="admin-muted">هنوز تغییری ثبت نشده</p>}
        </article>
      </div>
    </div>
  );
}
