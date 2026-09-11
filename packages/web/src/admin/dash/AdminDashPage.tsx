import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: ReactNode;
  live?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  tabs?: ReactNode;
  error?: string | null;
  children?: ReactNode;
  className?: string;
};

/**
 * Shared executive-dashboard shell (Pepito scale):
 * title + live pulse + refresh / actions, optional filters slot, children.
 */
export function AdminDashPage({
  title,
  subtitle,
  live = false,
  onRefresh,
  refreshLabel = 'بروزرسانی',
  actions,
  filters,
  tabs,
  error,
  children,
  className,
}: Props) {
  return (
    <div className={`admin-page admin-page--exec admin-dash-page${className ? ` ${className}` : ''}`}>
      <header className="admin-header admin-dash-header">
        <div className="admin-dash-header-copy">
          <h1>{title}</h1>
          {subtitle ? (
            <p>
              {live ? <span className="admin-live-pulse">زنده</span> : null}
              {live ? ' ' : null}
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="admin-header-actions admin-dash-header-actions">
          {actions}
          {onRefresh ? (
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onRefresh}>
              <RefreshCw size={16} aria-hidden />
              {refreshLabel}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="admin-error">{error}</p> : null}
      {tabs}
      {filters ? <div className="admin-dash-filters-slot">{filters}</div> : null}
      {children}
    </div>
  );
}
