import { forwardRef, type RefAttributes } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * PetDate chats / هم‌بازی mark — speech bubble with a paw print inside.
 * Lucide-compatible so it slots into SiteNavItem like MessagesSquare.
 * Paths fill most of the 24×24 box so dock weight matches Wallet / Paw siblings
 * (no CSS scale — siteNav.selftest forbids transform scale).
 */
export const ChatPawIcon = forwardRef<SVGSVGElement, Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>>(
  (
    {
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      color = 'currentColor',
      className,
      ...rest
    },
    ref
  ) => {
    const sw =
      absoluteStrokeWidth && typeof size === 'number'
        ? (Number(strokeWidth) * 24) / size
        : strokeWidth;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
        {...rest}
      >
        {/* Larger bubble (≈ Lucide MessageCircle footprint) so stroke weight matches siblings. */}
        <path d="M3.4 4.2A3.2 3.2 0 0 1 6.6 1h10.8a3.2 3.2 0 0 1 3.2 3.2v7.4a3.2 3.2 0 0 1-3.2 3.2h-4.35L6.4 20.2v-4.4H6.6A3.2 3.2 0 0 1 3.4 12.6z" />
        <circle cx="9.1" cy="7.15" r="1.2" fill={color} stroke="none" />
        <circle cx="12" cy="5.95" r="1.3" fill={color} stroke="none" />
        <circle cx="14.9" cy="7.15" r="1.2" fill={color} stroke="none" />
        <ellipse cx="12" cy="10.55" rx="2.9" ry="2.25" fill={color} stroke="none" />
      </svg>
    );
  }
);

ChatPawIcon.displayName = 'ChatPawIcon';
