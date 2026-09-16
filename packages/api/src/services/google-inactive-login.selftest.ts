/**
 * Soft-deleted shells must not capture Google/email login identities.
 * Run: cd packages/api && npx tsx src/services/google-inactive-login.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-google-inactive-${process.pid}.db`;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { dbService, getDb } = await import('../db');
  getDb();
  const d = getDb();
  const stamp = Date.now();
  const email = `inactive_${stamp}@petdate.test`;
  const sub = `google_inactive_${stamp}`;

  const user = dbService.findOrCreateWebUser({ email, name: 'Inactive Shell' });
  dbService.setUserGoogleSub(user.id, sub);
  d.prepare(
    `UPDATE users SET is_active = 0, name = ?, email = ?, google_sub = ? WHERE id = ?`
  ).run(`[حذف‌شده #${user.id}]`, email, sub, user.id);

  assert(dbService.getUserByEmail(email) == null, 'inactive email must not resolve for login');
  assert(dbService.getUserByGoogleSub(sub) == null, 'inactive google_sub must not resolve for login');

  let threw = false;
  try {
    dbService.createWebSession(
      user.id,
      `tok_inactive_${stamp}`,
      new Date(Date.now() + 3600_000).toISOString()
    );
  } catch {
    threw = true;
  }
  assert(threw, 'createWebSession must refuse inactive users');

  // Boot-time release: re-open migrate path by clearing via the same UPDATE migrate uses
  d.prepare(
    `UPDATE users SET
       google_sub = NULL,
       email = NULL,
       email_verified = 0,
       phone = NULL,
       phone_verified = 0,
       phone_verified_at = NULL
     WHERE COALESCE(is_active, 1) = 0
       AND (
         (google_sub IS NOT NULL AND google_sub != '')
         OR (email IS NOT NULL AND email != '')
         OR (phone IS NOT NULL AND phone != '')
       )`
  ).run();

  const shell = d
    .prepare('SELECT email, google_sub FROM users WHERE id = ?')
    .get(user.id) as { email?: string | null; google_sub?: string | null };
  assert(!String(shell.email ?? '').trim(), 'inactive email released');
  assert(!String(shell.google_sub ?? '').trim(), 'inactive google_sub released');

  const fresh = dbService.findOrCreateWebUser({ email, name: 'Fresh Google User' });
  assert(fresh.id !== user.id, 're-login creates a new active user');
  assert(fresh.isActive !== false, 'fresh user is active');
  dbService.setUserGoogleSub(fresh.id, sub);
  const tok = `tok_fresh_${stamp}`;
  dbService.createWebSession(fresh.id, tok, new Date(Date.now() + 3600_000).toISOString());
  assert(dbService.getWebSession(tok)?.userId === fresh.id, 'session persists for active user');

  console.log('google-inactive-login.selftest: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
