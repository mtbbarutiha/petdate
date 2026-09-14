import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Filter, PawPrint, ShoppingBag, Sparkles } from 'lucide-react';
import {
  SHOP_CATEGORIES,
  SHOP_PET_TYPES,
  SHOP_PRICE_MAX,
  categoriesForPet,
  getBestsellingProducts,
  getHomeRailProducts,
  type ShopPetType,
} from '../../data/shopCatalog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopHomeRail } from '../../components/shop/ShopHomeRail';
import { ShopTopBrands } from '../../components/shop/ShopTopBrands';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';

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

/** Bestseller pet pills (catalog has no aquatics species). */
const BESTSELLER_PETS: { id: ShopPetType; labelFa: string; labelEn: string }[] = [
  { id: 'all', labelFa: 'همه', labelEn: 'All' },
  { id: 'cat', labelFa: 'گربه', labelEn: 'Cat' },
  { id: 'dog', labelFa: 'سگ', labelEn: 'Dog' },
  { id: 'bird', labelFa: 'پرندگان', labelEn: 'Birds' },
  { id: 'rodent', labelFa: 'سایر جوندگان', labelEn: 'Other rodents' },
];

export function ShopHomePage() {
  const { lang, t } = useI18n();
  const platform = usePlatformConfig();
  const [petType, setPetType] = useState<ShopPetType>('all');
  const [bestsellerPet, setBestsellerPet] = useState<ShopPetType>('all');
  const [catPill, setCatPill] = useState('all');
  const [dogPill, setDogPill] = useState('all');
  const cats = useMemo(() => categoriesForPet(petType), [petType]);

  const catCategoryPills = useMemo(() => {
    const list = categoriesForPet('cat');
    return [
      { id: 'all', label: 'همه' },
      ...list.map((c) => ({ id: c.slug, label: shopLabel(lang, c.labelFa, c.labelEn) })),
    ];
  }, [lang]);

  const dogCategoryPills = useMemo(() => {
    const list = categoriesForPet('dog');
    return [
      { id: 'all', label: 'همه' },
      ...list.map((c) => ({ id: c.slug, label: shopLabel(lang, c.labelFa, c.labelEn) })),
    ];
  }, [lang]);

  const bestsellers = useMemo(
    () => getBestsellingProducts(bestsellerPet, 12),
    [bestsellerPet]
  );
  const catRailProducts = useMemo(
    () =>
      getHomeRailProducts({
        pet: 'cat',
        categorySlug: catPill === 'all' ? null : catPill,
        limit: 12,
      }),
    [catPill]
  );
  const dogRailProducts = useMemo(
    () =>
      getHomeRailProducts({
        pet: 'dog',
        categorySlug: dogPill === 'all' ? null : dogPill,
        limit: 12,
      }),
    [dogPill]
  );

  if (!platform.shopEnabled) {
    return (
      <ShopChrome bannerTitle="پت دیت شاپ" bannerLead={t('platform.shopOff')}>
        <div className="pepito-container pd-shop-home">
          <p className="pd-platform-banner">{t('platform.shopOff')}</p>
        </div>
      </ShopChrome>
    );
  }

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
                onClick={() => {
                  // Toggle: re-click active chip → «همه»
                  if (petType === t.id && t.id !== 'all') setPetType('all');
                  else setPetType(t.id);
                }}
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

        <ShopTopBrands />

        <ShopHomeRail
          title="پرفروش‌ترین‌های پت"
          viewAllTo="/shop/c/all"
          testId="shop-home-bestsellers"
          pills={BESTSELLER_PETS.map((p) => ({
            id: p.id,
            label: shopLabel(lang, p.labelFa, p.labelEn),
          }))}
          activePillId={bestsellerPet}
          onPillChange={(id) => setBestsellerPet(id as ShopPetType)}
          products={bestsellers}
        />

        <ShopHomeRail
          title="دسته‌بندی‌های گربه"
          viewAllTo="/shop/c/all?pet=cat"
          testId="shop-home-cat-rail"
          pills={catCategoryPills}
          activePillId={catPill}
          onPillChange={setCatPill}
          products={catRailProducts}
        />

        <ShopHomeRail
          title="دسته‌بندی‌های سگ"
          viewAllTo="/shop/c/all?pet=dog"
          testId="shop-home-dog-rail"
          pills={dogCategoryPills}
          activePillId={dogPill}
          onPillChange={setDogPill}
          products={dogRailProducts}
        />

        <p className="pd-shop-meta-note">
          محدوده قیمت کاتالوگ تا {SHOP_PRICE_MAX.toLocaleString('fa-IR')} تومان ·{' '}
          {SHOP_CATEGORIES.length.toLocaleString('fa-IR')} دسته
        </p>
      </div>
    </ShopChrome>
  );
}
