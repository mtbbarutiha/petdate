/**
 * Pet lovers reviews — user fantasy photo + text, admin-moderated.
 * Additive schema; seed-if-empty with 30 sample approved cards.
 */
import { getDb } from './db';
import {
  clampPetLoverRating,
  normalizePetLoverHandle,
  PET_LOVER_REVIEW_BODY_MAX,
  type PetLoverReview,
  type PetLoverReviewPublic,
  type PetLoverReviewStatus,
} from '@petdate/shared';

const P = '/pepito/uploads';
const R = `${P}/reviews`;

/**
 * 30 sample reviews — each photo is unique monochrome studio “fantasy”
 * (person + pet, clothing matches solid background). First four keep the
 * classic Pepito testimonials; the rest live under /reviews/fantasy-*.
 */
const SAMPLE_REVIEWS: { handle: string; body: string; rating: number; photo: string }[] = [
  {
    handle: '@سارا',
    body: 'قابل اعتماد و مهربون؛ معلومه عاشق حیوانات‌اند!',
    rating: 5,
    photo: `${P}/01-4.jpg`,
  },
  {
    handle: '@مینا',
    body: 'سگم عاشق همبازی‌شه و زمان‌بندی‌شون انعطاف‌پذیره.',
    rating: 5,
    photo: `${P}/02-4.jpg`,
  },
  {
    handle: '@علی',
    body: 'درستکار و مطمئن؛ خرگوش‌هام عاشقشون شدن!',
    rating: 5,
    photo: `${P}/03-4.jpg`,
  },
  {
    handle: '@نگار',
    body: 'دیدن اینکه بچه‌هام خوب مراقبت می‌شن همیشه لذت‌بخشه.',
    rating: 5,
    photo: `${P}/04-4.jpg`,
  },
  {
    handle: '@رضا',
    body: 'اولین همبازی گربه‌م رو از پت‌دیت پیدا کردم؛ عالی بود.',
    rating: 5,
    photo: `${R}/fantasy-01.jpg`,
  },
  {
    handle: '@یلدا',
    body: 'مشاوره دامپزشک آنلاین نجاتم داد وقتی توله مریض شد.',
    rating: 5,
    photo: `${R}/fantasy-02.jpg`,
  },
  {
    handle: '@کاوه',
    body: 'مربی‌شون صبور و حرفه‌ایه؛ سگم دیگه نکشیده.',
    rating: 5,
    photo: `${R}/fantasy-03.jpg`,
  },
  {
    handle: '@هستی',
    body: 'پذیرش پت شفاف و مسئولانه‌ست؛ حس امنیت داشتم.',
    rating: 5,
    photo: `${R}/fantasy-04.jpg`,
  },
  {
    handle: '@نیما',
    body: 'چت وب و تلگرام یکی‌ه؛ دیگه پیام گم نمی‌شه.',
    rating: 5,
    photo: `${R}/fantasy-05.jpg`,
  },
  {
    handle: '@مریم',
    body: 'عکس فانتزی پتم رو فرستادم و بعد تأیید تو گالری اومد.',
    rating: 5,
    photo: `${R}/fantasy-06.jpg`,
  },
  {
    handle: '@پارسا',
    body: 'ایونت پیاده‌روی گروهی فوق‌العاده بود؛ پت‌ها حسابی بازی کردن.',
    rating: 5,
    photo: `${R}/fantasy-07.jpg`,
  },
  {
    handle: '@شیوا',
    body: 'شاپ و کیف پول روی همون حسابه؛ خرید راحت بود.',
    rating: 4,
    photo: `${R}/fantasy-08.jpg`,
  },
  {
    handle: '@امیر',
    body: 'پشتیبانی سریع جواب داد؛ مشکل احراز موبایلم حل شد.',
    rating: 5,
    photo: `${R}/fantasy-09.jpg`,
  },
  {
    handle: '@النا',
    body: 'دفتر خاطرات پتم قشنگه؛ لحظه‌ها رو نگه می‌دارم.',
    rating: 5,
    photo: `${R}/fantasy-10.jpg`,
  },
  {
    handle: '@بهرام',
    body: 'همسایه‌ی پت‌دار پیدا کردم؛ دیگه تنهایی گردش نمی‌ریم.',
    rating: 5,
    photo: `${R}/fantasy-11.jpg`,
  },
  {
    handle: '@کتایون',
    body: 'فرآیند تأیید نظر شفافه؛ می‌دونم عکسم بعد بررسی منتشر می‌شه.',
    rating: 5,
    photo: `${R}/fantasy-12.jpg`,
  },
  {
    handle: '@سامان',
    body: 'سگم اضطراب جدایی داشت؛ مربی آنلاین کمک کرد.',
    rating: 5,
    photo: `${R}/fantasy-13.jpg`,
  },
  {
    handle: '@فرناز',
    body: 'عکس فانتزی با خرگوشم رو عاشقان پت دیدن؛ کلی انرژی گرفتم.',
    rating: 5,
    photo: `${R}/fantasy-14.jpg`,
  },
  {
    handle: '@آرین',
    body: 'نقش بدون پت رو انتخاب کردم و مشاوره خرید گرفتم.',
    rating: 4,
    photo: `${R}/fantasy-15.jpg`,
  },
  {
    handle: '@گلناز',
    body: 'زمان‌بندی همبازی‌ها واقعاً انعطاف‌پذیره؛ کارمندم و اوکی بود.',
    rating: 5,
    photo: `${R}/fantasy-16.jpg`,
  },
  {
    handle: '@حامد',
    body: 'دامپزشک نسخه واضح داد؛ داروخانه نزدیک پیدا کردم.',
    rating: 5,
    photo: `${R}/fantasy-17.jpg`,
  },
  {
    handle: '@پریسا',
    body: 'دو شیبام عاشق همبازی شدن؛ هر هفته قرار می‌ذاریم.',
    rating: 5,
    photo: `${R}/fantasy-18.jpg`,
  },
  {
    handle: '@کیان',
    body: 'ثبت‌نام با موبایل اجباریه؛ حس امنیت بیشتری دارم.',
    rating: 5,
    photo: `${R}/fantasy-19.jpg`,
  },
  {
    handle: '@نازنین',
    body: 'نظرم بعد تأیید ادمین رفت تو صفحه؛ فرآیندش واضح بود.',
    rating: 5,
    photo: `${R}/fantasy-20.jpg`,
  },
  {
    handle: '@پویا',
    body: 'بازی گروهی تو پارک با پت‌دیت عالی بود؛ همه مودب بودن.',
    rating: 5,
    photo: `${R}/fantasy-21.jpg`,
  },
  {
    handle: '@سپیده',
    body: 'عکس فانتزی پتم رو فرستادم تا بقیه هم انرژی بگیرن.',
    rating: 5,
    photo: `${R}/fantasy-22.jpg`,
  },
  {
    handle: '@مهرداد',
    body: 'از ربات تلگرام اومدم وب؛ همه‌چیز سینک بود.',
    rating: 5,
    photo: `${R}/fantasy-23.jpg`,
  },
  {
    handle: '@آیدا',
    body: 'گربه‌م با همسایه جدیدش رفیق شد؛ ممنون پت‌دیت.',
    rating: 5,
    photo: `${R}/fantasy-24.jpg`,
  },
  {
    handle: '@روزبه',
    body: 'قیمت سکه‌ها شفافه؛ مشاوره دامپزشک ارزشش رو داشت.',
    rating: 4,
    photo: `${R}/fantasy-25.jpg`,
  },
  {
    handle: '@لیدا',
    body: 'عاشق این بخش نظرات‌ام؛ عکس‌های فانتزی واقعاً قشنگن.',
    rating: 5,
    photo: `${R}/fantasy-26.jpg`,
  },
];

