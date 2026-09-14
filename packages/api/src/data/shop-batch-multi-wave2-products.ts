/**
 * PetDate shop Batch-multi wave 2/5 — 10 live SKUs (p260–p269).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w2-v1 (wave 1 stays on batch-multi-w1-v1).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE2_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE2_CACHE_BUST = "batch-multi-w2-v1";

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH_MULTI_WAVE2_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatchMultiWave2Product = {
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE2_SLUGS)[number];
  title: string;
  titleEn: string;
  brandId: string;
  categorySlug: string;
  petTypes: string[];
  priceToman: number;
  costToman: number;
  image: string;
  images: string[];
  badge: 'new';
  inStock: true;
  stockQty: number;
  featured: true;
  params: Record<string, string>;
  description: string;
};

const CATEGORIES = [
  {
    slug: 'dog-treats',
    labelFa: 'تشویقی و مکمل غذایی سگ',
    petType: 'dog',
    description: 'تشویقی، اسنک و مکمل',
    emoji: '🍖',
    sortOrder: 30,
  },
  {
    slug: 'cat-treats',
    labelFa: 'تشویقی گربه و مکمل غذایی',
    petType: 'cat',
    description: 'تشویقی، بستنی و مکمل',
    emoji: '🍦',
    sortOrder: 40,
  },
  {
    slug: 'dog-toys',
    labelFa: 'اسباب بازی سگ',
    petType: 'dog',
    description: 'توپ، لاتکس و اسباب‌بازی تعاملی',
    emoji: '🎾',
    sortOrder: 50,
  },
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave2Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopBatchMultiWave2Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const suitable = hasDog && hasCat ? 'سگ و گربه' : hasDog ? 'سگ' : 'گربه';
  const params: Record<string, string> = {
    مناسب_برای: suitable,
    __titleEn: partial.titleEn,
  };
  if (partial.weight) params['وزن'] = partial.weight;
  if (partial.color) params['رنگ'] = partial.color;
  if (partial.model) params['مدل'] = partial.model;
  if (partial.size) params['سایز'] = partial.size;
  return {
    ...partial,
    costToman: partial.priceToman,
    ...multiGallery(partial.slug),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
    params,
  };
}

export const SHOP_BATCH_MULTI_WAVE2_PRODUCTS: ShopBatchMultiWave2Product[] = [
  row({
    id: "p260",
    slug: "dog-treats-wanpy-chicken-jerky-chips-100g",
    title: "تشویقی سگ ونپی چیپس مرغ ۱۰۰ گرم",
    titleEn: "",
    brandId: "wanpy",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 655_000,
    weight: "100گرم",
    description:
      "چیپس مرغ خشک ونپی؛ ترد و خوش‌بو برای جایزه سریع آموزش. تکه را بشکن تا کش نیاید و قورت ندهد.\n\nاز سهم روزانه کم کن. مرغ حساسیت شایع است — اگر خارش دارد پروتئین را عوض کن.\n\nبسته ۱۰۰ گرم. جایگزین وعده نیست.\n\n• چیپس مرغ خشک\n• ۱۰۰ گرم\n• برند ونپی\n• مناسب آموزش\n• تکه را خرد کن\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p261",
    slug: "cat-treats-bioline-catnip-spray-50ml",
    title: "اسپری کت‌نیپ بایولاین ۵۰ میلی‌لیتر",
    titleEn: "",
    brandId: "bioline",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 828_000,
    weight: "50ml",
    description:
      "اسپری کت‌نیپ برای زنده‌کردن اسباب‌بازی و اسکرچر کهنه. چند پاف کافی است؛ خیس کردن لازم نیست.\n\nحدود یک‌سوم گربه‌ها به کت‌نیپ واکنش کمی دارند — طبیعی است. روی پارچه و اسباب‌بازی بزن، نه مستقیم روی چشم و بینی.\n\nدور از بچه‌ها نگه دار. جایگزین بازی و توجه نیست.\n\n• اسپری کت‌نیپ ۵۰ میل\n• برند بایولاین\n• برای اسباب‌بازی و اسکرچر\n• چند پاف کافی است\n• همه گربه‌ها واکنش یکسان ندارند\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p262",
    slug: "cat-treats-bonnest-catnip-spray-50-l",
    title: "اسپری کت‌نیپ بونست ۵۰ میلی‌لیتر",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 539_000,
    weight: "50 میلی لیتر",
    description:
      "اسپری کت‌نیپ بونست برای تشویق بازی و کنجکاوی. روی موش پارچه‌ای یا تونل بزن و بگذار گربه خودش کشف کند.\n\nزیاده‌روی بو را بی‌اثر می‌کند. اگر گربه بی‌تفاوت بود چند روز فاصله بده.\n\n۵۰ میلی‌لیتر. خوراکی نیست.\n\n• کت‌نیپ اسپری بونست\n• ۵۰ میلی‌لیتر\n• تقویت بازی\n• کم بزن، زیاد تکرار نکن\n• خوراکی نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p263",
    slug: "cat-treats-cat-grass-theething-stick-30-g",
    title: "اسنک علف گربه طعم مرغ ۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 480_000,
    weight: "30 گرم",
    description:
      "اسنک جویدنی با طعم مرغ و حس علف گربه؛ برای گربه‌هایی که دوست دارند چیزی بجوند و مشغول شوند.\n\nتکه کوچک بده و آب در دسترس باشد. اگر استفراغ بعد جویدن دیدی قطع کن و با دامپزشک حرف بزن.\n\nبسته ۳۰ گرم. وعده اصلی نیست.\n\n• اسنک علف‌گربه / طعم مرغ\n• ۳۰ گرم\n• برای مشغول‌کردن جویدن\n• تکه کوچک شروع کن\n• جایگزین غذای کامل نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p264",
    slug: "cat-treats-bonnest-cat-nip-powder-20g-20-g",
    title: "پودر کت‌نیپ بونست ۲۰ گرم",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 385_000,
    weight: "20 گرم",
    description:
      "پودر کت‌نیپ برای پاشیدن روی اسباب‌بازی، کارتُن و اسکرچر. کنترل‌شده‌تر از اسپری برای بعضی صاحبان.\n\nنوک قاشق کافی است. روی غذای اصلی نپاش مگر دامپزشک گفته باشد.\n\nبسته ۲۰ گرم. خشک و دربسته نگه دار.\n\n• پودر کت‌نیپ ۲۰ گرم\n• برند بونست\n• برای اسباب‌بازی و اسکرچر\n• مقدار کم\n• دربسته نگهداری شود\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p265",
    slug: "cat-treats-chicken-cat-grass-treat-30-g",
    title: "تشویقی علف گربه طعم مرغ ۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 335_000,
    weight: "30 گرم",
    description:
      "تشویقی جویدنی علف‌گربه با طعم مرغ؛ گزینه دوم کنار اسنک مشابه برای تنوع طعم و بافت.\n\nمثل هر تشویقی از وعده کم کن. برای گربه‌های حریص تکه را خرد کن.\n\n۳۰ گرم. درمان گلوله مو تضمینی نیست.\n\n• تشویقی علف‌گربه طعم مرغ\n• ۳۰ گرم\n• تنوع بافت جویدنی\n• از کالری روزانه کم کن\n• تضمین درمانی ندارد\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p266",
    slug: "dog-toys-enjoy-the-meal-puzzle-toy",
    title: "اسباب‌بازی فکری سگ AFP",
    titleEn: "",
    brandId: "afp",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 5_480_000,
    description:
      "پازل غذایی AFP؛ سگ باید قطعه را جابه‌جا کند تا به تشویقی برسد. برای روزهای بارانی و سگ‌های باهوش خسته‌کننده است (به معنی خوب).\n\nسختی را از آسان شروع کن تا ناامید نشود. زیر نظر باشد.\n\nتشویقی را در سهم روزانه حساب کن.\n\n• پازل غذایی AFP\n• تقویت تمرکز و آرامش\n• شروع از سطح آسان\n• بازی نظارت‌شده\n• کالری تشویقی را کم کن\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p267",
    slug: "dog-toys-ufo-treat-dispenser-dog-toy",
    title: "اسباب‌بازی جایزه‌دهنده سگ مدل سفینه AFP",
    titleEn: "",
    brandId: "afp",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 3_580_000,
    description:
      "اسباب‌بازی فکری سفینه‌ای AFP که با حرکت سگ تشویقی را کم‌کم رها می‌کند. مغز را درگیر می‌کند تا کمتر از سر حوصله گاز بگیرد.\n\nتشویقی خشک کوچک داخلش بگذار؛ خیس و چسبناک گیر می‌کند. زیر نظر بازی کند تا نشکند و تکه نبلعد.\n\nبعد بازی خالی و بشوی.\n\n• جایزه‌دهنده / فکری\n• برند AFP\n• مناسب کاهش حوصلگی\n• تشویقی خشک کوچک\n• بازی زیر نظر\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p268",
    slug: "dog-toys-crab-silicone-dog-chew-toothbrush-toy",
    title: "دندانی سیلیکونی مدل خرچنگ",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 1_100_000,
    description:
      "جویدنی سیلیکونی به شکل خرچنگ برای گاز سبک و ماساژ لثه. برای سگ‌های مخرب سنگین ممکن است زود پاره شود.\n\nاگر تکه‌تکه شد جمع کن. جای مسواک واقعی نیست.\n\nبعد بازی بشوی.\n\n• سیلیکون طرح خرچنگ\n• ماساژ لثه / گاز سبک\n• نه برای جویدن‌کننده‌های خیلی قوی\n• شست‌وشو بعد بازی\n• جای مسواک دامپزشکی نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p269",
    slug: "dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy",
    title: "عروسک پولیشی هندوانه صدا‌دار لونا",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 362_000,
    description:
      "عروسک پولیشی هندوانه با صدای جیرجیر برای بازی سبک داخل خانه. مناسب سگ‌های کوچک و متوسط که گاز مخرب سنگین ندارند.\n\nاگر پاره شد جمع کن تا الیاف نبلعد. جایزه خوراکی نیست؛ زیر نظر بازی کند.\n\nشست‌وشوی سطحی بعد بازی.\n\n• پولیش هندوانه صدا‌دار\n• برند لونا\n• بازی سبک خانگی\n• نه برای جویدن‌کننده‌های خیلی قوی\n• جمع کن اگر پاره شد\n\n— پت دیت شاپ.",
  }),
];

export { SHOP_BATCH_MULTI_WAVE2_SLUGS };

export function seedShopBatchMultiWave2Products(): number {
  const d = getDb();

  const insCat = d.prepare(
    `INSERT INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO NOTHING`
  );
  for (const c of CATEGORIES) {
    insCat.run(c.slug, c.labelFa, c.petType, c.description, c.emoji, c.sortOrder);
  }

  const findBySlug = d.prepare(`SELECT id, stock_qty FROM shop_products WHERE slug = ?`);
  const upsert = d.prepare(
    `INSERT INTO shop_products (
      id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
      image, badge, in_stock, stock_qty, params, description, featured, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      brand_id = excluded.brand_id,
      category_slug = excluded.category_slug,
      pet_types = excluded.pet_types,
      price_toman = excluded.price_toman,
      cost_toman = excluded.cost_toman,
      image = excluded.image,
      badge = excluded.badge,
      in_stock = excluded.in_stock,
      params = excluded.params,
      description = excluded.description,
      featured = excluded.featured,
      updated_at = datetime('now')`
  );

  let count = 0;
  for (const p of SHOP_BATCH_MULTI_WAVE2_PRODUCTS) {
    if ((HELD_SHOP_SLUGS as readonly string[]).includes(p.slug)) continue;
    const existing = findBySlug.get(p.slug) as { id: string; stock_qty: number } | undefined;
    const id = existing?.id ?? p.id;
    const stockQty = existing ? Number(existing.stock_qty) : p.stockQty;
    upsert.run(
      id,
      p.slug,
      p.title,
      p.brandId,
      p.categorySlug,
      JSON.stringify(p.petTypes),
      p.priceToman,
      p.costToman,
      p.image,
      p.badge,
      stockQty,
      JSON.stringify(withShopImagesParam(p.params, p.images)),
      p.description
    );
    count += 1;
  }
  return count;
}
