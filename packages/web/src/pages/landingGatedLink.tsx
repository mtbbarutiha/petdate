import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { loginPath } from '../lib/authRedirect';

/** Gate app destinations behind login / complete profile; keep shop, vet, adoption public. */
export function GatedLink({
  to,
  className,
  style,
  children,
  'data-testid': dataTestId,
}: {
  to: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  'data-testid'?: string;
}) {
  const { isLoggedIn, hasRole, isProfileComplete } = useAuthStore();
  const ready = isLoggedIn && hasRole && isProfileComplete;
  const publicDest =
    to === '/vet-consult' ||
    to.startsWith('/vet-consult') ||
    to === '/shop' ||
    to.startsWith('/shop/') ||
    to === '/adoption' ||
    to.startsWith('/adoption/');
  const onboardingDest = to === '/onboarding/role' || to.startsWith('/onboarding/');
  const href = onboardingDest
    ? isLoggedIn
      ? to
      : loginPath(to)
    : ready || publicDest
      ? to
      : loginPath(to);
  return (
    <Link to={href} className={className} style={style} data-testid={dataTestId}>
      {children}
    </Link>
  );
}

export function PawIcon() {
  return (
    <span className="pepito-btn-icon" aria-hidden>
      <i className="flaticon-pawprint-4" />
    </span>
  );
}
