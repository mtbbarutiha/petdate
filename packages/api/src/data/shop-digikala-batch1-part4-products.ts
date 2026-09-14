/**
 * PetDate shop Digikala batch1 Part4 — 12 live SKUs (p330–p341).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. White #FFFFFF packshots; cache-bust digikala-b1-p4-v1.
 * Front-only galleries (single real angle — do not invent -2/-3).
 * Completes Digikala batch1 (p300–p341).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART4_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_DIGIKALA_BATCH1_PART4_CACHE_BUST = "digikala-b1-p4-v1";

function frontOnlyGallery(slug: string): { image: string; images: string[] } {
  const image = `${P}/${slug}.jpg?v=${SHOP_DIGIKALA_BATCH1_PART4_CACHE_BUST}`;
  return { image, images: [image] };
}

export type ShopDigikalaBatch1Part4Product = {
  id: string;
  slug: (typeof SHOP_DIGIKALA_BATCH1_PART4_SLUGS)[number];
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
    slug: 'dog-food',
    labelFa: 'غذای سگ',
    petType: 'dog',
    description: 'خشک و تر سگ',
    emoji: '🐶',
    sortOrder: 10,
  },
  {
    slug: 'cat-treats',
    labelFa: 'تشویقی گربه',
    petType: 'cat',
    description: 'تشویقی و مکمل گربه',
    emoji: '🐱',
    sortOrder: 45,
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
  {
    slug: 'rodent-supplies',
    labelFa: 'لوازم جوندگان',
    petType: 'rodent',
    description: 'غذا و لوازم جوندگان',
    emoji: '🐹',
    sortOrder: 100,
  },
] as const;

function row(
  partial: Omit<
    ShopDigikalaBatch1Part4Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopDigikalaBatch1Part4Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const hasBird = partial.petTypes.includes('bird');
  const hasRodent = partial.petTypes.includes('rodent');
  const suitable =
    hasDog && hasCat
      ? 'سگ و گربه'
      : hasDog
        ? 'سگ'
        : hasCat
          ? 'گربه'
          : hasBird
            ? 'پرنده'
            : hasRodent
              ? 'جوندگان'
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
    ...frontOnlyGallery(partial.slug),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
    params,
  };
}

export const SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS: ShopDigikalaBatch1Part4Product[] = [
  row({
    id: "p330",
    slug: "dog-food-dkp-20949593",
    title: "کنسرو سگ یو‌اس‌پت بز و کدو سبز ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    description:
      "همان خط های‌پریمیوم با طعم گوشت بز و کدو سبز؛ گزینه غیرمرسوم برای سگ‌هایی که مرغ و گاو را پس زده‌اند.\n\nبا مقدار کم شروع کن. کدو به گوارش بعضی‌ها کمک می‌کند — درمان اسهال نیست.\n\n۴۳۰ گرم.\n\n• بز و کدو سبز\n• ۴۳۰ گرم\n• یو اس پت\n• شروع تدریجی\n• نه درمان گوارشی\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p331",
    slug: "cat-treats-dkp-11596119",
    title: "خمیر مولتی‌ویتامین گربه پرسا ۲۰۰ گرم — بسته ۲ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 385_000,
    description:
      "بسته ۲ عددی خمیر ویتامین و مینرال پرسا؛ برای گربه‌هایی که بدغذا هستند یا دامپزشک مکمل خواسته.\n\nدوز روی برچسب — خودسر دو برابر نکن. جایگزین غذای کامل و آزمایش خون نیست.\n\nدور از گرما.\n\n• مولتی‌ویتامین خمیری\n• ۲۰۰ گرم × ۲\n• پرسا\n• طبق برچسب\n• جایگزین رژیم کامل نیست\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p332",
    slug: "cat-treats-dkp-7929885",
    title: "خمیر مالت گربه پرسا ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 195_840,
    description:
      "خمیر مالت ۱۰۰ گرمی پرسا با ویتامین؛ کمک به عبور مو و تشویقی لیسیدنی. درمان انسداد مو نیست.\n\nروی پنجه یا مستقیم از تیوب مقدار کم. اسهال شد قطع کن.\n\nاگر استفراغ مکرر دارد دامپزشک مقدم است.\n\n• مالت + ویتامین ۱۰۰ گرم\n• پرسا\n• کمک گلوله مو — نه تضمین\n• مقدار کم\n• استفراغ مکرر = کلینیک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p333",
    slug: "grooming-dkp-22460582",
    title: "دهان‌شویه سگ و گربه بایوپت اکتیو ۲۵۰ میل",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 1_602_000,
    description:
      "محلول دهان‌شویه ۲۵۰ میلی‌لیتری بایوپت اکتیو برای کمک به بهداشت دهان؛ جایگزین مسواک و جرم‌گیری دامپزشکی نیست.\n\nطبق برچسب رقیق/مصرف کن — دوز خودسرانه نده. اگر زخم دهان یا بوی بسیار شدید دارد اول کلینیک.\n\nدور از بلع حجم زیاد.\n\n• دهان‌شویه ۲۵۰ میل\n• بایو پت اکتیو\n• کمک بهداشت دهان\n• طبق برچسب — نه خودسر\n• جایگزین جرم‌گیری نیست\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p334",
    slug: "bird-food-dkp-16760701",
    title: "غذای گرینچیک کوکو پروت ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 479_500,
    description:
      "خوراک ۱ کیلویی مدل پروت برای گرین‌چیک/کوکو و پرندگان کوچک مشابه؛ پروتئین دانه‌ای روزمره.\n\nبا گونه دقیق پرنده‌ات چک کن که فرمول مناسبش باشد. آب تمیز جدا.\n\nکپک‌زده را دور بریز.\n\n• ۱ کیلو مدل پروت\n• پرندگان کوچک\n• چک تناسب گونه\n• آب تازه\n• دور از رطوبت\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p335",
    slug: "bird-food-dkp-8471877",
    title: "غذای مرغ مینا اوشکایا ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 478_550,
    description:
      "خوراک ۱ کیلویی اوشکایا برای مرغ مینا و حشره‌خوارها؛ با جیره عروس هلندی یکی نیست.\n\nمینا به تنوع پروتئینی بیشتر نیاز دارد. کاسه را هر روز عوض کن تا ترش نشود.\n\nمکمل میوه/سبزی طبق راهنمای گونه.\n\n• مخصوص مینا\n• ۱ کیلو اوشکایا\n• متفاوت از خوراک عروس\n• بهداشت روزانه\n• تنوع غذایی\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p336",
    slug: "bird-food-dkp-11307683",
    title: "غذای عروس هلندی کاسنر K12 — ۱۲۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 303_000,
    description:
      "مخلوط دانه عروس هلندی ۱۲۰۰ گرمی کد K12؛ پایه روزمره برای طوطی‌های کوچک مشابه عروس.\n\nفقط دانه کافی نیست — سبزی و پلت را هم وارد کن. کاسه را روزانه تمیز کن.\n\nتازه و خشک نگه دار.\n\n• عروس هلندی / K12\n• ۱۲۰۰ گرم\n• پایه دانه‌ای\n• بهداشت کاسه\n• تنوع غذایی اضافه کن\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p337",
    slug: "bird-food-dkp-16512508",
    title: "تشویقی پرنده طعم میوه ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 96_000,
    description:
      "تشویقی میوه‌ای ۱۰۰ گرمی برای تنوع نوک‌زدن؛ قند طبیعی دارد پس زیاده‌روی نکن.\n\nجیره اصلی را حذف نکن. اگر مدفوع شل شد کم کن.\n\nخشک و خنک نگه دار.\n\n• تشویقی میوه ۱۰۰ گرم\n• تنوع طعم\n• کنترل مقدار\n• نه جایگزین جیره\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p338",
    slug: "rodent-supplies-dkp-2909989",
    title: "غذای کامل جوندگان تاپ‌فید ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 550_000,
    description:
      "خوراک کامل ۱ کیلویی تاپ‌فید برای جوندگان؛ پایه پلت/میکس کنار یونجه.\n\nگونه (همستر، خوکچه، خرگوش) را با برچسب چک کن. انتقال تدریجی.\n\nآب بطری تمیز.\n\n• تاپ فید ۱ کیلو\n• جیره کامل جوندگان\n• کنار یونجه\n• تعویض تدریجی\n• آب تمیز\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p339",
    slug: "rodent-supplies-dkp-20848635",
    title: "خوراک جوندگان آسوپت میکس پلت ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 350_860,
    description:
      "میکس پلت‌شده ۱ کیلویی برای یکنواخت‌تر خوردن؛ کمتر انتخاب‌کردن دانه‌های چرب توسط حیوان.\n\nپلت خردشده را دور بریز اگر کهنه شد. با یونجه ترکیب کن وقتی گونه لازم دارد.\n\nآب تازه.\n\n• پلت میکس ۱ کیلو\n• یکنواخت‌تر از دانه‌چین\n• کنار فیبر در صورت نیاز\n• کهنه نماند\n• آب تازه\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p340",
    slug: "rodent-supplies-dkp-12533105",
    title: "یونجه خشک خرگوش و جوندگان ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 235_000,
    description:
      "یونجه خشک ۱ کیلویی برای خرگوش و جوندگان گیاه‌خوار؛ فیبر ضروری روزمره.\n\nهمیشه در دسترس باشد مگر دامپزشک خلاف گفته. گرد و خاک زیاد را الک کن اگر حیوان عطسه می‌کند.\n\nمرطوب نشود.\n\n• یونجه خشک ۱ کیلو\n• خرگوش و جوندگان\n• فیبر پایه\n• خشک نگه دار\n• عطسه مداوم = بررسی کیفیت/گرد و خاک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p341",
    slug: "rodent-supplies-dkp-11804534",
    title: "غذای همستر نیچرفود ۱ ستاره ۵۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 181_000,
    description:
      "میکس ۵۰۰ گرمی مخصوص همستر؛ دانه و تکه برای جوندگان کوچک شب‌فعال.\n\nآجیل زیاد چاق می‌کند — پیمانه را رعایت کن. کاسه کوچک تازه کن.\n\nجایگزین یونجه برای گونه‌هایی که لازم دارند نیست.\n\n• همستر ۵۰۰ گرم\n• میکس دانه\n• کنترل آجیل\n• کاسه تمیز\n• تناسب گونه\n\n— پت دیت شاپ.\n\n---",
  }),
];

export { SHOP_DIGIKALA_BATCH1_PART4_SLUGS };

export function seedShopDigikalaBatch1Part4Products(): number {
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
  for (const p of SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS) {
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
