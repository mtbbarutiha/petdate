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
import { listEmployees as listHrEmployees, listCandidates } from './hr-service';
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

export type DashboardFilters = {
  from?: string;
  to?: string;
  /** Department / team name */
  team?: string;
  /** Employee or platform user id */
  personId?: number;
  /** Slice filters from chart clicks */
  module?: string;
  paymentType?: string;
  salesStage?: string;
};

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

function dayInRange(day: string, from?: string, to?: string): boolean {
  if (from && day < from.slice(0, 10)) return false;
  if (to && day > to.slice(0, 10)) return false;
  return true;
}

function lastNDays(n: number, from?: string, to?: string): string[] {
  if (from && to) {
    const days: string[] = [];
    const start = new Date(from.slice(0, 10) + 'T12:00:00');
    const end = new Date(to.slice(0, 10) + 'T12:00:00');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      const cur = new Date(start);
      let guard = 0;
      while (cur <= end && guard < 120) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
        guard += 1;
      }
      if (days.length) return days;
    }
  }
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function dailyCounts(
  table: string,
  days: string[],
  extraWhere?: string,
  extraParams: unknown[] = []
): ChartPoint[] {
  const allowed = new Set([
    'users',
    'pets',
    'playdate_requests',
    'vet_consultations',
    'shop_orders',
    'payment_orders',
  ]);
  if (!allowed.has(table) || !days.length) {
    return days.map((label) => ({ label, value: 0 }));
  }
  try {
    const rows = getDb()
      .prepare(
        `SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS c
         FROM ${table}
         WHERE created_at >= ? AND created_at <= ?
         ${extraWhere || ''}
         GROUP BY d`
      )
      .all(`${days[0]}T00:00:00`, `${days[days.length - 1]}T23:59:59`, ...extraParams) as Array<{
      d: string;
      c: number;
    }>;
    const map = new Map(rows.map((r) => [String(r.d), Number(r.c) || 0]));
    return days.map((label) => ({ label, value: map.get(label) || 0 }));
  } catch {
    return days.map((label) => ({ label, value: 0 }));
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

function filterPoints(points: ChartPoint[], from?: string, to?: string): ChartPoint[] {
  if (!from && !to) return points;
  return points.filter((p) => dayInRange(String(p.label).slice(0, 10), from, to));
}

export async function buildAggregateDashboard(
  actor: AdminAuthActor,
  filters: DashboardFilters = {}
) {
  const stats = adminPlatform.getDashboardStats();
  const mail = await mailStats();
  const days = lastNDays(14, filters.from, filters.to);

  let hr = zeroHr();
  try {
    hr = getHrOverviewDashboard().kpis;
    if (filters.team) {
      const { employees } = listHrEmployees({ limit: 500 });
      const inTeam = employees.filter((e) => (e.department || '').trim() === filters.team!.trim());
      hr = {
        ...hr,
        personnel: inTeam.length,
        activeAccess: inTeam.filter((e) => e.accessStatus === 'فعال').length,
        inactiveAccess: inTeam.filter((e) => e.accessStatus !== 'فعال').length,
      };
    }
    if (filters.personId) {
      const emp = listHrEmployees({ limit: 500 }).employees.find((e) => e.id === filters.personId);
      if (emp) {
        hr = {
          ...hr,
          personnel: 1,
          activeAccess: emp.accessStatus === 'فعال' ? 1 : 0,
          inactiveAccess: emp.accessStatus === 'فعال' ? 0 : 1,
        };
      }
    }
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
    if (filters.salesStage) {
      salesStages = salesStages.filter((s) => s.label === filters.salesStage);
    }
    const report = getSalesReportSummary();
    salesDailyRevenue = filterPoints(
      (report.dailyRevenue || []).map((p) => ({ label: p.day, value: p.value })),
      filters.from,
      filters.to
    );
    salesDailyCalls = filterPoints(
      (report.dailyCalls || []).map((p) => ({ label: p.day, value: p.count })),
      filters.from,
      filters.to
    );
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
    crmDailyTickets = filterPoints(
      (report.dailyTickets || []).map((p) => ({ label: p.day, value: p.count })),
      filters.from,
      filters.to
    );
  } catch {
    /* empty */
  }

  let revenueTrend: ChartPoint[] = [];
  let paymentMix: ChartPoint[] = [];
  try {
    const charts = adminFinance.getSalesCharts('month');
    revenueTrend = filterPoints(charts.dailyOrMonthly || [], filters.from, filters.to);
    paymentMix = (charts.paymentMix || []).map((p) => ({
      label: p.label,
      value: p.value,
    }));
    if (filters.paymentType) {
      paymentMix = paymentMix.filter((p) => p.label === filters.paymentType);
    }
  } catch {
    revenueTrend = [];
    paymentMix = [];
  }

  const usersTrend = dailyCounts('users', days);
  const petsTrend = dailyCounts('pets', days);
  const playdatesTrend = dailyCounts('playdate_requests', days);
  const consultsTrend = dailyCounts('vet_consultations', days);

  let moduleMix: ChartSlice[] = [
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
  if (filters.module) {
    moduleMix = moduleMix.filter((s) => s.label === filters.module || s.label.includes(filters.module!));
  }

  const activityBreakdown: ChartPoint[] = [
    { label: 'کاربران', value: stats.users },
    { label: 'پت‌ها', value: stats.pets },
    { label: 'همبازی', value: stats.playdates },
    { label: 'مشاوره', value: stats.vetConsults },
    { label: 'سفارش', value: stats.shopOrders },
  ];

  // Filter option lists for UI
  let filterOptions = { teams: [] as string[], people: [] as Array<{ id: number; name: string }> };
  try {
    const { employees } = listHrEmployees({ limit: 500 });
    filterOptions = {
      teams: [
        ...new Set(employees.map((e) => (e.department || '').trim()).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, 'fa')),
      people: employees.slice(0, 200).map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim() || e.personnelCode || `#${e.id}`,
      })),
    };
  } catch {
    /* empty */
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      from: filters.from || null,
      to: filters.to || null,
      team: filters.team || null,
      personId: filters.personId || null,
      module: filters.module || null,
      paymentType: filters.paymentType || null,
      salesStage: filters.salesStage || null,
    },
    filterOptions,
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

export type ActivityRow = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entityType: string;
  entityLabel: string;
  refPath?: string;
  source: string;
};

