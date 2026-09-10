import { useCallback, useEffect, useState } from 'react';
import type { HrBenefitDef, HrCareerLayer, HrIncomeModel, HrRequest } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';

export function AdminHrSettingsPage() {
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [benefits, setBenefits] = useState<HrBenefitDef[]>([]);
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, m, b, r] = await Promise.all([
        adminFetch<{ careerLayers: HrCareerLayer[] }>('/api/admin/hr/settings/layers'),
        adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models'),
        adminFetch<{ benefitDefs: HrBenefitDef[] }>('/api/admin/hr/settings/benefits'),
        adminFetch<{ requests: HrRequest[] }>('/api/admin/hr/requests'),
      ]);
      setLayers(l.careerLayers);
      setModels(m.incomeModels);
      setBenefits(b.benefitDefs);
      setRequests(r.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>تنظیمات HR · پیوند</h1>
          <p>لایه‌های شغلی، مدل درآمد، مزایا و درخواست‌ها (stub قابل گسترش)</p>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-settings-grid">
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>مسیر شغلی ({formatNumFa(layers.length)})</h2>
          <ul className="admin-log-list">
            {layers.map((l) => (
              <li key={l.id}>
                <b>{l.name}</b>
                <div className="admin-muted">{l.unlocks}</div>
              </li>
            ))}
          </ul>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>مدل درآمد ({formatNumFa(models.length)})</h2>
          <ul className="admin-log-list">
            {models.map((m) => (
              <li key={m.id}>
                <b>{m.name}</b> · {m.type}
                <div className="admin-muted">
                  ثابت: {formatNumFa(m.variableAmount)} · درصد: {m.variablePercent}%
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>مزایا ({formatNumFa(benefits.length)})</h2>
          <ul className="admin-log-list">
            {benefits.map((b) => (
              <li key={b.id}>
                <b>{b.title}</b> · {b.category}
                <div className="admin-muted">هزینه: {formatNumFa(b.cost)}</div>
              </li>
            ))}
          </ul>
        </article>
        <article className="admin-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>
            درخواست‌های کارکنان ({formatNumFa(requests.length)})
          </h2>
          {requests.length === 0 ? (
            <p className="admin-muted">هنوز درخواستی نیست — جداول آماده است</p>
          ) : (
            <ul className="admin-log-list">
              {requests.map((r) => (
                <li key={r.id}>
                  #{r.id} · {r.type} · {r.status}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
