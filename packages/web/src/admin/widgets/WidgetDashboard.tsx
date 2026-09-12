import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { GripVertical, Plus, RotateCcw, X } from 'lucide-react';
import type {
  WidgetCatalogItem,
  WidgetColSpan,
  WidgetLayoutItem,
  WidgetRenderContext,
  WidgetRowSpan,
} from './types';
import { chartHeightForRow, donutSizeForRow } from './drill';
import { resizeOutwardDx } from './layoutStorage';
import { useWidgetLayout } from './useWidgetLayout';
import { tr } from '../../i18n';

type Props = {
  dashboardId: string;
  catalog: WidgetCatalogItem[];
  title?: string;
  renderWidget: (id: string, ctx: WidgetRenderContext) => ReactNode;
  toolbarExtra?: ReactNode;
};

const DRAG_THRESHOLD_PX = 4;

function clampCol(n: number): WidgetColSpan {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}

function clampRow(n: number): WidgetRowSpan {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

function tileIdFromPoint(clientX: number, clientY: number, skipId?: string | null): string | null {
  if (typeof document === 'undefined') return null;
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!(el instanceof Element)) continue;
    const tile = el.closest('[data-widget-id]');
    const id = tile?.getAttribute('data-widget-id');
    if (id && id !== skipId) return id;
  }
  return null;
}

function WidgetTile({
  item,
  title,
  group,
  dragging,
  dropTarget,
  onRemove,
  onResize,
  onReorderPointerDown,
  children,
}: {
  item: WidgetLayoutItem;
  title: string;
  group?: string;
  dragging: boolean;
  dropTarget: boolean;
  onRemove: () => void;
  onResize: (w: WidgetColSpan, h: WidgetRowSpan) => void;
  onReorderPointerDown: (e: ReactPointerEvent, id: string) => void;
  children: ReactNode;
}) {
  const tileRef = useRef<HTMLElement | null>(null);
  const resizing = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  const onResizePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizing.current = { startX: e.clientX, startY: e.clientY, w: item.w, h: item.h };
  };

  const onResizePointerMove = (e: ReactPointerEvent) => {
    if (!resizing.current || !tileRef.current) return;
    const board = tileRef.current.parentElement;
    if (!board) return;
    const boardW = board.clientWidth || 1;
    const colW = boardW / 4;
    const rtl = getComputedStyle(tileRef.current).direction === 'rtl';
    const dx = resizeOutwardDx(resizing.current.startX, e.clientX, rtl);
    const dy = e.clientY - resizing.current.startY;
    const nextW = clampCol(Math.round(resizing.current.w + dx / colW));
    const nextH = clampRow(Math.round(resizing.current.h + dy / 160));
    if (nextW !== item.w || nextH !== item.h) onResize(nextW, nextH);
  };

  const onResizePointerUp = (e: ReactPointerEvent) => {
    resizing.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const className = [
    `wdg-tile wdg-tile--w${item.w} wdg-tile--h${item.h}`,
    dragging ? 'wdg-tile--dragging' : '',
    dropTarget ? 'wdg-tile--drop-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={tileRef as React.RefObject<HTMLElement>}
      className={className}
      data-widget-id={item.id}
    >
      <header className="wdg-tile-head">
        {/*
          Non-<button> handle: HTML5 draggable on <button> is unreliable
          (Firefox/Safari often never fire dragstart). Pointer DnD below.
        */}
        <span
          className="wdg-drag"
          role="button"
          tabIndex={0}
          aria-label={tr("جابجایی ویجت")}
          title={tr("بگیرید و بکشید برای جابجایی")}
          onPointerDown={(e) => onReorderPointerDown(e, item.id)}
        >
          <GripVertical size={14} aria-hidden />
        </span>
        <div
          className="wdg-tile-titles wdg-tile-titles--drag"
          title={tr("بگیرید و بکشید برای جابجایی")}
          onPointerDown={(e) => onReorderPointerDown(e, item.id)}
        >
          {group ? <span className="wdg-tile-group">{group}</span> : null}
          <h3>{title}</h3>
        </div>
        <div className="wdg-tile-actions">
          <button type="button" className="wdg-icon-btn" onClick={onRemove} aria-label={tr("حذف ویجت")} title={tr("حذف از داشبورد")}>
            <X size={14} />
          </button>
        </div>
      </header>
      <div className="wdg-tile-body">{children}</div>
      <div
        className="wdg-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        title={tr("تغییر اندازه")}
        aria-hidden
      />
    </article>
  );
}

