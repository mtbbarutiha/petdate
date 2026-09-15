import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { randomBytes, scryptSync } from 'crypto';

const user = String(process.env.STAFF_USER || '').trim().toLowerCase();
const pass = String(process.env.STAFF_PASS || '');
if (!user || pass.length < 6) {
  console.log(JSON.stringify({ ok: false, error: 'bad_input' }));
  process.exit(2);
}

function hashPassword(password) {
  const s = randomBytes(16).toString('hex');
  const hash = scryptSync(password, s, 32).toString('hex');
  return `${s}:${hash}`;
}

async function tryAppReset() {
  const candidates = [
    'packages/api/dist/hr-service.js',
    'packages/api/dist/src/hr-service.js',
    'dist/hr-service.js',
  ];
  for (const c of candidates) {
    const abs = path.resolve(c);
    if (!fs.existsSync(abs)) continue;
    const hr = await import(pathToFileURL(abs).href);
    hr.ensureHrSchema?.();
    const emps = hr.listEmployees({ limit: 500 }).employees;
    const emp = emps.find((e) => String(e.username || '').toLowerCase() === user);
    if (!emp) return { ok: false, error: 'employee_missing' };
    hr.resetEmployeePassword(emp.id, pass);
    const accounts = hr.listAdminAccounts({ includeInactive: true });
    const acct = accounts.find((a) => a.username === user);
    if (acct) {
      const patch = { isActive: true, password: pass };
      if (user === 'leila') patch.roleKey = 'finance';
      try {
        hr.updateAdminAccount(acct.id, patch);
      } catch {
        hr.updateAdminAccount(acct.id, { isActive: true, password: pass });
      }
    }
    const after = hr.listAdminAccounts({ includeInactive: true }).find((a) => a.username === user);
    return { ok: true, via: 'dist', username: user, roleKey: after?.roleKey || null, active: !!after?.isActive };
  }

  if (fs.existsSync('packages/api/src/hr-service.ts')) {
    const script = `
      import { ensureHrSchema, listEmployees, resetEmployeePassword, updateAdminAccount, listAdminAccounts } from './packages/api/src/hr-service.ts';
      ensureHrSchema();
      const user = process.env.STAFF_USER.trim().toLowerCase();
      const pass = process.env.STAFF_PASS;
      const emp = listEmployees({ limit: 500 }).employees.find(e => String(e.username||'').toLowerCase() === user);
      if (!emp) { console.log(JSON.stringify({ ok:false, error:'employee_missing' })); process.exit(2); }
      resetEmployeePassword(emp.id, pass);
      const acct = listAdminAccounts({ includeInactive: true }).find(a => a.username === user);
      if (acct) {
        try { updateAdminAccount(acct.id, { isActive: true, password: pass, roleKey: user === 'leila' ? 'finance' : acct.roleKey }); }
        catch { updateAdminAccount(acct.id, { isActive: true, password: pass }); }
      }
      const after = listAdminAccounts({ includeInactive: true }).find(a => a.username === user);
      console.log(JSON.stringify({ ok:true, via:'tsx', username:user, roleKey: after?.roleKey || null, active: !!after?.isActive }));
    `;
    const r = spawnSync('npx', ['tsx', '-e', script], { env: process.env, encoding: 'utf8', cwd: process.cwd() });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.status || 0);
  }
  return null;
}

function sqliteFallback() {
  let Database;
  try {
    Database = createRequire(path.join(process.cwd(), 'packages/api/package.json'))('better-sqlite3');
  } catch {
    try {
      Database = createRequire(path.join(process.cwd(), 'package.json'))('better-sqlite3');
    } catch {
      return { ok: false, error: 'no_better_sqlite3' };
    }
  }
  const candidates = [
    path.join(process.cwd(), 'packages/api/data/petdate.db'),
    path.join(process.cwd(), 'data/petdate.db'),
    path.join(process.cwd(), 'petdate.db'),
  ];
  const dbPath = candidates.find((p) => fs.existsSync(p));
  if (!dbPath) return { ok: false, error: 'sqlite_missing' };
  const db = new Database(dbPath);
  const emp = db.prepare('SELECT id, username FROM hr_employees WHERE lower(trim(username)) = ?').get(user);
  if (!emp) return { ok: false, error: 'employee_missing' };
  db.prepare("UPDATE hr_employees SET password = ?, updated_at = datetime('now') WHERE id = ?").run(pass, emp.id);
  const hash = hashPassword(pass);
  const acct = db.prepare('SELECT id, role_key FROM admin_accounts WHERE username = ?').get(user);
  if (!acct) return { ok: false, error: 'admin_account_missing' };
  const role = user === 'leila' ? 'finance' : acct.role_key;
  db.prepare('UPDATE admin_accounts SET password_hash = ?, role_key = ?, is_active = 1 WHERE id = ?').run(hash, role, acct.id);
  return { ok: true, via: 'sqlite', username: user, roleKey: role, active: true, dbPath };
}

const app = await tryAppReset();
if (app) {
  console.log(JSON.stringify(app));
  process.exit(app.ok ? 0 : 3);
}
if (process.env.DATABASE_URL && String(process.env.DATABASE_URL).startsWith('postgres')) {
  console.log(JSON.stringify({ ok: false, error: 'postgres_needs_app_reset' }));
  process.exit(3);
}
const fb = sqliteFallback();
console.log(JSON.stringify(fb));
process.exit(fb.ok ? 0 : 4);