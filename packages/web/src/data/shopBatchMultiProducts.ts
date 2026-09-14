import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "batch-multi-w1-v4";

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
    titleEn: "",
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
    titleEn: "",
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
    titleEn: "",
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
    titleEn: "",
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
    titleEn: "",
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
    titleEn: "",
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
    titleEn: "",
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
    slug: "dog-treats-dr-clauders-pork-filet-strips-80-g",
    title: "تشویقی سگ دکتر کلادرز فیله استریپس خوک ۸۰ گرم",
    titleEn: "",
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
    id: "p258",
    slug: "dog-treats-rabbit-fillet-dr-clauders-80-g",
    title: "تشویقی سگ دکتر کلادرز فیله خرگوش ۸۰ گرم",
    titleEn: "",
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
    id: "p259",
    slug: "dog-treats-wanpy-toothbrush-chews-100g",
    title: "تشویقی سگ ونپی مدل مسواک طعم مرغ ۱۰۰ گرم",
    titleEn: "",
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
];
