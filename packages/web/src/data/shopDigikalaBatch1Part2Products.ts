import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "digikala-b1-p2-v1";

function gallery(slug: string): { image: string; images: string[] } {
  const images = [
    `${P}/${slug}.jpg?v=${V}`,
    `${P}/${slug}-2.jpg?v=${V}`,
    `${P}/${slug}-3.jpg?v=${V}`,
  ];
  return { image: images[0]!, images };
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

export const SHOP_DIGIKALA_BATCH1_PART2_PRODUCTS: ShopProduct[] = [
  product({
    id: "p310",
    slug: "cat-toys-dkp-5758150",
    title: "اسباب‌بازی سگ و گربه مدل SH100",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 293_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "اسباب‌بازی چندکاره مدل SH100 برای گاز و پا زدن سبک سگ کوچک و گربه. مشخصات دقیق رنگ/شکل روی بسته را ببین.\n\nجوینده‌های سنگین زود خرابش می‌کنند. تکه جداشده را بردار.\n\nزیر نظر بازی.\n\n• مدل SH100\n• سگ کوچک و گربه\n• بازی نظارت‌شده\n• مقاوم جویدن سنگین نیست\n• جمع تکه پاره\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p311",
    slug: "cat-toys-dkp-7868352",
    title: "ماهی پارچه‌ای کت‌نیپ — مجموعه ۳ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 230_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "سه عدد ماهی پارچه‌ای کت‌نیپ‌دار برای پرتاب و حمله. ست ۳تایی یعنی وقتی یکی گم شد بقیه هست.\n\nکت‌نیپ همه گربه‌ها را دیوانه نمی‌کند. اگر پاره شد نخ را جمع کن.\n\nقابل شست‌وشوی سطحی.\n\n• ۳ عدد ماهی کت‌نیپ\n• پارچه‌ای\n• بازی شکار\n• ایمنی نخ\n• شست‌وشوی سطحی\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p312",
    slug: "cat-toys-dkp-12180640",
    title: "چوب بازی چوبی با زنگوله",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 170_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "چوب بازی کلاسیک با زنگوله؛ ارزان و مؤثر برای شروع شکار روزانه ۵ دقیقه.\n\nنوک را به چشم نزن. اگر نخ باز شد جمع کن یا ببند.\n\nچند دقیقه کوتاه بهتر از یک‌ساعت خسته‌کننده است.\n\n• چوب چوبی + زنگوله\n• بازی روزانه کوتاه\n• ایمنی چشم و نخ\n• ساده و مؤثر\n• پایان قبل خستگی بیش از حد\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p313",
    slug: "grooming-dkp-18631110",
    title: "ناخن‌گیر اختاپوسی سگ و گربه GK890 (وریانت ۲)",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 490_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "همان مدل ناخن‌گیر اختاپوسی GK890 در وریانت/کد انبار جدا؛ مشخصات کاربردی مثل نسخه اول.\n\nنور کافی، آرامش پت، برش کم‌کم. تیغه را تمیز نگه دار.\n\nاگر پت مقاوم است کمک دوم نفر.\n\n• مدل اختاپوسی GK890\n• وریانت بسته‌بندی جدا\n• برش تدریجی\n• بهداشت تیغه\n• کمک نفر دوم در پت‌های مقاوم\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p314",
    slug: "grooming-dkp-18625181",
    title: "ناخن‌گیر اختاپوسی سگ و گربه GK890",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 450_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "ناخن‌گیر با طراحی اختاپوسی برای گرفتن راحت‌تر پنجه. فقط نوک شفاف ناخن را بگیر؛ رگ خونی را نزن.\n\nاول روی حیوان آرام تمرین کن. اگر خون آمد پودر بندآورنده و فشار ملایم؛ در خونریزی شدید کلینیک.\n\nبرای ناخن خیلی سفت سگ بزرگ ممکن است مدل قوی‌تر لازم شود.\n\n• مدل اختاپوسی کد GK890\n• سگ و گربه\n• فقط نوک ناخن\n• آرام‌سازی قبل کوتاهی\n• مراقب رگ خون\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p315",
    slug: "grooming-dkp-21424542",
    title: "قیچی ناخن‌گیر HIACE BL",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 380_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "قیچی ناخن‌گیر مدل HIACE BL با تیغه قیچی‌شکل؛ کنترل دقیق‌تر برای صاحبی که گیوتین را دوست ندارد.\n\nهمچنان رگ را نزن. برای گربه و سگ کوچک معمولاً راحت‌تر از سگ غول‌پیکر است.\n\nبعد استفاده الکل ملایم روی تیغه.\n\n• قیچی ناخن HIACE BL\n• کنترل دقیق‌تر\n• سگ و گربه\n• مراقب رگ\n• تمیزکاری تیغه\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p316",
    slug: "bird-food-dkp-12290421",
    title: "مای‌برد پلاس عروس هلندی ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 428_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "غذای خشک مای‌برد مدل پلاس مخصوص عروس هلندی، ۱ کیلو؛ فرموله برای طوطی‌های کوچک این گروه.\n\nبرچسب کامل/مکمل را بخوان. انتقال از ارزن خالص را تدریجی کن.\n\nآب جدا.\n\n• مای برد پلاس عروس\n• ۱ کیلو\n• جیره فرموله‌تر\n• تعویض تدریجی\n• آب تازه\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p317",
    slug: "bird-food-dkp-10394150",
    title: "غذای عروس هلندی سبزیجات معطر ۱ کیلو",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 220_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "مخلوط عروس با تاکید سبزیجات معطر، ۱ کیلو؛ تنوع بو و طعم نسبت به فقط ارزن.\n\nارزن خالی چاق می‌کند — این تنوع کمک می‌کند ولی باز هم سبزی تازه بده.\n\n۱ کیلو.\n\n• سبزیجات معطر\n• ۱ کیلو / عروس\n• تنوع نسبت به ارزن خالص\n• مکمل سبزی تازه\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p318",
    slug: "bird-food-dkp-6060757",
    title: "تشویقی پرنده میل‌ورم خشک ۵۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 110_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "میل‌ورم خشک ۵۰ گرمی برای تشویقی حشره‌خوارها و طوطی‌هایی که پروتئین حیوانی دوست دارند.\n\nکم بده؛ چربی بالا دارد. تازه نگه دار تا تند نشود.\n\nجای جیره کامل نیست.\n\n• میل‌ورم خشک ۵۰ گرم\n• تشویقی پروتئینی\n• مقدار کم\n• نه جیره اصلی\n• نگهداری خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p319",
    slug: "bird-food-dkp-10253439",
    title: "ارزن خوشه‌ای پرنده — بسته ۵ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 106_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "بسته ۵ عددی ارزن خوشه‌ای برای سرگرمی و نوک‌زدن؛ تشویقی است نه تمام جیره.\n\nزیاده‌روی چاق می‌کند. خوشه را طوری ببند که مدفوع روی جیره اصلی نریزد.\n\nبرای قناری و عروس و مرغ عشق محبوب است.\n\n• ارزن خوشه‌ای\n• بسته ۵ عددی\n• تشویقی / سرگرمی\n• نه جیره کامل\n• کنترل وزن\n\n— پت دیت شاپ.\n\n---",
  }),
];
