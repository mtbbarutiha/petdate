import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';

/**
 * Desktop header wallet entry — icon + label linking to /wallet.
 * Balances live on the Wallet page (header chip no longer shows amounts).
 * Hidden on mobile via CSS; bottom dock covers wallet there.
 */
export function WalletChip() {
  const { isLoggedIn, user } = useAuthStore();

  if (!isLoggedIn || !user) return null;

  return (
    <div className="pepito-nav-wallet">
      <Link to="/wallet" className="pepito-nav-wallet-btn" aria-label="کیف پول">
        <span className="pepito-nav-wallet-mark" aria-hidden>
          <Wallet size={14} strokeWidth={2.35} absoluteStrokeWidth />
        </span>
        <span className="pepito-nav-wallet-label">کیف پول</span>
      </Link>
    </div>
  );
}
