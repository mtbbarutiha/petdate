/**
 * Combined admin platform dashboard — aggregates live KPIs + chart series
 * from platform / HR / sales CRM / customer CRM / mail.
 * Additive only: never wipes; empty modules return zeros.
 */
import { salesStageLabel, type SalesStage } from '@petdate/shared';
import { adminPlatform } from './admin-platform';
import { adminFinance } from './admin-finance';
import { getDb, dbService } from './db';
import type { AdminAuthActor } from './hr-service';
import { getHrOverviewDashboard } from './hr-modules';
import { getSalesDashboard, getSalesReportSummary } from './sales-service';
import { getCrmDashboard, getCrmReportSummary } from './crm-service';
import {
  getInboxPublicStatus,
  isInboxConfigured,
  listInboxMessages,
} from './services/mail-inbox';
import { decorateAiConsultDisplay } from './services/ai-consult-session';

export type ChartPoint = { label: string; value: number };
export type ChartSlice = { label: string; value: number; color: string };

const MODULE_COLORS = {
  platform: '#5c4d91',
  hr: '#15cca0',
  sales: '#f59e0b',
  crm: '#0ea5e9',
  mail: '#64748b',
  pets: '#8b5cf6',
  playdates: '#ec4899',
  consults: '#14b8a6',
  revenue: '#5c4d91',
} as const;

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dailyCounts(table: string, days = 14): ChartPoint[] {
  const labels = lastNDays(days);
  const allowed = new Set([
    'users',
    'pets',
    'playdate_requests',
    'vet_consultations',
    'shop_orders',
    'payment_orders',
  ]);
  if (!allowed.has(table)) {
    return labels.map((label) => ({ label, value: 0 }));
  }
  try {
    const rows = getDb()
      .prepare(
        `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS c
         FROM ${table}
         WHERE created_at >= ?
         GROUP BY d`
      )
      .all(`${labels[0]}T00:00:00`) as Array<{ d: string; c: number }>;
    const map = new Map(rows.map((r) => [String(r.d), Number(r.c) || 0]));
    return labels.map((label) => ({ label, value: map.get(label) || 0 }));
  } catch {
    return labels.map((label) => ({ label, value: 0 }));
  }
}

function zeroHr() {
  return {
    personnel: 0,
    activeAccess: 0,
    inactiveAccess: 0,
    cockpitTasks: 0,
    serviceHoursMonth: 0,
    orgCostMonth: 0,
    unreadNotifications: 0,
    openRequests: 0,
    openOnboarding: 0,
  };
}

function zeroSales() {
  return {
    activeLeads: 0,
    activeUpgrades: 0,
    salesTodayCount: 0,
    salesTodayValue: 0,
    overdueFollowups: 0,
    pendingFinance: 0,
    callsToday: 0,
    callMinutesToday: 0,
    totalWonValue: 0,
    aov: 0,
    unassigned: 0,
  };
}

function zeroCrm() {
  return {
    openTickets: 0,
    breachedSla: 0,
    atRiskSla: 0,
    unassigned: 0,
    overdueFollowups: 0,
    openComplaints: 0,
    openReferrals: 0,
    callsToday: 0,
    callMinutesToday: 0,
    avgCsat: null as number | null,
    wrapPending: 0,
  };
}

async function mailStats(): Promise<{
  configured: boolean;
  address: string;
  unread: number;
  total: number;
}> {
  const status = getInboxPublicStatus();
  if (!isInboxConfigured()) {
    return { configured: false, address: status.address, unread: 0, total: 0 };
  }
  try {
    const listed = await listInboxMessages(200);
    return {
      configured: true,
      address: status.address,
      total: listed.length,
      unread: listed.filter((m) => m.unread).length,
    };
  } catch {
    return { configured: true, address: status.address, unread: 0, total: 0 };
  }
}

