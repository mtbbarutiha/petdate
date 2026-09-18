/**
 * Keep homepage LCP discoverable in initial HTML without waiting on /api/hero.
 * Writes media/lcp/hero-boot.json and patches <!--pd-lcp-boot-->…<!--/pd-lcp-boot--> in index.html.
 */
import fs from 'fs';
import path from 'path';
import type { HeroSlideResolved } from './hero-slides';

export type HeroBootSnapshot = {
  webp: string;
  srcSet: string;
  fallback: string;
  posX: number;
  posY: number;
  scale: number;
  updatedAt: string;
};

const BOOT_START = '<!--pd-lcp-boot-->';
const BOOT_END = '<!--/pd-lcp-boot-->';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function candidateIndexHtmlPaths(): string[] {
  const root = repoRoot();
  // Only patch built HTML on the server. Source packages/web/index.html is
  // committed with a snapshot and must not be overwritten by API selftests.
  return [path.join(root, 'packages/web/dist/index.html')];
}

function candidateBootJsonPaths(): string[] {
  const root = repoRoot();
  return [
    path.join(root, 'packages/web/dist/media/lcp/hero-boot.json'),
    path.join(root, 'packages/web/public/media/lcp/hero-boot.json'),
  ];
}

export function snapshotFromFirstSlide(slide: HeroSlideResolved): HeroBootSnapshot {
  return {
    webp: slide.webp,
    srcSet: slide.srcSet,
    fallback: slide.fallback,
    posX: slide.posX,
    posY: slide.posY,
    scale: slide.scale,
    updatedAt: new Date().toISOString(),
  };
}

export function renderLcpBootHtml(snap: HeroBootSnapshot): string {
  const href = snap.webp;
  const srcSet = snap.srcSet || href;
  const pos = `${snap.posX}% ${snap.posY}%`;
  const scaleStyle =
    snap.scale > 0 && snap.scale !== 1
      ? `style="object-position:${pos};transform:scale(${snap.scale});transform-origin:${pos}"`
      : `style="object-position:${pos}"`;
  return [
    BOOT_START,
    `<link rel="preload" as="image" type="image/webp" href="${href}" imagesrcset="${srcSet}" imagesizes="100vw" fetchpriority="high" data-pd-lcp="hero" />`,
    `<script type="application/json" id="pd-hero-boot-json">${JSON.stringify(snap)}</script>`,
    BOOT_END,
  ].join('\n    ');
}

/** Attributes applied to #pd-boot-lcp when snapshot is known.
 *  Must keep inline geometry + decoding=async so LCP paints without waiting on
 *  hashed CSS / main-thread JS (see Lighthouse element render delay). */
export function bootLcpImgOpenTag(snap: HeroBootSnapshot): string {
  const srcSetAttr = snap.srcSet ? ` srcset="${snap.srcSet}"` : '';
  const pos = `${snap.posX}% ${snap.posY}%`;
  /* Never inline transform:scale on boot LCP — it sits outside .pepito-hero
     overflow:hidden and bleeds into the nav / RTL gutter. Admin pan uses
     object-position only here; scale applies to in-hero React media. */
  const style =
    'position:absolute;inset:auto;top:var(--pepito-nav-h,64px);left:0;right:0;bottom:auto;width:auto;max-width:100%;height:var(--pepito-hero-h,calc(100svh - 64px));max-height:var(--pepito-hero-h,calc(100svh - 64px));object-fit:cover;object-position:' +
    pos +
    ';z-index:0;pointer-events:none;margin:0;display:block;visibility:visible;opacity:1;transform:none;animation:none;clip-path:inset(0)';
  return `<img
      id="pd-boot-lcp"
      class="pepito-hero-media"
      alt="همبازی مناسب برای پت‌ات پیدا کن"
      width="1600"
      height="900"
      fetchpriority="high"
      decoding="async"
      sizes="100vw"${srcSetAttr}
      src="${snap.webp}"
      style="${style}"
      data-pd-boot-hero="snapshot"
    />`;
}

function patchIndexHtml(html: string, snap: HeroBootSnapshot): string {
  let next = html;
  const block = renderLcpBootHtml(snap);
  if (next.includes(BOOT_START) && next.includes(BOOT_END)) {
    next = next.replace(
      new RegExp(`${BOOT_START}[\\s\\S]*?${BOOT_END}`),
      () => block,
    );
  }

  const imgRe =
    /<img\s+id="pd-boot-lcp"[\s\S]*?(?:\/>|>)/;
  if (imgRe.test(next)) {
    next = next.replace(imgRe, () => bootLcpImgOpenTag(snap));
  }
  return next;
}

export function writeHeroBootSnapshot(slide: HeroSlideResolved): HeroBootSnapshot {
  const snap = snapshotFromFirstSlide(slide);

  for (const jsonPath of candidateBootJsonPaths()) {
    try {
      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
      fs.writeFileSync(jsonPath, `${JSON.stringify(snap, null, 2)}\n`, 'utf8');
    } catch {
      /* dist may be absent in CI */
    }
  }

  for (const htmlPath of candidateIndexHtmlPaths()) {
    try {
      if (!fs.existsSync(htmlPath)) continue;
      const raw = fs.readFileSync(htmlPath, 'utf8');
      const patched = patchIndexHtml(raw, snap);
      if (patched !== raw) fs.writeFileSync(htmlPath, patched, 'utf8');
    } catch {
      /* ignore */
    }
  }

  return snap;
}
