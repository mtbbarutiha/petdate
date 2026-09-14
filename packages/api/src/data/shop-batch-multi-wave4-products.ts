/**
 * PetDate shop Batch-multi wave 4/5 — 10 live SKUs (p280–p289).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w4-v4 (wave 1–3 stay on their own busts).
 * Slug typo is historical: hannapet-silicone-h-harness-sizr-m (sizr not size).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE4_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE4_CACHE_BUST = "batch-multi-w4-v4";

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH_MULTI_WAVE4_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatchMultiWave4Product = {
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE4_SLUGS)[number];
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
    slug: 'dog-accessories',
    labelFa: 'قلاده، لیش و هارنس',
    petType: 'dog',
    description: 'هارنس، لیش و قلاده',
    emoji: '🦮',
    sortOrder: 80,
  },
  {
    slug: 'cat-accessories',
    labelFa: 'ظروف و لوازم گربه',
    petType: 'cat',
    description: 'ظرف و پایه غذا',
    emoji: '🍽️',
    sortOrder: 90,
  },
  {
    slug: 'grooming',
    labelFa: 'بهداشت و آراستگی',
    petType: 'dog',
    description: 'شامپو و برس',
    emoji: '🧴',
    sortOrder: 100,
  },
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave4Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopBatchMultiWave4Product {
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

export const SHOP_BATCH_MULTI_WAVE4_PRODUCTS: ShopBatchMultiWave4Product[] = [
  row({
    id: "p280",
    slug: "dog-accessories-hannapet-silicone-h-harness-sizr-m",
    title: "قلاده H مدل سیلیکونی حناپت سایز M",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_248_000,
    size: "M",
    description:
      "هارنس H سیلیکونی سایز M برای سگ‌های کوچک تا متوسط؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.\n\nجدول سایز روی محصول را با دور سینه واقعی چک کن؛ حرف M بین برندها یکی نیست.\n\nبرای توله در حال رشد ممکن است زود کوچک شود.\n\n• هارنس H سیلیکونی\n• سایز M\n• برند حناپت\n• اندازه با دور سینه\n• مناسب سگ کوچک–متوسط\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p281",
    slug: "dog-accessories-waudog-classic-leather-collar-25-mm",
    title: "قلاده چرمی WAUDOG Classic",
    titleEn: "",
    brandId: "waudog",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_024_000,
    description:
      "قلاده چرمی کلاسیک ۲۵ میلی‌متری WAUDOG؛ ظاهر مرتب برای پیاده‌روی شهری.\n\nچرم را خشک نگه دار و گاه‌به‌گاه با مراقبت چرم تمیز کن. برای سگ‌های خیلی کشنده هارنس مکمل بهتر است.\n\nگردن را قبل خرید اندازه بگیر.\n\n• قلاده چرمی کلاسیک\n• پهنای ۲۵ میلی‌متر\n• برند WAUDOG\n• مراقبت چرم\n• برای کشنده شدید هارنس اضافه کن\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p282",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-m",
    title: "لیش سیلیکونی حناپت سایز M",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 2_953_000,
    size: "M",
    description:
      "لیش سیلیکونی سایز M؛ جفت طبیعی هارنس M همان برند. دست را کمتر می‌سوزاند در کشیدن‌های کوتاه.\n\nکارابین را روی حلقه هارنس قفل کن. اگر سگ خیلی سنگین است به L فکر کن.\n\nشست‌وشوی آب خنک.\n\n• لیش سیلیکونی M\n• برند حناپت\n• جفت هارنس هم‌سایز\n• قفل کارابین\n• شست‌وشوی آسان\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p283",
    slug: "cat-accessories-hannapet-double-wooden-bowl-stand",
    title: "پایه چوبی دوقلو حناپت",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 2_130_000,
    description:
      "پایه چوبی دو ظرف برای آب و غذا؛ ارتفاع ملایم تا گردن کمتر خم شود — مخصوصاً برای گربه‌های مسن‌تر.\n\nچوب را خیس نگذار؛ ظرف‌ها را جدا بشوی. جای ثابت انتخاب کن تا گربه سردرگم نشود.\n\nیک عدد.\n\n• پایه چوبی دوقلو\n• برند حناپت\n• ارتفاع راحت‌تر برای خوردن\n• شست‌وشوی ظرف جدا از چوب\n• جای ثابت در خانه\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p284",
    slug: "cat-accessories-eggshell-bowls-for-cats",
    title: "ظرف آب و غذا گربه مدل پایه دار طرح تخم مرغ",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_468_000,
    description:
      "ست ظرف پایه‌دار طرح تخم‌مرغ؛ ظاهر فانتزی با ارتفاع کم تا متوسط برای گربه روزمره.\n\nسبیل‌ها به دیواره تنگ حساس‌اند — اگر دیدید کنار ظرف غذا می‌گذارند ظرف پهن‌تر بهتر است.\n\nروزانه بشوی.\n\n• طرح تخم‌مرغ پایه‌دار\n• آب + غذا\n• مناسب گربه\n• سبیل را فشار ندهد\n• شست‌وشوی روزانه\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p285",
    slug: "cat-accessories-high-legend-bowls-for-cat",
    title: "ظرف غذا و آب گربه مدل پایه دار خندان",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_110_000,
    description:
      "ظرف پایه‌دار طرح خندان؛ انتخاب رنگی برای خانه‌هایی که ظرف ساده نمی‌خواهند.\n\nپایه را روی سطح صاف بگذار تا نلغزد. استیل/پلاستیک را بعد هر وعده تمیز کن تا بو نگیرد.\n\nجای ظرف کنار خاک نباشد.\n\n• مدل خندان پایه‌دار\n• جدا از خاک گربه\n• سطح صاف\n• تمیزکاری بعد وعده\n• مناسب گربه خانگی\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p286",
    slug: "cat-accessories-hanapet-double-metal-bowl-stand",
    title: "پایه فلزی دوقلو حناپت",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_100_000,
    description:
      "پایه فلزی دو ظرف؛ مقاوم‌تر از چوب در برابر رطوبت ریز آب. مناسب گربه‌هایی که دور ظرف آب می‌پاشند.\n\nفلز را خشک کن تا لکه نماند. ارتفاع را با جثه گربه بسنج.\n\nیک عدد.\n\n• پایه فلزی دوقلو\n• حناپت\n• مقاوم رطوبت\n• خشک کردن بعد شست‌وشو\n• مناسب پاشیدن آب\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p287",
    slug: "cat-accessories-petopoli-four-legged-pet-bowl",
    title: "ظرف آب و غذای پایه دار",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 775_000,
    description:
      "ظرف مرتفع چهارپایه؛ برای گربه‌هایی که ایستاده راحت‌تر می‌خورند یا صاحب از ریخت‌وپاش روی زمین خسته شده.\n\nپاها را قفل چک کن. مدل چهارپایه پتوپولی.\n\nلغزش روی سرامیک را با زیرپایی کنترل کن.\n\n• چهارپایه مرتفع\n• برند پتوپولی\n• کمتر خم شدن گردن\n• چک پایداری پاها\n• کنترل لغزش\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p288",
    slug: "grooming-mojan-pet-brush",
    title: "برس سگ و گربه فنری موژان",
    titleEn: "",
    brandId: "mojan",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 823_000,
    description:
      "برس فنری برای کندن موهای شل سگ و گربه کوتاه‌مو تا متوسط.\n\nهفته‌ای چند بار کوتاه بهتر از یک‌بار وحشیانه است. اگر پوست حساس است با فشار کمتر.\n\nموی جمع‌شده را بعد هر وعده پاک کن.\n\n• برس فنری موژان\n• مناسب سگ و گربه\n• کاهش ریزش روی مبل\n• فشار ملایم\n• پاک کردن مو از برس\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p289",
    slug: "grooming-dog-shedding-brush-hair-release-button",
    title: "برس مو سگ و گربه مدل بیضی با دکمه تخلیه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 770_000,
    description:
      "برس بیضی با دکمه تخلیه مو؛ بعد شانه یک فشار و مو می‌افتد توی سطل نه روی فرش.\n\nروی پوست ملتهب نکش. برای مو بلند ممکن است به شانه جدا هم نیاز باشد.\n\nتمیزکاری بعد هر بار.\n\n• دکمه تخلیه مو\n• مدل بیضی\n• مناسب سگ و گربه\n• نه روی پوست زخمی\n• کمک به کنترل ریزش\n\n— پت دیت شاپ.",
  }),
];

export { SHOP_BATCH_MULTI_WAVE4_SLUGS };

export function seedShopBatchMultiWave4Products(): number {
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
  for (const p of SHOP_BATCH_MULTI_WAVE4_PRODUCTS) {
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
