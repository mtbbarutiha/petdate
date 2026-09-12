/**
 * Profile photo change uses ConfirmModal + shared 100-coin cost (not window.confirm).
 * Run: npx tsx packages/web/src/components/profilePhotoChange.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROFILE_PHOTO_CHANGE_COST } from '@petdate/shared';

const dir = dirname(fileURLToPath(import.meta.url));
const editor = readFileSync(join(dir, 'ProfileAvatarEditor.tsx'), 'utf8');
const fa = readFileSync(join(dir, '../i18n/locales/fa.ts'), 'utf8');
const en = readFileSync(join(dir, '../i18n/locales/en.ts'), 'utf8');

assert.equal(PROFILE_PHOTO_CHANGE_COST, 100, 'photo change costs 100 coins');
assert.match(editor, /from '\.\/ConfirmModal'/, 'editor imports ConfirmModal');
assert.match(editor, /profile-photo-change-confirm/, 'confirm test id');
assert.match(editor, /isStoredCustomProfilePhoto/, 'detects existing custom photo');
assert.match(editor, /PROFILE_PHOTO_CHANGE_COST/, 'uses shared cost constant');
assert.doesNotMatch(editor, /window\.confirm/, 'no native confirm');
assert.match(fa, /photoChangeTitle/, 'FA copy');
assert.match(en, /photoChangeTitle/, 'EN copy');
assert.match(fa, /از حالت احراز چهره خارج/, 'FA mentions leaving face-verify');
assert.match(en, /removes face verification/, 'EN mentions leaving face-verify');

console.log('profilePhotoChange.selftest: ok');
