import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { primaryRole, SEO, SITE } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';
import { canonicalUrl, pageSeoForPath } from '../lib/pageSeo';

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

const JSON_LD_ID = 'petdate-route-jsonld';

function upsertJsonLd(data: Record<string, unknown>) {
  let el = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = JSON_LD_ID;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Keeps document.title + key meta in sync with the SPA route.
 * Initial HTML is prerendered per public path; this covers client navigations.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const { lang } = useI18n();
  const role = primaryRole(user?.roles, user?.role);

  useEffect(() => {
    const meta = pageSeoForPath(pathname, { role, lang: lang === 'en' ? 'en' : 'fa' });
    document.title = meta.title;

    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', meta.robots);

    const canonical = canonicalUrl(meta.canonicalPath);
    upsertLink('canonical', canonical);
    // EN is UI-only (localStorage) — not a separate crawlable URL.
    upsertHreflang('fa-IR', canonical);
    upsertHreflang('x-default', canonical);

    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:type', meta.ogType);
    upsertMeta('property', 'og:site_name', SEO.siteName);
    upsertMeta('property', 'og:locale', SEO.locale);
    upsertMeta('property', 'og:image', SITE.ogImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', SITE.ogImage);
    upsertJsonLd(meta.jsonLd);
  }, [pathname, role, lang]);

  return null;
}
