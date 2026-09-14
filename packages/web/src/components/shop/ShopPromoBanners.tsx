import { Link } from 'react-router-dom';

const BANNERS = [
  {
    id: 'for-your-pet',
    to: '/shop/c/all',
    kicker: 'پت‌دیت شاپ',
    title: 'برای پت شما',
    lead: 'غذا، بهداشت و لوازم روزمره — انتخاب‌شده برای پت‌دیت',
    className: 'pd-shop-promo-banner--groom',
    image: '/media/shop/promo-for-your-pet.jpg',
    imageAlt: 'گربه در حال آراستگی در پت‌دیت شاپ',
  },
  {
    id: 'fits-your-pet',
    to: '/shop/c/all',
    kicker: 'پت‌دیت',
    title: 'مناسب پت شما',
    lead: 'حمل، سفر و خانه — با خیال راحت از پت‌دیت سفارش بده',
    className: 'pd-shop-promo-banner--travel',
    image: '/media/shop/promo-fits-your-pet.jpg',
    imageAlt: 'سگ آماده سفر با پت‌دیت شاپ',
  },
] as const;

/** Two branded RTL promo tiles between bestsellers and cat categories. */
export function ShopPromoBanners() {
  return (
    <section className="pd-shop-promo-banners" aria-label="پیشنهادهای پت‌دیت" data-testid="shop-promo-banners">
      {BANNERS.map((b) => (
        <Link key={b.id} to={b.to} className={`pd-shop-promo-banner ${b.className}`}>
          <img className="pd-shop-promo-banner-photo" src={b.image} alt={b.imageAlt} width={960} height={540} loading="lazy" decoding="async" />
          <span className="pd-shop-promo-banner-wash" aria-hidden />
          <span className="pd-shop-promo-banner-mark" aria-hidden>
            PetDate
          </span>
          <span className="pd-shop-promo-banner-copy">
            <span className="pd-shop-promo-banner-kicker">{b.kicker}</span>
            <strong>{b.title}</strong>
            <span>{b.lead}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
