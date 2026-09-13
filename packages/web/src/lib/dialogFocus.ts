/** Focusable controls inside a dialog panel (buttons, links, fields). */
export const DIALOG_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Text/select fields — preferred initial focus over the header × close button. */
export const DIALOG_FIELD_SELECTOR =
  'input:not([disabled]):not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select:not([disabled]), textarea:not([disabled])';

const CLOSE_CLASS_RE = /(?:^|\s)(?:admin-modal-close|pepito-lead-modal__close)(?:\s|$)/;

export function isDialogCloseControl(el: { className?: string | { baseVal?: string } }): boolean {
  const raw = typeof el.className === 'string' ? el.className : el.className?.baseVal ?? '';
  return CLOSE_CLASS_RE.test(raw);
}

/**
 * Choose the element that should receive focus when a dialog opens.
 * Prefer an explicit field, then the first form control, then a primary
 * action — never the header close button unless it is the only control.
 */
export function pickInitialDialogFocus<T extends { className?: string }>(opts: {
  markedField?: T | null;
  firstField?: T | null;
  primary?: T | null;
  focusables: T[];
  panel?: T | null;
}): T | null {
  if (opts.markedField) return opts.markedField;
  if (opts.firstField) return opts.firstField;
  if (opts.primary) return opts.primary;
  const notClose = opts.focusables.find((el) => !isDialogCloseControl(el));
  return notClose ?? opts.focusables[0] ?? opts.panel ?? null;
}

export function dialogFocusables(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export function initialDialogFocusTarget(panel: HTMLElement | null): HTMLElement | null {
  if (!panel) return null;
  return pickInitialDialogFocus({
    markedField: panel.querySelector<HTMLElement>('[data-app-dialog-field]'),
    firstField: panel.querySelector<HTMLElement>(DIALOG_FIELD_SELECTOR),
    primary: panel.querySelector<HTMLElement>('[data-app-dialog-primary], [data-confirm-primary]'),
    focusables: dialogFocusables(panel),
    panel,
  });
}