export async function buildAggregateDashboard(actor: AdminAuthActor) {
  const stats = adminPlatform.getDashboardStats();
  const mail = await mailStats();

  let hr = zeroHr();
  try {
    hr = getHrOverviewDashboard().kpis;
  } catch {
    /* empty module → zeros */
  }

  let sales = zeroSales();
  let salesStages: ChartPoint[] = [];
  let salesDailyRevenue: ChartPoint[] = [];
  let salesDailyCalls: ChartPoint[] = [];
  try {
    const dash = getSalesDashboard(actor);
    sales = {
      activeLeads: dash.activeLeads,
      activeUpgrades: dash.activeUpgrades,
      salesTodayCount: dash.salesTodayCount,
      salesTodayValue: dash.salesTodayValue,
      overdueFollowups: dash.overdueFollowups,
      pendingFinance: dash.pendingFinance,
      callsToday: dash.callsToday,
      callMinutesToday: dash.callMinutesToday,
      totalWonValue: dash.totalWonValue,
      aov: dash.aov,
      unassigned: dash.unassigned,
    };
    salesStages = (dash.stageCounts || []).map((s) => {
      const stage: SalesStage = s.stage === 'lost' ? 'lost' : Number(s.stage);
      return {
        label: salesStageLabel(stage) || `مرحله ${s.stage}`,
        value: s.count,
      };
    });
    const report = getSalesReportSummary();
    salesDailyRevenue = (report.dailyRevenue || []).map((p) => ({
      label: p.day,
      value: p.value,
    }));
    salesDailyCalls = (report.dailyCalls || []).map((p) => ({
      label: p.day,
      value: p.count,
    }));
  } catch {
    /* empty */
  }

  let crm = zeroCrm();
  let crmReasons: ChartPoint[] = [];
  let crmDailyTickets: ChartPoint[] = [];
  try {
    const dash = getCrmDashboard(actor);
    crm = {
      openTickets: dash.openTickets,
      breachedSla: dash.breachedSla,
      atRiskSla: dash.atRiskSla,
      unassigned: dash.unassigned,
      overdueFollowups: dash.overdueFollowups,
      openComplaints: dash.openComplaints,
      openReferrals: dash.openReferrals,
      callsToday: dash.callsToday,
      callMinutesToday: dash.callMinutesToday,
      avgCsat: dash.avgCsat,
      wrapPending: dash.wrapPending,
    };
    const report = getCrmReportSummary(actor);
    crmReasons = (report.byReason || [])
      .map((r) => ({ label: r.reason, value: r.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    crmDailyTickets = (report.dailyTickets || []).map((p) => ({
      label: p.day,
      value: p.count,
    }));
  } catch {
    /* empty */
  }

  let revenueTrend: ChartPoint[] = [];
  let paymentMix: ChartPoint[] = [];
  try {
    const charts = adminFinance.getSalesCharts('month');
    revenueTrend = charts.dailyOrMonthly || [];
    paymentMix = (charts.paymentMix || []).map((p) => ({
      label: p.label,
      value: p.value,
    }));
  } catch {
    revenueTrend = [];
    paymentMix = [];
  }

  const usersTrend = dailyCounts('users');
  const petsTrend = dailyCounts('pets');
  const playdatesTrend = dailyCounts('playdate_requests');
  const consultsTrend = dailyCounts('vet_consultations');

  const moduleMix: ChartSlice[] = [
    {
      label: 'پلتفرم (فعال)',
      value:
        stats.playdatesPending +
        stats.vetConsultsOpen +
        stats.paymentOrdersPending +
        Math.min(stats.shopOrders, 50),
      color: MODULE_COLORS.platform,
    },
    {
      label: 'پیوند / HR',
      value: hr.openRequests + hr.cockpitTasks + hr.openOnboarding,
      color: MODULE_COLORS.hr,
    },
    {
      label: 'فروش',
      value: sales.activeLeads + sales.activeUpgrades + sales.pendingFinance,
      color: MODULE_COLORS.sales,
    },
    {
      label: 'باشگاه مشتریان',
      value: crm.openTickets + crm.openComplaints + crm.overdueFollowups,
      color: MODULE_COLORS.crm,
    },
    {
      label: 'ایمیل',
      value: mail.unread,
      color: MODULE_COLORS.mail,
    },
  ];

  const activityBreakdown: ChartPoint[] = [
    { label: 'کاربران', value: stats.users },
    { label: 'پت‌ها', value: stats.pets },
    { label: 'همبازی', value: stats.playdates },
    { label: 'مشاوره', value: stats.vetConsults },
    { label: 'سفارش', value: stats.shopOrders },
  ];

  return {
    generatedAt: new Date().toISOString(),
    stats,
    modules: {
      platform: {
        users: stats.users,
        pets: stats.pets,
        playdates: stats.playdates,
        playdatesPending: stats.playdatesPending,
        vetConsults: stats.vetConsults,
        vetConsultsOpen: stats.vetConsultsOpen,
        shopOrders: stats.shopOrders,
        shopRevenueToman: stats.shopRevenueToman,
        paymentOrdersPending: stats.paymentOrdersPending,
        walletToman: stats.walletTotals.toman,
        errors24h: stats.botRelated.errors24h,
      },
      hr,
      sales,
      crm,
      mail,
    },
    series: {
      usersTrend,
      petsTrend,
      playdatesTrend,
      consultsTrend,
      revenueTrend,
      salesDailyRevenue,
      salesDailyCalls,
      salesStages,
      crmDailyTickets,
      crmReasons,
      paymentMix,
      activityBreakdown,
      moduleMix,
    },
    links: {
      platform: '/admin/dashboard',
      users: '/admin/users',
      pets: '/admin/pets',
      playdates: '/admin/playdates',
      consults: '/admin/consults',
      shopOrders: '/admin/shop/orders',
      finance: '/admin/finance',
      payments: '/admin/payments',
      hr: '/admin/hr',
      sales: '/admin/sales',
      crm: '/admin/crm',
      mail: '/admin/mail',
    },
    recentPets: dbService.listPets().slice(0, 8),
    recentPlaydates: dbService.listPlaydateRequests().slice(0, 8),
    recentConsults: dbService
      .listVetConsultations({ all: true })
      .slice(0, 8)
      .map(decorateAiConsultDisplay),
    recentShopOrders: adminPlatform.listShopOrders({ limit: 8 }),
  };
}
