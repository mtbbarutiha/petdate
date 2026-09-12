/**
 * مشورت با صاحبین — owner Telegram notify must not say «ویزیت».
 * Owner earns SEEKER_OWNER_SHARE (3 of 6), not the full debit.
 */
import assert from 'node:assert/strict';
import { SEEKER_ADVICE_COST, SEEKER_OWNER_SHARE } from '@petdate/shared';
import { seekerAdviceOwnerNotifyText } from './telegram-vet-consult-notify';

assert.equal(SEEKER_ADVICE_COST, 6, 'total seeker advice cost');
assert.equal(SEEKER_OWNER_SHARE, 3, 'owner share of seeker advice');

const text = seekerAdviceOwnerNotifyText({
  patientName: 'آرمین',
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
assert.doesNotMatch(text, /ویزیت/, 'must not say ویزیت');
assert.doesNotMatch(text, /بیمار/, 'must not call seeker بیمار');
assert.doesNotMatch(text, new RegExp(String(SEEKER_ADVICE_COST)), 'must not show total 6 as owner payout');

const plain = seekerAdviceOwnerNotifyText({});
assert.match(plain, /<b>3<\/b> سکه/, 'defaults to SEEKER_OWNER_SHARE');
assert.doesNotMatch(plain, /ویزیت/, 'default copy has no ویزیت');

console.log('seeker-advice-owner-notify.selftest: ok');
