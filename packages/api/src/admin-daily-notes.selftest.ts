/**
 * Admin daily notes — schema + per-day CRUD.
 * Run: cd packages/api && npx tsx src/admin-daily-notes.selftest.ts
 */
export {};

process.env.DATABASE_URL = '';
process.env.DATABASE_PATH = `/tmp/petdate-selftest-admin-daily-notes-${process.pid}.db`;
process.env.ADMIN_PASSWORD = 'super-admin-bootstrap';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const {
    ensureAdminDailyNotesSchema,
    isIsoDate,
    listAdminDailyNotes,
    createAdminDailyNote,
    updateAdminDailyNote,
    deleteAdminDailyNote,
    DAILY_NOTE_MAX_LEN,
  } = await import('./admin-daily-notes');

  ensureAdminDailyNotesSchema();
  ensureAdminDailyNotesSchema(); // idempotent

  assert(isIsoDate('2026-09-12'), 'valid iso date');
  assert(!isIsoDate('2026-13-01'), 'invalid month');
  assert(!isIsoDate('2026-09-31'), 'invalid day');
  assert(!isIsoDate('12-09-2026'), 'wrong order');

  const empty = listAdminDailyNotes('2026-09-12');
  assert(empty.length === 0, 'no notes yet');

  const badDate = createAdminDailyNote({ date: 'nope', body: 'x' });
  assert(!badDate.ok && badDate.error.includes('تاریخ'), 'reject bad date');

  const emptyBody = createAdminDailyNote({ date: '2026-09-12', body: '   ' });
  assert(!emptyBody.ok && emptyBody.error.includes('خالی'), 'reject empty body');

  const created = createAdminDailyNote({
    date: '2026-09-12',
    body: '  جلسه با تیم فروش  ',
    createdBy: 'مدیر',
  });
  assert(created.ok, 'create ok');
  assert(created.note.body === 'جلسه با تیم فروش', 'trim body');
  assert(created.note.date === '2026-09-12', 'date stored');
  assert(created.note.createdBy === 'مدیر', 'author stored');

  const second = createAdminDailyNote({
    date: '2026-09-12',
    body: 'یادداشت دوم',
    createdBy: 'support',
  });
  assert(second.ok, 'second note same day');

  const otherDay = createAdminDailyNote({
    date: '2026-09-13',
    body: 'فردا',
    createdBy: 'مدیر',
  });
  assert(otherDay.ok, 'other day');

  const day12 = listAdminDailyNotes('2026-09-12');
  assert(day12.length === 2, 'two notes on selected day');
  assert(
    day12.every((n) => n.date === '2026-09-12'),
    'list is date-scoped'
  );
  assert(listAdminDailyNotes('2026-09-13').length === 1, 'other day isolated');

  const updated = updateAdminDailyNote(created.note.id, '  جلسه فروش — انجام شد  ');
  assert(updated.ok && updated.note.body === 'جلسه فروش — انجام شد', 'update trims');

  const missing = updateAdminDailyNote(99999, 'x');
  assert(!missing.ok, 'update missing');

  const tooLong = updateAdminDailyNote(created.note.id, 'x'.repeat(DAILY_NOTE_MAX_LEN + 1));
  assert(!tooLong.ok, 'reject oversize');

  const del = deleteAdminDailyNote(created.note.id);
  assert(del.ok, 'delete ok');
  assert(listAdminDailyNotes('2026-09-12').length === 1, 'one left');
  assert(!deleteAdminDailyNote(created.note.id).ok, 'delete missing');

  console.log('admin-daily-notes.selftest: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
