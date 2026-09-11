/**
 * درخواست خرید پت + تماس مشاور — public CTA leads handed to Sales.
 */

export const PET_PURCHASE_PRODUCT_NAME = 'مشاوره خرید پت';
export const PET_PURCHASE_LEAD_SOURCE = 'وبسایت';

export const PET_PURCHASE_LEAD_STATUSES = [
  'جدید',
  'در حال پیگیری',
  'ارجاع‌شده به فروش',
  'بسته',
] as const;

export type PetPurchaseLeadStatus = (typeof PET_PURCHASE_LEAD_STATUSES)[number];

export type PetPurchaseLead = {
  id: number;
  publicId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  status: PetPurchaseLeadStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  salesItemId: number | null;
  sourcePage: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export function makePetPurchaseLeadPublicId(id: number): string {
  return `PP-${String(Math.trunc(id)).padStart(4, '0')}`;
}

export function isPetPurchaseLeadStatus(value: unknown): value is PetPurchaseLeadStatus {
  return typeof value === 'string' && (PET_PURCHASE_LEAD_STATUSES as readonly string[]).includes(value);
}
