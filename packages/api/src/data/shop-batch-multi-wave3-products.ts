/**
 * PetDate shop Batch-multi wave 3/5 — 10 live SKUs (p270–p279).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w3-v3 (wave 1/2 stay on their own busts).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE3_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE3_CACHE_BUST = "batch-multi-w3-v3";

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH_MULTI_WAVE3_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatchMultiWave3Product = {
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE3_SLUGS)[number];
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
    slug: 'dog-toys',
    labelFa: 'اسباب بازی سگ',
    petType: 'dog',
    description: 'توپ، لاتکس و اسباب‌بازی تعاملی',
    emoji: '🎾',
    sortOrder: 50,
  },
  {
    slug: 'cat-toys',
    labelFa: 'اسباب بازی گربه',
    petType: 'cat',
    description: 'موش، میله و اسباب‌بازی',
    emoji: '🐭',
    sortOrder: 60,
  },
  {
    slug: 'dog-accessories',
    labelFa: 'قلاده، لیش و هارنس',
    petType: 'dog',
    description: 'هارنس، لیش و قلاده',
    emoji: '🦮',
    sortOrder: 80,
  },
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave3Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopBatchMultiWave3Product {
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

export const SHOP_BATCH_MULTI_WAVE3_PRODUCTS: ShopBatchMultiWave3Product[] = [
  row({
    id: "p270",
    slug: "dog-toys-luna-pomegranate-felt-squeaky-dog-toy",
    title: "عروسک نمدی لونا طرح انار",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 322_000,
    description:
      "عروسک نمدی صدادهنده لونا؛ سبک برای توله و سگ‌های بازی‌گوش نرم. داخل خانه بهتر از حیاط خشن است.\n\nاگر سگ نمد را می‌درد، اسباب‌بازی مقاوم‌تر بگیر. صدای جیرجیر را بعضی سگ‌ها دوست دارند بعضی می‌ترسند.\n\nبعد پاره شدن دور بینداز.\n\n• نمد طرح انار / لونا\n• صدادهنده\n• مناسب بازی نرم خانگی\n• زیر نظر اگر پاره شد\n• جایگزین جویدنی مقاوم نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p271",
    slug: "dog-toys-luna-squeaky-watermelon-plush-dog-toy",
    title: "عروسک پولیشی لونا طرح هندوانه صدا دار",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 312_000,
    description:
      "نسخه کلاسیک هندوانه پولیشی لونا با صدا؛ هم‌سبک مدل خندان برای تنوع ظاهر.\n\nهمان قانون: بازی نرم، نظارت، دور انداختن وقتی پاره شد.\n\nبرای توله و سگ کم‌تهاجم مناسب‌تر است.\n\n• پولیش هندوانه / صدا دار\n• برند لونا\n• تنوع ظاهری نسبت به مدل خندان\n• نظارت هنگام بازی\n• مقاوم جویدن سنگین نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p272",
    slug: "cat-toys-petopoli-4-way-foldable-cat-play-tunnel",
    title: "تونل بازی چهارراه گربه",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 2_310_000,
    description:
      "تونل تاشو چهارراه برای دویدن و کمین؛ انرژی گربه آپارتمانی را خالی می‌کند بدون اینکه مبل قربانی شود.\n\nروی سطح لغزنده فیکس کن. اگر چند گربه دارید اول جداگانه معرفی کنید تا دعوا سر ورودی نشود.\n\nجمع‌شو برای خانه کوچک.\n\n• تونل چهارراه تاشو\n• برند پتوپولی\n• تخلیه انرژی داخل خانه\n• معرفی آرام به چند گربه\n• بازی نظارت‌شده\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p273",
    slug: "cat-toys-cat-toy-layer-tower-of-tracks",
    title: "اسباب بازی طبقاتی تعادلی گربه مدل پردار",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 1_520_000,
    description:
      "برج توپ و لایه با پر؛ گربه توپ را دنبال می‌کند و گاه‌به‌گاه به پر حمله می‌کند. مناسب میز و کنج خلوت.\n\nباتری/قطعه متحرک اگر داشت را از دستور ساخت چک کن. زیر نظر توله تا قطعه نبلعد.\n\n• برج طبقاتی + پر\n• دنبال کردن توپ\n• مناسب خانه کوچک\n• نظارت روی توله\n• بازی سبک خانگی\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p274",
    slug: "cat-toys-hanging-catnip-bat-toy-for-cats",
    title: "عروسک آویز گربه طرح خفاش کت‌نیپ‌دار",
    titleEn: "",
    brandId: "juicer",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 960_000,
    description:
      "خفاش آویز با کت‌نیپ برای حمله از در و قفسه. نصب محکم؛ اگر بیفتد بازی تمام است و ممکن است پاره شود.\n\nکت‌نیپ داخلش بو را زنده نگه می‌دارد. نخ و قطعات کوچک را چک کن.\n\n• آویز خفاش + کت‌نیپ\n• نصب محکم\n• تقویت شکار خانگی\n• برند جویسر\n• ایمنی نخ و قطعه\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p275",
    slug: "cat-toys-little-yellow-cat-toy",
    title: "اسباب بازی تشویقی خور تعادلی گربه مدل جوجه اردک",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 825_000,
    description:
      "تعادل‌کننده تشویقی‌خور طرح جوجه اردک؛ گربه باید حرکت بدهد تا جایزه برسد. نسخه گربه‌ای پازل نرم.\n\nتشویقی خشک ریز بریز.\n\nزیر نظر اگر پلاستیک جویده شد.\n\n• تشویقی‌خور تعادلی\n• طرح جوجه اردک\n• تقویت بازی فکری\n• تشویقی خشک ریز\n• بازی زیر نظر\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p276",
    slug: "cat-toys-play-tunnel-bag",
    title: "کیسه بازی گربه برند",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 792_000,
    description:
      "کیسه/تونل نرم برای قایم‌باشک؛ جایگزین سبک تونل سفت در خانه خیلی کوچک.\n\nبعد بازی جمع کن تا زمین‌گیر نشود. اگر گربه داخلش ادرار کرد طبق پارچه بشوی.\n\n• کیسه بازی تاشو\n• برند پتوپولی\n• قایم‌باشک خانگی\n• جمع بعد بازی\n• قابل شست‌وشو در حد پارچه\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p277",
    slug: "cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats",
    title: "توپ هوشمند رباتیک گربه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 610_050,
    description:
      "توپ حرکتی خودکار برای وقتی خودت حوصله میله پر نداری. روی سطح صاف بهتر کار می‌کند.\n\nباتری را چک کن و شب خاموش بگذار تا گربه نخوابد. زیر نظر اولین جلسه‌ها.\n\n• توپ رباتیک خودکار\n• تخلیه انرژی بدون میله\n• سطح صاف\n• خاموش کردن بین بازی\n• اولین بار نظارت\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p278",
    slug: "dog-accessories-hannapet-silicone-h-harness-size-l",
    title: "قلاده H مدل سیلیکونی حناپت سایز L",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 4_355_000,
    size: "L",
    description:
      "هارنس H سیلیکونی سایز L برای سگ‌های متوسط رو به بزرگ؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.\n\nاندازه سینه را دقیق بگیر؛ تنگ = زخم، گشاد = دررفتن.\n\nبرای سگ‌های خیلی کشنده ممکن است به مدل محکم‌تر نیاز باشد.\n\n• هارنس H سیلیکونی\n• سایز L\n• برند حناپت\n• فشار کمتر روی گردن\n• اندازه‌گیری سینه قبل خرید\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p279",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-l",
    title: "لیش سیلیکونی حناپت سایز L",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_332_000,
    size: "L",
    description:
      "لیش سیلیکونی سایز L؛ نرم در دست و قابل شست‌وشو نسبت به پارچه‌های زبر.\n\nبا هارنس مناسب جفت کن نه فقط قلاده گردنی برای سگ‌های کشنده. گره و کارابین را قبل خروج چک کن.\n\nطول را با فضای پیاده‌روی‌ات بسنج.\n\n• لیش سیلیکونی L\n• برند حناپت\n• نرم و قابل شست‌وشو\n• چک قفل قبل خروج\n• مناسب پیاده‌روی\n\n— پت دیت شاپ.",
  }),
];

export { SHOP_BATCH_MULTI_WAVE3_SLUGS };

export function seedShopBatchMultiWave3Products(): number {
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
  for (const p of SHOP_BATCH_MULTI_WAVE3_PRODUCTS) {
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
