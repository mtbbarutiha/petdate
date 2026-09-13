/**
 * Hero slide config in admin_settings — overlays custom uploads on static defaults.
 */
import { adminPlatform } from '../admin-platform';
import {
  HERO_ROLES,
  type HeroRole,
  type HeroSlideAssets,
  isHeroRole,
} from './hero-slide-store';

export const HERO_SETTINGS_KEY = 'heroSlides';

export type HeroSlideResolved = {
  role: HeroRole;
  webp: string;
  srcSet: string;
  fallback: string;
  source: 'custom' | 'default';
  updatedAt: string | null;
  originalName?: string;
};

const DEFAULT_BY_ROLE: Record<
  HeroRole,
  { webp800: string; webp1280: string; webp1920: string; jpeg: string }
> = {
  playmate: {
    webp800: '/media/lcp/hero-playmate-800.webp',
    webp1280: '/media/lcp/hero-playmate-1280.webp',
    webp1920: '/media/lcp/hero-playmate-1920.webp',
    jpeg: '/pepito/uploads/1-hero.jpg',
  },
  vet: {
    webp800: '/media/lcp/hero-vet-800.webp',
    webp1280: '/media/lcp/hero-vet-1280.webp',
    webp1920: '/media/lcp/hero-vet-1920.webp',
    jpeg: '/pepito/uploads/3-hero.jpg',
  },
  trainer: {
    webp800: '/media/lcp/hero-trainer-800.webp',
    webp1280: '/media/lcp/hero-trainer-1280.webp',
    webp1920: '/media/lcp/hero-trainer-1920.webp',
    jpeg: '/pepito/uploads/5-hero.jpg',
  },
  no_pet: {
    webp800: '/media/lcp/hero-nopet-800.webp',
    webp1280: '/media/lcp/hero-nopet-1280.webp',
    webp1920: '/media/lcp/hero-nopet-1920.webp',
    jpeg: '/pepito/uploads/06-hero.jpg',
  },
  adoption: {
    webp800: '/media/lcp/hero-adoption-800.webp',
    webp1280: '/media/lcp/hero-adoption-1280.webp',
    webp1920: '/media/lcp/hero-adoption-1920.webp',
    jpeg: '/pepito/uploads/2-hero.jpg',
  },
};

export function defaultHeroAssets(role: HeroRole): HeroSlideAssets {
  const d = DEFAULT_BY_ROLE[role];
  return {
    webp800: d.webp800,
    webp1280: d.webp1280,
    webp1920: d.webp1920,
    jpeg: d.jpeg,
    updatedAt: '',
  };
}

function parseStored(): Partial<Record<HeroRole, HeroSlideAssets>> {
  const raw = adminPlatform.getSettings()[HERO_SETTINGS_KEY];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<HeroRole, HeroSlideAssets>> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isHeroRole(key) || !value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const webp800 = String(v.webp800 || '');
      const webp1280 = String(v.webp1280 || '');
      const webp1920 = String(v.webp1920 || '');
      const jpeg = String(v.jpeg || '');
      if (!webp800 || !jpeg) continue;
      out[key] = {
        webp800,
        webp1280: webp1280 || webp800,
        webp1920: webp1920 || webp1280 || webp800,
        jpeg,
        updatedAt: String(v.updatedAt || ''),
        originalName: v.originalName ? String(v.originalName) : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(map: Partial<Record<HeroRole, HeroSlideAssets>>): void {
  adminPlatform.setSettings({ [HERO_SETTINGS_KEY]: JSON.stringify(map) });
}

function resolveOne(role: HeroRole, custom: HeroSlideAssets | undefined): HeroSlideResolved {
  if (custom) {
    return {
      role,
      webp: custom.webp800,
      srcSet: `${custom.webp800} 800w, ${custom.webp1280} 1280w, ${custom.webp1920} 1920w`,
      fallback: custom.jpeg,
      source: 'custom',
      updatedAt: custom.updatedAt || null,
      originalName: custom.originalName,
    };
  }
  const d = defaultHeroAssets(role);
  return {
    role,
    webp: d.webp800,
    srcSet: `${d.webp800} 800w, ${d.webp1280} 1280w, ${d.webp1920} 1920w`,
    fallback: d.jpeg,
    source: 'default',
    updatedAt: null,
  };
}

export function listResolvedHeroSlides(): HeroSlideResolved[] {
  const stored = parseStored();
  return HERO_ROLES.map((role) => resolveOne(role, stored[role]));
}

export function getResolvedHeroSlide(role: HeroRole): HeroSlideResolved {
  return resolveOne(role, parseStored()[role]);
}

export function setCustomHeroSlide(role: HeroRole, assets: HeroSlideAssets): HeroSlideResolved {
  const stored = parseStored();
  stored[role] = assets;
  writeStored(stored);
  return resolveOne(role, assets);
}

export function resetCustomHeroSlide(role: HeroRole): HeroSlideResolved {
  const stored = parseStored();
  delete stored[role];
  writeStored(stored);
  return resolveOne(role, undefined);
}

export function heroRoleLabelsFa(): Record<HeroRole, string> {
  return {
    playmate: 'همبازی',
    vet: 'دامپزشک',
    trainer: 'مربی',
    no_pet: 'بدون پت',
    adoption: 'پذیرش / فرزندخواندگی',
  };
}
