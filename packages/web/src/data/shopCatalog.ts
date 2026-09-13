/**
 * PetDate shop catalog — Pepito imagery, prices in تومان (wallet primary currency).
 * Live catalog is 40 SKUs: p221–p223 (pilots) + p224–p235 (Batch 2) +
 * p250–p274 (Batch-multi Part 1). p236–p249 reserved for Batch 3 (PR #445).
 * Demo p1–p220 were removed so they cannot reappear on deploy.
 */

import { SHOP_BATCH2_PRODUCTS } from './shopBatch2Products';
import { SHOP_BATCH_MULTI_PRODUCTS } from './shopBatchMultiProducts';

const P = '/pepito/uploads';

export type ShopPetType = 'dog' | 'cat' | 'bird' | 'all';

export interface ShopCategory {
  slug: string;
  labelFa: string;
  labelEn?: string;
  petType: Exclude<ShopPetType, 'all'>;
  description: string;
  emoji: string;
}

export interface ShopBrand {
  id: string;
  labelFa: string;
  labelEn?: string;
}

export interface ShopProduct {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  petTypes: Array<Exclude<ShopPetType, 'all'>>;
  /** قیمت فعلی تومان */
  priceToman: number;
  /** قیمت قبل از تخفیف (تومان) — اگر بیشتر از price باشد نشان‌دهنده تخفیف */
  compareAtToman?: number;
  image: string;
  /** گالری تصاویر (Digikala-style) — در صورت خالی بودن از image استفاده می‌شود */
  images?: string[];
  badge?: 'hot' | 'sale' | 'new' | 'limited';
  inStock: boolean;
  /** پارامترهای کارت محصول / جدول مشخصات (وزن، رنگ، سایز، …) */
  params: Record<string, string>;
  description: string;
  featured?: boolean;
  /** فروشنده نمایشی در باکس خرید (مثل دیجی‌کالا) */
  sellerName?: string;
  /** متن گارانتی / اصالت */
  warranty?: string;
  /** امتیاز ۰–۵ */
  rating?: number;
  reviewCount?: number;
  /** بولت‌های کوتاه زیر عنوان */
  highlights?: string[];
  /** عنوان انگلیسی (مثل دیجی‌کالا) */
  titleEn?: string;
  /** کد کالا / SKU */
  sku?: string;
  /** رنگ‌های قابل انتخاب */
  colors?: { labelFa: string; hex: string }[];
  /** سایز / وزن بسته‌بندی */
  sizes?: string[];
  /** توضیح ارسال */
  shippingNote?: string;
  /** شرایط مرجوعی */
  returnPolicy?: string;
  /** امتیاز رضایت از فروشنده ۰–۱۰۰ */
  sellerScore?: number;
  /** نقاط قوت (نظرات) */
  pros?: string[];
  /** نقاط ضعف (نظرات) */
  cons?: string[];
}

export const SHOP_PET_TYPES: { id: ShopPetType; labelFa: string; labelEn: string }[] = [
  { id: 'all', labelFa: 'همه', labelEn: 'All' },
  { id: 'dog', labelFa: 'سگ', labelEn: 'Dog' },
  { id: 'cat', labelFa: 'گربه', labelEn: 'Cat' },
  { id: 'bird', labelFa: 'پرنده', labelEn: 'Bird' },
];

