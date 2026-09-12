/**
 * باشگاه مشتریان / امور مشتریان — persistence & workflows (additive, never wipe).
 */
import {
  CRM_CHANNEL_LABELS,
  CRM_CRITICAL_ERRORS,
  CRM_REASON_TREE,
  CRM_SCORECARD,
  CRM_SLA_POLICY,
  CRM_SURVEY_QUESTIONS,
  CRM_TICKET_OPEN_STATUSES,
  CRM_TICKET_QUEUES,
  crmFirstResponseDueIso,
  crmInboxBorderColor,
  crmKpiAchievement,
  crmKpiStanding,
  crmQaTotal,
  crmQueueOf,
  crmSlaDueIso,
  crmSlaLabel,
  crmSlaState,
  crmSurveyRating,
  formatIranMobileDisplay,
  makeCrmUuid,
  normalizeIranMobile,
  type CrmChannel,
  type CrmComplaint,
  type CrmCustomer,
  type CrmDashboard,
  type CrmFollowup,
  type CrmInboxRow,
  type CrmInteraction,
  type CrmKpiModel,
  type CrmOrder,
  type CrmQaReview,
  type CrmReferral,
  type CrmChartPoint,
  type CrmKpiRing,
  type CrmReportSummary,
  type CrmSettings,
  type CrmSmsPattern,
  type CrmSurvey,
  type CrmTask,
  type CrmTicket,
  type CrmTicketActivity,
  type CrmTicketingAgent,
  type CrmTicketingOverview,
  type CrmNavCounts,
} from '@petdate/shared';
import { getDb } from './db';
import type { AdminAuthActor } from './hr-service';
import { actorHasPermission, listEmployees } from './hr-service';
import { candooSendWithSrcFallback, isCandooConfigured } from './services/candoo';

function db() {
  return getDb();
}
function nowIso(): string {
  return new Date().toISOString();
}
/** Active SLA policy from persisted CRM settings (falls back to defaults). */
function activeSlaPolicy(): Record<string, [number, number]> {
  return getCrmSettings().slaPolicy;
}
function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}
function actorId(actor: AdminAuthActor): string {
  return actor.username || actor.role || 'admin';
}
function actorLabel(actor: AdminAuthActor): string {
  return actor.displayName || actor.username || actor.role || 'admin';
}
export function isCrmAdmin(actor: AdminAuthActor): boolean {
  return actorHasPermission(actor, 'crm.admin') || actorHasPermission(actor, 'admin.full');
}
function canSeeTeamReports(actor: AdminAuthActor): boolean {
  return isCrmAdmin(actor) || actorHasPermission(actor, 'admin.full');
}
function normalizeMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function audit(opts: {
  userId: string;
  category: string;
  entity: string;
  recordUuid: string;
  action: string;
  prev?: unknown;
  next?: unknown;
}): void {
  db()
    .prepare(
      `INSERT INTO crm_audit_logs (at, user_id, category, entity, record_uuid, action, prev_value, new_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      nowIso(),
      opts.userId,
      opts.category,
      opts.entity,
      opts.recordUuid,
      opts.action,
      opts.prev != null ? JSON.stringify(opts.prev) : null,
      opts.next != null ? JSON.stringify(opts.next) : null
    );
}

export function ensureCrmSchema(): void {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS crm_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '',
      email TEXT,
      product TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'عادی',
      status TEXT NOT NULL DEFAULT 'فعال',
      sales_owner TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      csat REAL,
      platform_user_id INTEGER,
      sales_customer_id INTEGER,
      finance_snapshot_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      ordered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      channel TEXT NOT NULL DEFAULT 'call_in',
      direction TEXT NOT NULL DEFAULT 'in',
      agent_id TEXT NOT NULL DEFAULT '',
      agent_name TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      wait_seconds INTEGER NOT NULL DEFAULT 0,
      talk_minutes REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      sub_reason TEXT NOT NULL DEFAULT '',
      detail_reason TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      wrap_done INTEGER NOT NULL DEFAULT 0,
      ticket_id INTEGER,
      referral_id INTEGER,
      complaint_id INTEGER,
      recorded INTEGER NOT NULL DEFAULT 0,
      qa_status TEXT NOT NULL DEFAULT 'در صف',
      qa_score INTEGER
    );
    CREATE TABLE IF NOT EXISTS crm_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      interaction_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'عمومی',
      category TEXT NOT NULL DEFAULT '',
      sub_category TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'متوسط',
      severity TEXT NOT NULL DEFAULT 'متوسط',
      status TEXT NOT NULL DEFAULT 'جدید',
      agent_id TEXT,
      agent_name TEXT,
      supervisor_id TEXT NOT NULL DEFAULT '',
      first_response_at TEXT,
      sla_due TEXT NOT NULL,
      resolved_at TEXT,
      closed_at TEXT,
      reopened_count INTEGER NOT NULL DEFAULT 0,
      root_cause TEXT,
      resolution_code TEXT,
      resolution_note TEXT,
      next_action TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_ticket_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      ticket_id INTEGER,
      creator_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      owner_name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'تماس',
      due_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'متوسط',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'باز',
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      ticket_id INTEGER,
      category TEXT NOT NULL DEFAULT '',
      sub_category TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'متوسط',
      description TEXT NOT NULL DEFAULT '',
      against_team TEXT NOT NULL DEFAULT '',
      against_agent_id TEXT,
      supervisor_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'جدید',
      root_cause TEXT,
      corrective_action TEXT,
      resolution TEXT,
      customer_feedback TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'finance',
      customer_id INTEGER NOT NULL,
      ticket_id INTEGER,
      from_agent_id TEXT NOT NULL,
      target_team TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      requested_action TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'متوسط',
      amount INTEGER NOT NULL DEFAULT 0,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'باز',
      response TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      assigned_to TEXT,
      talk_minutes REAL NOT NULL DEFAULT 0,
      answers_json TEXT NOT NULL DEFAULT '{}',
      rating REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      sms_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_qa_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      scores_json TEXT NOT NULL DEFAULT '{}',
      total INTEGER NOT NULL DEFAULT 0,
      critical_json TEXT NOT NULL DEFAULT '[]',
      comment TEXT NOT NULL DEFAULT '',
      strength TEXT NOT NULL DEFAULT '',
      improvement TEXT NOT NULL DEFAULT '',
      coaching INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ارزیابی‌شده',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'عمومی',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee_id TEXT NOT NULL,
      about_agent_id TEXT,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'باز',
      priority TEXT NOT NULL DEFAULT 'متوسط',
      source_review_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS crm_sms_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'dynamic',
      text TEXT NOT NULL,
      trigger_key TEXT NOT NULL DEFAULT 'manual',
      auto INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS crm_kpi_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'team',
      ref TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      items_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS crm_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      entity TEXT NOT NULL,
      record_uuid TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      prev_value TEXT,
      new_value TEXT
    );
    CREATE TABLE IF NOT EXISTS crm_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_crm_customers_mobile ON crm_customers(mobile);
    CREATE INDEX IF NOT EXISTS idx_crm_interactions_agent ON crm_interactions(agent_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_crm_tickets_status_sla ON crm_tickets(status, sla_due);
    CREATE INDEX IF NOT EXISTS idx_crm_audit_at ON crm_audit_logs(at, category);
    CREATE INDEX IF NOT EXISTS idx_crm_followups_due ON crm_followups(status, due_at);
  `);
  migrateCrmTicketColumns();
  seedCrmDefaults();
}

