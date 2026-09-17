import { useCallback, useEffect, useState } from 'react';
import { primaryRole, type PetProfile } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useUserStore } from '../hooks/useUserStore';
import { listPets } from '../lib/api';
import { PetDiscoveryPanel } from './PetDiscoveryPanel';

type Props = {
  onSent?: () => void;
  /** Open an existing playmate chat with a saved contact. */
  onOpenContact?: (id: number) => boolean;
};

/**
 * Chat-list discovery chips (nearby / same-breed / same-province / contacts).
 * Pet owners: playmate discovery. No-pet role: owner discovery chips.
 */
export function ChatDiscoveryBar({ onSent, onOpenContact }: Props) {
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { user } = useUserStore();
  const myUserId = authUser?.id ?? user.id;
  const active =
    primaryRole(authUser?.roles, authUser?.role) ?? primaryRole(user.roles, user.role);
  const isPetOwner = active === 'pet_owner';
  const isNoPet = active === 'no_pet';
  const [myPets, setMyPets] = useState<PetProfile[]>([]);

  const loadMyPets = useCallback(async () => {
    if (!myUserId || !isPetOwner || !isLoggedIn) {
      setMyPets([]);
      return;
    }
    try {
      const rows = await listPets({ ownerId: myUserId });
      setMyPets(rows);
    } catch {
      setMyPets([]);
    }
  }, [isLoggedIn, isPetOwner, myUserId]);

  useEffect(() => {
    void loadMyPets();
  }, [loadMyPets]);

  if (!isPetOwner && !isNoPet) return null;

  return (
    <div className="tg-chat-list-discovery-bar" data-testid="chat-list-discovery-bar">
      <PetDiscoveryPanel
        variant="bar"
        audience={isNoPet ? 'owners' : 'playmate'}
        myPets={myPets}
        onSent={onSent}
        onOpenContact={onOpenContact}
      />
    </div>
  );
}
