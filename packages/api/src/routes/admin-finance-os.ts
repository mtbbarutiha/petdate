/**
 * Admin Finance OS routes — /api/admin/finance-os/*
 */
import { Router } from 'express';
import { requirePermission } from '../admin-auth';
import {
  allocateFinanceOsExpense,
  classifyFinanceOsTransaction,
  createFinanceOsAccount,
  createFinanceOsPerson,
  getFinanceOsAccountsBundle,
  getFinanceOsAllocationBundle,
  getFinanceOsNavCounts,
  getFinanceOsTransactionsBundle,
  importFinanceOsTransactions,
  issueFinanceOsInvoice,
  markFinanceOsCommitmentDone,
  resolveFinanceOsSuspicious,
  updateFinanceOsAccount,
  updateFinanceOsBankBalance,
  upsertFinanceOsDim,
} from '../finance-os-service';

export const financeOsAdminRouter = Router();

financeOsAdminRouter.use(requirePermission('platform.read'));

financeOsAdminRouter.get('/nav-counts', (_req, res) => {
  try {
    res.json(getFinanceOsNavCounts());
  } catch (err) {
    console.error('finance-os nav-counts:', err);
    res.status(500).json({ error: (err as Error).message || 'خطای داخلی سرور' });
  }
});

financeOsAdminRouter.get('/accounts', (_req, res) => {
  try {
    res.json(getFinanceOsAccountsBundle());
  } catch (err) {
    console.error('finance-os accounts:', err);
    res.status(500).json({ error: (err as Error).message || 'خطای داخلی سرور' });
  }
});

financeOsAdminRouter.post('/accounts', requirePermission('platform.write'), (req, res) => {
  try {
    res.json(createFinanceOsAccount(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.patch('/accounts/:id', requirePermission('platform.write'), (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    res.json(updateFinanceOsAccount(id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.put('/dims', requirePermission('platform.write'), (req, res) => {
  try {
    const kind = req.body?.kind === 'expense' ? 'expense' : 'income';
    const key = String(req.body?.key || '');
    const items = Array.isArray(req.body?.items) ? req.body.items.map(String) : [];
    res.json(upsertFinanceOsDim(kind, key, items));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.post('/people', requirePermission('platform.write'), (req, res) => {
  try {
    res.json(createFinanceOsPerson(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.get('/transactions', (req, res) => {
  try {
    res.json(
      getFinanceOsTransactionsBundle({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        account: typeof req.query.account === 'string' ? req.query.account : undefined,
        direction: typeof req.query.direction === 'string' ? req.query.direction : undefined,
      })
    );
  } catch (err) {
    console.error('finance-os transactions:', err);
    res.status(500).json({ error: (err as Error).message || 'خطای داخلی سرور' });
  }
});

financeOsAdminRouter.post('/transactions/import', requirePermission('platform.write'), (req, res) => {
  try {
    res.json(importFinanceOsTransactions(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.patch('/transactions/:id/classify', requirePermission('platform.write'), (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    res.json(classifyFinanceOsTransaction(id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.post('/transactions/:id/suspicious', requirePermission('platform.write'), (req, res) => {
  try {
    const id = Number(req.params.id);
    const action = req.body?.action;
    if (!Number.isFinite(id) || (action !== 'keep' && action !== 'merge' && action !== 'discard')) {
      res.status(400).json({ error: 'درخواست نامعتبر' });
      return;
    }
    res.json(resolveFinanceOsSuspicious(id, action));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.get('/allocation', (_req, res) => {
  try {
    res.json(getFinanceOsAllocationBundle());
  } catch (err) {
    console.error('finance-os allocation:', err);
    res.status(500).json({ error: (err as Error).message || 'خطای داخلی سرور' });
  }
});

financeOsAdminRouter.post('/allocation/expenses/:id/allocate', requirePermission('platform.write'), (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    res.json(allocateFinanceOsExpense(id, req.body?.splits || []));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.post('/allocation/invoices', requirePermission('platform.write'), (req, res) => {
  try {
    res.json(issueFinanceOsInvoice(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.patch('/allocation/bank-balance', requirePermission('platform.write'), (req, res) => {
  try {
    res.json(updateFinanceOsBankBalance(Number(req.body?.bankBalance)));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

financeOsAdminRouter.post('/allocation/commitments/:id/done', requirePermission('platform.write'), (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'شناسه نامعتبر' });
      return;
    }
    res.json(markFinanceOsCommitmentDone(id));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
