import { forwardRef, type RefAttributes } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * PetDate chats / هم‌بازی mark — speech bubble with a paw print inside.
 * Lucide-compatible so it slots into SiteNavItem like MessagesSquare.
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
        {/* Rounded chat bubble with tail */}
        <path d="M5.25 4.6A2.85 2.85 0 0 1 8.1 1.75h7.8a2.85 2.85 0 0 1 2.85 2.85v6.3a2.85 2.85 0 0 1-2.85 2.85h-3.55L8.2 17.8v-3.2H8.1A2.85 2.85 0 0 1 5.25 11.75z" />
        {/* Paw pads — filled for clarity at dock size */}
        <circle cx="9.55" cy="6.85" r="1.05" fill={color} stroke="none" />
        <circle cx="12" cy="5.85" r="1.15" fill={color} stroke="none" />
        <circle cx="14.45" cy="6.85" r="1.05" fill={color} stroke="none" />
        <ellipse cx="12" cy="9.95" rx="2.55" ry="2.05" fill={color} stroke="none" />
      </svg>
    );
  }
);

ChatPawIcon.displayName = 'ChatPawIcon';
