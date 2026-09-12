/** Live sidebar badge counts for Platform admin nav (open / pending queues). */
export interface PlatformNavCounts {
  /** Pending user avatar moderation */
  users: number;
  /** Pending pet photo moderation */
  pets: number;
  /** Playdate requests awaiting accept/reject */
  playdates: number;
  /** Vet/trainer consults in requested or active status */
  consults: number;
  /** Identity verification submissions awaiting review */
  verification: number;
  /** Pending credentials + photo/avatar moderation (مدارک و عکس queue) */
  docs: number;
  /**
   * Card-to-card deposits awaiting finance review:
   * status=pending, or awaiting_receipt with a receipt already attached (stuck recovery).
   */
  payments: number;
  /** Shop orders awaiting fulfillment (pending / paid, not shipped/completed/cancelled). */
  shopOrders: number;
  /** Scheduled games currently open for join. */
  games: number;
}

/** Live sidebar badge counts for Finance OS + deposit approval queues. */
export interface FinanceNavCounts {
  /** Card-to-card deposits awaiting finance approve/reject (same query as PlatformNavCounts.payments). */
  payments: number;
  /** Unclassified imported ledger rows */
  queue: number;
  /** Flagged suspicious transactions */
  suspicious: number;
  /** queue + suspicious — badge on تراکنش‌ها */
  transactions: number;
  /** Shared expenses not yet allocated to businesses */
  pendingAllocation: number;
  /** Open coin-sell / earn withdrawal requests awaiting payout */
  coinSells: number;
}

/** Live sidebar badge counts for باشگاه مشتریان / CRM. */
export interface CrmNavCounts {
  /** Open CRM tickets (SLA clock running) */
  tickets: number;
  /** Unassigned open tickets (inbox pressure) */
  unassigned: number;
  /** Open follow-ups */
  followups: number;
}
