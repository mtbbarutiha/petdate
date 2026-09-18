/** Request bodies for تخصیص هزینه create/edit. Kept pure so selftests can lock the office payload. */

export type AreaInput = {
  id: string;
  name: string;
  sqm: string;
  monthlyRent: string;
  assignedBusiness: string;
};

export type OfficeCreateForm = {
  name: string;
  address: string;
  totalSqm: string;
  monthlyRent: string;
  areas: AreaInput[];
};

export type OfficeCreateBody = {
  name: string;
  address: string;
  totalSqm: number;
  monthlyRent: number;
  areas: Array<{
    id: string;
    name: string;
    sqm: number;
    monthlyRent: number;
    assignedBusiness: string | null;
  }>;
};

export type PersonForm = {
  id: number | null;
  name: string;
  role: string;
  office: string;
  allocationMethod: 'auto' | 'manual';
};

export type EquipmentForm = {
  id: number | null;
  name: string;
  category: string;
  purchasePrice: string;
  currentValue: string;
  monthlyRate: string;
  assignedBusiness: string;
  assignedPerson: string;
};

export type ExpenseForm = {
  id: number | null;
  date: string;
  desc: string;
  category: string;
  amount: string;
  relatedPerson: string;
  office: string;
};

export type InvoiceLineForm = { desc: string; category: string; amount: string };

export type InvoiceForm = {
  id: number | null;
  business: string;
  jy: string;
  jm: string;
  status: 'draft' | 'issued' | 'paid';
  lines: InvoiceLineForm[];
};

export type CommitmentForm = {
  id: number | null;
  desc: string;
  category: string;
  amount: string;
  dueDate: string;
  status: 'pending' | 'done';
};

export function buildOfficeCreateBody(form: OfficeCreateForm): OfficeCreateBody {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    totalSqm: Number(form.totalSqm) || 0,
    monthlyRent: Number(form.monthlyRent) || 0,
    areas: form.areas
      .map((a) => ({
        id: a.id,
        name: a.name.trim(),
        sqm: Number(a.sqm) || 0,
        monthlyRent: Number(a.monthlyRent) || 0,
        assignedBusiness: a.assignedBusiness.trim() || null,
      }))
      .filter((a) => a.name),
  };
}

export function buildPersonBody(form: PersonForm) {
  return {
    name: form.name.trim(),
    role: form.role.trim(),
    office: form.office.trim(),
    allocationMethod: form.allocationMethod === 'manual' ? 'manual' : 'auto',
  };
}

export function buildEquipmentBody(form: EquipmentForm) {
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    purchasePrice: Number(form.purchasePrice) || 0,
    currentValue: Number(form.currentValue) || 0,
    monthlyRate: Number(form.monthlyRate) || 0,
    assignedBusiness: form.assignedBusiness.trim(),
    assignedPerson: form.assignedPerson.trim(),
  };
}

export function buildExpenseBody(form: ExpenseForm) {
  return {
    date: form.date,
    desc: form.desc.trim(),
    category: form.category.trim(),
    amount: Number(form.amount) || 0,
    relatedPerson: form.relatedPerson.trim(),
    office: form.office.trim(),
  };
}

export function buildInvoiceBody(form: InvoiceForm) {
  return {
    business: form.business.trim(),
    jy: Number(form.jy) || 0,
    jm: Number(form.jm) || 0,
    status: form.status,
    lines: form.lines
      .map((l) => ({
        desc: l.desc.trim(),
        category: l.category.trim(),
        amount: Number(l.amount) || 0,
      }))
      .filter((l) => l.desc || l.amount),
  };
}

export function buildCommitmentBody(form: CommitmentForm) {
  return {
    desc: form.desc.trim(),
    category: form.category.trim(),
    amount: Number(form.amount) || 0,
    dueDate: form.dueDate,
    status: form.status === 'done' ? 'done' : 'pending',
  };
}
