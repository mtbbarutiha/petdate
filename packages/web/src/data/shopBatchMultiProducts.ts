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
];
