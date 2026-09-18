/**
 * Admin sidebar information architecture.
 *
 * Groups (top → bottom): overview → users/platform → shop → sales → finance
 * → support/tickets → CRM club → staff/HR → content → system/settings.
 *
 * Ticketing is not a single product: sales tickets, club tickets, support chat,
 * and HR requests are four backends. Nav labels must stay distinct; club tickets
 * live under Support (not a second “تیکتینگ” under باشگاه).
 *
 * Do not drop routes or change perms here — only grouping and labels.
 */
import {
  Activity, BarChart3, Bell, Bot, Briefcase, Building2, ClipboardCheck, ClipboardList,
  Coins, FileText, Gamepad2, HandCoins, Headset, HeartHandshake, Image, Inbox, Landmark,
  LayoutDashboard, LineChart, Mail, MessageSquare, Newspaper, Package, PawPrint, PieChart,
  Route, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, Star, Stethoscope, Store,
  Tags, Target, Ticket, TrendingUp, UserPlus, UserRound, Users, Wallet, ArrowLeftRight,
} from 'lucide-react';
import type { CrmNavCounts, FinanceNavCounts, PlatformNavCounts, SalesNavCounts } from '@petdate/shared';
import { findLongestNavMatch } from './adminNavMatch';

export { findLongestNavMatch, matchAdminNavPath } from './adminNavMatch';

export type SalesBadgeKey = keyof SalesNavCounts;
export type PlatformBadgeKey = keyof PlatformNavCounts;
export type FinanceBadgeKey = keyof FinanceNavCounts;
export type CrmBadgeKey = keyof CrmNavCounts;
export type NavTone = 'finance' | 'sensitive';

export type AdminNavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  perm?: string;
  /** Visual language: money queues vs verify/delete-adjacent ops. */
  tone?: NavTone;
  salesBadgeKey?: SalesBadgeKey;
  platformBadgeKey?: PlatformBadgeKey;
  financeBadgeKey?: FinanceBadgeKey;
  crmBadgeKey?: CrmBadgeKey;
};

