/**
 * PetDate shop Digikala batch1 Part1 — 10 live SKUs (p300–p309).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent Zivan/ژیوان supplier names.
 * Gallery cache-bust is digikala-b1-p1-v1 (batch-multi waves stay on their own busts).
 * Packshot JPEGs land in a follow-up commit — catalog URLs are wired now.
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_DIGIKALA_BATCH1_PART1_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_DIGIKALA_BATCH1_PART1_CACHE_BUST = 'digikala-b1-p1-v1';

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_DIGIKALA_BATCH1_PART1_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_DIGIKALA_BATCH1_PART1_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_DIGIKALA_BATCH1_PART1_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopDigikalaBatch1Part1Product = {
  id: string;
  slug: (typeof SHOP_DIGIKALA_BATCH1_PART1_SLUGS)[number];
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
    description: 'غذای خشک، کنسرو و پوچ',
    emoji: '🐟',
    sortOrder: 20,
  },
  {
    slug: 'dog-food',
    labelFa: 'غذای سگ',
    petType: 'dog',
    description: 'غذای خشک، کنسرو و سوپ سگ',
    emoji: '🦴',
    sortOrder: 10,
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
    slug: 'cat-toys',
    labelFa: 'اسباب بازی گربه',
    petType: 'cat',
    description: 'موش، میله و اسباب‌بازی',
    emoji: '🐭',
    sortOrder: 60,
  },
] as const;

function row(
  partial: Omit<
    ShopDigikalaBatch1Part1Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopDigikalaBatch1Part1Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const suitable = hasDog && hasCat ? 'سگ و گربه' : hasDog ? 'سگ' : hasCat ? 'گربه' : 'سگ و گربه';
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

export const SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS: ShopDigikalaBatch1Part1Product[] = [
  row({
    id: 'p300',
    slug: 'cat-food-dkp-21263751',
    title: 'کنسرو گربه بالغ گورمت طعم مرغ — بسته ۶ عددی',
    titleEn: '',
    brandId: 'gourmet',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 1_549_000,
    description:
      'بسته ۶ عددی کنسرو گورمت با طعم مرغ برای گربه بالغ؛ تنوع تر کنار کیسه خشک.\n\nبرچسب هر قوطی را برای بافت بخوان. باقیمانده را یخچال کن.\n\nحساسیت مرغ را جدی بگیر.\n\n• طعم مرغ\n• بسته ۶ عددی\n• گورمت\n• گربه بالغ\n• یخچال بعد باز شدن\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p301',
    slug: 'cat-food-dkp-10928475',
    title: 'گورمت گلد پته بوقلمون ۸۵ گرم',
    titleEn: '',
    brandId: 'gourmet',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 249_000,
    weight: '۸۵ گرم',
    description:
      'کاپ ۸۵ گرمی گورمت گلد بافت پته بوقلمون؛ تشویقی وعده‌ای یا تکمیل خشک برای بدغذاها.\n\nبسته کوچک یعنی کمتر دورریز. تمام‌شده را دور نریز در گرما.\n\n• پته بوقلمون\n• ۸۵ گرم\n• گورمت گلد\n• گربه\n• یخچال بعد باز شدن\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p302',
    slug: 'dog-food-dkp-15589693',
    title: 'پودینگ سگ ونپی اردک، هویج و نخود ۹۰ گرم',
    titleEn: '',
    brandId: 'wanpy',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 186_000,
    weight: '۹۰ گرم',
    description:
      'پودینگ نرم ۹۰ گرمی ونپی با اردک و سبزی؛ بافت متفاوت از کنسرو تکه‌ای برای سگ‌های مسن یا بدغذا.\n\nقاشق بزن روی خشک یا جدا. از کالری روزانه کم کن.\n\n• پودینگ اردک/سبزی\n• ۹۰ گرم\n• ونپی\n• سگ\n• تشویقی/مکمل وعده\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p303',
    slug: 'cat-treats-dkp-9520987',
    title: 'قرص ضد انگل ورمکس — فقط با نظر دامپزشک',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-treats',
    petTypes: ['dog'],
    priceToman: 480_000,
    description:
      'قرص ضد انگل مدل استخوانی‌خوش‌طعم، بسته ۱۰ عددی. **انگل‌کشی خودسرانه نکن؛ وزن، گونه و نوع انگل را دامپزشک تعیین می‌کند.**\n\nجایگزین معاینه و نسخه نیست.\n\n• ضد انگل — فقط با نظر دامپزشک\n• ۱۰ عدد\n• خوش‌طعم\n• دوز فقط با کلینیک\n• جایگزین تشخیص نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p304',
    slug: 'cat-treats-dkp-3333058',
    title: 'پودر پروبیوتیک سگ و گربه بیودپ — ۱۵ ساشه',
    titleEn: '',
    brandId: 'biodop',
    categorySlug: 'cat-treats',
    petTypes: ['dog', 'cat'],
    priceToman: 200_000,
    description:
      'ساشه پروبیوتیک بیودپ برای حمایت فلور روده بعد اسهال یا آنتی‌بیوتیک؛ **طبق نظر دامپزشک مصرف کن.**\n\nبا غذا مخلوط کن. اسهال طولانی = کلینیک.\n\n• پروبیوتیک بیودپ\n• ۱۵ ساشه\n• سگ و گربه\n• طبق دامپزشک\n• جایگزین درمان نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p305',
    slug: 'cat-toys-dkp-17977789',
    title: 'توپ هوشمند گربه LP20',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 1_222_000,
    model: 'LP20',
    description:
      'توپ خودکار مدل LP20 برای دنبال‌کردن بدون میله دستی. روی سرامیک بهتر از فرش پرزبلند می‌چرخد.\n\nشارژ/باتری طبق بسته. اگر گرم شد خاموش کن.\n\n• توپ LP20\n• بازی خودکار\n• گربه\n• سطح صاف\n• نظارت اولیه\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p306',
    slug: 'cat-toys-dkp-17292457',
    title: 'توپ حرکتی نورانی پاس‌لاو با حسگر',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 590_000,
    description:
      'توپ هوشمند نورانی با حسگر حرکت؛ وقتی گربه نزدیک می‌شود مسیر عوض می‌کند. برای آپارتمان بدون میله‌دار.\n\nباتری را چک کن و شب خاموش بگذار.\n\n• توپ نورانی حسگر\n• پاس‌لاو\n• گربه\n• خاموش بین بازی\n• نظارت اولیه\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p307',
    slug: 'cat-toys-dkp-17411871',
    title: 'پر متحرک با پایه ثابت',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 489_450,
    description:
      'میله پر روی پایه ثابت؛ دستت آزاد است و گربه دور پایه می‌چرخد. جایگزین میله دستی برای خانه‌های شلوغ.\n\nپایه را سنگین/ثابت کن تا نیفتد.\n\n• پر متحرک پایه ثابت\n• گربه\n• بازی شکار\n• پایه پایدار\n• نظارت اگر پاره شد\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p308',
    slug: 'cat-toys-dkp-5570618',
    title: 'اسباب‌بازی زنگوله‌دار مدل Bell',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 390_000,
    model: 'Bell',
    description:
      'اسباب‌بازی با زنگوله برای جلب توجه شنوایی گربه و سگ بازی‌گوش. صدای زنگ را بعضی حیوانات دوست ندارند — کوتاه تست کن.\n\nبند و قطعات کوچک را چک کن.\n\n• زنگوله‌دار Bell\n• گربه (و سگ کنجکاو)\n• صدای ملایم تست شود\n• ایمنی بند\n• بازی نظارت‌شده\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p309',
    slug: 'cat-toys-dkp-17412089',
    title: 'اسباب‌بازی کرم تعاملی Worm — ۴۰ گرم',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 380_000,
    weight: '۴۰ گرم',
    model: 'Worm',
    description:
      'کرم متحرک تعاملی ۴۰ گرمی برای شکار روی زمین؛ غریزه گربه و سگ کنجکاو را درگیر می‌کند.\n\nقطعه‌های جداشونده را قورت ندهد — زیر نظر.\n\n• کرم تعاملی Worm\n• حدود ۴۰ گرم\n• شکار خانگی\n• نظارت روی بلع\n• باتری طبق بسته\n\n— پت دیت شاپ.',
  }),
];

export { SHOP_DIGIKALA_BATCH1_PART1_SLUGS };

export function seedShopDigikalaBatch1Part1Products(): number {
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
  for (const p of SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS) {
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
