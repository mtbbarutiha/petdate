import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { SHOP_CATEGORIES, SHOP_PRODUCTS } from '../../data/shopCatalog';
import { adminFetch, formatNumFa, formatTomanFa } from '../api';
import { AdminShopProductFormModal } from './AdminShopProductFormPage';

type Product = {
  id: string; slug: string; title: string; brandId: string; categorySlug: string;
  priceToman: number; inStock: boolean; stockQty: number; featured: boolean; image?: string;
};

export function AdminShopProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalProductId, setModalProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const data = await adminFetch<{ products: Product[] }>(`/api/admin/shop/products${qs}`);
      setProducts(data.products); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  }, [q]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setModalProductId('new');
      navigate('/admin/shop/products', { replace: true });
      return;
    }
    const edit = searchParams.get('edit');
    if (edit) {
      setModalProductId(edit);
      navigate('/admin/shop/products', { replace: true });
    }
  }, [searchParams, navigate]);

  const syncCatalog = async () => {
    if (!confirm('کاتالوگ وب روی دیتابیس بازنویسی شود؟')) return;
    setBusy(true); setMsg(null);
    try {
      const result = await adminFetch<{ products: number; categories: number }>('/api/admin/shop/catalog/sync', {
        method: 'POST',
        body: JSON.stringify({
          products: SHOP_PRODUCTS.map((prod) => ({ ...prod, stockQty: prod.inStock ? 25 : 0 })),
          categories: SHOP_CATEGORIES,
        }),
      });
      setMsg(`همگام‌سازی: ${formatNumFa(result.products)} محصول، ${formatNumFa(result.categories)} دسته`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف محصول؟')) return;
    try { await adminFetch(`/api/admin/shop/products/${id}`, { method: 'DELETE' }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'خطا'); }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div><h1>محصولات فروشگاه</h1><p>{formatNumFa(products.length)} مورد — هم‌تراز کاتالوگ شاپ</p></div>
        <div className="admin-header-actions">
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy} onClick={() => void syncCatalog()}>
            <RefreshCw size={16} /> سینک از کاتالوگ وب
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => setModalProductId('new')}>
            <Plus size={16} /> محصول جدید
          </button>
        </div>
      </header>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={16} /><input placeholder="جستجو…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button type="button" className="admin-btn" onClick={() => void load()}>جستجو</button>
      </div>
      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? <p className="admin-success">{msg}</p> : null}
      {!products.length ? <section className="admin-card admin-empty-hint"><p>محصولی در DB نیست — «سینک از کاتالوگ وب» را بزنید.</p></section> : null}
      <div className="admin-table-wrap admin-card"><table className="admin-table">
        <thead><tr><th>عکس</th><th>عنوان</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th></th></tr></thead>
        <tbody>
          {products.map((prod) => (
            <tr key={prod.id}>
              <td>{prod.image ? <img src={prod.image} alt="" className="admin-thumb" /> : '—'}</td>
              <td>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  style={{ padding: 0, border: 'none', background: 'transparent', font: 'inherit' }}
                  onClick={() => setModalProductId(prod.id)}
                >
                  <strong>{prod.title}</strong>
                </button>
                <div className="admin-mono">{prod.slug}</div>
              </td>
              <td>{prod.categorySlug}</td>
              <td>{formatTomanFa(prod.priceToman)}</td>
              <td>{prod.inStock ? <span className="admin-badge admin-badge--info">{formatNumFa(prod.stockQty)}</span> : <span className="admin-badge admin-badge--error">ناموجود</span>}</td>
              <td>
                <div className="admin-row-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setModalProductId(prod.id)}>ویرایش</button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => void remove(prod.id)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <AdminShopProductFormModal
        open={modalProductId != null}
        productId={modalProductId}
        onClose={() => setModalProductId(null)}
        onSaved={() => { void load(); }}
      />
    </div>
  );
}
