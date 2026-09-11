/**
 * Platform users-by-province geo aggregation selftest.
 * Run: cd packages/api && npx tsx src/admin-users-geo.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-users-geo-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { getDb, dbService } = await import('./db');
  const { adminPlatform } = await import('./admin-platform');
  getDb();

  const stamp = `${process.pid}-${Date.now()}`;
  const { user: tehran } = dbService.findOrCreateUser({
    telegramId: `geo-teh-${stamp}`,
    name: 'Geo Tehran',
    username: `geo_teh_${stamp}`,
  });
  const { user: isfahan } = dbService.findOrCreateUser({
    telegramId: `geo-isf-${stamp}`,
    name: 'Geo Isfahan',
    username: `geo_isf_${stamp}`,
  });
  const { user: unknown } = dbService.findOrCreateUser({
    telegramId: `geo-unk-${stamp}`,
    name: 'Geo Unknown',
    username: `geo_unk_${stamp}`,
  });
  assert(tehran?.id && isfahan?.id && unknown?.id, 'users created');

  dbService.updateUserProfile(tehran.id, { province: 'تهران', city: 'تهران', country: 'ایران' });
  dbService.updateUserProfile(isfahan.id, { province: 'اصفهان', city: 'اصفهان', country: 'ایران' });
  dbService.updateUserProfile(unknown.id, { province: '', city: '', country: 'ایران' });

  const geo = adminPlatform.getUsersGeoDistribution({ activeOnly: true });
  assert(Array.isArray(geo.byProvince), 'byProvince array');
  assert(typeof geo.totalUsers === 'number' && geo.totalUsers >= 3, 'totalUsers');
  assert(typeof geo.provinceKnownCount === 'number', 'provinceKnownCount');
  assert(typeof geo.unknownProvinceCount === 'number', 'unknownProvinceCount');
  assert(
    geo.provinceKnownCount === geo.byProvince.reduce((s, r) => s + r.count, 0),
    'known matches sum'
  );
  assert(
    geo.totalUsers === geo.provinceKnownCount + geo.unknownProvinceCount,
    'total = known + unknown'
  );
  assert(!geo.byProvince.some((r) => !r.name || r.name === 'نامشخص'), 'no unknown in byProvince');

  const teh = geo.byProvince.find((r) => r.name === 'تهران');
  const isf = geo.byProvince.find((r) => r.name === 'اصفهان');
  assert(teh && teh.count >= 1, 'تهران counted');
  assert(isf && isf.count >= 1, 'اصفهان counted');
  assert(geo.unknownProvinceCount >= 1, 'unknown counted');

  console.log('admin-users-geo.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
