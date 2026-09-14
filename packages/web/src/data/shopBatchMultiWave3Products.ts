import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "batch-multi-w3-v2";

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

export const SHOP_BATCH_MULTI_WAVE3_PRODUCTS: ShopProduct[] = [
  product({
    id: "p270",
    slug: "dog-toys-luna-pomegranate-felt-squeaky-dog-toy",
    title: "عروسک نمدی لونا طرح انار",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 322_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "عروسک نمدی صدادهنده لونا؛ سبک برای توله و سگ‌های بازی‌گوش نرم. داخل خانه بهتر از حیاط خشن است.\n\nاگر سگ نمد را می‌درد، اسباب‌بازی مقاوم‌تر بگیر. صدای جیرجیر را بعضی سگ‌ها دوست دارند بعضی می‌ترسند.\n\nبعد پاره شدن دور بینداز.\n\n• نمد طرح انار / لونا\n• صدادهنده\n• مناسب بازی نرم خانگی\n• زیر نظر اگر پاره شد\n• جایگزین جویدنی مقاوم نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p271",
    slug: "dog-toys-luna-squeaky-watermelon-plush-dog-toy",
    title: "عروسک پولیشی لونا طرح هندوانه صدا دار",
    titleEn: "",
    brandId: "luna",
    categorySlug: "dog-toys",
    petTypes: ["dog"],
    priceToman: 312_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "نسخه کلاسیک هندوانه پولیشی لونا با صدا؛ هم‌سبک مدل خندان برای تنوع ظاهر.\n\nهمان قانون: بازی نرم، نظارت، دور انداختن وقتی پاره شد.\n\nبرای توله و سگ کم‌تهاجم مناسب‌تر است.\n\n• پولیش هندوانه / صدا دار\n• برند لونا\n• تنوع ظاهری نسبت به مدل خندان\n• نظارت هنگام بازی\n• مقاوم جویدن سنگین نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p272",
    slug: "cat-toys-petopoli-4-way-foldable-cat-play-tunnel",
    title: "تونل بازی چهارراه گربه",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 2_310_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "تونل تاشو چهارراه برای دویدن و کمین؛ انرژی گربه آپارتمانی را خالی می‌کند بدون اینکه مبل قربانی شود.\n\nروی سطح لغزنده فیکس کن. اگر چند گربه دارید اول جداگانه معرفی کنید تا دعوا سر ورودی نشود.\n\nجمع‌شو برای خانه کوچک.\n\n• تونل چهارراه تاشو\n• برند پتوپولی\n• تخلیه انرژی داخل خانه\n• معرفی آرام به چند گربه\n• بازی نظارت‌شده\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p273",
    slug: "cat-toys-cat-toy-layer-tower-of-tracks",
    title: "اسباب بازی طبقاتی تعادلی گربه مدل پردار",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 1_520_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "برج توپ و لایه با پر؛ گربه توپ را دنبال می‌کند و گاه‌به‌گاه به پر حمله می‌کند. مناسب میز و کنج خلوت.\n\nباتری/قطعه متحرک اگر داشت را از دستور ساخت چک کن. زیر نظر توله تا قطعه نبلعد.\n\n• برج طبقاتی + پر\n• دنبال کردن توپ\n• مناسب خانه کوچک\n• نظارت روی توله\n• بازی سبک خانگی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p274",
    slug: "cat-toys-hanging-catnip-bat-toy-for-cats",
    title: "عروسک آویز گربه طرح خفاش کت‌نیپ‌دار",
    titleEn: "",
    brandId: "juicer",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 960_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "خفاش آویز با کت‌نیپ برای حمله از در و قفسه. نصب محکم؛ اگر بیفتد بازی تمام است و ممکن است پاره شود.\n\nکت‌نیپ داخلش بو را زنده نگه می‌دارد. نخ و قطعات کوچک را چک کن.\n\n• آویز خفاش + کت‌نیپ\n• نصب محکم\n• تقویت شکار خانگی\n• برند جویسر\n• ایمنی نخ و قطعه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p275",
    slug: "cat-toys-little-yellow-cat-toy",
    title: "اسباب بازی تشویقی خور تعادلی گربه مدل جوجه اردک",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 825_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "تعادل‌کننده تشویقی‌خور طرح جوجه اردک؛ گربه باید حرکت بدهد تا جایزه برسد. نسخه گربه‌ای پازل نرم.\n\nتشویقی خشک ریز بریز.\n\nزیر نظر اگر پلاستیک جویده شد.\n\n• تشویقی‌خور تعادلی\n• طرح جوجه اردک\n• تقویت بازی فکری\n• تشویقی خشک ریز\n• بازی زیر نظر\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p276",
    slug: "cat-toys-play-tunnel-bag",
    title: "کیسه بازی گربه برند",
    titleEn: "",
    brandId: "petopoli",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 792_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "کیسه/تونل نرم برای قایم‌باشک؛ جایگزین سبک تونل سفت در خانه خیلی کوچک.\n\nبعد بازی جمع کن تا زمین‌گیر نشود. اگر گربه داخلش ادرار کرد طبق پارچه بشوی.\n\n• کیسه بازی تاشو\n• برند پتوپولی\n• قایم‌باشک خانگی\n• جمع بعد بازی\n• قابل شست‌وشو در حد پارچه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p277",
    slug: "cat-toys-automatic-cat-teaser-ball-robotic-toy-for-cats",
    title: "توپ هوشمند رباتیک گربه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 610_050,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "توپ حرکتی خودکار برای وقتی خودت حوصله میله پر نداری. روی سطح صاف بهتر کار می‌کند.\n\nباتری را چک کن و شب خاموش بگذار تا گربه نخوابد. زیر نظر اولین جلسه‌ها.\n\n• توپ رباتیک خودکار\n• تخلیه انرژی بدون میله\n• سطح صاف\n• خاموش کردن بین بازی\n• اولین بار نظارت\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p278",
    slug: "dog-accessories-hannapet-silicone-h-harness-size-l",
    title: "قلاده H مدل سیلیکونی حناپت سایز L",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 4_355_000,
    params: {
      سایز: "L",
      مناسب_برای: "سگ",
    },
    description:
      "هارنس H سیلیکونی سایز L برای سگ‌های متوسط رو به بزرگ؛ فشار کمتر روی گردن نسبت به قلاده ساده هنگام کشیدن.\n\nاندازه سینه را دقیق بگیر؛ تنگ = زخم، گشاد = دررفتن.\n\nبرای سگ‌های خیلی کشنده ممکن است به مدل محکم‌تر نیاز باشد.\n\n• هارنس H سیلیکونی\n• سایز L\n• برند حناپت\n• فشار کمتر روی گردن\n• اندازه‌گیری سینه قبل خرید\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p279",
    slug: "dog-accessories-hannapet-silicone-dog-leash-size-l",
    title: "لیش سیلیکونی حناپت سایز L",
    titleEn: "",
    brandId: "hannapet",
    categorySlug: "dog-accessories",
    petTypes: ["dog"],
    priceToman: 3_332_000,
    params: {
      سایز: "L",
      مناسب_برای: "سگ",
    },
    description:
      "لیش سیلیکونی سایز L؛ نرم در دست و قابل شست‌وشو نسبت به پارچه‌های زبر.\n\nبا هارنس مناسب جفت کن نه فقط قلاده گردنی برای سگ‌های کشنده. گره و کارابین را قبل خروج چک کن.\n\nطول را با فضای پیاده‌روی‌ات بسنج.\n\n• لیش سیلیکونی L\n• برند حناپت\n• نرم و قابل شست‌وشو\n• چک قفل قبل خروج\n• مناسب پیاده‌روی\n\n— پت دیت شاپ.",
  }),
];
