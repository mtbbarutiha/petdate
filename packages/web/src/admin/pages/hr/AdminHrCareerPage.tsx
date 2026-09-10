import { useCallback, useEffect, useState } from 'react';
import type { HrBenefitDef, HrCareerLayer } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';

export function AdminHrCareerPage() {
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [benefits, setBenefits] = useState<HrBenefitDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const [l, b] = await Promise.all([
        adminFetch<{ careerLayers: HrCareerLayer[] }>('/api/admin/hr/settings/layers'),
        adminFetch<{ benefitDefs: HrBenefitDef[] }>('/api/admin/hr/settings/benefits'),
      ]);
      setLayers(l.careerLayers); setBenefits(b.benefitDefs); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>مسیر شغلی و مزایا</h1><p>لایه‌ها و موتور واجدشرایطی مزایا</p></div>
        <div className="admin-header-actions">
          {canWrite ? (
            <>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => {
                const name = window.prompt('نام لایه'); if (!name?.trim()) return;
                const unlocks = window.prompt('باز می‌شود:') || '';
                void adminFetch('/api/admin/hr/settings/layers', { method: 'POST', body: JSON.stringify({ name: name.trim(), unlocks, sortOrder: layers.length }) }).then(load);
              }}>+ لایه</button>
              <button type="button" className="admin-btn" onClick={() => {
                const title = window.prompt('عنوان مزیت'); if (!title?.trim()) return;
                const category = window.prompt('دسته') || '';
                const cost = Number(window.prompt('هزینه', '0') || 0);
                void adminFetch('/api/admin/hr/settings/benefits', { method: 'POST', body: JSON.stringify({ title: title.trim(), category, cost }) }).then(load);
              }}>+ مزیت</button>
            </>
          ) : null}
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-settings-grid">
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>لایه‌ها ({formatNumFa(layers.length)})</h2>
          <ul className="admin-log-list">{layers.map((l) => <li key={l.id}><b>{formatNumFa(l.sortOrder)}. {l.name}</b><div className="admin-muted">{l.unlocks}</div></li>)}</ul>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>مزایا ({formatNumFa(benefits.length)})</h2>
          <ul className="admin-log-list">{benefits.map((b) => <li key={b.id}><b>{b.title}</b> · {b.category || 'عمومی'}<div className="admin-muted">هزینه: {formatNumFa(b.cost)}</div></li>)}</ul>
        </article>
      </div>
    </div>
  );
}
