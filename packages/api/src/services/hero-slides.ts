/**
 * Hero slide config in admin_settings — overlays custom uploads on static defaults.
 * Display focus (pan/zoom) can be set for custom OR default slides.
 */
import { adminPlatform } from '../admin-platform';
import { writeHeroBootSnapshot } from './hero-boot-snapshot';
import { invalidateHeroPublicCache } from './hero-public-cache';
import {
  DEFAULT_HERO_FOCUS,
  HERO_ROLES,
  type HeroFocus,
  type HeroRole,
  type HeroSlideAssets,
  isHeroRole,
  normalizeHeroFocus,
} from './hero-slide-store';

function afterHeroMutation(): void {
  invalidateHeroPublicCache();
  try {
    const slides = listResolvedHeroSlides();
    if (slides.length) writeHeroBootSnapshot(slides);
  } catch {
    /* snapshot is best-effort */
  }
}

export const HERO_SETTINGS_KEY = 'heroSlides';

export type HeroSlideResolved = {
  role: HeroRole;
  webp: string;
  srcSet: string;
  fallback: string;
  source: 'custom' | 'default';
  updatedAt: string | null;
  originalName?: string;
  posX: number;
  posY: number;
  scale: number;
};

/** Stored entry may be image+focus, or focus-only (for default photos). */
type StoredHeroEntry = {
  webp800?: string;
  webp1280?: string;
  webp1920?: string;
  jpeg?: string;
  updatedAt?: string;
  originalName?: string;
  posX?: number;
  posY?: number;
  scale?: number;
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
    ...DEFAULT_HERO_FOCUS,
  };
}

function parseStored(): Partial<Record<HeroRole, StoredHeroEntry>> {
  const raw = adminPlatform.getSettings()[HERO_SETTINGS_KEY];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<HeroRole, StoredHeroEntry>> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isHeroRole(key) || !value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const webp800 = String(v.webp800 || '');
      const webp1280 = String(v.webp1280 || '');
      const webp1920 = String(v.webp1920 || '');
      const jpeg = String(v.jpeg || '');
      const focus = normalizeHeroFocus(v);
      const hasImages = Boolean(webp800 && jpeg);
      const hasFocusOverride =
        v.posX !== undefined || v.posY !== undefined || v.scale !== undefined;
      if (!hasImages && !hasFocusOverride) continue;
      const entry: StoredHeroEntry = { ...focus };
      if (hasImages) {
        entry.webp800 = webp800;
        entry.webp1280 = webp1280 || webp800;
        entry.webp1920 = webp1920 || webp1280 || webp800;
        entry.jpeg = jpeg;
        entry.updatedAt = String(v.updatedAt || '');
        if (v.originalName) entry.originalName = String(v.originalName);
      }
      out[key] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStored(map: Partial<Record<HeroRole, StoredHeroEntry>>): void {
  adminPlatform.setSettings({ [HERO_SETTINGS_KEY]: JSON.stringify(map) });
}

function focusFromEntry(entry: StoredHeroEntry | undefined): HeroFocus {
  if (!entry) return { ...DEFAULT_HERO_FOCUS };
  return normalizeHeroFocus(entry);
}

function resolveOne(role: HeroRole, custom: StoredHeroEntry | undefined): HeroSlideResolved {
  const focus = focusFromEntry(custom);
  if (custom?.webp800 && custom?.jpeg) {
    return {
      role,
      webp: custom.webp800,
      srcSet: `${custom.webp800} 800w, ${custom.webp1280 || custom.webp800} 1280w, ${custom.webp1920 || custom.webp1280 || custom.webp800} 1920w`,
      fallback: custom.jpeg,
      source: 'custom',
      updatedAt: custom.updatedAt || null,
      originalName: custom.originalName,
      ...focus,
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
    ...focus,
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
  const prev = stored[role];
  const focus = normalizeHeroFocus({
    posX: assets.posX ?? prev?.posX,
    posY: assets.posY ?? prev?.posY,
    scale: assets.scale ?? prev?.scale,
  });
  stored[role] = {
    webp800: assets.webp800,
    webp1280: assets.webp1280,
    webp1920: assets.webp1920,
    jpeg: assets.jpeg,
    updatedAt: assets.updatedAt,
    originalName: assets.originalName,
    ...focus,
  };
  writeStored(stored);
  const resolved = resolveOne(role, stored[role]);
  afterHeroMutation();
  return resolved;
}

export function setHeroSlideFocus(role: HeroRole, focusRaw: unknown): HeroSlideResolved {
  const stored = parseStored();
  const prev = stored[role] || {};
  const focus = normalizeHeroFocus(focusRaw);
  stored[role] = { ...prev, ...focus };
  writeStored(stored);
  const resolved = resolveOne(role, stored[role]);
  afterHeroMutation();
  return resolved;
}

export function resetCustomHeroSlide(role: HeroRole): HeroSlideResolved {
  const stored = parseStored();
  delete stored[role];
  writeStored(stored);
  const resolved = resolveOne(role, undefined);
  afterHeroMutation();
  return resolved;
}

/** Sync LCP HTML snapshot + cache warm on process boot. */
export function syncHeroBootSnapshotOnStartup(): void {
  afterHeroMutation();
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
