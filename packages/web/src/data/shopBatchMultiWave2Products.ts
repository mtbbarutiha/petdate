import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "batch-multi-w2-v4";

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

export const SHOP_BATCH_MULTI_WAVE2_PRODUCTS: ShopProduct[] = [
  product({
    id: "p260",
    slug: "dog-treats-wanpy-chicken-jerky-chips-100g",
    title: "تشویقی سگ ونپی چیپس مرغ ۱۰۰ گرم",
    titleEn: "",
    brandId: "wanpy",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 655_000,
    params: {
      وزن: "100گرم",
      مناسب_برای: "سگ",
    },
    description:
      "چیپس مرغ خشک ونپی؛ ترد و خوش‌بو برای جایزه سریع آموزش. تکه را بشکن تا کش نیاید و قورت ندهد.\n\nاز سهم روزانه کم کن. مرغ حساسیت شایع است — اگر خارش دارد پروتئین را عوض کن.\n\nبسته ۱۰۰ گرم. جایگزین وعده نیست.\n\n• چیپس مرغ خشک\n• ۱۰۰ گرم\n• برند ونپی\n• مناسب آموزش\n• تکه را خرد کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p261",
    slug: "cat-treats-bioline-catnip-spray-50ml",
    title: "اسپری کت‌نیپ بایولاین ۵۰ میلی‌لیتر",
    titleEn: "",
    brandId: "bioline",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 828_000,
    params: {
      وزن: "50ml",
      مناسب_برای: "گربه",
    },
    description:
      "اسپری کت‌نیپ برای زنده‌کردن اسباب‌بازی و اسکرچر کهنه. چند پاف کافی است؛ خیس کردن لازم نیست.\n\nحدود یک‌سوم گربه‌ها به کت‌نیپ واکنش کمی دارند — طبیعی است. روی پارچه و اسباب‌بازی بزن، نه مستقیم روی چشم و بینی.\n\nدور از بچه‌ها نگه دار. جایگزین بازی و توجه نیست.\n\n• اسپری کت‌نیپ ۵۰ میل\n• برند بایولاین\n• برای اسباب‌بازی و اسکرچر\n• چند پاف کافی است\n• همه گربه‌ها واکنش یکسان ندارند\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p262",
    slug: "cat-treats-bonnest-catnip-spray-50-l",
    title: "اسپری کت‌نیپ بونست ۵۰ میلی‌لیتر",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 539_000,
    params: {
      وزن: "50 میلی لیتر",
      مناسب_برای: "گربه",
    },
    description:
      "اسپری کت‌نیپ بونست برای تشویق بازی و کنجکاوی. روی موش پارچه‌ای یا تونل بزن و بگذار گربه خودش کشف کند.\n\nزیاده‌روی بو را بی‌اثر می‌کند. اگر گربه بی‌تفاوت بود چند روز فاصله بده.\n\n۵۰ میلی‌لیتر. خوراکی نیست.\n\n• کت‌نیپ اسپری بونست\n• ۵۰ میلی‌لیتر\n• تقویت بازی\n• کم بزن، زیاد تکرار نکن\n• خوراکی نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p263",
    slug: "cat-treats-cat-grass-theething-stick-30-g",
    title: "اسنک علف گربه طعم مرغ ۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 480_000,
    params: {
      وزن: "30 گرم",
      مناسب_برای: "گربه",
    },
    description:
      "اسنک جویدنی با طعم مرغ و حس علف گربه؛ برای گربه‌هایی که دوست دارند چیزی بجوند و مشغول شوند.\n\nتکه کوچک بده و آب در دسترس باشد. اگر استفراغ بعد جویدن دیدی قطع کن و با دامپزشک حرف بزن.\n\nبسته ۳۰ گرم. وعده اصلی نیست.\n\n• اسنک علف‌گربه / طعم مرغ\n• ۳۰ گرم\n• برای مشغول‌کردن جویدن\n• تکه کوچک شروع کن\n• جایگزین غذای کامل نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p264",
    slug: "cat-treats-bonnest-cat-nip-powder-20g-20-g",
    title: "پودر کت‌نیپ بونست ۲۰ گرم",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 385_000,
    params: {
      وزن: "20 گرم",
      مناسب_برای: "گربه",
    },
    description:
      "پودر کت‌نیپ برای پاشیدن روی اسباب‌بازی، کارتُن و اسکرچر. کنترل‌شده‌تر از اسپری برای بعضی صاحبان.\n\nنوک قاشق کافی است. روی غذای اصلی نپاش مگر دامپزشک گفته باشد.\n\nبسته ۲۰ گرم. خشک و دربسته نگه دار.\n\n• پودر کت‌نیپ ۲۰ گرم\n• برند بونست\n• برای اسباب‌بازی و اسکرچر\n• مقدار کم\n• دربسته نگهداری شود\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p265",
    slug: "cat-treats-chicken-cat-grass-treat-30-g",
    title: "تشویقی علف گربه طعم مرغ ۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["cat"],
    priceToman: 335_000,
    params: {
      وزن: "30 گرم",
      مناسب_برای: "گربه",
    },
    description:
      "تشویقی جویدنی علف‌گربه با طعم مرغ؛ گزینه دوم کنار اسنک مشابه برای تنوع طعم و بافت.\n\nمثل هر تشویقی از وعده کم کن. برای گربه‌های حریص تکه را خرد کن.\n\n۳۰ گرم. درمان گلوله مو تضمینی نیست.\n\n• تشویقی علف‌گربه طعم مرغ\n• ۳۰ گرم\n• تنوع بافت جویدنی\n• از کالری روزانه کم کن\n• تضمین درمانی ندارد\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p266",
    slug: "dog-toys-enjoy-the-meal-puzzle-toy",
    title: "اسباب‌بازی فکری سگ AFP",
    titleEn: "",
    brandId: "afp",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 5_480_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "پازل غذایی AFP؛ سگ باید قطعه را جابه‌جا کند تا به تشویقی برسد. برای روزهای بارانی و سگ‌های باهوش خسته‌کننده است (به معنی خوب).\n\nسختی را از آسان شروع کن تا ناامید نشود. زیر نظر باشد.\n\nتشویقی را در سهم روزانه حساب کن.\n\n• پازل غذایی AFP\n• تقویت تمرکز و آرامش\n• شروع از سطح آسان\n• بازی نظارت‌شده\n• کالری تشویقی را کم کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p267",
    slug: "dog-toys-ufo-treat-dispenser-dog-toy",
    title: "اسباب‌بازی جایزه‌دهنده سگ مدل سفینه AFP",
    titleEn: "",
    brandId: "afp",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 3_580_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "اسباب‌بازی فکری سفینه‌ای AFP که با حرکت سگ تشویقی را کم‌کم رها می‌کند. مغز را درگیر می‌کند تا کمتر از سر حوصله گاز بگیرد.\n\nتشویقی خشک کوچک داخلش بگذار؛ خیس و چسبناک گیر می‌کند. زیر نظر بازی کند تا نشکند و تکه نبلعد.\n\nبعد بازی خالی و بشوی.\n\n• جایزه‌دهنده / فکری\n• برند AFP\n• مناسب کاهش حوصلگی\n• تشویقی خشک کوچک\n• بازی زیر نظر\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p268",
    slug: "dog-toys-crab-silicone-dog-chew-toothbrush-toy",
    title: "دندانی سیلیکونی مدل خرچنگ",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 1_100_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "جویدنی سیلیکونی به شکل خرچنگ برای گاز سبک و ماساژ لثه. برای سگ‌های مخرب سنگین ممکن است زود پاره شود.\n\nاگر تکه‌تکه شد جمع کن. جای مسواک واقعی نیست.\n\nبعد بازی بشوی.\n\n• سیلیکون طرح خرچنگ\n• ماساژ لثه / گاز سبک\n• نه برای جویدن‌کننده‌های خیلی قوی\n• شست‌وشو بعد بازی\n• جای مسواک دامپزشکی نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p269",
    slug: "dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy",
    title: "عروسک پولیشی هندوانه صدا‌دار لونا",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 362_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "عروسک پولیشی هندوانه با صدای جیرجیر برای بازی سبک داخل خانه. مناسب سگ‌های کوچک و متوسط که گاز مخرب سنگین ندارند.\n\nاگر پاره شد جمع کن تا الیاف نبلعد. جایزه خوراکی نیست؛ زیر نظر بازی کند.\n\nشست‌وشوی سطحی بعد بازی.\n\n• پولیش هندوانه صدا‌دار\n• برند لونا\n• بازی سبک خانگی\n• نه برای جویدن‌کننده‌های خیلی قوی\n• جمع کن اگر پاره شد\n\n— پت دیت شاپ.",
  }),
];
