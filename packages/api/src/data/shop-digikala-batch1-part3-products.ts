/**
 * PetDate shop Digikala batch1 Part3 — 10 live SKUs (p320–p329).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. White #FFFFFF packshots; cache-bust digikala-b1-p3-v1.
 * Front-only galleries (single real angle — do not invent -2/-3).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART3_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_DIGIKALA_BATCH1_PART3_CACHE_BUST = "digikala-b1-p3-v1";

function frontOnlyGallery(slug: string): { image: string; images: string[] } {
  const image = `${P}/${slug}.jpg?v=${SHOP_DIGIKALA_BATCH1_PART3_CACHE_BUST}`;
  return { image, images: [image] };
}

export type ShopDigikalaBatch1Part3Product = {
  id: string;
  slug: (typeof SHOP_DIGIKALA_BATCH1_PART3_SLUGS)[number];
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
    slug: 'cat-food',
    labelFa: 'غذای گربه',
    petType: 'cat',
    description: 'خشک و تر گربه',
    emoji: '🐱',
    sortOrder: 20,
  },
  {
    slug: 'dog-food',
    labelFa: 'غذای سگ',
    petType: 'dog',
    description: 'خشک و تر سگ',
    emoji: '🐶',
    sortOrder: 10,
  },
] as const;

function row(
  partial: Omit<
    ShopDigikalaBatch1Part3Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopDigikalaBatch1Part3Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const suitable =
    hasDog && hasCat
      ? 'سگ و گربه'
      : hasDog
        ? 'سگ'
        : hasCat
          ? 'گربه'
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

export const SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS: ShopDigikalaBatch1Part3Product[] = [
  row({
    id: "p320",
    slug: "cat-food-dkp-21258454",
    title: "پوچ بچه‌گربه یامیکس مرغ و جگر — بسته ۶ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 828_000,
    description:
      "پک ۶ عددی پوچ پته مرغ و جگر مخصوص بچه‌گربه؛ بافت نرم برای دندان شیری و دوره رشد.\n\nجای شیر خشک اضطراری نیست. تدریجی با غذای قبلی قاطی کن. اسهال طولانی = دامپزشک.\n\nهر ساشه را جدا باز کن.\n\n• بچه گربه / مرغ و جگر\n• بسته ۶ عددی\n• برند یامیکس\n• بافت پته نرم\n• تعویض تدریجی\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p321",
    slug: "cat-food-dkp-20696007",
    title: "کنسرو گربه پابلو پته گوشت گاو ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 275_000,
    description:
      "پته گوشت گاو پابلو در قوطی بزرگ ۸۰۰ گرمی؛ برای گربه‌هایی که بافت نرم را به تکه‌های سفت ترجیح می‌دهند.\n\nبعد باز شدن در یخچال بگذار و زود مصرف کن. از سهم خشک روزانه کم کن تا وزن نپرد. اگر اسهال شد بافت/برند را عوض کن و در صورت ادامه دامپزشک.\n\nجایگزین رژیم درمانی نیست.\n\n• پته طعم گوشت گاو\n• ۸۰۰ گرم\n• برند پابلو\n• بعد باز شدن یخچال\n• وعده کامل تر / مکمل خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p322",
    slug: "cat-food-dkp-20696405",
    title: "کنسرو گربه پابلو پته گوشت و مرغ ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 275_000,
    description:
      "پته ترکیبی گوشت و مرغ پابلو، قوطی ۸۰۰ گرمی؛ برای گربه‌هایی که یک طعم خالص را زود پس می‌زنند.\n\nقاشق را بین گوشت خام خانه و کنسرو یکی نکن. پیمانه را با وزن تنظیم کن.\n\nجایگزین رژیم بیمارستانی نیست.\n\n• پته گوشت و مرغ\n• ۸۰۰ گرم\n• پابلو\n• تنوع طعم\n• بهداشت سرو\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p323",
    slug: "cat-food-dkp-19887269",
    title: "کنسرو گربه پابلو تن، مرغ و گوساله ۴۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 175_000,
    description:
      "کنسرو ۴۰۰ گرمی پابلو با ترکیب تن ماهی، مرغ و گوساله؛ انتخاب متنوع برای بدغذاهای سخت‌گیر.\n\nماهی را هر روز تنها نده؛ تعادل با خط‌های دیگر بهتر است. استخوان نداشته باشد ولی تکه را چک کن.\n\nآب جدا فراموش نشود.\n\n• تن + مرغ + گوساله\n• ۴۰۰ گرم\n• پابلو\n• تنوع پروتئین\n• آب تازه جدا\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p324",
    slug: "cat-food-dkp-20695998",
    title: "کنسرو گربه پابلو پته گوشت گاو ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 175_000,
    description:
      "همان خط پته گوشت گاو پابلو در قوطی ۴۳۰ گرمی؛ برای یک‌دو وعده یا تست طعم قبل از قوطی بزرگ.\n\nبافت نرم برای بدغذاها. قاشق تمیز بزن و باقی را بپوشان.\n\nاگر گاو را پس زد طعم مرغ همان برند را امتحان کن.\n\n• پته گوشت گاو\n• ۴۳۰ گرم\n• پابلو\n• مناسب تست طعم\n• بهداشت قاشق و درب\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p325",
    slug: "cat-food-dkp-21930259",
    title: "کنسرو گربه بالغ پولر مرغ و پرندگان ۴۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 158_000,
    description:
      "کنسرو پریمیوم پولر با طعم مرغ و گوشت پرندگان، ۴۰۰ گرم؛ گزینه تر برای گربه بالغ کنار خشک.\n\nمرغ حساسیت شایع است — با تکه کوچک شروع کن. آب جدا بگذار حتی با کنسرو.\n\nجایگزین تجویز دامپزشک نیست.\n\n• طعم مرغ و پرندگان\n• ۴۰۰ گرم\n• برند پولر\n• گربه بالغ\n• شروع با مقدار کم\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p326",
    slug: "dog-food-dkp-6236417",
    title: "کنسرو سگ شایر سیرابی ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 366_700,
    description:
      "قوطی بزرگ ۸۰۰ گرمی شایر با طعم سیرابی؛ برای سگ‌های متوسط که کنسرو را به‌عنوان بخش تر رژیم می‌گیرند.\n\nبعد باز شدن یخچال و مصرف در دو سه روز. بوی سیرابی تند است.\n\nتعادل با خشک کامل.\n\n• سیرابی ۸۰۰ گرم\n• شایر\n• قوطی بزرگ\n• یخچال بعد باز شدن\n• ترکیب با خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p327",
    slug: "dog-food-dkp-20620037",
    title: "کنسرو سگ دکتر کلادرز پته بوقلمون ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 270_000,
    description:
      "کاپ ۱۰۰ گرمی پته بوقلمون دکتر کلادرز؛ جایزه وعده‌ای یا اشتها‌آور کنار خشک.\n\nاندازه کوچک یعنی کنترل راحت‌تر وزن. تمام را یک‌جا نده به سگ حریص.\n\nجایگزین وعده اصلی بزرگ نیست.\n\n• پته بوقلمون ۱۰۰ گرم\n• دکتر کلادرز\n• کاپ کوچک\n• کنترل سهم\n• اشتها‌آور / تشویقی وعده\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p328",
    slug: "dog-food-dkp-20949467",
    title: "کنسرو سگ یو‌اس‌پت بره و سیرابی ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    description:
      "کنسرو بره و سیرابی یو‌اس‌پت ۴۳۰ گرم؛ طعم قوی برای سگ‌های بدغذا.\n\nسیرابی برای بعضی معده‌ها سنگین است — نصف کن و ببین. بوی قوی دارد؛ در ظرف دربسته سرو کن.\n\nحساسیت پروتئین را جدی بگیر.\n\n• بره و سیرابی\n• ۴۳۰ گرم\n• یو اس پت\n• طعم قوی\n• شروع با نصف وعده\n\n— پت دیت شاپ.\n\n---",
  }),
  row({
    id: "p329",
    slug: "dog-food-dkp-20949492",
    title: "کنسرو سگ یو‌اس‌پت شترمرغ و بلوبری ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    description:
      "کنسرو های‌پریمیوم یو‌اس‌پت با طعم شترمرغ و بلوبری، ۴۳۰ گرم؛ پروتئین متفاوت برای تنوع کنار خشک.\n\nشترمرغ برای بعضی سگ‌های حساس گزینه‌ای غیرمرغ است — باز هم با دامپزشک اگر آلرژی ثابت شده. از کالری روزانه کم کن.\n\nجایگزین غذای کامل خشک در بلندمدت بدون برنامه نیست مگر برچسب بگوید کامل.\n\n• شترمرغ و بلوبری\n• ۴۳۰ گرم\n• یو اس پت\n• تنوع پروتئین\n• سهم کالری را کم کن\n\n— پت دیت شاپ.\n\n---",
  }),
];

export { SHOP_DIGIKALA_BATCH1_PART3_SLUGS };

export function seedShopDigikalaBatch1Part3Products(): number {
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
  for (const p of SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS) {
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
