/**
 * پیوند HR admin API routes.
 */
import { Router } from 'express';
import { ADMIN_PERMISSION_LABELS, ADMIN_PERMISSIONS } from '@petdate/shared';
import { requirePermission } from '../admin-auth';
import * as hr from '../hr-service';

export const hrAdminRouter = Router();

hrAdminRouter.use(requirePermission('hr.read'));

hrAdminRouter.get('/employees', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const contractStatus =
    typeof req.query.contractStatus === 'string' ? req.query.contractStatus : undefined;
  const accessStatus =
    typeof req.query.accessStatus === 'string' ? req.query.accessStatus : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  res.json(
    hr.listEmployees({
      q,
      contractStatus,
      accessStatus,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    })
  );
});

hrAdminRouter.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const emp = hr.getEmployee(id);
  if (!emp) {
    res.status(404).json({ error: 'همکار پیدا نشد' });
    return;
  }
  res.json({ employee: emp });
});

hrAdminRouter.post('/employees', requirePermission('hr.write'), (req, res) => {
  const body = req.body || {};
  if (typeof body.firstName !== 'string' || typeof body.lastName !== 'string') {
    res.status(400).json({ error: 'نام و نام خانوادگی الزامی است' });
    return;
  }
  const employee = hr.createEmployee(body);
  res.status(201).json({ employee });
});

hrAdminRouter.patch('/employees/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const employee = hr.updateEmployee(id, req.body || {});
  if (!employee) {
    res.status(404).json({ error: 'همکار پیدا نشد' });
    return;
  }
  res.json({ employee });
});

hrAdminRouter.get('/contracts', (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  res.json({
    contracts: hr.listContracts(Number.isFinite(employeeId as number) ? employeeId : undefined),
  });
});

hrAdminRouter.post('/employees/:id/contracts', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const startDate = typeof req.body?.startDate === 'string' ? req.body.startDate : '';
  if (!startDate) {
    res.status(400).json({ error: 'تاریخ شروع الزامی است' });
    return;
  }
  const contract = hr.createContract(id, { ...req.body, startDate });
  if (!contract) {
    res.status(404).json({ error: 'همکار پیدا نشد' });
    return;
  }
  res.status(201).json({ contract });
});

hrAdminRouter.get('/ats/openings', (_req, res) => {
  res.json({ openings: hr.listJobOpenings() });
});

hrAdminRouter.post('/ats/openings', requirePermission('hr.write'), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    res.status(400).json({ error: 'عنوان آگهی الزامی است' });
    return;
  }
  const opening = hr.createJobOpening({
    title,
    department: typeof req.body?.department === 'string' ? req.body.department : '',
    status: typeof req.body?.status === 'string' ? req.body.status : 'باز',
    openings: typeof req.body?.openings === 'number' ? req.body.openings : 1,
  });
  res.status(201).json({ opening });
});

hrAdminRouter.get('/ats/candidates', (req, res) => {
  const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
  const jobOpeningId = req.query.jobOpeningId ? Number(req.query.jobOpeningId) : undefined;
  res.json({
    candidates: hr.listCandidates({
      stage,
      jobOpeningId: Number.isFinite(jobOpeningId as number) ? jobOpeningId : undefined,
    }),
  });
});

hrAdminRouter.post('/ats/candidates', requirePermission('hr.write'), (req, res) => {
  const body = req.body || {};
  if (typeof body.firstName !== 'string' || typeof body.lastName !== 'string') {
    res.status(400).json({ error: 'نام و نام خانوادگی الزامی است' });
    return;
  }
  const result = hr.createCandidate(body);
  res.status(201).json(result);
});

hrAdminRouter.patch('/ats/candidates/:id/stage', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  const stage = typeof req.body?.stage === 'string' ? req.body.stage : '';
  if (!Number.isFinite(id) || !stage) {
    res.status(400).json({ error: 'پارامتر نامعتبر' });
    return;
  }
  const candidate = hr.updateCandidateStage(id, stage);
  if (!candidate) {
    res.status(404).json({ error: 'متقاضی پیدا نشد' });
    return;
  }
  res.json({ candidate });
});

hrAdminRouter.get('/settings/layers', (_req, res) => {
  res.json({ careerLayers: hr.listCareerLayers() });
});

hrAdminRouter.get('/settings/income-models', (_req, res) => {
  res.json({ incomeModels: hr.listIncomeModels() });
});

hrAdminRouter.get('/settings/benefits', (_req, res) => {
  res.json({ benefitDefs: hr.listBenefitDefs() });
});

hrAdminRouter.get('/requests', (_req, res) => {
  res.json({ requests: hr.listRequests() });
});

hrAdminRouter.get('/rbac/roles', requirePermission('admin.full'), (_req, res) => {
  res.json({
    roles: hr.listAdminRoles({ includeInactive: true }),
    accounts: hr.listAdminAccounts({ includeInactive: true }),
  });
});

hrAdminRouter.get('/rbac/permissions', requirePermission('admin.full'), (_req, res) => {
  res.json({
    permissions: ADMIN_PERMISSIONS.map((key) => ({
      key,
      labelFa: ADMIN_PERMISSION_LABELS[key] || key,
    })),
  });
});

hrAdminRouter.post('/rbac/roles', requirePermission('admin.full'), (req, res) => {
  try {
    const body = req.body || {};
    const role = hr.createAdminRole({
      key: typeof body.key === 'string' ? body.key : '',
      nameFa: typeof body.nameFa === 'string' ? body.nameFa : '',
      description: typeof body.description === 'string' ? body.description : '',
      permissions: body.permissions,
    });
    res.status(201).json({ role });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.patch('/rbac/roles/:id', requirePermission('admin.full'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    const body = req.body || {};
    const role = hr.updateAdminRole(id, {
      nameFa: typeof body.nameFa === 'string' ? body.nameFa : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      permissions: body.permissions,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    });
    if (!role) {
      res.status(404).json({ error: 'نقش پیدا نشد' });
      return;
    }
    res.json({ role });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.delete('/rbac/roles/:id', requirePermission('admin.full'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    hr.deleteAdminRole(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.post('/rbac/accounts', requirePermission('admin.full'), (req, res) => {
  try {
    const body = req.body || {};
    const account = hr.createAdminAccount({
      username: typeof body.username === 'string' ? body.username : '',
      password: typeof body.password === 'string' ? body.password : '',
      roleKey: typeof body.roleKey === 'string' ? body.roleKey : '',
      displayName: typeof body.displayName === 'string' ? body.displayName : '',
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    });
    res.status(201).json({ account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.patch('/rbac/accounts/:id', requirePermission('admin.full'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    const body = req.body || {};
    const account = hr.updateAdminAccount(id, {
      password: typeof body.password === 'string' ? body.password : undefined,
      roleKey: typeof body.roleKey === 'string' ? body.roleKey : undefined,
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    });
    if (!account) {
      res.status(404).json({ error: 'حساب پیدا نشد' });
      return;
    }
    res.json({ account });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.delete('/rbac/accounts/:id', requirePermission('admin.full'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    hr.deleteAdminAccount(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});