type Row = {
  id: number;
  user_id: number | null;
  display_handle: string;
  body: string;
  rating: number;
  photo_url: string;
  status: string;
  is_seed: number;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

let schemaReady = false;

export function ensurePetLoverReviewsSchema(): void {
  if (schemaReady) return;
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS pet_lover_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      display_handle TEXT NOT NULL,
      body TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      photo_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      is_seed INTEGER NOT NULL DEFAULT 0,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_plr_status_created
      ON pet_lover_reviews(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_plr_user ON pet_lover_reviews(user_id);
  `);
  schemaReady = true;
}

function mapRow(row: Row): PetLoverReview {
  const status = (['pending', 'approved', 'rejected'].includes(row.status)
    ? row.status
    : 'pending') as PetLoverReviewStatus;
  return {
    id: row.id,
    userId: row.user_id == null ? null : Number(row.user_id),
    displayHandle: row.display_handle,
    body: row.body,
    rating: clampPetLoverRating(row.rating),
    photoUrl: row.photo_url,
    status,
    isSeed: Boolean(row.is_seed),
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

function toPublic(r: PetLoverReview): PetLoverReviewPublic {
  return {
    id: r.id,
    displayHandle: r.displayHandle,
    body: r.body,
    rating: r.rating,
    photoUrl: r.photoUrl,
    createdAt: r.createdAt,
  };
}

export function seedPetLoverReviewsIfEmpty(): number {
  ensurePetLoverReviewsSchema();
  const d = getDb();
  const count = Number(
    (d.prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews`).get() as { c: number } | undefined)
      ?.c ?? 0,
  );
  if (count > 0) return 0;

  const insert = d.prepare(`
    INSERT INTO pet_lover_reviews
      (user_id, display_handle, body, rating, photo_url, status, is_seed, created_at, reviewed_at, reviewed_by)
    VALUES (NULL, ?, ?, ?, ?, 'approved', 1, ?, ?, 'seed')
  `);
  const now = new Date().toISOString();
  let n = 0;
  const tx = d.transaction(() => {
    for (const s of SAMPLE_REVIEWS) {
      insert.run(s.handle, s.body, s.rating, s.photo, now, now);
      n += 1;
    }
  });
  tx();
  return n;
}

