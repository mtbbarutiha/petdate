/**
 * Route SEO helpers — used by RouteSeo (SPA), prerender (initial HTML), and sitemap.
 * Browser-safe: no fs. FA is the crawlable language (no separate EN URLs).
 */
import { SEO, SITE, siteFaqItems } from '@petdate/shared';
import { ADOPTION_PETS, getAdoptionPet } from '../data/adoptionPets';
import {
  SHOP_CATEGORIES,
  SHOP_PRODUCTS,
  getBrand,
  getCategory,
  getProduct,
  type ShopProduct,
} from '../data/shopCatalog';

export const INDEX_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
export const NOINDEX_FOLLOW = 'noindex,follow';
export const NOINDEX_NOFOLLOW = 'noindex,nofollow';

export type SeoLang = 'fa' | 'en';

export type BreadcrumbItem = { name: string; path: string };

export type PageSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  ogType: 'website' | 'article' | 'product';
  breadcrumbs: BreadcrumbItem[];
  jsonLd: Record<string, unknown>;
  noscriptHtml: string;
};

export type PageSeoOpts = {
  lang?: SeoLang;
  role?: string;
  article?: { title: string; description: string; slug: string };
};

export function normalizePath(pathname: string): string {
  const raw = String(pathname || '/').split('?')[0].split('#')[0];
  const p = raw.replace(/\/+$/, '') || '/';
  return p.startsWith('/') ? p : `/${p}`;
}

export function canonicalUrl(canonicalPath: string): string {
  const p = normalizePath(canonicalPath);
  return p === '/' ? `${SITE.origin}/` : `${SITE.origin}${p}`;
}

export function productCanonicalPath(product: ShopProduct): string {
  return `/shop/product/${product.slug || product.id}`;
}

export function absAsset(src: string): string {
  if (!src) return SITE.ogImage;
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE.origin}${src.startsWith('/') ? '' : '/'}${src}`;
}

function esc(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function crumb(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (!items.length || items[0].path !== '/') {
    return [{ name: SEO.siteName, path: '/' }, ...items];
  }
  return items;
}

function breadcrumbJsonLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl(items[items.length - 1]?.path || '/')}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@type': ['Organization', 'OnlineBusiness'],
    '@id': `${SITE.origin}/#organization`,
    name: SEO.siteName,
    alternateName: ['PetDate', 'petdate', 'PET DATE'],
    url: `${SITE.origin}/`,
    logo: SITE.markImage,
    image: SITE.ogImage,
    email: SITE.email,
    description: 'پلتفرم فارسی همبازی پت، پت‌شاپ آنلاین، پذیرش حیوان خانگی و مشاوره دامپزشک آنلاین.',
    areaServed: { '@type': 'Country', 'name': 'Iran' },
    knowsLanguage: ['fa', 'fa-IR'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.email,
      availableLanguage: ['Persian', 'fa'],
    },
    // Apex only — www is a redirect target, not a second official profile.
    sameAs: [SITE.telegramBot],
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${SITE.origin}/#website`,
    url: `${SITE.origin}/`,
    name: SEO.siteName,
    alternateName: 'PetDate',
    description: 'پت‌دیت (PetDate) — همبازی پت، پت‌شاپ و دامپزشک آنلاین | PLAY • MEET • FRIENDS',
    inLanguage: 'fa-IR',
    publisher: { '@id': `${SITE.origin}/#organization` },
  };
}