/** Top-level shop categories by pet type */
export const SHOP_CATEGORIES: ShopCategory[] = [
  // —— سگ ——
  { slug: 'dog-food', labelFa: 'غذای سگ', petType: 'dog', description: 'غذای خشک، کنسرو و سوپ سگ', emoji: '🦴' },
  { slug: 'dog-treats', labelFa: 'تشویقی و مکمل غذایی سگ', petType: 'dog', description: 'تشویقی، اسنک و مکمل', emoji: '🍖' },
  { slug: 'dog-grooming', labelFa: 'وسایل بهداشتی سگ', petType: 'dog', description: 'شامپو، برس و نظافت', emoji: '🧴' },
  { slug: 'dog-toys', labelFa: 'اسباب بازی سگ', petType: 'dog', description: 'توپ، لاتکس و اسباب‌بازی تعاملی', emoji: '🎾' },
  { slug: 'dog-bowls', labelFa: 'ظروف و لوازم جانبی سگ', petType: 'dog', description: 'ظرف غذا و آب', emoji: '🥣' },
  { slug: 'dog-carriers-travel', labelFa: 'وسایل حمل و سفر سگ', petType: 'dog', description: 'باکس، کیف و کوله', emoji: '🧳' },
  { slug: 'dog-collars', labelFa: 'قلاده سگ و لوازم جانبی', petType: 'dog', description: 'قلاده، لید و هارنس', emoji: '🦮' },
  { slug: 'dog-clothing', labelFa: 'پوشاک و لباس سگ', petType: 'dog', description: 'لباس و اکسسوری', emoji: '👕' },
  { slug: 'dog-flea-tick', labelFa: 'ضد کک و کنه سگ', petType: 'dog', description: 'پیشگیری از انگل', emoji: '🛡️' },
  { slug: 'dog-beds', labelFa: 'جای خواب سگ', petType: 'dog', description: 'تشک، مت و جای خواب', emoji: '🛏️' },
  // —— گربه ——
  { slug: 'cat-food', labelFa: 'غذای گربه', petType: 'cat', description: 'غذای خشک، کنسرو و پوچ', emoji: '🐟' },
  { slug: 'cat-treats', labelFa: 'تشویقی گربه و مکمل غذایی', petType: 'cat', description: 'تشویقی، بستنی و مکمل', emoji: '🍦' },
  { slug: 'cat-grooming', labelFa: 'لوازم بهداشتی گربه', petType: 'cat', description: 'شامپو، برس و مراقبت', emoji: '🫧' },
  { slug: 'cat-toys', labelFa: 'اسباب بازی گربه', petType: 'cat', description: 'موش، میله و اسباب‌بازی', emoji: '🐭' },
  { slug: 'cat-trees', labelFa: 'درخت گربه و اسکرچر', petType: 'cat', description: 'درخت، اسکرچر و کاندو', emoji: '🌳' },
  { slug: 'cat-bowls', labelFa: 'ظروف و لوازم جانبی گربه', petType: 'cat', description: 'ظرف غذا و آبخوری', emoji: '🍽️' },
  { slug: 'cat-litter', labelFa: 'لوازم دستشویی گربه', petType: 'cat', description: 'خاک، سینی و بیلچه', emoji: '🚽' },
  { slug: 'cat-carriers-travel', labelFa: 'وسایل حمل و سفر گربه', petType: 'cat', description: 'باکس و کوله حمل', emoji: '🎒' },
  { slug: 'cat-beds', labelFa: 'جای خواب گربه', petType: 'cat', description: 'لانه و تشک خواب', emoji: '😺' },
  { slug: 'cat-flea-tick', labelFa: 'ضد کک و کنه گربه', petType: 'cat', description: 'ضد انگل گربه', emoji: '✨' },
  // —— پرنده ——
  { slug: 'bird-food', labelFa: 'غذای پرنده', petType: 'bird', description: 'دان، پلت و مخلوط غذایی', emoji: '🐦' },
  { slug: 'bird-accessories', labelFa: 'لوازم پرنده', petType: 'bird', description: 'قفس، نشیمن و لوازم جانبی', emoji: '🪺' },
];

export const SHOP_BRANDS: ShopBrand[] = [
  { id: 'royal-canin', labelFa: 'رویال کنین', labelEn: 'Royal Canin' },
  { id: 'josera', labelFa: 'جوسرا', labelEn: 'Josera' },
  { id: 'gourmet', labelFa: 'گورمت', labelEn: 'Gourmet' },
  { id: 'reflex', labelFa: 'رفلکس', labelEn: 'Reflex' },
  { id: 'nutripet', labelFa: 'نوتری پت', labelEn: 'Nutri Pet' },
  { id: 'mofeed', labelFa: 'مفید', labelEn: 'MoFeed' },
  { id: 'wellfed', labelFa: 'ولفيد', labelEn: 'Wellfed' },
  { id: 'winston', labelFa: 'وینستون', labelEn: 'Winston' },
  { id: 'red-spring', labelFa: 'رد اسپرینگ', labelEn: 'Red Spring' },
  { id: 'mpets', labelFa: 'ام‌پتس', labelEn: 'MPets' },
  { id: 'hagen', labelFa: 'هاگن', labelEn: 'Hagen' },
  { id: 'petdate', labelFa: 'پت‌دیت', labelEn: 'PetDate' },
  { id: 'mr-cat', labelFa: 'مستر کت', labelEn: 'MR.CAT' },
  { id: 'meocat', labelFa: 'مئوکت', labelEn: 'Meocat' },
  { id: 'afp', labelFa: 'AFP', labelEn: 'AFP' },
  { id: 'dr-clauders', labelFa: 'دکتر کلادرز', labelEn: "Dr.Clauder's" },
  { id: 'wanpy', labelFa: 'ونپی', labelEn: 'Wanpy' },
  { id: 'bioline', labelFa: 'بایولاین', labelEn: 'Bioline' },
  { id: 'bonnest', labelFa: 'بونست', labelEn: 'Bonnest' },
  { id: 'generic', labelFa: 'متفرقه', labelEn: 'Generic' },
  { id: 'petopoli', labelFa: 'پتوپولی', labelEn: 'Petopoli' },
  { id: 'juicer', labelFa: 'جویسر', labelEn: 'Joyser' },
];

