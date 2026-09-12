import type { PublicPlatformConfig } from '@petdate/shared';

export type SiteHeaderLink = {
  key: string;
  labelKey: string;
  to?: string;
  href?: string;
  testId?: string;
  className?: string;
};

const DUPLICATE_PRIMARY = new Set(['games', 'shop', 'petShop']);

/** Marketing extras — never repeats شاپ / بازی‌ها (those live in SiteDesktopNav). */
export function landingSectionLinks(
  platform?: Pick<PublicPlatformConfig, 'vetConsultEnabled'> | null,
): SiteHeaderLink[] {
  const links: SiteHeaderLink[] = [
    { key: 'services', labelKey: 'nav.services', to: '/#services' },
    { key: 'adoption', labelKey: 'nav.adoption', to: '/adoption', testId: 'nav-adoption' },
  ];
  if (platform?.vetConsultEnabled !== false) {
    links.push({ key: 'vet', labelKey: 'nav.vet', to: '/vet-consult' });
  }
  links.push({ key: 'faq', labelKey: 'nav.faq', to: '/faq', className: 'pepito-nav-faq' });
  return links.filter((link) => !DUPLICATE_PRIMARY.has(link.key));
}

export function welcomeSectionLinks(): SiteHeaderLink[] {
  return [
    { key: 'services', labelKey: 'nav.services', href: '#services' },
    { key: 'adoption', labelKey: 'nav.adoption', to: '/adoption', testId: 'nav-adoption' },
    { key: 'news', labelKey: 'nav.news', href: '#news' },
    { key: 'faq', labelKey: 'nav.faq', href: '#faq', className: 'pepito-nav-faq' },
  ];
}

/** Shop IA — cart stays in the user cluster, not a second text link. */
export function shopSectionLinks(): SiteHeaderLink[] {
  return [
    { key: 'store', labelKey: 'shop.store', to: '/shop' },
    { key: 'orders', labelKey: 'shop.orders', to: '/shop/orders' },
    { key: 'dog', labelKey: 'shop.dog', to: '/shop/c/dog-food' },
    { key: 'cat', labelKey: 'shop.cat', to: '/shop/c/cat-food' },
    { key: 'bird', labelKey: 'shop.bird', to: '/shop/c/bird-food' },
  ];
}

export const INLINE_SECTION_COUNT = 2;
