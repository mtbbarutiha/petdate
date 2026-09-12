import { Link } from 'react-router-dom';
import type { AdminKpiItem } from './types';
import { tr } from '../../i18n';

type CardProps = AdminKpiItem & { className?: string };

export function AdminKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
  to,
  wide,
  className,
}: CardProps) {
  const body = (
    <>
      {Icon ? (
        <div className="admin-dash-kpi-icon" aria-hidden>
          <Icon size={18} />
        </div>
      ) : null}
      <div className="admin-dash-kpi-body">
        <div className="admin-dash-kpi-value">{value}</div>
        <div className="admin-dash-kpi-label">{tr(label)}</div>
        {hint ? <div className="admin-dash-kpi-hint">{typeof hint === 'string' ? tr(hint) : hint}</div> : null}
      </div>
    </>
  );

  const cls = [
    'admin-dash-kpi',
    `admin-dash-kpi--${tone}`,
    wide ? 'admin-dash-kpi--wide' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={cls} style={{ textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    );
  }
  return (
    <article className={cls}>
      {body}
    </article>
  );
}

type StripProps = {
  items: AdminKpiItem[];
  ariaLabel?: string;
  dense?: boolean;
};

/** Compact Pepito KPI strip — soft tinted cards, mint/violet/orange accents. */
export function AdminKpiStrip({ items, ariaLabel = 'شاخص‌ها', dense }: StripProps) {
  if (!items.length) return null;
  return (
    <div
      className={`admin-dash-kpi-strip${dense ? ' admin-dash-kpi-strip--dense' : ''}`}
      role="list"
      aria-label={tr(ariaLabel)}
    >
      {items.map((item) => (
        <AdminKpiCard key={item.key || String(item.label)} {...item} />
      ))}
    </div>
  );
}