/** Live shop catalog — 3 pilots + 12 Batch 2 + 25 Batch-multi Part 1 */
export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'p221',
    slug: 'dog-food-royal-canin-mini-adult-2kg',
    title: 'رویال کنین مینی ادالت ۲ کیلو — سگ بالغ نژاد کوچک',
    titleEn: 'Royal Canin Mini Adult 2kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_881_000,
    image: `${P}/royal-canin-mini-adult-2kg.jpg?v=gallery-v1`,
    images: [
      `${P}/royal-canin-mini-adult-2kg.jpg?v=gallery-v1`,
      `${P}/royal-canin-mini-adult-2kg-2.jpg?v=gallery-v1`,
      `${P}/royal-canin-mini-adult-2kg-3.jpg?v=gallery-v1`,
    ],
    badge: 'new',
    inStock: true,
    sku: '402170',
    params: {
      وزن: '۲ کیلوگرم',
      کد: '402170',
      مناسب_برای: 'سگ بالغ نژاد کوچک ۱–۱۰ کیلو',
      سن: 'حدود ۱۰ ماه تا ۸ سال',
      کشور_برند: 'فرانسه',
      نوع_غذا: 'خشک',
    },
    description:
      'برای سگ بالغ نژاد کوچک که هم باید خوش‌خوراک باشد، هم سبک روی معده. فرمول Mini Adult کمک می‌کند وزن متعادل بماند و پوست و مو بهتر به نظر برسد.\n\nسگ نژاد کوچک معمولاً بدغذاست و سریع هم چاق می‌شود. Mini Adult برای سگ بالغ حدود ۱ تا ۱۰ کیلو، تقریباً از ۱۰ ماهگی تا ۸ سالگی. دانه‌ها برای پوزه کوچک راحت‌ترند و به کاهش تجمع جرم کمک می‌کنند. ال‌کارنیتین برای کمک به حفظ وزن متعادل، امگا ۳ برای پوست و مو. جایگزین تجویز دامپزشک نیست.\n\n• مناسب سگ بالغ نژاد کوچک (حدود ۱–۱۰ کیلو)، تقریباً ۱۰ ماه تا ۸ سال\n• خوش‌خوراک برای سگ‌های بدغذا\n• ال‌کارنیتین برای کمک به حفظ وزن متعادل\n• امگا ۳ برای پوست و مو و کمک به کاهش تجمع جرم دندان\n• هضم نسبتاً آسان\n\n— پت دیت شاپ.',
    featured: true,
    sellerName: 'پت‌دیت شاپ',
    warranty: 'ضمانت اصالت و سلامت فیزیکی کالا',
    highlights: [
      'مناسب سگ بالغ نژاد کوچک حدود ۱–۱۰ کیلو',
      'خوش‌خوراک برای سگ‌های بدغذا',
      'ال‌کارنیتین برای کمک به حفظ وزن متعادل',
    ],
  },
  {
    id: 'p222',
    slug: 'dog-food-royal-canin-xsmall-puppy-1-5kg',
    title: 'رویال کنین ایکس‌اسمال پاپی ۱٫۵ کیلو — توله نژاد خیلی کوچک',
    titleEn: 'Royal Canin X-Small Puppy 1.5kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_294_000,
    image: `${P}/royal-canin-xsmall-puppy-1.5kg.jpg?v=gallery-v1`,
    images: [
      `${P}/royal-canin-xsmall-puppy-1.5kg.jpg?v=gallery-v1`,
      `${P}/royal-canin-xsmall-puppy-1.5kg-2.jpg?v=gallery-v1`,
      `${P}/royal-canin-xsmall-puppy-1.5kg-3.jpg?v=gallery-v1`,
    ],
    badge: 'new',
    inStock: true,
    sku: '29436',
    params: {
      وزن: '۱٫۵ کیلوگرم',
      کد: '29436',
      مناسب_برای: 'توله خیلی کوچک تا ۴ کیلو بالغ',
      سن: '۲–۱۰ ماهگی',
      کشور_برند: 'فرانسه',
      نوع_غذا: 'خشک',
    },
    description:
      'دانه خیلی کوچک برای توله نژادهای ریز (وزن بالغ تا حدود ۴ کیلو)، از حدود ۲ تا ۱۰ ماهگی. انرژی بالا، رشد استخوان و عضله، پشتیبانی ایمنی.\n\nمخصوص توله‌ای که وزن بالغش حدود ۴ کیلو یا کمتر می‌ماند. دانه خیلی کوچک، انرژی متناسب متابولیسم بالا، آنتی‌اکسیدان برای کمک به ایمنی، امگا ۳ و ۶ برای پوست و مو. تعویض غذا تدریجی و با دامپزشک اگر لازم است.\n\n• مخصوص توله نژاد خیلی کوچک، حدود ۲–۱۰ ماهگی\n• دانه خیلی کوچک، مناسب پوزه ریز\n• انرژی متناسب با متابولیسم بالای این نژادها\n• پشتیبانی از رشد استخوان و عضله\n• آنتی‌اکسیدان برای کمک به ایمنی + امگا ۳ و ۶ برای پوست و مو\n\n— پت دیت شاپ.',
    featured: true,
    sellerName: 'پت‌دیت شاپ',
    warranty: 'ضمانت اصالت و سلامت فیزیکی کالا',
    highlights: [
      'مخصوص توله نژاد خیلی کوچک، حدود ۲–۱۰ ماهگی',
      'دانه خیلی کوچک، مناسب پوزه ریز',
      'پشتیبانی از رشد استخوان و عضله',
    ],
  },
  {
    id: 'p223',
    slug: 'cat-food-royal-canin-persian-adult-400g',
    title: 'رویال کنین پرشین ادالت ۴۰۰ گرم — گربه پرشین بالغ',
    titleEn: 'Royal Canin Persian Adult 400g',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 2_742_000,
    image: `${P}/royal-canin-persian-adult-400g.jpg?v=gallery-v1`,
    images: [
      `${P}/royal-canin-persian-adult-400g.jpg?v=gallery-v1`,
      `${P}/royal-canin-persian-adult-400g-2.jpg?v=gallery-v1`,
      `${P}/royal-canin-persian-adult-400g-3.jpg?v=gallery-v1`,
    ],
    badge: 'new',
    inStock: true,
    sku: '704107',
    params: {
      وزن: '۴۰۰ گرم',
      کد: '704107',
      مناسب_برای: 'گربه پرشین بالغ از حدود ۱۲ ماهگی',
      سن: 'از حدود ۱۲ ماهگی',
      کشور_برند: 'فرانسه',
      نوع_غذا: 'خشک',
    },
    description:
      'برای پرشین بالغ از ۱۲ ماه به بالا. دانه بادامی‌شکل؛ کمک به کاهش گلوله مو، سلامت پوشش بلند، گوارش آرام‌تر.\n\nمخصوص صورت پهن و موی بلند پرشین. دانه بادامی برای برداشتن راحت‌تر، فیبر برای کمک به عبور مو، پشتیبانی پوست و مو. بسته ۴۰۰ گرم مناسب تست سلیقه. اگر مشکل گوارشی/ادراری دارد فقط غذا کافی نیست.\n\n• مخصوص گربه پرشین بالغ، از حدود ۱۲ ماهگی\n• دانه بادامی‌شکل، مناسب صورت پهن\n• کمک به عبور مو از گوارش و کاهش گلوله مو\n• پشتیبانی از سلامت پوست و موی بلند\n• توجه به گوارش و کیفیت مدفوع\n\n— پت دیت شاپ.',
    featured: true,
    sellerName: 'پت‌دیت شاپ',
    warranty: 'ضمانت اصالت و سلامت فیزیکی کالا',
    highlights: [
      'مخصوص گربه پرشین بالغ، از حدود ۱۲ ماهگی',
      'دانه بادامی‌شکل، مناسب صورت پهن',
      'کمک به عبور مو و کاهش گلوله مو',
    ],
  },
  ...SHOP_BATCH2_PRODUCTS,
  ...SHOP_BATCH_MULTI_PRODUCTS,
];