function graph(nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

function noscriptWrap(inner: string): string {
  return `<section lang="fa" dir="rtl">${inner}</section>`;
}

function faqNoscript(): string {
  const items = siteFaqItems('fa').slice(0, 8);
  const qs = items
    .map((item) => `<article><h2>${esc(item.q)}</h2><p>${esc(item.a)}</p></article>`)
    .join('');
  return noscriptWrap(
    `<h1>راهنما و سؤالات متداول پت‌دیت</h1><p>پاسخ پرسش‌های پرتکرار درباره همبازی پت، پت‌شاپ، پذیرش، دامپزشک آنلاین و ورود با OTP.</p>${qs}<p><a href="/shop">پت‌شاپ</a> · <a href="/vet-consult">دامپزشک</a> · <a href="/">خانه</a></p>`
  );
}

function shopNoscript(): string {
  const cats = SHOP_CATEGORIES.slice(0, 12)
    .map((c) => `<li><a href="/shop/c/${esc(c.slug)}">${esc(c.labelFa)}</a> — ${esc(c.description)}</li>`)
    .join('');
  return noscriptWrap(
    `<h1>پت‌دیت شاپ</h1><p>خرید غذای سگ و گربه، اسباب‌بازی، خاک، قلاده و لوازم پت — قیمت به تومان، ارسال در ایران.</p><ul>${cats}</ul>`
  );
}

function productNoscript(product: ShopProduct): string {
  const brand = getBrand(product.brandId)?.labelFa ?? '';
  return noscriptWrap(
    `<h1>${esc(product.title)}</h1><p>${esc(product.description)}</p><p>برند: ${esc(brand)} — قیمت: ${product.priceToman.toLocaleString('fa-IR')} تومان</p><p><a href="/shop">بازگشت به شاپ</a></p>`
  );
}

function defaultNoscript(title: string, description: string): string {
  return noscriptWrap(
    `<h1>${esc(title)}</h1><p>${esc(description)}</p><p><a href="/">پت‌دیت</a> · <a href="/faq">راهنما</a> · <a href="/shop">پت‌شاپ</a> · <a href="/vet-consult">دامپزشک</a> · <a href="/magazine">مجله</a></p>`
  );
}

function faqJsonLd(): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    '@id': `${SITE.origin}/faq#faq`,
    url: `${SITE.origin}/faq`,
    inLanguage: 'fa-IR',
    mainEntity: siteFaqItems('fa').map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

function productJsonLd(product: ShopProduct): Record<string, unknown> {
  const brand = getBrand(product.brandId);
  const url = canonicalUrl(productCanonicalPath(product));
  return {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title,
    description: product.description,
    image: absAsset(product.image),
    sku: product.sku || product.id,
    url,
    brand: brand
      ? { '@type': 'Brand', name: brand.labelFa }
      : { '@type': 'Brand', name: SEO.siteName },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'IRR',
      price: String(product.priceToman),
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@id': `${SITE.origin}/#organization` },
    },
  };
}

function articleJsonLd(opts: {
  title: string;
  description: string;
  path: string;
}): Record<string, unknown> {
  const url = canonicalUrl(opts.path);
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: opts.title,
    description: opts.description,
    url,
    inLanguage: 'fa-IR',
    author: { '@type': 'Organization', name: SEO.siteName },
    publisher: { '@id': `${SITE.origin}/#organization` },
    mainEntityOfPage: url,
    image: SITE.ogImage,
  };
}

function pack(partial: {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  ogType?: PageSeo['ogType'];
  breadcrumbs?: BreadcrumbItem[];
  extraLd?: Record<string, unknown>[];
  noscriptHtml?: string;
}): PageSeo {
  const breadcrumbs = crumb(partial.breadcrumbs ?? [{ name: partial.title, path: partial.canonicalPath }]);
  const nodes = [
    organizationJsonLd(),
    ...(partial.extraLd ?? []),
    breadcrumbJsonLd(breadcrumbs),
  ];
  return {
    title: partial.title,
    description: partial.description,
    canonicalPath: normalizePath(partial.canonicalPath),
    robots: partial.robots ?? INDEX_ROBOTS,
    ogType: partial.ogType ?? 'website',
    breadcrumbs,
    jsonLd: graph(nodes),
    noscriptHtml: partial.noscriptHtml ?? defaultNoscript(partial.title, partial.description),
  };
}

