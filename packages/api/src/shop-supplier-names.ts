/**
 * Supplier name matching for warehouse invoices.
 * «دیجی‌کالا», «دی جی کالا», and «digikala» collapse to one canonical name.
 */
export const DIGIKALA_SUPPLIER_NAME = 'دیجی‌کالا';

export function normalizeSupplierKey(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\u200c/g, '')
    .replace(/\s+/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();
}

export function isDigikalaSupplierName(name: string): boolean {
  const key = normalizeSupplierKey(name);
  return key === 'دیجیکالا' || key === 'digikala';
}

export function canonicalSupplierName(name: string): string {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (isDigikalaSupplierName(trimmed)) return DIGIKALA_SUPPLIER_NAME;
  return trimmed;
}
