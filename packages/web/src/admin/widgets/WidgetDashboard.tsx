import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
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
import { useWidgetLayout } from './useWidgetLayout';

type Props = {
  dashboardId: string;
  catalog: WidgetCatalogItem[];
  title?: string;
  renderWidget: (id: string, ctx: WidgetRenderContext) => ReactNode;
  toolbarExtra?: ReactNode;
};

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

function WidgetTile({
  item,
  title,
  group,
  onRemove,
  onResize,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  item: WidgetLayoutItem;
  title: string;
  group?: string;
  onRemove: () => void;
  onResize: (w: WidgetColSpan, h: WidgetRowSpan) => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
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
    const dx = resizing.current.startX - e.clientX;
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

  return (
    <article
      ref={tileRef as React.RefObject<HTMLElement>}
      className={`wdg-tile wdg-tile--w${item.w} wdg-tile--h${item.h}`}
      style={{ gridColumn: `span ${item.w}` }}
      data-widget-id={item.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className="wdg-tile-head">
        <button
          type="button"
          className="wdg-drag"
          draggable
          onDragStart={onDragStart}
          aria-label="جابجایی ویجت"
          title="کشیدن برای جابجایی"
        >
          <GripVertical size={14} />
        </button>
        <div className="wdg-tile-titles">
          {group ? <span className="wdg-tile-group">{group}</span> : null}
          <h3>{title}</h3>
        </div>
        <div className="wdg-tile-actions">
          <button type="button" className="wdg-icon-btn" onClick={onRemove} aria-label="حذف ویجت" title="حذف از داشبورد">
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
        title="تغییر اندازه"
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
  const { visible, availableToAdd, reorder, resize, remove, add, reset } = useWidgetLayout(dashboardId, catalog);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const dragId = useRef<string | null>(null);

  const catalogById = useCallback((id: string) => catalog.find((c) => c.id === id), [catalog]);

  const onDragStart = (id: string) => (e: DragEvent) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (toId: string) => (e: DragEvent) => {
    e.preventDefault();
    const from = dragId.current || e.dataTransfer.getData('text/plain');
    dragId.current = null;
    if (from) reorder(from, toId);
  };

  return (
    <section className="wdg-board" aria-label={title}>
      <div className="wdg-toolbar">
        <div className="wdg-toolbar-start">
          <p className="admin-section-label" style={{ margin: 0 }}>
            {title}
          </p>
          <span className="wdg-toolbar-hint">کشیدن · تغییر اندازه · دریل‌دان / دریل‌آپ</span>
        </div>
        <div className="wdg-toolbar-end">
          {toolbarExtra}
          <button type="button" className="admin-btn admin-btn--ghost wdg-toolbar-btn" onClick={() => setCatalogOpen((v) => !v)}>
            <Plus size={14} /> افزودن ویجت
          </button>
          <button type="button" className="admin-btn admin-btn--ghost wdg-toolbar-btn" onClick={reset} title="بازگردانی چیدمان پیش‌فرض">
            <RotateCcw size={14} /> پیش‌فرض
          </button>
        </div>
      </div>

      {catalogOpen ? (
        <div className="wdg-catalog" role="dialog" aria-label="کاتالوگ ویجت">
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
                <strong>{c.title}</strong>
                <span>{c.group}</span>
                {c.description ? <em>{c.description}</em> : null}
              </button>
            ))
          ) : (
            <p className="admin-muted">همهٔ ویجت‌ها روی داشبورد هستند</p>
          )}
        </div>
      ) : null}

      <div className="wdg-grid">
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
              title={meta?.title || item.id}
              group={meta?.group}
              onRemove={() => remove(item.id)}
              onResize={(w, h) => resize(item.id, { w, h })}
              onDragStart={onDragStart(item.id)}
              onDragOver={onDragOver}
              onDrop={onDrop(item.id)}
            >
              {renderWidget(item.id, ctx)}
            </WidgetTile>
          );
        })}
      </div>

      {!visible.length ? (
        <p className="admin-muted wdg-empty">ویجتی نیست — از «افزودن ویجت» یک نمودار انتخاب کنید.</p>
      ) : null}
    </section>
  );
}