/**
 * Keep seed gallery photos unique + on-theme after deploys.
 * Updates is_seed rows matched by display_handle; never touches user submissions.
 */
export function refreshPetLoverReviewSeedPhotos(): number {
  ensurePetLoverReviewsSchema();
  const d = getDb();
  const upd = d.prepare(
    `UPDATE pet_lover_reviews
     SET photo_url = ?, body = ?, rating = ?
     WHERE is_seed = 1 AND display_handle = ?`,
  );
  let n = 0;
  const tx = d.transaction(() => {
    for (const s of SAMPLE_REVIEWS) {
      const info = upd.run(s.photo, s.body, s.rating, s.handle);
      n += Number(info.changes) || 0;
    }
  });
  tx();
  return n;
}

export function bootPetLoverReviews(): { total: number; seeded: number; refreshed: number } {
  ensurePetLoverReviewsSchema();
  const seeded = seedPetLoverReviewsIfEmpty();
  const refreshed = refreshPetLoverReviewSeedPhotos();
  const total = Number(
    (
      getDb().prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews`).get() as
        | { c: number }
        | undefined
    )?.c ?? 0,
  );
  return { total, seeded, refreshed };
}

export function listPublicPetLoverReviews(opts?: {
  limit?: number;
  offset?: number;
}): { reviews: PetLoverReviewPublic[]; total: number } {
  ensurePetLoverReviewsSchema();
  const limit = Math.min(Math.max(Number(opts?.limit) || 24, 1), 100);
  const offset = Math.max(Number(opts?.offset) || 0, 0);
  const d = getDb();
  const total = Number(
    (
      d
        .prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews WHERE status = 'approved'`)
        .get() as { c: number } | undefined
    )?.c ?? 0,
  );
  const rows = d
    .prepare(
      `SELECT * FROM pet_lover_reviews
       WHERE status = 'approved'
       ORDER BY
         CASE WHEN is_seed = 0 THEN 0 ELSE 1 END,
         CASE WHEN is_seed = 0 THEN created_at END DESC,
         CASE WHEN is_seed = 1 THEN id END ASC,
         id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as Row[];
  return { reviews: rows.map((r) => toPublic(mapRow(r))), total };
}

export function listFeaturedPetLoverReviews(limit = 4): PetLoverReviewPublic[] {
  const { reviews } = listPublicPetLoverReviews({
    limit: Math.min(Math.max(limit, 1), 12),
    offset: 0,
  });
  return reviews;
}

export function countPendingPetLoverReviews(): number {
  ensurePetLoverReviewsSchema();
  return Number(
    (
      getDb()
        .prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews WHERE status = 'pending'`)
        .get() as { c: number } | undefined
    )?.c ?? 0,
  );
}

