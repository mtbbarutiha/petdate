import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch } from '../api';
import { AdminModal } from '../AdminModal';
import { appConfirm } from '../../components/AppDialog';
import { tr } from '../../i18n';

type Supplier = {
  id: number;
  name: string;
  phone: string;
  contactPerson: string;
  addressNotes: string;
  active: boolean;
};

const empty = {
  name: '',
  phone: '',
  contactPerson: '',
  addressNotes: '',
  active: true,
};

export function AdminShopSuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    const data = await adminFetch<{ suppliers: Supplier[] }>('/api/admin/shop/suppliers');
    setRows(data.suppliers || []);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : tr('خطا')));
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/api/admin/shop/suppliers', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/shop/suppliers/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editing.name,
          phone: editing.phone,
          contactPerson: editing.contactPerson,
          addressNotes: editing.addressNotes,
          active: editing.active,
        }),
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Supplier) => {
    const ok = await appConfirm(tr('حذف تأمین‌کننده؟ اگر سند خرید داشته باشد فقط غیرفعال می‌شود.'));
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/shop/suppliers/${row.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('تأمین‌کنندگان')}</h1>
          <p>{tr('فهرست تأمین‌کننده برای ثبت خرید. روی فاکتور فقط از همین فهرست انتخاب می‌شود.')}</p>
        </div>
        <Link className="admin-btn admin-btn--ghost" to="/admin/shop/warehouse">{tr('انبار')}</Link>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-card" style={{ padding: 16 }}>
        <h2>{tr('تأمین‌کننده جدید')}</h2>
        <form className="admin-form-grid" onSubmit={(e) => void create(e)}>
          <label>
            {tr('نام تأمین‌کننده')}
            <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            {tr('تلفن')}
            <input className="admin-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
          </label>
          <label>
            {tr('شخص رابط')}
            <input className="admin-input" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </label>
          <label>
            {tr('آدرس و یادداشت')}
            <input className="admin-input" value={form.addressNotes} onChange={(e) => setForm({ ...form, addressNotes: e.target.value })} />
          </label>
          <label className="admin-check-line">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            {tr('فعال')}
          </label>
          <div>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره')}</button>
          </div>
        </form>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('نام')}</th>
                <th>{tr('تلفن')}</th>
                <th>{tr('شخص رابط')}</th>
                <th>{tr('آدرس و یادداشت')}</th>
                <th>{tr('وضعیت')}</th>
                <th>{tr('عملیات')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.contactPerson || '—'}</td>
                  <td>{row.addressNotes || '—'}</td>
                  <td>{row.active ? tr('فعال') : tr('غیرفعال')}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing({ ...row })}>{tr('ویرایش')}</button>
                    {' '}
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void remove(row)}>{tr('حذف')}</button>
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={6} className="admin-muted">{tr('هنوز تأمین‌کننده‌ای ثبت نشده')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <AdminModal
        open={Boolean(editing)}
        title={tr('ویرایش تأمین‌کننده')}
        onClose={() => setEditing(null)}
        as="form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveEdit();
        }}
        busy={busy}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditing(null)}>{tr('انصراف')}</button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ذخیره تغییرات')}</button>
          </>
        }
      >
        {editing ? (
          <div className="admin-form-grid">
            <label>
              {tr('نام تأمین‌کننده')}
              <input className="admin-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </label>
            <label>
              {tr('تلفن')}
              <input className="admin-input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </label>
            <label>
              {tr('شخص رابط')}
              <input className="admin-input" value={editing.contactPerson} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
            </label>
            <label>
              {tr('آدرس و یادداشت')}
              <input className="admin-input" value={editing.addressNotes} onChange={(e) => setEditing({ ...editing, addressNotes: e.target.value })} />
            </label>
            <label className="admin-check-line">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
              {tr('فعال')}
            </label>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
