import { useI18n } from '../../i18n';
import { shopLabel } from '../../lib/shopLocale';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, PawPrint } from 'lucide-react';
import {
  SHOP_CATEGORIES,
  SHOP_PRICE_MAX,
  categoriesForPet,
  getBestsellingProducts,
  getHomeRailProducts,
  type ShopPetType,
} from '../../data/shopCatalog';
import { ShopChrome } from '../../components/shop/ShopChrome';
import { ShopHomeRail } from '../../components/shop/ShopHomeRail';
import { ShopPromoBanners } from '../../components/shop/ShopPromoBanners';
import { ShopRailNavButtons } from '../../components/shop/ShopRailNavButtons';
import { ShopTopBrands } from '../../components/shop/ShopTopBrands';
import { ShopCategoryArt, ShopCategoryMoreArt, shopCategoryArtKind } from '../../components/shop/shopCategoryIcons';
import { useShopRailNav } from '../../components/shop/useShopRailNav';
import { usePlatformConfig } from '../../hooks/usePlatformConfig';

/** Bestseller pet pills (catalog has no aquatics species). */
const BESTSELLER_PETS: { id: ShopPetType; labelFa: string; labelEn: string }[] = [
  { id: 'all', labelFa: 'همه', labelEn: 'All' },
  { id: 'cat', labelFa: 'گربه', labelEn: 'Cat' },
  { id: 'dog', labelFa: 'سگ', labelEn: 'Dog' },
  { id: 'bird', labelFa: 'پرندگان', labelEn: 'Birds' },
  { id: 'rodent', labelFa: 'سایر جوندگان', labelEn: 'Other rodents' },
];

function ShopCategoryStrip() {
  const { lang } = useI18n();
  const cats = useMemo(() => categoriesForPet('all'), []);
  const { trackRef, canLeft, canRight, scrollBySide } = useShopRailNav(cats.length);

  return (
    <section className="pd-shop-dk-cats" aria-label="دسته‌بندی‌ها">
      <div className="pd-shop-dk-cats-head">
        <div className="pd-shop-dk-cats-title">
          <span className="pd-shop-dk-cats-icon" aria-hidden>
            <PawPrint size={20} strokeWidth={2.2} />
          </span>
          <div>
            <h2>دسته‌بندی‌ها</h2>
            <p>دسته‌بندی را انتخاب کن</p>
          </div>
        </div>
        <Link to="/shop/c/all" className="pd-shop-dk-cats-all">
          مشاهده همه
          <ChevronLeft size={16} strokeWidth={2.4} aria-hidden />
        </Link>
      </div>

      <div className="pd-shop-dk-strip-frame">
        <div className="pd-shop-dk-strip" role="list" ref={trackRef} tabIndex={0}>
          {cats.map((c) => {
            const kind = shopCategoryArtKind(c.slug);
            return (
              <Link
                key={c.slug}
                to={`/shop/c/${c.slug}`}
                className="pd-shop-dk-item"
                role="listitem"
              >
                <span className={`pd-shop-dk-tile pd-shop-dk-tile--art pd-shop-dk-tile--${kind}`} aria-hidden>
                  <ShopCategoryArt kind={kind} />
                </span>
                <span className="pd-shop-dk-label">{shopLabel(lang, c.labelFa, c.labelEn)}</span>
              </Link>
            );
          })}
          <Link to="/shop/c/all" className="pd-shop-dk-item pd-shop-dk-item--more" role="listitem">
            <span className="pd-shop-dk-tile pd-shop-dk-tile--art pd-shop-dk-tile--more" aria-hidden>
              <ShopCategoryMoreArt />
            </span>
            <span className="pd-shop-dk-label">بیشتر</span>
          </Link>
        </div>
        <ShopRailNavButtons
          canLeft={canLeft}
          canRight={canRight}
          onLeft={() => scrollBySide('left')}
          onRight={() => scrollBySide('right')}
          leftLabel="دسته‌بندی‌های بیشتر"
          rightLabel="دسته‌بندی‌های قبلی"
        />
      </div>
    </section>
  );
}

export function ShopHomePage() {
  const { lang, t } = useI18n();
  const platform = usePlatformConfig();
  const [bestsellerPet, setBestsellerPet] = useState<ShopPetType>('all');
  const [catPill, setCatPill] = useState('all');
  const [dogPill, setDogPill] = useState('all');

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
        <ShopCategoryStrip />

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

        <ShopPromoBanners />

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
