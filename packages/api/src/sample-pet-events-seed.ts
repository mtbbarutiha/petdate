/**
 * Permanent curated pet sample events for /events (public catalog).
 * Runs on every API boot — NOT gated by allowDemoSeeds (magazine-style).
 * Idempotent upsert by exact title. Survives demo-seed cleanup.
 */
import type { Database } from 'better-sqlite3';
import type { GameType } from '@petdate/shared';

/** Stable host for catalog samples — not a demo-seed marker. */
export const SAMPLE_EVENTS_HOST_TELEGRAM_ID = 'petdate_catalog_events';

/** Marker stamped into services so rows are identifiable without being demo-seeds. */
export const SAMPLE_EVENTS_CATALOG_MARKER = 'catalog:sample-events';

export type SamplePetEventDef = {
  title: string;
  gameType: GameType;
  location: string;
  province: string;
  city: string;
  maxPlayers: number;
  description: string;
  services: string;
  joinFee: number;
  photo: string;
  daysAhead: number;
  hour: number;
};

export const SAMPLE_PET_EVENTS: SamplePetEventDef[] = [
  {
    title: 'پت دیتینگ باغ گیاه‌شناسی',
    gameType: 'pet_dating',
    location: 'باغ گیاه‌شناسی ملی، ورودی شرقی',
    province: 'تهران',
    city: 'تهران',
    maxPlayers: 16,
    description:
      'آشنایی پت‌های اجتماعی در فضای باز باغ گیاه‌شناسی. واکسیناسیون به‌روز و قلاده الزامی است؛ فضای آرام برای صاحبان و پت‌های مودب.',
    services: `فضای سایه، آب خنک، ناظر رویداد · ${SAMPLE_EVENTS_CATALOG_MARKER}`,
    joinFee: 50,
    photo: '/events/sample-dating.jpg',
    daysAhead: 3,
    hour: 17,
  },
  {
    title: 'پیاده‌روی گروهی سعادت‌آباد',
    gameType: 'group_walk',
    location: 'بوستان نهج‌البلاغه',
    province: 'تهران',
    city: 'تهران',
    maxPlayers: 20,
    description:
      'مسیر ملایم حدود یک ساعت برای سگ‌های متوسط و بزرگ. فرصت آشنایی صاحبان پت در محله سعادت‌آباد با رعایت نظافت و قلاده.',
    services: `کیسه جمع‌آوری، آب خنک · ${SAMPLE_EVENTS_CATALOG_MARKER}`,
    joinFee: 15,
    photo: '/events/sample-walk.jpg',
    daysAhead: 5,
    hour: 8,
  },
  {
    title: 'کارگاه آموزش فرمان‌پذیری',
    gameType: 'training',
    location: 'باشگاه پت ونک',
    province: 'تهران',
    city: 'تهران',
    maxPlayers: 8,
    description:
      'جلسه گروهی با مربی — تمرکز روی بنشین، بمان و راه رفتن آرام با قلاده. مناسب سگ‌های بالای چهار ماه.',
    services: `مربی تأییدشده، تشویقی آموزشی · ${SAMPLE_EVENTS_CATALOG_MARKER}`,
    joinFee: 80,
    photo: '/events/sample-training.jpg',
    daysAhead: 7,
    hour: 16,
  },
  {
    title: 'گرومینگ میت‌آپ اصفهان',
    gameType: 'grooming_meetup',
    location: 'سالن پت چهارباغ',
    province: 'اصفهان',
    city: 'اصفهان',
    maxPlayers: 10,
    description:
      'شست‌وشوی سبک و نکات مراقبت مو برای پت‌های مو بلند. فضای دوستانه برای یادگیری و شبکه‌سازی صاحبان پت در اصفهان.',
    services: `شامپوی ملایم، خشک‌کن، مشاوره پوست · ${SAMPLE_EVENTS_CATALOG_MARKER}`,
    joinFee: 40,
    photo: '/events/sample-grooming.jpg',
    daysAhead: 10,
    hour: 11,
  },
];

export type SamplePetEventsSeedResult = {
  inserted: number;
  updated: number;
  cancelledJunk: number;
  hostUserId: number;
};

