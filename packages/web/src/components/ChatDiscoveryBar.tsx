import { useCallback, useEffect, useState } from 'react';
import { primaryRole, type PetProfile } from '@petdate/shared';
import { useAuthStore } from '../hooks/useAuthStore';
import { useUserStore } from '../hooks/useUserStore';
import { listPets } from '../lib/api';
import { PetDiscoveryPanel } from './PetDiscoveryPanel';

type Props = {
  onSent?: () => void;
};

/**
 * Mobile chat-list discovery chips (nearby / same-breed / same-province).
 * Desktop keeps the full panel in the thread empty pane instead.
 */
export function ChatDiscoveryBar({ onSent }: Props) {
  const { user: authUser, isLoggedIn } = useAuthStore();
  const { user } = useUserStore();
  const myUserId = authUser?.id ?? user.id;
  const active =
    primaryRole(authUser?.roles, authUser?.role) ?? primaryRole(user.roles, user.role);
  const isPetOwner = active === 'pet_owner';
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

  if (!isPetOwner) return null;

  return (
    <div className="tg-chat-list-discovery-bar" data-testid="chat-list-discovery-bar">
      <PetDiscoveryPanel variant="bar" myPets={myPets} onSent={onSent} />
    </div>
  );
}
