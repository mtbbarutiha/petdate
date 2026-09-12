/**
 * Selftest: pending photos stay hidden; identity stays usable.
 * Run: npx tsx packages/shared/src/photo-moderation.selftest.ts
 */
import {
  hasPendingPhotoApproval,
  isPhotoApproved,
  isPhotoPendingApproval,
  pendingPhotoApprovalMessage,
  pendingPhotoSubjects,
  publicFacingPhotoUrl,
  sanitizePetPhotosForViewer,
} from './photo-moderation';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(isPhotoApproved(undefined), 'legacy missing status is approved');
assert(isPhotoApproved('approved'), 'approved is public');
assert(!isPhotoApproved('pending'), 'pending is not public');
assert(!isPhotoApproved('rejected'), 'rejected is not public');
assert(isPhotoPendingApproval('pending'), 'pending flag');
assert(!isPhotoPendingApproval('approved'), 'approved is not pending');

assert(
  publicFacingPhotoUrl('/api/pets/photos/1/a.jpg', 'approved') ===
    '/api/pets/photos/1/a.jpg',
  'approved url passes through'
);
assert(
  publicFacingPhotoUrl('/api/pets/photos/1/a.jpg', 'pending') === undefined,
  'pending url stripped'
);
assert(publicFacingPhotoUrl('', 'approved') === undefined, 'empty url stays empty');

const both = pendingPhotoSubjects({
  hasAvatar: true,
  avatarStatus: 'pending',
  petStatuses: [{ hasPhoto: true, status: 'pending' }],
});
assert(both.owner && both.pet, 'both subjects');
assert(hasPendingPhotoApproval(both), 'has pending');
assert(
  pendingPhotoApprovalMessage(both, 'fa')?.includes('در انتظار تأیید ادمین'),
  'FA both copy'
);
assert(
  pendingPhotoApprovalMessage(both, 'en')?.includes('awaiting admin approval'),
  'EN both copy'
);

const petOnly = pendingPhotoSubjects({
  hasAvatar: true,
  avatarStatus: 'approved',
  petStatuses: [{ hasPhoto: true, status: 'pending' }],
});
assert(petOnly.pet && !petOnly.owner, 'pet only');
assert(
  pendingPhotoApprovalMessage(petOnly, 'fa')?.includes('عکس پت'),
  'FA pet-only copy'
);

const none = pendingPhotoSubjects({
  hasAvatar: false,
  avatarStatus: 'pending',
  petStatuses: [{ hasPhoto: false, status: 'pending' }],
});
assert(!hasPendingPhotoApproval(none), 'no uploaded photo → no pending banner');
assert(pendingPhotoApprovalMessage(none) === null, 'no copy when nothing to review');

const pendingPet = {
  ownerId: 7,
  imageUrl: '/api/pets/photos/7/rex.jpg',
  photoModerationStatus: 'pending' as const,
};
assert(
  sanitizePetPhotosForViewer(pendingPet, 7).imageUrl === pendingPet.imageUrl,
  'owner still sees uploaded photo'
);
assert(
  sanitizePetPhotosForViewer(pendingPet, 99).imageUrl === undefined,
  'peer sees placeholder (no real url)'
);
assert(
  sanitizePetPhotosForViewer(pendingPet, undefined).imageUrl === undefined,
  'anonymous viewer sees placeholder'
);

console.log('photo-moderation.selftest: ok');
