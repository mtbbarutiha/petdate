import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { HrIncomeModel } from '@petdate/shared';
import { HR_INCOME_MODEL_TYPES } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';
import { HrKpiGrid } from './HrUi';

export function AdminHrCompensationPage() {
  const [models, setModels] = useState<HrIncomeModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: HR_INCOME_MODEL_TYPES[0] as string,
    variableAmount: '0',
    variablePercent: '0',
  });
  const canWrite = adminCan('hr.write');
  const load = useCallback(async () => {
    try {
      const res = await adminFetch<{ incomeModels: HrIncomeModel[] }>('/api/admin/hr/settings/income-models');
      setModels(res.incomeModels); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !form.name.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/settings/income-models', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          variableAmount: Number(form.variableAmount) || 0,
          variablePercent: Number(form.variablePercent) || 0,
        }),
      });
      setOpen(false);
      setForm({ name: '', type: HR_INCOME_MODEL_TYPES[0], variableAmount: '0', variablePercent: '0' });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>جبران خدمت (مدل درآمدی)</h1><p>درصد متغیر جایگزین کمیسیون قرارداد می‌شود</p></div>
        {canWrite ? <button type="button" className="admin-btn" onClick={() => setOpen(true)}>+ مدل جدید</button> : null}
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

      <AdminModal
        open={open}
        title="مدل درآمدی جدید"
        onClose={() => setOpen(false)}
        as="form"
        onSubmit={(e) => void add(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>انصراف</button>
          </>
        }
      >
        <label>
          <span className="form-label">نام مدل</span>
          <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          <span className="form-label">نوع</span>
          <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {HR_INCOME_MODEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span className="form-label">مبلغ ثابت</span>
          <input className="form-input" dir="ltr" value={form.variableAmount} onChange={(e) => setForm({ ...form, variableAmount: e.target.value })} />
        </label>
        <label>
          <span className="form-label">درصد متغیر</span>
          <input className="form-input" dir="ltr" value={form.variablePercent} onChange={(e) => setForm({ ...form, variablePercent: e.target.value })} />
        </label>
      </AdminModal>
    </div>
  );
}
