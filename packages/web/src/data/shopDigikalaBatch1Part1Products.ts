import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = 'digikala-b1-p1-v1';

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
    id: 'p300',
    slug: 'cat-food-dkp-21263751',
    title: 'کنسرو گربه بالغ گورمت طعم مرغ — بسته ۶ عددی',
    titleEn: '',
    brandId: 'gourmet',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 1_549_000,
    params: {
      مناسب_برای: 'گربه',
    },
    description:
      'بسته ۶ عددی کنسرو گورمت با طعم مرغ برای گربه بالغ؛ تنوع تر کنار کیسه خشک.\n\nبرچسب هر قوطی را برای بافت بخوان. باقیمانده را یخچال کن.\n\nحساسیت مرغ را جدی بگیر.\n\n• طعم مرغ\n• بسته ۶ عددی\n• گورمت\n• گربه بالغ\n• یخچال بعد باز شدن\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p301',
    slug: 'cat-food-dkp-10928475',
    title: 'گورمت گلد پته بوقلمون ۸۵ گرم',
    titleEn: '',
    brandId: 'gourmet',
    categorySlug: 'cat-food',
    petTypes: ['cat'],
    priceToman: 249_000,
    params: {
      وزن: '۸۵ گرم',
      مناسب_برای: 'گربه',
    },
    description:
      'کاپ ۸۵ گرمی گورمت گلد بافت پته بوقلمون؛ تشویقی وعده‌ای یا تکمیل خشک برای بدغذاها.\n\nبسته کوچک یعنی کمتر دورریز. تمام‌شده را دور نریز در گرما.\n\n• پته بوقلمون\n• ۸۵ گرم\n• گورمت گلد\n• گربه\n• یخچال بعد باز شدن\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p302',
    slug: 'dog-food-dkp-15589693',
    title: 'پودینگ سگ ونپی اردک، هویج و نخود ۹۰ گرم',
    titleEn: '',
    brandId: 'wanpy',
    categorySlug: 'dog-food',
    petTypes: ['dog'],
    priceToman: 186_000,
    params: {
      وزن: '۹۰ گرم',
      مناسب_برای: 'سگ',
    },
    description:
      'پودینگ نرم ۹۰ گرمی ونپی با اردک و سبزی؛ بافت متفاوت از کنسرو تکه‌ای برای سگ‌های مسن یا بدغذا.\n\nقاشق بزن روی خشک یا جدا. از کالری روزانه کم کن.\n\n• پودینگ اردک/سبزی\n• ۹۰ گرم\n• ونپی\n• سگ\n• تشویقی/مکمل وعده\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p303',
    slug: 'cat-treats-dkp-9520987',
    title: 'قرص ضد انگل ورمکس — فقط با نظر دامپزشک',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-treats',
    petTypes: ['dog'],
    priceToman: 480_000,
    params: {
      مناسب_برای: 'سگ',
    },
    description:
      'قرص ضد انگل مدل استخوانی‌خوش‌طعم، بسته ۱۰ عددی. **انگل‌کشی خودسرانه نکن؛ وزن، گونه و نوع انگل را دامپزشک تعیین می‌کند.**\n\nجایگزین معاینه و نسخه نیست.\n\n• ضد انگل — فقط با نظر دامپزشک\n• ۱۰ عدد\n• خوش‌طعم\n• دوز فقط با کلینیک\n• جایگزین تشخیص نیست\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p304',
    slug: 'cat-treats-dkp-3333058',
    title: 'پودر پروبیوتیک سگ و گربه بیودپ — ۱۵ ساشه',
    titleEn: '',
    brandId: 'biodop',
    categorySlug: 'cat-treats',
    petTypes: ['dog', 'cat'],
    priceToman: 200_000,
    params: {
      مناسب_برای: 'سگ و گربه',
    },
    description:
      'ساشه پروبیوتیک بیودپ برای حمایت فلور روده بعد اسهال یا آنتی‌بیوتیک؛ **طبق نظر دامپزشک مصرف کن.**\n\nبا غذا مخلوط کن. اسهال طولانی = کلینیک.\n\n• پروبیوتیک بیودپ\n• ۱۵ ساشه\n• سگ و گربه\n• طبق دامپزشک\n• جایگزین درمان نیست\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p305',
    slug: 'cat-toys-dkp-17977789',
    title: 'توپ هوشمند گربه LP20',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 1_222_000,
    params: {
      مدل: 'LP20',
      مناسب_برای: 'گربه',
    },
    description:
      'توپ خودکار مدل LP20 برای دنبال‌کردن بدون میله دستی. روی سرامیک بهتر از فرش پرزبلند می‌چرخد.\n\nشارژ/باتری طبق بسته. اگر گرم شد خاموش کن.\n\n• توپ LP20\n• بازی خودکار\n• گربه\n• سطح صاف\n• نظارت اولیه\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p306',
    slug: 'cat-toys-dkp-17292457',
    title: 'توپ حرکتی نورانی پاس‌لاو با حسگر',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 590_000,
    params: {
      مناسب_برای: 'گربه',
    },
    description:
      'توپ هوشمند نورانی با حسگر حرکت؛ وقتی گربه نزدیک می‌شود مسیر عوض می‌کند. برای آپارتمان بدون میله‌دار.\n\nباتری را چک کن و شب خاموش بگذار.\n\n• توپ نورانی حسگر\n• پاس‌لاو\n• گربه\n• خاموش بین بازی\n• نظارت اولیه\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p307',
    slug: 'cat-toys-dkp-17411871',
    title: 'پر متحرک با پایه ثابت',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 489_450,
    params: {
      مناسب_برای: 'گربه',
    },
    description:
      'میله پر روی پایه ثابت؛ دستت آزاد است و گربه دور پایه می‌چرخد. جایگزین میله دستی برای خانه‌های شلوغ.\n\nپایه را سنگین/ثابت کن تا نیفتد.\n\n• پر متحرک پایه ثابت\n• گربه\n• بازی شکار\n• پایه پایدار\n• نظارت اگر پاره شد\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p308',
    slug: 'cat-toys-dkp-5570618',
    title: 'اسباب‌بازی زنگوله‌دار مدل Bell',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 390_000,
    params: {
      مدل: 'Bell',
      مناسب_برای: 'گربه',
    },
    description:
      'اسباب‌بازی با زنگوله برای جلب توجه شنوایی گربه و سگ بازی‌گوش. صدای زنگ را بعضی حیوانات دوست ندارند — کوتاه تست کن.\n\nبند و قطعات کوچک را چک کن.\n\n• زنگوله‌دار Bell\n• گربه (و سگ کنجکاو)\n• صدای ملایم تست شود\n• ایمنی بند\n• بازی نظارت‌شده\n\n— پت دیت شاپ.',
  }),
  product({
    id: 'p309',
    slug: 'cat-toys-dkp-17412089',
    title: 'اسباب‌بازی کرم تعاملی Worm — ۴۰ گرم',
    titleEn: '',
    brandId: 'generic',
    categorySlug: 'cat-toys',
    petTypes: ['cat'],
    priceToman: 380_000,
    params: {
      وزن: '۴۰ گرم',
      مدل: 'Worm',
      مناسب_برای: 'گربه',
    },
    description:
      'کرم متحرک تعاملی ۴۰ گرمی برای شکار روی زمین؛ غریزه گربه و سگ کنجکاو را درگیر می‌کند.\n\nقطعه‌های جداشونده را قورت ندهد — زیر نظر.\n\n• کرم تعاملی Worm\n• حدود ۴۰ گرم\n• شکار خانگی\n• نظارت روی بلع\n• باتری طبق بسته\n\n— پت دیت شاپ.',
  }),
];
