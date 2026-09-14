import { Link } from 'react-router-dom';
import { PawPrint } from 'lucide-react';

const BANNERS = [
  {
    id: 'for-your-pet',
    to: '/shop/c/all',
    kicker: 'پت‌دیت شاپ',
    title: 'برای پت شما',
    lead: 'غذا، بهداشت و لوازم روزمره — انتخاب‌شده برای پت‌دیت',
    className: 'pd-shop-promo-banner--groom',
  },
  {
    id: 'fits-your-pet',
    to: '/shop/c/all',
    kicker: 'پت‌دیت',
    title: 'مناسب پت شما',
    lead: 'حمل، سفر و خانه — با خیال راحت از پت‌دیت سفارش بده',
    className: 'pd-shop-promo-banner--travel',
  },
] as const;

/** Two branded RTL promo tiles between bestsellers and cat categories. */
export function ShopPromoBanners() {
  return (
    <section className="pd-shop-promo-banners" aria-label="پیشنهادهای پت‌دیت" data-testid="shop-promo-banners">
      {BANNERS.map((b) => (
        <Link key={b.id} to={b.to} className={`pd-shop-promo-banner ${b.className}`}>
          <span className="pd-shop-promo-banner-wash" aria-hidden />
          <span className="pd-shop-promo-banner-copy">
            <span className="pd-shop-promo-banner-kicker">
              <PawPrint size={14} strokeWidth={2.4} aria-hidden />
              {b.kicker}
            </span>
            <strong>{b.title}</strong>
            <span>{b.lead}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
