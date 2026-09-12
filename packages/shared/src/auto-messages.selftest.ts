/**
 * Automatic-message catalog + channel helpers.
 * Run: npx tsx packages/shared/src/auto-messages.selftest.ts
 */
import assert from 'node:assert/strict';
import {
  AUTO_MESSAGE_CATALOG,
  AUTO_MESSAGE_CHANNELS,
  AUTO_MESSAGE_CHANNEL_LABELS,
  AUTO_MESSAGE_CHANNEL_UNREADY,
  AUTO_MESSAGE_LEGACY_SEED_NAMES,
  autoMessageCatalogByKey,
  autoMessageCatalogByTrigger,
  normalizeAutoMessageChannels,
  parseAutoMessageChannels,
} from './auto-messages';

assert.ok(AUTO_MESSAGE_CATALOG.length >= 6, 'catalog has system defaults');
for (const key of [
  'after_purchase',
  'ticket_created',
  'ticket_resolved',
  'ticket_reply',
  'survey_done',
  'sla_breach',
]) {
  const entry = autoMessageCatalogByKey(key);
  assert.ok(entry, `catalog has ${key}`);
  assert.ok(entry!.text.trim(), `${key} has body`);
  assert.ok(entry!.name.trim(), `${key} has title`);
  assert.ok(entry!.auto, `${key} is automatic`);
  assert.ok(entry!.channels.includes('sms'), `${key} includes SMS`);
  assert.ok(entry!.channels.includes('telegram'), `${key} includes Telegram`);
}

assert.equal(autoMessageCatalogByTrigger('after_purchase')?.key, 'after_purchase');
assert.equal(autoMessageCatalogByTrigger('manual'), undefined);

assert.deepEqual(AUTO_MESSAGE_CHANNELS.slice().sort(), ['sms', 'telegram', 'whatsapp'].sort());
assert.equal(AUTO_MESSAGE_CHANNEL_LABELS.whatsapp, 'واتساپ');
assert.equal(AUTO_MESSAGE_CHANNEL_UNREADY.whatsapp?.ready, false);
assert.match(AUTO_MESSAGE_CHANNEL_UNREADY.whatsapp!.reason, /واتساپ/);

assert.deepEqual(parseAutoMessageChannels(['sms', 'telegram', 'sms', 'nope']), ['sms', 'telegram']);
assert.deepEqual(parseAutoMessageChannels('["whatsapp"]'), ['whatsapp']);
assert.deepEqual(parseAutoMessageChannels('sms,telegram'), ['sms', 'telegram']);
assert.deepEqual(parseAutoMessageChannels(null), ['sms']);
assert.deepEqual(normalizeAutoMessageChannels([]), ['sms']);

assert.equal(AUTO_MESSAGE_LEGACY_SEED_NAMES.after_purchase, 'تشکر پس از خرید');

const welcome = autoMessageCatalogByKey('after_purchase')!;
assert.match(welcome.text, /\{نام\}|\{name\}/i);
assert.match(welcome.text, /\{محصول\}|\{product\}/i);

console.log('auto-messages.selftest: ok');
