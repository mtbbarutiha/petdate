/**
 * Royal Canin pilot shop SKUs — additive, idempotent upsert by slug.
 * Safe on every API boot (SQLite + Postgres). Does not wipe other catalog rows.
 * Margin 0 (cost_toman = price_toman). Seller copy is پت دیت شاپ only.
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';

const P = '/pepito/uploads';
const G = 'gallery-v1';
function rcGallery(stem: string): { image: string; images: string[] } {
  const images = [
    `${P}/${stem}.jpg?v=${G}`,
    `${P}/${stem}-2.jpg?v=${G}`,
    `${P}/${stem}-3.jpg?v=${G}`,
  ];
  return { image: images[0]!, images };
}

export const ROYAL_CANIN_PILOT_VERSION = 4;

export type RoyalCaninPilotProduct = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  petTypes: string[];
  priceToman: number;
  costToman: number;
  image: string;
  /** PDP gallery — three distinct #FFFFFF packshot files per SKU */
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
    description: 'غذای خشک، کنسرو و سوپ سگ',
    emoji: '🦴',
    sortOrder: 10,
  },
  {
    slug: 'cat-food',
    labelFa: 'غذای گربه',
    petType: 'cat',
    description: 'غذای خشک، کنسرو و پوچ',
    emoji: '🐟',
    sortOrder: 20,
  },
] as const;

export const ROYAL_CANIN_PILOT_PRODUCTS: RoyalCaninPilotProduct[] = [
  {
    id: 'p221',
    slug: 'dog-food-royal-canin-mini-adult-2kg',
    title: 'رویال کنین مینی ادالت ۲ کیلو — سگ بالغ نژاد کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_881_000,
    costToman: 8_881_000,
    ...rcGallery('royal-canin-mini-adult-2kg'),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
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
  },
  {
    id: 'p222',
    slug: 'dog-food-royal-canin-xsmall-puppy-1-5kg',
    title: 'رویال کنین ایکس‌اسمال پاپی ۱٫۵ کیلو — توله نژاد خیلی کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_294_000,
    costToman: 8_294_000,
    ...rcGallery('royal-canin-xsmall-puppy-1.5kg'),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
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
  },
  {
    id: 'p223',
    slug: 'cat-food-royal-canin-persian-adult-400g',
    title: 'رویال کنین پرشین ادالت ۴۰۰ گرم — گربه پرشین بالغ',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 2_741_600,
    costToman: 2_741_600,
    ...rcGallery('royal-canin-persian-adult-400g'),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
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
  },
];

export const ROYAL_CANIN_PILOT_SLUGS = ROYAL_CANIN_PILOT_PRODUCTS.map((p) => p.slug);

export const ROYAL_CANIN_PILOT_PRICE_INDEX = ROYAL_CANIN_PILOT_PRODUCTS.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  brandId: p.brandId,
  categorySlug: p.categorySlug,
  priceToman: p.priceToman,
}));

export function seedRoyalCaninPilotProducts(): number {
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
  for (const p of ROYAL_CANIN_PILOT_PRODUCTS) {
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
