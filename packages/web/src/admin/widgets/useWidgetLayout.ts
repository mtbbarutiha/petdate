import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminDisplayName, getAdminRole } from '../auth';
import { getAdminUsername } from '../api';
import type { WidgetBoardState, WidgetCatalogItem, WidgetLayoutItem } from './types';
import {
  addItem,
  clearBoard,
  isDefaultBoard,
  layoutPrefKey,
  loadBoard,
  normalizeBoard,
  removeItem,
  reorderItems,
  resetBoard,
  resizeItem,
  resolveHydratedBoard,
  saveBoard,
} from './layoutStorage';
import { deleteAdminPref, fetchAdminPref, putAdminPref } from './adminPrefs';

export type WidgetPersistStatus = 'local' | 'saving' | 'saved' | 'error';

export function useWidgetUserKey(): string {
  return useMemo(() => getAdminUsername() || getAdminDisplayName() || getAdminRole() || 'anon', []);
}

export function useWidgetLayout(dashboardId: string, catalog: WidgetCatalogItem[]) {
  const userKey = useWidgetUserKey();
  const catalogKey = catalog.map((c) => c.id).join(',');
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;

  const [board, setBoard] = useState<WidgetBoardState>(() => loadBoard(dashboardId, userKey, catalog));
  const [hydrated, setHydrated] = useState(false);
  const [persistStatus, setPersistStatus] = useState<WidgetPersistStatus>('local');
  const dirtyRef = useRef(false);
  const lastSyncedRef = useRef('');

  useEffect(() => {
    setBoard((prev) => normalizeBoard(prev, catalogRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardId, userKey, catalogKey]);

  useEffect(() => {
    saveBoard(dashboardId, userKey, board);
  }, [board, dashboardId, userKey]);

  useEffect(() => {
    let cancelled = false;
    dirtyRef.current = false;
    setHydrated(false);
    setPersistStatus('local');
    const cat = catalogRef.current;
    const local = loadBoard(dashboardId, userKey, cat);
    void (async () => {
      try {
        const remote = await fetchAdminPref(layoutPrefKey(dashboardId));
        if (cancelled) return;
        const resolved = resolveHydratedBoard(local, remote, cat);
        if (!dirtyRef.current) {
          setBoard(resolved.board);
          lastSyncedRef.current = JSON.stringify(resolved.board);
        }
        if (resolved.uploadLocal) {
          try {
            await putAdminPref(layoutPrefKey(dashboardId), resolved.board);
            lastSyncedRef.current = JSON.stringify(resolved.board);
          } catch {
            /* local remains the fallback */
          }
        }
        setPersistStatus(resolved.source === 'remote' || resolved.uploadLocal ? 'saved' : 'local');
      } catch {
        if (!cancelled) setPersistStatus('local');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardId, userKey, catalogKey]);

  useEffect(() => {
    if (!hydrated) return;
    const snap = JSON.stringify(board);
    if (snap === lastSyncedRef.current) return;
    const cat = catalogRef.current;
    const t = window.setTimeout(() => {
      const key = layoutPrefKey(dashboardId);
      setPersistStatus('saving');
      const op = isDefaultBoard(board, cat)
        ? deleteAdminPref(key)
        : putAdminPref(key, board);
      void op
        .then(() => {
          lastSyncedRef.current = snap;
          setPersistStatus('saved');
        })
        .catch(() => setPersistStatus('error'));
    }, 450);
    return () => window.clearTimeout(t);
  }, [board, dashboardId, hydrated]);

  const visible = useMemo(() => [...board.items].sort((a, b) => a.order - b.order), [board.items]);

  const availableToAdd = useMemo(() => {
    const present = new Set(board.items.map((i) => i.id));
    return catalog.filter((c) => !present.has(c.id));
  }, [board.items, catalog]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const reorder = useCallback((fromId: string, toId: string) => {
    markDirty();
    setBoard((prev) => ({ ...prev, items: reorderItems(prev.items, fromId, toId) }));
  }, []);

  const resize = useCallback((id: string, patch: Partial<Pick<WidgetLayoutItem, 'w' | 'h'>>) => {
    markDirty();
    setBoard((prev) => ({ ...prev, items: resizeItem(prev.items, id, patch) }));
  }, []);

  const remove = useCallback((id: string) => {
    markDirty();
    setBoard((prev) => removeItem(prev, id));
  }, []);

  const add = useCallback(
    (id: string) => {
      const cat = catalog.find((c) => c.id === id);
      if (!cat) return;
      markDirty();
      setBoard((prev) => addItem(prev, cat));
    },
    [catalog],
  );

  const reset = useCallback(() => {
    markDirty();
    const next = resetBoard(catalog);
    setBoard(next);
    clearBoard(dashboardId, userKey);
    void deleteAdminPref(layoutPrefKey(dashboardId)).catch(() => {
      /* keep default locally */
    });
  }, [catalog, dashboardId, userKey]);

  return {
    board,
    visible,
    availableToAdd,
    reorder,
    resize,
    remove,
    add,
    reset,
    userKey,
    persistStatus,
    hydrated,
  };
}
