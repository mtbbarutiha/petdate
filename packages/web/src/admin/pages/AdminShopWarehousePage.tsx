import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminModal } from '../AdminModal';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { tr } from '../../i18n';

type ProductOpt = { id: string; title: string };
type Supplier = {
  id: number;
  name: string;
  phone: string;
  contactPerson: string;
  addressNotes: string;
  active: boolean;
};
type Purchase = {
  id: number;
  productId: string;
  productTitle: string;
  qty: number;
  unitCostToman: number;
  supplier: string;
  supplierId: number | null;
  purchasedAt: string;
  note: string;
};
type Stock = {
  productId: string;
  productTitle: string;
  purchasedQty: number;
  soldQty: number;
  onHand: number;
  unitCostToman: number;
};
type Profit = {
  revenueToman: number;
  cogsToman: number;
  profitToman: number;
  purchaseCount: number;
  purchaseSpendToman: number;
};

function toDateInput(value: string): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function SupplierPicker({
  suppliers,
  value,
  onChange,
}: {
  suppliers: Supplier[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = suppliers.find((s) => String(s.id) === value) || null;
  const options = suppliers.filter((s) => s.active || String(s.id) === value);
  return (
    <div className="admin-supplier-picker">
      <select
        className="admin-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={tr('تأمین‌کننده')}
        required
      >
        <option value="">{tr('انتخاب تأمین‌کننده')}</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}{s.active ? '' : ` (${tr('غیرفعال')})`}
          </option>
        ))}
      </select>
      {selected ? (
        <p className="admin-muted admin-supplier-meta">
          {tr('تلفن')}: {selected.phone || '—'} · {tr('شخص رابط')}: {selected.contactPerson || '—'}
        </p>
      ) : null}
    </div>
  );
}

