/**
 * Force-join must not spam users (channel chat_member, duplicate prompts, stale "no" cache).
 * Run: npx tsx packages/bot/src/force-join.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from 'grammy';
import {
  FORCE_JOIN_PROMPT_COOLDOWN_MS,
  forceJoinPromptIsFresh,
  isForceJoinGatedUpdate,
  resetForceJoinPromptCooldown,
  sendForceJoinPrompt,
} from './force-join.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, 'force-join.ts'), 'utf8');
const indexSrc = readFileSync(join(dir, 'index.ts'), 'utf8');
const handlersSrc = readFileSync(join(dir, 'handlers/index.ts'), 'utf8');

assert.match(src, /isForceJoinGatedUpdate/, 'gates only private message/callback');
assert.match(src, /FORCE_JOIN_PROMPT_COOLDOWN_MS/, 'dedupes prompt DMs');
assert.match(src, /invalidateMembershipCache/, 'join:check busts membership cache');
assert.match(src, /status === 'yes'/, 'only caches positive membership');
assert.match(src, /is_disabled:\s*true/, 'channel URL preview disabled (no VIEW CHANNEL card spam)');
assert.match(src, /allowNewMessage/, 'join:check can refuse a second copy');
assert.doesNotMatch(indexSrc, /'chat_member'/, 'do not subscribe to channel member floods');
assert.match(handlersSrc, /invalidateMembershipCache/, 'check button busts cache');
assert.match(handlersSrc, /allowNewMessage:\s*false/, 'failed check does not send another wall of text');

function ctx(partial: Record<string, unknown>): Context {
  return partial as unknown as Context;
}

async function main() {
  assert.equal(
    isForceJoinGatedUpdate(ctx({ chat: { type: 'private' }, message: { text: 'hi' } })),
    true,
    'private message is gated'
  );
  assert.equal(
    isForceJoinGatedUpdate(ctx({ chat: { type: 'private' }, callbackQuery: { data: 'x' } })),
    true,
    'private callback is gated'
  );
  assert.equal(
    isForceJoinGatedUpdate(
      ctx({
        chat: { type: 'channel' },
        from: { id: 1 },
        chatMember: { new_chat_member: { status: 'member' } },
      })
    ),
    false,
    'channel chat_member is not gated'
  );
  assert.equal(
    isForceJoinGatedUpdate(
      ctx({
        chat: { type: 'private' },
        editedMessage: { text: 'edit' },
        message: { text: 'edit' },
      })
    ),
    false,
    'edited private message is not gated'
  );
  assert.equal(
    isForceJoinGatedUpdate(ctx({ chat: { type: 'supergroup' }, message: { text: 'hi' } })),
    false,
    'groups are not gated'
  );

  resetForceJoinPromptCooldown();
  assert.equal(forceJoinPromptIsFresh(42), false, 'no prompt yet');
  let replies = 0;
  const privateCtx = ctx({
    from: { id: 42 },
    chat: { type: 'private' },
    reply: async () => {
      replies += 1;
      return {};
    },
  });
  await sendForceJoinPrompt(privateCtx as Context, [
    { username: 'petdating', title: 'کانال petdate', url: 'https://t.me/petdating' },
  ]);
  assert.equal(replies, 1, 'first prompt sends');
  assert.equal(forceJoinPromptIsFresh(42), true, 'cooldown active after send');
  await sendForceJoinPrompt(privateCtx as Context, [
    { username: 'petdating', title: 'کانال petdate', url: 'https://t.me/petdating' },
  ]);
  assert.equal(replies, 1, 'second prompt within cooldown is dropped');
  assert.ok(FORCE_JOIN_PROMPT_COOLDOWN_MS >= 5 * 60 * 1000, 'cooldown is minutes, not seconds');

  let edits = 0;
  const cbCtx = ctx({
    from: { id: 99 },
    chat: { type: 'private' },
    callbackQuery: { data: 'join:check' },
    editMessageText: async () => {
      edits += 1;
      return true;
    },
    reply: async () => {
      replies += 1;
      return {};
    },
  });
  await sendForceJoinPrompt(
    cbCtx as Context,
    [{ username: 'petdating', title: 'کانال petdate', url: 'https://t.me/petdating' }],
    { allowNewMessage: false }
  );
  assert.equal(edits, 1, 'callback edits existing prompt');

  console.log('force-join.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
