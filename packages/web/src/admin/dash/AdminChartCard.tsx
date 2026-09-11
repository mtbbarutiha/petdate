import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  subtitle?: ReactNode;
  href?: string;
  hrefLabel?: string;
  /** Chart / widget body. When empty=true, shows empty state instead. */
  children?: ReactNode;
  empty?: boolean;
  emptyHint?: string;
  height?: number | string;
  className?: string;
  /** Wrap Recharts horizontal bars — applies RTL-safe LTR island class. */
  rtlHBars?: boolean;
};

/**
 * Soft Pepito chart card with consistent head + empty state.
 * Prefer wrapping existing Widget* / Recharts charts — no new chart libs.
 */
export function AdminChartCard({
  title,
  subtitle,
  href,
  hrefLabel = 'جزئیات',
  children,
  empty,
  emptyHint = 'داده‌ای برای نمودار نیست',
  height,
  className,
  rtlHBars,
}: Props) {
  const showEmpty = empty || children == null;
  return (
    <article className={`admin-card admin-dash-chart${className ? ` ${className}` : ''}`}>
      <div className="admin-card-head admin-dash-chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <span className="admin-muted">{subtitle}</span> : null}
        </div>
        {href ? (
          <Link to={href} className="admin-dash-chart-link">
            {hrefLabel}
          </Link>
        ) : null}
      </div>
      <div
        className={[
          'admin-dash-chart-body',
          rtlHBars ? 'admin-recharts-rtl-hbars' : '',
          showEmpty ? 'admin-dash-chart-body--empty' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        dir={rtlHBars ? 'ltr' : undefined}
        style={height != null ? { minHeight: height } : undefined}
      >
        {showEmpty ? (
          <p className="admin-dash-chart-empty">{emptyHint}</p>
        ) : (
          children
        )}
      </div>
    </article>
  );
}

type GridProps = {
  children: ReactNode;
  cols?: 2 | 3;
  className?: string;
};

export function AdminChartGrid({ children, cols = 2, className }: GridProps) {
  return (
    <div
      className={`admin-dash-chart-grid admin-dash-chart-grid--${cols}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
