/**
 * Idempotent demo seed for باشگاه مشتریان / امور مشتریان.
 * Marker: crm_customers.mobile = 09120006001 — skip if present.
 */
import {
  createComplaint,
  createFollowup,
  createQaReview,
  createReferral,
  createSurvey,
  createTicket,
  ensureCrmSchema,
  findOrCreateCustomerByMobile,
  listCustomers,
  listSmsPatterns,
  listTickets,
  patchTicket,
  simulateInboundCall,
  wrapUpInteraction,
} from './crm-service';
import { getDb } from './db';
import type { AdminAuthActor } from './hr-service';
import { ADMIN_ROLE_PERMISSIONS } from '@petdate/shared';

const SEED_MOBILE = '09120006001';

function db() {
  return getDb();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const systemActor: AdminAuthActor = {
  kind: 'account',
  role: 'admin',
  permissions: ['admin.full'],
  displayName: 'سیستم',
  username: 'crm_seed',
};

export function ensureCrmRolePermissionBackfill(): void {
  const d = db();
  const merge = (key: string, required: readonly string[]) => {
    const row = d.prepare('SELECT id, permissions_json FROM admin_roles WHERE key = ?').get(key) as
      | { id: number; permissions_json: string }
      | undefined;
    if (!row) return;
    let perms: string[] = [];
    try {
      perms = JSON.parse(String(row.permissions_json || '[]')) as string[];
    } catch {
      perms = [];
    }
    const set = new Set(perms.map(String));
    let changed = false;
    for (const p of required) {
      if (!set.has(p)) {
        set.add(p);
        changed = true;
      }
    }
    if (changed) {
      d.prepare('UPDATE admin_roles SET permissions_json = ? WHERE id = ?').run(JSON.stringify([...set]), row.id);
    }
  };
  merge('admin', ADMIN_ROLE_PERMISSIONS.admin);
  merge('support', ['crm.read', 'crm.write', 'loyalty.read']);
  merge('crm_agent', ['crm.read', 'crm.write', 'loyalty.read']);
  merge('crm_lead', ['crm.read', 'crm.write', 'crm.admin', 'loyalty.read', 'loyalty.write']);
  merge('crm_manager', ['crm.read', 'crm.write', 'crm.admin', 'loyalty.read', 'loyalty.write']);
}

function seedAlreadyDone(): boolean {
  return Boolean(db().prepare('SELECT id FROM crm_customers WHERE mobile = ?').get(SEED_MOBILE));
}

export function seedCrmDemoIfNeeded(): void {
  ensureCrmSchema();
  ensureCrmRolePermissionBackfill();
  if (seedAlreadyDone()) return;

  const actor = systemActor;

  // Import a few sales customers into CRM when present
  try {
    const salesRows = db()
      .prepare('SELECT * FROM sales_customers ORDER BY id LIMIT 3')
      .all() as Array<Record<string, unknown>>;
    for (const s of salesRows) {
      findOrCreateCustomerByMobile(
        {
          mobile: String(s.mobile || ''),
          first: String(s.first_name || ''),
          last: String(s.last_name || ''),
          source: 'فروش',
          product: 'اشتراک Pet Date',
        },
        actor
      );
    }
  } catch {
    /* ignore */
  }

  const c1 = findOrCreateCustomerByMobile(
    { mobile: SEED_MOBILE, first: 'سارا', last: 'موسوی', product: 'اشتراک سالانه', source: 'لندینگ' },
    actor
  );
  const c2 = findOrCreateCustomerByMobile(
    { mobile: '09120006002', first: 'رضا', last: 'حیدری', product: 'بسته پرمیوم', source: 'تلگرام' },
    actor
  );
  const c3 = findOrCreateCustomerByMobile(
    { mobile: '09120006003', first: 'الهام', last: 'نادری', product: 'مشاوره دامپزشک', source: 'پشتیبانی' },
    actor
  );
  const c4 = findOrCreateCustomerByMobile(
    { mobile: '09120006004', first: 'پریسا', last: 'دهقان', product: 'اشتراک ماهانه', source: 'واتساپ' },
    actor
  );
  const c5 = findOrCreateCustomerByMobile(
    { mobile: '09120006005', first: 'فرشته', last: 'کاظمی', product: 'پکیج مربیگری', source: 'ریفرال' },
    actor
  );

  // 6 orders for VIP label on c1
  const insOrder = db().prepare(
    `INSERT INTO crm_orders (customer_id, product, amount, ordered_at) VALUES (?, ?, ?, ?)`
  );
  for (let i = 0; i < 6; i++) {
    insOrder.run(c1.id, `سفارش ویژه ${i + 1}`, 500_000 + i * 50_000, daysAgo(30 - i * 4));
  }
  db().prepare(`UPDATE crm_customers SET level = 'ویژه', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), c1.id);
  insOrder.run(c2.id, 'اشتراک سه‌ماهه', 1_290_000, daysAgo(10));
  insOrder.run(c3.id, 'مشاوره', 250_000, daysAgo(3));

  // Interactions + tickets
  const call1 = simulateInboundCall({ mobile: c1.mobile, first: c1.first, last: c1.last, waitSeconds: 12 }, actor);
  wrapUpInteraction(
    call1.interaction.id,
    {
      reason: 'اطلاعات محصول',
      subReason: 'ویژگی‌ها',
      detailReason: 'قیمت',
      outcome: 'تیکت ایجاد شد',
      summary: 'سوال درباره تمدید اشتراک سالانه و تخفیف',
      talkMinutes: 8,
      createTicket: true,
      ticketTitle: 'تمدید اشتراک سالانه',
      priority: 'بالا',
    },
    actor
  );

  const call2 = simulateInboundCall({ mobile: c2.mobile, waitSeconds: 40 }, actor);
  wrapUpInteraction(
    call2.interaction.id,
    {
      reason: 'شکایت',
      subReason: 'کیفیت',
      outcome: 'ارجاع به فروش',
      summary: 'نارضایتی از تحویل بسته پرمیوم و درخواست پیگیری فروش',
      talkMinutes: 15,
      requestedAction: 'بررسی سفارش و تماس فروش',
      createTicket: true,
      ticketTitle: 'شکایت تحویل پرمیوم',
      priority: 'بحرانی',
    },
    actor
  );

  const call3 = simulateInboundCall({ mobile: c3.mobile, waitSeconds: 5 }, actor);
  // leave wrap pending intentionally
  void call3;

  const call4 = simulateInboundCall({ mobile: c4.mobile, waitSeconds: 20 }, actor);
  wrapUpInteraction(
    call4.interaction.id,
    {
      reason: 'استفاده',
      subReason: 'ورود',
      outcome: 'حل‌شده',
      summary: 'بازنشانی رمز عبور با موفقیت انجام شد',
      talkMinutes: 4,
    },
    actor
  );

  const call5 = simulateInboundCall({ mobile: c5.mobile, waitSeconds: 8 }, actor);
  wrapUpInteraction(
    call5.interaction.id,
    {
      reason: 'اطلاعات محصول',
      subReason: 'خدمات',
      outcome: 'ارجاع به مالی',
      summary: 'درخواست فاکتور رسمی برای پکیج مربیگری',
      talkMinutes: 6,
      requestedAction: 'صدور فاکتور رسمی',
      amount: 2_200_000,
      createTicket: true,
      priority: 'متوسط',
    },
    actor
  );

  // Extra tickets: breached SLA, unassigned, resolved
  const breached = createTicket(
    {
      customerId: c1.id,
      title: 'تیکت نقض‌شده SLA',
      description: 'تیکت قدیمی برای دموی نقض SLA',
      priority: 'بحرانی',
      category: 'فنی',
    },
    actor
  );
  db()
    .prepare(`UPDATE crm_tickets SET created_at = ?, sla_due = ?, status = 'در حال بررسی', agent_id = ?, agent_name = ? WHERE id = ?`)
    .run(daysAgo(3), daysAgo(2), 'crm_seed', 'سیستم', breached.id);

  createTicket(
    {
      customerId: c4.id,
      title: 'تیکت بدون تخصیص',
      description: 'نیاز به تخصیص کارشناس',
      priority: 'متوسط',
      category: 'عمومی',
    },
    actor
  );

  const resolved = createTicket(
    {
      customerId: c5.id,
      title: 'تیکت حل‌شده نمونه',
      description: 'نمونه حل',
      priority: 'پایین',
      agentId: 'crm_seed',
      agentName: 'سیستم',
    },
    actor
  );
  patchTicket(
    resolved.id,
    { status: 'حل‌شده', resolutionCode: 'FIXED', resolutionNote: 'انجام شد', activityText: 'حل شد' },
    actor
  );

  createFollowup(
    {
      customerId: c1.id,
      kind: 'تماس',
      dueAt: daysAgo(1),
      priority: 'بالا',
      description: 'پیگیری تمدید اشتراک',
    },
    actor
  );
  createFollowup(
    {
      customerId: c2.id,
      kind: 'پیامک',
      dueAt: daysFromNow(1),
      priority: 'متوسط',
      description: 'ارسال لینک پیگیری شکایت',
    },
    actor
  );
  createFollowup(
    {
      customerId: c3.id,
      kind: 'ایمیل',
      dueAt: daysFromNow(2),
      priority: 'پایین',
      description: 'ارسال راهنمای ورود',
    },
    actor
  );
  createFollowup(
    {
      customerId: c4.id,
      kind: 'تماس',
      dueAt: daysFromNow(3),
      priority: 'متوسط',
      description: 'اطمینان از حل مشکل رمز',
    },
    actor
  );

  createComplaint(
    {
      customerId: c2.id,
      category: 'شکایت',
      subCategory: 'کیفیت',
      severity: 'بالا',
      description: 'شکایت دوم درباره پشتیبانی',
      againstTeam: 'پشتیبانی',
    },
    actor
  );

  createReferral(
    {
      type: 'sales',
      customerId: c3.id,
      reason: 'آپگرید',
      requestedAction: 'پیشنهاد آپگرید اشتراک',
      priority: 'متوسط',
      amount: 790_000,
    },
    actor
  );

  createSurvey(
    {
      customerId: c1.id,
      answers: { q1: 5, q2: 4, q3: 5, q4: 4, q5: 5 },
      notes: 'رضایت خوب',
      talkMinutes: 5,
      smsSent: true,
    },
    actor
  );
  createSurvey(
    {
      customerId: c4.id,
      answers: { q1: 3, q2: 3, q3: 4, q4: 3, q5: 2 },
      notes: 'نیاز به بهبود',
      talkMinutes: 4,
    },
    actor
  );

  const wrapped = listTickets({ limit: 20 });
  void wrapped;
  const interForQa = call1.interaction.id;
  createQaReview(
    {
      interactionId: interForQa,
      scores: { greeting: 90, listening: 85, knowledge: 80, resolution: 88, closing: 90, tone: 95 },
      comment: 'عملکرد خوب',
      strength: 'لحن',
      improvement: 'سرعت تشخیص نیاز',
      coaching: false,
    },
    actor
  );
  createQaReview(
    {
      interactionId: call2.interaction.id,
      scores: { greeting: 70, listening: 60, knowledge: 50, resolution: 40, closing: 55, tone: 30 },
      critical: ['توهین به مشتری'],
      comment: 'خطای بحرانی',
      coaching: true,
      improvement: 'آموزش لحن حرفه‌ای',
    },
    actor
  );

  // Ensure patterns exist
  void listSmsPatterns();
  void listCustomers();
}
