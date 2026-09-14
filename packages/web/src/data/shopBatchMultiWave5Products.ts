import type { ShopProduct } from './shopCatalog';

const P = '/pepito/uploads';
const V = "batch-multi-w5-v1";

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

export const SHOP_BATCH_MULTI_WAVE5_PRODUCTS: ShopProduct[] = [
  product({
    id: "p290",
    slug: "grooming-bonnest-calming-shampoo-for-pet-200-l",
    title: "شامپو آرامش‌بخش بونست",
    titleEn: "",
    brandId: "bonnest",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 680_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "شامپو آرامش‌بخش بونست برای حمام روزمره سگ و گربه وقتی پوست حساس است یا حیوان از شست‌وشو می‌ترسد.\n\nشامپو غذا نیست و جای درمان دامپزشکی را نمی‌گیرد. وارد چشم نکن. بعد شست‌وشو خوب آبکشی کن.\n\nاگر زخم باز یا عفونت پوست دارد اول کلینیک.\n\n• شامپو آرامش‌بخش بونست\n• مناسب سگ و گربه\n• برای حمام خانگی\n• دور از چشم\n• جایگزین درمان پوست نیست\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p291",
    slug: "grooming-spray-massage-brush-for-pet",
    title: "برس هوشمند اسپری دار طرح انبه",
    titleEn: "",
    brandId: "generic",
    categorySlug: "grooming",
    petTypes: ["dog", "cat"],
    priceToman: 520_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "برس اسپری‌دار طرح انبه برای شانه و ماساژ هم‌زمان. مخزن را با آب یا اسپری مجاز پر می‌کنی تا مو کمتر گره بخورد.\n\nهوشمند به معنی ربات نیست — اسپری و دندانه کار را راحت‌تر می‌کند. روی پوست زخمی نکش.\n\nبعد استفاده مخزن را خالی و خشک کن.\n\n• برس اسپری‌دار طرح انبه\n• مناسب سگ و گربه\n• ماساژ + شانه\n• نه روی پوست ملتهب\n• مخزن را خشک نگه دار\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p292",
    slug: "dog-carriers-fiber-space-pet-carrier-backpack",
    title: "کوله فضایی سگ و گربه مدل فایبر",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 6_160_000,
    params: {
      مدل: "فایبر",
      مناسب_برای: "سگ و گربه",
    },
    description:
      "کوله فضایی مدل فایبر برای بردن سگ یا گربه کوچک در مسیرهای شهری. پنجره‌ها دید می‌دهند و هوا بهتر رد می‌شود.\n\nقبل خرید وزن و جثه را با کوله بسنج؛ حیوان باید بتواند بچرخد نه اینکه فشرده شود. بندها را روی هر دو شانه تنظیم کن.\n\nجایگزین باکس سفر هوایی تأییدشده نیست مگر مشخصات پرواز را جدا چک کنی.\n\n• کوله فضایی فایبر\n• مناسب سگ و گربه کوچک\n• تهویه و دید\n• اندازه با جثه\n• نه لزوماً تأیید ایرلاین\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p293",
    slug: "dog-carriers-luxury-leather-space-pet-carier-backpack",
    title: "کوله فضایی لاکچری چرم",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_795_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "کوله فضایی با روکش چرم برای مسیر کوتاه شهری. ظاهر مرتب‌تر از کوله پارچه‌ای ساده.\n\nچرم را خیس نگذار. حیوان را مدت طولانی در گرما داخل کوله نگذار — تهویه را باز نگه دار.\n\nبند و زیپ را قبل هر خروج چک کن.\n\n• کوله فضایی چرم لاکچری\n• مناسب مسیر شهری\n• مراقبت چرم\n• تهویه باز\n• چک زیپ و بند\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p294",
    slug: "dog-carriers-leather-pet-carier-backpack",
    title: "کوله فضایی چرمی پارک دار",
    titleEn: "",
    brandId: "generic",
    categorySlug: "dog-carriers",
    petTypes: ["dog"],
    priceToman: 2_650_000,
    params: {
      مناسب_برای: "سگ",
    },
    description:
      "کوله فضایی چرمی با فضای پارک‌مانند داخل؛ حیوان جای پا دارد و کمتر روی هم جمع می‌شود.\n\nچرم را خشک نگه دار. برای حیوان سنگین یا خیلی بی‌قرار مدل سفت‌تر/باکس سخت بهتر است.\n\nروی زمین داغ نگذار.\n\n• کوله چرمی پارک‌دار\n• فضای داخلی بازتر\n• مراقبت چرم\n• مناسب جثه متناسب\n• نه روی سطح داغ\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p295",
    slug: "cat-carriers-zarix-zeus-for-cat",
    title: "کوله فضایی مدل زئوس",
    titleEn: "",
    brandId: "zarix",
    categorySlug: "cat-carriers",
    petTypes: ["cat"],
    priceToman: 4_274_000,
    params: {
      مدل: "زئوس",
      مناسب_برای: "گربه",
    },
    description:
      "کوله فضایی مدل زئوس برای گربه؛ دید اطراف و حمل روی شانه یا پشت.\n\nگربه‌ای که تا حالا کوله ندیده اول در خانه عادت بده — در را باز بگذار و تشویقی بده. زیپ را کامل ببند.\n\nجایگزین باکس دامپزشکی سفت نیست اگر گربه خیلی مضطرب است.\n\n• کوله فضایی زئوس\n• برند زریکس\n• مناسب گربه\n• عادت تدریجی در خانه\n• زیپ کامل\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p296",
    slug: "cat-carriers-raha-pet-hard-box-3",
    title: "باکس حمل سگ و گربه رها",
    titleEn: "",
    brandId: "raha",
    categorySlug: "cat-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 3_960_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "باکس سخت رها برای تاکسی، کلینیک و جابه‌جایی کوتاه. دیواره سفت یعنی محافظت بیشتر از کوله نرم.\n\nقفل در را قبل حرکت چک کن. برای پرواز قوانین ایرلاین را جدا بخوان.\n\nتهویه را نبند.\n\n• باکس سخت رها\n• مناسب سگ و گربه\n• قفل در\n• تهویه باز\n• کلینیک و مسیر شهری\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p297",
    slug: "cat-carriers-jupiter-cat-hard-box",
    title: "باکس حمل سگ و گربه ژوپیتر",
    titleEn: "",
    brandId: "jupiter",
    categorySlug: "cat-carriers",
    petTypes: ["dog", "cat"],
    priceToman: 2_970_000,
    params: {
      مناسب_برای: "سگ و گربه",
    },
    description:
      "باکس حمل سخت ژوپیتر؛ انتخاب وسط بین کوله نرم و باکس خیلی بزرگ.\n\nکف را با حوله نازک بپوشان. اگر حیوان پنجه می‌زند قفل را دوباره چک کن.\n\nجای بازی خانگی نیست.\n\n• باکس سخت ژوپیتر\n• مناسب سگ و گربه\n• کف ضدلغزش/حوله\n• قفل دوباره چک شود\n• برای جابه‌جایی نه خواب دائم\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p298",
    slug: "bird-food-oshkaia-mixed-nut-cockatiel-food-kg",
    title: "خوراک آجیلی مخلوط عروس هلندی اوشکایا",
    titleEn: "",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 525_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "خوراک آجیلی مخلوط اوشکایا برای عروس هلندی؛ تنوع مغز و دانه به‌جای دان ساده تکراری.\n\nآجیل چرب است — سهم را کنترل کن تا وزن نپرد. آب تازه همیشه باشد. جایگزین بررسی بال و مدفوع نیست.\n\nدور از رطوبت نگه دار.\n\n• مخلوط آجیلی عروس هلندی\n• برند اوشکایا\n• تنوع دانه\n• سهم را کنترل کن\n• جای خشک\n\n— پت دیت شاپ.",
  }),
  product({
    id: "p299",
    slug: "bird-food-oshkaia-mynah-bird-food-kg",
    title: "خوراک مرغ مینا و پرندگان حشره‌خوار اوشکایا",
    titleEn: "",
    brandId: "oshkaia",
    categorySlug: "bird-food",
    petTypes: ["bird"],
    priceToman: 495_000,
    params: {
      مناسب_برای: "پرنده",
    },
    description:
      "خوراک اوشکایا برای مرغ مینا و پرندگان حشره‌خوار؛ پروتئین بیشتر از دان طوطی معمولی.\n\nحشره‌خوارها به تنوع نیاز دارند — این بسته کمک روزانه است نه تمام رژیم. اگر اسهال یا بی‌اشتهایی دیدی قطع کن و با دامپزشک پرندگان حرف بزن.\n\nخشک و دربسته نگه دار.\n\n• خوراک مینا / حشره‌خوار\n• برند اوشکایا\n• پروتئین بالاتر از دان ساده\n• تنوع رژیم را فراموش نکن\n• نگهداری خشک\n\n— پت دیت شاپ.",
  }),
];
