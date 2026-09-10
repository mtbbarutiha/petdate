/**
 * پیوند HR admin API routes.
 */
import { Router } from 'express';
import { ADMIN_PERMISSION_LABELS, ADMIN_PERMISSIONS } from '@petdate/shared';
import { requirePermission } from '../admin-auth';
import * as hr from '../hr-service';
import * as hrMod from '../hr-modules';

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
  if (stage === 'استخدام‌شده') {
    const hired = hrMod.hireCandidate(id);
    if (!hired) {
      res.status(404).json({ error: 'متقاضی پیدا نشد' });
      return;
    }
    res.json(hired);
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

/* ---- Dashboards ---- */
hrAdminRouter.get('/dashboard', (_req, res) => {
  res.json(hrMod.getHrOverviewDashboard());
});

hrAdminRouter.get('/recruitment/dashboard', (_req, res) => {
  res.json(hrMod.getRecruitmentDashboard());
});

hrAdminRouter.get('/reports', (_req, res) => {
  res.json(hrMod.getReportsSummary());
});

hrAdminRouter.get('/onboarding', (_req, res) => {
  res.json({ records: hrMod.listOnboarding() });
});

hrAdminRouter.post('/onboarding', requirePermission('hr.write'), (req, res) => {
  const body = req.body || {};
  if (typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: 'نام الزامی است' });
    return;
  }
  const record = hrMod.createOnboarding({
    name: body.name,
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : '',
    startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
    candidateId: body.candidateId != null ? Number(body.candidateId) : null,
    employeeId: body.employeeId != null ? Number(body.employeeId) : null,
  });
  res.status(201).json({ record });
});

hrAdminRouter.patch('/onboarding/:id/tasks', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || !Array.isArray(req.body?.tasks)) {
    res.status(400).json({ error: 'پارامتر نامعتبر' });
    return;
  }
  const record = hrMod.updateOnboardingTasks(id, req.body.tasks);
  if (!record) {
    res.status(404).json({ error: 'رکورد پیدا نشد' });
    return;
  }
  res.json({ record });
});

