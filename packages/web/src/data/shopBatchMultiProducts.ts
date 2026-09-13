import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = 'batch-multi-v1';

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

export const SHOP_BATCH_MULTI_PRODUCTS: ShopProduct[] = [
  product({
    id: "p250",
    slug: "cat-litter-mr-cat-cat-litter-10-l-carbon",
    title: "خاک گربه مستر کت کربن‌دار ۱۰ لیتری",
    titleEn: "Cat Litter MR Cat Cat Litter 10 L Carbon",
    brandId: "mr-cat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 502_000,
    params: {
      مدل: "کربن",
      مناسب_برای: "گربه",
    },
    description:
      "خاک گربه با کربن فعال برای کنترل بو در خانه‌های آپارتمانی. مناسب کسی که می‌خواهد بعد از هر بار استفاده بوی تند نماند.\n\nکربن کمک می‌کند بو کمتر پخش شود؛ معجزه صفر بو نیست. لایه کافی در ظرف بگذار و گلوله را روزانه جمع کن تا خاک دیرتر عوض شود. برای چند گربه ممکن است زودتر تمام شود.\n\nدور از رطوبت نگه دار. اگر گربه‌ات خاک عطری را دوست ندارد، مدل بدون اسانس را امتحان کن.\n\n• خاک گربه با کربن برای کنترل بو\n• بسته حدود ۱۰ لیتری\n• جمع روزانه گلوله توصیه می‌شود\n• مناسب خانه آپارتمانی\n• برند مستر کت\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p251",
    slug: "cat-litter-mr-cat-baby-powder-scented-cat-litter-10l-10-kg",
    title: "خاک گربه مستر کت مدل پودر بچه ۱۰ لیتری",
    titleEn: "Cat Litter MR Cat Baby Powder Scented Cat Litter 10l 10 Kg",
    brandId: "mr-cat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 449_000,
    params: {
      وزن: "10 کیلوگرم",
      مناسب_برای: "گربه",
    },
    description:
      "خاک خوش‌بو با رایحه پودر بچه برای کسانی که بوی خاک معمولی را نمی‌پسندند. حجم ۱۰ لیتری برای پر کردن یک ظرف استاندارد.\n\nرایحه تند نیست ولی بعضی گربه‌های حساس خاک معطر را رد می‌کنند — اگر دیدی کنار ظرف می‌نشیند، مدل بدون اسانس بهتر است. گلوله‌زنی خوب یعنی تعویض کمتر.\n\nدر جای خشک نگه دار و بعد از باز شدن در کیسه را ببند.\n\n• رایحه پودر بچه\n• حجم حدود ۱۰ لیتر\n• گلوله‌زنی برای جمع آسان\n• برند مستر کت\n• اگر گربه معطر را رد کرد مدل ساده بگیر\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p252",
    slug: "cat-litter-meocat-activated-carbon-cat-litter-economy",
    title: "خاک گربه کربن فعال مئوکت (اقتصادی)",
    titleEn: "Cat Litter Meocat Activated Carbon Cat Litter Economy",
    brandId: "meocat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 424_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "نسخه اقتصادی مئوکت با کربن فعال برای کنترل بو، بدون خرج اضافی روی بسته‌های بزرگ لوکس.\n\nبرای یک گربه یا بودجه محدود مناسب است. لایه را نازک نگذار؛ کربن وقتی کار می‌کند که خاک به اندازه باشد. روزانه گلوله را بردار.\n\nجایگزین شست‌وشوی ظرف نیست — ظرف را گاه‌به‌گاه بشوی.\n\n• کربن فعال برای بو\n• خط اقتصادی مئوکت\n• مناسب مصرف روزمره\n• جمع روزانه گلوله\n• بدون نام تأمین در کپی مشتری\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p253",
    slug: "cat-litter-mr-cat-oxygen-cat-litter-10-l-10-kg",
    title: "خاک گربه مستر کت مدل اکسیژن ۱۰ لیتری",
    titleEn: "Cat Litter MR Cat Oxygen Cat Litter 10 L 10 Kg",
    brandId: "mr-cat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 414_000,
    params: {
      وزن: "10 کیلوگرم",
      مناسب_برای: "گربه",
    },
    description:
      "خاک ۱۰ لیتری مستر کت مدل اکسیژن برای کنترل بو و مصرف خانگی. انتخاب وسط بین ساده‌های بی‌بو و کربن‌دارهای قوی‌تر.\n\nاگر گربه‌ات خاک خیلی معطر را پس می‌زند این مدل معمولاً ملایم‌تر است. حجم برای یک ظرف متوسط تا چند هفته کافیست بسته به تعداد گربه.\n\nکیسه را بعد باز شدن محکم ببند تا خشک بماند.\n\n• مدل اکسیژن مستر کت\n• حدود ۱۰ لیتر\n• کنترل بو برای خانه\n• گلوله‌زنی روزمره\n• نگهداری در جای خشک\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p254",
    slug: "cat-litter-meocat-super-clump-cat-litter-economy",
    title: "خاک گربه سوپرکلامپ مئوکت (اقتصادی)",
    titleEn: "Cat Litter Meocat Super Clump Cat Litter Economy",
    brandId: "meocat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 369_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "خاک اقتصادی با گلوله‌زنی قوی — یعنی جمع کردن راحت‌تر و تعویض کمتر نسبت به خاک‌های پودری ساده.\n\nسوپرکلامپ برای کسی است که می‌خواهد هزینه ماهانه را پایین نگه دارد ولی هنوز گلوله سفت داشته باشد. اگر گرد و خاک زیاد اذیتت می‌کند هنگام ریختن آرام بریز.\n\nظرف را بیش از حد پر نکن؛ گربه جا برای کندن می‌خواهد.\n\n• گلوله‌زنی قوی (سوپرکلامپ)\n• خط اقتصادی مئوکت\n• جمع آسان‌تر گلوله\n• مناسب بودجه روزمره\n• هنگام ریختن گرد و خاک را کم کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p255",
    slug: "cat-litter-mr-cat-kitten-cat-litter-7l-7-kg",
    title: "خاک بچه‌گربه مستر کت ۷ لیتری",
    titleEn: "Cat Litter MR Cat Kitten Cat Litter 7l 7 Kg",
    brandId: "mr-cat",
    categorySlug: "cat-litter",
    petTypes: ["cat"],
    priceToman: 229_000,
    params: {
      وزن: "7 کیلوگرم",
      مناسب_برای: "گربه",
    },
    description:
      "خاک مخصوص بچه‌گربه با دانه ریزتر و حجم ۷ لیتر — مناسب ظرف کوچک و دوره عادت به خاک.\n\nتوله خاک درشت را گاهی قورت می‌دهد یا دوست ندارد؛ دانه ریزتر کمک می‌کند عادت بگیرد. ظرف را در جای خلوت بگذار و اول بارها تشویق کن.\n\nاگر اسهال دارد اول دامپزشک، نه عوض کردن هیجانی برند خاک.\n\n• مخصوص بچه‌گربه\n• دانه ریزتر / حجم حدود ۷ لیتر\n• برند مستر کت\n• مناسب آموزش خاک\n• جای خلوت برای ظرف\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p256",
    slug: "dog-treats-afp-chill-out-ice-bone",
    title: "استخوان یخی خنک‌کننده AFP",
    titleEn: "Dog Treats Afp Chill Out Ice Bone",
    brandId: "afp",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 1_790_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "استخوان قابل انجماد AFP برای روزهای گرم یا بعد از بازی سنگین. داخلش را با آب یا خوراکی مجاز پر می‌کنی، فریز می‌کنی، بعد می‌دهی سگ بجود.\n\nخنک‌کننده است نه جایگزین آب؛ سگ را بدون سایه در گرما رها نکن. فقط مایعات و خوراکی‌های امن سگ داخلش بریز — نه شکلات و نه استخوان پخته.\n\nبعد از بازی بشوی و خشک کن.\n\n• قابل پر کردن و انجماد\n• برند AFP\n• مناسب تابستان و آرام‌سازی\n• فقط خوراکی امن سگ\n• شست‌وشو بعد مصرف\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p257",
    slug: "dog-treats-rabbit-fillet-dr-clauders-80-g",
    title: "تشویقی سگ دکتر کلادرز فیله خرگوش ۸۰ گرم",
    titleEn: "Dog Treats Rabbit Fillet Dr Clauders 80 G",
    brandId: "dr-clauders",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 760_000,
    params: {
      وزن: "80 گرم",
      مناسب_برای: "سگ",
    },
    description:
      "نوار فیله خرگوش خشک‌شده با پری‌بیوتیک؛ تشویقی گوشتی برای آموزش و جایزه کوچک.\n\nاز سهم کالری روزانه کم کن تا وزن نپرد. اگر آلرژی پروتئینی دارد با دامپزشک هماهنگ کن. بسته ۸۰ گرم برای تشویقی‌های کوتاه مناسب است نه وعده اصلی.\n\nجایگزین غذای کامل نیست.\n\n• فیله خرگوش خشک\n• بسته ۸۰ گرم\n• برند دکتر کلادرز\n• مناسب آموزش و جایزه\n• از کالری روزانه کم کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p258",
    slug: "dog-treats-dr-clauders-pork-filet-strips-80-g",
    title: "تشویقی سگ دکتر کلادرز فیله استریپس خوک ۸۰ گرم",
    titleEn: "Dog Treats Dr Clauders Pork Filet Strips 80 G",
    brandId: "dr-clauders",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 760_000,
    params: {
      وزن: "80 گرم",
      مناسب_برای: "سگ",
    },
    description:
      "استریپس فیله خوک برای سگ‌هایی که طعم گوشت قوی دوست دارند. جویدنی نرم‌تر از استخوان خشک؛ خوب برای جایزه میانی پیاده‌روی.\n\nخوک برای بعضی سگ‌ها سنگین است — با مقدار کم شروع کن. بسته ۸۰ گرم. غذای اصلی نیست.\n\nدور از رطوبت نگه دار.\n\n• فیله استریپس خوک\n• ۸۰ گرم\n• برند دکتر کلادرز\n• شروع با تکه کوچک\n• تشویقی نه وعده اصلی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p259",
    slug: "dog-treats-wanpy-toothbrush-chews-100g",
    title: "تشویقی سگ ونپی مدل مسواک طعم مرغ ۱۰۰ گرم",
    titleEn: "Dog Treats Wanpy Toothbrush Chews 100g",
    brandId: "wanpy",
    categorySlug: "dog-treats",
    petTypes: ["dog"],
    priceToman: 660_000,
    params: {
      وزن: "100گرم",
      مناسب_برای: "سگ",
    },
    description:
      "تشویقی شکل مسواک با طعم مرغ؛ با جویدن به سایش سطحی دندان کمک می‌کند. جای مسواک و جرم‌گیری دامپزشکی را نمی‌گیرد.\n\nمراقب توله و سگ‌های بلعنده عجول باش — تکه بزرگ را نصف کن. بسته ۱۰۰ گرم.\n\nاگر دندان لق یا درد دهان دارد اول کلینیک.\n\n• شکل مسواک / طعم مرغ\n• ۱۰۰ گرم\n• برند ونپی\n• کمک به سایش سطحی — نه درمان لثه\n• برای بلع عجول نصف کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p260",
    slug: "dog-treats-wanpy-chicken-jerky-chips-100g",
    title: "تشویقی سگ ونپی چیپس مرغ ۱۰۰ گرم",
    titleEn: "Dog Treats Wanpy Chicken Jerky Chips 100g",
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
    titleEn: "Cat Treats Bioline Catnip Spray 50ml",
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
    titleEn: "Cat Treats Bonnest Catnip Spray 50 L",
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
    titleEn: "Cat Treats Cat Grass Theething Stick 30 G",
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
    titleEn: "Cat Treats Bonnest Cat Nip Powder 20g 20 G",
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
    titleEn: "Cat Treats Chicken Cat Grass Treat 30 G",
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
    slug: "dog-toys-ufo-treat-dispenser-dog-toy",
    title: "اسباب‌بازی جایزه‌دهنده سگ مدل سفینه AFP",
    titleEn: "Dog Toys Ufo Treat Dispenser Dog Toy",
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
    id: "p267",
    slug: "dog-toys-crab-silicone-dog-chew-toothbrush-toy",
    title: "دندانی سیلیکونی مدل خرچنگ",
    titleEn: "Dog Toys Crab Silicone Dog Chew Toothbrush Toy",
    brandId: "generic",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 1_100_000,
    params: {
      رنگ: "قرمز",
      مناسب_برای: "سگ",
    },
    description:
      "جویدنی سیلیکونی به شکل خرچنگ برای گاز سبک و ماساژ لثه. برای سگ‌های مخرب سنگین ممکن است زود پاره شود.\n\nاگر تکه‌تکه شد جمع کن. جای مسواک واقعی نیست.\n\nرنگ قرمز طبق وریانت. بعد بازی بشوی.\n\n• سیلیکون طرح خرچنگ\n• ماساژ لثه / گاز سبک\n• نه برای جویدن‌کننده‌های خیلی قوی\n• شست‌وشو بعد بازی\n• جای مسواک دامپزشکی نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p268",
    slug: "dog-toys-enjoy-the-meal-puzzle-toy",
    title: "اسباب‌بازی فکری سگ AFP",
    titleEn: "Dog Toys Enjoy The Meal Puzzle Toy",
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
    id: "p269",
    slug: "cat-toys-petopoli-4-way-foldable-cat-play-tunnel",
    title: "تونل بازی چهارراه گربه پتوپولی",
    titleEn: "Cat Toys Petopoli 4 Way Foldable Cat Play Tunnel",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 2_310_000,
    params: {
      رنگ: "قرمز",
      مناسب_برای: "گربه",
    },
    description:
      "تونل تاشو چهارراه برای دویدن و کمین؛ انرژی گربه آپارتمانی را خالی می‌کند بدون اینکه مبل قربانی شود.\n\nروی سطح لغزنده فیکس کن. اگر چند گربه دارید اول جداگانه معرفی کنید تا دعوا سر ورودی نشود.\n\nجمع‌شو برای خانه کوچک.\n\n• تونل چهارراه تاشو\n• برند پتوپولی\n• تخلیه انرژی داخل خانه\n• رنگ قرمز وریانت\n• معرفی آرام به چند گربه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p270",
    slug: "cat-toys-cat-toy-layer-tower-of-tracks",
    title: "برج طبقاتی تعادلی گربه مدل پردار",
    titleEn: "Cat Toys Cat Toy Layer Tower Of Tracks",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 1_520_000,
    params: {
      رنگ: "سبز",
      مناسب_برای: "گربه",
    },
    description:
      "برج توپ و لایه با پر؛ گربه توپ را دنبال می‌کند و گاه‌به‌گاه به پر حمله می‌کند. مناسب میز و کنج خلوت.\n\nباتری/قطعه متحرک اگر داشت را از دستور ساخت چک کن. زیر نظر توله تا قطعه نبلعد.\n\nسبز طبق وریانت.\n\n• برج طبقاتی + پر\n• دنبال کردن توپ\n• مناسب خانه کوچک\n• نظارت روی توله\n• وریانت سبز\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p271",
    slug: "cat-toys-hanging-catnip-bat-toy-for-cats",
    title: "عروسک آویز خفاش کت‌نیپ‌دار",
    titleEn: "Cat Toys Hanging Catnip Bat Toy For Cats",
    brandId: "juicer",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 960_000,
    params: {
      رنگ: "سبز",
      مناسب_برای: "گربه",
    },
    description:
      "خفاش آویز با کت‌نیپ برای حمله از در و قفسه. نصب محکم؛ اگر بیفتد بازی تمام است و ممکن است پاره شود.\n\nکت‌نیپ داخلش بو را زنده نگه می‌دارد. نخ و قطعات کوچک را چک کن.\n\nسبز / جویسر.\n\n• آویز خفاش + کت‌نیپ\n• نصب محکم\n• تقویت شکار خانگی\n• برند جویسر\n• ایمنی نخ و قطعه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p272",
    slug: "cat-toys-little-yellow-cat-toy",
    title: "اسباب‌بازی تعادلی تشویقی‌خور مدل جوجه اردک",
    titleEn: "Cat Toys Little Yellow Cat Toy",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 825_000,
    params: {
      رنگ: "آبی",
      مناسب_برای: "گربه",
    },
    description:
      "تعادل‌کننده تشویقی‌خور طرح جوجه اردک؛ گربه باید حرکت بدهد تا جایزه برسد. نسخه گربه‌ای پازل نرم.\n\nتشویقی خشک ریز بریز. آبی طبق وریانت.\n\nزیر نظر اگر پلاستیک جویده شد.\n\n• تشویقی‌خور تعادلی\n• طرح جوجه اردک\n• تقویت بازی فکری\n• تشویقی خشک ریز\n• وریانت آبی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p273",
    slug: "cat-toys-play-tunnel-bag",
    title: "کیسه بازی گربه پتوپولی",
    titleEn: "Cat Toys Play Tunnel Bag",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 792_000,
    params: {
      رنگ: "سبز",
      مناسب_برای: "گربه",
    },
    description:
      "کیسه/تونل نرم برای قایم‌باشک؛ جایگزین سبک تونل سفت در خانه خیلی کوچک.\n\nبعد بازی جمع کن تا زمین‌گیر نشود. اگر گربه داخلش ادرار کرد طبق پارچه بشوی.\n\nسبز پتوپولی.\n\n• کیسه بازی تاشو\n• برند پتوپولی\n• قایم‌باشک خانگی\n• جمع بعد بازی\n• قابل شست‌وشو در حد پارچه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p274",
    slug: "cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats",
    title: "توپ هوشمند رباتیک گربه",
    titleEn: "Cat Toys Automatic Cat Teaser Ball Robotic Toy For Cats",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 610_050,
    params: {
      رنگ: "آبی روشن",
      مناسب_برای: "گربه",
    },
    description:
      "توپ حرکتی خودکار برای وقتی خودت حوصله میله پر نداری. روی سطح صاف بهتر کار می‌کند.\n\nباتری را چک کن و شب خاموش بگذار تا گربه نخوابد. زیر نظر اولین جلسه‌ها.\n\nآبی روشن.\n\n• توپ رباتیک خودکار\n• تخلیه انرژی بدون میله\n• سطح صاف\n• خاموش کردن بین بازی\n• اولین بار نظارت\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p275",
    slug: "dog-accessories-hannapet-silicone-h-harness-size-l",
    title: "هارنس H سیلیکونی حناپت سایز L",
    titleEn: "Dog Accessories Hannapet Silicone H Harness Size L",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 4_355_000,
    params: {
      رنگ: "مشکی",
      مناسب_برای: "سگ",
    },
    description:
      "هارنس H سیلیکونی سایز L برای سگ‌های متوسط رو به بزرگ؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.\n\nاندازه سینه را دقیق بگیر؛ تنگ = زخم، گشاد = دررفتن. مشکی طبق وریانت.\n\nبرای سگ‌های خیلی کشنده ممکن است به مدل محکم‌تر نیاز باشد.\n\n• هارنس H سیلیکونی\n• سایز L\n• برند حناپت\n• فشار کمتر روی گردن\n• اندازه‌گیری سینه قبل خرید\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p276",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-l",
    title: "لیش سیلیکونی حناپت سایز L",
    titleEn: "Dog Accessories Hannapet Silicone Dog Leash Size L",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_332_000,
    params: {
      رنگ: "صورتی",
      مناسب_برای: "سگ",
    },
    description:
      "لیش سیلیکونی سایز L؛ نرم در دست و قابل شست‌وشو نسبت به پارچه‌های زبر. صورتی طبق وریانت.\n\nبا هارنس مناسب جفت کن نه فقط قلاده گردنی برای سگ‌های کشنده. گره و کارابین را قبل خروج چک کن.\n\nطول را با فضای پیاده‌روی‌ات بسنج.\n\n• لیش سیلیکونی L\n• برند حناپت\n• نرم و قابل شست‌وشو\n• وریانت صورتی\n• چک قفل قبل خروج\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p277",
    slug: "dog-accessories-hannapet-silicone-h-harness-sizr-m",
    title: "هارنس H سیلیکونی حناپت سایز M",
    titleEn: "Dog Accessories Hannapet Silicone H Harness Sizr M",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_248_000,
    params: {
      رنگ: "نارنجی",
      مناسب_برای: "سگ",
    },
    description:
      "همان خط هارنس سیلیکونی حناپت در سایز M برای سگ‌های کوچک تا متوسط. نارنجی طبق وریانت.\n\nجدول سایز روی محصول را با دور سینه واقعی چک کن؛ حرف M بین برندها یکی نیست.\n\nبرای توله در حال رشد ممکن است زود کوچک شود.\n\n• هارنس H سیلیکونی\n• سایز M\n• حناپت / نارنجی\n• اندازه با دور سینه\n• مناسب سگ کوچک–متوسط\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p278",
    slug: "dog-accessories-waudog-classic-leather-collar-25-mm",
    title: "قلاده چرمی WAUDOG Classic سایز S",
    titleEn: "Dog Accessories Waudog Classic Leather Collar 25 Mm",
    brandId: "waudog",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_024_000,
    params: {
      سایز: "سایز S",
      مناسب_برای: "سگ",
    },
    description:
      "قلاده چرمی کلاسیک ۲۵ میلی‌متری WAUDOG برای سگ‌های کوچک؛ ظاهر مرتب برای پیاده‌روی شهری.\n\nچرم را خشک نگه دار و گاه‌به‌گاه با مراقبت چرم تمیز کن. برای سگ‌های خیلی کشنده هارنس مکمل بهتر است.\n\nسایز S — گردن را اندازه بگیر.\n\n• قلاده چرمی کلاسیک\n• پهنای ۲۵ میلی‌متر\n• سایز S / WAUDOG\n• مراقبت چرم\n• برای کشنده شدید هارنس اضافه کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p279",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-m",
    title: "لیش سیلیکونی حناپت سایز M",
    titleEn: "Dog Accessories Hannapet Silicone Dog Leash Size M",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 2_953_000,
    params: {
      رنگ: "مشکی",
      مناسب_برای: "سگ",
    },
    description:
      "لیش سیلیکونی سایز M مشکی؛ جفت طبیعی هارنس M همان برند. دست را کمتر می‌سوزاند در کشیدن‌های کوتاه.\n\nکارابین را روی حلقه هارنس قفل کن. اگر سگ خیلی سنگین است به L فکر کن.\n\nشست‌وشوی آب خنک.\n\n• لیش سیلیکونی M\n• مشکی / حناپت\n• جفت هارنس هم‌سایز\n• قفل کارابین\n• شست‌وشوی آسان\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p280",
    slug: "cat-accessories-hannapet-double-wooden-bowl-stand",
    title: "پایه چوبی دوقلو حناپت",
    titleEn: "Cat Accessories Hannapet Double Wooden Bowl Stand",
    brandId: "hannapet",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 2_130_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "پایه چوبی دو ظرف برای آب و غذا؛ ارتفاع ملایم تا گردن کمتر خم شود — مخصوصاً برای گربه‌های مسن‌تر.\n\nچوب را خیس نگذار؛ ظرف‌ها را جدا بشوی. جای ثابت انتخاب کن تا گربه سردرگم نشود.\n\nیک عدد.\n\n• پایه چوبی دوقلو\n• برند حناپت\n• ارتفاع راحت‌تر برای خوردن\n• شست‌وشوی ظرف جدا از چوب\n• جای ثابت در خانه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p281",
    slug: "cat-accessories-eggshell-bowls-for-cats",
    title: "ظرف آب و غذا پایه‌دار طرح تخم‌مرغ",
    titleEn: "Cat Accessories Eggshell Bowls For Cats",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_468_000,
    params: {
      رنگ: "قهوه ای",
      مناسب_برای: "گربه",
    },
    description:
      "ست ظرف پایه‌دار طرح تخم‌مرغ؛ ظاهر فانتزی با ارتفاع کم تا متوسط برای گربه روزمره.\n\nسبیل‌ها به دیواره تنگ حساس‌اند — اگر دیدید کنار ظرف غذا می‌گذارند ظرف پهن‌تر بهتر است. قهوه‌ای طبق وریانت.\n\nروزانه بشوی.\n\n• طرح تخم‌مرغ پایه‌دار\n• آب + غذا\n• وریانت قهوه‌ای\n• سبیل را فشار ندهد\n• شست‌وشوی روزانه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p282",
    slug: "cat-accessories-high-legend-bowls-for-cat",
    title: "ظرف غذا و آب پایه‌دار مدل خندان",
    titleEn: "Cat Accessories High Legend Bowls For Cat",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_110_000,
    params: {
      رنگ: "قرمز",
      مناسب_برای: "گربه",
    },
    description:
      "ظرف پایه‌دار طرح خندان؛ انتخاب رنگی برای خانه‌هایی که ظرف ساده نمی‌خواهند. قرمز طبق وریانت.\n\nپایه را روی سطح صاف بگذار تا نلغزد. استیل/پلاستیک را بعد هر وعده تمیز کن تا بو نگیرد.\n\nجای ظرف کنار خاک نباشد.\n\n• مدل خندان پایه‌دار\n• قرمز\n• جدا از خاک گربه\n• سطح صاف\n• تمیزکاری بعد وعده\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p283",
    slug: "cat-accessories-hanapet-double-metal-bowl-stand",
    title: "پایه فلزی دوقلو حناپت",
    titleEn: "Cat Accessories Hanapet Double Metal Bowl Stand",
    brandId: "hannapet",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_100_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "پایه فلزی دو ظرف؛ مقاوم‌تر از چوب در برابر رطوبت ریز آب. مناسب گربه‌هایی که دور ظرف آب می‌پاشند.\n\nفلز را خشک کن تا لکه نماند. ارتفاع را با جثه گربه بسنج.\n\nیک عدد.\n\n• پایه فلزی دوقلو\n• حناپت\n• مقاوم رطوبت\n• خشک کردن بعد شست‌وشو\n• مناسب پاشیدن آب\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p284",
    slug: "cat-accessories-petopoli-four-legged-pet-bowl",
    title: "ظرف آب و غذای چهارپایه پتوپولی",
    titleEn: "Cat Accessories Petopoli Four Legged Pet Bowl",
    brandId: "petopoli",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 775_000,
    params: {
      مدل: "مدل چهارپایه",
      مناسب_برای: "گربه",
    },
    description:
      "ظرف مرتفع چهارپایه؛ برای گربه‌هایی که ایستاده راحت‌تر می‌خورند یا صاحب از ریخت‌وپاش روی زمین خسته شده.\n\nپاها را قفل چک کن. مدل چهارپایه پتوپولی.\n\nلغزش روی سرامیک را با زیرپایی کنترل کن.\n\n• چهارپایه مرتفع\n• برند پتوپولی\n• کمتر خم شدن گردن\n• چک پایداری پاها\n• کنترل لغزش\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p285",
    slug: "grooming-bonnest-calming-shampoo-for-pet-200-l",
    title: "شامپو آرامش‌بخش بونست ۲۰۰ میلی‌لیتر",
    titleEn: "Grooming Bonnest Calming Shampoo For Pet 200 L",
    brandId: "bonnest",
    categorySlug: "grooming",
    petTypes: ["dog"],
    priceToman: 680_000,
    params: {
      وزن: "200 میلی لیتر",
      مناسب_برای: "سگ",
    },
    description:
      "شامپو ۲۰۰ میلی‌لیتری بونست با ادعای رایحه آرامش‌بخش برای حمام‌های کم‌استرس‌تر. شامپوی انسان استفاده نکن.\n\nآب ولرم، چشم و گوش را حفظ کن. اگر پوست قرمز یا زخم است اول دامپزشک.\n\nخشک کردن کامل بعد حمام.\n\n• شامپو پت ۲۰۰ میل\n• برند بونست\n• نه برای انسان\n• محافظت چشم و گوش\n• زخم پوست = دامپزشک اول\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p286",
    slug: "dog-toys-luna-pomegranate-felt-squeaky-dog-toy",
    title: "عروسک نمدی لونا طرح انار",
    titleEn: "Dog Toys Luna Pomegranate Felt Squeaky Dog Toy",
    brandId: "lunapet",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 322_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "عروسک نمدی صدادهنده لونا؛ سبک برای توله و سگ‌های بازی‌گوش نرم. داخل خانه بهتر از حیاط خشن است.\n\nاگر سگ نمد را می‌درد، اسباب‌بازی مقاوم‌تر بگیر. صدای جیرجیر را بعضی سگ‌ها دوست دارند بعضی می‌ترسند.\n\nبعد پاره شدن دور بینداز.\n\n• نمد طرح انار / لوناپت\n• صدادهنده\n• مناسب بازی نرم خانگی\n• زیر نظر اگر پاره شد\n• جایگزین جویدنی مقاوم نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p287",
    slug: "dog-toys-luna-squeaky-smile-watermelon-plush-dog-toy",
    title: "عروسک پولیشی لونا هندوانه خندان صدا دار",
    titleEn: "Dog Toys Luna Squeaky Smile Watermelon Plush Dog Toy",
    brandId: "lunapet",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 362_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "پولیش نرم صدادهنده طرح هندوانه خندان؛ برای بازی طناب‌کشی ملایم و حمل‌کردن در خانه.\n\nسگ‌های جوینده حرفه‌ای الیاف را خالی می‌کنند — فقط زیر نظر. الیاف بلعیده‌شده خطرناک است.\n\nشست‌وشوی سطحی طبق دوام پارچه.\n\n• پولیش هندوانه خندان\n• صدادهنده لوناپت\n• بازی نرم خانگی\n• نظارت برای جویندهای قوی\n• الیاف را قورت ندهد\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p288",
    slug: "dog-toys-luna-squeaky-watermelon-plush-dog-toy",
    title: "عروسک پولیشی لونا طرح هندوانه صدا دار",
    titleEn: "Dog Toys Luna Squeaky Watermelon Plush Dog Toy",
    brandId: "lunapet",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 312_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "نسخه کلاسیک هندوانه پولیشی لونا با صدا؛ هم‌سبک مدل خندان برای تنوع ظاهر.\n\nهمان قانون: بازی نرم، نظارت، دور انداختن وقتی پاره شد.\n\nبرای توله و سگ کم‌تهاجم مناسب‌تر است.\n\n• پولیش هندوانه / صدا دار\n• برند لوناپت\n• تنوع ظاهری نسبت به مدل خندان\n• نظارت هنگام بازی\n• مقاوم جویدن سنگین نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p289",
    slug: "dog-carriers-luxury-leather-space-pet-carier-backpack",
    title: "کوله فضایی چرمی لاکچری (سفید)",
    titleEn: "Dog Carriers Luxury Leather Space Pet Carier Backpack",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_795_000,
    params: {
      رنگ: "سفید",
      مناسب_برای: "سگ",
    },
    description:
      "کوله فضایی با نمای چرمی برای جابه‌جایی سگ/گربه کوچک در شهر. پنجره برای دیدن بیرون و هوای نسبی.\n\nوزن حیوان و کوله را با شانه خودت بسنج. سفید زود لکه می‌شود. هرگز در ماشین زیر آفتاب بسته رها نکن.\n\nقبل خرید دور سینه و وزن پت را چک کن.\n\n• کوله فضایی چرمی\n• وریانت سفید\n• مناسب جثه کوچک\n• تهویه و نظارت\n• نه در گرمای بسته\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p290",
    slug: "dog-carriers-leather-pet-carier-backpack",
    title: "کوله فضایی چرمی پارک‌دار (آبی)",
    titleEn: "Dog Carriers Leather Pet Carier Backpack",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_650_000,
    params: {
      رنگ: "آبی",
      مناسب_برای: "سگ",
    },
    description:
      "کوله فضایی چرمی با فضای پارک/ایستادن محدود؛ آبی طبق وریانت. برای رفت‌وآمد کوتاه شهری.\n\nپت را تدریجی به کوله عادت بده. زیپ و بست را قبل خروج چک کن.\n\nهوای کافی و توقف برای آب.\n\n• کوله چرمی پارک‌دار\n• آبی\n• عادت تدریجی پت\n• چک زیپ و بست\n• توقف آب در مسیر طولانی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p291",
    slug: "dog-carriers-fiber-space-pet-carrier-backpack",
    title: "کوله فضایی فایبر (قرمز)",
    titleEn: "Dog Carriers Fiber Space Pet Carrier Backpack",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 6_160_000,
    params: {
      رنگ: "قرمز",
      مناسب_برای: "سگ",
    },
    description:
      "کوله فضایی مدل فایبر؛ معمولاً سبک‌تر از چرم مصنوعی سنگین. قرمز طبق وریانت.\n\nبرای باران مستقیم ایده‌آل نیست مگر کاور داشته باشد. وزن مجاز را رعایت کن.\n\nپد داخل را جدا بشوی اگر قابل جدا شدن است.\n\n• کوله فایبر\n• قرمز / سبک‌تر\n• وزن مجاز پت\n• مراقب باران\n• شست‌وشوی پد\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p292",
    slug: "cat-carriers-jupiter-cat-hard-box",
    title: "باکس حمل سخت ژوپیتر (آبی)",
    titleEn: "Cat Carriers Jupiter Cat Hard Box",
    brandId: "generic",
    categorySlug: "cat-carriers",
    petTypes: ["cat"],
    priceToman: 2_970_000,
    params: {
      رنگ: "آبی",
      مناسب_برای: "گربه",
    },
    description:
      "باکس سخت برای ماشین و دامپزشکی؛ امن‌تر از کیف نرم در تصادف‌های ناگهانی. آبی طبق وریانت.\n\nگربه را از قبل با باکس به‌عنوان جای امن آشنا کن نه فقط روز تزریق. روی صندلی ثابت کن.\n\nتهویه را نبند.\n\n• باکس سخت ژوپیتر\n• آبی\n• مناسب سفر و کلینیک\n• آشناسازی قبلی\n• ثابت کردن در ماشین\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p293",
    slug: "cat-carriers-zarix-zeus-for-cat",
    title: "کوله فضایی زئوس زاریکس (خاکستری تیره)",
    titleEn: "Cat Carriers Zarix Zeus For Cat",
    brandId: "zarix",
    categorySlug: "cat-carriers",
    petTypes: ["cat"],
    priceToman: 4_274_000,
    params: {
      رنگ: "خاکستری تیره",
      مناسب_برای: "گربه",
    },
    description:
      "کوله فضایی مدل زئوس برای گربه/پت کوچک؛ خاکستری تیره کمتر از سفید لکه نشان می‌دهد.\n\nوزن و جثه را با کوله بسنج. در مترو شلوغ مراقب در باشی که باز نشود.\n\nنفس‌گیر نباشد؛ توقف استراحت.\n\n• کوله زئوس زاریکس\n• خاکستری تیره\n• جثه کوچک\n• چک بست در شلوغی\n• تهویه و استراحت\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p294",
    slug: "cat-carriers-raha-pet-hard-box-3",
    title: "باکس حمل رها سایز ۳",
    titleEn: "Cat Carriers Raha Pet Hard Box 3",
    brandId: "zarix",
    categorySlug: "cat-carriers",
    petTypes: ["cat"],
    priceToman: 3_960_000,
    params: {
      سایز: "سایز 3",
      مناسب_برای: "گربه",
    },
    description:
      "باکس سخت رها سایز ۳ برای پت‌های بزرگ‌تر از سایزهای کوچک خانگی. انتخاب وقتی باکس مینی تنگ است.\n\nاندازه حیوان ایستاده/چرخیده را چک کن. برند زاریکس/رها طبق لیست تأمین.\n\nدر ماشین مهار کن.\n\n• باکس سخت سایز ۳\n• فضای بزرگ‌تر\n• مهار در خودرو\n• اندازه‌گیری قبل خرید\n• مناسب کلینیک و سفر\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p295",
    slug: "bird-food-oshkaia-mixed-nut-cockatiel-food-kg",
    title: "خوراک آجیلی مخلوط عروس هلندی اوشکایا ۱ کیلو",
    titleEn: "Bird Food Oshkaia Mixed Nut Cockatiel Food Kg",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 525_000,
    params: {
      وزن: "یک کیلو",
      مناسب_برای: "پرنده",
    },
    description:
      "مخلوط آجیلی برای عروس هلندی و طوطی‌های کوچک مشابه؛ تنوع مغز و دانه برای روزمره.\n\nآجیل چرب است — با سبزی و پلت متعادل کن تا فقط چربی نخورند. تازه و خشک نگه دار.\n\n۱ کیلو. جای آب کثیف را عوض کن.\n\n• مخلوط آجیلی عروس هلندی\n• ۱ کیلو / اوشکایا\n• با رژیم متنوع ترکیب کن\n• نگهداری خشک\n• آب تازه روزانه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p296",
    slug: "bird-food-oshkaia-mynah-bird-food-kg",
    title: "خوراک مرغ مینا و حشره‌خوار اوشکایا ۱ کیلو",
    titleEn: "Bird Food Oshkaia Mynah Bird Food Kg",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 495_000,
    params: {
      وزن: "یک کیلو",
      مناسب_برای: "پرنده",
    },
    description:
      "فرمول مخصوص مینا و پرندگان حشره‌خوار؛ با دانه مخلوط عروس یکی نیست.\n\nمینا به پروتئین حیوانی/حشره بیشتر نیاز دارد — این خط برای همان است نه برای قناری. کاسه را روزانه تمیز کن.\n\n۱ کیلو. مکمل میوه/سبزی طبق گونه.\n\n• مخصوص مینا / حشره‌خوار\n• ۱ کیلو اوشکایا\n• متفاوت از خوراک عروس\n• بهداشت ظرف روزانه\n• تنوع غذایی گونه را رعایت کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p297",
    slug: "grooming-spray-massage-brush-for-pet",
    title: "برس اسپری‌دار طرح انبه",
    titleEn: "Grooming Spray Massage Brush For Pet",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog"],
    priceToman: 520_000,
    params: {
      رنگ: "زرد",
      مناسب_برای: "سگ",
    },
    description:
      "برس ماساژ با مخزن اسپری طرح انبه؛ همزمان شانه و کمی رطوبت/اسپری مراقبت (طبق مایع مجاز پت).\n\nمایع نامناسب نریز. زرد طبق وریانت. برای گره سفت اول گره بازکن جدا.\n\nآرام شانه کن تا پوست نخراشد.\n\n• برس + مخزن اسپری\n• طرح انبه / زرد\n• فقط مایع مناسب پت\n• گره سفت را جدا باز کن\n• فشار ملایم روی پوست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p298",
    slug: "grooming-mojan-pet-brush",
    title: "برس فنری موژان سایز S",
    titleEn: "Grooming Mojan Pet Brush",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 823_000,
    params: {
      سایز: "سایز S",
      مناسب_برای: "سگ و گربه",
    },
    description:
      "برس فنری برای کندن موهای شل سگ و گربه کوتاه‌مو تا متوسط. سایز S برای جثه کوچک‌تر.\n\nهفته‌ای چند بار کوتاه بهتر از یک‌بار وحشیانه است. اگر پوست حساس است با فشار کمتر.\n\nموی جمع‌شده را بعد هر وعده پاک کن.\n\n• برس فنری موژان\n• سایز S\n• کاهش ریزش روی مبل\n• فشار ملایم\n• پاک کردن مو از برس\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p299",
    slug: "grooming-dog-shedding-brush-hair-release-button",
    title: "برس ریزش‌گیر بیضی با دکمه تخلیه",
    titleEn: "Grooming Dog Shedding Brush Hair Release Button",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 770_000,
    params: {
      رنگ: "صورتی",
      مناسب_برای: "سگ و گربه",
    },
    description:
      "برس بیضی با دکمه تخلیه مو؛ بعد شانه یک فشار و مو می‌افتد توی سطل نه روی فرش. صورتی طبق وریانت.\n\nروی پوست ملتهب نکش. برای مو بلند ممکن است به شانه جدا هم نیاز باشد.\n\nتمیزکاری بعد هر بار.\n\n• دکمه تخلیه مو\n• مدل بیضی\n• وریانت صورتی\n• نه روی پوست زخمی\n• کمک به کنترل ریزش\n\n— پت دیت شاپ.",
  }),
];
