import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "digikala-b1-p1-v1";

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

export const SHOP_DIGIKALA_BATCH1_PART1_PRODUCTS: ShopProduct[] = [
  product({
    id: "p300",
    slug: "cat-food-dkp-21263751",
    title: "کنسرو گربه بالغ گورمت طعم مرغ — بسته ۶ عددی",
    titleEn: "",
    brandId: "gourmet",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 1_800_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "بسته ۶ عددی کنسرو گورمت با طعم مرغ برای گربه بالغ؛ تنوع تر کنار کیسه خشک.\n\nبرچسب هر قوطی را برای بافت بخوان. باقیمانده را یخچال کن.\n\nحساسیت مرغ را جدی بگیر.\n\n• طعم مرغ\n• بسته ۶ عددی\n• گورمت\n• گربه بالغ\n• یخچال بعد باز شدن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p301",
    slug: "cat-food-dkp-10928475",
    title: "گورمت گلد پته بوقلمون ۸۵ گرم",
    titleEn: "",
    brandId: "gourmet",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 249_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "کاپ ۸۵ گرمی گورمت گلد بافت پته بوقلمون؛ تشویقی وعده‌ای یا تکمیل خشک برای بدغذاها.\n\nبسته کوچک یعنی کمتر دورریز. تمام‌شده را رها نکن تا فاسد شود.\n\nجایگزین چکاپ نیست.\n\n• پته بوقلمون ۸۵ گرم\n• برند گورمت گلد\n• کاپ تک‌وعده‌ای\n• کم‌دورریز\n• مکمل خشک\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p302",
    slug: "dog-food-dkp-15589693",
    title: "پودینگ سگ ونپی اردک، هویج و نخود ۹۰ گرم",
    titleEn: "",
    brandId: "wanpy",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 186_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "پودینگ نرم ۹۰ گرمی ونپی با اردک و سبزی؛ بافت متفاوت از کنسرو تکه‌ای برای سگ‌های مسن یا بدغذا.\n\nقاشق بزن روی خشک یا جدا. شکر اضافه ندارد ولی باز هم کالری دارد.\n\nجایگزین رژیم درمانی کلیه/معده نیست.\n\n• پودینگ اردک و سبزی\n• ۹۰ گرم\n• ونپی\n• بافت نرم\n• کالری را حساب کن\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p303",
    slug: "cat-treats-dkp-9520987",
    title: "قرص ضد انگل ورمکس — فقط با نظر دامپزشک",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-treats",
    petTypes: ["dog"],
    priceToman: 480_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "قرص ضد انگل مدل استخوانی‌خوش‌طعم، بسته ۱۰ عددی. **انگل‌کشی خودسرانه نکن؛ وزن، گونه و نوع انگل را دامپزشک تعیین می‌کند.**\n\nدوز اینترنتی نده. توله، آبستن و حیوان بیمار پروتکل جدا دارند. این متن نسخه نیست.\n\nبعد از تجویز، بهداشت ظرف و محیط را هم رعایت کن.\n\n• ضد انگل خوراکی\n• بسته ۱۰ عددی\n• فقط با تجویز دامپزشک\n• دوز بر اساس وزن\n• جایگزین معاینه نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p304",
    slug: "cat-treats-dkp-3333058",
    title: "پودر پروبیوتیک سگ و گربه بیودپ — ۱۵ ساشه",
    titleEn: "",
    brandId: "biodop",
    categorySlug: "cat-treats",
    petTypes: ["dog", "cat"],
    priceToman: 200_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "ساشه پروبیوتیک بیودپ برای حمایت فلور روده بعد اسهال یا آنتی‌بیوتیک؛ **طبق نظر دامپزشک مصرف کن.**\n\nبا غذا مخلوط کن. اسهال خونی یا بی‌حالی اورژانس است نه فقط پروبیوتیک.\n\nبسته ۱۵ عددی. جایگزین درمان علت اصلی نیست.\n\n• پروبیوتیک ۱۵ ساشه\n• بیودپ\n• سگ و گربه\n• ترجیحاً با نظر دامپزشک\n• نه برای اسهال خونی بدون معاینه\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p305",
    slug: "cat-toys-dkp-17977789",
    title: "توپ هوشمند گربه LP20",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 1_222_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "توپ خودکار مدل LP20 برای دنبال‌کردن بدون میله دستی. روی سرامیک بهتر از فرش پرزبلند می‌چرخد.\n\nشارژ/باتری طبق بسته. اگر گربه ترسید فاصله را بیشتر کن.\n\nخاموش بین جلسات.\n\n• توپ هوشمند LP20\n• حرکت خودکار\n• سطح صاف ترجیح\n• عادت تدریجی\n• خاموشی بین بازی\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p306",
    slug: "cat-toys-dkp-17292457",
    title: "توپ حرکتی نورانی پاس‌لاو با حسگر",
    titleEn: "",
    brandId: "passlove",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 590_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "توپ هوشمند نورانی با حسگر حرکت؛ وقتی گربه نزدیک می‌شود مسیر عوض می‌کند. برای آپارتمان بدون میله‌دار.\n\nباتری را چک کن و شب خاموش بگذار. اولین جلسه زیر نظر باش تا نترسد.\n\nسطح صاف بهتر کار می‌کند.\n\n• توپ حسگر + نور\n• پاس لاو\n• تخلیه انرژی خودکار\n• خاموشی شب\n• سطح صاف\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p307",
    slug: "cat-toys-dkp-17411871",
    title: "پر متحرک با پایه ثابت",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 489_450,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "میله پر روی پایه ثابت؛ دستت آزاد است و گربه دور پایه می‌چرخد. جایگزین میله دستی برای خانه‌های شلوغ.\n\nپایه را سنگین/ثابت کن تا نیفتد. پر را عوض کن وقتی ریخت.\n\nکابل برق نزدیک نباشد.\n\n• پر روی پایه ثابت\n• بازی چرخشی\n• ثبات پایه\n• تعویض پر فرسوده\n• دور از سیم برق\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p308",
    slug: "cat-toys-dkp-5570618",
    title: "اسباب‌بازی زنگوله‌دار مدل Bell",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 390_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "اسباب‌بازی با زنگوله برای جلب توجه شنوایی گربه و سگ بازی‌گوش. صدای زنگ را بعضی حیوانات دوست ندارند — کوتاه تست کن.\n\nبند و حلقه را از نظر ایمنی چک کن. شب اگر اذیت می‌کند جمع کن.\n\nسبک و ساده برای شروع بازی.\n\n• مدل Bell / زنگوله\n• جلب توجه صوتی\n• تست تحمل صدا\n• ایمنی بند\n• جمع هنگام استراحت\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p309",
    slug: "cat-toys-dkp-17412089",
    title: "اسباب‌بازی کرم تعاملی Worm — ۴۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-toys",
    petTypes: ["cat"],
    priceToman: 380_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "کرم متحرک تعاملی ۴۰ گرمی برای شکار روی زمین؛ غریزه گربه و سگ کنجکاو را درگیر می‌کند.\n\nقطعه‌های جداشونده را قورت ندهد. باتری اگر دارد را ایمن بگذار.\n\nزیر نظر توله.\n\n• مدل Worm تعاملی\n• ۴۰ گرم\n• شکار زمینی\n• ایمنی قطعه\n• نظارت توله\n\n— پت دیت شاپ.",
  }),
];