hrAdminRouter.post('/requests', requirePermission('hr.write'), (req, res) => {
  try {
    const body = req.body || {};
    const employeeId = Number(body.employeeId);
    if (!Number.isFinite(employeeId) || typeof body.type !== 'string') {
      res.status(400).json({ error: 'همکار و نوع درخواست الزامی است' });
      return;
    }
    const request = hrMod.createRequest({
      employeeId,
      type: body.type,
      days: typeof body.days === 'number' ? body.days : Number(body.days) || 0,
      fromDate: typeof body.fromDate === 'string' ? body.fromDate : '',
      toDate: typeof body.toDate === 'string' ? body.toDate : '',
      description: typeof body.description === 'string' ? body.description : '',
    });
    res.status(201).json({ request });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.post('/requests/:id/advance', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    const request = hrMod.advanceRequest(id);
    if (!request) {
      res.status(404).json({ error: 'درخواست پیدا نشد' });
      return;
    }
    res.json({ request });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.post('/requests/:id/reject', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  try {
    const request = hrMod.rejectRequest(
      id,
      typeof req.body?.note === 'string' ? req.body.note : undefined
    );
    if (!request) {
      res.status(404).json({ error: 'درخواست پیدا نشد' });
      return;
    }
    res.json({ request });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.get('/leave-balances', (_req, res) => {
  res.json({ balances: hrMod.leaveBalancesAll() });
});

hrAdminRouter.get('/service', (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  res.json({
    entries: hrMod.listServiceEntries({
      year: Number.isFinite(year as number) ? year : undefined,
      month: Number.isFinite(month as number) ? month : undefined,
      employeeId: Number.isFinite(employeeId as number) ? employeeId : undefined,
    }),
  });
});

hrAdminRouter.post('/service', requirePermission('hr.write'), (req, res) => {
  try {
    const body = req.body || {};
    const entry = hrMod.createServiceEntry({
      employeeId: Number(body.employeeId),
      year: Number(body.year),
      month: Number(body.month),
      day: body.day != null ? Number(body.day) : 1,
      hours: body.hours != null ? Number(body.hours) : 0,
      minutes: body.minutes != null ? Number(body.minutes) : 0,
      note: typeof body.note === 'string' ? body.note : '',
    });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.delete('/service/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  res.json({ ok: hrMod.deleteServiceEntry(id) });
});

hrAdminRouter.get('/cost', (req, res) => {
  const now = new Date();
  const year = req.query.year ? Number(req.query.year) : now.getFullYear();
  const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
  res.json({
    year,
    month,
    entries: hrMod.listCostEntries({ year, month }),
    costs: hrMod.listMonthlyCosts(year, month),
    orgTotal: hrMod.listMonthlyCosts(year, month).reduce((s, c) => s + c.cost.total, 0),
  });
});

hrAdminRouter.post('/cost', requirePermission('hr.write'), (req, res) => {
  try {
    const body = req.body || {};
    const entry = hrMod.upsertCostEntry({
      employeeId: Number(body.employeeId),
      year: Number(body.year),
      month: Number(body.month),
      insurance: body.insurance != null ? Number(body.insurance) : 0,
      tax: body.tax != null ? Number(body.tax) : 0,
      bonus: body.bonus != null ? Number(body.bonus) : 0,
      sales: body.sales != null ? Number(body.sales) : 0,
    });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'خطا' });
  }
});

hrAdminRouter.post('/settings/layers', requirePermission('hr.write'), (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'نام لایه الزامی است' });
    return;
  }
  const layer = hrMod.createCareerLayer({
    name,
    sortOrder: typeof req.body?.sortOrder === 'number' ? req.body.sortOrder : 0,
    unlocks: typeof req.body?.unlocks === 'string' ? req.body.unlocks : '',
  });
  res.status(201).json({ layer });
});

hrAdminRouter.patch('/settings/layers/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const layer = hrMod.updateCareerLayer(id, req.body || {});
  if (!layer) {
    res.status(404).json({ error: 'لایه پیدا نشد' });
    return;
  }
  res.json({ layer });
});

hrAdminRouter.delete('/settings/layers/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  res.json({ ok: hrMod.deleteCareerLayer(id) });
});

hrAdminRouter.post('/settings/income-models', requirePermission('hr.write'), (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'نام مدل الزامی است' });
    return;
  }
  const model = hrMod.createIncomeModel({
    name,
    type: typeof req.body?.type === 'string' ? req.body.type : 'متغیر',
    variableAmount: Number(req.body?.variableAmount) || 0,
    variablePercent: Number(req.body?.variablePercent) || 0,
  });
  res.status(201).json({ model });
});

hrAdminRouter.patch('/settings/income-models/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const model = hrMod.updateIncomeModel(id, req.body || {});
  if (!model) {
    res.status(404).json({ error: 'مدل پیدا نشد' });
    return;
  }
  res.json({ model });
});

hrAdminRouter.delete('/settings/income-models/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  res.json({ ok: hrMod.deleteIncomeModel(id) });
});

hrAdminRouter.post('/settings/benefits', requirePermission('hr.write'), (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    res.status(400).json({ error: 'عنوان مزیت الزامی است' });
    return;
  }
  const benefit = hrMod.createBenefitDef({
    title,
    category: typeof req.body?.category === 'string' ? req.body.category : '',
    careerLayerId: req.body?.careerLayerId != null ? Number(req.body.careerLayerId) : null,
    jobTitle: typeof req.body?.jobTitle === 'string' ? req.body.jobTitle : null,
    cost: Number(req.body?.cost) || 0,
  });
  res.status(201).json({ benefit });
});

hrAdminRouter.patch('/settings/benefits/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const benefit = hrMod.updateBenefitDef(id, req.body || {});
  if (!benefit) {
    res.status(404).json({ error: 'مزیت پیدا نشد' });
    return;
  }
  res.json({ benefit });
});

hrAdminRouter.delete('/settings/benefits/:id', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  res.json({ ok: hrMod.deleteBenefitDef(id) });
});

hrAdminRouter.get('/cockpit', (_req, res) => {
  res.json({
    tasks: hrMod.cockpitTasks(),
    notifications: hrMod.listNotifications(),
  });
});

hrAdminRouter.post('/notifications/:id/read', requirePermission('hr.write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  hrMod.markNotificationRead(id);
  res.json({ ok: true });
});

hrAdminRouter.post('/notifications/read-all', requirePermission('hr.write'), (_req, res) => {
  hrMod.markAllNotificationsRead();
  res.json({ ok: true });
});

hrAdminRouter.post('/armita', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : '';
  res.json(hrMod.armitaChat(message));
});
