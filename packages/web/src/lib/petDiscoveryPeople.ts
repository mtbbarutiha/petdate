import { isGenderDefaultAvatarPath, type PetProfile } from '@petdate/shared';

/** One discovery row per person (owner), with their best pet summary. */
export type DiscoveryPerson = {
  ownerId: number;
  ownerName: string;
  ownerAvatarUrl?: string;
  pet: PetProfile;
};

/** Deduplicate pets → people list (first pet per owner wins — same as bot match fanout). */
export function peopleFromDiscoveryPets(pets: PetProfile[]): DiscoveryPerson[] {
  const seen = new Set<number>();
  const out: DiscoveryPerson[] = [];
  for (const pet of pets) {
    if (!pet?.ownerId || seen.has(pet.ownerId)) continue;
    seen.add(pet.ownerId);
    const name = String(pet.ownerName ?? '').trim() || 'صاحب پت';
    const avatar = String(pet.ownerAvatarUrl ?? '').trim();
    out.push({
      ownerId: pet.ownerId,
      ownerName: name,
      ownerAvatarUrl: avatar && !isGenderDefaultAvatarPath(avatar) ? avatar : undefined,
      pet,
    });
  }
  return out;
}
