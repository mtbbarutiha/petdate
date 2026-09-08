import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO, SITE } from '@petdate/shared';

type PageMeta = {
  title: string;
  description?: string;
  canonicalPath?: string;
  robots?: string;
};

const DEFAULT_DESC = SEO.description;

/** Public / app routes → document title (+ optional description). */
function metaForPath(pathname: string): PageMeta {
  const p = pathname.replace(/\/+$/, '') || '/';

  if (p === '/' || p === '/welcome') {
    return { title: SEO.titleDefault, description: DEFAULT_DESC, canonicalPath: '/' };
  }
  if (p === '/faq') {
    return {
      title: SEO.titleTemplate('سؤالات متداول'),
      description: 'پاسخ پرسش‌های پرتکرار درباره پت‌دیت، همبازی، شاپ، پذیرش و مشاوره دامپزشک.',
      canonicalPath: '/faq',
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
    return {
      title: SEO.titleTemplate('پت‌شاپ'),
      description: 'خرید غذا، اسباب‌بازی و لوازم پت از پت‌دیت شاپ.',
      canonicalPath: p.startsWith('/shop/c/') || p.startsWith('/shop/product/') ? p : '/shop',
    };
  }
  if (p === '/vet-consult') {
    return {
      title: SEO.titleTemplate('مشاوره دامپزشک'),
      description: 'درخواست مشاوره دامپزشک آنلاین در پت‌دیت.',
      canonicalPath: '/vet-consult',
    };
  }
  if (p.startsWith('/adoption/')) {
    return {
      title: SEO.titleTemplate('پذیرش پت'),
      description: 'جزئیات پذیرش پت در پت‌دیت.',
      canonicalPath: p,
    };
  }
  if (p === '/auth/login') {
    return {
      title: SEO.titleTemplate('ورود'),
      description: 'ورود به پت‌دیت با پیامک OTP.',
      canonicalPath: '/auth/login',
    };
  }
  if (p === '/auth/otp') {
    return {
      title: SEO.titleTemplate('کد تأیید'),
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
  if (p === '/chats' || p.startsWith('/chats/')) {
    return { title: SEO.titleTemplate('هم بازی'), robots: 'noindex,nofollow' };
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

/**
 * Keeps document.title + key meta in sync with the SPA route.
 * Crawlers that execute JS (and browser tabs) get per-page titles.
 */
export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = metaForPath(pathname);
    document.title = meta.title;

    const description = meta.description ?? DEFAULT_DESC;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', meta.robots ?? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');

    const canonical = `${SITE.origin}${meta.canonicalPath ?? (pathname === '/' ? '/' : pathname)}`;
    upsertLink('canonical', canonical);

    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', description);
  }, [pathname]);

  return null;
}
