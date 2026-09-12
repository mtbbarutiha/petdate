/**
 * Outgoing fan-out rejects stay hidden from the requester on web.
 * Run: npx tsx src/lib/playdateMap.fanoutReject.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldNotifyRequesterOnReject } from '@petdate/shared';

function shouldShowOutgoingRejectToRequester(match: {
  direction?: 'incoming' | 'outgoing';
  fanoutRecipientCount?: number;
}): boolean {
  if (match.direction === 'incoming') return true;
  return shouldNotifyRequesterOnReject(match.fanoutRecipientCount ?? 1);
}

assert.equal(
  shouldShowOutgoingRejectToRequester({ direction: 'incoming', fanoutRecipientCount: 40 }),
  true,
  'recipient still sees their own reject'
);
assert.equal(
  shouldShowOutgoingRejectToRequester({ direction: 'outgoing', fanoutRecipientCount: 1 }),
  true,
  'single outgoing still shows reject'
);
assert.equal(
  shouldShowOutgoingRejectToRequester({ direction: 'outgoing', fanoutRecipientCount: 8 }),
  false,
  'fan-out outgoing hides reject'
);

const webSrc = join(dirname(fileURLToPath(import.meta.url)), '..');
const mapSrc = readFileSync(join(webSrc, 'lib/playdateMap.ts'), 'utf8');
assert.match(mapSrc, /shouldShowOutgoingRejectToRequester/, 'playdateMap exports gate');
assert.match(mapSrc, /shouldNotifyRequesterOnReject/, 'playdateMap uses shared predicate');

const chat = readFileSync(join(webSrc, 'pages/ChatPage.tsx'), 'utf8');
assert.match(chat, /shouldShowOutgoingRejectToRequester/, 'ChatPage gates reject copy');
assert.match(chat, /navigate\('\/chats'/, 'fan-out reject leaves the thread');

console.log('playdateMap.fanoutReject.selftest: ok');
