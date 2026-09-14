/**
 * PetDate shop Digikala batch1 Part2 — 10 live SKUs (p310–p319).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. White #FFFFFF packshots; cache-bust digikala-b1-p2-v1.
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART2_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_DIGIKALA_BATCH1_PART2_CACHE_BUST = "digikala-b1-p2-v1";

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_DIGIKALA_BATCH1_PART2_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_DIGIKALA_BATCH1_PART2_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_DIGIKALA_BATCH1_PART2_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopDigikalaBatch1Part2Product = {
  id: string;
  slug: (typeof SHOP_DIGIKALA_BATCH1_PART2_SLUGS)[number];
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
    slug: 'cat-toys',
    labelFa: 'اسباب‌بازی گربه',
    petType: 'cat',
    description: 'اسباب‌بازی و سرگرمی',
    emoji: '🧶',
    sortOrder: 70,
  },
  {
    slug: 'grooming',
    labelFa: 'آرایش و نظافت',
    petType: 'dog',
    description: 'برس، شامپو و ناخن‌گیر',
    emoji: '✂️',
    sortOrder: 80,
  },
  {
    slug: 'bird-food',
    labelFa: 'غذای پرنده',
    petType: 'bird',
    description: 'دان و تشویقی پرنده',
    emoji: '🐦',
    sortOrder: 90,
  },
] as const;

function row(
  partial: Omit<
    ShopDigikalaBatch1Part2Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopDigikalaBatch1Part2Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const hasBird = partial.petTypes.includes('bird');
  const suitable =
    hasDog && hasCat
      ? 'سگ و گربه'
      : hasDog
        ? 'سگ'
        : hasCat
          ? 'گربه'
          : hasBird
            ? 'پرنده'
            : 'سگ و گربه';
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

export const SHOP_DIGIKALA_BATCH1_PART2_PRODUCTS: ShopDigikalaBatch1Part2Product[] = [
  row({
    id: "p310",
    slug: "cat-toys-dkp-5758150",
    title: "اسباب‌بازی سگ و گربه مدل SH100",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 293_000,
    description:
      "اسباب‌بازی چندکاره مدل SH100 برای گاز و پا زدن سبک سگ کوچک و گربه. مشخصات دقیق رنگ/شکل روی بسته را ببین.\n\nجوینده‌های سنگین زود خرابش می‌کنند. تکه جداشده را بردار.\n\nزیر نظر بازی.\n\n• مدل SH100\n• سگ کوچک و گربه\n• بازی نظارت‌شده\n• مقاوم جویدن سنگین نیست\n• جمع تکه پاره\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p311",
    slug: "cat-toys-dkp-7868352",
    title: "ماهی پارچه‌ای کت‌نیپ — مجموعه ۳ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 230_000,
    description:
      "سه عدد ماهی پارچه‌ای کت‌نیپ‌دار برای پرتاب و حمله. ست ۳تایی یعنی وقتی یکی گم شد بقیه هست.\n\nکت‌نیپ همه گربه‌ها را دیوانه نمی‌کند. اگر پاره شد نخ را جمع کن.\n\nقابل شست‌وشوی سطحی.\n\n• ۳ عدد ماهی کت‌نیپ\n• پارچه‌ای\n• بازی شکار\n• ایمنی نخ\n• شست‌وشوی سطحی\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p312",
    slug: "cat-toys-dkp-12180640",
    title: "چوب بازی چوبی با زنگوله",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 170_000,
    description:
      "چوب بازی کلاسیک با زنگوله؛ ارزان و مؤثر برای شروع شکار روزانه ۵ دقیقه.\n\nنوک را به چشم نزن. اگر نخ باز شد جمع کن یا ببند.\n\nچند دقیقه کوتاه بهتر از یک‌ساعت خسته‌کننده است.\n\n• چوب چوبی + زنگوله\n• بازی روزانه کوتاه\n• ایمنی چشم و نخ\n• ساده و مؤثر\n• پایان قبل خستگی بیش از حد\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p313",
    slug: "grooming-dkp-18631110",
    title: "ناخن‌گیر اختاپوسی سگ و گربه GK890 (وریانت ۲)",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 490_000,
    description:
      "همان مدل ناخن‌گیر اختاپوسی GK890 در وریانت/کد انبار جدا؛ مشخصات کاربردی مثل نسخه اول.\n\nنور کافی، آرامش پت، برش کم‌کم. تیغه را تمیز نگه دار.\n\nاگر پت مقاوم است کمک دوم نفر.\n\n• مدل اختاپوسی GK890\n• وریانت بسته‌بندی جدا\n• برش تدریجی\n• بهداشت تیغه\n• کمک نفر دوم در پت‌های مقاوم\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p314",
    slug: "grooming-dkp-18625181",
    title: "ناخن‌گیر اختاپوسی سگ و گربه GK890",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 450_000,
    description:
      "ناخن‌گیر با طراحی اختاپوسی برای گرفتن راحت‌تر پنجه. فقط نوک شفاف ناخن را بگیر؛ رگ خونی را نزن.\n\nاول روی حیوان آرام تمرین کن. اگر خون آمد پودر بندآورنده و فشار ملایم؛ در خونریزی شدید کلینیک.\n\nبرای ناخن خیلی سفت سگ بزرگ ممکن است مدل قوی‌تر لازم شود.\n\n• مدل اختاپوسی کد GK890\n• سگ و گربه\n• فقط نوک ناخن\n• آرام‌سازی قبل کوتاهی\n• مراقب رگ خون\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p315",
    slug: "grooming-dkp-21424542",
    title: "قیچی ناخن‌گیر HIACE BL",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 380_000,
    description:
      "قیچی ناخن‌گیر مدل HIACE BL با تیغه قیچی‌شکل؛ کنترل دقیق‌تر برای صاحبی که گیوتین را دوست ندارد.\n\nهمچنان رگ را نزن. برای گربه و سگ کوچک معمولاً راحت‌تر از سگ غول‌پیکر است.\n\nبعد استفاده الکل ملایم روی تیغه.\n\n• قیچی ناخن HIACE BL\n• کنترل دقیق‌تر\n• سگ و گربه\n• مراقب رگ\n• تمیزکاری تیغه\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p316",
    slug: "bird-food-dkp-12290421",
    title: "مای‌برد پلاس عروس هلندی ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 428_000,
    description:
      "غذای خشک مای‌برد مدل پلاس مخصوص عروس هلندی، ۱ کیلو؛ فرموله برای طوطی‌های کوچک این گروه.\n\nبرچسب کامل/مکمل را بخوان. انتقال از ارزن خالص را تدریجی کن.\n\nآب جدا.\n\n• مای برد پلاس عروس\n• ۱ کیلو\n• جیره فرموله‌تر\n• تعویض تدریجی\n• آب تازه\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p317",
    slug: "bird-food-dkp-10394150",
    title: "غذای عروس هلندی سبزیجات معطر ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 220_000,
    description:
      "مخلوط عروس با تاکید سبزیجات معطر، ۱ کیلو؛ تنوع بو و طعم نسبت به فقط ارزن.\n\nارزن خالی چاق می‌کند — این تنوع کمک می‌کند ولی باز هم سبزی تازه بده.\n\n۱ کیلو.\n\n• سبزیجات معطر\n• ۱ کیلو / عروس\n• تنوع نسبت به ارزن خالص\n• مکمل سبزی تازه\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p318",
    slug: "bird-food-dkp-6060757",
    title: "تشویقی پرنده میل‌ورم خشک ۵۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 110_000,
    description:
      "میل‌ورم خشک ۵۰ گرمی برای تشویقی حشره‌خوارها و طوطی‌هایی که پروتئین حیوانی دوست دارند.\n\nکم بده؛ چربی بالا دارد. تازه نگه دار تا تند نشود.\n\nجای جیره کامل نیست.\n\n• میل‌ورم خشک ۵۰ گرم\n• تشویقی پروتئینی\n• مقدار کم\n• نه جیره اصلی\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p319",
    slug: "bird-food-dkp-10253439",
    title: "ارزن خوشه‌ای پرنده — بسته ۵ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 106_000,
    description:
      "بسته ۵ عددی ارزن خوشه‌ای برای سرگرمی و نوک‌زدن؛ تشویقی است نه تمام جیره.\n\nزیاده‌روی چاق می‌کند. خوشه را طوری ببند که مدفوع روی جیره اصلی نریزد.\n\nبرای قناری و عروس و مرغ عشق محبوب است.\n\n• ارزن خوشه‌ای\n• بسته ۵ عددی\n• تشویقی / سرگرمی\n• نه جیره کامل\n• کنترل وزن\n\n— پت دیت شاپ.\n\n---",
  }),
];

export { SHOP_DIGIKALA_BATCH1_PART2_SLUGS };

export function seedShopDigikalaBatch1Part2Products(): number {
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
  for (const p of SHOP_DIGIKALA_BATCH1_PART2_PRODUCTS) {
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
