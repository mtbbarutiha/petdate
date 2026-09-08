/**
 * Guard: sticky ReplyKeyboard middleware must stay a no-op (no send+delete).
 * Deleting a keyboard carrier clears the main menu on many Telegram clients.
 *
 * Run: npx tsx packages/bot/src/sticky-reply-keyboard.selftest.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stickyReplyKeyboardMiddleware } from './sticky-reply-keyboard';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const srcPath = join(__dirname, 'sticky-reply-keyboard.ts');
  const src = readFileSync(srcPath, 'utf8');

  assert(!/deleteMessage|api\.delete/.test(src), 'sticky-reply-keyboard must not call deleteMessage');
  assert(
    !/sendMessage[\s\S]{0,120}deleteMessage|deleteMessage[\s\S]{0,120}sendMessage/.test(src),
    'sticky-reply-keyboard must not implement send+delete carrier'
  );

  let nextCalled = false;
  const mw = stickyReplyKeyboardMiddleware();
  await mw({} as never, async () => {
    nextCalled = true;
  });
  assert(nextCalled, 'sticky middleware must call next() (passthrough)');

  console.log('sticky-reply-keyboard.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