/** Public + app routes → title / description / canonical / JSON-LD / noscript. */
export function pageSeoForPath(pathname: string, opts: PageSeoOpts = {}): PageSeo {
  const lang: SeoLang = opts.lang === 'en' ? 'en' : 'fa';
  const p = normalizePath(pathname);
  const desc = SEO.description;

  if (p === '/' || p === '/welcome') {
    return pack({
      title: SEO.titleDefault,
      description: desc,
      canonicalPath: '/',
      breadcrumbs: [{ name: SEO.siteName, path: '/' }],
      extraLd: [
        websiteJsonLd(),
        {
          '@type': 'Service',
          '@id': `${SITE.origin}/#playmate`,
          name: 'همبازی پت',
          serviceType: 'Pet playmate matching',
          provider: { '@id': `${SITE.origin}/#organization` },
          areaServed: { '@type': 'Country', name: 'Iran' },
          url: `${SITE.origin}/`,
        },
        {
          '@type': 'Service',
          '@id': `${SITE.origin}/#vet-consult`,
          name: 'مشاوره دامپزشک آنلاین',
          serviceType: 'Online veterinary consultation',
          provider: { '@id': `${SITE.origin}/#organization` },
          areaServed: { '@type': 'Country', name: 'Iran' },
          url: `${SITE.origin}/vet-consult`,
        },
        {
          '@type': 'Store',
          '@id': `${SITE.origin}/#shop`,
          name: 'پت‌دیت شاپ',
          url: `${SITE.origin}/shop`,
          image: SITE.ogImage,
          parentOrganization: { '@id': `${SITE.origin}/#organization` },
          areaServed: { '@type': 'Country', name: 'Iran' },
        },
      ],
      noscriptHtml: defaultNoscript(
        'پت‌دیت — همبازی پت، پت‌شاپ و دامپزشک آنلاین',
        desc
      ),
    });
  }

  if (p === '/faq' || p === '/help') {
    return pack({
      title: SEO.titleTemplate(lang === 'en' ? 'Help & FAQ' : 'راهنما و سؤالات متداول پت‌دیت'),
      description:
        lang === 'en'
          ? 'Help for every PetDate role and section — playmates, wallet, shop, verification, diary, consults, games — plus FAQ. Same copy as the Telegram bot.'
          : 'راهنمای همه نقش‌ها و بخش‌های پت‌دیت — همبازی، کیف پول، شاپ، احراز، دفتر خاطرات، مشاوره، بازی‌ها — به‌علاوه سؤالات متداول. همان متن ربات تلگرام.',
      canonicalPath: '/faq',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'راهنما', path: '/faq' },
      ],
      extraLd: [faqJsonLd()],
      noscriptHtml: faqNoscript(),
    });
  }

  if (p === '/magazine') {
    return pack({
      title: SEO.titleTemplate('مجله و اخبار پت'),
      description: 'مقالات و اخبار مراقبت از پت، سلامت، تغذیه و نکات نگهداری — مجله پت‌دیت.',
      canonicalPath: '/magazine',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'مجله', path: '/magazine' },
      ],
    });
  }

  if (p.startsWith('/magazine/')) {
    const slug = decodeURIComponent(p.slice('/magazine/'.length));
    const title = opts.article?.title || 'مقاله مجله پت‌دیت';
    const description = opts.article?.description || 'مقاله مجله و اخبار پت‌دیت.';
    const canonicalPath = `/magazine/${opts.article?.slug || slug}`;
    return pack({
      title: SEO.titleTemplate(title),
      description,
      canonicalPath,
      ogType: 'article',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'مجله', path: '/magazine' },
        { name: title, path: canonicalPath },
      ],
      extraLd: [articleJsonLd({ title, description, path: canonicalPath })],
    });
  }

  if (p === '/shop/cart') {
    return pack({
      title: SEO.titleTemplate('سبد خرید'),
      description: 'سبد خرید پت‌دیت شاپ.',
      canonicalPath: '/shop/cart',
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p === '/shop/orders') {
    return pack({
      title: SEO.titleTemplate('سفارش‌های من'),
      description: 'لیست سفارش‌های پت‌دیت شاپ.',
      canonicalPath: '/shop/orders',
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p.startsWith('/shop/stars-pay/') || p.startsWith('/shop/card-pay/')) {
    return pack({
      title: SEO.titleTemplate('پرداخت سفارش'),
      description: 'پرداخت سفارش پت‌دیت شاپ.',
      canonicalPath: p,
      robots: NOINDEX_NOFOLLOW,
    });
  }
  if (p.startsWith('/shop/c/')) {
    const slug = p.slice('/shop/c/'.length);
    if (slug === 'all') {
      return pack({
        title: SEO.titleTemplate('همه محصولات پت‌شاپ'),
        description:
          'مشاهده همه کالاهای پت‌دیت شاپ — غذا، اسباب‌بازی، خاک، قلاده و لوازم سگ و گربه با فیلتر برند و قیمت.',
        canonicalPath: '/shop/c/all',
        breadcrumbs: [
          { name: SEO.siteName, path: '/' },
          { name: 'پت‌شاپ', path: '/shop' },
          { name: 'همه محصولات', path: '/shop/c/all' },
        ],
        extraLd: [
          {
            '@type': 'CollectionPage',
            name: 'همه محصولات پت‌دیت شاپ',
            url: `${SITE.origin}/shop/c/all`,
          },
        ],
        noscriptHtml: shopNoscript(),
      });
    }
    const cat = getCategory(slug);
    if (cat) {
      return pack({
        title: SEO.titleTemplate(`${cat.labelFa} | خرید آنلاین`),
        description: cat.description || `خرید ${cat.labelFa} از پت‌دیت شاپ — ارسال در ایران، قیمت به تومان.`,
        canonicalPath: `/shop/c/${cat.slug}`,
        breadcrumbs: [
          { name: SEO.siteName, path: '/' },
          { name: 'پت‌شاپ', path: '/shop' },
          { name: cat.labelFa, path: `/shop/c/${cat.slug}` },
        ],
        noscriptHtml: noscriptWrap(
          `<h1>${esc(cat.labelFa)}</h1><p>${esc(cat.description)}</p><p><a href="/shop">پت‌شاپ</a></p>`
        ),
      });
    }
  }
  if (p.startsWith('/shop/product/')) {
    const idOrSlug = decodeURIComponent(p.slice('/shop/product/'.length));
    const product = getProduct(idOrSlug);
    if (product) {
      const path = productCanonicalPath(product);
      const cat = getCategory(product.categorySlug);
      return pack({
        title: SEO.titleTemplate(`${product.title} | خرید`),
        description: `خرید ${product.title} از پت‌دیت شاپ — غذا و لوازم پت با قیمت تومان.`,
        canonicalPath: path,
        ogType: 'product',
        breadcrumbs: [
          { name: SEO.siteName, path: '/' },
          { name: 'پت‌شاپ', path: '/shop' },
          ...(cat ? [{ name: cat.labelFa, path: `/shop/c/${cat.slug}` }] : []),
          { name: product.title, path },
        ],
        extraLd: [productJsonLd(product)],
        noscriptHtml: productNoscript(product),
      });
    }
  }
  if (p === '/shop' || p.startsWith('/shop/')) {
    return pack({
      title: SEO.titleTemplate('پت‌شاپ آنلاین — غذا و لوازم پت'),
      description:
        'خرید غذای سگ و گربه، اسباب‌بازی، خاک، قلاده و لوازم پت از پت‌دیت شاپ — فیلتر برند و قیمت، پرداخت تومان.',
      canonicalPath: '/shop',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'پت‌شاپ', path: '/shop' },
      ],
      extraLd: [
        {
          '@type': 'Store',
          '@id': `${SITE.origin}/#shop`,
          name: 'پت‌دیت شاپ',
          url: `${SITE.origin}/shop`,
          image: SITE.ogImage,
          parentOrganization: { '@id': `${SITE.origin}/#organization` },
          areaServed: { '@type': 'Country', name: 'Iran' },
        },
      ],
      noscriptHtml: shopNoscript(),
    });
  }

  if (p === '/vet-consult') {
    return pack({
      title: SEO.titleTemplate('مشاوره دامپزشک آنلاین'),
      description:
        'درخواست مشاوره دامپزشک آنلاین در پت‌دیت — چت با دامپزشک تأییدشده روی وب و ربات تلگرام، بدون مراجعه حضوری.',
      canonicalPath: '/vet-consult',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'دامپزشک آنلاین', path: '/vet-consult' },
      ],
      extraLd: [
        {
          '@type': 'Service',
          '@id': `${SITE.origin}/#vet-consult`,
          name: 'مشاوره دامپزشک آنلاین',
          serviceType: 'Online veterinary consultation',
          provider: { '@id': `${SITE.origin}/#organization` },
          areaServed: { '@type': 'Country', name: 'Iran' },
          url: `${SITE.origin}/vet-consult`,
        },
      ],
    });
  }

  if (p === '/adoption') {
    return pack({
      title: SEO.titleTemplate('پذیرش پت'),
      description: 'پت‌های نیازمند خانه در پت‌دیت — پذیرش مسئولانه حیوان خانگی.',
      canonicalPath: '/adoption',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'پذیرش پت', path: '/adoption' },
      ],
    });
  }

  if (p === '/games') {
    return pack({
      title: SEO.titleTemplate('بازی‌ها'),
      description: 'بازی‌های نزدیک را ببین، بساز یا به آن‌ها بپیوند.',
      canonicalPath: '/games',
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'بازی‌ها', path: '/games' },
      ],
    });
  }

  if (p.startsWith('/adoption/')) {
    const slug = p.slice('/adoption/'.length);
    const pet = getAdoptionPet(slug);
    const name = pet?.slug ?? slug;
    const canonicalPath = pet ? `/adoption/${pet.slug}` : p;
    return pack({
      title: SEO.titleTemplate(`پذیرش ${name}`),
      description: 'پت‌های نیازمند خانه در پت‌دیت — پذیرش مسئولانه حیوان خانگی.',
      canonicalPath,
      breadcrumbs: [
        { name: SEO.siteName, path: '/' },
        { name: 'پذیرش پت', path: '/adoption' },
        { name, path: canonicalPath },
      ],
    });
  }

  if (p === '/auth/login') {
    return pack({
      title: SEO.titleTemplate('ورود با پیامک'),
      description: 'ورود به پت‌دیت با کد یک‌بارمصرف پیامک — همبازی، شاپ و دامپزشک روی یک حساب.',
      canonicalPath: '/auth/login',
    });
  }
  if (p === '/auth/otp') {
    return pack({
      title: SEO.titleTemplate('کد تأیید'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p === '/auth/telegram') {
    return pack({
      title: SEO.titleTemplate('اتصال تلگرام'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }

  const privateTitles: Record<string, string> = {
    '/home': 'خانه',
    '/matches': 'درخواست‌های همبازی',
    '/profile': 'پروفایل',
    '/wallet': 'کیف پول',
    '/wallet/earn': 'کسب درآمد',
    '/earn': 'کسب درآمد',
    '/add-pet': 'افزودن پت',
    '/my-pets': 'پت‌های من',
  };
  if (privateTitles[p]) {
    return pack({
      title: SEO.titleTemplate(privateTitles[p]),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p.startsWith('/pets/') && p.endsWith('/edit')) {
    return pack({
      title: SEO.titleTemplate('ویرایش پت'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p.startsWith('/pets/')) {
    return pack({
      title: SEO.titleTemplate('پروفایل پت'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats')) {
    const chatsTitle =
      opts.role === 'vet' ? 'گفتگوهای پزشک' : opts.role === 'trainer' ? 'گفتگوهای مربی' : 'هم بازی';
    return pack({
      title: SEO.titleTemplate(chatsTitle),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_NOFOLLOW,
    });
  }
  if (p.startsWith('/onboarding')) {
    return pack({
      title: SEO.titleTemplate('راه‌اندازی حساب'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_FOLLOW,
    });
  }
  if (p.startsWith('/admin')) {
    return pack({
      title: SEO.titleTemplate('مدیریت'),
      description: desc,
      canonicalPath: p,
      robots: NOINDEX_NOFOLLOW,
    });
  }

  // Unknown public-looking URL: keep THIS path as canonical — never force `/`.
  return pack({
    title: SEO.titleDefault,
    description: desc,
    canonicalPath: p,
  });
}

export function listProductIdRedirects(): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (const product of SHOP_PRODUCTS) {
    const slugPath = productCanonicalPath(product);
    if (product.id && slugPath !== `/shop/product/${product.id}`) {
      out.push({ from: `/shop/product/${product.id}`, to: slugPath });
    }
  }
  return out;
}

export type SitemapEntry = { path: string; changefreq: string; priority: string };

/** Public indexable URLs for sitemap.xml (no auth/app noise). */
export function listSitemapEntries(magazineSlugs: string[] = []): SitemapEntry[] {
  const urls: SitemapEntry[] = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/faq', changefreq: 'weekly', priority: '0.9' },
    { path: '/help', changefreq: 'weekly', priority: '0.85' },
    { path: '/magazine', changefreq: 'daily', priority: '0.85' },
    { path: '/shop', changefreq: 'daily', priority: '0.9' },
    { path: '/shop/c/all', changefreq: 'daily', priority: '0.85' },
    { path: '/adoption', changefreq: 'weekly', priority: '0.8' },
    { path: '/games', changefreq: 'weekly', priority: '0.7' },
    { path: '/vet-consult', changefreq: 'weekly', priority: '0.85' },
  ];
  for (const cat of SHOP_CATEGORIES) {
    urls.push({ path: `/shop/c/${cat.slug}`, changefreq: 'weekly', priority: '0.75' });
  }
  for (const product of SHOP_PRODUCTS) {
    urls.push({ path: productCanonicalPath(product), changefreq: 'weekly', priority: '0.65' });
  }
  for (const pet of ADOPTION_PETS) {
    urls.push({ path: `/adoption/${pet.slug}`, changefreq: 'weekly', priority: '0.7' });
  }
  for (const slug of magazineSlugs) {
    urls.push({
      path: `/magazine/${slug}`,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (seen.has(u.path)) return false;
    seen.add(u.path);
    return true;
  });
}

export function listPrerenderPaths(magazineSlugs: string[] = []): string[] {
  return listSitemapEntries(magazineSlugs).map((u) => u.path);
}

const ATTR_KEYS = [
  'description',
  'robots',
  'canonical',
  'hreflang-fa',
  'hreflang-default',
  'og:url',
  'og:title',
  'og:description',
  'og:type',
  'twitter:title',
  'twitter:description',
] as const;

function setSeoAttr(html: string, key: string, value: string): string {
  const re = new RegExp(`(data-pd-seo="${key}"[^>]*(?:href|content)=")[^"]*(")`, 'i');
  if (!re.test(html)) return html;
  return html.replace(re, `$1${value.replace(/"/g, '&quot;')}$2`);
}

function setTitle(html: string, title: string): string {
  if (/<title[^>]*data-pd-seo="title"[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(
      /<title[^>]*data-pd-seo="title"[^>]*>[\s\S]*?<\/title>/i,
      `<title data-pd-seo="title">${esc(title)}</title>`
    );
  }
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
}

function setJsonLd(html: string, jsonLd: Record<string, unknown>): string {
  const body = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  if (/<script[^>]*data-pd-seo="jsonld"[^>]*>[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(
      /<script[^>]*data-pd-seo="jsonld"[^>]*>[\s\S]*?<\/script>/i,
      `<script type="application/ld+json" data-pd-seo="jsonld">\n      ${body}\n    </script>`
    );
  }
  return html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" data-pd-seo="jsonld">${body}</script>`
  );
}

function setNoscript(html: string, inner: string): string {
  if (/<noscript[^>]*id="pd-seo-noscript"[^>]*>[\s\S]*?<\/noscript>/i.test(html)) {
    return html.replace(
      /<noscript[^>]*id="pd-seo-noscript"[^>]*>[\s\S]*?<\/noscript>/i,
      `<noscript id="pd-seo-noscript">\n      ${inner}\n    </noscript>`
    );
  }
  return html.replace(
    /<div id="root"><\/div>/,
    `<div id="root"></div>\n    <noscript id="pd-seo-noscript">${inner}</noscript>`
  );
}

const LCP_HERO_MARK = 'data-pd-lcp="hero"';
const LCP_HERO_HREF = '/pepito/uploads/1-hero.jpg';

function setHomeLcpPreload(html: string, pathname: string): string {
  const p = normalizePath(pathname);
  const existing = new RegExp(`\\s*<link[^>]*${LCP_HERO_MARK}[^>]*>`, 'i');
  let out = html.replace(existing, '');
  if (p !== '/') return out;
  const tag = `    <link rel="preload" as="image" href="${LCP_HERO_HREF}" fetchpriority="high" ${LCP_HERO_MARK} />\n`;
  return out.replace('</head>', `${tag}  </head>`);
}

/** Inject per-route title/description/canonical/og/twitter/JSON-LD/noscript into the SPA shell. */
export function applySeoToHtml(html: string, pathname: string, opts: PageSeoOpts = {}): string {
  const seo = pageSeoForPath(pathname, opts);
  const canonical = canonicalUrl(seo.canonicalPath);
  let out = html;
  out = setTitle(out, seo.title);
  const values: Record<(typeof ATTR_KEYS)[number], string> = {
    description: seo.description,
    robots: seo.robots,
    canonical,
    'hreflang-fa': canonical,
    'hreflang-default': canonical,
    'og:url': canonical,
    'og:title': seo.title,
    'og:description': seo.description,
    'og:type': seo.ogType,
    'twitter:title': seo.title,
    'twitter:description': seo.description,
  };
  for (const key of ATTR_KEYS) {
    out = setSeoAttr(out, key, values[key]);
  }
  out = setJsonLd(out, seo.jsonLd);
  out = setNoscript(out, seo.noscriptHtml);
  out = setHomeLcpPreload(out, pathname);
  return out;
}

export function distFileForPath(pathname: string): string {
  const p = normalizePath(pathname);
  return p === '/' ? 'index.html' : `${p.replace(/^\//, '')}/index.html`;
}
