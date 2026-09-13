/**
 * Idempotent staff-agent roles + admin/HR accounts.
 * Safe on every ensureHrSchema() — never overwrites an existing password hash.
 */
import {
  STAFF_AGENTS,
  STAFF_ROLE_DEFS,
  resolveStaffSeedPassword,
  type StaffAgentDef,
} from '@petdate/shared';
import { getDb } from './db';
import {
  createAdminAccount,
  createEmployee,
  getEmployeePlainPassword,
} from './hr-service';

function db() {
  return getDb();
}

export function seedStaffRolesIfMissing(
  seedRoleIfMissing: (
    key: string,
    nameFa: string,
    description: string,
    permissions: readonly string[]
  ) => void
): void {
  for (const role of STAFF_ROLE_DEFS) {
    if (role.key === 'support') continue; // already seeded as the built-in support role
    seedRoleIfMissing(role.key, role.nameFa, role.description, role.permissions);
  }
}

export function mergeStaffRolePerms(
  mergeRolePerms: (key: string, required: readonly string[]) => void
): void {
  for (const role of STAFF_ROLE_DEFS) {
    if (role.key === 'support') continue; // never overwrite custom support edits
    mergeRolePerms(role.key, role.permissions);
  }
}

function findEmployeeId(agent: StaffAgentDef): number | undefined {
  const row = db()
    .prepare(
      `SELECT id FROM hr_employees
       WHERE lower(trim(username)) = lower(?)
          OR personnel_code = ?
       LIMIT 1`
    )
    .get(agent.username, agent.personnelCode) as { id: number } | undefined;
  return row?.id;
}

function findAccountId(username: string): number | undefined {
  const row = db()
    .prepare('SELECT id FROM admin_accounts WHERE username = ?')
    .get(username) as { id: number } | undefined;
  return row?.id;
}

function ensureEmployee(agent: StaffAgentDef, password: string | undefined): number | undefined {
  const existing = findEmployeeId(agent);
  if (existing) return existing;
  try {
    const emp = createEmployee({
      firstName: agent.firstName,
      lastName: agent.lastName,
      personnelCode: agent.personnelCode,
      username: agent.username,
      orgEmail: agent.orgEmail,
      jobTitle: agent.jobTitle,
      department: agent.department,
      location: 'غیرحضوری',
      cooperationType: 'تمام وقت',
      contractStatus: 'در حال همکاری',
      accessStatus: 'فعال',
      avatarUrl: agent.avatarUrl || '',
      password,
    });
    return emp.id;
  } catch {
    return findEmployeeId(agent);
  }
}

function ensureAccount(agent: StaffAgentDef, password: string): void {
  if (findAccountId(agent.username)) return;
  try {
    createAdminAccount({
      username: agent.username,
      password,
      roleKey: agent.roleKey,
      displayName: agent.displayName,
      isActive: true,
    });
  } catch {
    /* role missing / race — next boot retries */
  }
}

/**
 * Create missing staff employees + admin_accounts.
 * Password: ADMIN_STAFF_PASSWORD || ADMIN_SEED_PASSWORD || dev placeholder.
 * Production with no env password: generated once and stored on hr_employees.password
 * (existing HR reset / SMS pattern). Never overwrites an existing hash.
 */
export function seedStaffAgentRoster(): void {
  const envPassword = resolveStaffSeedPassword();
  for (const agent of STAFF_AGENTS) {
    const empId = ensureEmployee(agent, envPassword || undefined);
    const password =
      envPassword ||
      (empId ? getEmployeePlainPassword(empId) : '') ||
      '';
    if (password.length >= 6) {
      ensureAccount(agent, password);
    }
  }
}
