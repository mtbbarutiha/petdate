/**
 * Admin Customer Affairs / باشگاه مشتریان — /api/admin/crm/*
 */
import { Router } from 'express';
import { requirePermission } from '../admin-auth';
import {
  assignInboxItem,
  completeFollowup,
  createComplaint,
  createFollowup,
  createQaReview,
  createReferral,
  createSurvey,
  createTicket,
  findOrCreateCustomerByMobile,
  getCrmDashboard,
  getCrmReportSummary,
  getCrmSettings,
  getCustomerDetail,
  getInteraction,
  getTicket,
  isCrmAdmin,
  listAuditLogs,
  listComplaints,
  listCustomers,
  listFollowups,
  listInbox,
  listInteractions,
  listKpiModels,
  listQaReviews,
  listReferrals,
  listSmsPatterns,
  listSurveys,
  listTasks,
  listTicketActivities,
  listTickets,
  patchTicket,
  respondReferral,
  runSlaWatcher,
  sendSmsPattern,
  simulateInboundCall,
  updateCrmSettings,
  upsertSmsPattern,
  wrapUpInteraction,
} from '../crm-service';

export const crmAdminRouter = Router();

crmAdminRouter.use(requirePermission('crm.read'));

function actor(req: { adminActor?: import('../hr-service').AdminAuthActor }) {
  if (!req.adminActor) throw new Error('no actor');
  return req.adminActor;
}

function sendErr(res: import('express').Response, err: unknown, fallback = 400) {
  const e = err as Error & { status?: number };
  res.status(e.status || fallback).json({ error: e.message || 'خطا' });
}

crmAdminRouter.get('/dashboard', (req, res) => {
  try {
    res.json(getCrmDashboard(actor(req)));
  } catch (err) {
    sendErr(res, err, 500);
  }
});

crmAdminRouter.get('/workspace', (req, res) => {
  try {
    res.json(getCrmDashboard(actor(req)));
  } catch (err) {
    sendErr(res, err, 500);
  }
});

crmAdminRouter.get('/inbox', (req, res) => {
  res.json(
    listInbox({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      kind: typeof req.query.kind === 'string' ? req.query.kind : undefined,
      sla: typeof req.query.sla === 'string' ? req.query.sla : undefined,
      agentId: typeof req.query.agentId === 'string' ? req.query.agentId : undefined,
      unassignedOnly: req.query.unassignedOnly === '1',
      limit: req.query.limit ? Number(req.query.limit) : 80,
    })
  );
});

crmAdminRouter.post('/inbox/:kind/:id/assign-me', requirePermission('crm.write'), (req, res) => {
  try {
    res.json(assignInboxItem(String(req.params.kind), Number(req.params.id), actor(req)));
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/customers', (req, res) => {
  res.json(
    listCustomers({
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    })
  );
});

crmAdminRouter.get('/customers/:id', (req, res) => {
  const detail = getCustomerDetail(Number(req.params.id));
  if (!detail) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }
  res.json(detail);
});

crmAdminRouter.post('/customers', requirePermission('crm.write'), (req, res) => {
  try {
    const customer = findOrCreateCustomerByMobile(
      {
        mobile: String(req.body?.mobile || ''),
        first: req.body?.first,
        last: req.body?.last,
        product: req.body?.product,
        source: req.body?.source,
      },
      actor(req)
    );
    res.json({ customer });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/experience', (_req, res) => {
  res.json({ surveys: listSurveys(100) });
});

crmAdminRouter.post('/surveys', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({
      survey: createSurvey(
        {
          customerId: Number(req.body?.customerId),
          answers: req.body?.answers || {},
          notes: req.body?.notes,
          talkMinutes: req.body?.talkMinutes,
          assignedTo: req.body?.assignedTo,
          smsSent: Boolean(req.body?.smsSent),
        },
        actor(req)
      ),
    });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/calls', (req, res) => {
  res.json({
    interactions: listInteractions({
      agentId: typeof req.query.agentId === 'string' ? req.query.agentId : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    }),
  });
});

