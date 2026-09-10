import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { adminFetch, formatNumFa } from '../api';
import { AdminModal } from '../AdminModal';

type Ann = {
  id: number;
  title: string;
  body: string;
  active: boolean;
  placement: string;
  createdAt: string;
};

export function AdminContentPage() {
  const [items, setItems] = useState<Ann[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', placement: 'landing', active: true });

  const load = useCallback(async () => {
    try {
      const data = await adminFetch<{ announcements: Ann[] }>('/api/admin/content/announcements');
      setItems(data.announcements);
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
      await adminFetch('/api/admin/content/announcements', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ title: '', body: '', placement: 'landing', active: true });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: Ann) => {
    try {
      await adminFetch(`/api/admin/content/announcements/${a.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...a, active: !a.active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('حذف اعلان؟')) return;
    try {
      await adminFetch(`/api/admin/content/announcements/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>محتوا و اعلان‌ها</h1>
          <p>اسنیپت‌های لندینگ / بنر — {formatNumFa(items.length)} مورد</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => {
            setForm({ title: '', body: '', placement: 'landing', active: true });
            setOpen(true);
          }}
        >
          <Plus size={16} /> اعلان جدید
        </button>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}

      <div className="admin-table-wrap admin-card" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>عنوان</th>
              <th>جایگاه</th>
              <th>وضعیت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.title}</strong>
                  <div className="admin-muted">{a.body.slice(0, 80)}</div>
                </td>
                <td>{a.placement}</td>
                <td>
                  <span className={`admin-badge ${a.active ? 'admin-badge--info' : 'admin-badge--error'}`}>
                    {a.active ? 'فعال' : 'خاموش'}
                  </span>
                </td>
                <td>
                  <div className="admin-row-actions">
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void toggle(a)}>
                      {a.active ? 'خاموش' : 'روشن'}
                    </button>
                    <button type="button" className="admin-btn admin-btn--danger" onClick={() => void remove(a.id)}>
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={4} className="admin-muted">
                  اعلانی نیست
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminModal
        open={open}
        title="اعلان جدید"
        onClose={() => !busy && setOpen(false)}
        size="md"
        as="form"
        onSubmit={(e) => void save(e)}
        busy={busy}
        footer={
          <>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
              انتشار
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => setOpen(false)}>
              انصراف
            </button>
          </>
        }
      >
        <label>
          <span className="form-label">عنوان</span>
          <input
            className="form-input"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">متن</span>
          <textarea
            className="form-input"
            rows={3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <label>
          <span className="form-label">جایگاه</span>
          <select
            className="admin-select"
            value={form.placement}
            onChange={(e) => setForm({ ...form, placement: e.target.value })}
          >
            <option value="landing">لندینگ</option>
            <option value="shop">فروشگاه</option>
            <option value="app">اپ</option>
            <option value="bot">ربات</option>
          </select>
        </label>
      </AdminModal>
    </div>
  );
}
