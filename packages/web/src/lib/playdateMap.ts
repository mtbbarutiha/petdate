import { PLAYDATE_STATUS_LABELS, type PetProfile, type PlaydateRequest } from '@petdate/shared';
import type { MatchRequest, MatchStatus, Pet, PetType } from '../types';
import { PET_TYPE_EMOJI } from '../types';

function speciesToType(species?: string): PetType {
  const s = (species || '').toLowerCase();
  if (s === 'dog' || s === 'سگ') return 'dog';
  if (s === 'cat' || s === 'گربه') return 'cat';
  if (s === 'bird' || s === 'پرنده') return 'bird';
  if (s === 'rabbit' || s === 'خرگوش') return 'rabbit';
  if (s === 'hamster' || s === 'همستر') return 'hamster';
  return 'other';
}

function resolveImage(url?: string | null): string {
  if (!url?.trim()) return '';
  const u = url.trim();
  // Absolute remote, same-origin API uploads, or static /pets assets
  if (/^https?:\/\//i.test(u) || u.startsWith('/')) return u;
  return '';
}

export function petProfileToUiPet(pet?: PetProfile | null): Pet {
  const type = speciesToType(pet?.species);
  const ageMonths = pet?.ageMonths ?? 12;
  const ageUnit: Pet['ageUnit'] = ageMonths >= 12 ? 'year' : 'month';
  const age = ageUnit === 'year' ? Math.max(1, Math.round(ageMonths / 12)) : ageMonths;
  return {
    id: pet?.id ?? 0,
    publicId: pet?.publicId,
    name: pet?.name ?? 'پت',
    type,
    breed: pet?.breed ?? '—',
    age,
    ageUnit,
    size: (pet?.size as Pet['size']) || 'medium',
    gender: (pet?.gender as Pet['gender']) || 'male',
    city: pet?.city || pet?.ownerCity || '',
    neighborhood: pet?.neighborhood || '',
    ownerName: (pet?.ownerName && String(pet.ownerName).trim()) || '',
    ownerId: pet?.ownerId ?? 0,
    imageUrl: resolveImage(pet?.imageUrl),
    emoji: PET_TYPE_EMOJI[type],
    bio: pet?.bio,
    traits: [],
    vaccinated: Boolean(pet?.vaccinated),
    neutered: Boolean(pet?.neutered),
    lookingForPlaymate: Boolean(pet?.lookingForPlaymate),
    distanceKm: 0,
  };
}

function toMatchStatus(status: PlaydateRequest['status']): MatchStatus {
  if (status === 'accepted') return 'accepted';
  if (status === 'expired') return 'expired';
  if (status === 'rejected' || status === 'cancelled') return 'rejected';
  return 'pending';
}

export function isIncomingPlaydate(req: PlaydateRequest, myUserId: number): boolean {
  return req.toUserId === myUserId || req.toPet?.ownerId === myUserId;
}

export function isOutgoingPlaydate(req: PlaydateRequest, myUserId: number): boolean {
  return req.fromUserId === myUserId || req.fromPet?.ownerId === myUserId;
}

/** Map API playdate → UI card (other party’s pet as fromPet for chat/peer display). */
export function playdateToMatchRequest(req: PlaydateRequest, myUserId: number): MatchRequest {
  const incoming = isIncomingPlaydate(req, myUserId);
  const other = incoming ? req.fromPet : req.toPet;
  const mine = incoming ? req.toPet : req.fromPet;
  return {
    id: req.id,
    fromPet: petProfileToUiPet(other),
    toPet: petProfileToUiPet(mine),
    toPetId: incoming ? req.toPetId : req.fromPetId,
    fromPetId: incoming ? req.fromPetId : req.toPetId,
    message: req.message,
    status: toMatchStatus(req.status),
    statusLabel: PLAYDATE_STATUS_LABELS[req.status] ?? req.status,
    direction: incoming ? 'incoming' : 'outgoing',
    createdAt: req.createdAt,
    updatedAt: req.updatedAt ?? req.createdAt,
    scheduledAt: req.scheduledAt,
    location: req.location,
    rawFromName: req.fromPet?.name ?? `#${req.fromPetId}`,
    rawToName: req.toPet?.name ?? `#${req.toPetId}`,
    chatSecure: Boolean(req.chatSecure),
    chatEnded: Boolean(req.chatEnded),
    expired: req.status === 'expired',
  };
}
