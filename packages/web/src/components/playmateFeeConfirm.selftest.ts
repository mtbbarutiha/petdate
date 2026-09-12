/**
 * Playmate fee confirm must use ConfirmModal, not native window.confirm.
 * Run: npx tsx packages/web/src/components/playmateFeeConfirm.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(dir, 'FindPlaymatePanel.tsx'), 'utf8');
const modal = readFileSync(join(dir, 'ConfirmModal.tsx'), 'utf8');

assert.match(panel, /from '\.\/ConfirmModal'/, 'FindPlaymatePanel imports ConfirmModal');
assert.match(panel, /playmate-fee-confirm/, 'fee confirm modal has test id');
assert.match(panel, /هزینه درخواست/, 'modal shows request fee');
assert.match(panel, /موجودی فعلی/, 'modal shows current balance');
assert.doesNotMatch(panel, /window\.confirm\s*\(/, 'native confirm() removed from playmate fee flow');
assert.match(modal, /role="dialog"/, 'ConfirmModal is a dialog');
assert.match(modal, /aria-modal="true"/, 'ConfirmModal is aria-modal');
assert.match(modal, /Escape/, 'ConfirmModal closes on Escape');
assert.match(modal, /createPortal/, 'ConfirmModal portals to body');

console.log('playmateFeeConfirm.selftest: ok');
