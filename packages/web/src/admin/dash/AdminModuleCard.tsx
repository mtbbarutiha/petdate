import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AdminModuleCardProps } from './types';
import { tr } from '../../i18n';

export function AdminModuleCard({
  title,
  to,
  icon: Icon,
  tone = 'slate',
  items,
  openLabel = 'باز کردن',
}: AdminModuleCardProps) {
  return (
    <Link to={to} className={`admin-dash-module admin-dash-module--${tone}`}>
      <div className="admin-dash-module-head">
        {Icon ? <Icon size={18} aria-hidden /> : null}
        <strong>{title}</strong>
        <span>{openLabel}</span>
      </div>
      <div className="admin-dash-module-body">
        {items.map((it) => (
          <div key={String(it.label)}>
            <em>{it.value}</em>
            <span>{tr(it.label)}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

type GridProps = {
  children: ReactNode;
  label?: string;
};

export function AdminModuleGrid({ children, label }: GridProps) {
  return (
    <>
      {label ? <p className="admin-section-label">{label}</p> : null}
      <div className="admin-dash-module-grid">{children}</div>
    </>
  );
}