/** Aggregate recent system activity from available logs (users + staff). */
export function getPlatformActivity(opts?: {
  limit?: number;
  from?: string;
  to?: string;
  team?: string;
  personId?: number;
}): { generatedAt: string; rows: ActivityRow[] } {
  const limit = Math.min(200, Math.max(10, opts?.limit || 80));
  const rows: ActivityRow[] = [];
  const d = getDb();
  const from = opts?.from?.slice(0, 10);
  const to = opts?.to?.slice(0, 10);

  const inWindow = (raw: string) => {
    const day = String(raw || '').slice(0, 10);
    if (!day) return true;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  try {
    const logs = d
      .prepare(
        `SELECT l.*, e.first_name, e.last_name, e.department FROM hr_employee_logs l
         JOIN hr_employees e ON e.id = l.employee_id
         ORDER BY l.id DESC LIMIT 80`
      )
      .all() as Array<Record<string, unknown>>;
    for (const r of logs) {
      const at = String(r.logged_at || '');
      if (!inWindow(at)) continue;
      if (opts?.team && String(r.department || '').trim() !== opts.team.trim()) continue;
      if (opts?.personId && Number(r.employee_id) !== opts.personId) continue;
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      rows.push({
        id: `hr-log-${r.id}`,
        at,
        actor: name || 'پرسنل',
        action: `تغییر ${r.field}: ${r.old_value || '—'} ← ${r.new_value || '—'}`,
        entityType: 'employee',
        entityLabel: name,
        refPath: `/admin/hr/employees/${r.employee_id}`,
        source: 'hr_employee_logs',
      });
    }
  } catch {
    /* table may be empty */
  }

  try {
    for (const c of listCandidates().slice(0, 40)) {
      for (const log of (c.logs || []).slice(-3)) {
        if (!inWindow(log.at)) continue;
        rows.push({
          id: `cand-${c.id}-${log.at}`,
          at: log.at,
          actor: `${c.firstName} ${c.lastName}`.trim(),
          action: `مرحله متقاضی: ${log.stage}${log.note ? ` · ${log.note}` : ''}`,
          entityType: 'candidate',
          entityLabel: `${c.firstName} ${c.lastName}`.trim(),
          refPath: '/admin/hr/ats',
          source: 'hr_candidates',
        });
      }
    }
  } catch {
    /* empty */
  }

  try {
    const errs = d
      .prepare(
        `SELECT id, level, message, created_at FROM app_error_logs
         ORDER BY id DESC LIMIT 40`
      )
      .all() as Array<{ id: number; level: string; message: string; created_at: string }>;
    for (const e of errs) {
      if (!inWindow(e.created_at)) continue;
      rows.push({
        id: `err-${e.id}`,
        at: e.created_at,
        actor: 'سیستم',
        action: `[${e.level}] ${String(e.message || '').slice(0, 120)}`,
        entityType: 'error',
        entityLabel: `#${e.id}`,
        refPath: '/admin/logs',
        source: 'app_error_logs',
      });
    }
  } catch {
    /* empty */
  }

  try {
    const tickets = d
      .prepare(
        `SELECT id, subject, status, created_at, updated_at FROM crm_tickets
         ORDER BY id DESC LIMIT 40`
      )
      .all() as Array<{
      id: number;
      subject: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>;
    for (const t of tickets) {
      const at = t.updated_at || t.created_at;
      if (!inWindow(at)) continue;
      rows.push({
        id: `ticket-${t.id}`,
        at,
        actor: 'باشگاه مشتریان',
        action: `تیکت ${t.status}: ${String(t.subject || '').slice(0, 80)}`,
        entityType: 'ticket',
        entityLabel: `#${t.id}`,
        refPath: `/admin/crm/tickets/${t.id}`,
        source: 'crm_tickets',
      });
    }
  } catch {
    /* empty */
  }

  try {
    const users = d
      .prepare(
        `SELECT id, name, created_at FROM users ORDER BY id DESC LIMIT 30`
      )
      .all() as Array<{ id: number; name: string; created_at: string }>;
    for (const u of users) {
      if (!inWindow(u.created_at)) continue;
      rows.push({
        id: `user-${u.id}`,
        at: u.created_at,
        actor: u.name || `کاربر #${u.id}`,
        action: 'ثبت‌نام / ایجاد کاربر',
        entityType: 'user',
        entityLabel: u.name || `#${u.id}`,
        refPath: `/admin/users/${u.id}`,
        source: 'users',
      });
    }
  } catch {
    /* empty */
  }

  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    generatedAt: new Date().toISOString(),
    rows: rows.slice(0, limit),
  };
}
