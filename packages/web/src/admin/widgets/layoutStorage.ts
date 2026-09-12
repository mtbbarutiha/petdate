import type { WidgetBoardState, WidgetCatalogItem, WidgetLayoutItem } from './types';

const VERSION = 1 as const;

export function storageKeyFor(dashboardId: string, userKey: string): string {
  const safeUser = (userKey || 'anon').replace(/[^\w.@+-]/g, '_').slice(0, 64);
  return `petdate_admin_widgets:v1:${safeUser}:${dashboardId}`;
}

export function defaultBoard(catalog: WidgetCatalogItem[]): WidgetBoardState {
  return {
    version: VERSION,
    removed: [],
    items: catalog.map((c, i) => ({
      id: c.id,
      w: c.defaultW ?? 2,
      h: c.defaultH ?? 1,
      order: i,
    })),
  };
}

export function normalizeBoard(raw: unknown, catalog: WidgetCatalogItem[]): WidgetBoardState {
  const fallback = defaultBoard(catalog);
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Partial<WidgetBoardState>;
  if (obj.version !== 1 || !Array.isArray(obj.items)) return fallback;

  const catalogIds = new Set(catalog.map((c) => c.id));
  const removed = Array.isArray(obj.removed)
    ? obj.removed.filter((id): id is string => typeof id === 'string' && catalogIds.has(id))
    : [];
  const removedSet = new Set(removed);

  const seen = new Set<string>();
  const items: WidgetLayoutItem[] = [];
  for (const it of obj.items) {
    if (!it || typeof it !== 'object') continue;
    const id = String((it as WidgetLayoutItem).id || '');
    if (!catalogIds.has(id) || seen.has(id) || removedSet.has(id)) continue;
    seen.add(id);
    const w = Number((it as WidgetLayoutItem).w);
    const h = Number((it as WidgetLayoutItem).h);
    items.push({
      id,
      w: (w === 1 || w === 2 || w === 3 || w === 4 ? w : 2) as WidgetLayoutItem['w'],
      h: (h === 1 || h === 2 || h === 3 ? h : 1) as WidgetLayoutItem['h'],
      order: items.length,
    });
  }

  for (const c of catalog) {
    if (seen.has(c.id) || removedSet.has(c.id)) continue;
    items.push({
      id: c.id,
      w: c.defaultW ?? 2,
      h: c.defaultH ?? 1,
      order: items.length,
    });
  }

  items.forEach((it, i) => {
    it.order = i;
  });
  return { version: VERSION, items, removed };
}

export function loadBoard(
  dashboardId: string,
  userKey: string,
  catalog: WidgetCatalogItem[],
): WidgetBoardState {
  if (typeof localStorage === 'undefined') return defaultBoard(catalog);
  try {
    const raw = localStorage.getItem(storageKeyFor(dashboardId, userKey));
    if (!raw) return defaultBoard(catalog);
    return normalizeBoard(JSON.parse(raw), catalog);
  } catch {
    return defaultBoard(catalog);
  }
}

export function saveBoard(dashboardId: string, userKey: string, board: WidgetBoardState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKeyFor(dashboardId, userKey), JSON.stringify(board));
  } catch {
    /* quota */
  }
}

export function reorderItems(items: WidgetLayoutItem[], fromId: string, toId: string): WidgetLayoutItem[] {
  if (fromId === toId) return items;
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const fromIdx = sorted.findIndex((i) => i.id === fromId);
  const toIdx = sorted.findIndex((i) => i.id === toId);
  if (fromIdx < 0 || toIdx < 0) return items;
  const [moved] = sorted.splice(fromIdx, 1);
  sorted.splice(toIdx, 0, moved!);
  return sorted.map((it, i) => ({ ...it, order: i }));
}

export function resizeItem(
  items: WidgetLayoutItem[],
  id: string,
  patch: Partial<Pick<WidgetLayoutItem, 'w' | 'h'>>,
): WidgetLayoutItem[] {
  return items.map((it) => {
    if (it.id !== id) return it;
    const w = patch.w ?? it.w;
    const h = patch.h ?? it.h;
    return {
      ...it,
      w: (w === 1 || w === 2 || w === 3 || w === 4 ? w : it.w) as WidgetLayoutItem['w'],
      h: (h === 1 || h === 2 || h === 3 ? h : it.h) as WidgetLayoutItem['h'],
    };
  });
}

export function removeItem(board: WidgetBoardState, id: string): WidgetBoardState {
  const items = board.items.filter((i) => i.id !== id).map((it, i) => ({ ...it, order: i }));
  const removed = board.removed.includes(id) ? board.removed : [...board.removed, id];
  return { ...board, items, removed };
}

export function addItem(board: WidgetBoardState, catalogItem: WidgetCatalogItem): WidgetBoardState {
  if (board.items.some((i) => i.id === catalogItem.id)) return board;
  const items = [
    ...board.items,
    {
      id: catalogItem.id,
      w: catalogItem.defaultW ?? 2,
      h: catalogItem.defaultH ?? 1,
      order: board.items.length,
    },
  ].map((it, i) => ({ ...it, order: i }));
  return { ...board, items, removed: board.removed.filter((id) => id !== catalogItem.id) };
}

export function resetBoard(catalog: WidgetCatalogItem[]): WidgetBoardState {
  return defaultBoard(catalog);
}

export function layoutPrefKey(dashboardId: string): string {
  const id = String(dashboardId || '')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 48);
  return `widget-layout:${id || 'board'}`;
}

export function parseRemoteBoard(raw: unknown): WidgetBoardState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<WidgetBoardState>;
  if (obj.version !== 1 || !Array.isArray(obj.items)) return null;
  return obj as WidgetBoardState;
}

export function isDefaultBoard(board: WidgetBoardState, catalog: WidgetCatalogItem[]): boolean {
  const def = defaultBoard(catalog);
  if (board.removed.length) return false;
  if (board.items.length !== def.items.length) return false;
  return board.items.every((it, i) => {
    const d = def.items[i];
    return Boolean(d && it.id === d.id && it.w === d.w && it.h === d.h);
  });
}

export function resolveHydratedBoard(
  local: WidgetBoardState,
  remoteRaw: unknown,
  catalog: WidgetCatalogItem[],
): { board: WidgetBoardState; uploadLocal: boolean; source: 'remote' | 'local' | 'default' } {
  const parsed = parseRemoteBoard(remoteRaw);
  if (parsed) {
    return { board: normalizeBoard(parsed, catalog), uploadLocal: false, source: 'remote' };
  }
  const localNorm = normalizeBoard(local, catalog);
  if (!isDefaultBoard(localNorm, catalog)) {
    return { board: localNorm, uploadLocal: true, source: 'local' };
  }
  return { board: localNorm, uploadLocal: false, source: 'default' };
}

export function clearBoard(dashboardId: string, userKey: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKeyFor(dashboardId, userKey));
  } catch {
    /* ignore */
  }
}
