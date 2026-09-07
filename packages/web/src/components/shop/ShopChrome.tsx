import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { BRAND } from '@petdate/shared';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCatalogSync } from '../../hooks/useShopCatalogSync';
import { NavUserCluster } from '../NavUserCluster';
import { SiteDesktopNav } from '../SiteDesktopNav';
import { SiteFooter } from '../SiteFooter';


export function ShopChrome({
  children,
  bannerTitle = 'پت دیت شاپ',
  bannerLead = 'غذا، لوازم و اسباب‌بازی با قیمت تومان — پت دیت شاپ',
  hideBanner = false,
}: {
  children: ReactNode;
  bannerTitle?: string;
  bannerLead?: string;
  hideBanner?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const { isLoggedIn } = useAuthStore();
  const { ready } = useShopCatalogSync();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('pepito-landing-active');
    document.body.classList.add('pepito-landing-active');
    return () => {
      root.classList.remove('pepito-landing-active');
      document.body.classList.remove('pepito-landing-active');
    };
  }, []);

  return (
    <div className="pepito-landing pepito-flow-page pd-shop-page" dir="rtl">
      <header className={`pepito-nav${scrolled ? ' is-scrolled' : ''}${isLoggedIn ? ' pepito-nav--app' : ''}`}>
        {/* Logo first in DOM so dir=rtl places it at inline-start (right). */}
        <Link to="/" className="pepito-nav-logo" aria-label={BRAND.displayName}>
          <img src="/pepito/img/logo.png" alt={BRAND.displayName} />
        </Link>
        <nav className="pepito-nav-links pepito-nav-links--app" aria-label="پت دیت شاپ">
          <NavLink to="/shop" end>
            فروشگاه
          </NavLink>
          <NavLink to="/shop/orders">سفارش‌ها</NavLink>
          <NavLink to="/shop/cart">سبد</NavLink>
          <NavLink to="/shop/c/dog-food">سگ</NavLink>
          <NavLink to="/shop/c/cat-food">گربه</NavLink>
          <NavLink to="/shop/c/bird-food">پرنده</NavLink>
        </nav>
        <NavUserCluster showCart showOrders />
        <div className="pepito-nav-actions">
          <SiteDesktopNav />
        </div>
      </header>

      {!hideBanner ? (
        <section className="pd-shop-hero pd-shop-hero--full" aria-label={bannerTitle}>
          <img
            className="pd-shop-hero-img"
            src="/media/shop/petdate-shop-hero.jpg"
            alt="پت دیت شاپ — فضای برند فروشگاه حیوانات خانگی"
            width={1536}
            height={1024}
            decoding="async"
            fetchPriority="high"
          />
          <div className="pd-shop-hero-wash" aria-hidden />
          <div className="pd-shop-hero-inner">
            <p className="pd-shop-hero-brand">
              <span className="pepito-kicker-dot" aria-hidden>
                <PawPrint size={16} />
              </span>
              PetDate Shop
            </p>
            <h1>{bannerTitle}</h1>
            {bannerLead ? <p>{bannerLead}</p> : null}
          </div>
        </section>
      ) : null}

      <main className="pd-shop-main" key={ready ? 'shop-live' : 'shop-static'}>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
