/** Header bell notifications for the Pepito admin shell. */

export type AdminNotificationKind = 'info' | 'success' | 'warn' | 'bad';

export type AdminHeaderNotification = {
  /** Stable id: `db:12` | `hr:3` | `live:sales-open` | `live:mail-unread` | `live:payments-queue` */
  id: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
  href: string;
  module: 'hr' | 'sales' | 'mail' | 'platform' | 'admin' | 'finance' | 'crm' | 'shop';
  date: string;
  read: boolean;
  canMarkRead: boolean;
};

export type AdminNotificationsPayload = {
  items: AdminHeaderNotification[];
  unreadCount: number;
};
