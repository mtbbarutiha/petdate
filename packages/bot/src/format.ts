import type { PetProfile, PlaydateRequest } from '@petdate/shared';
import {
  PET_GENDER_LABELS,
  PET_SIZE_LABELS,
  PLAYDATE_STATUS_LABELS,
  formatPetAge,
  petPublicIdOf,
  userPublicIdOf,
} from '@petdate/shared';

const SPECIES_LABELS: Record<string, string> = {
  dog: '🐕 سگ',
  cat: '🐈 گربه',
  other: '🐾 سایر',
};

export function speciesLabel(species: string): string {
  return SPECIES_LABELS[species] ?? species;
}

export function formatPet(pet: PetProfile, detailed = false): string {
  const lines = [
    `🐾 <b>${escapeHtml(pet.name)}</b>`,
    `شناسه پت: <code>${escapeHtml(petPublicIdOf(pet))}</code>`,
    `${speciesLabel(pet.species)}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''}`,
  ];
  const ownerLoc = [pet.ownerProvince, pet.ownerCity || pet.city].filter(Boolean).join('، ');
  if (ownerLoc) {
    lines.push(`📍 ${escapeHtml(ownerLoc)}`);
  } else if (pet.city) {
    lines.push(
      `📍 ${escapeHtml(pet.city)}${pet.neighborhood ? ` — ${escapeHtml(pet.neighborhood)}` : ''}`
    );
  }
  if (pet.ownerId) {
    lines.push(
      `شناسه صاحب پت: <code>${escapeHtml(userPublicIdOf({ id: pet.ownerId }))}</code>`
    );
  }
  if (pet.ownerName) {
    lines.push(`👤 صاحب: ${escapeHtml(pet.ownerName)}`);
  }
  if (pet.ownerVerified) {
    lines.push('✅ صاحب پت احراز شده');
  }
  if (detailed) {
    if (pet.gender) lines.push(`⚧ ${PET_GENDER_LABELS[pet.gender] ?? pet.gender}`);
    if (pet.ageMonths) lines.push(`🎂 ${formatPetAge(pet.ageMonths)}`);
    if (pet.size) lines.push(`📏 ${PET_SIZE_LABELS[pet.size] ?? pet.size}`);
    if (pet.color) lines.push(`🎨 ${escapeHtml(pet.color)}`);
    lines.push(pet.vaccinated ? '💉 واکسن زده' : '🚫 واکسن نزده');
    lines.push(pet.neutered ? '✂️ عقیم شده' : '➖ عقیم نشده');
    const diseases = typeof pet.health?.diseases === 'string' ? pet.health.diseases : null;
    if (diseases) lines.push(`🏥 ${escapeHtml(diseases)}`);
    if (pet.bio) lines.push(`💬 ${escapeHtml(pet.bio)}`);
    lines.push(pet.lookingForPlaymate ? '🔍 دنبال همبازی' : '⏸️ فعلاً همبازی نمی‌خواد');
  }
  return lines.filter(Boolean).join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatPlaydate(req: PlaydateRequest): string {
  const fromName = req.fromPet?.name ?? `#${req.fromPetId}`;
  const toName = req.toPet?.name ?? `#${req.toPetId}`;
  const status = PLAYDATE_STATUS_LABELS[req.status];
  const fromPetId = req.fromPet
    ? petPublicIdOf(req.fromPet)
    : req.fromPetId
      ? petPublicIdOf({ id: req.fromPetId })
      : null;
  const fromOwnerId = req.fromUserId
    ? userPublicIdOf({ id: req.fromUserId })
    : req.fromPet?.ownerId
      ? userPublicIdOf({ id: req.fromPet.ownerId })
      : null;
  const lines = [
    `📬 درخواست #${req.id}`,
    `${fromName} → ${toName}`,
    fromPetId ? `شناسه پت درخواست‌دهنده: ${fromPetId}` : null,
    fromOwnerId ? `شناسه صاحب پت: ${fromOwnerId}` : null,
    `وضعیت: ${status}`,
  ].filter(Boolean) as string[];
  if (req.message) lines.push(`💬 ${req.message}`);
  if (req.scheduledAt) lines.push(`📅 ${req.scheduledAt}`);
  if (req.location) lines.push(`📍 ${req.location}`);
  return lines.join('\n');
}

export function roleWelcomeHint(role: string): string {
  const hints: Record<string, string> = {
    pet_owner: 'می‌تونی پت ثبت کنی و همبازی پیدا کنی.',
    vet: 'می‌تونی لیست بیماران و مشاوره‌ها رو ببینی.',
    no_pet: 'می‌تونی برای خرید پت از دامپزشک مشاوره بگیری.',
    trainer: 'می‌تونی خدمات آموزشی ارائه بدی (به‌زودی).',
  };
  return hints[role] ?? '';
}
