/** Shared Finance OS UI helpers — Pepito light RTL. */
import { useState } from 'react';
import { formatNumFa, formatTomanFa } from '../../api';
import { tr } from '../../../i18n';

export function formatMoney(n: number): string {
  return formatTomanFa(n);
}

export function formatSignedMoney(n: number): string {
  const abs = formatTomanFa(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export function FinanceEditToggle({
  editMode,
  onChange,
}: {
  editMode: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`admin-btn ${editMode ? 'admin-btn--primary' : 'admin-btn--ghost'}`}
      onClick={() => onChange(!editMode)}
      title={editMode ? tr('خروج از حالت ویرایش') : tr('ورود به حالت ویرایش')}
    >
      {editMode ? tr('حالت ویرایش') : tr('حالت مشاهده')}
    </button>
  );
}

export function FinanceTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; badge?: number }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="admin-tabs" style={{ marginBottom: 16 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`admin-tab${value === t.id ? ' is-on' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {tr(t.label)}
          {typeof t.badge === 'number' && t.badge > 0 ? (
            <span className="admin-badge" style={{ marginInlineStart: 6 }}>
              {formatNumFa(t.badge)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function useFinanceEditMode(canWrite: boolean) {
  const [editMode, setEditMode] = useState(false);
  return {
    editMode: canWrite && editMode,
    setEditMode: (v: boolean) => setEditMode(canWrite ? v : false),
  };
}

export function flattenCategoryTree(
  nodes: Array<{ name: string; children?: Array<{ name: string; children?: unknown[] }> }>,
  prefix: string[] = []
): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    const path = prefix.concat([n.name]);
    if (!n.children || !n.children.length) out.push(path.join(' ← '));
    else out.push(...flattenCategoryTree(n.children as typeof nodes, path));
  }
  return out;
}
