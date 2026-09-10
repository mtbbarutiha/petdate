/**
 * Platform Settings service — modular dropdown options (soft-delete) + module goals.
 * Additive schema only; never wipe existing rows.
 */
import {
  PLATFORM_MODULE_CATALOG,
  PLATFORM_MODULE_KEYS,
  getPlatformDropdownField,
  getPlatformGoalMetrics,
  listPlatformDropdownFields,
  type PlatformDropdownAuditEntry,
  type PlatformDropdownOption,
  type PlatformGoalPeriod,
  type PlatformModuleGoals,
  type PlatformModuleKey,
} from '@petdate/shared';
import { getDb } from './db';

function db() {
  return getDb();
}

let schemaReady = false;

export function ensurePlatformSettingsSchema(): void {
  if (schemaReady) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS platform_dropdown_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_key TEXT NOT NULL,
      field_key TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      UNIQUE(module_key, field_key, value)
    );
    CREATE INDEX IF NOT EXISTS idx_platform_dd_module_field
      ON platform_dropdown_options(module_key, field_key, active, sort_order);
    CREATE TABLE IF NOT EXISTS platform_dropdown_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER,
      module_key TEXT NOT NULL,
      field_key TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_platform_dd_audit_mod
      ON platform_dropdown_audit(module_key, field_key, created_at DESC);
    CREATE TABLE IF NOT EXISTS platform_module_goals (
      module_key TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'weekly',
      targets_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT,
      updated_by TEXT,
      PRIMARY KEY (module_key, period)
    );
  `);
  seedPlatformDropdownDefaults('system');
  schemaReady = true;
}

function mapOption(row: Record<string, unknown>): PlatformDropdownOption {
  return {
    id: Number(row.id),
    moduleKey: String(row.module_key),
    fieldKey: String(row.field_key),
    value: String(row.value),
    label: String(row.label),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 100),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    deletedAt: row.deleted_at != null ? String(row.deleted_at) : null,
  };
}

function mapAudit(row: Record<string, unknown>): PlatformDropdownAuditEntry {
  return {
    id: Number(row.id),
    optionId: row.option_id != null ? Number(row.option_id) : null,
    moduleKey: String(row.module_key),
    fieldKey: String(row.field_key),
    action: String(row.action) as PlatformDropdownAuditEntry['action'],
    actor: String(row.actor ?? ''),
    detail: String(row.detail ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function writeAudit(input: {
  optionId?: number | null;
  moduleKey: string;
  fieldKey: string;
  action: PlatformDropdownAuditEntry['action'];
  actor: string;
  detail: string;
}): void {
  db()
    .prepare(
      `INSERT INTO platform_dropdown_audit (option_id, module_key, field_key, action, actor, detail)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.optionId ?? null,
      input.moduleKey,
      input.fieldKey,
      input.action,
      input.actor || 'system',
      input.detail
    );
}

