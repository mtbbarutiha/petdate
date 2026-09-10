/**
 * Finance OS (هلدینگ) — accounts, ledger, SBG cost allocation.
 * Shared DTOs for admin API + web.
 */

export const FINANCE_OS_ACCOUNT_TYPES = [
  'بانک رسمی',
  'درگاه پرداخت',
  'BNPL',
  'کیف پول نقدی',
  'چک / اسناد',
] as const;
export type FinanceOsAccountType = (typeof FINANCE_OS_ACCOUNT_TYPES)[number];

export const FINANCE_OS_DEDICATIONS = ['اختصاصی', 'مشترک'] as const;
export type FinanceOsDedication = (typeof FINANCE_OS_DEDICATIONS)[number];

export const FINANCE_OS_TX_STATUSES = [
  'queued',
  'classified',
  'suspicious',
] as const;
export type FinanceOsTxStatus = (typeof FINANCE_OS_TX_STATUSES)[number];

export interface FinanceOsBusiness {
  id: number;
  name: string;
  code: string;
}

export interface FinanceOsSalesTeam {
  id: number;
  code: string;
  supervisor: string;
}

export interface FinanceOsBalanceSnapshot {
  date: string;
  amount: number;
  source: string;
  note?: string;
}

export interface FinanceOsVolumeAllocation {
  jy: number;
  jm: number;
  allocations: Array<{ business: string; amount: number }>;
}

export interface FinanceOsAccount {
  id: number;
  code: string;
  status: 'active' | 'inactive';
  type: string;
  dedication: string;
  provider: string;
  line: string;
  feePercent: number;
  openingBalance: number;
  owner: string;
  connectionType: string;
  accountNumber: string;
  iban: string;
  cardNumber: string;
  notes: string;
  providerFeePercent?: number;
  sbgMarginPercent?: number;
  snapshots: FinanceOsBalanceSnapshot[];
  volumeAllocations: FinanceOsVolumeAllocation[];
  refunds: Array<{ date: string; business: string; amount: number; note?: string }>;
  currentBalance: number;
}

export interface FinanceOsPersonPayment {
  jy: number;
  jm: number;
  type: string;
  amount: number;
  note?: string;
}

export interface FinanceOsPerson {
  id: number;
  name: string;
  role: string;
  dept: string;
  line: string;
  sales: boolean;
  teamCode: string | null;
  teamHistory: Array<{ code: string; from: string }>;
  payments: FinanceOsPersonPayment[];
}

export interface FinanceOsOffice {
  id: number;
  name: string;
  address: string;
  totalSqm: number;
  spaceAllocations: Array<{
    jy: number;
    jm: number;
    allocations: Array<{ business: string; sqm: number }>;
  }>;
  headcountAllocations: Array<{
    jy: number;
    jm: number;
    allocations: Array<{ business: string; count: number }>;
  }>;
  areas: Array<{
    id: string;
    name: string;
    sqm: number;
    monthlyRent: number;
    assignedBusiness?: string | null;
  }>;
}

export interface FinanceOsDimGroup {
  key: string;
  kind: 'income' | 'expense';
  items: string[];
}

export interface FinanceOsCategoryNode {
  name: string;
  children: FinanceOsCategoryNode[];
}

export interface FinanceOsTransaction {
  id: number;
  account: string;
  date: string;
  amount: number;
  desc: string;
  status: FinanceOsTxStatus;
  note: string;
  line: string;
  saleType?: string;
  expenseType?: string;
  category?: string;
  campaign?: string;
  product?: string;
  paymentStatus?: string;
  seller?: string;
  relatedPerson?: string;
  rawDetails: Record<string, string>;
  suspiciousReason?: string;
  duplicateOfId?: number | null;
}

export interface FinanceOsImportLog {
  id: number;
  at: string;
  account: string;
  fileName: string;
  rows: number;
  method: 'file' | 'api' | 'manual';
  status: 'success' | 'failed';
}

export interface FinanceOsEquipment {
  id: number;
  code: string;
  category: string;
  expenseCategory: string;
  name: string;
  brand: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  monthlyRate: number;
  ownership: string;
  assignedBusiness: string;
  assignedPerson: string;
}

export interface FinanceOsSbgPerson {
  id: number;
  name: string;
  role: string;
  office: string;
  allocationMethod: 'auto' | 'manual';
  timeAllocations: Array<{
    jy: number;
    jm: number;
    allocations: Array<{ business: string; percent: number }>;
  }>;
}

export interface FinanceOsSbgExpense {
  id: number;
  date: string;
  amount: number;
  desc: string;
  category: string;
  relatedPerson: string;
  account: string;
  allocated: boolean;
  splits: Array<{ business: string; amount: number; basis: string }>;
}

export interface FinanceOsInvoice {
  id: number;
  number: string;
  business: string;
  jy: number;
  jm: number;
  total: number;
  status: 'draft' | 'issued' | 'paid';
  lines: Array<{ desc: string; category: string; amount: number }>;
  createdAt: string;
}

export interface FinanceOsCommitment {
  id: number;
  desc: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'done';
}

export interface FinanceOsAccountsBundle {
  accounts: FinanceOsAccount[];
  businesses: FinanceOsBusiness[];
  salesTeams: FinanceOsSalesTeam[];
  people: FinanceOsPerson[];
  offices: FinanceOsOffice[];
  incomeDims: FinanceOsDimGroup[];
  expenseDims: FinanceOsDimGroup[];
  categoryTree: FinanceOsCategoryNode[];
  snappay: {
    providerFeePercent: number;
    sbgMarginPercent: number;
    volumes: FinanceOsVolumeAllocation[];
  };
}

export interface FinanceOsTransactionsBundle {
  transactions: FinanceOsTransaction[];
  importLog: FinanceOsImportLog[];
  accounts: Array<{ code: string; provider: string; line: string }>;
  queueCount: number;
  suspiciousCount: number;
  ledgerSummary: {
    income: number;
    expense: number;
    refundReturn: number;
    net: number;
    count: number;
  };
}

export interface FinanceOsAllocationBundle {
  offices: FinanceOsOffice[];
  sbgPeople: FinanceOsSbgPerson[];
  equipment: FinanceOsEquipment[];
  expenses: FinanceOsSbgExpense[];
  invoices: FinanceOsInvoice[];
  commitments: FinanceOsCommitment[];
  bankBalance: number;
  businesses: FinanceOsBusiness[];
  pendingAllocationCount: number;
}
