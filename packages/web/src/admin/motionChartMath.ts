/**
 * Pure geometry helpers for admin motion charts (selftest-friendly).
 */

export type ChartCoord = { x: number; y: number; label?: string; value?: number };

/** Catmull-Rom → cubic Bézier smooth open path through points. */
export function smoothLinePath(coords: Array<{ x: number; y: number }>): string {
  if (!coords.length) return '';
  if (coords.length === 1) return `M${coords[0]!.x},${coords[0]!.y}`;
  if (coords.length === 2) {
    return `M${coords[0]!.x},${coords[0]!.y} L${coords[1]!.x},${coords[1]!.y}`;
  }
  let d = `M${coords[0]!.x},${coords[0]!.y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Closed area under a smooth line down to baselineY. */
export function smoothAreaPath(coords: Array<{ x: number; y: number }>, baselineY: number): string {
  if (!coords.length) return '';
  const line = smoothLinePath(coords);
  const last = coords[coords.length - 1]!;
  const first = coords[0]!;
  return `${line} L${last.x},${baselineY} L${first.x},${baselineY} Z`;
}

export function clampPct(n: number, max = 100): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

/** Hex → rgba for soft chart glows / fills. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return `rgba(21, 204, 160, ${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Pepito-aligned motion palette (mint primary + soft multi-hue fills). */
export const MOTION_PALETTE = {
  mint: '#15cca0',
  mintDeep: '#0f9a78',
  purple: '#5c4d91',
  blue: '#0ba5f2',
  coral: '#fd961e',
  pink: '#ec4899',
  teal: '#14b8a6',
  track: '#e8edf5',
} as const;

export const MOTION_DUR_MS = {
  bar: 700,
  line: 900,
  area: 800,
  ring: 1000,
  gauge: 1100,
} as const;
