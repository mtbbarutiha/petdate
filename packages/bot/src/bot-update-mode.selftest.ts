import assert from 'node:assert/strict';
import {
  shouldUseLongPolling,
  webhookFootgunMessage,
  webhookListenerImplemented,
} from './bot-update-mode.ts';

assert.equal(webhookListenerImplemented(), false, 'no HTTP webhook listener in this process');
assert.equal(shouldUseLongPolling(''), true);
assert.equal(shouldUseLongPolling('https://petdate.ir/tg-webhook'), true, 'must poll even if URL is set');
assert.equal(webhookFootgunMessage(''), null);
assert.match(
  webhookFootgunMessage('https://example.com/hook') || '',
  /polling/,
  'loud warning when URL is set'
);

console.log('bot-update-mode.selftest: ok');