export function AdminShopWarehousePage() {
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [editQty, setEditQty] = useState('1');
  const [editUnit, setEditUnit] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<{
      products: ProductOpt[];
      purchases: Purchase[];
      stock: Stock[];
      profit: Profit;
      suppliers?: Supplier[];
    }>('/api/admin/shop/warehouse');
    setProducts(data.products || []);
    setPurchases(data.purchases || []);
    setStock(data.stock || []);
    setSuppliers(data.suppliers || []);
    setProfit(data.profit);
    setProductId((cur) => cur || data.products?.[0]?.id || '');
    setSupplierId((cur) => cur || String(data.suppliers?.find((s) => s.active)?.id || ''));
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : tr('خطا')));
  }, [load]);

  const activeCount = useMemo(() => suppliers.filter((s) => s.active).length, [suppliers]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/api/admin/shop/purchases', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          qty: Number(qty),
          unitCostToman: Number(unitCost),
          supplierId: Number(supplierId),
          purchasedAt: purchasedAt || undefined,
          note,
        }),
      });
      setQty('1');
      setUnitCost('');
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('خطا'));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: Purchase) => {
    setEditing(row);
    setEditQty(String(row.qty));
    setEditUnit(String(row.unitCostToman));
    setEditSupplierId(row.supplierId ? String(row.supplierId) : '');
    setEditDate(toDateInput(row.purchasedAt));
    setEditNote(row.note || '');
    setError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/shop/purchases/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          qty: Number(editQty),
          unitCostToman: Number(editUnit),
          supplierId: Number(editSupplierId),
          purchasedAt: editDate || undefined,
          note: editNote,
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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('انبار / خرید از تأمین‌کننده')}</h1>
          <p>{tr('بهای تمام‌شده از خرید واقعی است، نه فقط قیمت فروش.')}</p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-btn admin-btn--ghost" to="/admin/shop/suppliers">{tr('تأمین‌کنندگان')}</Link>
          <Link className="admin-btn admin-btn--ghost" to="/admin/finance#event-revenue">{tr('مالی')}</Link>
        </div>
      </header>
      {error ? <p className="admin-error">{error}</p> : null}
      {profit ? (
        <div className="admin-stats admin-stats--dense">
          <div className="admin-stat admin-stat--mint">
            <div className="admin-stat-value">{formatTomanFa(profit.profitToman)}</div>
            <div className="admin-stat-label">{tr('سود فروشگاه')}</div>
          </div>
          <div className="admin-stat admin-stat--sky">
            <div className="admin-stat-value">{formatTomanFa(profit.revenueToman)}</div>
            <div className="admin-stat-label">{tr('درآمد سفارش‌های پرداخت‌شده')}</div>
          </div>
          <div className="admin-stat admin-stat--orange">
            <div className="admin-stat-value">{formatTomanFa(profit.cogsToman)}</div>
            <div className="admin-stat-label">{tr('بهای خرید (COGS)')}</div>
          </div>
          <div className="admin-stat admin-stat--slate">
            <div className="admin-stat-value">{formatNumFa(profit.purchaseCount)}</div>
            <div className="admin-stat-label">{tr('سند خرید')}</div>
          </div>
        </div>
      ) : null}

      <section className="admin-card" style={{ marginTop: 16, padding: 16 }}>
        <h2>{tr('ثبت خرید')}</h2>
        {!activeCount ? (
          <p className="admin-muted">
            {tr('اول یک تأمین‌کننده فعال بسازید.')}{' '}
            <Link to="/admin/shop/suppliers">{tr('تأمین‌کنندگان')}</Link>
          </p>
        ) : null}
        <form
          className="admin-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <select className="admin-select" value={productId} onChange={(e) => setProductId(e.target.value)} aria-label={tr('محصول')}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <input className="admin-input" inputMode="numeric" placeholder={tr('تعداد')} value={qty} onChange={(e) => setQty(e.target.value)} required />
          <input className="admin-input" inputMode="numeric" placeholder={tr('بهای واحد (تومان)')} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required />
          <SupplierPicker suppliers={suppliers} value={supplierId} onChange={setSupplierId} />
          <input className="admin-input" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} aria-label={tr('تاریخ')} />
          <input className="admin-input" placeholder={tr('یادداشت')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || !supplierId}>{tr('ثبت خرید')}</button>
        </form>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <header className="admin-header"><h2>{tr('موجودی')}</h2></header>
        <p className="admin-muted" style={{ padding: '0 12px' }}>{tr('موجودی = خریدها منهای سفارش‌های ارسال‌شده یا تکمیل‌شده.')}</p>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('محصول')}</th>
                <th>{tr('خرید')}</th>
                <th>{tr('خروج')}</th>
                <th>{tr('موجودی')}</th>
                <th>{tr('بهای واحد')}</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.productId}>
                  <td>{row.productTitle}</td>
                  <td>{formatNumFa(row.purchasedQty)}</td>
                  <td>{formatNumFa(row.soldQty)}</td>
                  <td>{formatNumFa(row.onHand)}</td>
                  <td>{formatTomanFa(row.unitCostToman)}</td>
                </tr>
              ))}
              {!stock.length ? <tr><td colSpan={5} className="admin-muted">{tr('هنوز خریدی ثبت نشده')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 16 }}>
        <header className="admin-header"><h2>{tr('اسناد خرید')}</h2></header>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>{tr('تاریخ')}</th>
                <th>{tr('محصول')}</th>
                <th>{tr('تعداد')}</th>
                <th>{tr('بهای واحد')}</th>
                <th>{tr('تأمین‌کننده')}</th>
                <th>{tr('عملیات')}</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((row) => (
                <tr key={row.id}>
                  <td>{formatAdminFaDateTime(row.purchasedAt)}</td>
                  <td>{row.productTitle}</td>
                  <td>{formatNumFa(row.qty)}</td>
                  <td>{formatTomanFa(row.unitCostToman)}</td>
                  <td>{row.supplier}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => openEdit(row)}>
                      {tr('ویرایش')}
                    </button>
                  </td>
                </tr>
              ))}
              {!purchases.length ? <tr><td colSpan={6} className="admin-muted">{tr('سندی نیست')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <AdminModal
        open={Boolean(editing)}
        title={tr('ویرایش سند خرید')}
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
            <p className="admin-muted" style={{ gridColumn: '1 / -1', margin: 0 }}>{editing.productTitle}</p>
            <label>
              {tr('تعداد')}
              <input className="admin-input" inputMode="numeric" value={editQty} onChange={(e) => setEditQty(e.target.value)} required />
            </label>
            <label>
              {tr('بهای واحد (تومان)')}
              <input className="admin-input" inputMode="numeric" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} required />
            </label>
            <label>
              {tr('تأمین‌کننده')}
              <SupplierPicker suppliers={suppliers} value={editSupplierId} onChange={setEditSupplierId} />
            </label>
            <label>
              {tr('تاریخ')}
              <input className="admin-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </label>
            <label>
              {tr('یادداشت')}
              <input className="admin-input" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
            </label>
          </div>
        ) : null}
      </AdminModal>
    </div>
  );
}
