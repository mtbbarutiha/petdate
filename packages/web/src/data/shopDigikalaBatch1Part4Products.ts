import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "digikala-b1-p4-v1";

/** Front-only: single real packshot — never invent -2/-3 angles. */
function gallery(slug: string): { image: string; images: string[] } {
  const image = `${P}/${slug}.jpg?v=${V}`;
  return { image, images: [image] };
}

function bullets(description: string): string[] {
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('• '))
    .map((line) => line.slice(2).trim())
    .slice(0, 3);
}

function product(
  partial: Omit<ShopProduct, 'image' | 'images' | 'badge' | 'inStock' | 'featured' | 'sellerName' | 'warranty' | 'highlights'>
): ShopProduct {
  const { image, images } = gallery(partial.slug);
  return {
    ...partial,
    image,
    images,
    badge: 'new',
    inStock: true,
    featured: true,
    sellerName: 'پت‌دیت شاپ',
    warranty: 'ضمانت اصالت و سلامت فیزیکی کالا',
    highlights: bullets(partial.description),
  };
}

export const SHOP_DIGIKALA_BATCH1_PART4_PRODUCTS: ShopProduct[] = [
  product({
    id: "p330",
    slug: "dog-food-dkp-20949593",
    title: "کنسرو سگ یو‌اس‌پت بز و کدو سبز ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "همان خط های‌پریمیوم با طعم گوشت بز و کدو سبز؛ گزینه غیرمرسوم برای سگ‌هایی که مرغ و گاو را پس زده‌اند.\n\nبا مقدار کم شروع کن. کدو به گوارش بعضی‌ها کمک می‌کند — درمان اسهال نیست.\n\n۴۳۰ گرم.\n\n• بز و کدو سبز\n• ۴۳۰ گرم\n• یو اس پت\n• شروع تدریجی\n• نه درمان گوارشی\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p331",
    slug: "cat-treats-dkp-11596119",
    title: "خمیر مولتی‌ویتامین گربه پرسا ۲۰۰ گرم — بسته ۲ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 385_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "بسته ۲ عددی خمیر ویتامین و مینرال پرسا؛ برای گربه‌هایی که بدغذا هستند یا دامپزشک مکمل خواسته.\n\nدوز روی برچسب — خودسر دو برابر نکن. جایگزین غذای کامل و آزمایش خون نیست.\n\nدور از گرما.\n\n• مولتی‌ویتامین خمیری\n• ۲۰۰ گرم × ۲\n• پرسا\n• طبق برچسب\n• جایگزین رژیم کامل نیست\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p332",
    slug: "cat-treats-dkp-7929885",
    title: "خمیر مالت گربه پرسا ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 195_840,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "خمیر مالت ۱۰۰ گرمی پرسا با ویتامین؛ کمک به عبور مو و تشویقی لیسیدنی. درمان انسداد مو نیست.\n\nروی پنجه یا مستقیم از تیوب مقدار کم. اسهال شد قطع کن.\n\nاگر استفراغ مکرر دارد دامپزشک مقدم است.\n\n• مالت + ویتامین ۱۰۰ گرم\n• پرسا\n• کمک گلوله مو — نه تضمین\n• مقدار کم\n• استفراغ مکرر = کلینیک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p333",
    slug: "grooming-dkp-22460582",
    title: "دهان‌شویه سگ و گربه بایوپت اکتیو ۲۵۰ میل",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 1_602_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "محلول دهان‌شویه ۲۵۰ میلی‌لیتری بایوپت اکتیو برای کمک به بهداشت دهان؛ جایگزین مسواک و جرم‌گیری دامپزشکی نیست.\n\nطبق برچسب رقیق/مصرف کن — دوز خودسرانه نده. اگر زخم دهان یا بوی بسیار شدید دارد اول کلینیک.\n\nدور از بلع حجم زیاد.\n\n• دهان‌شویه ۲۵۰ میل\n• بایو پت اکتیو\n• کمک بهداشت دهان\n• طبق برچسب — نه خودسر\n• جایگزین جرم‌گیری نیست\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p334",
    slug: "bird-food-dkp-16760701",
    title: "غذای گرینچیک کوکو پروت ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 479_500,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "خوراک ۱ کیلویی مدل پروت برای گرین‌چیک/کوکو و پرندگان کوچک مشابه؛ پروتئین دانه‌ای روزمره.\n\nبا گونه دقیق پرنده‌ات چک کن که فرمول مناسبش باشد. آب تمیز جدا.\n\nکپک‌زده را دور بریز.\n\n• ۱ کیلو مدل پروت\n• پرندگان کوچک\n• چک تناسب گونه\n• آب تازه\n• دور از رطوبت\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p335",
    slug: "bird-food-dkp-8471877",
    title: "غذای مرغ مینا اوشکایا ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 478_550,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "خوراک ۱ کیلویی اوشکایا برای مرغ مینا و حشره‌خوارها؛ با جیره عروس هلندی یکی نیست.\n\nمینا به تنوع پروتئینی بیشتر نیاز دارد. کاسه را هر روز عوض کن تا ترش نشود.\n\nمکمل میوه/سبزی طبق راهنمای گونه.\n\n• مخصوص مینا\n• ۱ کیلو اوشکایا\n• متفاوت از خوراک عروس\n• بهداشت روزانه\n• تنوع غذایی\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p336",
    slug: "bird-food-dkp-11307683",
    title: "غذای عروس هلندی کاسنر K12 — ۱۲۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 303_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "مخلوط دانه عروس هلندی ۱۲۰۰ گرمی کد K12؛ پایه روزمره برای طوطی‌های کوچک مشابه عروس.\n\nفقط دانه کافی نیست — سبزی و پلت را هم وارد کن. کاسه را روزانه تمیز کن.\n\nتازه و خشک نگه دار.\n\n• عروس هلندی / K12\n• ۱۲۰۰ گرم\n• پایه دانه‌ای\n• بهداشت کاسه\n• تنوع غذایی اضافه کن\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p337",
    slug: "bird-food-dkp-16512508",
    title: "تشویقی پرنده طعم میوه ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 96_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "تشویقی میوه‌ای ۱۰۰ گرمی برای تنوع نوک‌زدن؛ قند طبیعی دارد پس زیاده‌روی نکن.\n\nجیره اصلی را حذف نکن. اگر مدفوع شل شد کم کن.\n\nخشک و خنک نگه دار.\n\n• تشویقی میوه ۱۰۰ گرم\n• تنوع طعم\n• کنترل مقدار\n• نه جایگزین جیره\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p338",
    slug: "rodent-supplies-dkp-2909989",
    title: "غذای کامل جوندگان تاپ‌فید ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 550_000,
    params: {
      مناسب_برای: "جوندگان",
    },
    description:
      "خوراک کامل ۱ کیلویی تاپ‌فید برای جوندگان؛ پایه پلت/میکس کنار یونجه.\n\nگونه (همستر، خوکچه، خرگوش) را با برچسب چک کن. انتقال تدریجی.\n\nآب بطری تمیز.\n\n• تاپ فید ۱ کیلو\n• جیره کامل جوندگان\n• کنار یونجه\n• تعویض تدریجی\n• آب تمیز\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p339",
    slug: "rodent-supplies-dkp-20848635",
    title: "خوراک جوندگان آسوپت میکس پلت ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 350_860,
    params: {
      مناسب_برای: "جوندگان",
    },
    description:
      "میکس پلت‌شده ۱ کیلویی برای یکنواخت‌تر خوردن؛ کمتر انتخاب‌کردن دانه‌های چرب توسط حیوان.\n\nپلت خردشده را دور بریز اگر کهنه شد. با یونجه ترکیب کن وقتی گونه لازم دارد.\n\nآب تازه.\n\n• پلت میکس ۱ کیلو\n• یکنواخت‌تر از دانه‌چین\n• کنار فیبر در صورت نیاز\n• کهنه نماند\n• آب تازه\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p340",
    slug: "rodent-supplies-dkp-12533105",
    title: "یونجه خشک خرگوش و جوندگان ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 235_000,
    params: {
      مناسب_برای: "جوندگان",
    },
    description:
      "یونجه خشک ۱ کیلویی برای خرگوش و جوندگان گیاه‌خوار؛ فیبر ضروری روزمره.\n\nهمیشه در دسترس باشد مگر دامپزشک خلاف گفته. گرد و خاک زیاد را الک کن اگر حیوان عطسه می‌کند.\n\nمرطوب نشود.\n\n• یونجه خشک ۱ کیلو\n• خرگوش و جوندگان\n• فیبر پایه\n• خشک نگه دار\n• عطسه مداوم = بررسی کیفیت/گرد و خاک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p341",
    slug: "rodent-supplies-dkp-11804534",
    title: "غذای همستر نیچرفود ۱ ستاره ۵۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "rodent-supplies",
    petTypes: ["rodent"],
    priceToman: 181_000,
    params: {
      مناسب_برای: "جوندگان",
    },
    description:
      "میکس ۵۰۰ گرمی مخصوص همستر؛ دانه و تکه برای جوندگان کوچک شب‌فعال.\n\nآجیل زیاد چاق می‌کند — پیمانه را رعایت کن. کاسه کوچک تازه کن.\n\nجایگزین یونجه برای گونه‌هایی که لازم دارند نیست.\n\n• همستر ۵۰۰ گرم\n• میکس دانه\n• کنترل آجیل\n• کاسه تمیز\n• تناسب گونه\n\n— پت دیت شاپ.\n\n---",
  }),
];
