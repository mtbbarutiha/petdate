import { BRAND } from '@petdate/shared';
import { SITE_LOGO_SRC } from '../components/SiteLogo';

interface AdminWordmarkProps {
  className?: string;
  size?: 'md' | 'lg';
}

/**
 * Admin console brand — لوگو مادر (same asset as site header SiteLogo).
 * Collapsed sidebar uses the square mark crop from the mother logo.
 */
export function AdminWordmark({ className = '', size = 'md' }: AdminWordmarkProps) {
  const h = size === 'lg' ? 44 : 32;
  return (
    <div className={`admin-wordmark admin-wordmark--${size} ${className}`.trim()}>
      <img
        src={SITE_LOGO_SRC}
        alt={BRAND.displayNameFa}
        className="admin-wordmark-logo"
        height={h}
        style={{ height: h, width: 'auto', display: 'block' }}
        draggable={false}
      />
      <div className="admin-wordmark-copy">
        <span className="admin-wordmark-sub">Admin Console</span>
      </div>
      <img
        src="/brand/petdate-mark.png"
        alt=""
        aria-hidden
        className="admin-wordmark-collapsed-mark"
        width={40}
        height={40}
        draggable={false}
      />
    </div>
  );
}
