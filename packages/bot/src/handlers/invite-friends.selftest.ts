/**
 * Guard: invite message must not use legacy Markdown with ref_<id> links.
 * Telegram rejects `_` in Markdown as an unclosed italic entity (400 parse error).
 *
 * Run: npx tsx packages/bot/src/handlers/invite-friends.selftest.ts
 */
import assert from 'node:assert/strict';
import { inviteTelegramLink, REFERRAL_BONUS_COINS } from '@petdate/shared';
import { COMMON_MENU, PET_OWNER_MENU, coinsShopKeyboard } from '../keyboards';
import { buildInviteFriendsHtml } from './services';

function main(): void {
  assert.equal(PET_OWNER_MENU.invite, '🎁 دعوت دوستان');
  assert.equal(COMMON_MENU.invite, PET_OWNER_MENU.invite);
  assert.equal(REFERRAL_BONUS_COINS, 30);

  const invite = buildInviteFriendsHtml(38);
  assert.equal(invite.parse_mode, 'HTML');
  assert.match(invite.link, /ref_38$/);
  assert.equal(invite.link, inviteTelegramLink(38));
  assert.ok(invite.text.includes('<code>'), 'link must be wrapped in <code> for HTML');
  assert.ok(invite.text.includes(invite.link), 'message must include invite deep link');
  assert.ok(!/\*\*/.test(invite.text), 'must not use legacy Markdown **bold**');
  assert.ok(invite.shareUrl.includes('t.me/share'), 'share URL required');

  // Simulate the production failure: Markdown + raw ref_ URL
  const brokenMarkdown = [
    '🎁 **دعوت دوستان**',
    '',
    `https://t.me/Petdatebot?start=ref_38`,
  ].join('\n');
  assert.ok(
    /ref_\d+/.test(brokenMarkdown) && /\*\*/.test(brokenMarkdown),
    'documents the old Markdown+ref_ pattern that Telegram 400s'
  );

  const coinsKb = coinsShopKeyboard(null);
  const inviteBtn = coinsKb.inline_keyboard
    .flat()
    .find((b) => 'callback_data' in b && b.callback_data === 'coins:invite');
  assert.ok(inviteBtn, 'coins shop must expose coins:invite');

  console.log('invite-friends.selftest: ok', invite.link);
}

main();