/** Idempotent seed of catalog defaults (INSERT OR IGNORE). */
export function seedPlatformDropdownDefaults(actor = 'system'): number {
  const d = db();
  const ins = d.prepare(
    `INSERT OR IGNORE INTO platform_dropdown_options
      (module_key, field_key, value, label, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
  );
  let inserted = 0;
  for (const mod of PLATFORM_MODULE_CATALOG) {
    const fields = listPlatformDropdownFields(mod.key);
    for (const field of fields) {
      field.defaults.forEach((opt, idx) => {
        const info = ins.run(mod.key, field.fieldKey, opt.value, opt.label, (idx + 1) * 10);
        if (Number(info.changes) > 0) inserted += 1;
      });
    }
  }
  if (inserted > 0) {
    writeAudit({
      moduleKey: '_system',
      fieldKey: '_seed',
      action: 'seed',
      actor,
      detail: `seeded ${inserted} default dropdown options`,
    });
  }
  return inserted;
}

export function listPlatformModules() {
  ensurePlatformSettingsSchema();
  return PLATFORM_MODULE_KEYS.map((key) => {
    const cat = PLATFORM_MODULE_CATALOG.find((m) => m.key === key)!;
    return {
      key,
      label: cat.label,
      dropdownCount: listPlatformDropdownFields(key).length,
      goalCount: cat.goals.length,
    };
  });
}

export function listDropdownFieldsForModule(moduleKey: string) {
  ensurePlatformSettingsSchema();
  return listPlatformDropdownFields(moduleKey).map((f) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    defaultCount: f.defaults.length,
  }));
}

export function listDropdownOptions(
  moduleKey: string,
  fieldKey: string,
  opts?: { includeInactive?: boolean }
): PlatformDropdownOption[] {
  ensurePlatformSettingsSchema();
  const includeInactive = opts?.includeInactive !== false;
  const rows = (
    includeInactive
      ? db()
          .prepare(
            `SELECT * FROM platform_dropdown_options
             WHERE module_key = ? AND field_key = ?
             ORDER BY active DESC, sort_order ASC, id ASC`
          )
          .all(moduleKey, fieldKey)
      : db()
          .prepare(
            `SELECT * FROM platform_dropdown_options
             WHERE module_key = ? AND field_key = ? AND active = 1
             ORDER BY sort_order ASC, id ASC`
          )
          .all(moduleKey, fieldKey)
  ) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    const field = getPlatformDropdownField(moduleKey, fieldKey);
    if (field) {
      seedPlatformDropdownDefaults();
      return listDropdownOptions(moduleKey, fieldKey, opts);
    }
  }
  return rows.map(mapOption);
}

/** Active labels only — for form selects. Inactive values still resolve via resolveDropdownLabel. */
export function listActiveDropdownLabels(moduleKey: string, fieldKey: string): string[] {
  return listDropdownOptions(moduleKey, fieldKey, { includeInactive: false }).map((o) => o.label);
}

export function listActiveDropdownValues(moduleKey: string, fieldKey: string): string[] {
  return listDropdownOptions(moduleKey, fieldKey, { includeInactive: false }).map((o) => o.value);
}

/**
 * Resolve display label for historical / report values.
 * Soft-deleted options remain queryable so reports never orphan.
 */
export function resolveDropdownLabel(
  moduleKey: string,
  fieldKey: string,
  value: string
): string {
  ensurePlatformSettingsSchema();
  const row = db()
    .prepare(
      `SELECT label FROM platform_dropdown_options
       WHERE module_key = ? AND field_key = ? AND value = ?
       LIMIT 1`
    )
    .get(moduleKey, fieldKey, value) as { label?: string } | undefined;
  if (row?.label) return String(row.label);
  const field = getPlatformDropdownField(moduleKey, fieldKey);
  const def = field?.defaults.find((d) => d.value === value);
  return def?.label ?? value;
}

export function createDropdownOption(input: {
  moduleKey: string;
  fieldKey: string;
  value?: string;
  label: string;
  sortOrder?: number;
  actor?: string;
}): PlatformDropdownOption {
  ensurePlatformSettingsSchema();
  const moduleKey = String(input.moduleKey || '').trim();
  const fieldKey = String(input.fieldKey || '').trim();
  const label = String(input.label || '').trim();
  if (!moduleKey || !fieldKey || !label) throw new Error('ماژول، فیلد و برچسب الزامی است');
  if (!getPlatformDropdownField(moduleKey, fieldKey)) {
    throw new Error('فیلد دراپ‌داون شناخته‌شده نیست');
  }
  const value = String(input.value || label).trim();
  const sortOrder =
    input.sortOrder != null && Number.isFinite(Number(input.sortOrder))
      ? Math.round(Number(input.sortOrder))
      : 500;
  const actor = input.actor || 'admin';

  const existing = db()
    .prepare(
      `SELECT * FROM platform_dropdown_options
       WHERE module_key = ? AND field_key = ? AND value = ?`
    )
    .get(moduleKey, fieldKey, value) as Record<string, unknown> | undefined;

  if (existing) {
    if (Boolean(existing.active)) {
      throw new Error('این گزینه از قبل فعال است');
    }
    db()
      .prepare(
        `UPDATE platform_dropdown_options
         SET label = ?, active = 1, deleted_at = NULL, sort_order = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(label, sortOrder, Number(existing.id));
    writeAudit({
      optionId: Number(existing.id),
      moduleKey,
      fieldKey,
      action: 'restore',
      actor,
      detail: `restore ${value} → ${label}`,
    });
    return listDropdownOptions(moduleKey, fieldKey).find((o) => o.id === Number(existing.id))!;
  }

  const info = db()
    .prepare(
      `INSERT INTO platform_dropdown_options
        (module_key, field_key, value, label, active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
    )
    .run(moduleKey, fieldKey, value, label, sortOrder);
  const id = Number(info.lastInsertRowid);
  writeAudit({
    optionId: id,
    moduleKey,
    fieldKey,
    action: 'create',
    actor,
    detail: `create ${value} → ${label}`,
  });
  return listDropdownOptions(moduleKey, fieldKey).find((o) => o.id === id)!;
}

export function updateDropdownOption(
  id: number,
  patch: { label?: string; sortOrder?: number; actor?: string }
): PlatformDropdownOption {
  ensurePlatformSettingsSchema();
  const row = db()
    .prepare('SELECT * FROM platform_dropdown_options WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new Error('گزینه پیدا نشد');
  const label =
    patch.label != null ? String(patch.label).trim() : String(row.label);
  if (!label) throw new Error('برچسب خالی مجاز نیست');
  const sortOrder =
    patch.sortOrder != null && Number.isFinite(Number(patch.sortOrder))
      ? Math.round(Number(patch.sortOrder))
      : Number(row.sort_order);
  db()
    .prepare(
      `UPDATE platform_dropdown_options
       SET label = ?, sort_order = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(label, sortOrder, id);
  writeAudit({
    optionId: id,
    moduleKey: String(row.module_key),
    fieldKey: String(row.field_key),
    action: 'update',
    actor: patch.actor || 'admin',
    detail: `update label=${label} sort=${sortOrder}`,
  });
  return mapOption({
    ...row,
    label,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  });
}

/** Soft-delete: retain row so historical reports can still resolve the label. */
export function softDeleteDropdownOption(id: number, actor = 'admin'): PlatformDropdownOption {
  ensurePlatformSettingsSchema();
  const row = db()
    .prepare('SELECT * FROM platform_dropdown_options WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new Error('گزینه پیدا نشد');
  if (!Boolean(row.active)) return mapOption(row);
  db()
    .prepare(
      `UPDATE platform_dropdown_options
       SET active = 0, deleted_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(id);
  writeAudit({
    optionId: id,
    moduleKey: String(row.module_key),
    fieldKey: String(row.field_key),
    action: 'soft_delete',
    actor,
    detail: `soft_delete ${String(row.value)} (${String(row.label)}) — retained for reports`,
  });
  return mapOption({
    ...row,
    active: 0,
    deleted_at: new Date().toISOString(),
  });
}

export function restoreDropdownOption(id: number, actor = 'admin'): PlatformDropdownOption {
  ensurePlatformSettingsSchema();
  const row = db()
    .prepare('SELECT * FROM platform_dropdown_options WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) throw new Error('گزینه پیدا نشد');
  db()
    .prepare(
      `UPDATE platform_dropdown_options
       SET active = 1, deleted_at = NULL, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(id);
  writeAudit({
    optionId: id,
    moduleKey: String(row.module_key),
    fieldKey: String(row.field_key),
    action: 'restore',
    actor,
    detail: `restore ${String(row.value)}`,
  });
  return mapOption({ ...row, active: 1, deleted_at: null });
}

export function listDropdownAudit(opts?: {
  moduleKey?: string;
  fieldKey?: string;
  limit?: number;
}): PlatformDropdownAuditEntry[] {
  ensurePlatformSettingsSchema();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts?.moduleKey) {
    where.push('module_key = ?');
    params.push(opts.moduleKey);
  }
  if (opts?.fieldKey) {
    where.push('field_key = ?');
    params.push(opts.fieldKey);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts?.limit || 100, 1), 500);
  const rows = db()
    .prepare(
      `SELECT * FROM platform_dropdown_audit ${whereSql}
       ORDER BY id DESC LIMIT ?`
    )
    .all(...params, limit) as Array<Record<string, unknown>>;
  return rows.map(mapAudit);
}

function emptyTargets(moduleKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of getPlatformGoalMetrics(moduleKey)) out[m.key] = 0;
  return out;
}

