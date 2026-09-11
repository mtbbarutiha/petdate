import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Pepito accent tones used across KPI / module cards. */
export type AdminDashTone = 'mint' | 'violet' | 'orange' | 'sky' | 'slate';

export type AdminKpiItem = {
  key?: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: AdminDashTone;
  to?: string;
  /** Emphasize revenue / highlight cards (wider). */
  wide?: boolean;
};

export type AdminModuleItem = {
  label: string;
  value: ReactNode;
};

export type AdminModuleCardProps = {
  title: string;
  to: string;
  icon?: LucideIcon;
  tone?: AdminDashTone;
  items: AdminModuleItem[];
  openLabel?: string;
};
