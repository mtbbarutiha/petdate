/**
 * PetDate shop Batch 2 — 12 live SKUs including Josera Kitten.
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only.
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH2_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH2_CACHE_BUST = 'batch2-v1';

function batch2Gallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH2_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH2_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH2_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatch2Product = {
  id: string;
  slug: (typeof SHOP_BATCH2_SLUGS)[number];
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

function row(
  partial: Omit<
    ShopBatch2Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight: string;
    country: string;
    suitable: string;
  }
): ShopBatch2Product {
  return {
    ...partial,
    costToman: partial.priceToman,
    ...batch2Gallery(partial.slug),
    badge: 'new',
    inStock: true,
    stockQty: 25,
    featured: true,
    params: {
      وزن: partial.weight,
      مناسب_برای: partial.suitable,
      کشور_برند: partial.country,
      نوع_غذا: 'خشک',
      __titleEn: partial.titleEn,
    },
  };
}

export const SHOP_BATCH2_PRODUCTS: ShopBatch2Product[] = [
  row({
    id: 'p224',
    slug: 'dog-food-royal-canin-mini-indoor-puppy-1-5kg',
    title: 'رویال کنین مینی ایندور پاپی ۱٫۵ کیلو — توله نژاد کوچک آپارتمانی',
    titleEn: 'Royal Canin Mini Indoor Puppy Dry Dog Food',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_294_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'توله نژاد کوچک زندگی‌خانگی تا حدود ۱۰ کیلو',
    description:
      'برای توله‌های نژاد کوچک که بیشتر وقت را داخل خانه می‌گذرانند. انرژی و گوارش با زندگی کم‌تحرک‌تر آپارتمان هماهنگ‌تر دیده شده تا فقط «پاپی عمومی».\n\nتوله خانگی کمتر می‌دود ولی همان رشد استخوان و دندان را می‌خواهد. Mini Indoor Puppy برای نژاد کوچک تا حدود ۱۰ کیلو در دوره توله است. دانه‌ها برای پوزه ریز مناسب‌اند و فرمول به کنترل مدفوع و بو در فضای بسته هم فکر کرده — کمک، نه تضمین صفر بو. واکسن و چکاپ سر جایش؛ غذا جایگزین دامپزشک نیست.\n\n• مخصوص توله نژاد کوچک زندگی‌خانگی\n• مناسب پوزه کوچک و دوره رشد\n• توجه به گوارش و کیفیت مدفوع در آپارتمان\n• پشتیبانی رشد در ماه‌های توله\n• بسته ۱٫۵ کیلو برای شروع و تست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p225',
    slug: 'dog-food-royal-canin-xsmall-adult-1-5kg',
    title: 'رویال کنین ایکس‌اسمال ادالت ۱٫۵ کیلو — سگ بالغ نژاد خیلی کوچک',
    titleEn: 'Royal Canin X-Small Adult Dry Dog Food 1.5kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 7_841_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'سگ بالغ نژاد خیلی کوچک تا حدود ۴ کیلو',
    description:
      'ادامه مسیر ایکس‌اسمال برای سگ بالغ با وزن ایده‌آل تا حدود ۴ کیلو. دانه خیلی کوچک، کالری متناسب جثه ریز، پوست و مو در اولویت.\n\nنژاد خیلی کوچک بدغذا و زودچاق است. X-Small Adult برای بعد از دوره توله است؛ دانه‌ها با پوزه ریز جورند و فرمول به حفظ وزن متعادل و پوشش مو کمک می‌کند. اگر هنوز توله است سراغ خط پاپی برو. جایگزین رژیم بیمارستانی نیست.\n\n• مناسب سگ بالغ نژاد خیلی کوچک (تا حدود ۴ کیلو)\n• دانه خیلی کوچک\n• کمک به حفظ وزن متعادل\n• پشتیبانی پوست و مو\n• مکمل طبیعی خط ایکس‌اسمال پاپی\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p226',
    slug: 'dog-food-royal-canin-mini-puppy-2kg',
    title: 'رویال کنین مینی پاپی ۲ کیلو — توله نژاد کوچک',
    titleEn: 'Royal Canin Mini Puppy Dog Food 2kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 8_881_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'توله نژاد کوچک، حدود ۱ تا ۱۰ ماهگی',
    description:
      'دانه مناسب پوزه کوچک برای توله‌های نژاد کوچک، تقریباً از ۱ تا ۱۰ ماهگی. انرژی رشد، پشتیبانی استخوان و عضله، خوش‌خوراک برای بدغذاهای ریز.\n\nتوله نژاد کوچک سریع رشد می‌کند و معده‌اش هم زود پر می‌شود. Mini Puppy برای همین بازه است: حدود ۱ تا ۱۰ ماه، جثه کوچک. دانه‌ها جویدن را راحت‌تر می‌کنند؛ فرمول برای کمک به رشد استخوان و عضله و پشتیبانی ایمنی در ماه‌های حساس تنظیم شده — نه معجزه یک‌شبه. تعویض غذا را تدریجی کن و اگر اسهال یا بی‌اشتهایی دیدی با دامپزشک هماهنگ شو. جایگزین برنامه تجویزی نیست.\n\n• مناسب توله نژاد کوچک، حدود ۱ تا ۱۰ ماهگی\n• دانه مناسب پوزه کوچک\n• انرژی متناسب دوره رشد\n• پشتیبانی از استخوان، عضله و ایمنی\n• خوش‌خوراک برای توله‌های سخت‌گیر\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p227',
    slug: 'dog-food-royal-canin-pomeranian-adult-1-5kg',
    title: 'رویال کنین پامرانین ادالت ۱٫۵ کیلو — مخصوص پامرانین بالغ',
    titleEn: 'Royal Canin Pomeranian Adult Dry Dog Food',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 7_826_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'پامرانین بالغ از حدود ۸ ماهگی',
    description:
      'خط نژادمحور برای پامرانین بالغ از حدود ۸ ماهگی. دانه و فرمول با پوزه کوچک، پوشش پر و انرژی این نژاد هماهنگ شده.\n\nپامرانین مو زیاد می‌ریزد و بدغذا هم کم نیست. این خط برای حمایت از پوست و پوشش، جویدن راحت، و نیازهای کالری جثه کوچک است — نه شامپوی معجزه. اگر آلرژی یا بیماری خاص دارد اول دامپزشک. جایگزین تجویز نیست.\n\n• مخصوص پامرانین بالغ (از حدود ۸ ماه)\n• دانه مناسب پوزه کوچک\n• توجه به پوست و پوشش پر\n• خوش‌خوراک برای بدغذاهای ریز\n• بسته ۱٫۵ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p228',
    slug: 'dog-food-royal-canin-shih-tzu-adult-1-5kg',
    title: 'رویال کنین شیتزو ادالت ۱٫۵ کیلو — مخصوص شیتزو بالغ',
    titleEn: 'Royal Canin Shih Tzu Adult Dog Food',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 7_841_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'شیتزو بالغ بالای حدود ۱۰ ماه',
    description:
      'برای شیتزو بالغ بالای حدود ۱۰ ماه. صورت کوتاه، پوست حساس و موی بلند این نژاد در طراحی دانه و فرمول دیده شده.\n\nشیتزو راحت با دانه درشت کلنجار می‌رود و پوستش زود قرمز می‌شود. این خط دانه را با فک کوتاه‌تر جور کرده و به پوست و پوشش کمک می‌کند. آرایشگاه جای جرم‌گیری دندان دامپزشکی را نمی‌گیرد؛ غذا هم نسخه پوستی نیست. در خارش شدید یا عفونت گوش به کلینیک برو.\n\n• مخصوص شیتزو بالغ (بالای حدود ۱۰ ماه)\n• دانه مناسب فک و صورت کوتاه\n• پشتیبانی پوست و موی بلند\n• توجه به خوش‌خوراکی\n• بسته ۱٫۵ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p229',
    slug: 'cat-food-josera-culinesse-2kg',
    title: 'جوسرا کولینس ۲ کیلو — گربه بالغ با گوارش حساس‌تر',
    titleEn: 'Josera Culinesse Cat Food',
    brandId: 'josera',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 4_004_000,
    weight: '۲ کیلوگرم',
    country: 'آلمان',
    suitable: 'گربه بالغ با گوارش حساس‌تر',
    description:
      'خشک کامل برای گربه بالغ؛ انتخاب رایج وقتی معده کمی حساس است و هنوز رژیم درمانی تجویز نشده. طعم و چربی متعادل‌تر از خط‌های خیلی چرب.\n\nCulinesse برای گربه‌ای است که غذای معمولی را پس می‌زند یا مدفوعش با برندهای تند به هم می‌ریزد — باز هم «کمک»، نه درمان بیماری گوارشی. آب در دسترس باشد. اگر استفراغ مکرر یا کاهش وزن داری، اول دامپزشک. این متن جایگزین تجویز نیست.\n\n• مناسب گربه بالغ\n• تمرکز روی خوش‌خوراکی و گوارش آرام‌تر\n• برند آلمانی جوسرا\n• بسته ۲ کیلو (وزن‌های دیگر روی منبع جداگانه)\n• تعویض تدریجی با غذای قبلی\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p230',
    slug: 'cat-food-josera-dailycat-2kg',
    title: 'جوسرا دیلی‌کت ۲ کیلو — غذای روزانه گربه بالغ',
    titleEn: 'Josera DailyCat',
    brandId: 'josera',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 3_900_000,
    weight: '۲ کیلوگرم',
    country: 'آلمان',
    suitable: 'گربه بالغ سالم برای مصرف روزانه',
    description:
      'غذای خشک روزمره برای گربه بالغ سالم. پروتئین حیوانی پررنگ، بدون پیچیدگی الکی؛ مناسب کسی که می‌خواهد یک خط ثابت و خوش‌خوراک روی کاسه بگذارد.\n\nDailyCat برای گربه‌ای است که زندگی عادی دارد — نه رژیم درمانی خاص. هدفش وعده کامل روزانه است با طعمی که خیلی از گربه‌ها قبول می‌کنند. آب تازه را فراموش نکن؛ گربه‌ها معمولاً کم می‌نوشند. اگر گربه‌ات عقیم است، کلیه حساس دارد یا دامپزشک خط خاصی گفته، قبل از تعویض بپرس. جایگزین تجویز دامپزشک نیست.\n\n• مناسب گربه بالغ سالم برای مصرف روزانه\n• برند آلمانی جوسرا، فرمول خشک کامل\n• تمرکز روی خوش‌خوراکی روزمره\n• بسته ۲ کیلو برای خانه و تست سلیقه\n• تعویض برند را چندروزه و تدریجی انجام بده\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p231',
    slug: 'cat-food-royal-canin-indoor-adult-400g',
    title: 'رویال کنین ایندور ادالت ۴۰۰ گرم — گربه بالغ خانگی',
    titleEn: 'Royal Canin Indoor Adult Cat Dry Food',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 2_742_000,
    weight: '۴۰۰ گرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ زندگی‌خانگی',
    description:
      'برای گربه بالغی که بیشتر وقت را داخل خانه می‌گذراند. کالری و فیبر با زندگی کم‌تحرک‌تر و گلوله مو هماهنگ‌تر دیده شده.\n\nگربه آپارتمانی کمتر شکار می‌کند و زودتر چاق می‌شود. Indoor به کنترل وزن و کمک به عبور مو از گوارش معروف است — کمک، نه رژیم لاغری تضمینی. بسته ۴۰۰ گرم برای تست سلیقه خوب است. مشکل ادراری یا استفراغ مکرر را با غذای خشک تنها حل نکن.\n\n• مناسب گربه بالغ زندگی‌خانگی\n• توجه به وزن و فعالیت کمتر\n• کمک به مدیریت گلوله مو\n• بسته ۴۰۰ گرم مناسب تست\n• جایگزین تجویز دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p232',
    slug: 'cat-food-royal-canin-british-shorthair-adult-400g',
    title: 'رویال کنین بریتیش شورت‌هیر ادالت ۴۰۰ گرم — مخصوص بریتیش بالغ',
    titleEn: 'Royal Canin British Shorthair Adult Cat Food',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 2_742_000,
    weight: '۴۰۰ گرم',
    country: 'فرانسه',
    suitable: 'بریتیش شورت‌هیر بالغ',
    description:
      'خط نژادمحور برای بریتیش شورت‌هیر بالغ. دانه درشت‌تر و قوس‌دار تا با فک قدرتمند این نژاد جور باشد؛ عضله و استخوان در طراحی فرمول دیده شده.\n\nبریتیش بدغذا نیست ولی انتخاب دانه برایش مهم است. این خط برای حمایت از توده عضلانی و مفاصل جثه سنگین‌تر ساخته شده — نه مکمل آرتروز. بسته ۴۰۰ گرم تست خوبی است قبل از کیسه بزرگ. بیماری کلیوی یا رژیم خاص = دامپزشک اول.\n\n• مخصوص بریتیش شورت‌هیر بالغ\n• دانه مناسب فک این نژاد\n• توجه به عضله و جثه توپر\n• بسته ۴۰۰ گرم\n• جایگزین رژیم درمانی نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p233',
    slug: 'cat-food-royal-canin-fit-2kg',
    title: 'رویال کنین فیت ۲ کیلو — گربه بالغ فعال و سالم',
    titleEn: 'Royal Canin Fit Cat Food 2kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 10_217_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ سالم با فعالیت روزمره',
    description:
      'غذای خشک کامل برای گربه بالغ سالم با فعالیت معمولی تا کمی بیرون‌رو. تعادل پروتئین و کالری برای حفظ وزن ایده‌آل بدون پیچیدگی خط‌های نژادمحور.\n\nFit انتخاب «همه‌فن حریف» برای گربه‌ای است که نه Indoor صرف است نه Sterilised تجویزی. وزن را ماه‌به‌ماه چک کن؛ پیمانه روی کیسه نقطه شروع است نه قانون ابدی. اگر عقیم شده و دامپزشک کالری کمتر خواسته، ممکن است خط استرلایزد مناسب‌تر باشد.\n\n• مناسب گربه بالغ سالم\n• تعادل برای حفظ وزن و فعالیت روزمره\n• خوش‌خوراک خط فیت رویال کنین\n• بسته ۲ کیلو\n• جایگزین تجویز دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p234',
    slug: 'cat-food-royal-canin-sterilised-adult-400g',
    title: 'رویال کنین استرلایزد ادالت ۴۰۰ گرم — گربه بالغ عقیم‌شده',
    titleEn: 'Royal Canin Sterilised Adult Cat Dry Food',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 2_742_000,
    weight: '۴۰۰ گرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ عقیم‌شده',
    description:
      'برای گربه بالغی که عقیم شده و کالری کمتر با سیری بیشتر می‌خواهد. کمک به کنترل وزن بعد از عقیمی — نه داروی لاغری.\n\nبعد از عقیمی متابولیسم معمولاً پایین می‌آید و اشتها بالا می‌ماند. Sterilised برای همین تعادل طراحی شده. بسته ۴۰۰ گرم برای شروع و تست. اگر سنگ ادراری یا رژیم کلیوی دارد، فقط با نظر دامپزشک عوض کن. این متن نسخه درمانی نیست.\n\n• مناسب گربه بالغ عقیم‌شده\n• توجه به کنترل وزن بعد از عقیمی\n• خوش‌خوراک با کالری مدیریت‌شده‌تر\n• بسته ۴۰۰ گرم مناسب تست\n• جایگزین رژیم بیمارستانی نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p235',
    slug: 'cat-food-josera-kitten-2kg',
    title: 'جوسرا کیتن ۲ کیلو — بچه گربه در حال رشد',
    titleEn: 'Josera Kitten',
    brandId: 'josera',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 4_004_000,
    weight: '۲ کیلوگرم',
    country: 'آلمان',
    suitable: 'بچه گربه حدود ۲ تا ۱۲ ماه',
    description:
      'برای بچه گربه تقریباً از ۲ تا ۱۲ ماهگی. انرژی و پروتئین بالاتر از خط ادالت؛ دانه کوچک‌تر برای دهان ریز.\n\nکیتن جای غذای گربه بالغ را در ماه‌های رشد نمی‌گیرد. این خط برای پشتیبانی رشد استخوان و عضله و ایمنی دوره حساس است. شیر مادر/شیرخشک را یک‌شبه قطع نکن؛ غذا را مخلوط و تدریجی بیاور. اگر اسهال طولانی شد دامپزشک.\n\n• مخصوص بچه گربه حدود ۲–۱۲ ماه\n• انرژی متناسب دوره رشد\n• دانه مناسب دهان کوچک\n• برند آلمانی جوسرا\n• بسته ۲ کیلو\n\n— پت دیت شاپ.',
  }),
];

export { SHOP_BATCH2_SLUGS };

export const SHOP_BATCH2_PRICE_INDEX = SHOP_BATCH2_PRODUCTS.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  brandId: p.brandId,
  categorySlug: p.categorySlug,
  priceToman: p.priceToman,
}));

export function seedShopBatch2Products(): number {
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
  for (const p of SHOP_BATCH2_PRODUCTS) {
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
