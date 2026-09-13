/** Wrap gallery index for slider / lightbox arrows. */
export function stepShopGalleryIndex(index: number, length: number, delta: number): number {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  const d = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((i + d) % length + length) % length;
}