export function formatToman(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} تومان`;
}

export function formatShopCoins(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} سکه`;
}

export function formatShopStars(amount: number): string {
  return `${amount.toLocaleString('fa-IR')} ستاره`;
}

/** Live catalog cache — hydrated from /api/shop (same DB as bot). Falls back to static seed. */
let liveProducts: ShopProduct[] = SHOP_PRODUCTS;
let liveCategories: ShopCategory[] = SHOP_CATEGORIES;
let liveHydrated = false;

export function isShopCatalogHydrated(): boolean {
  return liveHydrated;
}

export function getLiveProducts(): ShopProduct[] {
  return liveProducts;
}

export function getLiveCategories(): ShopCategory[] {
  return liveCategories;
}

/**
 * Merge API/DB rows onto the static Pepito catalog so prices/stock stay in sync
 * while keeping rich product media for the web UI.
 */
function imagesFromShopParams(params?: Record<string, string> | null): string[] {
  const raw = params?.__images;
  if (!raw) return [];
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

function publicShopParams(params: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([k]) => !k.startsWith('__')));
}

export function applyLiveShopCatalog(input: {
  products: Array<{
    id: string;
    slug: string;
    title: string;
    brandId: string;
    categorySlug: string;
    petTypes?: string[];
    priceToman: number;
    compareAtToman?: number;
    image?: string;
    images?: string[];
    badge?: string;
    inStock: boolean;
    stockQty?: number;
    params?: Record<string, string>;
    description?: string;
    featured?: boolean;
    titleEn?: string;
  }>;
  categories?: Array<{
    slug: string;
    labelFa: string;
    petType: string;
    description?: string;
    emoji?: string;
  }>;
}): void {
  const byId = new Map(SHOP_PRODUCTS.map((p) => [p.id, p]));
  const bySlug = new Map(SHOP_PRODUCTS.map((p) => [p.slug, p]));

  liveProducts = input.products.map((api) => {
    const base = byId.get(api.id) ?? bySlug.get(api.slug);
    const petTypes = (api.petTypes?.length
      ? api.petTypes
      : base?.petTypes ?? ['dog']) as Array<'dog' | 'cat' | 'bird'>;
    const badge =
      api.badge === 'hot' || api.badge === 'sale' || api.badge === 'new' || api.badge === 'limited'
        ? api.badge
        : base?.badge;
    const fromApiImages = Array.isArray(api.images) && api.images.length
      ? api.images.map((s) => String(s ?? '').trim()).filter(Boolean)
      : imagesFromShopParams(api.params);
    // List payloads sometimes send only the cover. Keep catalog images[]
    // whenever the API gallery is thinner than the static 3-angle set.
    const mergedImages =
      fromApiImages.length >= 2
        ? fromApiImages
        : base?.images?.length
          ? base.images
          : fromApiImages.length
            ? fromApiImages
            : undefined;
    const strippedParams = api.params ? publicShopParams(api.params) : {};
    const params = Object.keys(strippedParams).length ? strippedParams : (base?.params ?? {});
    if (base) {
      return {
        ...base,
        title: api.title || base.title,
        brandId: api.brandId || base.brandId,
        categorySlug: api.categorySlug || base.categorySlug,
        petTypes,
        priceToman: api.priceToman,
        compareAtToman: api.compareAtToman ?? base.compareAtToman,
        image: api.image || base.image,
        images: mergedImages ?? base.images,
        badge,
        inStock: api.inStock,
        params,
        description: api.description || base.description,
        featured: api.featured ?? base.featured,
        slug: api.slug || base.slug,
        titleEn: api.titleEn || base.titleEn,
      };
    }
    return {
      id: api.id,
      slug: api.slug,
      title: api.title,
      brandId: api.brandId,
      categorySlug: api.categorySlug,
      petTypes,
      priceToman: api.priceToman,
      compareAtToman: api.compareAtToman,
      image: api.image || '/pepito/img/logo.png',
      images: mergedImages,
      badge,
      inStock: api.inStock,
      params,
      description: api.description ?? '',
      featured: Boolean(api.featured),
      titleEn: api.titleEn,
    };
  });

  if (input.categories?.length) {
    const staticBySlug = new Map(SHOP_CATEGORIES.map((c) => [c.slug, c]));
    liveCategories = input.categories.map((c) => {
      const base = staticBySlug.get(c.slug);
      const petType = (c.petType === 'cat' || c.petType === 'bird' ? c.petType : 'dog') as
        | 'dog'
        | 'cat'
        | 'bird';
      return {
        slug: c.slug,
        labelFa: c.labelFa || base?.labelFa || c.slug,
        petType,
        description: c.description || base?.description || '',
        emoji: c.emoji || base?.emoji || '🛒',
      };
    });
  }

  liveHydrated = true;
}