/** Additive column migrations — never drop/wipe. */
function migrateCrmTicketColumns(): void {
  const d = db();
  const ticketCols = new Set(
    (d.prepare(`PRAGMA table_info(crm_tickets)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  const addTicket = (name: string, ddl: string) => {
    if (!ticketCols.has(name)) d.exec(`ALTER TABLE crm_tickets ADD COLUMN ${ddl}`);
  };
  addTicket('channel', `channel TEXT NOT NULL DEFAULT 'manual'`);
  addTicket('queue_id', `queue_id TEXT NOT NULL DEFAULT 'q_support'`);
  addTicket('team_id', `team_id TEXT`);
  addTicket('tags_json', `tags_json TEXT NOT NULL DEFAULT '[]'`);
  addTicket('pending_reason', `pending_reason TEXT`);
  addTicket('first_response_due_at', `first_response_due_at TEXT`);

  const actCols = new Set(
    (d.prepare(`PRAGMA table_info(crm_ticket_activities)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!actCols.has('kind')) d.exec(`ALTER TABLE crm_ticket_activities ADD COLUMN kind TEXT NOT NULL DEFAULT 'note'`);
  if (!actCols.has('visibility')) {
    d.exec(`ALTER TABLE crm_ticket_activities ADD COLUMN visibility TEXT NOT NULL DEFAULT 'internal'`);
  }
  if (!actCols.has('meta_json')) d.exec(`ALTER TABLE crm_ticket_activities ADD COLUMN meta_json TEXT NOT NULL DEFAULT '{}'`);
  if (!actCols.has('user_name')) d.exec(`ALTER TABLE crm_ticket_activities ADD COLUMN user_name TEXT NOT NULL DEFAULT ''`);

  // Backfill first_response_due_at for rows that only have sla_due
  d.exec(`
    UPDATE crm_tickets SET first_response_due_at = created_at
    WHERE first_response_due_at IS NULL OR first_response_due_at = ''
  `);
}

function seedCrmDefaults(): void {
  const d = db();
  const setIfMissing = (key: string, value: unknown) => {
    if (d.prepare('SELECT key FROM crm_settings WHERE key = ?').get(key)) return;
    d.prepare(`INSERT INTO crm_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(
      key,
      JSON.stringify(value)
    );
  };
  setIfMissing('slaPolicy', CRM_SLA_POLICY);
  setIfMissing('reasonTree', CRM_REASON_TREE);
  setIfMissing('deletedReasons', []);
  setIfMissing('scorecard', CRM_SCORECARD);
  setIfMissing('criticalErrors', CRM_CRITICAL_ERRORS);
  setIfMissing('surveyQuestions', CRM_SURVEY_QUESTIONS);

  const patternCount = Number(
    (d.prepare('SELECT COUNT(*) as c FROM crm_sms_patterns').get() as { c: number })?.c ?? 0
  );
  if (patternCount === 0) {
    const ins = d.prepare(
      `INSERT INTO crm_sms_patterns (name, type, text, trigger_key, auto, active) VALUES (?, ?, ?, ?, ?, 1)`
    );
    ins.run(
      'تشکر پس از خرید',
      'dynamic',
      '{name} عزیز، از خرید {product} در Pet Date سپاسگزاریم. امیدواریم تجربهٔ خوبی داشته باشید.',
      'after_purchase',
      1
    );
    ins.run(
      'ثبت تیکت',
      'dynamic',
      '{name} عزیز، تیکت {ticket} ثبت شد و در صف رسیدگی است.',
      'ticket_created',
      1
    );
    ins.run(
      'اعلام حل مشکل',
      'dynamic',
      '{name} عزیز، تیکت {ticket} حل شد. از همراهی شما ممنونیم.',
      'ticket_resolved',
      1
    );
    ins.run(
      'دعوت به نظرسنجی',
      'dynamic',
      '{name} عزیز، لطفاً تجربه تماس با {agent} را امتیاز دهید.',
      'survey_done',
      0
    );
    ins.run(
      'پیگیری نقض SLA',
      'dynamic',
      'تیکت {ticket} از زمان SLA عبور کرد — اقدام فوری لازم است.',
      'sla_breach',
      1
    );
  }

  const kpiCount = Number(
    (d.prepare('SELECT COUNT(*) as c FROM crm_kpi_models').get() as { c: number })?.c ?? 0
  );
  if (kpiCount === 0) {
    const ins = d.prepare(
      `INSERT INTO crm_kpi_models (name, scope, ref, active, items_json) VALUES (?, ?, ?, 1, ?)`
    );
    ins.run(
      'شاخص تیم پشتیبانی',
      'team',
      'support',
      JSON.stringify([
        { metric: 'tickets_resolved', target: 20 },
        { metric: 'csat', target: 4.2 },
        { metric: 'sla_breach', target: 2 },
      ])
    );
    ins.run(
      'شاخص کارشناس',
      'person',
      '',
      JSON.stringify([
        { metric: 'calls_answered', target: 15 },
        { metric: 'qa_score', target: 85 },
        { metric: 'wrap_pending', target: 3 },
      ])
    );
    ins.run(
      'شاخص سرپرست',
      'person',
      'crm_lead',
      JSON.stringify([
        { metric: 'qa_reviews', target: 10 },
        { metric: 'coaching_tasks', target: 3 },
      ])
    );
  }

  try {
    const seedRoleIfMissing = (key: string, nameFa: string, description: string, permissions: readonly string[]) => {
      if (d.prepare('SELECT id FROM admin_roles WHERE key = ?').get(key)) return;
      d.prepare(
        `INSERT INTO admin_roles (key, name_fa, description, permissions_json, is_active) VALUES (?, ?, ?, ?, 1)`
      ).run(key, nameFa, description, JSON.stringify(permissions));
    };
    seedRoleIfMissing('crm_agent', 'کارشناس امور مشتریان', 'اینباکس، wrap-up، تیکت، پیگیری', [
      'crm.read',
      'crm.write',
      'loyalty.read',
    ]);
    seedRoleIfMissing('crm_lead', 'سرپرست امور مشتریان', 'تخصیص، QA، گزارش تیمی', [
      'crm.read',
      'crm.write',
      'crm.admin',
      'loyalty.read',
      'loyalty.write',
    ]);
    seedRoleIfMissing('crm_manager', 'مدیر باشگاه مشتریان', 'دسترسی کامل امور مشتریان', [
      'crm.read',
      'crm.write',
      'crm.admin',
      'loyalty.read',
      'loyalty.write',
    ]);
  } catch {
    /* admin_roles may not exist yet */
  }
}

function mapCustomer(row: Record<string, unknown>): CrmCustomer {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('CU', id),
    first: String(row.first_name || ''),
    last: String(row.last_name || ''),
    mobile: String(row.mobile || ''),
    email: row.email != null ? String(row.email) : null,
    product: String(row.product || ''),
    level: String(row.level || 'عادی'),
    status: String(row.status || 'فعال'),
    salesOwner: String(row.sales_owner || ''),
    source: String(row.source || ''),
    csat: row.csat != null ? Number(row.csat) : null,
    platformUserId: row.platform_user_id != null ? Number(row.platform_user_id) : null,
    salesCustomerId: row.sales_customer_id != null ? Number(row.sales_customer_id) : null,
    financeSnapshot: parseJson(row.finance_snapshot_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    orderCount: row.order_count != null ? Number(row.order_count) : undefined,
    openTickets: row.open_tickets != null ? Number(row.open_tickets) : undefined,
  };
}

function mapInteraction(row: Record<string, unknown>): CrmInteraction {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('IN', id),
    customerId: row.customer_id != null ? Number(row.customer_id) : null,
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    customerMobile: row.customer_mobile != null ? String(row.customer_mobile) : undefined,
    channel: String(row.channel || 'call_in') as CrmChannel,
    direction: String(row.direction || 'in') === 'out' ? 'out' : 'in',
    agentId: String(row.agent_id || ''),
    agentName: String(row.agent_name || ''),
    startedAt: String(row.started_at),
    endedAt: row.ended_at != null ? String(row.ended_at) : null,
    waitSeconds: Number(row.wait_seconds || 0),
    talkMinutes: Number(row.talk_minutes || 0),
    reason: String(row.reason || ''),
    subReason: String(row.sub_reason || ''),
    detailReason: String(row.detail_reason || ''),
    outcome: String(row.outcome || ''),
    summary: String(row.summary || ''),
    notes: String(row.notes || ''),
    wrapDone: Boolean(row.wrap_done),
    ticketId: row.ticket_id != null ? Number(row.ticket_id) : null,
    referralId: row.referral_id != null ? Number(row.referral_id) : null,
    complaintId: row.complaint_id != null ? Number(row.complaint_id) : null,
    recorded: Boolean(row.recorded),
    qaStatus: String(row.qa_status || 'در صف'),
    qaScore: row.qa_score != null ? Number(row.qa_score) : null,
  };
}

function enrichTicket(row: Record<string, unknown>): CrmTicket {
  const id = Number(row.id);
  const status = String(row.status || 'جدید');
  const priority = String(row.priority || 'متوسط');
  const createdAt = String(row.created_at);
  const slaDue = String(row.sla_due || crmSlaDueIso(priority, createdAt, activeSlaPolicy()));
  const firstResponseDueAt =
    row.first_response_due_at != null && String(row.first_response_due_at)
      ? String(row.first_response_due_at)
      : crmFirstResponseDueIso(priority, createdAt, activeSlaPolicy());
  const slaState = crmSlaState({ status, slaDue });
  const unassigned = !row.agent_id;
  const customerId = Number(row.customer_id || 0);
  return {
    id,
    publicId: makeCrmUuid('TK', id),
    customerId: Number.isFinite(customerId) ? customerId : 0,
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    customerMobile: row.customer_mobile != null ? String(row.customer_mobile) : undefined,
    customerLevel: row.customer_level != null ? String(row.customer_level) : undefined,
    customerEmail: row.customer_email != null ? String(row.customer_email) : null,
    interactionId: row.interaction_id != null ? Number(row.interaction_id) : null,
    title: String(row.title || ''),
    description: String(row.description || ''),
    type: String(row.type || ''),
    category: String(row.category || ''),
    subCategory: String(row.sub_category || ''),
    channel: String(row.channel || 'manual'),
    queueId: String(row.queue_id || 'q_support'),
    teamId: row.team_id != null && String(row.team_id) ? String(row.team_id) : null,
    tags: parseJson<string[]>(row.tags_json, []),
    pendingReason: row.pending_reason != null && String(row.pending_reason) ? String(row.pending_reason) : null,
    priority,
    severity: String(row.severity || ''),
    status,
    agentId: row.agent_id != null && String(row.agent_id) ? String(row.agent_id) : null,
    agentName: row.agent_name != null ? String(row.agent_name) : null,
    supervisorId: String(row.supervisor_id || ''),
    firstResponseAt: row.first_response_at != null ? String(row.first_response_at) : null,
    firstResponseDueAt,
    slaDue,
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : null,
    closedAt: row.closed_at != null ? String(row.closed_at) : null,
    reopenedCount: Number(row.reopened_count || 0),
    rootCause: row.root_cause != null ? String(row.root_cause) : null,
    resolutionCode: row.resolution_code != null ? String(row.resolution_code) : null,
    resolutionNote: row.resolution_note != null ? String(row.resolution_note) : null,
    nextAction: String(row.next_action || ''),
    createdAt,
    updatedAt: String(row.updated_at || createdAt),
    slaState,
    slaLabel: crmSlaLabel({ status, slaDue }),
    borderColor: crmInboxBorderColor(slaState, { unassigned }),
  };
}

function mapFollowup(row: Record<string, unknown>): CrmFollowup {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('FU', id),
    customerId: Number(row.customer_id),
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    ticketId: row.ticket_id != null ? Number(row.ticket_id) : null,
    creatorId: String(row.creator_id || ''),
    ownerId: String(row.owner_id || ''),
    ownerName: String(row.owner_name || ''),
    kind: String(row.kind || ''),
    dueAt: String(row.due_at),
    priority: String(row.priority || ''),
    description: String(row.description || ''),
    status: String(row.status || 'باز'),
    result: row.result != null ? String(row.result) : null,
    createdAt: String(row.created_at),
  };
}

function mapComplaint(row: Record<string, unknown>): CrmComplaint {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('CP', id),
    customerId: Number(row.customer_id),
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    ticketId: row.ticket_id != null ? Number(row.ticket_id) : null,
    category: String(row.category || ''),
    subCategory: String(row.sub_category || ''),
    severity: String(row.severity || ''),
    description: String(row.description || ''),
    againstTeam: String(row.against_team || ''),
    againstAgentId: row.against_agent_id != null ? String(row.against_agent_id) : null,
    supervisorId: String(row.supervisor_id || ''),
    status: String(row.status || ''),
    rootCause: row.root_cause != null ? String(row.root_cause) : null,
    correctiveAction: row.corrective_action != null ? String(row.corrective_action) : null,
    resolution: row.resolution != null ? String(row.resolution) : null,
    customerFeedback: row.customer_feedback != null ? String(row.customer_feedback) : null,
    createdAt: String(row.created_at),
  };
}

function mapReferral(row: Record<string, unknown>): CrmReferral {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('RF', id),
    type: String(row.type || 'finance'),
    customerId: Number(row.customer_id),
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    ticketId: row.ticket_id != null ? Number(row.ticket_id) : null,
    fromAgentId: String(row.from_agent_id || ''),
    targetTeam: String(row.target_team || ''),
    reason: String(row.reason || ''),
    requestedAction: String(row.requested_action || ''),
    priority: String(row.priority || ''),
    amount: Number(row.amount || 0),
    dueAt: String(row.due_at),
    status: String(row.status || ''),
    response: row.response != null ? String(row.response) : null,
    createdAt: String(row.created_at),
  };
}

function customerName(id: number | null | undefined): string {
  if (!id) return '—';
  const row = db().prepare('SELECT first_name, last_name FROM crm_customers WHERE id = ?').get(id) as
    | { first_name: string; last_name: string }
    | undefined;
  if (!row) return '—';
  return `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—';
}

/** Identity: find/create CRM customer from mobile; link sales_customers / users when present. */
export function findOrCreateCustomerByMobile(
  input: {
    mobile: string;
    first?: string;
    last?: string;
    product?: string;
    source?: string;
  },
  actor: AdminAuthActor
): CrmCustomer {
  ensureCrmSchema();
  const mobile = normalizeMobile(input.mobile);
  if (!mobile) throw new Error('شماره موبایل الزامی است');

  const existing = db().prepare('SELECT * FROM crm_customers WHERE mobile = ?').get(mobile) as
    | Record<string, unknown>
    | undefined;
  if (existing) return mapCustomer(existing);

  let first = String(input.first || '').trim();
  let last = String(input.last || '').trim();
  let product = String(input.product || '').trim();
  let source = String(input.source || 'تماس ورودی').trim();
  let salesCustomerId: number | null = null;
  let platformUserId: number | null = null;
  let salesOwner = '';
  let level = 'عادی';

  try {
    const sales = db()
      .prepare('SELECT * FROM sales_customers WHERE mobile = ? ORDER BY id DESC LIMIT 1')
      .get(mobile) as Record<string, unknown> | undefined;
    if (sales) {
      salesCustomerId = Number(sales.id);
      if (!first) first = String(sales.first_name || '');
      if (!last) last = String(sales.last_name || '');
      salesOwner = String(sales.sales_owner || '');
      level = String(sales.level || 'عادی');
      source = source || 'فروش';
    }
  } catch {
    /* sales table may be absent */
  }

  try {
    const user = db()
      .prepare(
        `SELECT id, name, phone FROM users
         WHERE phone = ? OR phone = ? OR replace(coalesce(phone,''), '+98', '0') = ? LIMIT 1`
      )
      .get(mobile, `+98${mobile.slice(1)}`, mobile) as Record<string, unknown> | undefined;
    if (user) {
      platformUserId = Number(user.id);
      if (!first) {
        const dn = String(user.name || '');
        first = dn.split(/\s+/)[0] || first || 'کاربر';
        if (!last) last = dn.split(/\s+/).slice(1).join(' ');
      }
      source = source || 'پلتفرم';
    }
  } catch {
    /* users schema variants */
  }

  if (!first) first = 'مشتری';
  const info = db()
    .prepare(
      `INSERT INTO crm_customers (
        first_name, last_name, mobile, product, level, status, sales_owner, source,
        platform_user_id, sales_customer_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'فعال', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      first,
      last,
      mobile,
      product,
      level,
      salesOwner,
      source,
      platformUserId,
      salesCustomerId,
      nowIso(),
      nowIso()
    );
  const id = Number(info.lastInsertRowid);
  const customer = getCustomer(id)!;
  audit({
    userId: actorId(actor),
    category: 'customer',
    entity: 'crm_customers',
    recordUuid: customer.publicId,
    action: 'create',
    next: { mobile, first, last },
  });
  return customer;
}

export function listCustomers(opts?: { q?: string; limit?: number }): { total: number; customers: CrmCustomer[] } {
  ensureCrmSchema();
  const limit = Math.min(200, Math.max(1, opts?.limit || 50));
  const q = String(opts?.q || '').trim();
  let rows: Array<Record<string, unknown>>;
  if (q) {
    const like = `%${q}%`;
    rows = db()
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM crm_orders o WHERE o.customer_id = c.id) as order_count,
          (SELECT COUNT(*) FROM crm_tickets t WHERE t.customer_id = c.id AND t.status NOT IN ('حل‌شده','بسته‌شده')) as open_tickets
         FROM crm_customers c
         WHERE c.mobile LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?
         ORDER BY c.id DESC LIMIT ?`
      )
      .all(like, like, like, limit) as Array<Record<string, unknown>>;
  } else {
    rows = db()
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM crm_orders o WHERE o.customer_id = c.id) as order_count,
          (SELECT COUNT(*) FROM crm_tickets t WHERE t.customer_id = c.id AND t.status NOT IN ('حل‌شده','بسته‌شده')) as open_tickets
         FROM crm_customers c ORDER BY c.id DESC LIMIT ?`
      )
      .all(limit) as Array<Record<string, unknown>>;
  }
  const total = Number((db().prepare('SELECT COUNT(*) as c FROM crm_customers').get() as { c: number })?.c ?? 0);
  return { total, customers: rows.map(mapCustomer) };
}

export function getCustomer(id: number): CrmCustomer | null {
  ensureCrmSchema();
  const row = db().prepare('SELECT * FROM crm_customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapCustomer(row) : null;
}

export function getCustomerDetail(id: number): {
  customer: CrmCustomer;
  orders: CrmOrder[];
  interactions: CrmInteraction[];
  tickets: CrmTicket[];
  followups: CrmFollowup[];
  complaints: CrmComplaint[];
  referrals: CrmReferral[];
  surveys: CrmSurvey[];
} | null {
  const customer = getCustomer(id);
  if (!customer) return null;
  const orders = (
    db().prepare('SELECT * FROM crm_orders WHERE customer_id = ? ORDER BY ordered_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map((r) => ({
    id: Number(r.id),
    customerId: Number(r.customer_id),
    product: String(r.product),
    amount: Number(r.amount),
    orderedAt: String(r.ordered_at),
  }));
  const interactions = (
    db().prepare('SELECT * FROM crm_interactions WHERE customer_id = ? ORDER BY started_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map(mapInteraction);
  const tickets = (
    db()
      .prepare(
        `SELECT t.*, trim(c.first_name || ' ' || c.last_name) as customer_name,
                c.mobile as customer_mobile, c.level as customer_level, c.email as customer_email
         FROM crm_tickets t
         LEFT JOIN crm_customers c ON c.id = t.customer_id
         WHERE t.customer_id = ? ORDER BY t.created_at DESC`
      )
      .all(id) as Array<Record<string, unknown>>
  ).map(enrichTicket);
  const followups = (
    db().prepare('SELECT * FROM crm_followups WHERE customer_id = ? ORDER BY due_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map(mapFollowup);
  const complaints = (
    db().prepare('SELECT * FROM crm_complaints WHERE customer_id = ? ORDER BY created_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map(mapComplaint);
  const referrals = (
    db().prepare('SELECT * FROM crm_referrals WHERE customer_id = ? ORDER BY created_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map(mapReferral);
  const surveys = (
    db().prepare('SELECT * FROM crm_surveys WHERE customer_id = ? ORDER BY created_at DESC').all(id) as Array<
      Record<string, unknown>
    >
  ).map((r) => mapSurvey(r));
  return { customer, orders, interactions, tickets, followups, complaints, referrals, surveys };
}

function mapSurvey(row: Record<string, unknown>): CrmSurvey {
  const id = Number(row.id);
  return {
    id,
    publicId: makeCrmUuid('EX', id),
    customerId: Number(row.customer_id),
    customerName: row.customer_name != null ? String(row.customer_name) : undefined,
    agentId: String(row.agent_id || ''),
    assignedTo: row.assigned_to != null ? String(row.assigned_to) : null,
    talkMinutes: Number(row.talk_minutes || 0),
    answers: parseJson(row.answers_json, {}),
    rating: Number(row.rating || 0),
    notes: String(row.notes || ''),
    smsSent: Boolean(row.sms_sent),
    createdAt: String(row.created_at),
  };
}

export function simulateInboundCall(
  input: { mobile: string; first?: string; last?: string; waitSeconds?: number },
  actor: AdminAuthActor
): { customer: CrmCustomer; interaction: CrmInteraction } {
  ensureCrmSchema();
  const customer = findOrCreateCustomerByMobile(
    { mobile: input.mobile, first: input.first, last: input.last, source: 'تماس ورودی' },
    actor
  );
  const info = db()
    .prepare(
      `INSERT INTO crm_interactions (
        customer_id, channel, direction, agent_id, agent_name, started_at, wait_seconds, talk_minutes, recorded
      ) VALUES (?, 'call_in', 'in', ?, ?, ?, ?, 0, 1)`
    )
    .run(customer.id, actorId(actor), actorLabel(actor), nowIso(), Math.max(0, Number(input.waitSeconds) || 0));
  const interaction = getInteraction(Number(info.lastInsertRowid))!;
  audit({
    userId: actorId(actor),
    category: 'call',
    entity: 'crm_interactions',
    recordUuid: interaction.publicId,
    action: 'simulate_inbound',
  });
  return { customer, interaction };
}

export function getInteraction(id: number): CrmInteraction | null {
  ensureCrmSchema();
  const row = db()
    .prepare(
      `SELECT i.*, trim(c.first_name || ' ' || c.last_name) as customer_name, c.mobile as customer_mobile
       FROM crm_interactions i LEFT JOIN crm_customers c ON c.id = i.customer_id WHERE i.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapInteraction(row) : null;
}

export function listInteractions(opts?: {
  agentId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): CrmInteraction[] {
  ensureCrmSchema();
  const limit = Math.min(200, Math.max(1, opts?.limit || 50));
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.agentId) {
    clauses.push('i.agent_id = ?');
    params.push(opts.agentId);
  }
  if (opts?.from) {
    clauses.push('i.started_at >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    clauses.push('i.started_at <= ?');
    params.push(opts.to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);
  const rows = db()
    .prepare(
      `SELECT i.*, trim(c.first_name || ' ' || c.last_name) as customer_name, c.mobile as customer_mobile
       FROM crm_interactions i LEFT JOIN crm_customers c ON c.id = i.customer_id
       ${where} ORDER BY i.started_at DESC LIMIT ?`
    )
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapInteraction);
}

export function wrapUpInteraction(
  id: number,
  input: {
    reason?: string;
    subReason?: string;
    detailReason?: string;
    outcome?: string;
    summary?: string;
    notes?: string;
    talkMinutes?: number;
    requestedAction?: string;
    amount?: number;
    createTicket?: boolean;
    ticketTitle?: string;
    priority?: string;
  },
  actor: AdminAuthActor
): CrmInteraction {
  ensureCrmSchema();
  const inter = getInteraction(id);
  if (!inter) throw new Error('تعامل یافت نشد');

  const reason = String(input.reason || '').trim();
  const subReason = String(input.subReason || '').trim();
  const outcome = String(input.outcome || '').trim();
  const summary = String(input.summary || '').trim();
  const wrapDone = Boolean(reason && subReason && outcome && summary.length >= 4);

  db()
    .prepare(
      `UPDATE crm_interactions SET
        reason = ?, sub_reason = ?, detail_reason = ?, outcome = ?, summary = ?, notes = ?,
        talk_minutes = ?, wrap_done = ?, ended_at = COALESCE(ended_at, ?)
       WHERE id = ?`
    )
    .run(
      reason,
      subReason,
      String(input.detailReason || ''),
      outcome,
      summary,
      String(input.notes || ''),
      Number(input.talkMinutes ?? inter.talkMinutes),
      wrapDone ? 1 : 0,
      nowIso(),
      id
    );

  let ticketId = inter.ticketId;
  let referralId = inter.referralId;
  let complaintId = inter.complaintId;

  if (wrapDone && inter.customerId) {
    if (input.createTicket || outcome.includes('تیکت')) {
      const ticket = createTicket(
        {
          customerId: inter.customerId,
          interactionId: id,
          title: input.ticketTitle || summary.slice(0, 80) || reason,
          description: summary,
          category: reason,
          subCategory: subReason,
          priority: input.priority || 'متوسط',
          agentId: actorId(actor),
          agentName: actorLabel(actor),
        },
        actor
      );
      ticketId = ticket.id;
    }

    if (outcome === 'ارجاع به مالی' || outcome === 'ارجاع به فروش') {
      const action = String(input.requestedAction || '').trim();
      if (!action) throw new Error('برای ارجاع، اقدام درخواستی الزامی است');
      const ref = createReferral(
        {
          type: outcome === 'ارجاع به مالی' ? 'finance' : 'sales',
          customerId: inter.customerId,
          ticketId: ticketId || undefined,
          reason,
          requestedAction: action,
          priority: input.priority || 'متوسط',
          amount: Number(input.amount) || 0,
        },
        actor
      );
      referralId = ref.id;
    }

    if (reason === 'شکایت') {
      const complaint = createComplaint(
        {
          customerId: inter.customerId,
          ticketId: ticketId || undefined,
          category: reason,
          subCategory: subReason,
          severity: input.priority || 'متوسط',
          description: summary,
          againstTeam: 'پشتیبانی',
        },
        actor
      );
      complaintId = complaint.id;
    }
  }

  db()
    .prepare('UPDATE crm_interactions SET ticket_id = ?, referral_id = ?, complaint_id = ? WHERE id = ?')
    .run(ticketId, referralId, complaintId, id);

  const updated = getInteraction(id)!;
  audit({
    userId: actorId(actor),
    category: 'wrapup',
    entity: 'crm_interactions',
    recordUuid: updated.publicId,
    action: wrapDone ? 'wrapup_done' : 'wrapup_partial',
    next: { reason, outcome, wrapDone },
  });
  return updated;
}

export function createTicket(
  input: {
    customerId: number;
    interactionId?: number;
    title: string;
    description?: string;
    type?: string;
    category?: string;
    subCategory?: string;
    priority?: string;
    severity?: string;
    channel?: string;
    queueId?: string;
    teamId?: string | null;
    tags?: string[];
    agentId?: string | null;
    agentName?: string | null;
    supervisorId?: string;
    nextAction?: string;
  },
  actor: AdminAuthActor
): CrmTicket {
  ensureCrmSchema();
  const customerId = Number(input.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    const err = new Error('مشتری نامعتبر است') as Error & { status?: number };
    err.status = 422;
    throw err;
  }
  const customer = getCustomer(customerId);
  if (!customer) {
    const err = new Error('مشتری یافت نشد — رابطه تیکت↔مشتری شکسته است') as Error & { status?: number };
    err.status = 422;
    throw err;
  }
  const priority = String(input.priority || 'متوسط');
  const createdAt = nowIso();
  const slaDue = crmSlaDueIso(priority, createdAt, activeSlaPolicy());
  const firstDue = crmFirstResponseDueIso(priority, createdAt, activeSlaPolicy());
  const queueId = String(input.queueId || 'q_support');
  const queue = crmQueueOf(queueId);
  const teamId = input.teamId != null ? input.teamId : queue?.team || null;
  const info = db()
    .prepare(
      `INSERT INTO crm_tickets (
        customer_id, interaction_id, title, description, type, category, sub_category,
        priority, severity, status, agent_id, agent_name, supervisor_id, sla_due,
        next_action, channel, queue_id, team_id, tags_json, first_response_due_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      customerId,
      input.interactionId ?? null,
      String(input.title || '').trim() || 'تیکت',
      String(input.description || ''),
      String(input.type || 'پشتیبانی'),
      String(input.category || ''),
      String(input.subCategory || ''),
      priority,
      String(input.severity || 'متوسط S3'),
      input.agentId ? 'تخصیص‌یافته' : 'جدید',
      input.agentId ?? null,
      input.agentName ?? null,
      String(input.supervisorId || 'crm_lead'),
      slaDue,
      String(input.nextAction || ''),
      String(input.channel || 'manual'),
      queueId,
      teamId,
      JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
      firstDue,
      createdAt,
      createdAt
    );
  const ticket = getTicket(Number(info.lastInsertRowid))!;
  addTicketActivity(ticket.id, {
    userId: actorId(actor),
    userName: actorLabel(actor),
    kind: 'created',
    visibility: 'internal',
    text: `تیکت از طریق کانال ایجاد شد`,
  });
  dispatchSmsEvent('ticket_created', { customerId, ticketPublicId: ticket.publicId }, actor);
  audit({
    userId: actorId(actor),
    category: 'ticket',
    entity: 'crm_tickets',
    recordUuid: ticket.publicId,
    action: 'create',
  });
  return getTicket(ticket.id)!;
}

const TICKET_SELECT = `SELECT t.*,
  CASE WHEN c.id IS NULL THEN NULL ELSE trim(c.first_name || ' ' || c.last_name) END as customer_name,
  c.mobile as customer_mobile, c.level as customer_level, c.email as customer_email
  FROM crm_tickets t LEFT JOIN crm_customers c ON c.id = t.customer_id`;

export function getTicket(id: number): CrmTicket | null {
  ensureCrmSchema();
  const row = db()
    .prepare(`${TICKET_SELECT} WHERE t.id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? enrichTicket(row) : null;
}

export function listTickets(opts?: {
  status?: string;
  priority?: string;
  agentId?: string;
  unassignedOnly?: boolean;
  q?: string;
  limit?: number;
}): CrmTicket[] {
  ensureCrmSchema();
  const limit = Math.min(300, Math.max(1, opts?.limit || 100));
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.status) {
    clauses.push('t.status = ?');
    params.push(opts.status);
  }
  if (opts?.priority) {
    clauses.push('t.priority = ?');
    params.push(opts.priority);
  }
  if (opts?.agentId) {
    clauses.push('t.agent_id = ?');
    params.push(opts.agentId);
  }
  if (opts?.unassignedOnly) clauses.push(`(t.agent_id IS NULL OR t.agent_id = '')`);
  if (opts?.q?.trim()) {
    const q = `%${opts.q.trim()}%`;
    clauses.push(`(t.title LIKE ? OR t.description LIKE ? OR cast(t.id as text) LIKE ? OR c.mobile LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)`);
    params.push(q, q, q, q, q, q);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);
  const rows = db()
    .prepare(`${TICKET_SELECT} ${where} ORDER BY t.created_at DESC LIMIT ?`)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(enrichTicket);
}

function addTicketActivity(
  ticketId: number,
  opts: {
    userId: string;
    userName?: string;
    kind?: string;
    visibility?: string;
    text: string;
    meta?: Record<string, unknown>;
  }
): void {
  db()
    .prepare(
      `INSERT INTO crm_ticket_activities (ticket_id, user_id, user_name, kind, visibility, text, meta_json, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      ticketId,
      opts.userId,
      opts.userName || '',
      opts.kind || 'note',
      opts.visibility || 'internal',
      opts.text,
      JSON.stringify(opts.meta || {}),
      nowIso()
    );
}

export function patchTicket(
  id: number,
  input: {
    status?: string;
    priority?: string;
    severity?: string;
    agentId?: string | null;
    agentName?: string | null;
    queueId?: string;
    teamId?: string | null;
    pendingReason?: string | null;
    channel?: string;
    tags?: string[];
    type?: string;
    category?: string;
    subCategory?: string;
    resolutionCode?: string;
    resolutionNote?: string;
    rootCause?: string;
    nextAction?: string;
    activityText?: string;
    activityKind?: string;
    activityVisibility?: string;
  },
  actor: AdminAuthActor
): CrmTicket {
  ensureCrmSchema();
  const ticket = getTicket(id);
  if (!ticket) throw new Error('تیکت یافت نشد');
  if (!ticket.customerId || !getCustomer(ticket.customerId)) {
    const err = new Error('مشتری مرتبط با تیکت یافت نشد (رابطه یتیم)') as Error & { status?: number };
    err.status = 409;
    throw err;
  }

  let status = input.status != null ? String(input.status) : ticket.status;
  let priority = input.priority != null ? String(input.priority) : ticket.priority;
  let slaDue = ticket.slaDue;
  let firstResponseDueAt = ticket.firstResponseDueAt;
  let resolvedAt = ticket.resolvedAt;
  let closedAt = ticket.closedAt;
  let reopenedCount = ticket.reopenedCount;
  let firstResponseAt = ticket.firstResponseAt;
  let agentId = input.agentId !== undefined ? input.agentId : ticket.agentId;
  let agentName = input.agentName !== undefined ? input.agentName : ticket.agentName;
  let queueId = input.queueId != null ? String(input.queueId) : ticket.queueId;
  let teamId = input.teamId !== undefined ? input.teamId : ticket.teamId;
  let pendingReason =
    input.pendingReason !== undefined ? input.pendingReason : ticket.pendingReason;
  const severity = input.severity != null ? String(input.severity) : ticket.severity;
  const channel = input.channel != null ? String(input.channel) : ticket.channel;
  const type = input.type != null ? String(input.type) : ticket.type;
  const category = input.category != null ? String(input.category) : ticket.category;
  const subCategory = input.subCategory != null ? String(input.subCategory) : ticket.subCategory;
  const tags = input.tags != null ? input.tags : ticket.tags;

  if (input.queueId != null) {
    const q = crmQueueOf(queueId);
    if (q && input.teamId === undefined) teamId = q.team;
  }

  if (input.priority != null && input.priority !== ticket.priority) {
    slaDue = crmSlaDueIso(priority, ticket.createdAt, activeSlaPolicy());
    firstResponseDueAt = crmFirstResponseDueIso(priority, nowIso(), activeSlaPolicy());
  }

  if (status === 'حل‌شده') {
    const code = String(input.resolutionCode ?? ticket.resolutionCode ?? '').trim();
    if (!code) {
      const err = new Error('برای حل تیکت، کد راه‌حل الزامی است') as Error & { status?: number };
      err.status = 422;
      throw err;
    }
    resolvedAt = nowIso();
    pendingReason = null;
  }

  if (status === 'بازگشایی‌شده') {
    reopenedCount += 1;
    resolvedAt = null;
    closedAt = null;
    slaDue = crmSlaDueIso(priority, nowIso(), activeSlaPolicy());
    firstResponseDueAt = crmFirstResponseDueIso(priority, nowIso(), activeSlaPolicy());
  }

  if (status === 'بسته‌شده') closedAt = nowIso();

  if (status === 'تخصیص‌یافته' && !agentId) {
    agentId = actorId(actor);
    agentName = actorLabel(actor);
  }

  if (
    !firstResponseAt &&
    (input.activityVisibility === 'public' ||
      status === 'در حال بررسی' ||
      status === 'تخصیص‌یافته' ||
      input.activityText)
  ) {
    if (input.activityVisibility === 'public' || status === 'در حال بررسی') {
      firstResponseAt = nowIso();
    }
  }

  if (['در انتظار مشتری', 'در انتظار داخلی'].includes(status) && !pendingReason) {
    const err = new Error('دلیل تعلیق برای وضعیت انتظار الزامی است') as Error & { status?: number };
    err.status = 422;
    throw err;
  }
  if (!['در انتظار مشتری', 'در انتظار داخلی'].includes(status) && input.status != null) {
    pendingReason = input.pendingReason !== undefined ? input.pendingReason : null;
  }

  db()
    .prepare(
      `UPDATE crm_tickets SET
        status = ?, priority = ?, severity = ?, agent_id = ?, agent_name = ?, sla_due = ?,
        first_response_due_at = ?, resolved_at = ?, closed_at = ?, reopened_count = ?,
        first_response_at = ?,
        resolution_code = COALESCE(?, resolution_code),
        resolution_note = COALESCE(?, resolution_note),
        root_cause = COALESCE(?, root_cause),
        next_action = COALESCE(?, next_action),
        channel = ?, queue_id = ?, team_id = ?, tags_json = ?, pending_reason = ?,
        type = ?, category = ?, sub_category = ?,
        updated_at = ?
       WHERE id = ?`
    )
    .run(
      status,
      priority,
      severity,
      agentId,
      agentName,
      slaDue,
      firstResponseDueAt,
      resolvedAt,
      closedAt,
      reopenedCount,
      firstResponseAt,
      input.resolutionCode != null ? String(input.resolutionCode) : null,
      input.resolutionNote != null ? String(input.resolutionNote) : null,
      input.rootCause != null ? String(input.rootCause) : null,
      input.nextAction != null ? String(input.nextAction) : null,
      channel,
      queueId,
      teamId,
      JSON.stringify(tags || []),
      pendingReason,
      type,
      category,
      subCategory,
      nowIso(),
      id
    );

  if (input.activityText) {
    addTicketActivity(id, {
      userId: actorId(actor),
      userName: actorLabel(actor),
      kind: input.activityKind || 'note',
      visibility: input.activityVisibility || 'internal',
      text: String(input.activityText),
    });
  } else if (input.status != null && input.status !== ticket.status) {
    addTicketActivity(id, {
      userId: actorId(actor),
      userName: actorLabel(actor),
      kind: 'status_change',
      visibility: 'internal',
      text: `تغییر وضعیت به «${status}»${pendingReason ? ` — ${pendingReason}` : ''}`,
    });
  } else if (input.priority != null && input.priority !== ticket.priority) {
    addTicketActivity(id, {
      userId: actorId(actor),
      userName: actorLabel(actor),
      kind: 'priority_change',
      visibility: 'internal',
      text: `تغییر اولویت به «${priority}»`,
    });
  } else if (input.agentId !== undefined && input.agentId !== ticket.agentId) {
    addTicketActivity(id, {
      userId: actorId(actor),
      userName: actorLabel(actor),
      kind: 'assigned',
      visibility: 'internal',
      text: `تخصیص به ${agentName || agentId || '—'}`,
    });
  } else if (input.queueId != null && input.queueId !== ticket.queueId) {
    const q = crmQueueOf(queueId);
    addTicketActivity(id, {
      userId: actorId(actor),
      userName: actorLabel(actor),
      kind: 'transferred',
      visibility: 'internal',
      text: `ارجاع به صف «${q?.name || queueId}»`,
    });
  }

  const updated = getTicket(id)!;
  if (status === 'حل‌شده' && ticket.status !== 'حل‌شده') {
    dispatchSmsEvent('ticket_resolved', { customerId: ticket.customerId, ticketPublicId: updated.publicId }, actor);
  }
  audit({
    userId: actorId(actor),
    category: 'ticket',
    entity: 'crm_tickets',
    recordUuid: updated.publicId,
    action: 'patch',
    prev: { status: ticket.status, priority: ticket.priority },
    next: { status, priority },
  });
  return updated;
}

export function assignTicketToMe(id: number, actor: AdminAuthActor): CrmTicket {
  return patchTicket(
    id,
    { agentId: actorId(actor), agentName: actorLabel(actor), status: 'تخصیص‌یافته', activityText: 'تخصیص به خود' },
    actor
  );
}

export function listTicketActivities(ticketId: number): CrmTicketActivity[] {
  ensureCrmSchema();
  const rows = db()
    .prepare('SELECT * FROM crm_ticket_activities WHERE ticket_id = ? ORDER BY at ASC')
    .all(ticketId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    ticketId: Number(r.ticket_id),
    userId: String(r.user_id),
    userName: r.user_name != null ? String(r.user_name) : undefined,
    kind: String(r.kind || 'note'),
    visibility: String(r.visibility || 'internal'),
    text: String(r.text),
    at: String(r.at),
    meta: parseJson(r.meta_json, {}),
  }));
}

export function listTicketingAgents(): CrmTicketingAgent[] {
  ensureCrmSchema();
  const agents = new Map<string, CrmTicketingAgent>();
  try {
    const { employees } = listEmployees({ accessStatus: 'فعال', limit: 200 });
    for (const e of employees) {
      const id = e.publicId || `emp-${e.id}`;
      const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || id;
      agents.set(id, {
        id,
        name,
        team: e.department || 'Pet Date',
        role: e.jobTitle || 'کارشناس',
      });
    }
  } catch {
    /* HR schema may be empty in selftests */
  }
  const ticketAgents = db()
    .prepare(
      `SELECT DISTINCT agent_id, agent_name, team_id FROM crm_tickets
       WHERE agent_id IS NOT NULL AND agent_id != ''`
    )
    .all() as Array<{ agent_id: string; agent_name: string | null; team_id: string | null }>;
  for (const a of ticketAgents) {
    if (!agents.has(a.agent_id)) {
      agents.set(a.agent_id, {
        id: a.agent_id,
        name: a.agent_name || a.agent_id,
        team: a.team_id || 'امور مشتریان',
        role: 'کارشناس',
      });
    }
  }
  return [...agents.values()].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

/** Sidebar open/pending counts for باشگاه مشتریان nav (SQL aggregates — no N+1 list). */
export function getCrmNavCounts(): CrmNavCounts {
  ensureCrmSchema();
  const d = db();
  const openStatuses = CRM_TICKET_OPEN_STATUSES.map(() => '?').join(',');
  const tickets = Number(
    (
      d
        .prepare(`SELECT COUNT(*) as c FROM crm_tickets WHERE status IN (${openStatuses})`)
        .get(...CRM_TICKET_OPEN_STATUSES) as { c: number } | undefined
    )?.c ?? 0
  );
  const unassigned = Number(
    (
      d
        .prepare(
          `SELECT COUNT(*) as c FROM crm_tickets
           WHERE status IN (${openStatuses})
             AND (agent_id IS NULL OR TRIM(COALESCE(agent_id, '')) = '')`
        )
        .get(...CRM_TICKET_OPEN_STATUSES) as { c: number } | undefined
    )?.c ?? 0
  );
  const followups = Number(
    (
      d.prepare(`SELECT COUNT(*) as c FROM crm_followups WHERE status = 'باز'`).get() as
        | { c: number }
        | undefined
    )?.c ?? 0
  );
  return { tickets, unassigned, followups };
}

export function getTicketingOverview(actor?: AdminAuthActor): CrmTicketingOverview {
  ensureCrmSchema();
  const tickets = listTickets({ limit: 250 });
  const followups = listFollowups({ limit: 150 });
  const referrals = listReferrals(150);
  const agents = listTicketingAgents();
  if (actor) {
    const aid = actorId(actor);
    if (!agents.some((a) => a.id === aid)) {
      agents.unshift({
        id: aid,
        name: actorLabel(actor),
        team: 'ادمین',
        role: actor.role || 'admin',
      });
    }
  }
  const open = tickets.filter((t) => (CRM_TICKET_OPEN_STATUSES as readonly string[]).includes(t.status));
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const t0 = today0.getTime();
  const newToday = tickets.filter((t) => new Date(t.createdAt).getTime() >= t0).length;
  const resolvedToday = tickets.filter(
    (t) => t.resolvedAt && new Date(t.resolvedAt).getTime() >= t0
  ).length;
  const atRisk = open.filter((t) => t.slaState === 'at_risk').length;
  const breached = open.filter((t) => t.slaState === 'breached').length;
  const unassigned = open.filter((t) => !t.agentId).length;
  const eligible = tickets.filter((t) => t.resolvedAt || t.status === 'بسته‌شده');
  const slaOk = eligible.filter((t) => {
    const due = new Date(t.slaDue).getTime();
    const done = new Date(t.resolvedAt || t.closedAt || Date.now()).getTime();
    return done <= due;
  }).length;
  const slaPct = eligible.length ? Math.round((slaOk / eligible.length) * 100) : 100;
  const auditRows = listAuditLogs(80);
  return {
    tickets,
    followups,
    referrals,
    agents,
    audit: auditRows.map((r) => ({
      id: Number(r.id),
      at: String(r.at),
      userId: String(r.user_id),
      category: String(r.category),
      entity: String(r.entity),
      recordUuid: String(r.record_uuid),
      action: String(r.action),
      prevValue: r.prev_value != null ? String(r.prev_value) : null,
      newValue: r.new_value != null ? String(r.new_value) : null,
    })),
    stats: {
      open: open.length,
      newToday,
      resolvedToday,
      atRisk,
      breached,
      unassigned,
      openFollowups: followups.filter((f) => f.status === 'باز').length,
      openReferrals: referrals.filter((r) => r.status === 'باز' || r.status === 'پاسخ داده‌شده').length,
      slaPct,
    },
  };
}

/** Cross-module handoff from ticket → finance/sales referral. */
export function escalateTicket(
  ticketId: number,
  input: {
    type: 'finance' | 'sales' | string;
    reason?: string;
    requestedAction: string;
    priority?: string;
    amount?: number;
  },
  actor: AdminAuthActor
): { ticket: CrmTicket; referral: CrmReferral } {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error('تیکت یافت نشد');
  const referral = createReferral(
    {
      type: input.type,
      customerId: ticket.customerId,
      ticketId,
      reason: input.reason,
      requestedAction: input.requestedAction,
      priority: input.priority || ticket.priority,
      amount: input.amount,
      targetTeam: input.type === 'finance' ? 'واحد مالی' : 'تیم فروش',
    },
    actor
  );
  const updated = patchTicket(
    ticketId,
    {
      status: 'در انتظار داخلی',
      pendingReason: input.type === 'finance' ? 'در انتظار مالی' : 'در انتظار فروش',
      activityText: `ارجاع به ${referral.targetTeam}: ${input.requestedAction}`,
      activityKind: 'escalation',
    },
    actor
  );
  return { ticket: updated, referral };
}

export function runTicketMacro(
  ticketId: number,
  key: 'refund' | 'vip',
  actor: AdminAuthActor
): CrmTicket {
  const ticket = getTicket(ticketId);
  if (!ticket) throw new Error('تیکت یافت نشد');
  if (key === 'refund') {
    const updated = patchTicket(
      ticketId,
      {
        type: 'بازگشت وجه',
        category: 'انصراف',
        subCategory: 'انصراف از سفارش',
        priority: 'بالا',
        queueId: 'q_refund',
        tags: [...new Set([...(ticket.tags || []), 'refund'])],
        activityText: 'ماکرو «درخواست بازگشت وجه» اجرا شد',
        activityKind: 'macro',
      },
      actor
    );
    escalateTicket(
      ticketId,
      {
        type: 'finance',
        reason: 'بازگشت وجه',
        requestedAction: 'بررسی و پردازش درخواست بازگشت وجه',
        priority: 'بالا',
      },
      actor
    );
    return getTicket(updated.id)!;
  }
  return patchTicket(
    ticketId,
    {
      priority: 'بالا',
      queueId: 'q_vip',
      tags: [...new Set([...(ticket.tags || []), 'vip'])],
      activityText: 'ماکرو «رسیدگی VIP» اجرا شد',
      activityKind: 'macro',
    },
    actor
  );
}

/** Soft-heal orphan ticket.customer_id references (customer deleted) for list safety. */
export function repairOrphanTicketRelations(): { orphanTickets: number; orphanFollowups: number } {
  ensureCrmSchema();
  const orphanTickets = db()
    .prepare(
      `SELECT t.id FROM crm_tickets t
       LEFT JOIN crm_customers c ON c.id = t.customer_id
       WHERE c.id IS NULL`
    )
    .all() as Array<{ id: number }>;
  // Keep rows but mark next_action so UI can show warning — do not delete.
  for (const r of orphanTickets) {
    db()
      .prepare(
        `UPDATE crm_tickets SET next_action = CASE
           WHEN next_action LIKE '%[orphan]%' THEN next_action
           ELSE '[orphan] مشتری حذف‌شده — ' || COALESCE(next_action, '')
         END, updated_at = ? WHERE id = ?`
      )
      .run(nowIso(), r.id);
  }
  const orphanFollowups = db()
    .prepare(
      `SELECT f.id FROM crm_followups f
       LEFT JOIN crm_customers c ON c.id = f.customer_id
       WHERE c.id IS NULL`
    )
    .all() as Array<{ id: number }>;
  return { orphanTickets: orphanTickets.length, orphanFollowups: orphanFollowups.length };
}

export function createFollowup(
  input: {
    customerId: number;
    ticketId?: number;
    ownerId?: string;
    ownerName?: string;
    kind?: string;
    dueAt: string;
    priority?: string;
    description?: string;
  },
  actor: AdminAuthActor
): CrmFollowup {
  ensureCrmSchema();
  const info = db()
    .prepare(
      `INSERT INTO crm_followups (
        customer_id, ticket_id, creator_id, owner_id, owner_name, kind, due_at, priority, description, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'باز', ?)`
    )
    .run(
      input.customerId,
      input.ticketId ?? null,
      actorId(actor),
      input.ownerId || actorId(actor),
      input.ownerName || actorLabel(actor),
      String(input.kind || 'تماس'),
      input.dueAt,
      String(input.priority || 'متوسط'),
      String(input.description || ''),
      nowIso()
    );
  return getFollowup(Number(info.lastInsertRowid))!;
}

export function getFollowup(id: number): CrmFollowup | null {
  const row = db()
    .prepare(
      `SELECT f.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_followups f LEFT JOIN crm_customers c ON c.id = f.customer_id WHERE f.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapFollowup(row) : null;
}

export function listFollowups(opts?: { status?: string; limit?: number }): CrmFollowup[] {
  ensureCrmSchema();
  const limit = Math.min(200, Math.max(1, opts?.limit || 50));
  const rows = (
    opts?.status
      ? db()
          .prepare(
            `SELECT f.*, trim(c.first_name || ' ' || c.last_name) as customer_name
             FROM crm_followups f LEFT JOIN crm_customers c ON c.id = f.customer_id
             WHERE f.status = ? ORDER BY f.due_at ASC LIMIT ?`
          )
          .all(opts.status, limit)
      : db()
          .prepare(
            `SELECT f.*, trim(c.first_name || ' ' || c.last_name) as customer_name
             FROM crm_followups f LEFT JOIN crm_customers c ON c.id = f.customer_id
             ORDER BY f.due_at ASC LIMIT ?`
          )
          .all(limit)
  ) as Array<Record<string, unknown>>;
  return rows.map(mapFollowup);
}

export function completeFollowup(id: number, result: string, actor: AdminAuthActor): CrmFollowup {
  ensureCrmSchema();
  db()
    .prepare(`UPDATE crm_followups SET status = 'انجام‌شده', result = ? WHERE id = ?`)
    .run(String(result || ''), id);
  const fu = getFollowup(id);
  if (!fu) throw new Error('پیگیری یافت نشد');
  audit({
    userId: actorId(actor),
    category: 'followup',
    entity: 'crm_followups',
    recordUuid: fu.publicId,
    action: 'complete',
  });
  return fu;
}

export function createComplaint(
  input: {
    customerId: number;
    ticketId?: number;
    category?: string;
    subCategory?: string;
    severity?: string;
    description?: string;
    againstTeam?: string;
    againstAgentId?: string;
    supervisorId?: string;
  },
  actor: AdminAuthActor
): CrmComplaint {
  ensureCrmSchema();
  const info = db()
    .prepare(
      `INSERT INTO crm_complaints (
        customer_id, ticket_id, category, sub_category, severity, description,
        against_team, against_agent_id, supervisor_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'جدید', ?)`
    )
    .run(
      input.customerId,
      input.ticketId ?? null,
      String(input.category || ''),
      String(input.subCategory || ''),
      String(input.severity || 'متوسط'),
      String(input.description || ''),
      String(input.againstTeam || ''),
      input.againstAgentId ?? null,
      String(input.supervisorId || 'crm_lead'),
      nowIso()
    );
  return getComplaint(Number(info.lastInsertRowid))!;
}

export function getComplaint(id: number): CrmComplaint | null {
  const row = db()
    .prepare(
      `SELECT cp.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_complaints cp LEFT JOIN crm_customers c ON c.id = cp.customer_id WHERE cp.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapComplaint(row) : null;
}

export function listComplaints(limit = 50): CrmComplaint[] {
  ensureCrmSchema();
  const rows = db()
    .prepare(
      `SELECT cp.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_complaints cp LEFT JOIN crm_customers c ON c.id = cp.customer_id
       ORDER BY cp.created_at DESC LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapComplaint);
}

export function createReferral(
  input: {
    type: 'finance' | 'sales' | string;
    customerId: number;
    ticketId?: number;
    reason?: string;
    requestedAction: string;
    priority?: string;
    amount?: number;
    dueAt?: string;
    targetTeam?: string;
  },
  actor: AdminAuthActor
): CrmReferral {
  ensureCrmSchema();
  const due =
    input.dueAt ||
    new Date(Date.now() + 24 * 3600_000).toISOString();
  const info = db()
    .prepare(
      `INSERT INTO crm_referrals (
        type, customer_id, ticket_id, from_agent_id, target_team, reason, requested_action,
        priority, amount, due_at, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'باز', ?)`
    )
    .run(
      input.type,
      input.customerId,
      input.ticketId ?? null,
      actorId(actor),
      String(input.targetTeam || (input.type === 'finance' ? 'مالی' : 'فروش')),
      String(input.reason || ''),
      String(input.requestedAction || ''),
      String(input.priority || 'متوسط'),
      Math.max(0, Math.round(Number(input.amount) || 0)),
      due,
      nowIso()
    );
  return getReferral(Number(info.lastInsertRowid))!;
}

export function getReferral(id: number): CrmReferral | null {
  const row = db()
    .prepare(
      `SELECT r.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_referrals r LEFT JOIN crm_customers c ON c.id = r.customer_id WHERE r.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapReferral(row) : null;
}

export function listReferrals(limit = 50): CrmReferral[] {
  ensureCrmSchema();
  const rows = db()
    .prepare(
      `SELECT r.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_referrals r LEFT JOIN crm_customers c ON c.id = r.customer_id
       ORDER BY r.created_at DESC LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapReferral);
}

export function respondReferral(
  id: number,
  input: { approve: boolean; response?: string; status?: string },
  actor: AdminAuthActor
): CrmReferral {
  ensureCrmSchema();
  const ref = getReferral(id);
  if (!ref) throw new Error('ارجاع یافت نشد');
  const status =
    input.status ||
    (input.approve ? 'تایید' : 'رد شد');
  db()
    .prepare(`UPDATE crm_referrals SET status = ?, response = ? WHERE id = ?`)
    .run(status, String(input.response || ''), id);

  if (ref.ticketId) {
    const linked = getTicket(ref.ticketId);
    if (linked) {
      if (!input.approve && status !== 'تایید' && status !== 'انجام‌شده') {
        patchTicket(
          ref.ticketId,
          {
            status: 'ارجاع به سطح بالاتر',
            pendingReason: null,
            activityText: `رد ارجاع ${ref.targetTeam}: ${input.response || 'رد'}`,
            activityKind: 'escalation_response',
          },
          actor
        );
      } else {
        patchTicket(
          ref.ticketId,
          {
            status: 'در حال بررسی',
            pendingReason: null,
            activityText: `پاسخ ${ref.targetTeam}: ${input.response || status} — نتیجه به تیکت اصلی بازگشت`,
            activityKind: 'escalation_response',
          },
          actor
        );
      }
    }
  }

  const updated = getReferral(id)!;
  audit({
    userId: actorId(actor),
    category: 'referral',
    entity: 'crm_referrals',
    recordUuid: updated.publicId,
    action: status,
  });
  return updated;
}

export function createSurvey(
  input: {
    customerId: number;
    answers: Record<string, number>;
    notes?: string;
    talkMinutes?: number;
    assignedTo?: string;
    smsSent?: boolean;
  },
  actor: AdminAuthActor
): CrmSurvey {
  ensureCrmSchema();
  const rating = crmSurveyRating(input.answers || {});
  const info = db()
    .prepare(
      `INSERT INTO crm_surveys (
        customer_id, agent_id, assigned_to, talk_minutes, answers_json, rating, notes, sms_sent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.customerId,
      actorId(actor),
      input.assignedTo ?? null,
      Number(input.talkMinutes) || 0,
      JSON.stringify(input.answers || {}),
      rating,
      String(input.notes || ''),
      input.smsSent ? 1 : 0,
      nowIso()
    );
  db().prepare('UPDATE crm_customers SET csat = ?, updated_at = ? WHERE id = ?').run(rating, nowIso(), input.customerId);

  // experience interaction
  db()
    .prepare(
      `INSERT INTO crm_interactions (
        customer_id, channel, direction, agent_id, agent_name, started_at, ended_at,
        talk_minutes, reason, sub_reason, outcome, summary, wrap_done
      ) VALUES (?, 'call_out', 'out', ?, ?, ?, ?, ?, 'تجربه مشتری', 'نظرسنجی', 'پاسخ داده‌شده', ?, 1)`
    )
    .run(
      input.customerId,
      actorId(actor),
      actorLabel(actor),
      nowIso(),
      nowIso(),
      Number(input.talkMinutes) || 0,
      `نظرسنجی با امتیاز ${rating}`
    );

  dispatchSmsEvent('survey_done', { customerId: input.customerId }, actor);
  return mapSurvey(
    db().prepare('SELECT * FROM crm_surveys WHERE id = ?').get(Number(info.lastInsertRowid)) as Record<
      string,
      unknown
    >
  );
}

export function listSurveys(limit = 50): CrmSurvey[] {
  ensureCrmSchema();
  const rows = db()
    .prepare(
      `SELECT s.*, trim(c.first_name || ' ' || c.last_name) as customer_name
       FROM crm_surveys s LEFT JOIN crm_customers c ON c.id = s.customer_id
       ORDER BY s.created_at DESC LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map(mapSurvey);
}

export function createQaReview(
  input: {
    interactionId: number;
    scores: Record<string, number>;
    critical?: string[];
    comment?: string;
    strength?: string;
    improvement?: string;
    coaching?: boolean;
    reason?: string;
  },
  actor: AdminAuthActor
): CrmQaReview {
  ensureCrmSchema();
  const inter = getInteraction(input.interactionId);
  if (!inter) throw new Error('تعامل یافت نشد');
  const critical = Array.isArray(input.critical) ? input.critical.map(String) : [];
  const total = crmQaTotal(input.scores || {}, critical, getCrmSettings().scorecard);
  const coaching = Boolean(input.coaching) || critical.length > 0;
  const info = db()
    .prepare(
      `INSERT INTO crm_qa_reviews (
        interaction_id, agent_id, reviewer_id, reason, scores_json, total, critical_json,
        comment, strength, improvement, coaching, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.interactionId,
      inter.agentId,
      actorId(actor),
      String(input.reason || ''),
      JSON.stringify(input.scores || {}),
      total,
      JSON.stringify(critical),
      String(input.comment || ''),
      String(input.strength || ''),
      String(input.improvement || ''),
      coaching ? 1 : 0,
      coaching ? 'نیازمند کوچینگ' : 'ارزیابی‌شده',
      nowIso()
    );
  const reviewId = Number(info.lastInsertRowid);
  db()
    .prepare(`UPDATE crm_interactions SET qa_status = ?, qa_score = ? WHERE id = ?`)
    .run(coaching ? 'نیازمند کوچینگ' : 'ارزیابی‌شده', total, input.interactionId);

  if (coaching) {
    createTask(
      {
        kind: 'کوچینگ',
        title: `کوچینگ ${inter.agentName || inter.agentId}`,
        description: input.improvement || input.comment || 'نیاز به کوچینگ پس از QA',
        assigneeId: 'crm_lead',
        aboutAgentId: inter.agentId,
        dueAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
        priority: 'بالا',
        sourceReviewId: reviewId,
      },
      actor
    );
  }

  return getQaReview(reviewId)!;
}

export function getQaReview(id: number): CrmQaReview | null {
  const row = db().prepare('SELECT * FROM crm_qa_reviews WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    publicId: makeCrmUuid('QA', Number(row.id)),
    interactionId: Number(row.interaction_id),
    agentId: String(row.agent_id),
    reviewerId: String(row.reviewer_id),
    reason: String(row.reason || ''),
    scores: parseJson(row.scores_json, {}),
    total: Number(row.total || 0),
    critical: parseJson(row.critical_json, []),
    comment: String(row.comment || ''),
    strength: String(row.strength || ''),
    improvement: String(row.improvement || ''),
    coaching: Boolean(row.coaching),
    status: String(row.status || ''),
    createdAt: String(row.created_at),
  };
}

export function listQaReviews(limit = 50): CrmQaReview[] {
  ensureCrmSchema();
  const rows = db()
    .prepare('SELECT * FROM crm_qa_reviews ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => getQaReview(Number(r.id))!);
}

export function createTask(
  input: {
    kind?: string;
    title: string;
    description?: string;
    assigneeId: string;
    aboutAgentId?: string;
    dueAt: string;
    priority?: string;
    sourceReviewId?: number;
  },
  actor: AdminAuthActor
): CrmTask {
  ensureCrmSchema();
  const info = db()
    .prepare(
      `INSERT INTO crm_tasks (
        kind, title, description, assignee_id, about_agent_id, due_at, status, priority, source_review_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'باز', ?, ?, ?)`
    )
    .run(
      String(input.kind || 'عمومی'),
      String(input.title),
      String(input.description || ''),
      input.assigneeId,
      input.aboutAgentId ?? null,
      input.dueAt,
      String(input.priority || 'متوسط'),
      input.sourceReviewId ?? null,
      nowIso()
    );
  return getTask(Number(info.lastInsertRowid))!;
}

export function getTask(id: number): CrmTask | null {
  const row = db().prepare('SELECT * FROM crm_tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    publicId: makeCrmUuid('TS', Number(row.id)),
    kind: String(row.kind),
    title: String(row.title),
    description: String(row.description || ''),
    assigneeId: String(row.assignee_id),
    aboutAgentId: row.about_agent_id != null ? String(row.about_agent_id) : null,
    dueAt: String(row.due_at),
    status: String(row.status),
    priority: String(row.priority),
    sourceReviewId: row.source_review_id != null ? Number(row.source_review_id) : null,
    createdAt: String(row.created_at),
  };
}

export function listTasks(opts?: { assigneeId?: string; status?: string; limit?: number }): CrmTask[] {
  ensureCrmSchema();
  const limit = Math.min(100, opts?.limit || 50);
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts?.assigneeId) {
    clauses.push('assignee_id = ?');
    params.push(opts.assigneeId);
  }
  if (opts?.status) {
    clauses.push('status = ?');
    params.push(opts.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(limit);
  const rows = db()
    .prepare(`SELECT * FROM crm_tasks ${where} ORDER BY due_at ASC LIMIT ?`)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map((r) => getTask(Number(r.id))!);
}

export function listSmsPatterns(): CrmSmsPattern[] {
  ensureCrmSchema();
  const rows = db().prepare('SELECT * FROM crm_sms_patterns ORDER BY id').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    publicId: makeCrmUuid('PT', Number(r.id)),
    name: String(r.name),
    type: String(r.type),
    text: String(r.text),
    trigger: String(r.trigger_key),
    auto: Boolean(r.auto),
    active: Boolean(r.active),
  }));
}

export function upsertSmsPattern(input: {
  id?: number;
  name: string;
  type?: string;
  text: string;
  trigger?: string;
  auto?: boolean;
  active?: boolean;
}): CrmSmsPattern {
  ensureCrmSchema();
  const name = String(input.name || '').trim();
  const text = String(input.text || '').trim();
  if (!name || !text) throw new Error('نام و متن پترن الزامی است');
  if (input.id) {
    db()
      .prepare(
        `UPDATE crm_sms_patterns SET name = ?, type = ?, text = ?, trigger_key = ?, auto = ?, active = ? WHERE id = ?`
      )
      .run(
        name,
        String(input.type || 'dynamic'),
        text,
        String(input.trigger || 'manual'),
        input.auto ? 1 : 0,
        input.active === false ? 0 : 1,
        input.id
      );
  } else {
    const info = db()
      .prepare(
        `INSERT INTO crm_sms_patterns (name, type, text, trigger_key, auto, active) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        String(input.type || 'dynamic'),
        text,
        String(input.trigger || 'manual'),
        input.auto ? 1 : 0,
        input.active === false ? 0 : 1
      );
    input.id = Number(info.lastInsertRowid);
  }
  return listSmsPatterns().find((p) => p.id === input.id)!;
}

export function deleteSmsPattern(id: number): void {
  ensureCrmSchema();
  const info = db().prepare('DELETE FROM crm_sms_patterns WHERE id = ?').run(id);
  if (!info.changes) throw Object.assign(new Error('پترن یافت نشد'), { status: 404 });
}

export function renderSmsPattern(
  text: string,
  ctx: { customer?: CrmCustomer; ticketPublicId?: string; agentName?: string }
): string {
  const c = ctx.customer;
  const fullName = c ? `${c.first || ''} ${c.last || ''}`.trim() : '';
  const name = fullName || c?.first || 'مشتری';
  const product = c?.product || 'Pet Date';
  const ticket = ctx.ticketPublicId || '';
  const agent = ctx.agentName || '';
  return text
    .replace(/\{name\}/gi, name)
    .replace(/\{product\}/gi, product)
    .replace(/\{ticket\}/gi, ticket)
    .replace(/\{agent\}/gi, agent)
    .replace(/\{نام\}/g, name)
    .replace(/\{محصول\}/g, product)
    .replace(/\{شناسه\}/g, ticket)
    .replace(/\{کارشناس\}/g, agent);
}

export type CrmSmsDelivery =
  | { sent: true; phone: string }
  | { sent: false; skipped: true; reason: string };

export async function sendSmsPattern(
  patternId: number,
  customerId: number,
  actor: AdminAuthActor,
  extra?: { ticketPublicId?: string; requirePanel?: boolean }
): Promise<{ text: string; interactionId: number; delivery: CrmSmsDelivery }> {
  ensureCrmSchema();
  const pattern = listSmsPatterns().find((p) => p.id === patternId);
  if (!pattern) throw new Error('پترن یافت نشد');
  if (!pattern.active && extra?.requirePanel) {
    throw new Error('این پترن غیرفعال است');
  }
  const customer = getCustomer(customerId);
  if (!customer) throw new Error('مشتری یافت نشد');

  if (extra?.requirePanel) {
    if (!isCandooConfigured()) {
      throw Object.assign(new Error('سرویس پیامک پیکربندی نشده'), { status: 503 });
    }
    if (!customer.mobile) {
      throw Object.assign(new Error('شماره موبایل ثبت نشده'), { status: 400 });
    }
    if (!normalizeIranMobile(customer.mobile)) {
      throw Object.assign(new Error('شماره موبایل نامعتبر است'), { status: 400 });
    }
  }

  const text = renderSmsPattern(pattern.text, {
    customer,
    ticketPublicId: extra?.ticketPublicId,
    agentName: actorLabel(actor),
  });
  const info = db()
    .prepare(
      `INSERT INTO crm_interactions (
        customer_id, channel, direction, agent_id, agent_name, started_at, ended_at,
        reason, outcome, summary, wrap_done
      ) VALUES (?, 'sms', 'out', ?, ?, ?, ?, 'پیامک', 'پاسخ داده‌شده', ?, 1)`
    )
    .run(customerId, actorId(actor), actorLabel(actor), nowIso(), nowIso(), text);

  let delivery: CrmSmsDelivery;
  if (!isCandooConfigured()) {
    delivery = { sent: false, skipped: true, reason: 'سرویس پیامک پیکربندی نشده' };
  } else if (!customer.mobile) {
    delivery = { sent: false, skipped: true, reason: 'شماره موبایل ثبت نشده' };
  } else {
    const recipient = normalizeIranMobile(customer.mobile);
    if (!recipient) {
      delivery = { sent: false, skipped: true, reason: 'شماره موبایل نامعتبر است' };
    } else {
      try {
        const sent = await candooSendWithSrcFallback({
          recipient,
          body: text,
          customerId: customer.platformUserId ?? undefined,
          type: 0,
        });
        if (sent.ok) {
          delivery = { sent: true, phone: formatIranMobileDisplay(recipient) };
        } else {
          delivery = { sent: false, skipped: true, reason: sent.error || 'ارسال پیامک ناموفق بود' };
          if (extra?.requirePanel) {
            throw Object.assign(new Error(delivery.reason), { status: 502 });
          }
        }
      } catch (err) {
        if (extra?.requirePanel && (err as Error & { status?: number }).status) throw err;
        console.error('CRM SMS send failed:', err);
        delivery = { sent: false, skipped: true, reason: 'خطا در ارسال پیامک' };
        if (extra?.requirePanel) {
          throw Object.assign(new Error(delivery.reason), { status: 502 });
        }
      }
    }
  }

  return { text, interactionId: Number(info.lastInsertRowid), delivery };
}

export async function sendSmsPatternBulk(
  patternId: number,
  customerIds: number[],
  actor: AdminAuthActor
): Promise<{
  ok: number;
  failed: number;
  results: Array<{ customerId: number; ok: boolean; error?: string; text?: string }>;
}> {
  const ids = [...new Set(customerIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) throw new Error('حداقل یک مشتری انتخاب کنید');
  if (ids.length > 100) throw new Error('حداکثر ۱۰۰ گیرنده در هر ارسال');
  const results: Array<{ customerId: number; ok: boolean; error?: string; text?: string }> = [];
  let ok = 0;
  let failed = 0;
  for (const customerId of ids) {
    try {
      const sent = await sendSmsPattern(patternId, customerId, actor, { requirePanel: true });
      results.push({ customerId, ok: true, text: sent.text });
      ok += 1;
    } catch (err) {
      failed += 1;
      results.push({
        customerId,
        ok: false,
        error: err instanceof Error ? err.message : 'خطا',
      });
    }
  }
  return { ok, failed, results };
}

function dispatchSmsEvent(
  event: string,
  ctx: { customerId: number; ticketPublicId?: string },
  actor: AdminAuthActor
): void {
  ensureCrmSchema();
  const patterns = listSmsPatterns().filter((p) => p.trigger === event && p.auto && p.active);
  for (const p of patterns) {
    void sendSmsPattern(p.id, ctx.customerId, actor, { ticketPublicId: ctx.ticketPublicId }).catch((err) => {
      console.error('CRM auto SMS failed:', p.id, err);
    });
  }
}

export function listKpiModels(): CrmKpiModel[] {
  ensureCrmSchema();
  const rows = db().prepare('SELECT * FROM crm_kpi_models ORDER BY id').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    scope: String(r.scope),
    ref: String(r.ref || ''),
    active: Boolean(r.active),
    items: parseJson(r.items_json, []),
  }));
}

export function getCrmSettings(): CrmSettings {
  ensureCrmSchema();
  const read = <T,>(key: string, fallback: T): T => {
    const row = db().prepare('SELECT value FROM crm_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? parseJson(row.value, fallback) : fallback;
  };
  return {
    slaPolicy: read('slaPolicy', CRM_SLA_POLICY as unknown as Record<string, [number, number]>),
    reasonTree: read('reasonTree', CRM_REASON_TREE),
    deletedReasons: read('deletedReasons', [] as CrmSettings['deletedReasons']),
    scorecard: read('scorecard', [...CRM_SCORECARD]),
    criticalErrors: read('criticalErrors', [...CRM_CRITICAL_ERRORS]),
    surveyQuestions: read('surveyQuestions', [...CRM_SURVEY_QUESTIONS]),
  };
}

export function updateCrmSettings(patch: Partial<CrmSettings>): CrmSettings {
  ensureCrmSchema();
  const cur = getCrmSettings();
  const next: CrmSettings = {
    slaPolicy: patch.slaPolicy ?? cur.slaPolicy,
    reasonTree: patch.reasonTree ?? cur.reasonTree,
    deletedReasons: patch.deletedReasons ?? cur.deletedReasons,
    scorecard: patch.scorecard ?? cur.scorecard,
    criticalErrors: patch.criticalErrors ?? cur.criticalErrors,
    surveyQuestions: patch.surveyQuestions ?? cur.surveyQuestions,
  };
  const upsert = db().prepare(
    `INSERT INTO crm_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  );
  upsert.run('slaPolicy', JSON.stringify(next.slaPolicy));
  upsert.run('reasonTree', JSON.stringify(next.reasonTree));
  upsert.run('deletedReasons', JSON.stringify(next.deletedReasons));
  upsert.run('scorecard', JSON.stringify(next.scorecard));
  upsert.run('criticalErrors', JSON.stringify(next.criticalErrors));
  upsert.run('surveyQuestions', JSON.stringify(next.surveyQuestions));
  return next;
}

export function listInbox(opts?: {
  q?: string;
  kind?: string;
  sla?: string;
  agentId?: string;
  unassignedOnly?: boolean;
  limit?: number;
}): { total: number; rows: CrmInboxRow[] } {
  ensureCrmSchema();
  const limit = Math.min(200, Math.max(1, opts?.limit || 80));
  const rows: CrmInboxRow[] = [];

  for (const t of listTickets({ limit: 100 })) {
    rows.push({
      kind: 'ticket',
      id: t.id,
      publicId: t.publicId,
      title: t.title,
      customerName: t.customerName || customerName(t.customerId),
      customerMobile: '',
      agentName: t.agentName || '—',
      priority: String(t.priority),
      status: t.status,
      dueAt: t.slaDue,
      slaState: t.slaState || 'ok',
      borderColor: t.borderColor || crmInboxBorderColor(t.slaState || 'ok'),
      createdAt: t.createdAt,
    });
  }
  for (const f of listFollowups({ status: 'باز', limit: 50 })) {
    const overdue = new Date(f.dueAt).getTime() < Date.now();
    rows.push({
      kind: 'followup',
      id: f.id,
      publicId: f.publicId,
      title: f.description || f.kind,
      customerName: f.customerName || customerName(f.customerId),
      customerMobile: '',
      agentName: f.ownerName || f.ownerId,
      priority: f.priority,
      status: f.status,
      dueAt: f.dueAt,
      slaState: overdue ? 'breached' : 'ok',
      borderColor: crmInboxBorderColor(overdue ? 'breached' : 'ok'),
      createdAt: f.createdAt,
    });
  }
  for (const i of listInteractions({ limit: 40 }).filter((x) => !x.wrapDone)) {
    rows.push({
      kind: 'interaction',
      id: i.id,
      publicId: i.publicId,
      title: `Wrap-up ناقص · ${CRM_CHANNEL_LABELS[i.channel] || i.channel}`,
      customerName: i.customerName || customerName(i.customerId),
      customerMobile: i.customerMobile || '',
      agentName: i.agentName || i.agentId,
      priority: 'متوسط',
      status: 'wrap_pending',
      dueAt: null,
      slaState: 'at_risk',
      borderColor: crmInboxBorderColor('at_risk', { wrapPending: true }),
      createdAt: i.startedAt,
    });
  }
  for (const task of listTasks({ status: 'باز', limit: 30 })) {
    rows.push({
      kind: 'task',
      id: task.id,
      publicId: task.publicId,
      title: task.title,
      customerName: '—',
      customerMobile: '',
      agentName: task.assigneeId,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt,
      slaState: 'ok',
      borderColor: crmInboxBorderColor('ok', { internal: true }),
      createdAt: task.createdAt,
    });
  }

  let filtered = rows;
  if (opts?.kind) filtered = filtered.filter((r) => r.kind === opts.kind);
  if (opts?.sla) filtered = filtered.filter((r) => r.slaState === opts.sla);
  if (opts?.unassignedOnly) filtered = filtered.filter((r) => r.agentName === '—' || !r.agentName);
  if (opts?.agentId) filtered = filtered.filter((r) => r.agentName.includes(opts.agentId!) || r.publicId);
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.publicId.toLowerCase().includes(q)
    );
  }
  filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { total: filtered.length, rows: filtered.slice(0, limit) };
}

export function assignInboxItem(
  kind: string,
  id: number,
  actor: AdminAuthActor
): { ok: true } {
  ensureCrmSchema();
  if (kind === 'ticket') {
    assignTicketToMe(id, actor);
    return { ok: true };
  }
  if (kind === 'followup') {
    db()
      .prepare(`UPDATE crm_followups SET owner_id = ?, owner_name = ? WHERE id = ?`)
      .run(actorId(actor), actorLabel(actor), id);
    return { ok: true };
  }
  if (kind === 'interaction') {
    db()
      .prepare(`UPDATE crm_interactions SET agent_id = ?, agent_name = ? WHERE id = ?`)
      .run(actorId(actor), actorLabel(actor), id);
    return { ok: true };
  }
  if (kind === 'task') {
    db().prepare(`UPDATE crm_tasks SET assignee_id = ? WHERE id = ?`).run(actorId(actor), id);
    return { ok: true };
  }
  throw new Error('نوع آیتم نامعتبر است');
}

export function getCrmDashboard(actor: AdminAuthActor): CrmDashboard {
  ensureCrmSchema();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const tickets = listTickets({ limit: 300 });
  const openTickets = tickets.filter((t) => !['حل‌شده', 'بسته‌شده'].includes(t.status));
  const breachedSla = openTickets.filter((t) => t.slaState === 'breached').length;
  const atRiskSla = openTickets.filter((t) => t.slaState === 'at_risk').length;
  const unassigned = openTickets.filter((t) => !t.agentId).length;
  const interactions = listInteractions({ limit: 500 });
  const weekInteractions = interactions.filter((i) => i.startedAt >= weekAgo);
  const wrapPending = interactions.filter((i) => !i.wrapDone).length;
  const followups = listFollowups({ status: 'باز', limit: 100 });
  const overdueFollowups = followups.filter((f) => new Date(f.dueAt).getTime() < Date.now()).length;
  const openComplaints = listComplaints(100).filter((c) => !['حل‌شده', 'بسته‌شده'].includes(c.status)).length;
  const openReferrals = listReferrals(100).filter((r) => r.status === 'باز').length;
  const calls = interactions.filter((i) => i.channel === 'call_in' || i.channel === 'call_out');
  const weekCalls = calls.filter((c) => c.startedAt >= weekAgo);
  const inboundWeek = weekCalls.filter((c) => c.channel === 'call_in');
  const callsToday = calls.filter((c) => isToday(c.startedAt));
  const surveys = listSurveys(100);
  const qa = listQaReviews(100);
  const qaQueue = interactions.filter((i) => i.qaStatus === 'در صف' && i.wrapDone).length;
  const inbox = listInbox({ limit: 8 });

  const talkMinutesWeek = Math.round(weekCalls.reduce((s, c) => s + c.talkMinutes, 0));
  const aht = inboundWeek.length
    ? Math.round((inboundWeek.reduce((s, c) => s + c.talkMinutes, 0) / inboundWeek.length) * 10) / 10
    : 0;
  const firstCallResolved = weekInteractions.filter(
    (i) => (i.channel === 'call_in' || i.channel === 'call_out') && i.outcome === 'حل‌شده' && i.wrapDone
  ).length;
  const fcrPct = weekCalls.length ? Math.round((firstCallResolved / weekCalls.length) * 100) : 0;
  const weekTickets = tickets.filter((t) => t.createdAt >= weekAgo);
  const openWithSla = openTickets.filter((t) => t.slaState === 'ok' || t.slaState === 'at_risk' || t.slaState === 'breached');
  const slaOk = openWithSla.filter((t) => t.slaState === 'ok' || t.slaState === 'closed').length;
  const slaPct = openWithSla.length ? Math.round((slaOk / openWithSla.length) * 100) : 100;
  const resolvedWeek = tickets.filter(
    (t) => (t.status === 'حل‌شده' || t.status === 'بسته‌شده') && (t.resolvedAt || t.updatedAt) >= weekAgo
  ).length;
  const qaAvg = qa.length ? Math.round((qa.reduce((s, x) => s + x.total, 0) / qa.length) * 10) / 10 : null;

  const ringDefs: Array<{
    key: string;
    label: string;
    value: number;
    target: number;
    unit: string;
    metric: string;
    direction: 'gte' | 'lte';
  }> = [
    { key: 'calls_in', label: 'تماس‌های ورودی پاسخ‌داده‌شده', value: inboundWeek.length, target: 8, unit: 'تماس', metric: 'calls_answered', direction: 'gte' },
    { key: 'talk', label: 'مجموع دقایق مکالمه', value: talkMinutesWeek, target: 60, unit: 'دقیقه', metric: 'talk_minutes', direction: 'gte' },
    { key: 'aht', label: 'میانگین مدت رسیدگی (AHT)', value: aht, target: 12, unit: 'دقیقه', metric: 'wait_seconds', direction: 'lte' },
    { key: 'fcr', label: 'نرخ حل در تماس اول', value: fcrPct, target: 60, unit: '٪', metric: 'fcr', direction: 'gte' },
    { key: 'sla', label: 'پایبندی به SLA', value: slaPct, target: 90, unit: '٪', metric: 'sla', direction: 'gte' },
    { key: 'resolved', label: 'تیکت حل‌شده', value: resolvedWeek, target: 3, unit: 'تیکت', metric: 'tickets_resolved', direction: 'gte' },
    { key: 'qa', label: 'امتیاز کنترل کیفیت', value: qaAvg ?? 0, target: 85, unit: 'امتیاز', metric: 'qa_score', direction: 'gte' },
    { key: 'overdue_fu', label: 'پیگیری عقب‌افتاده', value: overdueFollowups, target: 0, unit: 'مورد', metric: 'sla_breach', direction: 'lte' },
  ];

  const kpis = ringDefs.map((d) => {
    const pct = Math.round(crmKpiAchievement(d.metric, d.value, d.target));
    return {
      key: d.key,
      label: d.label,
      value: d.value,
      target: d.target,
      unit: d.unit,
      pct,
      standing: crmKpiStanding(pct),
      direction: d.direction,
    };
  });
  const overallAchievement = kpis.length
    ? Math.round(kpis.reduce((s, k) => s + k.pct, 0) / kpis.length)
    : 0;
  const overallStanding = crmKpiStanding(overallAchievement);
  const weakPoints = kpis
    .filter((k) => k.pct < 70)
    .map((k) => `${k.label}: ${k.value} از ${k.target} ${k.unit} (${k.pct}٪)`);

  const channelMap = new Map<string, number>();
  for (const i of weekInteractions) {
    const key = i.channel === 'call_in' ? 'ورودی' : i.channel === 'call_out' ? 'خروجی' : CRM_CHANNEL_LABELS[i.channel] || i.channel;
    channelMap.set(key, (channelMap.get(key) || 0) + 1);
  }
  // ensure common channels appear
  for (const label of ['ورودی', 'پیامک', 'ایمیل', 'واتساپ']) {
    if (!channelMap.has(label)) channelMap.set(label, 0);
  }
  const channelDistribution = [...channelMap.entries()]
    .map(([label, value]) => ({ key: label, label, value }))
    .sort((a, b) => b.value - a.value);

  const dailyInteractions: Array<{ key: string; label: string; value: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'numeric', day: 'numeric' }).format(d);
    const count = weekInteractions.filter((x) => x.startedAt.slice(0, 10) === key).length;
    dailyInteractions.push({ key, label, value: count });
  }

  const inProgress = openTickets.filter((t) => ['در حال بررسی', 'تخصیص‌یافته', 'در انتظار مشتری', 'بازگشایی‌شده'].includes(t.status)).length;
  const ticketStatus = [
    { key: 'in_progress', label: 'در حال بررسی', value: inProgress, color: '#0ba5f2' },
    { key: 'unassigned', label: 'تخصیص‌نیافته', value: unassigned, color: '#5c4d91' },
    { key: 'breached', label: 'نقض SLA', value: breachedSla, color: '#c62828' },
    { key: 'resolved', label: 'حل‌شده (۷روز)', value: resolvedWeek, color: '#15cca0' },
  ];

  let dateLabel = '';
  try {
    dateLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);
  } catch {
    dateLabel = now.toISOString().slice(0, 10);
  }

  const roleLabel =
    actor.role === 'admin' || actor.role === 'crm_manager'
      ? 'مدیر باشگاه مشتریان'
      : actor.role === 'crm_lead'
        ? 'سرپرست امور مشتریان'
        : 'کارشناس امور مشتریان';

  const myTickets = openTickets
    .filter((t) => !t.agentId || t.agentId === actorId(actor) || isCrmAdmin(actor))
    .slice(0, 8);
  const upcomingFollowups = [...followups]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);

  return {
    greetingName: actorLabel(actor),
    roleLabel,
    dateLabel,
    openTickets: openTickets.length,
    breachedSla,
    atRiskSla,
    unassigned,
    wrapPending,
    openFollowups: followups.length,
    overdueFollowups,
    openComplaints,
    openReferrals,
    callsToday: callsToday.length,
    callMinutesToday: Math.round(callsToday.reduce((s, c) => s + c.talkMinutes, 0)),
    avgCsat: surveys.length ? Math.round((surveys.reduce((s, x) => s + x.rating, 0) / surveys.length) * 10) / 10 : null,
    qaAvg,
    qaQueue,
    overallAchievement,
    overallStanding,
    weakPoints,
    kpis,
    channelDistribution,
    dailyInteractions,
    ticketStatus,
    myTickets,
    upcomingFollowups,
    inboxPreview: inbox.rows,
    myTasks: listTasks({ status: 'باز', limit: 10 }),
  };
}

export function getCrmReportSummary(
  actor: AdminAuthActor,
  opts?: { agentId?: string; from?: string; to?: string }
): CrmReportSummary {
  ensureCrmSchema();
  if (opts?.agentId && opts.agentId !== actorId(actor) && !canSeeTeamReports(actor)) {
    const err = new Error('دسترسی گزارش تیمی ندارید') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  const agentFilter = canSeeTeamReports(actor) ? opts?.agentId : actorId(actor);

  const to = opts?.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)
    ? opts.to
    : new Date().toISOString().slice(0, 10);
  const from = opts?.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)
    ? opts.from
    : new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;
  const inRange = (iso: string | null | undefined) => !!iso && iso >= fromIso && iso <= toIso;

  let tickets = listTickets({ limit: 500 });
  if (agentFilter) tickets = tickets.filter((t) => t.agentId === agentFilter);
  const ticketsInRange = tickets.filter((t) => inRange(t.createdAt));
  const resolved = ticketsInRange.filter((t) => t.status === 'حل‌شده' || t.status === 'بسته‌شده');
  const openAll = tickets.filter((t) => !['حل‌شده', 'بسته‌شده'].includes(t.status));
  const openInScope = openAll;

  let interactions = listInteractions({ agentId: agentFilter, limit: 500 }).filter((i) =>
    inRange(i.startedAt)
  );
  const surveys = listSurveys(200).filter((x) => inRange(x.createdAt));
  const qa = listQaReviews(200).filter((x) => inRange(x.createdAt));
  const complaints = listComplaints(200).filter((c) => inRange(c.createdAt));

  type Agg = {
    agentId: string;
    agentName: string;
    ticketsResolved: number;
    ticketsOpen: number;
    inbound: number;
    outbound: number;
    minutes: number;
    fcrOk: number;
    callCount: number;
    slaOk: number;
    slaTotal: number;
    qa: number[];
    csat: number[];
  };
  const map = new Map<string, Agg>();
  const touch = (id: string, name: string): Agg => {
    const key = id || 'unassigned';
    let cur = map.get(key);
    if (!cur) {
      cur = {
        agentId: key,
        agentName: name || key,
        ticketsResolved: 0,
        ticketsOpen: 0,
        inbound: 0,
        outbound: 0,
        minutes: 0,
        fcrOk: 0,
        callCount: 0,
        slaOk: 0,
        slaTotal: 0,
        qa: [],
        csat: [],
      };
      map.set(key, cur);
    } else if (name && (!cur.agentName || cur.agentName === key)) {
      cur.agentName = name;
    }
    return cur;
  };

  for (const t of ticketsInRange) {
    const cur = touch(t.agentId || 'unassigned', t.agentName || 'بدون کارشناس');
    if (t.status === 'حل‌شده' || t.status === 'بسته‌شده') cur.ticketsResolved += 1;
  }
  for (const t of openInScope) {
    const cur = touch(t.agentId || 'unassigned', t.agentName || 'بدون کارشناس');
    cur.ticketsOpen += 1;
    if (t.slaState === 'ok' || t.slaState === 'at_risk' || t.slaState === 'breached') {
      cur.slaTotal += 1;
      if (t.slaState === 'ok') cur.slaOk += 1;
    }
  }
  for (const i of interactions) {
    const cur = touch(i.agentId || 'unassigned', i.agentName || 'بدون کارشناس');
    if (i.channel === 'call_in' || i.channel === 'call_out') {
      if (i.channel === 'call_in') cur.inbound += 1;
      else cur.outbound += 1;
      cur.callCount += 1;
      cur.minutes += i.talkMinutes;
      if (i.outcome === 'حل‌شده' && i.wrapDone) cur.fcrOk += 1;
    }
  }
  for (const r of qa) {
    touch(r.agentId, r.agentId).qa.push(r.total);
  }
  for (const s of surveys) {
    touch(s.agentId, s.agentId).csat.push(s.rating);
  }

  const teamLabel = 'امور مشتریان';
  const agents = [...map.values()]
    .filter((a) => a.agentId !== 'unassigned' || a.ticketsResolved + a.ticketsOpen + a.callCount > 0)
    .map((a) => {
      const aht = a.callCount ? Math.round((a.minutes / a.callCount) * 10) / 10 : 0;
      const fcrPct = a.callCount ? Math.round((a.fcrOk / a.callCount) * 100) : 0;
      const slaPct = a.slaTotal ? Math.round((a.slaOk / a.slaTotal) * 100) : 100;
      const qaAvg = a.qa.length ? Math.round(a.qa.reduce((s, n) => s + n, 0) / a.qa.length) : null;
      const csatAvg = a.csat.length
        ? Math.round((a.csat.reduce((s, n) => s + n, 0) / a.csat.length) * 10) / 10
        : null;
      const parts = [
        crmKpiAchievement('calls_answered', a.inbound + a.outbound, 8),
        crmKpiAchievement('talk_minutes', a.minutes, 60),
        crmKpiAchievement('wait_seconds', aht, 12),
        crmKpiAchievement('fcr', fcrPct, 60),
        crmKpiAchievement('sla', slaPct, 90),
        crmKpiAchievement('tickets_resolved', a.ticketsResolved, 3),
        crmKpiAchievement('qa_score', qaAvg ?? 0, 85),
      ];
      const achievement = Math.round(parts.reduce((s, n) => s + n, 0) / parts.length);
      return {
        agentId: a.agentId,
        agentName: a.agentName,
        teamLabel,
        inbound: a.inbound,
        outbound: a.outbound,
        minutes: Math.round(a.minutes),
        aht,
        fcrPct,
        slaPct,
        ticketsResolved: a.ticketsResolved,
        ticketsOpen: a.ticketsOpen,
        qaAvg,
        csatAvg,
        achievement,
        standing: crmKpiStanding(achievement),
      };
    })
    .sort((x, y) => y.achievement - x.achievement);

  const overallAchievement = agents.length
    ? Math.round(agents.reduce((s, a) => s + a.achievement, 0) / agents.length)
    : 0;
  const overallStanding = crmKpiStanding(overallAchievement);

  const reasonMap = new Map<string, number>();
  for (const i of interactions) {
    if (!i.reason) continue;
    reasonMap.set(i.reason, (reasonMap.get(i.reason) || 0) + 1);
  }
  const byReason = [...reasonMap.entries()].map(([reason, count]) => ({ reason, count }));
  const colors = ['#15cca0', '#3b82f6', '#14b8a6', '#ec4899', '#fd961e', '#8b5cf6', '#64748b'];
  const callReasons: CrmChartPoint[] = byReason
    .sort((a, b) => b.count - a.count)
    .map((r, idx) => ({
      key: r.reason,
      label: r.reason,
      value: r.count,
      color: colors[idx % colors.length],
    }));

  const now = Date.now();
  const ageCounts = [0, 0, 0, 0];
  for (const t of openInScope) {
    const ageH = (now - new Date(t.createdAt).getTime()) / 3600_000;
    if (ageH < 24) ageCounts[0] += 1;
    else if (ageH < 72) ageCounts[1] += 1;
    else if (ageH < 168) ageCounts[2] += 1;
    else ageCounts[3] += 1;
  }
  const ticketAge: CrmChartPoint[] = [
    { key: 'lt24', label: 'کمتر از ۲۴ ساعت', value: ageCounts[0], color: '#3b82f6' },
    { key: '1to3', label: '۱ تا ۳ روز', value: ageCounts[1], color: '#0ea5e9' },
    { key: '3to7', label: '۳ تا ۷ روز', value: ageCounts[2], color: '#6366f1' },
    { key: 'gt7', label: 'بیش از ۷ روز', value: ageCounts[3], color: '#94a3b8' },
  ];

  const openWithSla = openInScope.filter(
    (t) => t.slaState === 'ok' || t.slaState === 'at_risk' || t.slaState === 'breached'
  );
  const slaOk = openWithSla.filter((t) => t.slaState === 'ok').length;
  const slaPct = openWithSla.length ? Math.round((slaOk / openWithSla.length) * 1000) / 10 : 100;
  const csatAvg = surveys.length
    ? Math.round((surveys.reduce((s, x) => s + x.rating, 0) / surveys.length) * 10) / 10
    : null;
  const qaAvg = qa.length ? Math.round(qa.reduce((s, x) => s + x.total, 0) / qa.length) : null;

  const kpiRings: CrmKpiRing[] = [
    {
      key: 'csat',
      label: 'رضایت مشتری',
      value: csatAvg ?? 0,
      target: 5,
      unit: 'از ۵',
      pct: csatAvg != null ? Math.round((csatAvg / 5) * 1000) / 10 : 0,
      standing: crmKpiStanding(csatAvg != null ? (csatAvg / 5) * 100 : 0),
      direction: 'gte',
    },
    {
      key: 'sla',
      label: 'پایبندی به SLA',
      value: slaPct,
      target: 90,
      unit: '٪',
      pct: Math.round((slaPct / 90) * 1000) / 10,
      standing: crmKpiStanding(slaPct),
      direction: 'gte',
    },
  ];

  const dayMap = new Map<string, number>();
  for (const t of ticketsInRange) {
    const day = t.createdAt.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  return {
    ticketsResolved: resolved.length,
    ticketsOpen: openInScope.length,
    avgFirstResponseMin: null,
    avgResolveHours: null,
    csatAvg,
    qaAvg,
    byAgent: agents.map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      tickets: a.ticketsResolved + a.ticketsOpen,
      calls: a.inbound + a.outbound,
      qaAvg: a.qaAvg,
    })),
    byReason,
    dailyTickets: [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count })),
    from,
    to,
    overallAchievement,
    overallStanding,
    agents,
    callReasons,
    ticketAge,
    kpiRings,
    totals: {
      interactions: interactions.length,
      minutes: Math.round(interactions.reduce((s, i) => s + i.talkMinutes, 0)),
      tickets: ticketsInRange.length,
      complaints: complaints.length,
    },
    slaPct,
  };
}

export function listAuditLogs(limit = 100): Array<Record<string, unknown>> {
  ensureCrmSchema();
  return db()
    .prepare('SELECT * FROM crm_audit_logs ORDER BY at DESC LIMIT ?')
    .all(limit) as Array<Record<string, unknown>>;
}

export function runSlaWatcher(actor?: AdminAuthActor): { breached: number } {
  ensureCrmSchema();
  const open = listTickets({ limit: 500 }).filter(
    (t) => !['حل‌شده', 'بسته‌شده'].includes(t.status) && t.slaState === 'breached'
  );
  const fakeActor: AdminAuthActor = actor || {
    kind: 'env_admin',
    role: 'admin',
    permissions: ['admin.full'],
    displayName: 'سیستم',
    username: 'system',
  };
  for (const t of open) {
    dispatchSmsEvent('sla_breach', { customerId: t.customerId, ticketPublicId: t.publicId }, fakeActor);
    audit({
      userId: 'system',
      category: 'sla',
      entity: 'crm_tickets',
      recordUuid: t.publicId,
      action: 'sla_breach',
    });
  }
  return { breached: open.length };
}

/** System actor for end-user / bot portal ticket creation (audit trail). */
export function portalTicketActor(displayName = 'پورتال کاربر'): AdminAuthActor {
  return {
    kind: 'env_support',
    role: 'support',
    permissions: ['crm.write', 'support.write'],
    displayName,
    username: 'user_portal',
  };
}

/**
 * Resolve or create a CRM customer for a platform user (web/bot ticket form).
 * Prefer existing platform_user_id link, then mobile match, else create.
 */
export function findOrCreateCustomerForPlatformUser(
  user: {
    id: number;
    name?: string | null;
    phone?: string | null;
    telegramId?: string | null;
  },
  actor: AdminAuthActor,
  source = 'پورتال کاربر'
): CrmCustomer {
  ensureCrmSchema();
  const existingByUser = db()
    .prepare('SELECT * FROM crm_customers WHERE platform_user_id = ? ORDER BY id DESC LIMIT 1')
    .get(user.id) as Record<string, unknown> | undefined;
  if (existingByUser) return mapCustomer(existingByUser);

  const phone = normalizeMobile(String(user.phone || ''));
  if (phone && phone.length >= 10) {
    const customer = findOrCreateCustomerByMobile(
      {
        mobile: phone,
        first: String(user.name || '').trim().split(/\s+/)[0] || 'کاربر',
        last: String(user.name || '').trim().split(/\s+/).slice(1).join(' '),
        source,
      },
      actor
    );
    if (customer.platformUserId !== user.id) {
      db()
        .prepare(
          `UPDATE crm_customers SET platform_user_id = ?, updated_at = ? WHERE id = ? AND (platform_user_id IS NULL OR platform_user_id = 0)`
        )
        .run(user.id, nowIso(), customer.id);
      return getCustomer(customer.id) ?? customer;
    }
    return customer;
  }

  // No verified phone — stable synthetic mobile from platform user id (digits only).
  const synthetic = `09${String(1_000_000_000 + (user.id % 1_000_000_000)).slice(-9)}`;
  const bySynthetic = db()
    .prepare('SELECT * FROM crm_customers WHERE mobile = ?')
    .get(synthetic) as Record<string, unknown> | undefined;
  if (bySynthetic) {
    const c = mapCustomer(bySynthetic);
    if (c.platformUserId !== user.id) {
      db()
        .prepare(`UPDATE crm_customers SET platform_user_id = ?, updated_at = ? WHERE id = ?`)
        .run(user.id, nowIso(), c.id);
    }
    return getCustomer(c.id) ?? c;
  }

  const first = String(user.name || '').trim().split(/\s+/)[0] || 'کاربر';
  const last = String(user.name || '').trim().split(/\s+/).slice(1).join(' ');
  const info = db()
    .prepare(
      `INSERT INTO crm_customers (
        first_name, last_name, mobile, product, level, status, sales_owner, source,
        platform_user_id, sales_customer_id, created_at, updated_at
      ) VALUES (?, ?, ?, '', 'عادی', 'فعال', '', ?, ?, NULL, ?, ?)`
    )
    .run(first, last, synthetic, source, user.id, nowIso(), nowIso());
  const id = Number(info.lastInsertRowid);
  const customer = getCustomer(id)!;
  audit({
    userId: actorId(actor),
    category: 'customer',
    entity: 'crm_customers',
    recordUuid: customer.publicId,
    action: 'create',
    next: { mobile: synthetic, first, last, platformUserId: user.id },
  });
  return customer;
}

export function listTicketsForPlatformUser(platformUserId: number, limit = 30): CrmTicket[] {
  ensureCrmSchema();
  const lim = Math.min(100, Math.max(1, limit));
  const rows = db()
    .prepare(
      `${TICKET_SELECT}
       WHERE c.platform_user_id = ?
       ORDER BY t.created_at DESC LIMIT ?`
    )
    .all(platformUserId, lim) as Array<Record<string, unknown>>;
  return rows.map(enrichTicket);
}

/** End-user / bot: create a support ticket in the CRM ticketing module. */
export function createUserSupportTicket(
  user: {
    id: number;
    name?: string | null;
    phone?: string | null;
    telegramId?: string | null;
  },
  input: {
    title: string;
    description?: string;
    category?: string;
    channel?: string;
  }
): CrmTicket {
  const actor = portalTicketActor(user.name?.trim() || 'کاربر');
  const customer = findOrCreateCustomerForPlatformUser(user, actor);
  const title = String(input.title || '').trim();
  if (!title) {
    const err = new Error('موضوع تیکت الزامی است') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  if (title.length > 200) {
    const err = new Error('موضوع تیکت خیلی طولانی است') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  const description = String(input.description || '').trim();
  if (description.length > 4000) {
    const err = new Error('شرح تیکت خیلی طولانی است') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  const channel = String(input.channel || 'portal').trim() || 'portal';
  return createTicket(
    {
      customerId: customer.id,
      title,
      description,
      type: 'پشتیبانی',
      category: String(input.category || 'پلتفرم').trim() || 'پلتفرم',
      priority: 'متوسط',
      channel,
      queueId: 'q_support',
    },
    actor
  );
}
