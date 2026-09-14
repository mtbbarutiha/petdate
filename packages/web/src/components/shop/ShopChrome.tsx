import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PawPrint } from 'lucide-react';
import { PageHelpLink } from '../PageHelpLink';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useShopCatalogSync } from '../../hooks/useShopCatalogSync';
import { useI18n } from '../../i18n';
import { SiteHeader } from '../SiteHeader';
import { SiteFooter } from '../SiteFooter';
import { ShopAddToast } from './ShopAddToast';
import { ShopProductSearch } from './ShopProductSearch';

export function ShopChrome({
  children,
  bannerTitle,
  bannerLead,
  hideBanner = false,
}: {
  children: ReactNode;
  bannerTitle?: string;
  bannerLead?: string;
  hideBanner?: boolean;
}) {
  const { t, dir } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const { isLoggedIn } = useAuthStore();
  const { ready } = useShopCatalogSync();
  const title = bannerTitle ?? t('shop.brand');
  const lead = bannerLead ?? t('shop.lead');
  const pageRef = useRef<HTMLDivElement>(null);

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

  useLayoutEffect(() => {
    const page = pageRef.current;
    const nav = page?.querySelector<HTMLElement>('.pepito-nav');
    if (!page || !nav) return;
    const apply = () => {
      const h = Math.ceil(nav.getBoundingClientRect().height);
      page.style.setProperty('--pepito-nav-h', `${Math.max(h, 56)}px`);
      const fixed = getComputedStyle(nav).position === 'fixed';
      page.classList.toggle('pd-shop-page--fixed-nav', fixed);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(nav);
    window.addEventListener('resize', apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);

  return (
    <div
      ref={pageRef}
      className="pepito-landing pepito-landing--with-dock pepito-flow-page pd-shop-page"
      dir={dir}
    >
      <SiteHeader
        scrolled={scrolled}
        className={`pepito-nav--shop${isLoggedIn ? ' pepito-nav--app' : ''}`}
        showDesktopNav={false}
        showMobileEvents={false}
        showCart
        showOrders
        brandBelow={<ShopProductSearch />}
      />

      {!hideBanner ? (
        <section className="pd-shop-hero pd-shop-hero--full" aria-label={title}>
          <img
            className="pd-shop-hero-img"
            src="/media/shop/petdate-shop-hero.jpg"
            alt={t('shop.brandSpace')}
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
            <h1>{title}</h1>
            {lead ? <p>{lead}</p> : null}
            <PageHelpLink section="shop" className="pepito-page-help-link--hero" />
          </div>
        </section>
      ) : null}

      <main className="pd-shop-main" data-shop-catalog={ready ? 'live' : 'static'}>
        {children}
      </main>

      <ShopAddToast />
      <SiteFooter />
    </div>
  );
}