export function productDiscountPercent(p: ShopProduct): number | null {
  if (!p.compareAtToman || p.compareAtToman <= p.priceToman) return null;
  return Math.round(((p.compareAtToman - p.priceToman) / p.compareAtToman) * 100);
}

/** گالری محصول — images[] + params.__images + تصویر اصلی، بدون تکرار و بدون مسیر خالی */
export function productGallery(p: ShopProduct): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(p.images ?? []), ...imagesFromShopParams(p.params), p.image]) {
    const src = String(raw ?? '').trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out;
}

export function productSellerName(p: ShopProduct): string {
  return p.sellerName?.trim() || 'پت‌دیت شاپ';
}

export function productWarranty(p: ShopProduct): string {
  return p.warranty?.trim() || 'اصالت و سلامت فیزیکی کالا';
}

export function productRating(p: ShopProduct): { rating: number; count: number } {
  return {
    rating: p.rating != null && p.rating > 0 ? Math.min(5, p.rating) : 4.6,
    count: p.reviewCount != null && p.reviewCount >= 0 ? p.reviewCount : 128,
  };
}

export function productSellerScore(p: ShopProduct): number {
  if (p.sellerScore != null && p.sellerScore >= 0) return Math.min(100, Math.round(p.sellerScore));
  return 94;
}

