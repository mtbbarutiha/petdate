/**
 * Server-side shop price index — mirrors web shopCatalog for coin checkout pricing.
 * Prefer live shop_products rows when present; fall back to this index.
 */
import priceIndexJson from '../data/shop-price-index.json';

export type ShopPriceEntry = {
  id: string;
  slug: string;
  title: string;
  brandId: string;
  categorySlug: string;
  priceToman: number;
};

/** Keep in sync with shop-pilot-products + shop-batch2-products + shop-batch3-products + shop-batch-multi-products + shop-batch-multi-wave2-products + shop-batch-multi-wave3-products + shop-batch-multi-wave4-products + shop-batch-multi-wave5-products + shop-digikala-batch1-part1-products */
const PILOT_PRICE_INDEX: ShopPriceEntry[] = [
  {
    id: 'p221',
    slug: 'dog-food-royal-canin-mini-adult-2kg',
    title: 'رویال کنین مینی ادالت ۲ کیلو — سگ بالغ نژاد کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_881_000,
  },
  {
    id: 'p222',
    slug: 'dog-food-royal-canin-xsmall-puppy-1-5kg',
    title: 'رویال کنین ایکس‌اسمال پاپی ۱٫۵ کیلو — توله نژاد خیلی کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_294_000,
  },
  {
    id: 'p223',
    slug: 'cat-food-royal-canin-persian-adult-400g',
    title: 'رویال کنین پرشین ادالت ۴۰۰ گرم — گربه پرشین بالغ',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 2_742_000,
  },
  {
    id: 'p224',
    slug: 'dog-food-royal-canin-mini-indoor-puppy-1-5kg',
    title: 'رویال کنین مینی ایندور پاپی ۱٫۵ کیلو — توله نژاد کوچک آپارتمانی',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_294_000,
  },
  {
    id: 'p225',
    slug: 'dog-food-royal-canin-xsmall-adult-1-5kg',
    title: 'رویال کنین ایکس‌اسمال ادالت ۱٫۵ کیلو — سگ بالغ نژاد خیلی کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 7_841_000,
  },
  {
    id: 'p226',
    slug: 'dog-food-royal-canin-mini-puppy-2kg',
    title: 'رویال کنین مینی پاپی ۲ کیلو — توله نژاد کوچک',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 8_881_000,
  },
  {
    id: 'p227',
    slug: 'dog-food-royal-canin-pomeranian-adult-1-5kg',
    title: 'رویال کنین پامرانین ادالت ۱٫۵ کیلو — مخصوص پامرانین بالغ',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 7_826_000,
  },
  {
    id: 'p228',
    slug: 'dog-food-royal-canin-shih-tzu-adult-1-5kg',
    title: 'رویال کنین شیتزو ادالت ۱٫۵ کیلو — مخصوص شیتزو بالغ',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 7_841_000,
  },
  {
    id: 'p229',
    slug: 'cat-food-josera-culinesse-2kg',
    title: 'جوسرا کولینس ۲ کیلو — گربه بالغ با گوارش حساس‌تر',
    brandId: 'josera',
    categorySlug: 'cat-food',
    priceToman: 4_004_000,
  },
  {
    id: 'p230',
    slug: 'cat-food-josera-dailycat-2kg',
    title: 'جوسرا دیلی‌کت ۲ کیلو — غذای روزانه گربه بالغ',
    brandId: 'josera',
    categorySlug: 'cat-food',
    priceToman: 3_900_000,
  },
  {
    id: 'p231',
    slug: 'cat-food-royal-canin-indoor-adult-400g',
    title: 'رویال کنین ایندور ادالت ۴۰۰ گرم — گربه بالغ خانگی',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 2_742_000,
  },
  {
    id: 'p232',
    slug: 'cat-food-royal-canin-british-shorthair-adult-400g',
    title: 'رویال کنین بریتیش شورت‌هیر ادالت ۴۰۰ گرم — مخصوص بریتیش بالغ',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 2_742_000,
  },
  {
    id: 'p233',
    slug: 'cat-food-royal-canin-fit-2kg',
    title: 'رویال کنین فیت ۲ کیلو — گربه بالغ فعال و سالم',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 10_217_000,
  },
  {
    id: 'p234',
    slug: 'cat-food-royal-canin-sterilised-adult-400g',
    title: 'رویال کنین استرلایزد ادالت ۴۰۰ گرم — گربه بالغ عقیم‌شده',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 2_742_000,
  },
  {
    id: 'p235',
    slug: 'cat-food-josera-kitten-2kg',
    title: 'جوسرا کیتن ۲ کیلو — بچه گربه در حال رشد',
    brandId: 'josera',
    categorySlug: 'cat-food',
    priceToman: 4_004_000,
  },
  {
    id: 'p236',
    slug: 'cat-food-royal-canin-sensible-2kg',
    title: 'رویال کنین سنسیبل ۲ کیلو — گربه بالغ با گوارش حساس‌تر',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 10_217_000,
  },
  {
    id: 'p237',
    slug: 'cat-food-josera-marinesse-2kg',
    title: 'جوسرا مارینس ۲ کیلو — گربه بالغ با طعم ماهی',
    brandId: 'josera',
    categorySlug: 'cat-food',
    priceToman: 4_004_000,
  },
  {
    id: 'p238',
    slug: 'cat-food-josera-sensicat-2kg',
    title: 'جوسرا سنسی‌کت ۲ کیلو — گربه بالغ با معده حساس',
    brandId: 'josera',
    categorySlug: 'cat-food',
    priceToman: 4_004_000,
  },
  {
    id: 'p239',
    slug: 'cat-food-royal-canin-mother-babycat-2kg',
    title: 'رویال کنین مادر اند بیبی ۲ کیلو — مادر باردار/شیرده و بچه گربه',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 10_395_000,
  },
  {
    id: 'p240',
    slug: 'cat-food-royal-canin-dental-1-5kg',
    title: 'رویال کنین دنتال ۱٫۵ کیلو — گربه بالغ مراقبت دهان و دندان',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 9_450_000,
  },
  {
    id: 'p241',
    slug: 'cat-food-royal-canin-light-weight-1-5kg',
    title: 'رویال کنین لایت ویت ۱٫۵ کیلو — گربه بالغ کنترل وزن',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 9_415_000,
  },
  {
    id: 'p242',
    slug: 'cat-food-royal-canin-hairball-2kg',
    title: 'رویال کنین هیربال ۲ کیلو — گربه بالغ مدیریت گلوله مو',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 12_100_000,
  },
  {
    id: 'p243',
    slug: 'cat-food-royal-canin-hair-skin-2kg',
    title: 'رویال کنین هیر اند اسکین ۲ کیلو — گربه بالغ پوست و مو',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 12_100_000,
  },
  {
    id: 'p244',
    slug: 'cat-food-royal-canin-urinary-so-1-5kg',
    title: 'رویال کنین یورینری اس‌او ۱٫۵ کیلو — خط دامپزشکی ادراری گربه',
    brandId: 'royal-canin',
    categorySlug: 'cat-food',
    priceToman: 9_623_000,
  },
  {
    id: 'p245',
    slug: 'dog-food-royal-canin-mini-sterilised-3kg',
    title: 'رویال کنین مینی استرالایز ۳ کیلو — سگ بالغ نژاد کوچک عقیم‌شده',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 14_821_000,
  },
  {
    id: 'p246',
    slug: 'dog-food-royal-canin-mini-light-weight-3kg',
    title: 'رویال کنین مینی لایت ویت ۳ کیلو — سگ بالغ نژاد کوچک کنترل وزن',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 14_821_000,
  },
  {
    id: 'p247',
    slug: 'dog-food-royal-canin-poodle-adult-3kg',
    title: 'رویال کنین پودل ادالت ۳ کیلو — مخصوص پودل بالغ',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 14_820_000,
  },
  {
    id: 'p248',
    slug: 'dog-food-royal-canin-poodle-puppy-3kg',
    title: 'رویال کنین پودل پاپی ۳ کیلو — توله پودل در حال رشد',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 14_820_000,
  },
  {
    id: 'p249',
    slug: 'dog-food-royal-canin-hypoallergenic-2kg',
    title: 'رویال کنین هایپوآلرژنیک ۲ کیلو — خط دامپزشکی حساسیت غذایی سگ',
    brandId: 'royal-canin',
    categorySlug: 'dog-food',
    priceToman: 11_702_000,
  },
];

const entries = [...(priceIndexJson as ShopPriceEntry[])];
const seen = new Set(entries.flatMap((e) => [e.id, e.slug]));
for (const extra of PILOT_PRICE_INDEX) {
  if (seen.has(extra.id) || seen.has(extra.slug)) continue;
  entries.push(extra);
  seen.add(extra.id);
  seen.add(extra.slug);
}

const byId = new Map<string, ShopPriceEntry>();
const bySlug = new Map<string, ShopPriceEntry>();
for (const e of entries) {
  byId.set(e.id, e);
  bySlug.set(e.slug, e);
}

export function lookupShopPrice(idOrSlug: string): ShopPriceEntry | null {
  return byId.get(idOrSlug) ?? bySlug.get(idOrSlug) ?? null;
}

export function shopPriceIndexSize(): number {
  return entries.length;
}
