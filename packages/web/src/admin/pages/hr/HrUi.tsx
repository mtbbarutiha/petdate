/** Shared KPI + link cards for پیوند HR dashboards. */
import { Link } from 'react-router-dom';
import { formatNumFa, formatTomanFa } from '../../api';
import { tr } from '../../../i18n';

export function HrKpiGrid({ items }: { items: Array<{ label: string; value: string | number; tone?: string }> }) {
  return (
    <div className="admin-stats admin-stats--dense">
      {items.map((c) => (
        <div key={tr(c.label)} className={`admin-stat admin-stat--${c.tone || 'slate'}`}>
          <div>
            <div className="admin-stat-value">{typeof c.value === 'number' ? formatNumFa(c.value) : c.value}</div>
            <div className="admin-stat-label">{tr(c.label)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HrLinkGrid({ links }: { links: Array<{ to: string; label: string; sub?: string }> }) {
  return (
    <div className="admin-finance-links">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className="admin-card admin-finance-link">
          <div>
            <strong>{tr(l.label)}</strong>
            {l.sub ? <span>{l.sub}</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function formatHrMoney(n: number): string {
  return formatTomanFa(n);
}
