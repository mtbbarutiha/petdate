import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { HrBenefitDef, HrCareerLayer } from '@petdate/shared';
import { adminFetch, formatNumFa } from '../../api';
import { adminCan } from '../../auth';
import { AdminModal } from '../../AdminModal';

export function AdminHrCareerPage() {
  const [layers, setLayers] = useState<HrCareerLayer[]>([]);
  const [benefits, setBenefits] = useState<HrBenefitDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [layerOpen, setLayerOpen] = useState(false);
  const [benefitOpen, setBenefitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [layerForm, setLayerForm] = useState({ name: '', unlocks: '' });
  const [benefitForm, setBenefitForm] = useState({ title: '', category: '', cost: '0' });
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

  const saveLayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !layerForm.name.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/settings/layers', {
        method: 'POST',
        body: JSON.stringify({ name: layerForm.name.trim(), unlocks: layerForm.unlocks, sortOrder: layers.length }),
      });
      setLayerOpen(false);
      setLayerForm({ name: '', unlocks: '' });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  const saveBenefit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWrite || !benefitForm.title.trim()) return;
    setBusy(true);
    try {
      await adminFetch('/api/admin/hr/settings/benefits', {
        method: 'POST',
        body: JSON.stringify({
          title: benefitForm.title.trim(),
          category: benefitForm.category,
          cost: Number(benefitForm.cost) || 0,
        }),
      });
      setBenefitOpen(false);
      setBenefitForm({ title: '', category: '', cost: '0' });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>مسیر شغلی و مزایا</h1><p>لایه‌ها و موتور واجدشرایطی مزایا</p></div>
        <div className="admin-header-actions">
          {canWrite ? (
            <>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setLayerOpen(true)}>+ لایه</button>
              <button type="button" className="admin-btn" onClick={() => setBenefitOpen(true)}>+ مزیت</button>
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

      <AdminModal open={layerOpen} title="لایه جدید" onClose={() => setLayerOpen(false)} as="form" onSubmit={(e) => void saveLayer(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button><button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setLayerOpen(false)}>انصراف</button></>}>
        <label><span className="form-label">نام لایه</span><input className="form-input" required value={layerForm.name} onChange={(e) => setLayerForm({ ...layerForm, name: e.target.value })} /></label>
        <label><span className="form-label">باز می‌شود</span><input className="form-input" value={layerForm.unlocks} onChange={(e) => setLayerForm({ ...layerForm, unlocks: e.target.value })} /></label>
      </AdminModal>

      <AdminModal open={benefitOpen} title="مزیت جدید" onClose={() => setBenefitOpen(false)} as="form" onSubmit={(e) => void saveBenefit(e)} busy={busy}
        footer={<><button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>ذخیره</button><button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setBenefitOpen(false)}>انصراف</button></>}>
        <label><span className="form-label">عنوان مزیت</span><input className="form-input" required value={benefitForm.title} onChange={(e) => setBenefitForm({ ...benefitForm, title: e.target.value })} /></label>
        <label><span className="form-label">دسته</span><input className="form-input" value={benefitForm.category} onChange={(e) => setBenefitForm({ ...benefitForm, category: e.target.value })} /></label>
        <label><span className="form-label">هزینه</span><input className="form-input" dir="ltr" value={benefitForm.cost} onChange={(e) => setBenefitForm({ ...benefitForm, cost: e.target.value })} /></label>
      </AdminModal>
    </div>
  );
}