function ensureCatalogHost(db: Database): number {
  const existing = db
    .prepare(`SELECT id FROM users WHERE telegram_id = ?`)
    .get(SAMPLE_EVENTS_HOST_TELEGRAM_ID) as { id: number } | undefined;
  if (existing?.id) return Number(existing.id);

  const ins = db
    .prepare(
      `INSERT INTO users (telegram_id, name, username, coins, role, onboarding)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      SAMPLE_EVENTS_HOST_TELEGRAM_ID,
      'پت‌دیت',
      'petdate_events',
      5000,
      'pet_owner',
      'profile_complete'
    );
  return Number(ins.lastInsertRowid);
}

function scheduledIso(daysAhead: number, hour: number): string {
  const when = new Date();
  when.setDate(when.getDate() + daysAhead);
  when.setHours(hour, 0, 0, 0);
  return when.toISOString();
}

/**
 * Cancel known junk / orphan sports spam so the public open list stays clean.
 * Safe: only matches explicit garbage title or orphan host + legacy sports type.
 */
export function cancelJunkOpenEvents(db: Database): number {
  const junkTitles = ['بقثقثفقث'];
  let cancelled = 0;

  const byTitle = db.prepare(
    `UPDATE games SET status = 'cancelled'
     WHERE status = 'open' AND title = ?`
  );
  for (const title of junkTitles) {
    cancelled += Number(byTitle.run(title).changes ?? 0);
  }

  // Soft-deleted hosts (name stamped «[حذف‌شده #id]») on legacy sports spam.
  const softDeletedHost = db
    .prepare(
      `UPDATE games SET status = 'cancelled'
       WHERE status = 'open'
         AND game_type IN ('volleyball','football','basketball','futsal','tennis','board')
         AND host_user_id IN (
           SELECT id FROM users WHERE name LIKE '[حذف‌شده%'
         )`
    )
    .run();
  cancelled += Number(softDeletedHost.changes ?? 0);

  // True orphan host_user_id (no users row) — rare when FK is off.
  const orphan = db
    .prepare(
      `UPDATE games SET status = 'cancelled'
       WHERE status = 'open'
         AND game_type IN ('volleyball','football','basketball','futsal','tennis','board')
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = games.host_user_id)`
    )
    .run();
  cancelled += Number(orphan.changes ?? 0);

  return cancelled;
}

/** Upsert the four curated pet sample events. Safe on production boot. */
export function seedSamplePetEvents(db: Database): SamplePetEventsSeedResult {
  const hostUserId = ensureCatalogHost(db);
  const cancelledJunk = cancelJunkOpenEvents(db);

  const findByTitle = db.prepare(`SELECT id FROM games WHERE title = ? LIMIT 1`) as {
    get: (title: string) => { id: number } | undefined;
  };
  const insert = db.prepare(`
    INSERT INTO games (
      title, game_type, section_id, host_user_id, location, scheduled_at, max_players,
      description, province, city, services, join_fee_coins, photo_url, photo_status, status
    ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'open')
  `);
  const update = db.prepare(`
    UPDATE games SET
      game_type = ?,
      host_user_id = ?,
      location = ?,
      scheduled_at = ?,
      max_players = ?,
      description = ?,
      province = ?,
      city = ?,
      services = ?,
      join_fee_coins = ?,
      photo_url = ?,
      photo_status = 'approved',
      status = 'open'
    WHERE id = ?
  `);
  const linkHost = db.prepare(
    'INSERT OR IGNORE INTO game_players (game_id, user_id) VALUES (?, ?)'
  );

  let inserted = 0;
  let updated = 0;

  for (const s of SAMPLE_PET_EVENTS) {
    const when = scheduledIso(s.daysAhead, s.hour);
    const row = findByTitle.get(s.title);
    if (row?.id) {
      update.run(
        s.gameType,
        hostUserId,
        s.location,
        when,
        s.maxPlayers,
        s.description,
        s.province,
        s.city,
        s.services,
        s.joinFee,
        s.photo,
        row.id
      );
      linkHost.run(row.id, hostUserId);
      updated += 1;
    } else {
      const r = insert.run(
        s.title,
        s.gameType,
        hostUserId,
        s.location,
        when,
        s.maxPlayers,
        s.description,
        s.province,
        s.city,
        s.services,
        s.joinFee,
        s.photo
      );
      const id = Number(r.lastInsertRowid);
      linkHost.run(id, hostUserId);
      inserted += 1;
    }
  }

  if (inserted > 0 || updated > 0 || cancelledJunk > 0) {
    console.log(
      `🐾 sample pet events catalog: +${inserted} ~${updated} junkCancelled=${cancelledJunk}`
    );
  }

  return { inserted, updated, cancelledJunk, hostUserId };
}
