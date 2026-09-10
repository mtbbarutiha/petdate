import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminDisplayName, getAdminRole } from '../auth';
import { getAdminUsername } from '../api';
import type { WidgetBoardState, WidgetCatalogItem, WidgetLayoutItem } from './types';
import {
  addItem,
  loadBoard,
  normalizeBoard,
  removeItem,
  reorderItems,
  resetBoard,
  resizeItem,
  saveBoard,
} from './layoutStorage';

export function useWidgetUserKey(): string {
  return useMemo(() => getAdminUsername() || getAdminDisplayName() || getAdminRole() || 'anon', []);
}

export function useWidgetLayout(dashboardId: string, catalog: WidgetCatalogItem[]) {
  const userKey = useWidgetUserKey();
  const catalogKey = catalog.map((c) => c.id).join(',');

  const [board, setBoard] = useState<WidgetBoardState>(() => loadBoard(dashboardId, userKey, catalog));

  useEffect(() => {
    setBoard((prev) => normalizeBoard(prev, catalog));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, userKey, catalogKey]);

  useEffect(() => {
    saveBoard(dashboardId, userKey, board);
  }, [board, dashboardId, userKey]);

  const visible = useMemo(() => [...board.items].sort((a, b) => a.order - b.order), [board.items]);

  const availableToAdd = useMemo(() => {
    const present = new Set(board.items.map((i) => i.id));
    return catalog.filter((c) => !present.has(c.id));
  }, [board.items, catalog]);

  const reorder = useCallback((fromId: string, toId: string) => {
    setBoard((prev) => ({ ...prev, items: reorderItems(prev.items, fromId, toId) }));
  }, []);

  const resize = useCallback((id: string, patch: Partial<Pick<WidgetLayoutItem, 'w' | 'h'>>) => {
    setBoard((prev) => ({ ...prev, items: resizeItem(prev.items, id, patch) }));
  }, []);

  const remove = useCallback((id: string) => {
    setBoard((prev) => removeItem(prev, id));
  }, []);

  const add = useCallback(
    (id: string) => {
      const cat = catalog.find((c) => c.id === id);
      if (!cat) return;
      setBoard((prev) => addItem(prev, cat));
    },
    [catalog],
  );

  const reset = useCallback(() => {
    setBoard(resetBoard(catalog));
  }, [catalog]);

  return { board, visible, availableToAdd, reorder, resize, remove, add, reset, userKey };
}