crmAdminRouter.post('/calls/simulate-inbound', requirePermission('crm.write'), (req, res) => {
  try {
    res.json(
      simulateInboundCall(
        {
          mobile: String(req.body?.mobile || ''),
          first: req.body?.first,
          last: req.body?.last,
          waitSeconds: req.body?.waitSeconds,
        },
        actor(req)
      )
    );
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/interactions/:id', (req, res) => {
  const interaction = getInteraction(Number(req.params.id));
  if (!interaction) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }
  res.json({ interaction });
});

crmAdminRouter.post('/interactions/:id/wrapup', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ interaction: wrapUpInteraction(Number(req.params.id), req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/cases', (req, res) => {
  const tab = typeof req.query.tab === 'string' ? req.query.tab : 'tickets';
  if (tab === 'follow') {
    res.json({ tab, followups: listFollowups({ limit: 100 }) });
    return;
  }
  if (tab === 'complaints') {
    res.json({ tab, complaints: listComplaints(100) });
    return;
  }
  if (tab === 'referrals') {
    res.json({ tab, referrals: listReferrals(100) });
    return;
  }
  res.json({ tab: 'tickets', tickets: listTickets({ limit: 100 }) });
});

crmAdminRouter.get('/tickets/:id', (req, res) => {
  const ticket = getTicket(Number(req.params.id));
  if (!ticket) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }
  res.json({ ticket, activities: listTicketActivities(ticket.id) });
});

crmAdminRouter.post('/tickets', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ ticket: createTicket(req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.patch('/tickets/:id', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ ticket: patchTicket(Number(req.params.id), req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/followups', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ followup: createFollowup(req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/followups/:id/complete', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({
      followup: completeFollowup(Number(req.params.id), String(req.body?.result || ''), actor(req)),
    });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/complaints', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ complaint: createComplaint(req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/referrals', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({ referral: createReferral(req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/referrals/:id/respond', requirePermission('crm.write'), (req, res) => {
  try {
    res.json({
      referral: respondReferral(
        Number(req.params.id),
        { approve: Boolean(req.body?.approve), response: req.body?.response },
        actor(req)
      ),
    });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/sms', (_req, res) => {
  res.json({ patterns: listSmsPatterns() });
});

crmAdminRouter.post('/sms/patterns', requirePermission('crm.admin'), (req, res) => {
  try {
    res.json({ pattern: upsertSmsPattern(req.body || {}) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/sms/send', requirePermission('crm.write'), (req, res) => {
  try {
    res.json(
      sendSmsPattern(Number(req.body?.patternId), Number(req.body?.customerId), actor(req), {
        ticketPublicId: req.body?.ticketPublicId,
      })
    );
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/qa', (_req, res) => {
  res.json({ reviews: listQaReviews(100), pending: listInteractions({ limit: 100 }).filter((i) => i.qaStatus === 'در صف' && i.wrapDone) });
});

crmAdminRouter.post('/qa/reviews', requirePermission('crm.admin'), (req, res) => {
  try {
    res.json({ review: createQaReview(req.body || {}, actor(req)) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/reports', (req, res) => {
  try {
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    res.json({
      summary: getCrmReportSummary(actor(req), { agentId, from, to }),
      audit: listAuditLogs(50),
      isAdmin: isCrmAdmin(actor(req)),
    });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/settings', (_req, res) => {
  res.json({ settings: getCrmSettings(), kpiModels: listKpiModels(), tasks: listTasks({ limit: 20 }) });
});

crmAdminRouter.patch('/settings', requirePermission('crm.admin'), (req, res) => {
  try {
    res.json({ settings: updateCrmSettings(req.body || {}) });
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.post('/sla/watch', requirePermission('crm.admin'), (req, res) => {
  try {
    res.json(runSlaWatcher(actor(req)));
  } catch (err) {
    sendErr(res, err);
  }
});

crmAdminRouter.get('/meta', (req, res) => {
  res.json({
    isAdmin: isCrmAdmin(actor(req)),
    channelLabels: true,
  });
});
