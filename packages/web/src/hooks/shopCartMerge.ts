/** Client cart sync helpers — keep in-flight local adds when a stale server snapshot lands. */

export type ShopCartLine = { productId: string; qty: number };

export function normalizeClientCartLines(lines: ShopCartLine[]): ShopCartLine[] {
  const map = new Map<string, number>();
  for (const line of lines) {
    const productId = String(line?.productId || '').trim();
    const qty = Math.floor(Number(line?.qty) || 0);
    if (!productId || qty <= 0) continue;
    map.set(productId, Math.min(99, (map.get(productId) ?? 0) + qty));
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

/**
 * Union server ∪ local by productId, keeping the higher qty.
 * Used when a boot/focus GET /cart returns before POST /cart/items lands —
 * replace-with-server would wipe rows the user just added (toast already shown).
 */
export function mergeCartLinesKeepLocal(server: ShopCartLine[], local: ShopCartLine[]): ShopCartLine[] {
  const map = new Map<string, number>();
  for (const line of [...normalizeClientCartLines(server), ...normalizeClientCartLines(local)]) {
    map.set(line.productId, Math.max(map.get(line.productId) ?? 0, line.qty));
  }
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty }));
}

/** True when local has a product or a higher qty that the server snapshot lacks. */
export function localCartIsAhead(server: ShopCartLine[], local: ShopCartLine[]): boolean {
  const serverMap = new Map(normalizeClientCartLines(server).map((l) => [l.productId, l.qty]));
  for (const line of normalizeClientCartLines(local)) {
    const remote = serverMap.get(line.productId) ?? 0;
    if (line.qty > remote) return true;
  }
  return false;
}
