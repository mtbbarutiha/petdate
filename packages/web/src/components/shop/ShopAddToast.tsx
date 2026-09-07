import { Link } from 'react-router-dom';
import { Check, ShoppingCart, X } from 'lucide-react';
import { useShopCart } from '../../hooks/useShopCart';

/** گوشهٔ صفحه — تأیید افزودن به سبد */
export function ShopAddToast() {
  const { addToast, dismissAddToast } = useShopCart();
  if (!addToast) return null;

  const qtyLabel =
    addToast.qty > 1 ? ` ×${addToast.qty.toLocaleString('fa-IR')}` : '';

  return (
    <div className="pd-shop-add-toast" role="status" aria-live="polite">
      <div className="pd-shop-add-toast-inner">
        <span className="pd-shop-add-toast-check" aria-hidden>
          <Check size={16} strokeWidth={2.6} />
        </span>
        {addToast.image ? (
          <img className="pd-shop-add-toast-thumb" src={addToast.image} alt="" />
        ) : (
          <span className="pd-shop-add-toast-thumb pd-shop-add-toast-thumb--empty" aria-hidden>
            <ShoppingCart size={16} />
          </span>
        )}
        <div className="pd-shop-add-toast-copy">
          <strong>به سبد اضافه شد{qtyLabel}</strong>
          <span>{addToast.title}</span>
        </div>
        <Link to="/shop/cart" className="pd-shop-add-toast-cart" onClick={dismissAddToast}>
          سبد
        </Link>
        <button
          type="button"
          className="pd-shop-add-toast-close"
          aria-label="بستن"
          onClick={dismissAddToast}
        >
          <X size={14} strokeWidth={2.4} aria-hidden />
        </button>
      </div>
    </div>
  );
}
