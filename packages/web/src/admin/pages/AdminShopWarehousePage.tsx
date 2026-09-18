import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { formatAdminFaDateTime } from '../JalaliDateSelect';
import { tr } from '../../i18n';

type ProductOpt = { id: string; title: string };
type Purchase = {
  id: number;
  productId: string;
  productTitle: string;
  qty: number;
  unitCostToman: number;
  supplier: string;
  purchasedAt: string;
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

export function AdminShopWarehousePage() {
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const data = await adminFetch<{
      products: ProductOpt[];
      purchases: Purchase[];
      stock: Stock[];
      profit: Profit;
    }>('/api/admin/shop/warehouse');
    setProducts(data.products || []);
    setPurchases(data.purchases || []);
    setStock(data.stock || []);
    setProfit(data.profit);
    setProductId((cur) => cur || data.products?.[0]?.id || '');
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : tr('خطا')));
  }, [load]);

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
          supplier,
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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{tr('انبار / خرید از تأمین‌کننده')}</h1>
          <p>{tr('بهای تمام‌شده از خرید واقعی است، نه فقط قیمت فروش.')}</p>
        </div>
        <Link className="admin-btn admin-btn--ghost" to="/admin/finance#event-revenue">{tr('مالی')}</Link>
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
          <input className="admin-input" placeholder={tr('تأمین‌کننده')} value={supplier} onChange={(e) => setSupplier(e.target.value)} required />
          <input className="admin-input" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} aria-label={tr('تاریخ')} />
          <input className="admin-input" placeholder={tr('یادداشت')} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{tr('ثبت خرید')}</button>
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
                </tr>
              ))}
              {!purchases.length ? <tr><td colSpan={5} className="admin-muted">{tr('سندی نیست')}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