export function getModuleGoals(
  moduleKey: string,
  period?: PlatformGoalPeriod
): PlatformModuleGoals {
  ensurePlatformSettingsSchema();
  const metrics = getPlatformGoalMetrics(moduleKey);
  if (!metrics.length) throw new Error('ماژول هدف‌گذاری شناخته‌شده نیست');

  const preferred: PlatformGoalPeriod =
    period ||
    (metrics.some((m) => m.period === 'weekly') ? 'weekly' : 'monthly');

  const rows = db()
    .prepare('SELECT * FROM platform_module_goals WHERE module_key = ?')
    .all(moduleKey) as Array<Record<string, unknown>>;

  const targets = emptyTargets(moduleKey);
  let updatedAt: string | null = null;
  let updatedBy: string | null = null;
  let usedPeriod: PlatformGoalPeriod = preferred;

  for (const row of rows) {
    const p = String(row.period) as PlatformGoalPeriod;
    let parsed: Record<string, number> = {};
    try {
      const raw = JSON.parse(String(row.targets_json || '{}'));
      if (raw && typeof raw === 'object') {
        parsed = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, Number(v) || 0])
        );
      }
    } catch {
      parsed = {};
    }
    if (p === preferred || rows.length === 1) {
      Object.assign(targets, parsed);
      updatedAt = row.updated_at != null ? String(row.updated_at) : null;
      updatedBy = row.updated_by != null ? String(row.updated_by) : null;
      usedPeriod = p;
    }
  }

  for (const m of metrics) {
    if (m.period === preferred) continue;
    const row = rows.find((r) => String(r.period) === m.period);
    if (!row) continue;
    try {
      const raw = JSON.parse(String(row.targets_json || '{}')) as Record<string, unknown>;
      if (raw[m.key] != null) targets[m.key] = Number(raw[m.key]) || 0;
    } catch {
      /* ignore */
    }
  }

  return {
    moduleKey: moduleKey as PlatformModuleKey,
    period: usedPeriod,
    targets,
    updatedAt,
    updatedBy,
  };
}

