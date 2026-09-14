import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "batch-multi-w4-v3";

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

export const SHOP_BATCH_MULTI_WAVE4_PRODUCTS: ShopProduct[] = [
  product({
    id: "p280",
    slug: "dog-accessories-hannapet-silicone-h-harness-sizr-m",
    title: "قلاده H مدل سیلیکونی حناپت سایز M",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_248_000,
    params: {
      سایز: "M",
      مناسب_برای: "سگ",
    },
    description:
      "هارنس H سیلیکونی سایز M برای سگ‌های کوچک تا متوسط؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.\n\nجدول سایز روی محصول را با دور سینه واقعی چک کن؛ حرف M بین برندها یکی نیست.\n\nبرای توله در حال رشد ممکن است زود کوچک شود.\n\n• هارنس H سیلیکونی\n• سایز M\n• برند حناپت\n• اندازه با دور سینه\n• مناسب سگ کوچک–متوسط\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p281",
    slug: "dog-accessories-waudog-classic-leather-collar-25-mm",
    title: "قلاده چرمی WAUDOG Classic",
    titleEn: "",
    brandId: "waudog",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_024_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "قلاده چرمی کلاسیک ۲۵ میلی‌متری WAUDOG؛ ظاهر مرتب برای پیاده‌روی شهری.\n\nچرم را خشک نگه دار و گاه‌به‌گاه با مراقبت چرم تمیز کن. برای سگ‌های خیلی کشنده هارنس مکمل بهتر است.\n\nگردن را قبل خرید اندازه بگیر.\n\n• قلاده چرمی کلاسیک\n• پهنای ۲۵ میلی‌متر\n• برند WAUDOG\n• مراقبت چرم\n• برای کشنده شدید هارنس اضافه کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p282",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-m",
    title: "لیش سیلیکونی حناپت سایز M",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 2_953_000,
    params: {
      سایز: "M",
      مناسب_برای: "سگ",
    },
    description:
      "لیش سیلیکونی سایز M؛ جفت طبیعی هارنس M همان برند. دست را کمتر می‌سوزاند در کشیدن‌های کوتاه.\n\nکارابین را روی حلقه هارنس قفل کن. اگر سگ خیلی سنگین است به L فکر کن.\n\nشست‌وشوی آب خنک.\n\n• لیش سیلیکونی M\n• برند حناپت\n• جفت هارنس هم‌سایز\n• قفل کارابین\n• شست‌وشوی آسان\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p283",
    slug: "cat-accessories-hannapet-double-wooden-bowl-stand",
    title: "پایه چوبی دوقلو حناپت",
    titleEn: "",
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
    id: "p284",
    slug: "cat-accessories-eggshell-bowls-for-cats",
    title: "ظرف آب و غذا گربه مدل پایه دار طرح تخم مرغ",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_468_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "ست ظرف پایه‌دار طرح تخم‌مرغ؛ ظاهر فانتزی با ارتفاع کم تا متوسط برای گربه روزمره.\n\nسبیل‌ها به دیواره تنگ حساس‌اند — اگر دیدید کنار ظرف غذا می‌گذارند ظرف پهن‌تر بهتر است.\n\nروزانه بشوی.\n\n• طرح تخم‌مرغ پایه‌دار\n• آب + غذا\n• مناسب گربه\n• سبیل را فشار ندهد\n• شست‌وشوی روزانه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p285",
    slug: "cat-accessories-high-legend-bowls-for-cat",
    title: "ظرف غذا و آب گربه مدل پایه دار خندان",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 1_110_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "ظرف پایه‌دار طرح خندان؛ انتخاب رنگی برای خانه‌هایی که ظرف ساده نمی‌خواهند.\n\nپایه را روی سطح صاف بگذار تا نلغزد. استیل/پلاستیک را بعد هر وعده تمیز کن تا بو نگیرد.\n\nجای ظرف کنار خاک نباشد.\n\n• مدل خندان پایه‌دار\n• جدا از خاک گربه\n• سطح صاف\n• تمیزکاری بعد وعده\n• مناسب گربه خانگی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p286",
    slug: "cat-accessories-hanapet-double-metal-bowl-stand",
    title: "پایه فلزی دوقلو حناپت",
    titleEn: "",
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
    id: "p287",
    slug: "cat-accessories-petopoli-four-legged-pet-bowl",
    title: "ظرف آب و غذای پایه دار",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-accessories",
    petTypes: ["cat"],
    priceToman: 775_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "ظرف مرتفع چهارپایه؛ برای گربه‌هایی که ایستاده راحت‌تر می‌خورند یا صاحب از ریخت‌وپاش روی زمین خسته شده.\n\nپاها را قفل چک کن. مدل چهارپایه پتوپولی.\n\nلغزش روی سرامیک را با زیرپایی کنترل کن.\n\n• چهارپایه مرتفع\n• برند پتوپولی\n• کمتر خم شدن گردن\n• چک پایداری پاها\n• کنترل لغزش\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p288",
    slug: "grooming-mojan-pet-brush",
    title: "برس سگ و گربه فنری موژان",
    titleEn: "",
    brandId: "mojan",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 823_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "برس فنری برای کندن موهای شل سگ و گربه کوتاه‌مو تا متوسط.\n\nهفته‌ای چند بار کوتاه بهتر از یک‌بار وحشیانه است. اگر پوست حساس است با فشار کمتر.\n\nموی جمع‌شده را بعد هر وعده پاک کن.\n\n• برس فنری موژان\n• مناسب سگ و گربه\n• کاهش ریزش روی مبل\n• فشار ملایم\n• پاک کردن مو از برس\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p289",
    slug: "grooming-dog-shedding-brush-hair-release-button",
    title: "برس مو سگ و گربه مدل بیضی با دکمه تخلیه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 770_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "برس بیضی با دکمه تخلیه مو؛ بعد شانه یک فشار و مو می‌افتد توی سطل نه روی فرش.\n\nروی پوست ملتهب نکش. برای مو بلند ممکن است به شانه جدا هم نیاز باشد.\n\nتمیزکاری بعد هر بار.\n\n• دکمه تخلیه مو\n• مدل بیضی\n• مناسب سگ و گربه\n• نه روی پوست زخمی\n• کمک به کنترل ریزش\n\n— پت دیت شاپ.",
  }),
];