export function WidgetDashboard({
  dashboardId,
  catalog,
  title = 'ویجت‌های داشبورد',
  renderWidget,
  toolbarExtra,
}: Props) {
  const { visible, availableToAdd, reorder, resize, remove, add, reset, persistStatus } = useWidgetLayout(
    dashboardId,
    catalog,
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const dragSession = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    target: HTMLElement;
  } | null>(null);

  const catalogById = useCallback((id: string) => catalog.find((c) => c.id === id), [catalog]);

  const endDrag = useCallback(
    (clientX: number, clientY: number) => {
      const session = dragSession.current;
      dragSession.current = null;
      const from = session?.id ?? null;
      const to =
        from && session?.active ? tileIdFromPoint(clientX, clientY, from) : null;
      setDraggingId(null);
      setOverId(null);
      if (from && to && from !== to) reorder(from, to);
    },
    [reorder],
  );

  const onReorderPointerDown = useCallback((e: ReactPointerEvent, id: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragSession.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      target,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = dragSession.current;
      if (!session || session.pointerId !== e.pointerId) return;
      const dx = e.clientX - session.startX;
      const dy = e.clientY - session.startY;
      if (!session.active) {
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        session.active = true;
        setDraggingId(session.id);
      }
      e.preventDefault();
      const hit = tileIdFromPoint(e.clientX, e.clientY, session.id);
      setOverId(hit);
    };
    const onUp = (e: PointerEvent) => {
      const session = dragSession.current;
      if (!session || session.pointerId !== e.pointerId) return;
      try {
        session.target.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      endDrag(e.clientX, e.clientY);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !dragSession.current) return;
      dragSession.current = null;
      setDraggingId(null);
      setOverId(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [endDrag]);

  return (
    <section className="wdg-board" aria-label={title}>
      <div className="wdg-toolbar">
        <div className="wdg-toolbar-start">
          <p className="admin-section-label" style={{ margin: 0 }}>
            {title}
          </p>
          <span className="wdg-toolbar-hint">
            {tr('دستگیره ⋮⋮ یا عنوان · تغییر اندازه گوشه · چیدمان برای حساب شما ذخیره می‌شود')}
          </span>
        </div>
        <div className="wdg-toolbar-end">
          {toolbarExtra}
          <span className="wdg-persist" data-status={persistStatus} title={tr('همگام با حساب ادمین')}>
            {persistStatus === 'saving'
              ? tr('در حال ذخیره…')
              : persistStatus === 'error'
                ? tr('چیدمان روی سرور ذخیره نشد — روی همین دستگاه مانده')
                : persistStatus === 'saved'
                  ? tr('ذخیره شد')
                  : tr('همگام با حساب ادمین')}
          </span>
          <button type="button" className="admin-btn admin-btn--ghost wdg-toolbar-btn" onClick={() => setCatalogOpen((v) => !v)}>
            <Plus size={14} /> {tr('افزودن ویجت')}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost wdg-toolbar-btn" onClick={reset} title={tr("بازگردانی چیدمان پیش‌فرض")}>
            <RotateCcw size={14} /> {tr('پیش‌فرض')}
          </button>
        </div>
      </div>

      {catalogOpen ? (
        <div className="wdg-catalog" role="dialog" aria-label={tr("کاتالوگ ویجت")}>
          {availableToAdd.length ? (
            availableToAdd.map((c) => (
              <button
                key={c.id}
                type="button"
                className="wdg-catalog-item"
                onClick={() => {
                  add(c.id);
                  setCatalogOpen(false);
                }}
              >
                <strong>{tr(c.title)}</strong>
                <span>{tr(c.group)}</span>
                {c.description ? <em>{tr(c.description)}</em> : null}
              </button>
            ))
          ) : (
            <p className="admin-muted">{tr('همهٔ ویجت‌ها روی داشبورد هستند')}</p>
          )}
        </div>
      ) : null}

      <div className={`wdg-grid${draggingId ? ' wdg-grid--reordering' : ''}`}>
        {visible.map((item) => {
          const meta = catalogById(item.id);
          const ctx: WidgetRenderContext = {
            w: item.w,
            h: item.h,
            chartHeight: chartHeightForRow(item.h),
            donutSize: donutSizeForRow(item.h),
          };
          return (
            <WidgetTile
              key={item.id}
              item={item}
              title={tr(meta?.title || item.id)}
              group={meta?.group ? tr(meta.group) : undefined}
              dragging={draggingId === item.id}
              dropTarget={overId === item.id}
              onRemove={() => remove(item.id)}
              onResize={(w, h) => resize(item.id, { w, h })}
              onReorderPointerDown={onReorderPointerDown}
            >
              {renderWidget(item.id, ctx)}
            </WidgetTile>
          );
        })}
      </div>

      {!visible.length ? (
        <p className="admin-muted wdg-empty">{tr('ویجتی نیست — از «افزودن ویجت» یک نمودار انتخاب کنید.')}</p>
      ) : null}
    </section>
  );
}
