/**
 * Inbox title helpers — display name, never /u##### as primary title.
 * Run: npx tsx packages/web/src/lib/inboxTitle.selftest.ts
 */
import assert from 'node:assert/strict';
import { looksLikePublicUserId, playmateInboxTitle } from './inboxTitle';

assert.equal(looksLikePublicUserId('/u00054'), true);
assert.equal(looksLikePublicUserId('PD-U00054'), true);
assert.equal(looksLikePublicUserId('u00054'), true);
assert.equal(looksLikePublicUserId('/user_PD-U00054'), true);
assert.equal(looksLikePublicUserId('سارا'), false);
assert.equal(looksLikePublicUserId('@someone'), false);
assert.equal(looksLikePublicUserId(''), false);
assert.equal(looksLikePublicUserId(null), false);

assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: 'سارا' }), 'سارا');
assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: '/u00054' }), 'صاحب رکس');
assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: 'PD-U00054' }), 'صاحب رکس');
assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: '' }), 'صاحب رکس');
assert.equal(playmateInboxTitle({ name: '', ownerName: '' }), 'همبازی');
assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: '@tguser' }), 'صاحب رکس');
assert.equal(playmateInboxTitle({ name: 'رکس', ownerName: 'بدون نام' }), 'بدون نام');

console.log('inboxTitle.selftest: ok');
