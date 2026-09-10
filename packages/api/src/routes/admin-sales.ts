/**
 * Admin Sales CRM routes — /api/admin/sales/*
 */
import { Router } from 'express';
import { requirePermission } from '../admin-auth';
import {
  advanceSalesStage,
  assignSalesItem,
  claimSalesItem,
  completeSalesFollowup,
  createSalesCall,
  createSalesFollowup,
  createSalesGoal,
  createSalesItem,
  createSalesOffer,
  createSalesSurvey,
  createSalesTicket,
  decideSalesOffer,
  financeDecide,
  getSalesCustomer,
  getSalesDashboard,
  getSalesItemDetail,
  getSalesNavCounts,
  getSalesPipeline,
  getSalesReportSummary,
  getSalesSettings,
  isSalesAdmin,
  listSalesCalls,
  listSalesCustomers,
  listSalesFollowups,
  listSalesGoals,
  listSalesItems,
  listSalesPatterns,
  listSalesProducts,
  listSalesTickets,
  markSalesLost,
  scoreSalesCall,
  sendFinanceInquiry,
  sendPaymentLink,
  sendSalesMessage,
  simulateIncomingCall,
  updateSalesSettings,
  updateSalesTicketStatus,
  upsertSalesPattern,
  upsertSalesProduct,
} from '../sales-service';

export const salesAdminRouter = Router();

salesAdminRouter.use(requirePermission('sales.read'));

function actor(req: { adminActor?: import('../hr-service').AdminAuthActor }) {
  if (!req.adminActor) throw new Error('no actor');
  return req.adminActor;
}

salesAdminRouter.get('/dashboard', (req, res) => {
  try {
    res.json(getSalesDashboard(actor(req)));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/nav-counts', (_req, res) => {
  res.json(getSalesNavCounts());
});

salesAdminRouter.post('/simulate-incoming', requirePermission('sales.write'), (_req, res) => {
  try {
    res.json(simulateIncomingCall());
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/pipeline', (_req, res) => {
  res.json(getSalesPipeline());
});

salesAdminRouter.get('/reports', (_req, res) => {
  res.json(getSalesReportSummary());
});

salesAdminRouter.get('/settings', (_req, res) => {
  res.json(getSalesSettings());
});

salesAdminRouter.patch('/settings', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json(updateSalesSettings(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/products', (req, res) => {
  const activeOnly = req.query.activeOnly === '1';
  res.json({ products: listSalesProducts({ activeOnly }) });
});

salesAdminRouter.post('/products', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({ product: upsertSalesProduct(req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.patch('/products/:id', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({
      product: upsertSalesProduct({
        id: Number(req.params.id),
        name: req.body?.name,
        price: req.body?.price,
        active: req.body?.active,
      }),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/items', (req, res) => {
  const kind = req.query.kind === 'upgrade' ? 'upgrade' : req.query.kind === 'lead' ? 'lead' : undefined;
  res.json(
    listSalesItems({
      kind,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      stage: typeof req.query.stage === 'string' ? req.query.stage : undefined,
      unassignedOnly: req.query.unassignedOnly === '1',
      limit: req.query.limit ? Number(req.query.limit) : 100,
    })
  );
});

salesAdminRouter.get('/items/:id', (req, res) => {
  const detail = getSalesItemDetail(Number(req.params.id));
  if (!detail) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }
  res.json(detail);
});

salesAdminRouter.post('/items', requirePermission('sales.write'), (req, res) => {
  try {
    const kind = req.body?.kind === 'upgrade' ? 'upgrade' : 'lead';
    const item = createSalesItem({ ...req.body, kind }, actor(req));
    res.json({ item });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/claim', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ item: claimSalesItem(Number(req.params.id), actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/assign', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({
      item: assignSalesItem(
        Number(req.params.id),
        String(req.body?.ownerId || ''),
        String(req.body?.ownerName || req.body?.ownerId || ''),
        actor(req)
      ),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/advance', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ item: advanceSalesStage(Number(req.params.id), actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/lost', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      item: markSalesLost(Number(req.params.id), String(req.body?.reason || ''), actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/calls', requirePermission('sales.write'), (req, res) => {
  try {
    res.json(createSalesCall({ ...req.body, refId: Number(req.params.id) }, actor(req)));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/offers', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      offer: createSalesOffer({ ...req.body, refId: Number(req.params.id) }, actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/payment-link', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      payment: sendPaymentLink({ ...req.body, refId: Number(req.params.id) }, actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/items/:id/messages', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      message: sendSalesMessage({ ...req.body, refId: Number(req.params.id) }, actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/offers/:id/decide', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({
      offer: decideSalesOffer(Number(req.params.id), Boolean(req.body?.approve), actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/payments/:id/finance-inquiry', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ ticket: sendFinanceInquiry(Number(req.params.id), actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/payments/:id/finance-decide', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json(financeDecide(Number(req.params.id), Boolean(req.body?.approve), actor(req)));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/calls', (req, res) => {
  const dir = req.query.dir === 'call_in' || req.query.dir === 'call_out' ? req.query.dir : undefined;
  res.json({
    calls: listSalesCalls({
      limit: 200,
      dir,
      qaPendingOnly: req.query.qaPendingOnly === '1',
    }),
  });
});

salesAdminRouter.post('/calls/:id/score', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      call: scoreSalesCall(Number(req.params.id), Number(req.body?.score), actor(req)),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/followups', (req, res) => {
  res.json({
    followups: listSalesFollowups({
      openOnly: req.query.openOnly === '1',
    }),
  });
});

salesAdminRouter.post('/followups', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ followup: createSalesFollowup(req.body || {}, actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.post('/followups/:id/complete', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ followup: completeSalesFollowup(Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/tickets', (req, res) => {
  res.json({
    tickets: listSalesTickets({
      cat: typeof req.query.cat === 'string' ? req.query.cat : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    }),
  });
});

salesAdminRouter.post('/tickets', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({ ticket: createSalesTicket(req.body || {}, actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.patch('/tickets/:id', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      ticket: updateSalesTicketStatus(Number(req.params.id), String(req.body?.status || 'در حال بررسی')),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/customers', (req, res) => {
  res.json(listSalesCustomers({ q: typeof req.query.q === 'string' ? req.query.q : undefined }));
});

salesAdminRouter.get('/customers/:id', (req, res) => {
  const detail = getSalesCustomer(Number(req.params.id));
  if (!detail) {
    res.status(404).json({ error: 'یافت نشد' });
    return;
  }
  res.json(detail);
});

salesAdminRouter.post('/customers/:id/surveys', requirePermission('sales.write'), (req, res) => {
  try {
    res.json({
      survey: createSalesSurvey(
        { ...req.body, customerId: Number(req.params.id) },
        actor(req)
      ),
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/patterns', (_req, res) => {
  res.json({ patterns: listSalesPatterns() });
});

salesAdminRouter.post('/patterns', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({ pattern: upsertSalesPattern(req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/goals', (_req, res) => {
  res.json({ goals: listSalesGoals() });
});

salesAdminRouter.post('/goals', requirePermission('sales.admin'), (req, res) => {
  try {
    res.json({ goal: createSalesGoal(req.body || {}, actor(req)) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

salesAdminRouter.get('/meta', (req, res) => {
  res.json({
    isSalesAdmin: isSalesAdmin(actor(req)),
    settings: getSalesSettings(),
  });
});
