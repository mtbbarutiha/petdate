import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "digikala-b1-p3-v1";

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

export const SHOP_DIGIKALA_BATCH1_PART3_PRODUCTS: ShopProduct[] = [
  product({
    id: "p320",
    slug: "cat-food-dkp-21258454",
    title: "پوچ بچه‌گربه یامیکس مرغ و جگر — بسته ۶ عددی",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 828_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "پک ۶ عددی پوچ پته مرغ و جگر مخصوص بچه‌گربه؛ بافت نرم برای دندان شیری و دوره رشد.\n\nجای شیر خشک اضطراری نیست. تدریجی با غذای قبلی قاطی کن. اسهال طولانی = دامپزشک.\n\nهر ساشه را جدا باز کن.\n\n• بچه گربه / مرغ و جگر\n• بسته ۶ عددی\n• برند یامیکس\n• بافت پته نرم\n• تعویض تدریجی\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p321",
    slug: "cat-food-dkp-20696007",
    title: "کنسرو گربه پابلو پته گوشت گاو ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 275_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "پته گوشت گاو پابلو در قوطی بزرگ ۸۰۰ گرمی؛ برای گربه‌هایی که بافت نرم را به تکه‌های سفت ترجیح می‌دهند.\n\nبعد باز شدن در یخچال بگذار و زود مصرف کن. از سهم خشک روزانه کم کن تا وزن نپرد. اگر اسهال شد بافت/برند را عوض کن و در صورت ادامه دامپزشک.\n\nجایگزین رژیم درمانی نیست.\n\n• پته طعم گوشت گاو\n• ۸۰۰ گرم\n• برند پابلو\n• بعد باز شدن یخچال\n• وعده کامل تر / مکمل خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p322",
    slug: "cat-food-dkp-20696405",
    title: "کنسرو گربه پابلو پته گوشت و مرغ ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 275_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "پته ترکیبی گوشت و مرغ پابلو، قوطی ۸۰۰ گرمی؛ برای گربه‌هایی که یک طعم خالص را زود پس می‌زنند.\n\nقاشق را بین گوشت خام خانه و کنسرو یکی نکن. پیمانه را با وزن تنظیم کن.\n\nجایگزین رژیم بیمارستانی نیست.\n\n• پته گوشت و مرغ\n• ۸۰۰ گرم\n• پابلو\n• تنوع طعم\n• بهداشت سرو\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p323",
    slug: "cat-food-dkp-19887269",
    title: "کنسرو گربه پابلو تن، مرغ و گوساله ۴۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 175_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "کنسرو ۴۰۰ گرمی پابلو با ترکیب تن ماهی، مرغ و گوساله؛ انتخاب متنوع برای بدغذاهای سخت‌گیر.\n\nماهی را هر روز تنها نده؛ تعادل با خط‌های دیگر بهتر است. استخوان نداشته باشد ولی تکه را چک کن.\n\nآب جدا فراموش نشود.\n\n• تن + مرغ + گوساله\n• ۴۰۰ گرم\n• پابلو\n• تنوع پروتئین\n• آب تازه جدا\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p324",
    slug: "cat-food-dkp-20695998",
    title: "کنسرو گربه پابلو پته گوشت گاو ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 175_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "همان خط پته گوشت گاو پابلو در قوطی ۴۳۰ گرمی؛ برای یک‌دو وعده یا تست طعم قبل از قوطی بزرگ.\n\nبافت نرم برای بدغذاها. قاشق تمیز بزن و باقی را بپوشان.\n\nاگر گاو را پس زد طعم مرغ همان برند را امتحان کن.\n\n• پته گوشت گاو\n• ۴۳۰ گرم\n• پابلو\n• مناسب تست طعم\n• بهداشت قاشق و درب\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p325",
    slug: "cat-food-dkp-21930259",
    title: "کنسرو گربه بالغ پولر مرغ و پرندگان ۴۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "cat-food",
    petTypes: ["cat"],
    priceToman: 158_000,
    params: {
      مناسب_برای: "گربه",
    },
    description:
      "کنسرو پریمیوم پولر با طعم مرغ و گوشت پرندگان، ۴۰۰ گرم؛ گزینه تر برای گربه بالغ کنار خشک.\n\nمرغ حساسیت شایع است — با تکه کوچک شروع کن. آب جدا بگذار حتی با کنسرو.\n\nجایگزین تجویز دامپزشک نیست.\n\n• طعم مرغ و پرندگان\n• ۴۰۰ گرم\n• برند پولر\n• گربه بالغ\n• شروع با مقدار کم\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p326",
    slug: "dog-food-dkp-6236417",
    title: "کنسرو سگ شایر سیرابی ۸۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 366_700,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "قوطی بزرگ ۸۰۰ گرمی شایر با طعم سیرابی؛ برای سگ‌های متوسط که کنسرو را به‌عنوان بخش تر رژیم می‌گیرند.\n\nبعد باز شدن یخچال و مصرف در دو سه روز. بوی سیرابی تند است.\n\nتعادل با خشک کامل.\n\n• سیرابی ۸۰۰ گرم\n• شایر\n• قوطی بزرگ\n• یخچال بعد باز شدن\n• ترکیب با خشک\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p327",
    slug: "dog-food-dkp-20620037",
    title: "کنسرو سگ دکتر کلادرز پته بوقلمون ۱۰۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 270_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "کاپ ۱۰۰ گرمی پته بوقلمون دکتر کلادرز؛ جایزه وعده‌ای یا اشتها‌آور کنار خشک.\n\nاندازه کوچک یعنی کنترل راحت‌تر وزن. تمام را یک‌جا نده به سگ حریص.\n\nجایگزین وعده اصلی بزرگ نیست.\n\n• پته بوقلمون ۱۰۰ گرم\n• دکتر کلادرز\n• کاپ کوچک\n• کنترل سهم\n• اشتها‌آور / تشویقی وعده\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p328",
    slug: "dog-food-dkp-20949467",
    title: "کنسرو سگ یو‌اس‌پت بره و سیرابی ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "کنسرو بره و سیرابی یو‌اس‌پت ۴۳۰ گرم؛ طعم قوی برای سگ‌های بدغذا.\n\nسیرابی برای بعضی معده‌ها سنگین است — نصف کن و ببین. بوی قوی دارد؛ در ظرف دربسته سرو کن.\n\nحساسیت پروتئین را جدی بگیر.\n\n• بره و سیرابی\n• ۴۳۰ گرم\n• یو اس پت\n• طعم قوی\n• شروع با نصف وعده\n\n— پت دیت شاپ.\n\n---",
  }),
  product({
    id: "p329",
    slug: "dog-food-dkp-20949492",
    title: "کنسرو سگ یو‌اس‌پت شترمرغ و بلوبری ۴۳۰ گرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-food",
    petTypes: ["dog"],
    priceToman: 195_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "کنسرو های‌پریمیوم یو‌اس‌پت با طعم شترمرغ و بلوبری، ۴۳۰ گرم؛ پروتئین متفاوت برای تنوع کنار خشک.\n\nشترمرغ برای بعضی سگ‌های حساس گزینه‌ای غیرمرغ است — باز هم با دامپزشک اگر آلرژی ثابت شده. از کالری روزانه کم کن.\n\nجایگزین غذای کامل خشک در بلندمدت بدون برنامه نیست مگر برچسب بگوید کامل.\n\n• شترمرغ و بلوبری\n• ۴۳۰ گرم\n• یو اس پت\n• تنوع پروتئین\n• سهم کالری را کم کن\n\n— پت دیت شاپ.\n\n---",
  }),
];
