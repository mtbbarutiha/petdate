import { Link } from 'react-router-dom';
import type { ShopBreadcrumbItem } from '../../lib/shopBreadcrumb';

type Props = {
  items: ShopBreadcrumbItem[];
  className?: string;
};

/**
 * DigiKala-style RTL shop breadcrumb: muted text, slash separators,
 * linked ancestors, aria-current on the leaf.
 */
export function ShopBreadcrumb({ items, className }: Props) {
  if (!items.length) return null;

  return (
    <nav
      className={['pd-shop-breadcrumb', className].filter(Boolean).join(' ')}
      aria-label="breadcrumb"
    >
      <ol className="pd-shop-breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showLink = Boolean(item.to) && !isLast;
          return (
            <li key={`${item.label}-${index}`} className="pd-shop-breadcrumb-item">
              {index > 0 ? (
                <span className="pd-shop-breadcrumb-sep" aria-hidden>
                  /
                </span>
              ) : null}
              {showLink ? (
                <Link to={item.to!} className="pd-shop-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span
                  className="pd-shop-breadcrumb-current"
                  {...(isLast ? { 'aria-current': 'page' as const } : {})}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
