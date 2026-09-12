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
}