export function productShippingNote(p: ShopProduct): string {
  return p.shippingNote?.trim() || 'ارسال از انبار پت‌دیت — تحویل ۱ تا ۳ روز کاری';
}

export function productReturnPolicy(p: ShopProduct): string {
  return p.returnPolicy?.trim() || '۷ روز ضمانت بازگشت کالا';
}

export function getCategory(slug: string): ShopCategory | undefined {
  return liveCategories.find((c) => c.slug === slug) ?? SHOP_CATEGORIES.find((c) => c.slug === slug);
}

export function getBrand(id: string): ShopBrand | undefined {
  return SHOP_BRANDS.find((b) => b.id === id);
}

export function getProduct(idOrSlug: string): ShopProduct | undefined {
  return (
    liveProducts.find((p) => p.id === idOrSlug || p.slug === idOrSlug) ??
    SHOP_PRODUCTS.find((p) => p.id === idOrSlug || p.slug === idOrSlug)
  );
}

export function getFeaturedProducts(): ShopProduct[] {
  const featured = liveProducts.filter((p) => p.featured);
  return featured.length ? featured : SHOP_PRODUCTS.filter((p) => p.featured);
}

export function categoriesForPet(pet: ShopPetType): ShopCategory[] {
  const cats = liveCategories.length ? liveCategories : SHOP_CATEGORIES;
  const used = new Set((liveProducts.length ? liveProducts : SHOP_PRODUCTS).map((p) => p.categorySlug));
  const withProducts = cats.filter((c) => used.has(c.slug));
  if (pet === 'all') return withProducts;
  return withProducts.filter((c) => c.petType === pet);
}

export interface ShopFilters {
  petType?: ShopPetType;
  categorySlug?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
  inStockOnly?: boolean;
}

export function filterProducts(filters: ShopFilters = {}): ShopProduct[] {
  const {
    petType = 'all',
    categorySlug,
    brandId,
    minPrice,
    maxPrice,
    q,
    inStockOnly,
  } = filters;

  const query = q?.trim().toLowerCase();
  const source = liveProducts.length ? liveProducts : SHOP_PRODUCTS;

  return source.filter((p) => {
    if (petType !== 'all' && !p.petTypes.includes(petType)) return false;
    if (categorySlug && p.categorySlug !== categorySlug) return false;
    if (brandId && p.brandId !== brandId) return false;
    if (minPrice != null && p.priceToman < minPrice) return false;
    if (maxPrice != null && p.priceToman > maxPrice) return false;
    if (inStockOnly && !p.inStock) return false;
    if (query) {
      const brand = getBrand(p.brandId)?.labelFa ?? '';
      const hay = `${p.title} ${brand} ${Object.values(p.params).join(' ')}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export const SHOP_PRICE_MAX = Math.max(...SHOP_PRODUCTS.map((p) => p.priceToman));

export const BADGE_LABELS: Record<NonNullable<ShopProduct['badge']>, string> = {
  hot: 'پرفروش',
  sale: 'تخفیف',
  new: 'جدید',
  limited: 'محدود',
};
