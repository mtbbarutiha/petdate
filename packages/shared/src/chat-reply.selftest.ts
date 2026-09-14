import assert from 'assert';
import {
  chatReplySnippetBody,
  formatTelegramReplyPrefix,
  truncateChatReplyText,
  withTelegramReplyPrefix,
} from './chat-reply';

assert.equal(truncateChatReplyText('hi'), 'hi');
assert.equal(truncateChatReplyText('  a   b  '), 'a b');
assert.ok(truncateChatReplyText('x'.repeat(200)).endsWith('…'));
assert.ok(truncateChatReplyText('x'.repeat(200)).length <= 120);

assert.equal(chatReplySnippetBody({ text: 'سلام', mediaKind: null }), 'سلام');
assert.equal(chatReplySnippetBody({ text: '[تصویر]', mediaKind: 'photo' }), 'تصویر');
assert.equal(chatReplySnippetBody({ text: '', mediaKind: 'voice' }), 'پیام صوتی');

assert.equal(formatTelegramReplyPrefix({ text: ' salam ' }), '↩️ salam');
assert.equal(
  withTelegramReplyPrefix('جواب', { text: 'سوال' }),
  '↩️ سوال\n\nجواب'
);
assert.equal(withTelegramReplyPrefix('فقط', null), 'فقط');

console.log('chat-reply selftest ok');
