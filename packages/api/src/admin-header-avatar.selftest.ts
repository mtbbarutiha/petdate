/**
 * Admin header avatar resolution — HR profile photo + platform user fallback.
 * Run: cd packages/api && npx tsx src/admin-header-avatar.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-avatar-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';
process.env.ADMIN_SUPPORT_PASSWORD = '';
process.env.ADMIN_SEED_PASSWORD = 'petdate-seed';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb } = await import('./db');
  const {
    createAdminAccount,
    createEmployee,
    ensureHrSchema,
    resolveAdminActor,
  } = await import('./hr-service');

  ensureHrSchema();

  // 1) Matching username → HR photo
  createEmployee({
    firstName: 'آوا',
    lastName: 'تستی',
    username: 'ava.header',
    avatarUrl: 'https://cdn.example/ava.jpg',
  });
  createAdminAccount({
    username: 'ava.header',
    password: 'secret12',
    roleKey: 'support',
    displayName: 'آوا تستی',
  });
  const byUser = resolveAdminActor({ username: 'ava.header', password: 'secret12' });
  assert(byUser?.avatarUrl === 'https://cdn.example/ava.jpg', 'username match returns HR photo');

  // 2) Username mismatch, same display name as HR employee with photo
  createEmployee({
    firstName: 'کیان',
    lastName: 'آواتار',
    username: 'kian.hr.only',
    avatarUrl: 'https://cdn.example/kian.jpg',
  });
  createAdminAccount({
    username: 'kian.panel',
    password: 'seedpass1',
    roleKey: 'support',
    displayName: 'کیان آواتار',
  });
  const byName = resolveAdminActor({ username: 'kian.panel', password: 'seedpass1' });
  assert(
    byName?.avatarUrl === 'https://cdn.example/kian.jpg',
    'display-name match returns HR photo when usernames differ'
  );

  // 3) Platform users.avatar_url when no HR photo
  getDb()
    .prepare(
      `INSERT INTO users (telegram_id, name, username, avatar_url, role, created_at)
       VALUES (?, ?, ?, ?, 'owner', datetime('now'))`
    )
    .run('tg-support-ops', 'پشتیبان ویژه', 'support.ops', '/api/auth/avatar/9/face.jpg');
  createAdminAccount({
    username: 'support.ops',
    password: 'opsPass99',
    roleKey: 'support',
    displayName: 'اپراتور جدا',
  });
  const byPlatform = resolveAdminActor({ username: 'support.ops', password: 'opsPass99' });
  assert(
    byPlatform?.avatarUrl === '/api/auth/avatar/9/face.jpg',
    'platform user username match returns profile photo'
  );

  // 4) Bootstrap admin with HR username admin
  createEmployee({
    firstName: 'سیستم',
    lastName: 'ادمین',
    username: 'admin',
    avatarUrl: 'https://cdn.example/admin.jpg',
  });
  const envAdmin = resolveAdminActor({ password: 'super-admin-bootstrap' });
  assert(envAdmin?.displayName === 'مدیر سیستم', 'bootstrap display name');
  assert(
    envAdmin?.avatarUrl === 'https://cdn.example/admin.jpg',
    'bootstrap admin picks up HR employee username=admin photo'
  );

  // 5) No photo → undefined (initials fallback on client)
  createAdminAccount({
    username: 'nopphoto',
    password: 'nopPass12',
    roleKey: 'support',
    displayName: 'بدون عکس یکتا',
  });
  const none = resolveAdminActor({ username: 'nopphoto', password: 'nopPass12' });
  assert(!none?.avatarUrl, 'no profile photo → empty avatarUrl');

  console.log('admin-header-avatar.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
