/**
 * Invite / referral helpers — same ref_<id> code on web + bot.
 * Run: npx tsx packages/shared/src/referral.selftest.ts
 */
import assert from 'node:assert/strict';
import { REFERRAL_BONUS_COINS } from './economy';
import {
  SITE,
  inviteReferralCode,
  inviteTelegramLink,
  inviteWebLink,
  inviteWebPath,
  parseReferralRef,
} from './brand';

assert.equal(REFERRAL_BONUS_COINS, 30, 'referral bonus stays 30 coins');
assert.equal(inviteReferralCode(38), 'ref_38');
assert.equal(inviteReferralCode('38'), 'ref_38');
assert.equal(inviteReferralCode(0), 'ref_0');
assert.equal(inviteWebPath(38), '/invite?ref=38');
assert.equal(inviteWebLink(38), `${SITE.origin}/invite?ref=38`);
assert.equal(inviteTelegramLink(38), `https://t.me/${SITE.telegramBotUsername}?start=ref_38`);

assert.equal(parseReferralRef(38), 38);
assert.equal(parseReferralRef('38'), 38);
assert.equal(parseReferralRef('ref_38'), 38);
assert.equal(parseReferralRef('REF_38'), 38);
assert.equal(parseReferralRef('?ref=38'), 38);
assert.equal(parseReferralRef('/invite?ref=38'), 38);
assert.equal(parseReferralRef('https://petdate.ir/invite?ref=38'), 38);
assert.equal(parseReferralRef('https://t.me/Petdatebot?start=ref_38'), 38);
assert.equal(parseReferralRef('ref_0'), null);
assert.equal(parseReferralRef('0'), null);
assert.equal(parseReferralRef(''), null);
assert.equal(parseReferralRef('wlink_abc'), null);
assert.equal(parseReferralRef('wpend_deadbeef'), null);

console.log('referral.selftest: ok');
