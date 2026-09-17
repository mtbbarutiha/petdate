/**
 * Short TTL cache for GET /api/hero — memory first, Redis optional.
 * Invalidated whenever admin mutates hero slides.
 */
import { redisDel, redisGet, redisSet } from '../redis-client';
import { listResolvedHeroSlides, type HeroSlideResolved } from './hero-slides';

const REDIS_KEY = 'petdate:hero:slides:v1';
const MEMORY_TTL_MS = 60_000;
const REDIS_TTL_SEC = 120;

type MemEntry = { at: number; slides: HeroSlideResolved[] };

let memory: MemEntry | null = null;

export function invalidateHeroPublicCache(): void {
  memory = null;
  void redisDel(REDIS_KEY).catch(() => undefined);
}

export function getHeroSlidesCachedSync(): HeroSlideResolved[] {
  const now = Date.now();
  if (memory && now - memory.at < MEMORY_TTL_MS) {
    return memory.slides;
  }
  const slides = listResolvedHeroSlides();
  memory = { at: now, slides };
  void redisSet(REDIS_KEY, JSON.stringify(slides), { ex: REDIS_TTL_SEC }).catch(() => undefined);
  return slides;
}

/** Prefer warm Redis when memory is cold (multi-process). */
export async function getHeroSlidesCached(): Promise<HeroSlideResolved[]> {
  const now = Date.now();
  if (memory && now - memory.at < MEMORY_TTL_MS) {
    return memory.slides;
  }
  try {
    const raw = await redisGet(REDIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HeroSlideResolved[];
      if (Array.isArray(parsed) && parsed.length) {
        memory = { at: now, slides: parsed };
        return parsed;
      }
    }
  } catch {
    /* fail open */
  }
  return getHeroSlidesCachedSync();
}
