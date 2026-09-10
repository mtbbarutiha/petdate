import { useCallback, useEffect, useState } from 'react';
import type { HrIncomeModel } from '@petdate/shared';
import { HR_INCOME_MODEL_TYPES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { HrKpiGrid } from './HrUi';

export function AdminHrCompensationPage() {
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models');
      setModels(res.incomeModels); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!canWrite) return;
    const name = window.prompt('نام مدل');
    if (!name?.trim()) return;
    const type = window.prompt(`نوع (${HR_INCOME_MODEL_TYPES.join(' | ')})`, HR_INCOME_MODEL_TYPES[0]) || HR_INCOME_MODEL_TYPES[0];
    const variableAmount = Number(window.prompt('مبلغ ثابت', '0') || 0);
    const variablePercent = Number(window.prompt('درصد متغیر', '0') || 0);
    try {
      await adminFetch('/api/admin/hr/settings/income-models', { method: 'POST', body: JSON.stringify({ name: name.trim(), type, variableAmount, variablePercent }) });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>جبران خدمت (مدل درآمدی)</h1><p>درصد متغیر جایگزین کمیسیون قرارداد می‌شود</p></div>
        {canWrite ? <button type="button" className="admin-btn" onClick={() => void add()}>+ مدل جدید</button> : null}
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <HrKpiGrid items={[{ label: 'مدل‌ها', value: models.length, tone: 'mint' }]} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>نام</th><th>نوع</th><th>ثابت</th><th>درصد</th><th></th></tr></thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td><td>{m.type}</td><td>{formatNumFa(m.variableAmount)}</td><td>{formatNumFa(m.variablePercent)}٪</td>
                <td>{canWrite ? <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void adminFetch(`/api/admin/hr/settings/income-models/${m.id}`, { method: 'DELETE' }).then(load)}>حذف</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
