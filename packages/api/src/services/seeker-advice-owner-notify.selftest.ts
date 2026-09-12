/**
 * مشورت با صاحبین — owner Telegram notify must not say «ویزیت».
 * Owner earns SEEKER_OWNER_SHARE (3 of 6), not the full debit.
 * Request embeds requester profile (name, public id, bio snippet).
 */
import assert from 'node:assert/strict';
import { SEEKER_ADVICE_COST, SEEKER_OWNER_SHARE, userPublicIdOf } from '@petdate/shared';
import { seekerAdviceOwnerNotifyText } from './telegram-vet-consult-notify';

assert.equal(SEEKER_ADVICE_COST, 6, 'total seeker advice cost');
assert.equal(SEEKER_OWNER_SHARE, 3, 'owner share of seeker advice');

const patient = {
  id: 42,
  name: 'آرمین',
  publicId: 'PD-U00042',
  bio: 'می‌خوام سگ بگیرم و در مورد هزینه نگهداری راهنمایی می‌خوام.',
  city: 'تهران',
};

const text = seekerAdviceOwnerNotifyText({
  patient,
  ownerShareCoins: SEEKER_OWNER_SHARE,
});

assert.match(text, /خرید و نگهداری پت/, 'mentions purchase/care guidance');
assert.match(text, /یک نفر می‌خواد باهات صحبت کنه/, 'personal talk framing');
assert.match(
  text,
  new RegExp(`بابت این راهنمایی <b>${SEEKER_OWNER_SHARE}</b> سکه دریافت می‌کنی`),
  'owner earns 3 coins'
);
assert.match(text, /آرمین/, 'includes seeker name');
assert.match(text, /پروفایل درخواست‌کننده/, 'profile section heading');
assert.match(
  text,
  new RegExp(`شناسه: <code>${userPublicIdOf(patient)}</code>`),
  'includes public id'
);
assert.match(text, /بیو: می‌خوام سگ بگیرم/, 'includes bio snippet');
assert.match(text, /شهر: تهران/, 'includes city when present');
assert.doesNotMatch(text, /ویزیت/, 'must not say ویزیت');
assert.doesNotMatch(text, /بیمار/, 'must not call seeker بیمار');
assert.doesNotMatch(text, new RegExp(String(SEEKER_ADVICE_COST)), 'must not show total 6 as owner payout');

const plain = seekerAdviceOwnerNotifyText({});
assert.match(plain, /<b>3<\/b> سکه/, 'defaults to SEEKER_OWNER_SHARE');
assert.doesNotMatch(plain, /ویزیت/, 'default copy has no ویزیت');
assert.match(plain, /پروفایل درخواست‌کننده/, 'profile section even without patient');

const longBio = 'ب'.repeat(200);
const clipped = seekerAdviceOwnerNotifyText({
  patient: { id: 7, name: 'سارا', bio: longBio },
});
assert.match(clipped, /بیو: ب{10,}…/, 'bio is truncated with ellipsis');
assert.ok(!clipped.includes(longBio), 'full long bio not inlined');

console.log('seeker-advice-owner-notify.selftest: ok');