export type AdminNavGroup = { titleKey: string; items: AdminNavItem[] };

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { titleKey: 'admin.overview', items: [
    { to: '/admin/dashboard', icon: LayoutDashboard, labelKey: 'admin.platformDashboard' },
    { to: '/admin/analytics', icon: BarChart3, labelKey: 'admin.analytics', perm: 'platform.read' },
  ] },
  { titleKey: 'admin.platform', items: [
    { to: '/admin/users', icon: Users, labelKey: 'admin.users', perm: 'platform.read', platformBadgeKey: 'users' },
    { to: '/admin/pets', icon: PawPrint, labelKey: 'admin.pets', perm: 'platform.read', platformBadgeKey: 'pets' },
    { to: '/admin/playdates', icon: ClipboardList, labelKey: 'admin.playdates', perm: 'platform.read', platformBadgeKey: 'playdates' },
    { to: '/admin/consults', icon: Stethoscope, labelKey: 'admin.consults', perm: 'platform.read', platformBadgeKey: 'consults' },
    { to: '/admin/verification', icon: ShieldCheck, labelKey: 'admin.verification', perm: 'platform.write', platformBadgeKey: 'verification', tone: 'sensitive' },
    { to: '/admin/marketplace-moderation', icon: ClipboardList, labelKey: 'admin.docsPhotos', perm: 'platform.write', platformBadgeKey: 'docs', tone: 'sensitive' },
    { to: '/admin/events', icon: Gamepad2, labelKey: 'admin.games', perm: 'platform.read', platformBadgeKey: 'games' },
  ] },
  { titleKey: 'admin.store', items: [
    {
      to: '/admin/shop/orders',
      icon: ShoppingBag,
      labelKey: 'admin.orders',
      perm: 'shop.read',
      platformBadgeKey: 'shopOrders',
    },
    { to: '/admin/shop/products', icon: Package, labelKey: 'admin.products', perm: 'shop.read' },
    { to: '/admin/shop/categories', icon: Store, labelKey: 'admin.categories', perm: 'shop.read' },
    { to: '/admin/shop/brands', icon: Package, labelKey: 'admin.brands', perm: 'shop.read' },
  ] },
  { titleKey: 'admin.sales', items: [
    { to: '/admin/sales', icon: Inbox, labelKey: 'admin.myInbox', perm: 'sales.read' },
    { to: '/admin/sales/leads', icon: Users, labelKey: 'admin.leads', perm: 'sales.read', salesBadgeKey: 'leads' },
    { to: '/admin/sales/pet-purchase-requests', icon: PawPrint, labelKey: 'admin.petPurchaseRequests', perm: 'sales.read', salesBadgeKey: 'petPurchaseRequests' },
    { to: '/admin/sales/upgrades', icon: TrendingUp, labelKey: 'admin.upgrades', perm: 'upgrade.read', salesBadgeKey: 'upgrades' },
    { to: '/admin/sales/tickets', icon: Ticket, labelKey: 'admin.salesTickets', perm: 'sales.read', salesBadgeKey: 'tickets' },
    { to: '/admin/sales/calls', icon: Headset, labelKey: 'admin.callCenter', perm: 'sales.read', salesBadgeKey: 'callsQa' },
    { to: '/admin/sales/customers', icon: UserRound, labelKey: 'admin.salesCustomers', perm: 'sales.read', salesBadgeKey: 'customers' },
    { to: '/admin/sales/pipeline', icon: Target, labelKey: 'admin.pipeline', perm: 'sales.read' },
    { to: '/admin/sales/deals', icon: ShoppingBag, labelKey: 'admin.deals', perm: 'sales.read' },
    { to: '/admin/sales/products', icon: Package, labelKey: 'admin.productsPricing', perm: 'sales.read' },
    { to: '/admin/sales/reports', icon: LineChart, labelKey: 'admin.salesReports', perm: 'sales.read' },
    { to: '/admin/sales/settings', icon: Settings, labelKey: 'admin.salesSettings', perm: 'sales.read' },
  ] },
  { titleKey: 'admin.finance', items: [
    { to: '/admin/finance', icon: TrendingUp, labelKey: 'admin.financeDashboard', perm: 'finance.read' },
    {
      to: '/admin/payments',
      icon: Wallet,
      labelKey: 'admin.depositQueue',
      perm: 'finance.read',
      financeBadgeKey: 'payments',
      platformBadgeKey: 'payments',
      tone: 'finance',
    },
    {
      to: '/admin/coin-sells',
      icon: HandCoins,
      labelKey: 'admin.coinSellQueue',
      perm: 'finance.read',
      financeBadgeKey: 'coinSells',
      tone: 'finance',
    },
    {
      to: '/admin/finance/transactions',
      icon: ArrowLeftRight,
      labelKey: 'admin.transactions',
      perm: 'finance.read',
      financeBadgeKey: 'transactions',
      tone: 'finance',
    },
    { to: '/admin/finance/wallet', icon: Wallet, labelKey: 'admin.wallet', perm: 'finance.read', tone: 'finance' },
    {
      to: '/admin/finance/allocation',
      icon: Building2,
      labelKey: 'admin.allocation',
      perm: 'finance.read',
      financeBadgeKey: 'pendingAllocation',
      tone: 'finance',
    },
    { to: '/admin/finance/accounts', icon: Landmark, labelKey: 'admin.accounts', perm: 'finance.read' },
    { to: '/admin/finance/orders', icon: ShoppingBag, labelKey: 'admin.orderRevenue', perm: 'finance.read' },
    { to: '/admin/finance/sales', icon: LineChart, labelKey: 'admin.salesChart', perm: 'finance.read' },
    { to: '/admin/finance/pnl', icon: PieChart, labelKey: 'admin.pnl', perm: 'finance.read' },
    { to: '/admin/finance/products', icon: Package, labelKey: 'admin.topProducts', perm: 'finance.read' },
  ] },
  { titleKey: 'admin.support', items: [
    { to: '/admin/support', icon: Headset, labelKey: 'admin.supportInbox', perm: 'support.inbox' },
    {
      to: '/admin/crm/ticketing',
      icon: Ticket,
      labelKey: 'admin.ticketing',
      perm: 'crm.read',
      crmBadgeKey: 'tickets',
    },
  ] },
  { titleKey: 'admin.club', items: [
    { to: '/admin/crm', icon: LayoutDashboard, labelKey: 'admin.myDesk', perm: 'crm.read' },
    {
      to: '/admin/crm/inbox',
      icon: Inbox,
      labelKey: 'admin.inbox',
      perm: 'crm.read',
      crmBadgeKey: 'unassigned',
    },
    {
      to: '/admin/crm/cases',
      icon: ClipboardList,
      labelKey: 'admin.cases',
      perm: 'crm.read',
      crmBadgeKey: 'followups',
    },
    { to: '/admin/crm/customers', icon: HeartHandshake, labelKey: 'admin.customers360', perm: 'crm.read' },
    { to: '/admin/crm/calls', icon: Headset, labelKey: 'admin.calls', perm: 'crm.read' },
    { to: '/admin/crm/sms', icon: MessageSquare, labelKey: 'admin.sms', perm: 'crm.read' },
    { to: '/admin/crm/experience', icon: Star, labelKey: 'admin.cx', perm: 'crm.read' },
    { to: '/admin/crm/qa', icon: ClipboardCheck, labelKey: 'admin.qa', perm: 'crm.read' },
    { to: '/admin/crm/reports', icon: BarChart3, labelKey: 'admin.clubReports', perm: 'crm.read' },
    { to: '/admin/crm/settings', icon: Settings, labelKey: 'admin.clubSettings', perm: 'crm.read' },
  ] },
  { titleKey: 'admin.hr', items: [
    { to: '/admin/hr', icon: LayoutDashboard, labelKey: 'admin.hrDashboard', perm: 'hr.read' },
    { to: '/admin/hr/employees', icon: UserRound, labelKey: 'admin.hrEmployees', perm: 'hr.read' },
    { to: '/admin/hr/requests', icon: ClipboardCheck, labelKey: 'admin.hrTickets', perm: 'hr.read' },
    { to: '/admin/hr/cockpit', icon: Inbox, labelKey: 'admin.hrCockpit', perm: 'hr.read' },
    { to: '/admin/hr/contracts', icon: FileText, labelKey: 'admin.hrContracts', perm: 'hr.read' },
    { to: '/admin/hr/career', icon: Route, labelKey: 'admin.hrCareer', perm: 'hr.read' },
    { to: '/admin/hr/service', icon: HandCoins, labelKey: 'admin.hrService', perm: 'hr.read', tone: 'finance' },
    { to: '/admin/hr/reports', icon: BarChart3, labelKey: 'admin.hrReports', perm: 'hr.read' },
    { to: '/admin/hr/cost', icon: Coins, labelKey: 'admin.hrCost', perm: 'hr.read', tone: 'finance' },
    { to: '/admin/hr/compensation', icon: TrendingUp, labelKey: 'admin.hrComp', perm: 'hr.read', tone: 'finance' },
    { to: '/admin/hr/recruitment', icon: LayoutDashboard, labelKey: 'admin.atsDashboard', perm: 'ats.read' },
    { to: '/admin/hr/ats', icon: Briefcase, labelKey: 'admin.atsJobs', perm: 'ats.read' },
    { to: '/admin/hr/onboarding', icon: UserPlus, labelKey: 'admin.onboarding', perm: 'ats.read' },
    { to: '/admin/hr/armita', icon: Bot, labelKey: 'admin.armita', perm: 'hr.read' },
    { to: '/admin/hr/settings', icon: Settings, labelKey: 'admin.hrSettings', perm: 'hr.read' },
    { to: '/admin/hr/rbac', icon: Shield, labelKey: 'admin.rbac', perm: 'admin.full', tone: 'sensitive' },
  ] },
  { titleKey: 'admin.content', items: [
    { to: '/admin/magazine', icon: Newspaper, labelKey: 'admin.magazineNews', perm: 'content.write' },
    { to: '/admin/hero', icon: Image, labelKey: 'admin.heroPhotos', perm: 'content.write' },
    { to: '/admin/content', icon: Bell, labelKey: 'admin.noticesContent', perm: 'content.write' },
  ] },
  { titleKey: 'admin.system', items: [
    { to: '/admin/tag-manager', icon: Tags, labelKey: 'admin.tagManager', perm: 'platform.read' },
    { to: '/admin/monitoring', icon: Activity, labelKey: 'admin.monitoring', perm: 'platform.read' },
    { to: '/admin/logs', icon: ScrollText, labelKey: 'admin.errorLogs', perm: 'platform.read', tone: 'sensitive' },
    { to: '/admin/mail', icon: Mail, labelKey: 'admin.mailSmtp', perm: 'platform.read' },
    { to: '/admin/settings', icon: Settings, labelKey: 'admin.platformSettings', perm: 'platform.write' },
  ] },
];

