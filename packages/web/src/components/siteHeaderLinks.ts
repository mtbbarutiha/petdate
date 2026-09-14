import type { PublicPlatformConfig } from '@petdate/shared';

export type SiteHeaderLink = {
  key: string;
  labelKey: string;
  to?: string;
  href?: string;
  testId?: string;
  className?: string;
};

const DUPLICATE_PRIMARY = new Set(['games', 'shop', 'petShop', 'store']);

/** Marketing extras — never repeats شاپ / ایونت‌ها (those live in SiteDesktopNav). */
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

/**
 * Shop IA extras — none in the primary text row.
 * Orders + cart live in NavUserCluster; Events/playmate/shop shortcuts live in ProfileMenu.
 * Do not add store/شاپ here (would duplicate the shop destination).
 */
export function shopSectionLinks(): SiteHeaderLink[] {
  return [];
}
