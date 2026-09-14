/**
 * PetDate shop Batch-multi wave 5/5 — 10 live SKUs (p290–p299).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Do not invent missing weights.
 * Gallery cache-bust is batch-multi-w5-v1 (wave 1–4 stay on their own busts).
 * Slug typo is historical: dog-carriers-*-carier-backpack (carier not carrier).
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH_MULTI_WAVE5_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH_MULTI_WAVE5_CACHE_BUST = "batch-multi-w5-v1";

function multiGallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH_MULTI_WAVE5_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatchMultiWave5Product = {
  id: string;
  slug: (typeof SHOP_BATCH_MULTI_WAVE5_SLUGS)[number];
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
    slug: 'grooming',
    labelFa: 'بهداشت و آراستگی',
    petType: 'dog',
    description: 'شامپو و برس',
    emoji: '🧴',
    sortOrder: 100,
  },
  {
    slug: 'dog-carriers',
    labelFa: 'کوله و باکس حمل سگ',
    petType: 'dog',
    description: 'کوله فضایی و کیف حمل',
    emoji: '🧳',
    sortOrder: 110,
  },
  {
    slug: 'cat-carriers',
    labelFa: 'کوله و باکس حمل گربه',
    petType: 'cat',
    description: 'کوله فضایی و باکس حمل',
    emoji: '🎒',
    sortOrder: 120,
  },
  {
    slug: 'bird-food',
    labelFa: 'غذای پرنده',
    petType: 'bird',
    description: 'دان، پلت و مخلوط غذایی',
    emoji: '🐦',
    sortOrder: 130,
  },
] as const;

function row(
  partial: Omit<
    ShopBatchMultiWave5Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight?: string;
    color?: string;
    model?: string;
    size?: string;
  }
): ShopBatchMultiWave5Product {
  const hasDog = partial.petTypes.includes('dog');
  const hasCat = partial.petTypes.includes('cat');
  const hasBird = partial.petTypes.includes('bird');
  const suitable = hasDog && hasCat ? 'سگ و گربه' : hasDog ? 'سگ' : hasCat ? 'گربه' : hasBird ? 'پرنده' : 'سگ و گربه';
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

export const SHOP_BATCH_MULTI_WAVE5_PRODUCTS: ShopBatchMultiWave5Product[] = [
  row({
    id: "p290",
    slug: "grooming-bonnest-calming-shampoo-for-pet-200-l",
    title: "شامپو آرامش‌بخش بونست",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 680_000,
    description:
      "شامپو آرامش‌بخش بونست برای حمام روزمره سگ و گربه وقتی پوست حساس است یا حیوان از شست‌وشو می‌ترسد.\n\nشامپو غذا نیست و جای درمان دامپزشکی را نمی‌گیرد. وارد چشم نکن. بعد شست‌وشو خوب آبکشی کن.\n\nاگر زخم باز یا عفونت پوست دارد اول کلینیک.\n\n• شامپو آرامش‌بخش بونست\n• مناسب سگ و گربه\n• برای حمام خانگی\n• دور از چشم\n• جایگزین درمان پوست نیست\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p291",
    slug: "grooming-spray-massage-brush-for-pet",
    title: "برس هوشمند اسپری دار طرح انبه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 520_000,
    description:
      "برس اسپری‌دار طرح انبه برای شانه و ماساژ هم‌زمان. مخزن را با آب یا اسپری مجاز پر می‌کنی تا مو کمتر گره بخورد.\n\nهوشمند به معنی ربات نیست — اسپری و دندانه کار را راحت‌تر می‌کند. روی پوست زخمی نکش.\n\nبعد استفاده مخزن را خالی و خشک کن.\n\n• برس اسپری‌دار طرح انبه\n• مناسب سگ و گربه\n• ماساژ + شانه\n• نه روی پوست ملتهب\n• مخزن را خشک نگه دار\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p292",
    slug: "dog-carriers-fiber-space-pet-carrier-backpack",
    title: "کوله فضایی سگ و گربه مدل فایبر",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 6_160_000,
    model: "فایبر",
    description:
      "کوله فضایی مدل فایبر برای بردن سگ یا گربه کوچک در مسیرهای شهری. پنجره‌ها دید می‌دهند و هوا بهتر رد می‌شود.\n\nقبل خرید وزن و جثه را با کوله بسنج؛ حیوان باید بتواند بچرخد نه اینکه فشرده شود. بندها را روی هر دو شانه تنظیم کن.\n\nجایگزین باکس سفر هوایی تأییدشده نیست مگر مشخصات پرواز را جدا چک کنی.\n\n• کوله فضایی فایبر\n• مناسب سگ و گربه کوچک\n• تهویه و دید\n• اندازه با جثه\n• نه لزوماً تأیید ایرلاین\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p293",
    slug: "dog-carriers-luxury-leather-space-pet-carier-backpack",
    title: "کوله فضایی لاکچری چرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_795_000,
    description:
      "کوله فضایی با روکش چرم برای مسیر کوتاه شهری. ظاهر مرتب‌تر از کوله پارچه‌ای ساده.\n\nچرم را خیس نگذار. حیوان را مدت طولانی در گرما داخل کوله نگذار — تهویه را باز نگه دار.\n\nبند و زیپ را قبل هر خروج چک کن.\n\n• کوله فضایی چرم لاکچری\n• مناسب مسیر شهری\n• مراقبت چرم\n• تهویه باز\n• چک زیپ و بند\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p294",
    slug: "dog-carriers-leather-pet-carier-backpack",
    title: "کوله فضایی چرمی پارک دار",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_650_000,
    description:
      "کوله فضایی چرمی با فضای پارک‌مانند داخل؛ حیوان جای پا دارد و کمتر روی هم جمع می‌شود.\n\nچرم را خشک نگه دار. برای حیوان سنگین یا خیلی بی‌قرار مدل سفت‌تر/باکس سخت بهتر است.\n\nروی زمین داغ نگذار.\n\n• کوله چرمی پارک‌دار\n• فضای داخلی بازتر\n• مراقبت چرم\n• مناسب جثه متناسب\n• نه روی سطح داغ\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p295",
    slug: "cat-carriers-zarix-zeus-for-cat",
    title: "کوله فضایی مدل زئوس",
    titleEn: "",
    brandId: "zarix",
    categorySlug: "cat-carriers",
    petTypes: ["cat"],
    priceToman: 4_274_000,
    model: "زئوس",
    description:
      "کوله فضایی مدل زئوس برای گربه؛ دید اطراف و حمل روی شانه یا پشت.\n\nگربه‌ای که تا حالا کوله ندیده اول در خانه عادت بده — در را باز بگذار و تشویقی بده. زیپ را کامل ببند.\n\nجایگزین باکس دامپزشکی سفت نیست اگر گربه خیلی مضطرب است.\n\n• کوله فضایی زئوس\n• برند زریکس\n• مناسب گربه\n• عادت تدریجی در خانه\n• زیپ کامل\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p296",
    slug: "cat-carriers-raha-pet-hard-box-3",
    title: "باکس حمل سگ و گربه رها",
    titleEn: "",
    brandId: "raha",
    categorySlug: "cat-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 3_960_000,
    description:
      "باکس سخت رها برای تاکسی، کلینیک و جابه‌جایی کوتاه. دیواره سفت یعنی محافظت بیشتر از کوله نرم.\n\nقفل در را قبل حرکت چک کن. برای پرواز قوانین ایرلاین را جدا بخوان.\n\nتهویه را نبند.\n\n• باکس سخت رها\n• مناسب سگ و گربه\n• قفل در\n• تهویه باز\n• کلینیک و مسیر شهری\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p297",
    slug: "cat-carriers-jupiter-cat-hard-box",
    title: "باکس حمل سگ و گربه ژوپیتر",
    titleEn: "",
    brandId: "jupiter",
    categorySlug: "cat-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 2_970_000,
    description:
      "باکس حمل سخت ژوپیتر؛ انتخاب وسط بین کوله نرم و باکس خیلی بزرگ.\n\nکف را با حوله نازک بپوشان. اگر حیوان پنجه می‌زند قفل را دوباره چک کن.\n\nجای بازی خانگی نیست.\n\n• باکس سخت ژوپیتر\n• مناسب سگ و گربه\n• کف ضدلغزش/حوله\n• قفل دوباره چک شود\n• برای جابه‌جایی نه خواب دائم\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p298",
    slug: "bird-food-oshkaia-mixed-nut-cockatiel-food-kg",
    title: "خوراک آجیلی مخلوط عروس هلندی اوشکایا",
    titleEn: "",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 525_000,
    description:
      "خوراک آجیلی مخلوط اوشکایا برای عروس هلندی؛ تنوع مغز و دانه به‌جای دان ساده تکراری.\n\nآجیل چرب است — سهم را کنترل کن تا وزن نپرد. آب تازه همیشه باشد. جایگزین بررسی بال و مدفوع نیست.\n\nدور از رطوبت نگه دار.\n\n• مخلوط آجیلی عروس هلندی\n• برند اوشکایا\n• تنوع دانه\n• سهم را کنترل کن\n• جای خشک\n\n— پت دیت شاپ.",
  }),
  row({
    id: "p299",
    slug: "bird-food-oshkaia-mynah-bird-food-kg",
    title: "خوراک مرغ مینا و پرندگان حشره‌خوار اوشکایا",
    titleEn: "",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 495_000,
    description:
      "خوراک اوشکایا برای مرغ مینا و پرندگان حشره‌خوار؛ پروتئین بیشتر از دان طوطی معمولی.\n\nحشره‌خوارها به تنوع نیاز دارند — این بسته کمک روزانه است نه تمام رژیم. اگر اسهال یا بی‌اشتهایی دیدی قطع کن و با دامپزشک پرندگان حرف بزن.\n\nخشک و دربسته نگه دار.\n\n• خوراک مینا / حشره‌خوار\n• برند اوشکایا\n• پروتئین بالاتر از دان ساده\n• تنوع رژیم را فراموش نکن\n• نگهداری خشک\n\n— پت دیت شاپ.",
  }),
];

export { SHOP_BATCH_MULTI_WAVE5_SLUGS };

export function seedShopBatchMultiWave5Products(): number {
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
  for (const p of SHOP_BATCH_MULTI_WAVE5_PRODUCTS) {
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