/** Root paths that must not stay active on nested routes (NavLink `end`). */
export const ADMIN_NAV_END_HREFS = new Set([
  '/admin/dashboard',
  '/admin/sales',
  '/admin/crm',
  '/admin/finance',
  '/admin/hr',
]);

export function findActiveNavItem(
  pathname: string,
  groups: AdminNavGroup[] = ADMIN_NAV_GROUPS
): AdminNavItem | undefined {
  return findLongestNavMatch(pathname, groups.flatMap((g) => g.items));
}

export function findActiveGroupTitle(
  pathname: string,
  groups: AdminNavGroup[]
): string {
  const flat = groups.flatMap((g) => g.items.map((it) => ({ ...it, titleKey: g.titleKey })));
  return findLongestNavMatch(pathname, flat)?.titleKey || groups[0]?.titleKey || '';
}

export function pageTitleKey(pathname: string): string {
  return findActiveNavItem(pathname)?.labelKey ?? 'admin.platformDashboard';
}

export function itemBadge(
  item: AdminNavItem,
  salesCounts: SalesNavCounts | null,
  platformCounts: PlatformNavCounts | null,
  financeCounts: FinanceNavCounts | null,
  crmCounts: CrmNavCounts | null
): number {
  if (item.financeBadgeKey && financeCounts) {
    const n = Number(financeCounts[item.financeBadgeKey] || 0);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (item.crmBadgeKey && crmCounts) {
    const n = Number(crmCounts[item.crmBadgeKey] || 0);
    return Number.isFinite(n) ? n : 0;
  }
  if (item.salesBadgeKey && salesCounts) {
    const n = Number(salesCounts[item.salesBadgeKey] || 0);
    return Number.isFinite(n) ? n : 0;
  }
  if (item.platformBadgeKey && platformCounts) {
    const n = Number(platformCounts[item.platformBadgeKey] || 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