export function upsertModuleGoals(input: {
  moduleKey: string;
  targets: Record<string, number>;
  actor?: string;
}): PlatformModuleGoals {
  ensurePlatformSettingsSchema();
  const moduleKey = String(input.moduleKey || '').trim();
  const metrics = getPlatformGoalMetrics(moduleKey);
  if (!metrics.length) throw new Error('ماژول هدف‌گذاری شناخته‌شده نیست');

  const byPeriod = new Map<PlatformGoalPeriod, Record<string, number>>();
  for (const m of metrics) {
    const cur = byPeriod.get(m.period) || {};
    const raw = input.targets[m.key];
    cur[m.key] = Math.max(0, Number(raw) || 0);
    byPeriod.set(m.period, cur);
  }

  const actor = input.actor || 'admin';
  const upsert = db().prepare(
    `INSERT INTO platform_module_goals (module_key, period, targets_json, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(module_key, period) DO UPDATE SET
       targets_json = excluded.targets_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  );

  for (const [period, targets] of byPeriod) {
    const existing = getModuleGoals(moduleKey, period);
    const merged = { ...emptyTargets(moduleKey), ...existing.targets, ...targets };
    const periodTargets: Record<string, number> = {};
    for (const m of metrics.filter((x) => x.period === period)) {
      periodTargets[m.key] = merged[m.key] ?? 0;
    }
    upsert.run(moduleKey, period, JSON.stringify(periodTargets), actor);
  }

  return getModuleGoals(moduleKey);
}

export function listAllModuleGoals(): PlatformModuleGoals[] {
  ensurePlatformSettingsSchema();
  return PLATFORM_MODULE_KEYS.map((k) => getModuleGoals(k));
}
