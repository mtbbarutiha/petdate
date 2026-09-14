import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { AdminModal } from '../AdminModal';
import { appConfirm } from '../../components/AppDialog';
import { tr } from '../../i18n';

type Brand = {
  id: string;
  labelFa: string;
  labelEn?: string;
  logoUrl?: string;
  sortOrder: number;
  featured: boolean;
  active: boolean;
};

const emptyForm = {
  id: '',
  labelFa: '',
  labelEn: '',
  logoUrl: '',
  sortOrder: 100,
  featured: false,
  active: true,
};

export function AdminShopBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ brands: Brand[] }>('/api/admin/shop/brands');
      setBrands(data.brands);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminFetch('/api/admin/shop/brands', {
        method: 'POST',
        body: JSON.stringify({
          id: form.id.trim(),
          labelFa: form.labelFa.trim(),
          labelEn: form.labelEn.trim() || undefined,
          logoUrl: form.logoUrl.trim() || undefined,
          sortOrder: Number(form.sortOrder) || 100,
          featured: Boolean(form.featured),
          active: Boolean(form.active),
        }),
      });
      setForm(emptyForm);
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const edit = (b: Brand) => {
    setForm({
      id: b.id,
      labelFa: b.labelFa,
      labelEn: b.labelEn ?? '',
      logoUrl: b.logoUrl ?? '',
      sortOrder: b.sortOrder,
      featured: b.featured,
      active: b.active,
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!(await appConfirm(`${tr('حذف ')}${id}${tr('؟')}`, { danger: true, variant: 'admin' }))) return;
    try {
      await adminFetch(`/api/admin/shop/brands/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('برندهای فروشگاه')}</h1>
          <p>
            {formatNumFa(brands.length)} {tr('برند')}
          </p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => {
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus size={16} /> {tr('افزودن برند')}
        </button>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      <div className="admin-table-wrap admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{tr('لوگو')}</th>
              <th>{tr('عنوان')}</th>
              <th>id</th>
              <th>{tr('برتر')}</th>
              <th>{tr('فعال')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.logoUrl ? (
                    <img
                      src={b.logoUrl}
                      alt=""
                      style={{ width: 48, height: 32, objectFit: 'contain' }}
                    />
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {b.labelFa}
                  {b.labelEn ? <span className="admin-muted"> · {b.labelEn}</span> : null}
                </td>
                <td className="admin-mono">{b.id}</td>
                <td>{b.featured ? '✓' : '—'}</td>
                <td>{b.active ? '✓' : '—'}</td>
                <td className="admin-row-actions">
                  <button type="button" className="admin-btn" onClick={() => edit(b)}>
                    {tr('ویرایش')}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => void remove(b.id)}
                  >
                    {tr('حذف')}
                  </button>
                </td>
              </tr>
            ))}
            {!brands.length ? (
              <tr>
                <td colSpan={6} className="admin-muted">
                  {tr('برندی نیست — از کاتالوگ وب سینک کنید')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={open}
        title={form.id && brands.some((b) => b.id === form.id) ? tr('ویرایش برند') : tr('برند جدید')}
        onClose={() => !busy && setOpen(false)}
        size="md"
        as="form"
        onSubmit={(e) => void save(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              {tr('ذخیره')}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {tr('انصراف')}
            </button>
          </>
        }
      >
        <div className="admin-form-grid">
          <label>
            <span className="form-label">id / slug</span>
            <input
              className="form-input"
              dir="ltr"
              required
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">{tr('عنوان فارسی')}</span>
            <input
              className="form-input"
              required
              value={form.labelFa}
              onChange={(e) => setForm({ ...form, labelFa: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">{tr('عنوان انگلیسی')}</span>
            <input
              className="form-input"
              dir="ltr"
              value={form.labelEn}
              onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
            />
          </label>
          <label>
            <span className="form-label">{tr('آدرس لوگو')}</span>
            <input
              className="form-input"
              dir="ltr"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="/shop/brands/example.png"
            />
          </label>
          <label>
            <span className="form-label">{tr('ترتیب')}</span>
            <input
              className="form-input"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            <span>{tr('برند برتر (کاروسل فروشگاه)')}</span>
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>{tr('فعال')}</span>
          </label>
        </div>
      </AdminModal>
    </div>
  );
}
