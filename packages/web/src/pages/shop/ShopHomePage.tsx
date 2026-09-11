import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Filter, PawPrint, ShoppingBag, Sparkles } from 'lucide-react';
import {
  SHOP_BRANDS,
  SHOP_CATEGORIES,
  SHOP_PET_TYPES,
  SHOP_PRICE_MAX,
  categoriesForPet,
  getFeaturedProducts,
  type ShopPetType,
} from '../../data/shopCatalog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopProductCard } from '../../components/shop/ShopProductCard';

/** Digikala-style solid circle colors (Pepito-friendly palette) */
const DK_CAT_COLORS = [
  '#0ba5f2',
  '#fd961e',
  '#15cca0',
  '#5c4d91',
  '#db89ca',
  '#1a4d8f',
  '#e85d04',
  '#0c8b6c',
  '#7b2d8e',
  '#c9184a',
  '#2a9d8f',
  '#457b9d',
  '#9b5de5',
  '#f15bb5',
  '#00bbf9',
  '#fee440',
  '#00f5d4',
  '#9b2226',
  '#bc6c25',
  '#386641',
  '#4a4e69',
  '#ef476f',
] as const;

const JOURNEY = [
  {
    step: '۱',
    title: 'انتخاب کن',
    desc: 'نوع پت و دسته‌بندی را مشخص کن',
    Icon: Sparkles,
  },
  {
    step: '۲',
    title: 'فیلتر کن',
    desc: 'برند، قیمت و موجودی را بزن',
    Icon: Filter,
  },
  {
    step: '۳',
    title: 'بخر',
    desc: 'به سبد اضافه کن و ثبت سفارش بده',
    Icon: ShoppingBag,
  },
] as const;

export function ShopHomePage() {
  const { lang } = useI18n();
  const [petType, setPetType] = useState<ShopPetType>('all');
  const featured = useMemo(() => getFeaturedProducts(), []);
  const cats = useMemo(() => categoriesForPet(petType), [petType]);

  return (
    <ShopChrome
      bannerTitle="پت دیت شاپ"
      bannerLead="غذا، لوازم و اسباب‌بازی با فیلتر برند و قیمت — به تومان"
    >
      <div className="pepito-container pd-shop-home">
        <section className="pd-shop-journey" aria-label="مسیر خرید">
          {JOURNEY.map(({ step, title, desc, Icon }) => (
            <div key={step} className="pd-shop-journey-step">
              <span className="pd-shop-journey-num" aria-hidden>
                {step}
              </span>
              <span className="pd-shop-journey-icon" aria-hidden>
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <div className="pd-shop-journey-copy">
                <strong>{title}</strong>
                <span>{desc}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="pd-shop-dk-cats" aria-label="دسته‌بندی‌ها">
          <div className="pd-shop-dk-cats-head">
            <div className="pd-shop-dk-cats-title">
              <span className="pd-shop-dk-cats-icon" aria-hidden>
                <PawPrint size={20} strokeWidth={2.2} />
              </span>
              <div>
                <h2>دسته‌بندی‌ها</h2>
                <p>نوع پت را بزن، بعد دسته را انتخاب کن</p>
              </div>
            </div>
            <Link to="/shop/c/all" className="pd-shop-dk-cats-all">
              مشاهده همه
              <ChevronLeft size={16} strokeWidth={2.4} aria-hidden />
            </Link>
          </div>

          <div className="pd-shop-pet-tabs" role="tablist" aria-label="نوع حیوان">
            {SHOP_PET_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={petType === t.id}
                className={`pd-shop-chip${petType === t.id ? ' is-active' : ''}`}
                onClick={() => setPetType(t.id)}
              >
                {shopLabel(lang, t.labelFa, t.labelEn)}
              </button>
            ))}
          </div>

          <div className="pd-shop-dk-strip" role="list">
            {cats.map((c, i) => (
              <Link
                key={c.slug}
                to={`/shop/c/${c.slug}`}
                className="pd-shop-dk-item"
                role="listitem"
                style={{ ['--dk-cat' as string]: DK_CAT_COLORS[i % DK_CAT_COLORS.length] }}
              >
                <span className="pd-shop-dk-circle" aria-hidden>
                  <span className="pd-shop-dk-emoji">{c.emoji}</span>
                </span>
                <span className="pd-shop-dk-label">{shopLabel(lang, c.labelFa, c.labelEn)}</span>
              </Link>
            ))}
            <Link to="/shop/c/all" className="pd-shop-dk-item pd-shop-dk-item--more" role="listitem">
              <span className="pd-shop-dk-circle" aria-hidden>
                <span className="pd-shop-dk-more-dots">⋯</span>
              </span>
              <span className="pd-shop-dk-label">بیشتر</span>
            </Link>
          </div>
        </section>

        <section className="pd-shop-block">
          <div className="pepito-section-head pepito-section-head--center">
            <p className="pepito-eyebrow">محصولات ویژه</p>
            <h2>پیشنهادهای امروز</h2>
          </div>
          <div className="pd-shop-product-grid">
            {featured.map((p) => (
              <ShopProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="pd-shop-home-cta">
            <Link to="/shop/c/all" className="pepito-btn button-1">
              <span className="pepito-btn-icon" aria-hidden>
                <PawPrint size={16} />
              </span>
              مشاهده همه محصولات
            </Link>
          </div>
        </section>

        <section className="pd-shop-block pd-shop-brands">
          <div className="pepito-section-head pepito-section-head--center">
            <p className="pepito-eyebrow">برند‌های محبوب</p>
            <h2>از برندهای معتبر</h2>
          </div>
          <div className="pd-shop-brand-row">
            {SHOP_BRANDS.map((b) => (
              <Link key={b.id} to={`/shop/c/all?brand=${b.id}`} className="pd-shop-brand-chip">
                {shopLabel(lang, b.labelFa, b.labelEn)}
              </Link>
            ))}
          </div>
          <p className="pd-shop-meta-note">
            محدوده قیمت کاتالوگ تا {SHOP_PRICE_MAX.toLocaleString('fa-IR')} تومان ·{' '}
            {SHOP_CATEGORIES.length.toLocaleString('fa-IR')} دسته
          </p>
        </section>
      </div>
    </ShopChrome>
  );
}
