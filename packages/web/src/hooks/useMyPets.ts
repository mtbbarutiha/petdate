import { useCallback, useEffect, useState } from 'react';
import type { PetProfile } from '@petdate/shared';
import { useAuthStore } from './useAuthStore';
import { listPets } from '../lib/api';

/**
 * Single source of truth for the signed-in owner's pets.
 * Profile, Home, and /my-pets must all use this (API listPets by ownerId) —
 * never the mock usePetStore / MY_PET localStorage data.
 */
export function useMyPets() {
  const { user, isLoggedIn, token } = useAuthStore();
  const ownerId = user?.id;
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(Boolean(isLoggedIn && ownerId));
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!isLoggedIn || !ownerId) {
      setPets([]);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const rows = await listPets({ ownerId });
      setPets(rows);
    } catch (err) {
      setPets([]);
      setError(err instanceof Error ? err.message : 'بارگذاری پت‌ها ناموفق بود');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, ownerId, token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isLoggedIn || !ownerId) {
        if (!cancelled) {
          setPets([]);
          setLoading(false);
          setError('');
        }
        return;
      }
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
      try {
        const rows = await listPets({ ownerId });
        if (!cancelled) setPets(rows);
      } catch (err) {
        if (!cancelled) {
          setPets([]);
          setError(err instanceof Error ? err.message : 'بارگذاری پت‌ها ناموفق بود');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, ownerId, token]);

  // Refetch when returning to the tab (covers add-pet elsewhere / bot sync).
  useEffect(() => {
    if (!isLoggedIn || !ownerId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isLoggedIn, ownerId, reload]);

  return { pets, loading, error, reload, ownerId };
}
