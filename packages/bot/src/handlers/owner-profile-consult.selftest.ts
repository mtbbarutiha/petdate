/**
 * Pet-owner bot profile: «مشورت به بدون پت‌ها» sits under Silent;
 * label is not the seeker CTA «مشورت با صاحبین».
 *
 * Run: npx tsx packages/bot/src/handlers/owner-profile-consult.selftest.ts
 */
import assert from 'node:assert/strict';
import { profileActionsKeyboard } from '../keyboards';

function buttonRows(
  kb: ReturnType<typeof profileActionsKeyboard>
): { text: string; data: string }[][] {
  return kb.inline_keyboard.map((row) =>
    row
      .filter((btn) => 'callback_data' in btn && 'text' in btn)
      .map((btn) => ({
        text: String((btn as { text: string }).text),
        data: String((btn as { callback_data: string }).callback_data),
      }))
  );
}

function flatCallbacks(rows: { text: string; data: string }[][]): string[] {
  return rows.flatMap((r) => r.map((b) => b.data));
}

function main(): void {
  const owner = profileActionsKeyboard(true, true, 'verified', {
    isPetOwner: true,
    silentChatRequests: false,
  });
  const ownerRows = buttonRows(owner);
  const ownerCbs = flatCallbacks(ownerRows);

  assert.ok(ownerCbs.includes('profile:seeker_advice'), 'owner sees consult toggle');
  assert.ok(ownerCbs.includes('profile:ready_adopt'), 'owner sees پذیرش');
  assert.ok(ownerCbs.includes('profile:silent'), 'owner sees silent');

  const consultBtn = ownerRows.flat().find((b) => b.data === 'profile:seeker_advice');
  assert.equal(
    consultBtn?.text,
    '💬 مشورت به بدون پت‌ها',
    'owner consult label is مشورت به بدون پت‌ها'
  );
  assert.doesNotMatch(
    consultBtn?.text ?? '',
    /مشورت با صاحبین/,
    'must not reuse seeker CTA wording'
  );

  const silentIdx = ownerCbs.indexOf('profile:silent');
  const consultIdx = ownerCbs.indexOf('profile:seeker_advice');
  const adoptIdx = ownerCbs.indexOf('profile:ready_adopt');
  assert.ok(silentIdx >= 0 && consultIdx >= 0, 'silent + consult present');
  assert.ok(
    consultIdx === silentIdx + 1,
    'مشورت به بدون پت‌ها must be immediately under Silent'
  );
  assert.ok(adoptIdx < silentIdx, 'پذیرش stays above Silent');

  const nonOwner = profileActionsKeyboard(true, true, 'none', { isPetOwner: false });
  const nonOwnerCbs = flatCallbacks(buttonRows(nonOwner));
  assert.ok(
    !nonOwnerCbs.includes('profile:seeker_advice'),
    'non-owner profile hides owner consult'
  );
  assert.ok(
    !nonOwnerCbs.includes('profile:ready_adopt'),
    'non-owner profile hides پذیرش'
  );

  console.log('owner-profile-consult.selftest: ok');
}

main();
