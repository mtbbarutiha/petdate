import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuthStore';
import { useI18n } from '../i18n';

/**
 * Desktop header wallet entry — same nav-chip family as SiteDesktopNav + cart.
 * `dir="rtl"` keeps icon at inline-start (leading) to match sibling chips.
 * Balances live on the Wallet page (header chip no longer shows amounts).
 * Hidden on mobile via CSS; bottom dock covers wallet there.
 */
export function WalletChip() {
  const { isLoggedIn, user } = useAuthStore();
  const { t, dir } = useI18n();

  if (!isLoggedIn || !user) return null;

  return (
    <div className="pepito-nav-wallet">
      <Link to="/wallet" className="pepito-nav-wallet-btn" aria-label={t('nav.wallet')} dir={dir}>
        <Wallet size={16} strokeWidth={2.25} aria-hidden />
        <span className="pepito-nav-wallet-label">{t('nav.wallet')}</span>
      </Link>
    </div>
  );
}
