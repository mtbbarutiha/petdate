/**
 * Fantasy photo agent — studio fallback + coin debit.
 * Run: cd packages/api && FANTASY_PHOTO_FORCE_STUDIO=1 npx tsx src/services/fantasy-photo-agent.selftest.ts
 */
export {};
process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-fantasy-${process.pid}.db`;
process.env.FANTASY_PHOTO_FORCE_STUDIO = '1';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const sharp = (await import('sharp')).default;
  const { dbService, getDb } = await import('../db');
  getDb();
  const agent = await import('./fantasy-photo-agent');
  const { user } = dbService.findOrCreateUser({
    telegramId: `fantasy-${process.pid}`,
    name: 'Fantasy',
    username: 'fantasy_user',
  });
  assert(user?.id, 'user');
  getDb().prepare(`UPDATE users SET coins = 10 WHERE id = ?`).run(user.id);

  const photo = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 80, b: 80 } },
  })
    .jpeg()
    .toBuffer();

  const made = await agent.generateFantasyPhoto({
    userId: user.id,
    styleId: 'yellow',
    buffer: photo,
    mimeType: 'image/jpeg',
    publicOrigin: 'https://petdate.ir',
  });
  assert(made.engine === 'studio', 'forced studio');
  assert(made.photoUrl.includes('/api/pet-lover-reviews/images/'), 'saved url');
  assert(made.cost === 5, 'cost 5');
  const after = dbService.getUserById(user.id);
  assert(Number(after?.coins) === 5, `coins left ${after?.coins}`);

  getDb().prepare(`UPDATE users SET coins = 2 WHERE id = ?`).run(user.id);
  let denied = false;
  try {
    await agent.generateFantasyPhoto({
      userId: user.id,
      styleId: 'pink',
      buffer: photo,
      mimeType: 'image/jpeg',
      publicOrigin: 'https://petdate.ir',
    });
  } catch (err) {
    denied = (err as { status?: number }).status === 402;
  }
  assert(denied, 'rejects when coins < 5');
  assert(Number(dbService.getUserById(user.id)?.coins) === 2, 'no debit on reject');

  console.log('fantasy-photo-agent.selftest: ok');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
