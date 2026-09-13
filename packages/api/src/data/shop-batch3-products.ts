/**
 * PetDate shop Batch 3 — 14 live SKUs (Josera + Royal Canin).
 * Additive, idempotent upsert by slug. Margin 0 (cost_toman = price_toman).
 * Seller copy is پت دیت شاپ only. Prices are exact MANIFEST toman values.
 */
import { getDb } from '../db';
import { withShopImagesParam } from './shop-product-images';
import { HELD_SHOP_SLUGS, SHOP_BATCH3_SLUGS } from './shop-zero-margin-slugs';

const P = '/pepito/uploads';
export const SHOP_BATCH3_CACHE_BUST = 'batch3-v2';

function batch3Gallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${SHOP_BATCH3_CACHE_BUST}`,
    `${P}/${slug}-2.jpg?v=${SHOP_BATCH3_CACHE_BUST}`,
    `${P}/${slug}-3.jpg?v=${SHOP_BATCH3_CACHE_BUST}`,
  ];
  return { image: images[0]!, images };
}

export type ShopBatch3Product = {
  id: string;
  slug: (typeof SHOP_BATCH3_SLUGS)[number];
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
    ShopBatch3Product,
    'costToman' | 'image' | 'images' | 'badge' | 'inStock' | 'stockQty' | 'featured' | 'params'
  > & {
    weight: string;
    country: string;
    suitable: string;
  }
): ShopBatch3Product {
  return {
    ...partial,
    costToman: partial.priceToman,
    ...batch3Gallery(partial.slug),
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

export const SHOP_BATCH3_PRODUCTS: ShopBatch3Product[] = [
  row({
    id: 'p236',
    slug: 'cat-food-royal-canin-sensible-2kg',
    title: 'رویال کنین سنسیبل ۲ کیلو — گربه بالغ با گوارش حساس‌تر',
    titleEn: 'Royal Canin Sensible Cat Food 2kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 10_217_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ با گوارش حساس‌تر',
    description:
      'خشک کامل برای گربه بالغی که معده‌اش با برندهای تند زود به هم می‌ریزد. پروتئین باکیفیت و فرمول برای حمایت از گوارش آرام‌تر — کمک، نه درمان بیماری گوارشی.\n\nSensible انتخاب رایج وقتی Culinesse یا خطوط حساس دیگر را امتحان کرده‌ای و هنوز رژیم Veterinary تجویز نشده. آب در دسترس باشد. تعویض را تدریجی کن. اگر استفراغ مکرر، اسهال طولانی یا کاهش وزن داری، اول دامپزشک؛ این متن نسخه درمانی نیست.\n\n• مناسب گربه بالغ با گوارش حساس‌تر\n• تمرکز روی خوش‌خوراکی و گوارش آرام‌تر\n• فرمول خشک کامل رویال کنین\n• بسته ۲ کیلو\n• جایگزین رژیم بیمارستانی نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p237',
    slug: 'cat-food-josera-marinesse-2kg',
    title: 'جوسرا مارینس ۲ کیلو — گربه بالغ با طعم ماهی',
    titleEn: 'Josera Marinesse Cat Food 2kg',
    brandId: 'josera',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 4_004_000,
    weight: '۲ کیلوگرم',
    country: 'آلمان',
    suitable: 'گربه بالغ سالم با طعم ماهی',
    description:
      'خشک کامل بر پایه ماهی برای گربه بالغ سالم. انتخاب وقتی پروتئین دریایی را ترجیح می‌دهی و می‌خواهی خط روزمرهٔ خوش‌خوراک روی کاسه بماند.\n\nMarinesse برای گربه‌ای است که گوشت ماهی را بهتر قبول می‌کند؛ فرمول آلمانی جوسرا با تمرکز روی پروتئین حیوانی و طعم. جایگزین رژیم درمانی آلرژی یا کلیه نیست. آب تازه همیشه در دسترس باشد و تعویض برند را چندروزه انجام بده. اگر استفراغ مکرر یا کاهش وزن دیدی اول دامپزشک.\n\n• مناسب گربه بالغ سالم\n• تمرکز روی پروتئین ماهی و خوش‌خوراکی\n• برند آلمانی جوسرا\n• بسته ۲ کیلو برای خانه و تست سلیقه\n• تعویض تدریجی با غذای قبلی\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p238',
    slug: 'cat-food-josera-sensicat-2kg',
    title: 'جوسرا سنسی‌کت ۲ کیلو — گربه بالغ با معده حساس',
    titleEn: 'Josera SensiCat Cat Food 2kg',
    brandId: 'josera',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 4_004_000,
    weight: '۲ کیلوگرم',
    country: 'آلمان',
    suitable: 'گربه بالغ با معده حساس',
    description:
      'خط جوسرا برای گربه بالغی که غذای معمولی را پس می‌زند یا مدفوعش با تغییر برند به هم می‌ریزد. طعم متعادل‌تر؛ بدون پیچیدگی الکی.\n\nSensiCat برای مصرف روزمره وقتی معده کمی حساس است — باز هم «کمک»، نه درمان IBD یا آلرژی قطعی. آب تازه فراموش نشود. اگر علائم شدید یا کاهش وزن داری قبل از تعویض با دامپزشک هماهنگ شو. جایگزین تجویز نیست.\n\n• مناسب گربه بالغ با گوارش حساس‌تر\n• برند آلمانی جوسرا\n• تمرکز روی خوش‌خوراکی ملایم\n• بسته ۲ کیلو\n• تعویض تدریجی چندروزه\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p239',
    slug: 'cat-food-royal-canin-mother-babycat-2kg',
    title: 'رویال کنین مادر اند بیبی ۲ کیلو — مادر باردار/شیرده و بچه گربه',
    titleEn: 'Royal Canin Mother & Babycat 2kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 10_395_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'مادر باردار/شیرده و بچه گربه تا حدود ۴ ماه',
    description:
      'خط ویژه دوره بارداری، شیردهی و هفته‌های اول بچه گربه. انرژی و بافت دانه برای مادر و بچه‌هایی که تازه از شیر به خشک می‌رسند هماهنگ‌تر دیده شده.\n\nMother & Babycat جای غذای ادالت معمولی را در این بازه حساس نمی‌گیرد. دانه‌ها کوچک‌ترند تا جویدن برای دهان ریز راحت‌تر باشد و فرمول به پشتیبانی رشد و نیاز کالری مادر کمک می‌کند — کمک، نه جایگزین چکاپ دامپزشکی. شیر مادر/شیرخشک را یک‌شبه قطع نکن؛ غذا را مخلوط و تدریجی بیاور. اگر اسهال طولانی یا بی‌حالی دیدی به کلینیک برو.\n\n• مناسب مادر باردار/شیرده و بچه گربه تا حدود ۴ ماه\n• انرژی متناسب دوره رشد و شیردهی\n• دانه کوچک برای دهان ریز\n• پشتیبانی ایمنی و رشد در ماه‌های حساس\n• بسته ۲ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p240',
    slug: 'cat-food-royal-canin-dental-1-5kg',
    title: 'رویال کنین دنتال ۱٫۵ کیلو — گربه بالغ مراقبت دهان و دندان',
    titleEn: 'Royal Canin Dental Cat Food 1.5kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 9_450_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ مراقبت دهان و دندان',
    description:
      'دانه با بافتی که موقع جویدن به تمیز نگه داشتن سطح دندان کمک می‌کند. برای گربه بالغ سالم؛ مکمل بهداشت دهان روزمره — نه جایگزین جرم‌گیری دامپزشکی.\n\nDental Care وقتی مسواک و چکاپ دندان سر جایش است معنی دارد. دانه به‌تنهایی پلاک سنگین یا بوی شدید دهان را «درمان» نمی‌کند. اگر لثه قرمز، درد جویدن یا بوی خیلی بد داری اول کلینیک. بسته ۱٫۵ کیلو برای شروع و تست سلیقه خوب است.\n\n• مناسب گربه بالغ سالم\n• بافت دانه برای کمک به بهداشت دهان\n• مکمل مسواک و چکاپ — نه جایگزین\n• بسته ۱٫۵ کیلو\n• جایگزین درمان دندانپزشکی دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p241',
    slug: 'cat-food-royal-canin-light-weight-1-5kg',
    title: 'رویال کنین لایت ویت ۱٫۵ کیلو — گربه بالغ کنترل وزن',
    titleEn: 'Royal Canin Light Weight Care Cat 1.5kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 9_415_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ مستعد اضافه وزن',
    description:
      'برای گربه بالغی که تمایل به اضافه وزن دارد و کالری کمتر با سیری بیشتر می‌خواهد. کمک به حفظ وزن ایده‌آل — نه رژیم لاغری تضمینی یک‌شبه.\n\nLight Weight Care وقتی پیمانه ادالت معمولی جواب نمی‌دهد گزینهٔ منطقی است. فعالیت و میزان غذا را با هم ببین؛ وزن را ماه‌به‌ماه چک کن. اگر عقیم شده و دامپزشک خط Sterilised خواسته، ممکن است آن مناسب‌تر باشد. مشکل غدد یا بیماری متابولیک را با غذای خشک تنها حل نکن.\n\n• مناسب گربه بالغ مستعد اضافه وزن\n• کالری مدیریت‌شده‌تر با حس سیری\n• خوش‌خوراک خط لایت ویت\n• بسته ۱٫۵ کیلو مناسب تست\n• جایگزین رژیم بیمارستانی نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p242',
    slug: 'cat-food-royal-canin-hairball-2kg',
    title: 'رویال کنین هیربال ۲ کیلو — گربه بالغ مدیریت گلوله مو',
    titleEn: 'Royal Canin Hairball Care Cat 2kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 12_100_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ با مشکل گلوله مو',
    description:
      'برای گربه بالغی که زیاد می‌لیسد و گلوله مو آزارش می‌دهد. فیبر و فرمول برای کمک به عبور مو از گوارش — کمک، نه پایان استفراغ مو.\n\nHairball Care در گربه‌های خانگی و مو‌بلند رایج است. آب تازه، برس‌زنی منظم و پیمانه درست کنار غذا معنی پیدا می‌کنند. اگر استفراغ مکرر، یبوست یا بی‌اشتهایی داری اول دامپزشک؛ ممکن است مشکل فراتر از گلوله مو باشد. این متن نسخه درمانی نیست.\n\n• مناسب گربه بالغ با مشکل گلوله مو\n• کمک به مدیریت عبور مو از گوارش\n• مکمل برس‌زنی و آب کافی\n• بسته ۲ کیلو\n• جایگزین تشخیص دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p243',
    slug: 'cat-food-royal-canin-hair-skin-2kg',
    title: 'رویال کنین هیر اند اسکین ۲ کیلو — گربه بالغ پوست و مو',
    titleEn: 'Royal Canin Hair & Skin Care Cat 2kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 12_100_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'گربه بالغ پوست و مو',
    description:
      'خط مراقبت پوست و پوشش برای گربه بالغ سالم. اسیدهای چرب و مواد مغذی پوست در اولویت — نه شامپوی معجزه و نه درمان آلرژی قطعی.\n\nHair & Skin وقتی مو کدر یا پوست خشک‌تر از حد عادی است انتخاب رایجی است. خارش شدید، زخم یا ریزش تکه‌ای را با تعویض غذا تنها حل نکن؛ اول دامپزشک. تعویض برند را تدریجی انجام بده و آب تازه بگذار.\n\n• مناسب گربه بالغ سالم\n• توجه به پوست و پوشش\n• خوش‌خوراک خط هیر اند اسکین\n• بسته ۲ کیلو\n• جایگزین درمان پوستی دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p244',
    slug: 'cat-food-royal-canin-urinary-so-1-5kg',
    title: 'رویال کنین یورینری اس‌او ۱٫۵ کیلو — خط دامپزشکی ادراری گربه',
    titleEn: 'Royal Canin Urinary S/O Cat 1.5kg',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 9_623_000,
    weight: '۱٫۵ کیلوگرم',
    country: 'فرانسه',
    suitable: 'خط دامپزشکی ادراری گربه — تحت نظر کلینیک',
    description:
      'غذای خشک خط Veterinary برای پشتیبانی مدیریت مشکلات ادراری تحت نظر دامپزشک. فقط وقتی تجویز یا توصیه کلینیک داری سراغش برو — نه «پیشگیری خانگی» خودسرانه.\n\nUrinary S/O جای Fit یا Indoor روزمره را نمی‌گیرد. شروع، مدت مصرف و برگشت به غذای معمولی فقط با نظر دامپزشک معنا دارد. آب تازه حیاتی است؛ علائم درد ادرار، خون در ادرار یا بی‌حالی را فوری به کلینیک گزارش بده. این متن جایگزین تشخیص و تجویز نیست.\n\n• خط دامپزشکی — مصرف تحت نظر کلینیک\n• برای پشتیبانی مدیریت ادراری طبق تجویز\n• بسته ۱٫۵ کیلو\n• خودسرانه جایگزین غذای روزمره نکن\n• جایگزین معاینه و نسخه دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p245',
    slug: 'dog-food-royal-canin-mini-sterilised-3kg',
    title: 'رویال کنین مینی استرالایز ۳ کیلو — سگ بالغ نژاد کوچک عقیم‌شده',
    titleEn: 'Royal Canin Mini Sterilised Dog 3kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 14_821_000,
    weight: '۳ کیلوگرم',
    country: 'فرانسه',
    suitable: 'سگ بالغ نژاد کوچک عقیم‌شده',
    description:
      'برای سگ بالغ نژاد کوچک که عقیم شده و کالری کمتر با سیری بیشتر می‌خواهد. دانه مناسب پوزه ریز؛ کمک به کنترل وزن بعد از عقیمی — نه داروی لاغری.\n\nبعد از عقیمی متابولیسم معمولاً پایین می‌آید و اشتها بالا می‌ماند. Mini Sterilised برای همین تعادل در جثه کوچک طراحی شده. پیمانه روی کیسه نقطه شروع است؛ وزن را ماه‌به‌ماه چک کن. اگر هنوز توله است یا رژیم بیمارستانی دارد، اول دامپزشک. این متن جایگزین تجویز نیست.\n\n• مناسب سگ بالغ نژاد کوچک عقیم‌شده\n• دانه مناسب پوزه کوچک\n• توجه به کنترل وزن بعد از عقیمی\n• خوش‌خوراک با کالری مدیریت‌شده‌تر\n• بسته ۳ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p246',
    slug: 'dog-food-royal-canin-mini-light-weight-3kg',
    title: 'رویال کنین مینی لایت ویت ۳ کیلو — سگ بالغ نژاد کوچک کنترل وزن',
    titleEn: 'Royal Canin Mini Light Weight Care 3kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 14_821_000,
    weight: '۳ کیلوگرم',
    country: 'فرانسه',
    suitable: 'سگ بالغ نژاد کوچک مستعد اضافه وزن',
    description:
      'برای سگ بالغ نژاد کوچک که زود چاق می‌شود و کالری کمتر با سیری بیشتر می‌خواهد. دانه مناسب پوزه ریز؛ کمک به حفظ وزن ایده‌آل — نه رژیم لاغری تضمینی.\n\nMini Light Weight Care وقتی پیمانه Mini Adult معمولی وزن را بالا می‌برد منطقی است. پیاده‌روی و پیمانه را با هم تنظیم کن. اگر عقیم شده، خط Sterilised هم گزینهٔ رایج است؛ با دامپزشک یا جدول روی کیسه هماهنگ شو. جایگزین رژیم بیمارستانی نیست.\n\n• مناسب سگ بالغ نژاد کوچک مستعد اضافه وزن\n• دانه مناسب پوزه کوچک\n• کالری مدیریت‌شده‌تر\n• بسته ۳ کیلو\n• جایگزین تجویز دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p247',
    slug: 'dog-food-royal-canin-poodle-adult-3kg',
    title: 'رویال کنین پودل ادالت ۳ کیلو — مخصوص پودل بالغ',
    titleEn: 'Royal Canin Poodle Adult 3kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 14_820_000,
    weight: '۳ کیلوگرم',
    country: 'فرانسه',
    suitable: 'پودل بالغ از حدود ۱۰ ماهگی',
    description:
      'خط نژادمحور برای پودل بالغ از حدود ۱۰ ماهگی. دانه و فرمول با پوزه، پوست و پوشش این نژاد هماهنگ شده.\n\nپودل مو زیاد مراقبت می‌خواهد و بدغذا هم کم نیست. این خط برای حمایت از پوست و پوشش مجعد و جویدن راحت است — نه جایگزین آرایشگاه یا درمان پوستی. اگر آلرژی یا بیماری خاص دارد اول دامپزشک. جایگزین تجویز نیست.\n\n• مخصوص پودل بالغ (از حدود ۱۰ ماه)\n• دانه مناسب پوزه این نژاد\n• توجه به پوست و پوشش\n• خوش‌خوراک برای بدغذاها\n• بسته ۳ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p248',
    slug: 'dog-food-royal-canin-poodle-puppy-3kg',
    title: 'رویال کنین پودل پاپی ۳ کیلو — توله پودل در حال رشد',
    titleEn: 'Royal Canin Poodle Puppy 3kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 14_820_000,
    weight: '۳ کیلوگرم',
    country: 'فرانسه',
    suitable: 'توله پودل تا حدود ۱۰ ماه',
    description:
      'برای توله پودل تقریباً تا حدود ۱۰ ماهگی. انرژی رشد، دانه مناسب پوزه کوچک، پشتیبانی استخوان و پوشش در ماه‌های حساس.\n\nتوله پودل سریع رشد می‌کند و معده‌اش زود پر می‌شود. Poodle Puppy برای همین بازه است؛ بعد از بلوغ سراغ خط ادالت همان نژاد برو. تعویض غذا را تدریجی کن. واکسن و چکاپ سر جایش؛ غذا جایگزین دامپزشک نیست.\n\n• مخصوص توله پودل تا حدود ۱۰ ماه\n• دانه مناسب پوزه کوچک\n• انرژی متناسب دوره رشد\n• پشتیبانی استخوان، عضله و پوشش\n• بسته ۳ کیلو\n\n— پت دیت شاپ.',
  }),
  row({
    id: 'p249',
    slug: 'dog-food-royal-canin-hypoallergenic-2kg',
    title: 'رویال کنین هایپوآلرژنیک ۲ کیلو — خط دامپزشکی حساسیت غذایی سگ',
    titleEn: 'Royal Canin Hypoallergenic Dog 2kg',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 11_702_000,
    weight: '۲ کیلوگرم',
    country: 'فرانسه',
    suitable: 'خط دامپزشکی حساسیت غذایی سگ — تحت نظر کلینیک',
    description:
      'غذای خشک خط Veterinary برای پشتیبانی مدیریت حساسیت غذایی تحت نظر دامپزشک. فقط با تجویز یا توصیه کلینیک شروع کن — نه تست خانگی خودسرانه.\n\nHypoallergenic جای Mini Adult یا خطوط نژادمحور روزمره را نمی‌گیرد. پروتئین هیدرولیزه‌شده و فرمول این خط برای دوره تشخیص/مدیریت آلرژی غذایی طراحی شده‌اند؛ مدت و نحوه مصرف فقط با دامپزشک معنا دارد. خارش شدید یا عفونت پوست را با تعویض خودسرانه حل نکن. این متن جایگزین تشخیص و نسخه نیست.\n\n• خط دامپزشکی — مصرف تحت نظر کلینیک\n• برای پشتیبانی مدیریت حساسیت غذایی طبق تجویز\n• بسته ۲ کیلو\n• خودسرانه جایگزین غذای روزمره نکن\n• جایگزین معاینه و نسخه دامپزشک نیست\n\n— پت دیت شاپ.',
  }),
];

export { SHOP_BATCH3_SLUGS };

export const SHOP_BATCH3_PRICE_INDEX = SHOP_BATCH3_PRODUCTS.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  brandId: p.brandId,
  categorySlug: p.categorySlug,
  priceToman: p.priceToman,
}));

export function seedShopBatch3Products(): number {
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
  for (const p of SHOP_BATCH3_PRODUCTS) {
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