export function petLoverReviewCounts(): {
  pending: number;
  approved: number;
  rejected: number;
  all: number;
} {
  ensurePetLoverReviewsSchema();
  const d = getDb();
  const q = (status?: string) =>
    Number(
      (
        (status
          ? d.prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews WHERE status = ?`).get(status)
          : d.prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews`).get()) as
          | { c: number }
          | undefined
      )?.c ?? 0,
    );
  const pending = q('pending');
  const approved = q('approved');
  const rejected = q('rejected');
  return { pending, approved, rejected, all: pending + approved + rejected };
}

export function listAdminPetLoverReviews(opts?: {
  status?: PetLoverReviewStatus | 'all';
  limit?: number;
  offset?: number;
}): { reviews: PetLoverReview[]; total: number } {
  ensurePetLoverReviewsSchema();
  const limit = Math.min(Math.max(Number(opts?.limit) || 50, 1), 200);
  const offset = Math.max(Number(opts?.offset) || 0, 0);
  const status = opts?.status || 'all';
  const d = getDb();
  if (status === 'all') {
    const total = Number(
      (d.prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews`).get() as { c: number } | undefined)
        ?.c ?? 0,
    );
    const rows = d
      .prepare(
        `SELECT * FROM pet_lover_reviews
         ORDER BY
           CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
           created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Row[];
    return { reviews: rows.map(mapRow), total };
  }
  const total = Number(
    (
      d
        .prepare(`SELECT COUNT(*) as c FROM pet_lover_reviews WHERE status = ?`)
        .get(status) as { c: number } | undefined
    )?.c ?? 0,
  );
  const rows = d
    .prepare(
      `SELECT * FROM pet_lover_reviews WHERE status = ?
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(status, limit, offset) as Row[];
  return { reviews: rows.map(mapRow), total };
}

export function getPetLoverReviewById(id: number): PetLoverReview | null {
  ensurePetLoverReviewsSchema();
  const row = getDb()
    .prepare(`SELECT * FROM pet_lover_reviews WHERE id = ?`)
    .get(id) as Row | undefined;
  return row ? mapRow(row) : null;
}

export function submitPetLoverReview(input: {
  userId: number;
  displayHandle: string;
  body: string;
  rating?: number;
  photoUrl: string;
}): PetLoverReview {
  ensurePetLoverReviewsSchema();
  const handle = normalizePetLoverHandle(input.displayHandle);
  const body = String(input.body || '').trim();
  const photoUrl = String(input.photoUrl || '').trim();
  if (!handle || handle === '@') throw Object.assign(new Error('نام نمایشی الزامی است'), { status: 400 });
  if (body.length < 8) throw Object.assign(new Error('متن نظر خیلی کوتاه است'), { status: 400 });
  if (body.length > PET_LOVER_REVIEW_BODY_MAX) {
    throw Object.assign(new Error(`متن نظر حداکثر ${PET_LOVER_REVIEW_BODY_MAX} کاراکتر است`), {
      status: 400,
    });
  }
  if (!photoUrl) throw Object.assign(new Error('عکس فانتزی الزامی است'), { status: 400 });
  const rating = clampPetLoverRating(input.rating ?? 5);
  const now = new Date().toISOString();
  const info = getDb()
    .prepare(
      `INSERT INTO pet_lover_reviews
        (user_id, display_handle, body, rating, photo_url, status, is_seed, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
    )
    .run(input.userId, handle, body, rating, photoUrl, now);
  const created = getPetLoverReviewById(Number(info.lastInsertRowid));
  if (!created) throw new Error('ثبت نظر ناموفق بود');
  return created;
}

export function setPetLoverReviewStatus(
  id: number,
  status: 'approved' | 'rejected',
  opts?: { adminNote?: string; reviewedBy?: string },
): PetLoverReview | null {
  ensurePetLoverReviewsSchema();
  const existing = getPetLoverReviewById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE pet_lover_reviews
       SET status = ?, admin_note = ?, reviewed_at = ?, reviewed_by = ?
       WHERE id = ?`,
    )
    .run(
      status,
      opts?.adminNote?.trim() || existing.adminNote || null,
      now,
      opts?.reviewedBy || null,
      id,
    );
  return getPetLoverReviewById(id);
}

export function deletePetLoverReview(id: number): boolean {
  ensurePetLoverReviewsSchema();
  const info = getDb().prepare(`DELETE FROM pet_lover_reviews WHERE id = ?`).run(id);
  return Number(info.changes) > 0;
}

/** Exported for selftests */
export const PET_LOVER_SAMPLE_COUNT = SAMPLE_REVIEWS.length;
