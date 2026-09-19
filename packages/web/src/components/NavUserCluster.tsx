import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { useShopCart } from '../hooks/useShopCart';
import { IconCart, IconLogin, IconPackage } from './icons/ChromeIcons';

const ProfileMenu = lazy(() => import('./ProfileMenu').then((m) => ({ default: m.ProfileMenu })));
const WalletChip = lazy(() => import('./WalletChip').then((m) => ({ default: m.WalletChip })));

/**
 * Top-bar account tools pinned to physical CSS left (LTR cluster):
 * circular profile avatar → wallet → orders → guest login → cart → (lang/theme outside).
 * Guest login sits immediately left of cart (same circular chip as cart).
 * Mobile keeps the avatar (wallet stays in the dock) so the account menu works on every page.
 */
export function NavUserCluster({
  showCart = true,
  showOrders = false,
}: { showCart?: boolean; showOrders?: boolean } = {}) {
  const { isLoggedIn } = useAuthStore();
  const { itemCount } = useShopCart();
  const { lang } = useI18n();
  const loginLabel = lang === 'en' ? 'Login' : 'ورود';

  return (
    <div className="pepito-nav-user-cluster" role="group" aria-label="حساب و خرید">
      {isLoggedIn ? (
        <Suspense fallback={null}>
          <ProfileMenu />
          <WalletChip />
        </Suspense>
      ) : null}
      {showOrders ? (
        <Link
          to="/shop/orders"
          className="pepito-nav-cart-link pepito-nav-orders-link"
          aria-label="سفارش‌های من"
          title="سفارش‌های من"
        >
          <IconPackage />
        </Link>
      ) : null}
      {!isLoggedIn ? (
        <Link
          to="/auth/login"
          className="pepito-nav-cart-link pepito-nav-login-icon"
          data-testid="nav-login-icon"
          aria-label={loginLabel}
          title={loginLabel}
        >
          <IconLogin />
        </Link>
      ) : null}
      {showCart ? (
        <Link
          to="/shop/cart"
          className="pepito-nav-cart-link pd-shop-cart-link"
          data-shop-cart-target
          aria-label={itemCount > 0 ? `سبد خرید (${itemCount})` : 'سبد خرید'}
        >
          <IconCart />
          {itemCount > 0 ? (
            <span className="pepito-nav-cart-count">{itemCount.toLocaleString('fa-IR')}</span>
          ) : null}
        </Link>
      ) : null}
    </div>
  );
}
