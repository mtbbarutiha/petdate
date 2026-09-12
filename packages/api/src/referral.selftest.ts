/**
 * Core referral grant / attribution / anti-abuse.
 * Run: cd packages/api && npx tsx src/referral.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-referral-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

import assert from 'node:assert/strict';
import { REFERRAL_BONUS_COINS } from '@petdate/shared';

async function main() {
  const { getDb, dbService } = await import('./db');
  const grant = await import('./services/referral-grant');
  const { adminPlatform } = await import('./admin-platform');
  const sqlite = getDb();

  assert.equal(REFERRAL_BONUS_COINS, 30, 'bonus constant is 30');
  assert.equal(grant.parseReferredByInput('ref_12'), 12);
  assert.equal(grant.parseReferredByInput('99'), 99);
  assert.equal(grant.parseReferredByInput('nope'), null);

  const stamp = `${process.pid}-${Date.now()}`;
  const { user: inviter } = dbService.findOrCreateUser({
    telegramId: `ref-inviter-${stamp}`,
    name: `Inviter ${stamp}`,
    username: `inviter_${stamp}`,
  });
  const { user: invitee, created } = dbService.findOrCreateUser({
    telegramId: `ref-invitee-${stamp}`,
    name: `Invitee ${stamp}`,
    username: `invitee_${stamp}`,
  });
  assert.ok(created, 'invitee is new');
  const beforeCoins = Number(inviter.coins || 0);

  const first = grant.tryGrantReferralOnSignup({
    invitedUserId: invitee.id,
    referredBy: inviter.id,
    created: true,
  });
  assert.equal(first.awarded, true, 'first grant credits inviter');
  assert.equal(first.referralAward?.amount, 30);
  assert.equal(first.referralAward?.referrerId, inviter.id);

  const afterInviter = dbService.getUserById(inviter.id)!;
  const afterInvitee = dbService.getUserById(invitee.id)!;
  assert.equal(afterInvitee.referredBy, inviter.id, 'referred_by set once');
  assert.equal(Number(afterInviter.coins || 0), beforeCoins + 30, 'inviter +30');

  const second = grant.tryGrantReferralOnSignup({
    invitedUserId: invitee.id,
    referredBy: inviter.id,
    created: true,
  });
  assert.equal(second.awarded, false, 'double credit blocked');
  assert.equal(second.reason, 'already');
  const afterSecond = dbService.getUserById(inviter.id)!;
  assert.equal(Number(afterSecond.coins || 0), beforeCoins + 30, 'coins unchanged on replay');

  const self = grant.tryGrantReferralOnSignup({
    invitedUserId: inviter.id,
    referredBy: inviter.id,
    created: true,
  });
  assert.equal(self.awarded, false, 'self-referral blocked');
  assert.equal(self.reason, 'self');

  const missing = grant.tryGrantReferralOnSignup({
    invitedUserId: invitee.id,
    referredBy: 9_999_999,
    created: true,
  });
  assert.equal(missing.awarded, false);

  const existingLogin = grant.tryGrantReferralOnSignup({
    invitedUserId: invitee.id,
    referredBy: inviter.id,
    created: false,
  });
  assert.equal(existingLogin.awarded, false, 'existing telegram user is not credited');
  assert.equal(existingLogin.reason, 'not_new');

  const { user: webNew } = dbService.findOrCreateUser({
    telegramId: `ref-web-${stamp}`,
    name: `WebNew ${stamp}`,
  });
  const webGrant = grant.tryGrantReferralOnSignup({
    invitedUserId: webNew.id,
    referredBy: `ref_${inviter.id}`,
    created: true,
  });
  assert.equal(webGrant.awarded, true, 'web-style ref_ code grants');

  const stats = dbService.getReferralStats(inviter.id);
  assert.ok(stats, 'stats present');
  assert.equal(stats!.invitedCount, 2, 'two successful invitees');
  assert.equal(stats!.coinsEarned, 60, 'ledger sum matches two grants');
  assert.equal(stats!.bonusCoins, 30);
  assert.match(stats!.code, new RegExp(`ref_${inviter.id}`));
  assert.match(stats!.webLink, /\/invite\?ref=/);
  assert.match(stats!.telegramLink, /start=ref_/);

  const old = dbService.findOrCreateUser({
    telegramId: `ref-old-${stamp}`,
    name: `Old ${stamp}`,
  }).user;
  sqlite
    .prepare(`UPDATE users SET created_at = datetime('now', '-2 hours') WHERE id = ?`)
    .run(old.id);
  const stale = dbService.getUserById(old.id)!;
  assert.equal(grant.isRecentSignup(stale.createdAt), false, '2h-old account is not recent');
  const claimOld = grant.tryClaimReferralForRecentUser({
    userId: old.id,
    referredBy: inviter.id,
  });
  assert.equal(claimOld.awarded, false, 'existing/old account cannot claim');
  assert.equal(claimOld.reason, 'too_old');

  const listed = adminPlatform.listUsersAdmin({ q: `Inviter ${stamp}`, limit: 10 });
  const row = listed.users.find((u) => u.id === inviter.id);
  assert.ok(row, 'inviter in admin list');
  assert.equal(row!.invitedCount, 2, 'admin list shows invite count');

  console.log('referral.selftest: ok', {
    inviter: inviter.id,
    invitedCount: stats!.invitedCount,
    coinsEarned: stats!.coinsEarned,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
