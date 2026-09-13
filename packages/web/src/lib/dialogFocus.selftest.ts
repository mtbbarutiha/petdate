/**
 * Guard: shared dialog focus trap focuses once on open and prefers a
 * form field over the header × close button. Inline onClose must not
 * be in the effect deps (every keystroke would steal focus).
 * Run: npx tsx packages/web/src/lib/dialogFocus.selftest.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDialogCloseControl, pickInitialDialogFocus } from './dialogFocus.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const webSrc = join(dir, '..');
const helper = readFileSync(join(dir, 'dialogFocus.ts'), 'utf8');
const trap = readFileSync(join(webSrc, 'hooks/useDialogFocusTrap.ts'), 'utf8');
const adminModal = readFileSync(join(webSrc, 'admin/AdminModal.tsx'), 'utf8');
const appDialog = readFileSync(join(webSrc, 'components/AppDialog.tsx'), 'utf8');
const confirmModal = readFileSync(join(webSrc, 'components/ConfirmModal.tsx'), 'utf8');
const sales = readFileSync(join(webSrc, 'admin/pages/sales/AdminSalesPages.tsx'), 'utf8');
const ci = readFileSync(join(webSrc, '../../../scripts/ci-selftest.sh'), 'utf8');

const close = { className: 'admin-modal-close' };
const pepitoClose = { className: 'pepito-lead-modal__close' };
const field = { className: 'form-input' };
const primary = { className: 'admin-btn admin-btn--primary' };
const panel = { className: 'admin-modal-card' };

assert.equal(
  pickInitialDialogFocus({
    markedField: field,
    firstField: field,
    primary,
    focusables: [close, field, primary],
    panel,
  }),
  field,
  'explicit field wins over close + primary'
);
assert.equal(
  pickInitialDialogFocus({ firstField: field, focusables: [close, field], panel }),
  field,
  'first form field wins over header close'
);
assert.equal(
  pickInitialDialogFocus({ primary, focusables: [close, primary], panel }),
  primary,
  'primary action wins when there is no field'
);
assert.equal(
  pickInitialDialogFocus({ focusables: [close, primary], panel }),
  primary,
  'skip close when picking among focusables'
);
assert.equal(
  pickInitialDialogFocus({ focusables: [close], panel }),
  close,
  'close is last resort when it is the only control'
);

assert.equal(isDialogCloseControl(close), true);
assert.equal(isDialogCloseControl(pepitoClose), true);
assert.equal(isDialogCloseControl(field), false);

assert.match(helper, /pickInitialDialogFocus/, 'picker lives in dialogFocus helper');
assert.match(trap, /onDismissRef/, 'dismiss callback is a ref so identity changes do not re-focus');
assert.match(trap, /}, \[active\]/, 'focus + trap effects depend only on active/open');
assert.doesNotMatch(trap, /\[active,\s*onDismiss/, 'onDismiss must not retrigger initial focus');
assert.doesNotMatch(trap, /\[open,\s*onClose/, 'legacy open+onClose deps must stay gone');

assert.match(adminModal, /useDialogFocusTrap/, 'AdminModal uses the shared once-on-open trap');
assert.doesNotMatch(adminModal, /\[open,\s*onClose,\s*busy\]/, 'AdminModal no longer re-focuses on onClose');

assert.match(appDialog, /useDialogFocusTrap/, 'AppDialog uses the shared trap');
assert.doesNotMatch(appDialog, /\[busy,\s*onCancel\]/, 'AppDialog no longer re-focuses on onCancel');

assert.match(confirmModal, /useDialogFocusTrap/, 'ConfirmModal uses the shared trap');

assert.match(sales, /<AdminModal/, 'create-lead dialog is the shared AdminModal');
assert.match(sales, /لید جدید/, 'New Lead title still uses AdminModal');

assert.match(ci, /dialogFocus\.selftest\.ts/, 'ci-selftest runs dialog focus guard');

console.log('dialogFocus.selftest: ok');
