import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { primaryRole, SEO, SITE } from '@petdate/shared';
import { getAdoptionPet } from '../data/adoptionPets';
import { getCategory, getProduct } from '../data/shopCatalog';
import { useAuthStore } from '../hooks/useAuthStore';

type PageMeta = {
  title: string;
  description?: string;
  canonicalPath?: string;
  robots?: string;
};

const DEFAULT_DESC = SEO.description;

/** Public / app routes → document title (+ optional description). */
function metaForPath(pathname: string, role?: ReturnType<typeof primaryRole>): PageMeta {
  const p = pathname.replace(/\/+$/, '') || '/';

  if (p === '/' || p === '/welcome') {
    return {
      title: SEO.titleDefault,
      description: DEFAULT_DESC,
      canonicalPath: '/',
    };
  }
  if (p === '/faq') {
    return {
      title: SEO.titleTemplate('سؤالات متداول پت‌دیت'),
      description:
        'پاسخ پرسش‌های پرتکرار درباره همبازی پت، پت‌شاپ، پذیرش حیوان خانگی، مشاوره دامپزشک آنلاین و ورود با OTP در پت‌دیت.',
      canonicalPath: '/faq',
    };
  }
  if (p === '/magazine' || p.startsWith('/magazine/')) {
    if (p === '/magazine') {
      return {
        title: SEO.titleTemplate('مجله و اخبار پت'),
        description:
          'مقالات و اخبار مراقبت از پت، سلامت، تغذیه و نکات نگهداری — مجله پت‌دیت.',
        canonicalPath: '/magazine',
      };
    }
    return {
      title: SEO.titleTemplate('مقاله مجله پت‌دیت'),
      description: 'مقاله مجله و اخبار پت‌دیت.',
      canonicalPath: p,
    };
  }
  if (p === '/shop' || p.startsWith('/shop/')) {
    if (p === '/shop/cart') {
      return {
        title: SEO.titleTemplate('سبد خرید'),
        description: 'سبد خرید پت‌دیت شاپ.',
        canonicalPath: '/shop/cart',
        robots: 'noindex,follow',
      };
    }
    if (p === '/shop/orders') {
      return {
        title: SEO.titleTemplate('سفارش‌های من'),
        description: 'لیست سفارش‌های پت‌دیت شاپ.',
        canonicalPath: '/shop/orders',
        robots: 'noindex,follow',
      };
    }
    if (p.startsWith('/shop/stars-pay/') || p.startsWith('/shop/card-pay/')) {
      return {
        title: SEO.titleTemplate('پرداخت سفارش'),
        robots: 'noindex,nofollow',
      };
    }
    if (p.startsWith('/shop/c/')) {
      const slug = p.slice('/shop/c/'.length);
      if (slug === 'all') {
        return {
          title: SEO.titleTemplate('همه محصولات پت‌شاپ'),
          description:
            'مشاهده همه کالاهای پت‌دیت شاپ — غذا، اسباب‌بازی، خاک، قلاده و لوازم سگ و گربه با فیلتر برند و قیمت.',
          canonicalPath: '/shop/c/all',
        };
      }
      const cat = getCategory(slug);
      if (cat) {
        return {
          title: SEO.titleTemplate(`${cat.labelFa} | خرید آنلاین`),
          description:
            cat.description ||
            `خرید ${cat.labelFa} از پت‌دیت شاپ — ارسال در ایران، قیمت به تومان.`,
          canonicalPath: `/shop/c/${cat.slug}`,
        };
      }
    }
    if (p.startsWith('/shop/product/')) {
      const id = p.slice('/shop/product/'.length);
      const product = getProduct(id);
      if (product) {
        return {
          title: SEO.titleTemplate(`${product.title} | خرید`),
          description: `خرید ${product.title} از پت‌دیت شاپ — غذا و لوازم پت با قیمت تومان.`,
          canonicalPath: `/shop/product/${product.id}`,
        };
      }
    }
    return {
      title: SEO.titleTemplate('پت‌شاپ آنلاین — غذا و لوازم پت'),
      description:
        'خرید غذای سگ و گربه، اسباب‌بازی، خاک، قلاده و لوازم پت از پت‌دیت شاپ — فیلتر برند و قیمت، پرداخت تومان.',
      canonicalPath: '/shop',
    };
  }
  if (p === '/vet-consult') {
    return {
      title: SEO.titleTemplate('مشاوره دامپزشک آنلاین'),
      description:
        'درخواست مشاوره دامپزشک آنلاین در پت‌دیت — چت با دامپزشک تأییدشده روی وب و ربات تلگرام، بدون مراجعه حضوری.',
      canonicalPath: '/vet-consult',
    };
  }
  if (p.startsWith('/adoption/')) {
    const slug = p.slice('/adoption/'.length);
    const pet = getAdoptionPet(slug);
    if (pet) {
      return {
        title: SEO.titleTemplate(`پذیرش ${pet.name} — حیوان خانگی`),
        description:
          pet.about ||
          `جزئیات پذیرش ${pet.name} در پت‌دیت — پیدا کردن خانهٔ جدید برای حیوان خانگی.`,
        canonicalPath: `/adoption/${pet.slug}`,
      };
    }
    return {
      title: SEO.titleTemplate('پذیرش پت'),
      description: 'پت‌های نیازمند خانه در پت‌دیت — پذیرش مسئولانه حیوان خانگی.',
      canonicalPath: p,
    };
  }
  if (p === '/auth/login') {
    return {
      title: SEO.titleTemplate('ورود با پیامک'),
      description: 'ورود به پت‌دیت با کد یک‌بارمصرف پیامک — همبازی، شاپ و دامپزشک روی یک حساب.',
      canonicalPath: '/auth/login',
    };
  }
  if (p === '/auth/otp') {
    return {
      title: SEO.titleTemplate('کد تأیید'),
      robots: 'noindex,follow',
    };
  }
  if (p === '/auth/telegram') {
    return {
      title: SEO.titleTemplate('اتصال تلگرام'),
      robots: 'noindex,follow',
    };
  }
  if (p === '/home') {
    return { title: SEO.titleTemplate('خانه'), robots: 'noindex,follow' };
  }
  if (p === '/matches') {
    return { title: SEO.titleTemplate('درخواست‌های همبازی'), robots: 'noindex,follow' };
  }
  if (p === '/profile') {
    return { title: SEO.titleTemplate('پروفایل'), robots: 'noindex,follow' };
  }
  if (p === '/wallet') {
    return { title: SEO.titleTemplate('کیف پول'), robots: 'noindex,follow' };
  }
  if (p === '/wallet/earn' || p === '/earn') {
    return { title: SEO.titleTemplate('کسب درآمد'), robots: 'noindex,follow' };
  }
  if (p === '/add-pet') {
    return { title: SEO.titleTemplate('افزودن پت'), robots: 'noindex,follow' };
  }
  if (p === '/my-pets') {
    return { title: SEO.titleTemplate('پت‌های من'), robots: 'noindex,follow' };
  }
  if (p.startsWith('/pets/') && p.endsWith('/edit')) {
    return { title: SEO.titleTemplate('ویرایش پت'), robots: 'noindex,follow' };
  }
  if (p.startsWith('/pets/')) {
    return { title: SEO.titleTemplate('پروفایل پت'), robots: 'noindex,follow' };
  }
  if (p === '/chats' || p.startsWith('/chats/') || p.startsWith('/vet-chats')) {
    const chatsTitle =
      role === 'vet'
        ? 'گفتگوهای پزشک'
        : role === 'trainer'
          ? 'گفتگوهای مربی'
          : role === 'pet_sitter'
            ? 'گفتگوهای پرستار'
            : 'هم بازی';
    return { title: SEO.titleTemplate(chatsTitle), robots: 'noindex,nofollow' };
  }
  if (p.startsWith('/onboarding')) {
    return { title: SEO.titleTemplate('راه‌اندازی حساب'), robots: 'noindex,follow' };
  }
  if (p.startsWith('/admin')) {
    return { title: SEO.titleTemplate('مدیریت'), robots: 'noindex,nofollow' };
  }

  return { title: SEO.titleDefault, description: DEFAULT_DESC };
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertHreflang(hreflang: string, href: string) {
  let el = document.head.querySelector(
    `link[rel="alternate"][hreflang="${hreflang}"]`
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = 'alternate';
    el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

/**
 * Keeps document.title + key meta in sync with the SPA route.
 * Crawlers that execute JS (and browser tabs) get per-page titles.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const role = primaryRole(user?.roles, user?.role);

  useEffect(() => {
    const meta = metaForPath(pathname, role);
    document.title = meta.title;

    const description = meta.description ?? DEFAULT_DESC;
    upsertMeta('name', 'description', description);
    upsertMeta(
      'name',
      'robots',
      meta.robots ?? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    );

    const canonical = `${SITE.origin}${meta.canonicalPath ?? (pathname === '/' ? '/' : pathname)}`;
    upsertLink('canonical', canonical);
    upsertHreflang('fa-IR', canonical);
    upsertHreflang('x-default', canonical);

    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', SEO.siteName);
    upsertMeta('property', 'og:locale', SEO.locale);
    upsertMeta('property', 'og:image', SITE.ogImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', SITE.ogImage);
  }, [pathname, role]);

  return null;
}
