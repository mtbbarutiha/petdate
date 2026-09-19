/**
 * Pet lover reviews service selftest.
 * Run: cd packages/api && npx tsx src/pet-lover-reviews.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-plr-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const svc = await import('./pet-lover-reviews-service');
  // getDb boot may already seed once; assert catalog presence, not seed delta.
  const boot1 = svc.bootPetLoverReviews();
  assert(boot1.total >= svc.PET_LOVER_SAMPLE_COUNT, `total ${boot1.total}`);
  assert(
    boot1.seeded === 0 || boot1.seeded === svc.PET_LOVER_SAMPLE_COUNT,
    `seeded ${boot1.seeded}`,
  );

  const boot2 = svc.bootPetLoverReviews();
  assert(boot2.seeded === 0, 'second boot does not re-seed');
  assert(boot2.total >= 30, 'at least 30 reviews');

  const featured = svc.listFeaturedPetLoverReviews(4);
  assert(featured.length === 4, 'featured 4');
  assert(featured.every((r) => r.displayHandle.startsWith('@')), 'handles have @');

  const allPublic = svc.listPublicPetLoverReviews({ limit: 50 });
  assert(
    allPublic.reviews.some((r) => r.body.includes('حیوانات‌اند')),
    'typo حیوانات fixed in seed',
  );
  assert(!allPublic.reviews.some((r) => r.body.includes('حیوانان‌اند')), 'old typo absent');
  const photos = allPublic.reviews.map((r) => r.photoUrl);
  assert(new Set(photos).size === photos.length, 'every seed photo URL is unique');
  assert(
    photos.every(
      (p) =>
        /\/pepito\/uploads\/0[1-4]-4\.jpg$/.test(p) ||
        /\/pepito\/uploads\/reviews\/fantasy-\d+\.jpg$/.test(p),
    ),
    'photos stay on-theme fantasy studio paths',
  );

  const { user } = (await import('./db')).dbService.findOrCreateUser({
    telegramId: `plr-${process.pid}`,
    name: 'Reviewer',
    username: 'plr_user',
  });
  assert(user?.id, 'user');

  const pending = svc.submitPetLoverReview({
    userId: user.id,
    displayHandle: 'تست‌کاربر',
    body: 'این یک نظر آزمایشی برای فرآیند تأیید ادمین است.',
    rating: 5,
    photoUrl: '/pepito/uploads/01-4.jpg',
  });
  assert(pending.status === 'pending', 'new submit pending');
  assert(pending.displayHandle === '@تست‌کاربر', 'handle normalized');
  assert(svc.countPendingPetLoverReviews() >= 1, 'pending count');

  const approved = svc.setPetLoverReviewStatus(pending.id, 'approved', {
    reviewedBy: 'selftest',
  });
  assert(approved?.status === 'approved', 'approved');

  const pub = svc.listPublicPetLoverReviews({ limit: 50 });
  assert(pub.reviews.some((r) => r.id === pending.id), 'approved visible publicly');

  console.log('pet-lover-reviews.selftest: ok', {
    seeded: boot1.seeded,
    total: pub.total,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
