import './load-env';
import Database from 'better-sqlite3';
import path from 'path';
import { createPgCompatDatabase, isPostgresUrl } from './db/pg-compat';
import type {
  CoinAward,
  Game,
  GamePlayer,
  GameStatus,
  GameType,
  OnboardingStatus,
  PaymentMethod,
  PaymentOrder,
  PaymentOrderStatus,
  PetBreed,
  PetGender,
  PetMedicalEntry,
  PetMedicalRecord,
  PetProfile,
  PetSize,
  PetSpecies,
  PlaydateChatMessage,
  PlaydateRequest,
  PlaydateStatus,
  Prescription,
  ProfileRewardSection,
  Section,
  User,
  UserGender,
  UserRole,
  VerificationStatus,
  VetRatingStats,
  VetRating,
  PreviousVet,
  ConsultServiceKind,
  PhotoModerationStatus,
  ProviderCredentialStatus,
  VetConsultation,
  VetConsultChatMessage,
  VetConsultStatus,
  VetCredentialStatus,
} from '@petdate/shared';
import {
  COIN_REASON,
  FACE_VERIFY_REWARD,
  isPendingRequestExpired,
  makePetPublicId,
  makeUserPublicId,
  makeOrderPublicId,
  makeConsultPublicId,
  makePlaydatePublicId,
  makePaymentPublicId,
  maskCardNumber,
  PET_BREEDS_SEED,
  PET_MEDICAL_FIELD_LABELS,
  PET_SPECIES,
  petPublicIdOf,
  orderPublicIdOf,
  consultPublicIdOf,
  playdatePublicIdOf,
  paymentPublicIdOf,
  QUICK_VET_COST,
  SEEKER_ADVICE_COST,
  SEEKER_OWNER_SHARE,
  SITTER_CONNECT_COST,
  SITTER_PROVIDER_SHARE,
  SYSTEM_FEE_REASON,
  TRAINER_CONSULT_COST,
  TRAINER_PROVIDER_SHARE,
  PLAYDATE_REQUEST_TTL_MS,
  PROFILE_REWARD_SECTIONS,
  PROFILE_SECTION_REWARD,
  REFERRAL_BONUS_COINS,
  SIGNUP_BONUS,
  USER_PRESENCE_ONLINE_MS,
  USER_ROLES,
  sanitizeRoleList,
  userPublicIdOf,
  VET_CONSULT_REQUEST_TTL_MS,
  vetVisitFeeCoins,
  walletFromUserFields,
  walletLedgerLabelFa,
  type CoinSellRequestStatus,
  type CoinSellRequestSummary,
  type PetMedicalField,
  type WalletCurrency,
  type WalletLedgerDirection,
  type WalletTransaction,
} from '@petdate/shared';
import { publicImageUrlForStored } from './services/telegram-media';

/** متادیتای اختیاری برای ثبت در wallet_ledger هنگام کسر/واریز */
export type WalletLedgerMeta = {
  reason?: string;
  refType?: string | null;
  refId?: string | number | null;
  skipLedger?: boolean;
};

/**
 * Single source of truth for profile/pet data.
 * - DATABASE_URL=postgresql://… → PostgreSQL (production target)
 * - else absolute DATABASE_PATH / default SQLite file
 * Bot must not keep a divergent user/pet store; it talks to this API DB via HTTP.
 */
function resolveDbPath(): string {
  const raw = (process.env.DATABASE_PATH || '').trim();
  if (raw && path.isAbsolute(raw)) return raw;
  return path.join(__dirname, '..', 'data', 'petdate.db');
}

const dbPath = resolveDbPath();

/** Absolute path of the live SQLite file (empty when Postgres is SoT). */
export function getResolvedDatabasePath(): string {
  return isPostgresUrl(process.env.DATABASE_URL) ? '' : dbPath;
}

export function getStorageDriver(): 'postgres' | 'sqlite' {
  return isPostgresUrl(process.env.DATABASE_URL) ? 'postgres' : 'sqlite';
}

type AppDatabase = Database.Database;

let db: AppDatabase;

export function getDb(): AppDatabase {
  if (!db) {
    // Demo/fake users+pets only when explicitly enabled — never auto-reseed after a production wipe.
    // Blocked on production-like hosts even if SEED_DEMO_DATA is mistakenly set.
    const allowDemoSeed =
      process.env.SEED_DEMO_DATA === '1' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEMO_SEED !== '0';
    const maybeSeedDemo = () => {
      if (allowDemoSeed) {
        seedDemoPetsIfEmpty();
        seedFakeDogOwners();
      } else if (process.env.SEED_DEMO_DATA === '1') {
        console.warn('SEED_DEMO_DATA ignored (production / ALLOW_DEMO_SEED=0)');
      }
    };

    const usePostgres = isPostgresUrl(process.env.DATABASE_URL);
    if (usePostgres) {
      db = createPgCompatDatabase() as unknown as Database.Database;
      try {
        migrateSchema();
      } catch (err) {
        console.warn(
          'postgres migrateSchema soft-patch skipped/failed:',
          (err as Error).message
        );
      }
      seedIfEmpty();
      maybeSeedDemo();
      try {
        backfillPublicIds();
      } catch (err) {
        console.warn('public_id backfill skipped/failed:', (err as Error).message);
      }
      console.log(
        `   PostgreSQL (source of truth): ${String(process.env.DATABASE_URL).replace(/:[^:@/]+@/, ':***@')}`
      );
    } else {
      const fs = require('fs');
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initSchema();
      seedIfEmpty();
      maybeSeedDemo();
      try {
        backfillPublicIds();
      } catch (err) {
        console.warn('public_id backfill skipped/failed:', (err as Error).message);
      }
      console.log(`   SQLite (source of truth): ${dbPath}`);
    }
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      city TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE,
      name TEXT NOT NULL,
      username TEXT,
      section_id INTEGER REFERENCES sections(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      game_type TEXT NOT NULL,
      section_id INTEGER REFERENCES sections(id),
      host_user_id INTEGER NOT NULL REFERENCES users(id),
      location TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      max_players INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'open',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age_months INTEGER,
      bio TEXT,
      vaccinated INTEGER NOT NULL DEFAULT 0,
      neutered INTEGER NOT NULL DEFAULT 0,
      looking_for_playmate INTEGER NOT NULL DEFAULT 1,
      personality TEXT NOT NULL DEFAULT '{}',
      health TEXT NOT NULL DEFAULT '{}',
      image_url TEXT,
      city TEXT,
      neighborhood TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playdate_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_pet_id INTEGER NOT NULL REFERENCES pets(id),
      to_pet_id INTEGER NOT NULL REFERENCES pets(id),
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER REFERENCES users(id),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_at TEXT,
      location TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playdate_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playdate_id INTEGER NOT NULL REFERENCES playdate_requests(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pet_species (
      code TEXT PRIMARY KEY,
      label_fa TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🐾',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pet_breeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_code TEXT NOT NULL REFERENCES pet_species(code),
      name_fa TEXT NOT NULL,
      name_en TEXT,
      sort_order INTEGER NOT NULL DEFAULT 100,
      UNIQUE(species_code, name_fa)
    );
  `);
  migrateSchema();
  seedSpeciesCatalog();
}

/** تخصیص / نرمال‌سازی PD-U##### و PD-P##### و PD-O##### برای ردیف‌های بدون کد یا با پد ناقص */
function backfillPublicIds(): void {
  const userMissing = db
    .prepare(
      `SELECT id, public_id FROM users WHERE public_id IS NULL OR trim(CAST(public_id AS TEXT)) = ''`
    )
    .all() as { id: number; public_id: string | null }[];
  if (userMissing.length) {
    const upd = db.prepare('UPDATE users SET public_id = ? WHERE id = ?');
    for (const row of userMissing) {
      upd.run(makeUserPublicId(Number(row.id)), Number(row.id));
    }
  }
  // Re-pad short / legacy forms (PD-U42 → PD-U00042, /u00042 → PD-U00042)
  const userAll = db.prepare('SELECT id, public_id FROM users WHERE public_id IS NOT NULL').all() as {
    id: number;
    public_id: string;
  }[];
  const updUser = db.prepare('UPDATE users SET public_id = ? WHERE id = ?');
  for (const row of userAll) {
    const canonical = userPublicIdOf({ id: Number(row.id), publicId: row.public_id });
    if (canonical !== String(row.public_id).trim()) {
      updUser.run(canonical, Number(row.id));
    }
  }

  const petMissing = db
    .prepare(
      `SELECT id, public_id FROM pets WHERE public_id IS NULL OR trim(CAST(public_id AS TEXT)) = ''`
    )
    .all() as { id: number; public_id: string | null }[];
  if (petMissing.length) {
    const upd = db.prepare('UPDATE pets SET public_id = ? WHERE id = ?');
    for (const row of petMissing) {
      upd.run(makePetPublicId(Number(row.id)), Number(row.id));
    }
  }
  const petAll = db.prepare('SELECT id, public_id FROM pets WHERE public_id IS NOT NULL').all() as {
    id: number;
    public_id: string;
  }[];
  const updPet = db.prepare('UPDATE pets SET public_id = ? WHERE id = ?');
  for (const row of petAll) {
    const canonical = petPublicIdOf({ id: Number(row.id), publicId: row.public_id });
    if (canonical !== String(row.public_id).trim()) {
      updPet.run(canonical, Number(row.id));
    }
  }

  try {
    const orderCols = (
      db.prepare(`PRAGMA table_info(shop_orders)`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    if (orderCols.includes('public_id')) {
      const orderMissing = db
        .prepare(
          `SELECT id, public_id FROM shop_orders WHERE public_id IS NULL OR trim(CAST(public_id AS TEXT)) = ''`
        )
        .all() as { id: number; public_id: string | null }[];
      if (orderMissing.length) {
        const upd = db.prepare('UPDATE shop_orders SET public_id = ? WHERE id = ?');
        for (const row of orderMissing) {
          upd.run(makeOrderPublicId(Number(row.id)), Number(row.id));
        }
      }
      const orderAll = db
        .prepare('SELECT id, public_id FROM shop_orders WHERE public_id IS NOT NULL')
        .all() as { id: number; public_id: string }[];
      const updOrder = db.prepare('UPDATE shop_orders SET public_id = ? WHERE id = ?');
      for (const row of orderAll) {
        const canonical = orderPublicIdOf({ id: Number(row.id), publicId: row.public_id });
        if (canonical !== String(row.public_id).trim()) {
          updOrder.run(canonical, Number(row.id));
        }
      }
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_orders_public_id ON shop_orders (public_id)');
    }
  } catch (err) {
    console.warn('shop_orders public_id backfill skipped/failed:', (err as Error).message);
  }

  backfillEntityPublicIds(
    'vet_consultations',
    makeConsultPublicId,
    (id, publicId) => consultPublicIdOf({ id, publicId }),
    'idx_vet_consultations_public_id'
  );
  backfillEntityPublicIds(
    'playdate_requests',
    makePlaydatePublicId,
    (id, publicId) => playdatePublicIdOf({ id, publicId }),
    'idx_playdate_requests_public_id'
  );
  backfillEntityPublicIds(
    'payment_orders',
    makePaymentPublicId,
    (id, publicId) => paymentPublicIdOf({ id, publicId }),
    'idx_payment_orders_public_id'
  );

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users (public_id)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_pets_public_id ON pets (public_id)');
}

function backfillEntityPublicIds(
  table: string,
  make: (id: number) => string,
  canonicalOf: (id: number, publicId: string | null) => string,
  uniqueIndexName?: string
): void {
  try {
    const cols = (
      db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    if (!cols.includes('public_id')) return;
    const missing = db
      .prepare(
        `SELECT id, public_id FROM ${table} WHERE public_id IS NULL OR trim(CAST(public_id AS TEXT)) = ''`
      )
      .all() as { id: number; public_id: string | null }[];
    if (missing.length) {
      const upd = db.prepare(`UPDATE ${table} SET public_id = ? WHERE id = ?`);
      for (const row of missing) {
        upd.run(make(Number(row.id)), Number(row.id));
      }
    }
    const all = db
      .prepare(`SELECT id, public_id FROM ${table} WHERE public_id IS NOT NULL`)
      .all() as { id: number; public_id: string }[];
    const updAll = db.prepare(`UPDATE ${table} SET public_id = ? WHERE id = ?`);
    for (const row of all) {
      const canonical = canonicalOf(Number(row.id), row.public_id);
      if (canonical !== String(row.public_id).trim()) {
        updAll.run(canonical, Number(row.id));
      }
    }
    if (uniqueIndexName) {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${uniqueIndexName} ON ${table} (public_id)`);
    }
  } catch (err) {
    console.warn(`public_id backfill for ${table} skipped:`, (err as Error).message);
  }
}

function migrateSchema() {
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const names = new Set(userCols.map((c) => c.name));
  if (!names.has('role')) db.exec('ALTER TABLE users ADD COLUMN role TEXT');
  if (!names.has('roles')) db.exec("ALTER TABLE users ADD COLUMN roles TEXT NOT NULL DEFAULT '[]'");
  if (!names.has('onboarding')) {
    db.exec("ALTER TABLE users ADD COLUMN onboarding TEXT NOT NULL DEFAULT 'role_selected'");
  }
  if (!names.has('age')) db.exec('ALTER TABLE users ADD COLUMN age INTEGER');
  if (!names.has('gender')) db.exec('ALTER TABLE users ADD COLUMN gender TEXT');
  if (!names.has('city')) db.exec('ALTER TABLE users ADD COLUMN city TEXT');
  if (!names.has('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  if (!names.has('phone_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('phone_verified_at')) {
    db.exec('ALTER TABLE users ADD COLUMN phone_verified_at TEXT');
  }
  if (!names.has('bio')) db.exec('ALTER TABLE users ADD COLUMN bio TEXT');
  if (!names.has('avatar_url')) db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  if (!names.has('avatar_custom')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_custom INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('avatar_moderation_status')) {
    // Existing avatars stay visible; new uploads go pending via profile update.
    db.exec(
      "ALTER TABLE users ADD COLUMN avatar_moderation_status TEXT NOT NULL DEFAULT 'approved'"
    );
  }
  if (!names.has('province')) db.exec('ALTER TABLE users ADD COLUMN province TEXT');
  if (!names.has('country')) db.exec("ALTER TABLE users ADD COLUMN country TEXT");
  if (!names.has('interests')) db.exec("ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]'");
  if (!names.has('coins')) db.exec('ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0');
  /** کیف پول چندارزی — سکه ربات همان coins است؛ TON / Stars / تومان جدا */
  if (!names.has('wallet_ton')) {
    db.exec('ALTER TABLE users ADD COLUMN wallet_ton INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('wallet_stars')) {
    db.exec('ALTER TABLE users ADD COLUMN wallet_stars INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('wallet_toman')) {
    db.exec('ALTER TABLE users ADD COLUMN wallet_toman INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('last_daily_coin_at')) db.exec('ALTER TABLE users ADD COLUMN last_daily_coin_at TEXT');
  if (!names.has('signup_bonus_claimed')) {
    db.exec('ALTER TABLE users ADD COLUMN signup_bonus_claimed INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('referred_by')) {
    db.exec('ALTER TABLE users ADD COLUMN referred_by INTEGER');
  }
  if (!names.has('profile_rewards')) {
    db.exec("ALTER TABLE users ADD COLUMN profile_rewards TEXT NOT NULL DEFAULT '[]'");
  }
  if (!names.has('profile_views')) db.exec('ALTER TABLE users ADD COLUMN profile_views INTEGER NOT NULL DEFAULT 0');
  if (!names.has('likes_count')) db.exec('ALTER TABLE users ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0');
  if (!names.has('is_active')) db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  if (!names.has('silent_chat_requests')) {
    db.exec('ALTER TABLE users ADD COLUMN silent_chat_requests INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('verification_status')) {
    db.exec("ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!names.has('verification_photo_file_id')) {
    db.exec('ALTER TABLE users ADD COLUMN verification_photo_file_id TEXT');
  }
  if (!names.has('verified_at')) db.exec('ALTER TABLE users ADD COLUMN verified_at TEXT');
  if (!names.has('verification_note')) db.exec('ALTER TABLE users ADD COLUMN verification_note TEXT');
  if (!names.has('vet_credential_file_id')) {
    db.exec('ALTER TABLE users ADD COLUMN vet_credential_file_id TEXT');
  }
  if (!names.has('vet_credential_status')) {
    db.exec("ALTER TABLE users ADD COLUMN vet_credential_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!names.has('vet_online')) {
    db.exec('ALTER TABLE users ADD COLUMN vet_online INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('ready_to_adopt')) {
    db.exec('ALTER TABLE users ADD COLUMN ready_to_adopt INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('vet_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN vet_enabled INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('visit_fee_coins')) {
    db.exec('ALTER TABLE users ADD COLUMN visit_fee_coins INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('trainer_credential_file_id')) {
    db.exec('ALTER TABLE users ADD COLUMN trainer_credential_file_id TEXT');
  }
  if (!names.has('trainer_credential_status')) {
    db.exec("ALTER TABLE users ADD COLUMN trainer_credential_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!names.has('trainer_online')) {
    db.exec('ALTER TABLE users ADD COLUMN trainer_online INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('trainer_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN trainer_enabled INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('sitter_credential_file_id')) {
    db.exec('ALTER TABLE users ADD COLUMN sitter_credential_file_id TEXT');
  }
  if (!names.has('sitter_credential_status')) {
    db.exec("ALTER TABLE users ADD COLUMN sitter_credential_status TEXT NOT NULL DEFAULT 'none'");
  }
  if (!names.has('sitter_online')) {
    db.exec('ALTER TABLE users ADD COLUMN sitter_online INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('sitter_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN sitter_enabled INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('accept_seeker_advice')) {
    db.exec('ALTER TABLE users ADD COLUMN accept_seeker_advice INTEGER NOT NULL DEFAULT 0');
  }
  /** شناسهٔ عمومی پایدار نمایشی — PD-U##### */
  if (!names.has('public_id')) {
    db.exec('ALTER TABLE users ADD COLUMN public_id TEXT');
  }
  /** آخرین موقعیت GPS اشتراک‌گذاری‌شده (برای پت‌های نزدیک در ربات) */
  if (!names.has('lat')) {
    db.exec('ALTER TABLE users ADD COLUMN lat REAL');
  }
  if (!names.has('lng')) {
    db.exec('ALTER TABLE users ADD COLUMN lng REAL');
  }
  if (!names.has('location_updated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN location_updated_at TEXT');
  }
  /** Learned chat tone for AI trainer (پاشا) — JSON UserToneProfile */
  if (!names.has('ai_tone_json')) {
    db.exec('ALTER TABLE users ADD COLUMN ai_tone_json TEXT');
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_lat_lng ON users (lat, lng);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS coin_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, reason),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON coin_ledger (user_id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS coin_sell_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      rate_toman INTEGER NOT NULL,
      amount_toman INTEGER NOT NULL,
      card_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      package_id TEXT NOT NULL,
      coins INTEGER NOT NULL,
      amount_toman INTEGER,
      amount_stars INTEGER,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      receipt_file_id TEXT,
      telegram_payment_charge_id TEXT,
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_payment_orders_user
    ON payment_orders(user_id, status);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_payment_orders_status
    ON payment_orders(status, created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vet_consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vet_user_id INTEGER NOT NULL REFERENCES users(id),
      patient_user_id INTEGER NOT NULL REFERENCES users(id),
      pet_id INTEGER REFERENCES pets(id),
      status TEXT NOT NULL DEFAULT 'requested',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vet_consultations_vet
      ON vet_consultations (vet_user_id, created_at DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vet_consultations_patient
      ON vet_consultations (patient_user_id, created_at DESC);
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vet_consult_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL REFERENCES vet_consultations(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vet_consult_chat_messages_consult
      ON vet_consult_chat_messages (consult_id, id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS support_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL REFERENCES support_threads(id),
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_support_messages_thread
      ON support_messages (thread_id, id);
  `);


  db.exec(`
    CREATE TABLE IF NOT EXISTS vet_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL UNIQUE REFERENCES vet_consultations(id),
      vet_user_id INTEGER NOT NULL REFERENCES users(id),
      patient_user_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vet_ratings_vet
      ON vet_ratings (vet_user_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_medical_records (
      pet_id INTEGER PRIMARY KEY REFERENCES pets(id) ON DELETE CASCADE,
      notes TEXT,
      vaccinations TEXT,
      allergies TEXT,
      chronic_conditions TEXT,
      last_checkup TEXT,
      medications TEXT,
      last_updated_by_user_id INTEGER REFERENCES users(id),
      last_updated_by_name TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_medical_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      author_user_id INTEGER NOT NULL REFERENCES users(id),
      author_name TEXT,
      consult_id INTEGER REFERENCES vet_consultations(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pet_medical_entries_pet
      ON pet_medical_entries (pet_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER REFERENCES vet_consultations(id),
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      vet_user_id INTEGER NOT NULL REFERENCES users(id),
      patient_user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      pdf_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prescriptions_pet
      ON prescriptions (pet_id, created_at DESC);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prescriptions_consult
      ON prescriptions (consult_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_wishlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      target_pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(pet_id, target_pet_id)
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pet_wishlists_pet
      ON pet_wishlists (pet_id, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, contact_user_id)
    )
  `);
  
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_contacts_user ON user_contacts (user_id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, blocked_user_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_blocks_user ON user_blocks (user_id);`);

  const userCols2 = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const userNames2 = new Set(userCols2.map((c) => c.name));
  if (!userNames2.has('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  if (!userNames2.has('email_verified')) db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  if (!userNames2.has('silent_chat_requests')) {
    db.exec('ALTER TABLE users ADD COLUMN silent_chat_requests INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS web_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(channel, target)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_web_otps_target ON web_otps (channel, target);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS web_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions (user_id);`);

  /** One-time tokens for web→Telegram account attach (wallet sync deep links). */
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_attach_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_telegram_attach_tokens_user
      ON telegram_attach_tokens (user_id)`
  );

  /**
   * Mobile same-browser Telegram login: browser creates pending id, bot confirms via
   * callback (no website URL), browser polls until ready — same tab/browser.
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_login_pending (
      id TEXT PRIMARY KEY,
      next_path TEXT NOT NULL DEFAULT '/home',
      status TEXT NOT NULL DEFAULT 'pending',
      telegram_id TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      session_token TEXT,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_telegram_login_pending_status
      ON telegram_login_pending (status, expires_at)`
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS playdate_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playdate_id INTEGER NOT NULL REFERENCES playdate_requests(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_playdate_chat_messages_playdate
      ON playdate_chat_messages (playdate_id, id)`
  );

  /** Bot-delivered Telegram message ids — used to wipe peer chats from web. */
  db.exec(`
    CREATE TABLE IF NOT EXISTS playdate_chat_tg_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playdate_id INTEGER NOT NULL REFERENCES playdate_requests(id) ON DELETE CASCADE,
      telegram_chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(telegram_chat_id, message_id)
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_playdate_chat_tg_refs_playdate
      ON playdate_chat_tg_refs (playdate_id)`
  );

  /** App error / warning log for admin panel. */
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL DEFAULT 'error',
      source TEXT NOT NULL DEFAULT 'api',
      message TEXT NOT NULL,
      stack TEXT,
      path TEXT,
      method TEXT,
      status_code INTEGER,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  /** Lightweight email send attempts for admin mail panel (no body / no secrets). */
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      purpose TEXT,
      ok INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_email_send_logs_created
      ON email_send_logs (created_at DESC)`
  );

  /** Footer / marketing newsletter subscribers (From: news@petdate.ir). */
  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE,
      source TEXT NOT NULL DEFAULT 'footer',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(email)
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created
      ON newsletter_subscribers (created_at DESC)`
  );

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_app_error_logs_created
      ON app_error_logs (created_at DESC)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_app_error_logs_level
      ON app_error_logs (level, created_at DESC)`
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS phone_otps (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const petCols = db.prepare("PRAGMA table_info(pets)").all() as { name: string }[];
  const petNames = new Set(petCols.map((c) => c.name));
  if (!petNames.has('gender')) db.exec('ALTER TABLE pets ADD COLUMN gender TEXT');
  if (!petNames.has('size')) db.exec('ALTER TABLE pets ADD COLUMN size TEXT');
  if (!petNames.has('color')) db.exec('ALTER TABLE pets ADD COLUMN color TEXT');
  /** شناسهٔ عمومی پایدار نمایشی — PD-P##### */
  if (!petNames.has('public_id')) {
    db.exec('ALTER TABLE pets ADD COLUMN public_id TEXT');
  }
  if (!petNames.has('photo_moderation_status')) {
    // Existing pets stay publicly visible; new uploads default to pending via create/update.
    db.exec(
      "ALTER TABLE pets ADD COLUMN photo_moderation_status TEXT NOT NULL DEFAULT 'approved'"
    );
  }

  // Backfill / normalize public ids (idempotent — safe on every startup)
  backfillPublicIds();

  const breedCols = db.prepare('PRAGMA table_info(pet_breeds)').all() as { name: string }[];
  const breedNames = new Set(breedCols.map((c) => c.name));
  if (!breedNames.has('sort_order')) {
    db.exec('ALTER TABLE pet_breeds ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100');
  }

  const medRecCols = db.prepare('PRAGMA table_info(pet_medical_records)').all() as { name: string }[];
  const medRecNames = new Set(medRecCols.map((c) => c.name));
  if (!medRecNames.has('last_updated_by_user_id')) {
    db.exec('ALTER TABLE pet_medical_records ADD COLUMN last_updated_by_user_id INTEGER REFERENCES users(id)');
  }
  if (!medRecNames.has('last_updated_by_name')) {
    db.exec('ALTER TABLE pet_medical_records ADD COLUMN last_updated_by_name TEXT');
  }

  const medEntryCols = db.prepare('PRAGMA table_info(pet_medical_entries)').all() as { name: string }[];
  const medEntryNames = new Set(medEntryCols.map((c) => c.name));
  if (!medEntryNames.has('author_name')) {
    db.exec('ALTER TABLE pet_medical_entries ADD COLUMN author_name TEXT');
  }
  // Backfill author_name from current user name for older rows
  db.exec(`
    UPDATE pet_medical_entries
    SET author_name = (
      SELECT u.name FROM users u WHERE u.id = pet_medical_entries.author_user_id
    )
    WHERE author_name IS NULL OR trim(author_name) = ''
  `);

  // Playdate chat media + secure/ended flags
  const pdCols = db.prepare('PRAGMA table_info(playdate_requests)').all() as { name: string }[];
  const pdNames = new Set(pdCols.map((c) => c.name));
  if (!pdNames.has('chat_secure')) {
    db.exec('ALTER TABLE playdate_requests ADD COLUMN chat_secure INTEGER NOT NULL DEFAULT 0');
  }
  if (!pdNames.has('chat_ended')) {
    db.exec('ALTER TABLE playdate_requests ADD COLUMN chat_ended INTEGER NOT NULL DEFAULT 0');
  }
  /** شناسهٔ عمومی پایدار نمایشی — PD-D##### */
  if (!pdNames.has('public_id')) {
    db.exec('ALTER TABLE playdate_requests ADD COLUMN public_id TEXT');
  }

  const chatCols = db.prepare('PRAGMA table_info(playdate_chat_messages)').all() as { name: string }[];
  const chatNames = new Set(chatCols.map((c) => c.name));
  if (!chatNames.has('media_kind')) {
    db.exec('ALTER TABLE playdate_chat_messages ADD COLUMN media_kind TEXT');
  }
  if (!chatNames.has('telegram_file_id')) {
    db.exec('ALTER TABLE playdate_chat_messages ADD COLUMN telegram_file_id TEXT');
  }
  if (!chatNames.has('mime_type')) {
    db.exec('ALTER TABLE playdate_chat_messages ADD COLUMN mime_type TEXT');
  }
  if (!chatNames.has('file_name')) {
    db.exec('ALTER TABLE playdate_chat_messages ADD COLUMN file_name TEXT');
  }
  if (!chatNames.has('storage_key')) {
    db.exec('ALTER TABLE playdate_chat_messages ADD COLUMN storage_key TEXT');
  }

  // Vet consult chat media + secure/ended flags (parity with playdate chat)
  const vcCols = db.prepare('PRAGMA table_info(vet_consultations)').all() as { name: string }[];
  const vcNames = new Set(vcCols.map((c) => c.name));
  if (!vcNames.has('chat_secure')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN chat_secure INTEGER NOT NULL DEFAULT 0');
  }
  if (!vcNames.has('chat_ended')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN chat_ended INTEGER NOT NULL DEFAULT 0');
  }
  if (!vcNames.has('fee_coins')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN fee_coins INTEGER');
  }
  if (!vcNames.has('vet_paid_at')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN vet_paid_at TEXT');
  }
  if (!vcNames.has('service_kind')) {
    db.exec(
      "ALTER TABLE vet_consultations ADD COLUMN service_kind TEXT NOT NULL DEFAULT 'vet'"
    );
  }
  if (!vcNames.has('provider_share_coins')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN provider_share_coins INTEGER');
  }
  /** شناسهٔ عمومی پایدار نمایشی — PD-C##### */
  if (!vcNames.has('public_id')) {
    db.exec('ALTER TABLE vet_consultations ADD COLUMN public_id TEXT');
  }

  const vchatCols = db
    .prepare('PRAGMA table_info(vet_consult_chat_messages)')
    .all() as { name: string }[];
  const vchatNames = new Set(vchatCols.map((c) => c.name));
  if (!vchatNames.has('media_kind')) {
    db.exec('ALTER TABLE vet_consult_chat_messages ADD COLUMN media_kind TEXT');
  }
  if (!vchatNames.has('telegram_file_id')) {
    db.exec('ALTER TABLE vet_consult_chat_messages ADD COLUMN telegram_file_id TEXT');
  }
  if (!vchatNames.has('mime_type')) {
    db.exec('ALTER TABLE vet_consult_chat_messages ADD COLUMN mime_type TEXT');
  }
  if (!vchatNames.has('file_name')) {
    db.exec('ALTER TABLE vet_consult_chat_messages ADD COLUMN file_name TEXT');
  }
  if (!vchatNames.has('storage_key')) {
    db.exec('ALTER TABLE vet_consult_chat_messages ADD COLUMN storage_key TEXT');
  }

  const userPresenceCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const userPresenceNames = new Set(userPresenceCols.map((c) => c.name));
  if (!userPresenceNames.has('last_seen_at')) {
    db.exec('ALTER TABLE users ADD COLUMN last_seen_at TEXT');
  }
  /** اتصال Telegram Business برای خواندن موجودی Stars شخصی کاربر */
  if (!userPresenceNames.has('tg_business_connection_id')) {
    db.exec('ALTER TABLE users ADD COLUMN tg_business_connection_id TEXT');
  }
  if (!userPresenceNames.has('tg_business_enabled')) {
    db.exec('ALTER TABLE users ADD COLUMN tg_business_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!userPresenceNames.has('tg_business_can_view_stars')) {
    db.exec('ALTER TABLE users ADD COLUMN tg_business_can_view_stars INTEGER NOT NULL DEFAULT 0');
  }
  if (!userPresenceNames.has('tg_stars_cached')) {
    db.exec('ALTER TABLE users ADD COLUMN tg_stars_cached INTEGER');
  }
  if (!userPresenceNames.has('tg_stars_synced_at')) {
    db.exec('ALTER TABLE users ADD COLUMN tg_stars_synced_at TEXT');
  }

  // Backfill roles JSON + migrate removed roles (pet_sitter / community_seeker → drop or pet_owner)
  const roleRows = db
    .prepare(
      `SELECT id, role, roles FROM users WHERE (role IS NOT NULL AND role != '') OR (roles IS NOT NULL AND roles != '[]' AND roles != '')`
    )
    .all() as { id: number; role: string; roles: string }[];
  const updateRoles = db.prepare('UPDATE users SET roles = ?, role = ? WHERE id = ?');
  for (const row of roleRows) {
    const parsed = parseRoles(row.roles, row.role);
    if (!parsed.length) continue;
    const current = (() => {
      try {
        const p = JSON.parse(row.roles || '[]');
        return Array.isArray(p) ? p.map(String) : [];
      } catch {
        return [];
      }
    })();
    const primaryCandidate =
      row.role && USER_ROLES.includes(row.role as UserRole)
        ? (row.role as UserRole)
        : parsed[0]!;
    const nextPrimary = parsed.includes(primaryCandidate) ? primaryCandidate : parsed[0]!;
    const sameRoles =
      current.length === parsed.length && current.every((r, i) => r === parsed[i]);
    if (!sameRoles || row.role !== nextPrimary) {
      updateRoles.run(JSON.stringify(parsed), nextPrimary, row.id);
    }
  }

  /** Shop catalog + orders (admin CRUD; schema aligned with web shopCatalog) */
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_products (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      pet_types TEXT NOT NULL DEFAULT '[]',
      price_toman INTEGER NOT NULL DEFAULT 0,
      compare_at_toman INTEGER,
      image TEXT,
      badge TEXT,
      in_stock INTEGER NOT NULL DEFAULT 1,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      params TEXT NOT NULL DEFAULT '{}',
      description TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_categories (
      slug TEXT PRIMARY KEY,
      label_fa TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🛒',
      sort_order INTEGER NOT NULL DEFAULT 100
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      total_toman INTEGER NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL DEFAULT '[]',
      customer_name TEXT,
      customer_phone TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      placement TEXT NOT NULL DEFAULT 'landing',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  /** Finance: product COGS + order payment mix + multi-currency wallet ledger */
  const shopProductCols = (
    db.prepare(`PRAGMA table_info(shop_products)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!shopProductCols.includes('cost_toman')) {
    db.exec('ALTER TABLE shop_products ADD COLUMN cost_toman INTEGER');
  }

  const shopOrderCols = (
    db.prepare(`PRAGMA table_info(shop_orders)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!shopOrderCols.includes('payment_currency')) {
    db.exec(`ALTER TABLE shop_orders ADD COLUMN payment_currency TEXT NOT NULL DEFAULT 'toman'`);
  }
  if (!shopOrderCols.includes('payment_amount')) {
    db.exec('ALTER TABLE shop_orders ADD COLUMN payment_amount INTEGER');
  }
  if (!shopOrderCols.includes('cogs_toman')) {
    db.exec('ALTER TABLE shop_orders ADD COLUMN cogs_toman INTEGER');
  }
  if (!shopOrderCols.includes('public_id')) {
    db.exec('ALTER TABLE shop_orders ADD COLUMN public_id TEXT');
  }

  const paymentOrderCols = (
    db.prepare(`PRAGMA table_info(payment_orders)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  /** شناسهٔ عمومی پایدار نمایشی — PD-R##### */
  if (!paymentOrderCols.includes('public_id')) {
    db.exec('ALTER TABLE payment_orders ADD COLUMN public_id TEXT');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      ref_type TEXT,
      ref_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created ON wallet_ledger(created_at DESC)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_wallet_ledger_currency ON wallet_ledger(currency, created_at)`
  );

  seedFinanceDefaults();

  // پیوند (HR) — CREATE IF NOT EXISTS only; never wipe
  try {
    // Lazy require avoids circular import with getDb()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureHrSchema } = require('./hr-service') as typeof import('./hr-service');
    ensureHrSchema();
  } catch (err) {
    console.warn('HR schema ensure skipped/failed:', (err as Error).message);
  }

  // فروش (Sales CRM) — CREATE IF NOT EXISTS only; never wipe
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureSalesSchema } = require('./sales-service') as typeof import('./sales-service');
    ensureSalesSchema();
  } catch (err) {
    console.warn('Sales schema ensure skipped/failed:', (err as Error).message);
  }

  // باشگاه مشتریان / امور مشتریان — CREATE IF NOT EXISTS only; never wipe
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureCrmSchema } = require('./crm-service') as typeof import('./crm-service');
    ensureCrmSchema();
  } catch (err) {
    console.warn('CRM schema ensure skipped/failed:', (err as Error).message);
  }

  // Admin header notifications — CREATE IF NOT EXISTS + idempotent seed; never wipe
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureAdminNotificationsSchema } =
      require('./admin-notifications') as typeof import('./admin-notifications');
    ensureAdminNotificationsSchema();
  } catch (err) {
    console.warn('Admin notifications schema ensure skipped/failed:', (err as Error).message);
  }

  // Platform settings — modular dropdowns + module goals (additive; never wipe)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensurePlatformSettingsSchema } =
      require('./platform-settings-service') as typeof import('./platform-settings-service');
    ensurePlatformSettingsSchema();
  } catch (err) {
    console.warn('Platform settings schema ensure skipped/failed:', (err as Error).message);
  }

  // HR↔Sales interconnected demo (idempotent; never wipe / never duplicate)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedHrSalesDemoIfNeeded } =
      require('./hr-sales-demo-seed') as typeof import('./hr-sales-demo-seed');
    seedHrSalesDemoIfNeeded();
  } catch (err) {
    console.warn('HR↔Sales demo seed skipped/failed:', (err as Error).message);
  }

  // CRM / باشگاه مشتریان demo (idempotent; never wipe)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedCrmDemoIfNeeded } = require('./crm-demo-seed') as typeof import('./crm-demo-seed');
    seedCrmDemoIfNeeded();
  } catch (err) {
    console.warn('CRM demo seed skipped/failed:', (err as Error).message);
  }

  // Magazine / news CMS (additive; never wipe)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ensureMagazineSchema } =
      require('./magazine-service') as typeof import('./magazine-service');
    ensureMagazineSchema();
  } catch (err) {
    console.warn('Magazine schema ensure skipped/failed:', (err as Error).message);
  }
}

function seedFinanceDefaults() {
  const upsert = db.prepare(
    `INSERT INTO admin_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO NOTHING`
  );
  upsert.run('financeMarginPercent', '35');
  // Consult commission is a percent of invoice (fee_coins→toman), default 20%.
  // Legacy `vetConsultFeeToman` (fixed Toman, e.g. 250000) is ignored when migrating.
  upsert.run('vetConsultFeePercent', '20');
  upsert.run('playdateFeeToman', '0');
  upsert.run('financeOpExMonthlyToman', '5000000');

  // Unit switch: if an old fixed-Toman row exists and percent was never customized past seed,
  // keep percent at 20 (do not derive from the old Toman value).
  const legacyToman = db
    .prepare(`SELECT value FROM admin_settings WHERE key = 'vetConsultFeeToman'`)
    .get() as { value: string } | undefined;
  if (legacyToman) {
    upsert.run('vetConsultFeePercent', '20');
  }

  const orderCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM shop_orders').get() as { c: number } | undefined)?.c ?? 0
  );
  if (orderCount > 0) return;

  const productCount = Number(
    (db.prepare('SELECT COUNT(*) as c FROM shop_products').get() as { c: number } | undefined)?.c ?? 0
  );
  if (productCount === 0) {
    const cats = [
      ['dog-food', 'غذای سگ', 'dog', 'غذای خشک و کنسرو', '🦴', 10],
      ['cat-food', 'غذای گربه', 'cat', 'غذای خشک و پوچ', '🐟', 20],
      ['dog-toys', 'اسباب بازی سگ', 'dog', 'توپ و اسباب‌بازی', '🎾', 30],
      ['cat-litter', 'لوازم دستشویی گربه', 'cat', 'خاک و سینی', '🚽', 40],
    ] as const;
    const insCat = db.prepare(
      `INSERT OR IGNORE INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const c of cats) insCat.run(...c);

    const products = [
      ['pd-royal-dog-3', 'royal-canin-dog-3kg', 'رویال کنین سگ ۳کیلو', 'royal-canin', 'dog-food', '["dog"]', 1890000, 1200000],
      ['pd-whiskas-cat', 'whiskas-cat-dry', 'ویسکاس گربه خشک', 'whiskas', 'cat-food', '["cat"]', 420000, 280000],
      ['pd-kong-classic', 'kong-classic-m', 'کنگ کلاسیک سایز M', 'kong', 'dog-toys', '["dog"]', 890000, 520000],
      ['pd-cat-litter', 'cat-litter-10kg', 'خاک گربه ۱۰کیلو', 'petdate', 'cat-litter', '["cat"]', 310000, 190000],
      ['pd-bird-seed', 'bird-seed-mix', 'مخلوط دان پرنده', 'petdate', 'bird-food', '["bird"]', 185000, 110000],
    ] as const;
    db.prepare(
      `INSERT OR IGNORE INTO shop_categories (slug, label_fa, pet_type, description, emoji, sort_order)
       VALUES ('bird-food', 'غذای پرنده', 'bird', 'دان و مخلوط', '🐦', 50)`
    ).run();
    const insProd = db.prepare(
      `INSERT OR IGNORE INTO shop_products (
        id, slug, title, brand_id, category_slug, pet_types, price_toman, cost_toman,
        in_stock, stock_qty, featured, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 40, 1, 'محصول پت دیت شاپ')`
    );
    for (const p of products) insProd.run(...p);
  } else {
    db.prepare(
      `UPDATE shop_products
       SET cost_toman = CAST(price_toman * 0.65 AS INTEGER)
       WHERE cost_toman IS NULL AND price_toman > 0`
    ).run();
  }

  const products = db
    .prepare(
      `SELECT id, title, category_slug, price_toman, COALESCE(cost_toman, CAST(price_toman * 0.65 AS INTEGER)) AS cost_toman
       FROM shop_products ORDER BY featured DESC LIMIT 8`
    )
    .all() as Array<{
      id: string;
      title: string;
      category_slug: string;
      price_toman: number;
      cost_toman: number;
    }>;
  if (!products.length) return;

  const currencies = ['toman', 'toman', 'toman', 'coins', 'stars', 'ton'] as const;
  const statuses = ['paid', 'shipped', 'completed', 'paid', 'completed', 'pending', 'cancelled'] as const;
  const names = ['سارا م.', 'علی ر.', 'مریم ک.', 'رضا ن.', 'نگار پ.', 'حسین ب.'];
  const insOrder = db.prepare(
    `INSERT INTO shop_orders (
      user_id, status, total_toman, items_json, customer_name, customer_phone,
      payment_currency, payment_amount, cogs_toman, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insLedger = db.prepare(
    `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const now = Date.now();
  for (let i = 0; i < 42; i++) {
    const dayOffset = Math.floor(i * 0.7);
    const created = new Date(now - dayOffset * 86400000 - (i % 5) * 3600000);
    const iso = created.toISOString().replace('T', ' ').slice(0, 19);
    const p = products[i % products.length];
    const qty = 1 + (i % 3);
    const total = p.price_toman * qty;
    const cogs = p.cost_toman * qty;
    const status = statuses[i % statuses.length];
    const currency = currencies[i % currencies.length];
    const items = [
      {
        productId: p.id,
        title: p.title,
        categorySlug: p.category_slug,
        qty,
        priceToman: p.price_toman,
        costToman: p.cost_toman,
      },
    ];
    const r = insOrder.run(
      null,
      status,
      total,
      JSON.stringify(items),
      names[i % names.length],
      `09${String(100000000 + i).slice(0, 9)}`,
      currency,
      total,
      cogs,
      iso,
      iso
    );
    if (status !== 'pending' && status !== 'cancelled') {
      insLedger.run(
        null,
        currency,
        total,
        'debit',
        'خرید فروشگاه',
        'shop_order',
        String(r.lastInsertRowid),
        iso
      );
    }
  }

  const ledgerSeed = [
    ['coins', 500, 'credit', 'جایزه ثبت‌نام', 12],
    ['coins', 120, 'credit', 'پاداش پروفایل', 10],
    ['toman', 2000000, 'credit', 'شارژ کیف پول', 8],
    ['stars', 50, 'credit', 'خرید Stars', 6],
    ['ton', 2, 'credit', 'واریز TON', 4],
    ['coins', 80, 'debit', 'هزینه همبازی', 5],
    ['toman', 250000, 'debit', 'مشاوره دامپزشک', 7],
  ] as const;
  for (const [currency, amount, direction, reason, daysAgo] of ledgerSeed) {
    const created = new Date(now - daysAgo * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    insLedger.run(null, currency, amount, direction, reason, 'seed', null, created);
  }
}

function seedSpeciesCatalog() {
  const insertSpecies = db.prepare(
    `INSERT OR IGNORE INTO pet_species (code, label_fa, emoji, sort_order) VALUES (?, ?, ?, ?)`
  );
  PET_SPECIES.forEach((s, i) => insertSpecies.run(s.code, s.labelFa, s.emoji, i));

  const upsertBreed = db.prepare(`
    INSERT INTO pet_breeds (species_code, name_fa, name_en, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(species_code, name_fa) DO UPDATE SET
      name_en = excluded.name_en,
      sort_order = excluded.sort_order
  `);

  const keepKeys = new Set<string>();
  for (const b of PET_BREEDS_SEED) {
    upsertBreed.run(b.speciesCode, b.nameFa, b.nameEn ?? null, b.sortOrder);
    keepKeys.add(`${b.speciesCode}::${b.nameFa}`);
  }

  // حذف نژادهای قدیمی که دیگر در کاتالوگ نیستند
  const existing = db
    .prepare('SELECT id, species_code, name_fa FROM pet_breeds')
    .all() as Array<{ id: number; species_code: string; name_fa: string }>;
  const del = db.prepare('DELETE FROM pet_breeds WHERE id = ?');
  for (const row of existing) {
    if (!keepKeys.has(`${row.species_code}::${row.name_fa}`)) {
      del.run(row.id);
    }
  }
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM sections').get() as { c: number };
  if (count.c > 0) return;

  // Never insert demo_host / demo_player / sample games unless explicitly allowed.
  // Production DBs must not regain fake users after a wipe.
  if (
    process.env.SEED_DEMO_DATA !== '1' ||
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOW_DEMO_SEED === '0'
  ) {
    return;
  }

  const insertSection = db.prepare(
    'INSERT INTO sections (name, description, city) VALUES (?, ?, ?)'
  );
  insertSection.run('سکشن فوتبال تهران', 'دوستان فوتبال‌باز تهران', 'تهران');
  insertSection.run('سکشن والیبال اصفهان', 'گروه والیبال اصفهان', 'اصفهان');
  insertSection.run('سکشن بسکتبال شیراز', 'بسکتبال شیراز', 'شیراز');

  const insertUser = db.prepare(
    'INSERT INTO users (telegram_id, name, username, section_id) VALUES (?, ?, ?, ?)'
  );
  insertUser.run('demo_host', 'علی رضایی', 'ali_rezaei', 1);
  insertUser.run('demo_player', 'سارا محمدی', 'sara_m', 1);

  const insertGame = db.prepare(`
    INSERT INTO games (title, game_type, section_id, host_user_id, location, scheduled_at, max_players, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  insertGame.run(
    'فوتبال پنجشنبه شب',
    'football',
    1,
    1,
    'زمین چمن پارک ملت',
    tomorrow.toISOString(),
    10,
    'نیاز به ۲ دروازه‌بان داریم'
  );

  db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)').run(1, 1);
}

function seedDemoPetsIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM pets').get() as { c: number };
  if (count.c > 0) return;

  db.prepare("UPDATE users SET role = 'pet_owner', onboarding = 'profile_complete' WHERE id IN (1, 2)").run();

  const insertPet = db.prepare(`
    INSERT INTO pets (
      owner_id, name, species, breed, gender, age_months, size, color, bio,
      vaccinated, neutered, looking_for_playmate, image_url, city, neighborhood
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPet.run(
    1, 'ماکس', 'dog', 'گلدن رتریور', 'male', 24, 'large', 'طلایی',
    'بسیار بازیگوش و اجتماعی', 1, 1, 1,
    DEMO_DOG_PHOTOS[0], 'تهران', 'جردن'
  );
  insertPet.run(
    1, 'لونا', 'cat', 'پرشین', 'female', 18, 'small', 'سفید',
    'آرام و مهربان', 1, 1, 1,
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    'تهران', 'ولنجک'
  );
  insertPet.run(
    2, 'راکی', 'dog', 'هاسکی', 'male', 30, 'large', 'خاکستری',
    'دوست داره دویدن', 1, 0, 1,
    DEMO_DOG_PHOTOS[1], 'تهران', 'سعادت‌آباد'
  );
}

/** عکس‌های عمومی سگ (HTTPS) — برای نمایش در تلگرام */
const DEMO_DOG_PHOTOS = [
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1598133894008-61f7fdb8cc3a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1529429617124-95b109e86ad8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1518717756530-d6d9b0b8a0e5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?auto=format&fit=crop&w=800&q=80',
] as const;

const FAKE_DOG_OWNERS: Array<{
  telegramId: string;
  name: string;
  username: string;
  city: string;
  province: string;
  gender: UserGender;
  age: number;
  dogs: Array<{
    name: string;
    breed: string;
    gender: PetGender;
    ageMonths: number;
    size: PetSize;
    color: string;
    bio: string;
    city: string;
    neighborhood: string;
  }>;
}> = [
  {
    telegramId: 'fake_owner_01',
    name: 'نیما کریمی',
    username: 'nima_k',
    city: 'تهران',
    province: 'تهران',
    gender: 'male',
    age: 29,
    dogs: [
      { name: 'ماکس', breed: 'گلدن رتریور', gender: 'male', ageMonths: 36, size: 'large', color: 'طلایی', bio: 'عاشق توپ و پارک', city: 'تهران', neighborhood: 'جردن' },
      { name: 'بلا', breed: 'لابرادور', gender: 'female', ageMonths: 24, size: 'large', color: 'شکلاتی', bio: 'مهربون و آرام', city: 'تهران', neighborhood: 'جردن' },
    ],
  },
  {
    telegramId: 'fake_owner_02',
    name: 'سارا احمدی',
    username: 'sara_ahm',
    city: 'تهران',
    province: 'تهران',
    gender: 'female',
    age: 27,
    dogs: [
      { name: 'لونا', breed: 'هاسکی', gender: 'female', ageMonths: 30, size: 'large', color: 'خاکستری-سفید', bio: 'پر انرژی و بازیگوش', city: 'تهران', neighborhood: 'سعادت‌آباد' },
      { name: 'تدی', breed: 'پامرانین', gender: 'male', ageMonths: 18, size: 'small', color: 'نارنجی', bio: 'کوچولو ولی شجاع', city: 'تهران', neighborhood: 'سعادت‌آباد' },
    ],
  },
  {
    telegramId: 'fake_owner_03',
    name: 'رضا موسوی',
    username: 'reza_m',
    city: 'کرج',
    province: 'البرز',
    gender: 'male',
    age: 34,
    dogs: [
      { name: 'راکی', breed: 'ژرمن شپرد', gender: 'male', ageMonths: 48, size: 'large', color: 'مشکی-قهوه‌ای', bio: 'نگهبان خونه‌ست', city: 'کرج', neighborhood: 'گوهردشت' },
      { name: 'میلو', breed: 'بیگل', gender: 'male', ageMonths: 20, size: 'medium', color: 'سه‌رنگ', bio: 'بینی قوی، دنبال بو!', city: 'کرج', neighborhood: 'گوهردشت' },
    ],
  },
  {
    telegramId: 'fake_owner_04',
    name: 'مریم حسینی',
    username: 'maryam_h',
    city: 'اصفهان',
    province: 'اصفهان',
    gender: 'female',
    age: 31,
    dogs: [
      { name: 'کوکا', breed: 'شیتزو', gender: 'female', ageMonths: 22, size: 'small', color: 'سفید', bio: 'دوست داره بغل بشه', city: 'اصفهان', neighborhood: 'جلفا' },
      { name: 'بادی', breed: 'بولداگ فرانسوی', gender: 'male', ageMonths: 28, size: 'medium', color: 'خاکستری', bio: 'خنده‌دار و تنبل', city: 'اصفهان', neighborhood: 'جلفا' },
    ],
  },
  {
    telegramId: 'fake_owner_05',
    name: 'امیر جعفری',
    username: 'amir_j',
    city: 'شیراز',
    province: 'فارس',
    gender: 'male',
    age: 26,
    dogs: [
      { name: 'چیس', breed: 'مرزپایه', gender: 'male', ageMonths: 16, size: 'medium', color: 'مشکی-سفید', bio: 'باحال و سریع', city: 'شیراز', neighborhood: 'معالی‌آباد' },
      { name: 'نالا', breed: 'مالینویز', gender: 'female', ageMonths: 40, size: 'large', color: 'قهوه‌ای', bio: 'ورزشی و باهوش', city: 'شیراز', neighborhood: 'معالی‌آباد' },
    ],
  },
  {
    telegramId: 'fake_owner_06',
    name: 'یگانه رضایی',
    username: 'yegane_r',
    city: 'مشهد',
    province: 'خراسان رضوی',
    gender: 'female',
    age: 24,
    dogs: [
      { name: 'داکوتا', breed: 'هاسکی سیبری', gender: 'female', ageMonths: 26, size: 'large', color: 'سفید', bio: 'چشم آبی داره', city: 'مشهد', neighborhood: 'احمدآباد' },
      { name: 'پوچی', breed: 'چیهواهوا', gender: 'male', ageMonths: 14, size: 'small', color: 'قهوه‌ای', bio: 'جیغ‌جیغو ولی بامزه', city: 'مشهد', neighborhood: 'احمدآباد' },
    ],
  },
  {
    telegramId: 'fake_owner_07',
    name: 'حسین کاظمی',
    username: 'hossein_k',
    city: 'تبریز',
    province: 'آذربایجان شرقی',
    gender: 'male',
    age: 38,
    dogs: [
      { name: 'آتو', breed: 'آکیتا', gender: 'male', ageMonths: 42, size: 'large', color: 'سفید-نارنجی', bio: 'وفادار و جدی', city: 'تبریز', neighborhood: 'ولیعصر' },
      { name: 'سفید', breed: 'ساموید', gender: 'female', ageMonths: 20, size: 'medium', color: 'سفید', bio: 'مثل ابر پنبه‌ای', city: 'تبریز', neighborhood: 'ولیعصر' },
    ],
  },
  {
    telegramId: 'fake_owner_08',
    name: 'النا مرادی',
    username: 'elena_m',
    city: 'تهران',
    province: 'تهران',
    gender: 'female',
    age: 33,
    dogs: [
      { name: 'کویین', breed: 'پودل', gender: 'female', ageMonths: 32, size: 'medium', color: 'کرم', bio: 'مرتب و شیک', city: 'تهران', neighborhood: 'ونک' },
      { name: 'جک', breed: 'جک راسل', gender: 'male', ageMonths: 18, size: 'small', color: 'سفید-قهوه‌ای', bio: 'همیشه در حال دویدن', city: 'تهران', neighborhood: 'ونک' },
    ],
  },
  {
    telegramId: 'fake_owner_09',
    name: 'پویا نوری',
    username: 'pouya_n',
    city: 'اهواز',
    province: 'خوزستان',
    gender: 'male',
    age: 30,
    dogs: [
      { name: 'رکس', breed: 'روتوایلر', gender: 'male', ageMonths: 36, size: 'large', color: 'مشکی-قهوه‌ای', bio: 'قوی و محافظ', city: 'اهواز', neighborhood: 'کیانپارس' },
      { name: 'لیلا', breed: 'داکسوند', gender: 'female', ageMonths: 24, size: 'small', color: 'قهوه‌ای', bio: 'بدن دراز، قلب بزرگ', city: 'اهواز', neighborhood: 'کیانپارس' },
    ],
  },
  {
    telegramId: 'fake_owner_10',
    name: 'نازنین شریفی',
    username: 'nazanin_sh',
    city: 'قم',
    province: 'قم',
    gender: 'female',
    age: 28,
    dogs: [
      { name: 'مالی', breed: 'مالیتیز', gender: 'female', ageMonths: 15, size: 'small', color: 'سفید', bio: 'پر حرف و بامزه', city: 'قم', neighborhood: 'پردیسان' },
      { name: 'برنو', breed: 'باکسر', gender: 'male', ageMonths: 28, size: 'large', color: 'قهوه‌ای', bio: 'بازیگوش و وفادار', city: 'قم', neighborhood: 'پردیسان' },
    ],
  },
];

function seedFakeDogOwners() {
  const existing = db
    .prepare("SELECT id FROM users WHERE telegram_id = 'fake_owner_01'")
    .get() as { id: number } | undefined;

  if (!existing) {
    const insertUser = db.prepare(`
      INSERT INTO users (
        telegram_id, name, username, role, onboarding, age, gender, city, province,
        bio, interests, coins, is_active
      ) VALUES (?, ?, ?, 'pet_owner', 'profile_complete', ?, ?, ?, ?, ?, '[]', 50, 1)
    `);

    const insertPet = db.prepare(`
      INSERT INTO pets (
        owner_id, name, species, breed, gender, age_months, size, color, bio,
        vaccinated, neutered, looking_for_playmate, image_url, city, neighborhood
      ) VALUES (?, ?, 'dog', ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?)
    `);

    let photoIdx = 0;
    for (const owner of FAKE_DOG_OWNERS) {
      const result = insertUser.run(
        owner.telegramId,
        owner.name,
        owner.username,
        owner.age,
        owner.gender,
        owner.city,
        owner.province,
        `صاحب پت در ${owner.city}`
      );
      const ownerId = Number(result.lastInsertRowid);

      owner.dogs.forEach((dog, dogIdx) => {
        const imageUrl = DEMO_DOG_PHOTOS[photoIdx % DEMO_DOG_PHOTOS.length];
        photoIdx += 1;
        insertPet.run(
          ownerId,
          dog.name,
          dog.breed,
          dog.gender,
          dog.ageMonths,
          dog.size,
          dog.color,
          dog.bio,
          dogIdx === 0 ? 1 : 0,
          imageUrl,
          dog.city,
          dog.neighborhood
        );
      });
    }

    console.log('🐾 seeded 10 fake owners with 20 dogs (+photos)');
  }

  // پر کردن عکس برای پت‌هایی که هنوز image_url ندارند
  const missing = db
    .prepare(`SELECT id, species FROM pets WHERE image_url IS NULL OR image_url = ''`)
    .all() as Array<{ id: number; species: string }>;
  if (missing.length) {
    const update = db.prepare('UPDATE pets SET image_url = ?, updated_at = datetime(\'now\') WHERE id = ?');
    const catPhoto =
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80';
    for (const pet of missing) {
      const photo =
        pet.species === 'cat'
          ? catPhoto
          : DEMO_DOG_PHOTOS[pet.id % DEMO_DOG_PHOTOS.length]!;
      update.run(photo, pet.id);
    }
    console.log(`🐾 backfilled photos for ${missing.length} pets`);
  }

  db.prepare("UPDATE pets SET name = 'داکوتا' WHERE name = 'داکota'").run();
}

function parseInterests(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function parseRoles(value: unknown, fallbackRole?: unknown): UserRole[] {
  const fromJson = (() => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  return sanitizeRoleList(
    fromJson,
    typeof fallbackRole === 'string' ? fallbackRole : null
  );
}

function parseProfileRewards(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function isProfileSectionFilled(section: ProfileRewardSection, u: User): boolean {
  const filled = (value: unknown): boolean => Boolean(String(value ?? '').trim());
  switch (section) {
    case 'name':
      return filled(u.name);
    case 'age':
      return u.age != null && Number(u.age) > 0;
    case 'gender':
      return Boolean(u.gender);
    case 'location':
      return Boolean(
        filled(u.country) &&
          filled(u.city) &&
          (String(u.country) !== 'ایران' || filled(u.province))
      );
    case 'phone':
      return filled(u.phone);
    case 'photo':
      return filled(u.avatarUrl);
    case 'bio':
      return filled(u.bio);
    case 'interests':
      return Boolean(u.interests && u.interests.length > 0);
    default:
      return false;
  }
}

function mapVetRating(row: Record<string, unknown>): VetRating {
  return {
    id: Number(row.id),
    consultId: Number(row.consult_id),
    vetUserId: Number(row.vet_user_id),
    patientUserId: Number(row.patient_user_id),
    rating: Number(row.rating),
    comment: (row.comment as string | undefined) ?? undefined,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapUser(row: Record<string, unknown>): User {
  const roles = parseRoles(row.roles, row.role);
  const role =
    (row.role as UserRole | undefined) ??
    (roles.includes('pet_owner') ? 'pet_owner' : roles[0]);
  const telegramRaw = row.telegram_id;
  const phoneRaw = row.phone;
  const id = row.id as number;
  return {
    id,
    publicId: userPublicIdOf({ id, publicId: row.public_id as string | undefined }),
    telegramId:
      telegramRaw != null && String(telegramRaw).trim() !== ''
        ? String(telegramRaw).trim()
        : undefined,
    name: row.name as string,
    username: row.username as string | undefined,
    sectionId: row.section_id as number | undefined,
    role,
    roles,
    onboarding: (row.onboarding as OnboardingStatus | undefined) ?? undefined,
    age: row.age != null ? Number(row.age) : undefined,
    gender: row.gender as UserGender | undefined,
    country: row.country as string | undefined,
    city: row.city as string | undefined,
    province: row.province as string | undefined,
    phone:
      phoneRaw != null && String(phoneRaw).trim() !== ''
        ? String(phoneRaw).trim()
        : undefined,
    email: (row.email as string | undefined) ?? undefined,
    emailVerified: row.email_verified == null ? false : Boolean(row.email_verified),
    phoneVerified: row.phone_verified == null ? false : Boolean(row.phone_verified),
    phoneVerifiedAt: (row.phone_verified_at as string | undefined) ?? undefined,
    bio: row.bio as string | undefined,
    interests: parseInterests(row.interests),
    avatarUrl: row.avatar_url as string | undefined,
    avatarCustom: row.avatar_custom == null ? false : Boolean(row.avatar_custom),
    avatarModerationStatus: parsePhotoModerationStatus(row.avatar_moderation_status),
    coins: row.coins != null ? Number(row.coins) : 0,
    walletTon: row.wallet_ton != null ? Number(row.wallet_ton) : 0,
    walletStars: row.wallet_stars != null ? Number(row.wallet_stars) : 0,
    walletToman: row.wallet_toman != null ? Number(row.wallet_toman) : 0,
    wallet: walletFromUserFields({
      coins: row.coins != null ? Number(row.coins) : 0,
      walletTon: row.wallet_ton != null ? Number(row.wallet_ton) : 0,
      walletStars: row.wallet_stars != null ? Number(row.wallet_stars) : 0,
      walletToman: row.wallet_toman != null ? Number(row.wallet_toman) : 0,
    }),
    lastDailyCoinAt: (row.last_daily_coin_at as string | undefined) ?? undefined,
    signupBonusClaimed: Boolean(row.signup_bonus_claimed),
    referredBy: row.referred_by != null ? Number(row.referred_by) : null,
    profileRewards: parseProfileRewards(row.profile_rewards),
    profileViews: row.profile_views != null ? Number(row.profile_views) : 0,
    likesCount: row.likes_count != null ? Number(row.likes_count) : 0,
    isActive: row.is_active == null ? true : Boolean(row.is_active),
    silentChatRequests:
      row.silent_chat_requests == null ? false : Boolean(row.silent_chat_requests),
    verificationStatus: parseVerificationStatus(row.verification_status),
    verificationPhotoFileId: (row.verification_photo_file_id as string | undefined) ?? undefined,
    verifiedAt: (row.verified_at as string | undefined) ?? undefined,
    verificationNote: (row.verification_note as string | undefined) ?? undefined,
    vetCredentialFileId: (row.vet_credential_file_id as string | undefined) ?? undefined,
    vetCredentialStatus: parseVetCredentialStatus(row.vet_credential_status),
    vetOnline: row.vet_online == null ? false : Boolean(row.vet_online),
    readyToAdopt: row.ready_to_adopt == null ? false : Boolean(row.ready_to_adopt),
    /** false = توسط ادمین از لیست پزشک‌ها خارج شده */
    vetEnabled: row.vet_enabled == null ? true : Boolean(row.vet_enabled),
    visitFeeCoins:
      row.visit_fee_coins != null && Number.isFinite(Number(row.visit_fee_coins))
        ? Math.max(1, Math.floor(Number(row.visit_fee_coins)))
        : 1,
    trainerCredentialFileId:
      (row.trainer_credential_file_id as string | undefined) ?? undefined,
    trainerCredentialStatus: parseVetCredentialStatus(row.trainer_credential_status),
    trainerOnline: row.trainer_online == null ? false : Boolean(row.trainer_online),
    trainerEnabled: row.trainer_enabled == null ? true : Boolean(row.trainer_enabled),
    sitterCredentialFileId:
      (row.sitter_credential_file_id as string | undefined) ?? undefined,
    sitterCredentialStatus: parseVetCredentialStatus(row.sitter_credential_status),
    sitterOnline: row.sitter_online == null ? false : Boolean(row.sitter_online),
    sitterEnabled: row.sitter_enabled == null ? true : Boolean(row.sitter_enabled),
    acceptSeekerAdvice:
      row.accept_seeker_advice == null ? false : Boolean(row.accept_seeker_advice),
    lat:
      row.lat != null && Number.isFinite(Number(row.lat)) ? Number(row.lat) : undefined,
    lng:
      row.lng != null && Number.isFinite(Number(row.lng)) ? Number(row.lng) : undefined,
    locationUpdatedAt: (row.location_updated_at as string | undefined) ?? undefined,
    avgRating:
      row.avg_rating != null && Number.isFinite(Number(row.avg_rating))
        ? Math.round(Number(row.avg_rating) * 10) / 10
        : undefined,
    ratingCount: row.rating_count != null ? Number(row.rating_count) : undefined,
    createdAt: row.created_at as string,
  };
}

function parseVerificationStatus(value: unknown): VerificationStatus {
  if (value === 'pending' || value === 'verified' || value === 'rejected' || value === 'none') {
    return value;
  }
  return 'none';
}

function parseVetCredentialStatus(value: unknown): VetCredentialStatus {
  if (value === 'pending' || value === 'verified' || value === 'none') {
    return value;
  }
  return 'none';
}

function parsePhotoModerationStatus(value: unknown): PhotoModerationStatus {
  if (value === 'pending' || value === 'approved' || value === 'rejected') {
    return value;
  }
  return 'approved';
}

function parseConsultServiceKind(value: unknown): ConsultServiceKind {
  if (
    value === 'trainer' ||
    value === 'sitter' ||
    value === 'seeker_advice' ||
    value === 'vet'
  ) {
    return value;
  }
  return 'vet';
}

/** هزینه کل + سهم ارائه‌دهنده برای هر نوع سرویس */
export function consultFeeSplit(kind: ConsultServiceKind): {
  cost: number;
  providerShare: number;
  systemFee: number;
  systemReason: string;
  debitReason: string;
  payoutReason: string;
  payoutRefType: string;
} {
  switch (kind) {
    case 'trainer':
      return {
        cost: TRAINER_CONSULT_COST,
        providerShare: TRAINER_PROVIDER_SHARE,
        systemFee: TRAINER_CONSULT_COST - TRAINER_PROVIDER_SHARE,
        systemReason: SYSTEM_FEE_REASON.trainer,
        debitReason: 'مشاوره مربی',
        payoutReason: 'درآمد مشاوره مربی',
        payoutRefType: 'trainer_consult_payout',
      };
    case 'sitter':
      return {
        cost: SITTER_CONNECT_COST,
        providerShare: SITTER_PROVIDER_SHARE,
        systemFee: SITTER_CONNECT_COST - SITTER_PROVIDER_SHARE,
        systemReason: SYSTEM_FEE_REASON.sitter,
        debitReason: 'اتصال پرستار پت',
        payoutReason: 'درآمد پرستار پت',
        payoutRefType: 'sitter_connect_payout',
      };
    case 'seeker_advice':
      return {
        cost: SEEKER_ADVICE_COST,
        providerShare: SEEKER_OWNER_SHARE,
        systemFee: SEEKER_ADVICE_COST - SEEKER_OWNER_SHARE,
        systemReason: SYSTEM_FEE_REASON.seekerAdvice,
        debitReason: 'مشورت خرید پت',
        payoutReason: 'درآمد مشورت خرید پت',
        payoutRefType: 'seeker_advice_payout',
      };
    default:
      return {
        cost: QUICK_VET_COST,
        providerShare: 0,
        systemFee: 0,
        systemReason: '',
        debitReason: 'مشاوره سریع دامپزشک',
        payoutReason: 'درآمد مشاوره دامپزشک',
        payoutRefType: 'vet_consult_payout',
      };
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function mapPet(row: Record<string, unknown>): PetProfile {
  const distanceKm =
    row.distance_km != null && Number.isFinite(Number(row.distance_km))
      ? Math.round(Number(row.distance_km) * 10) / 10
      : undefined;
  const id = row.id as number;
  return {
    id,
    publicId: petPublicIdOf({ id, publicId: row.public_id as string | undefined }),
    ownerId: row.owner_id as number,
    name: row.name as string,
    species: row.species as string,
    breed: row.breed as string | undefined,
    gender: row.gender as PetGender | undefined,
    ageMonths: row.age_months as number | undefined,
    size: row.size as PetSize | undefined,
    color: row.color as string | undefined,
    bio: row.bio as string | undefined,
    vaccinated: Boolean(row.vaccinated),
    neutered: Boolean(row.neutered),
    lookingForPlaymate: Boolean(row.looking_for_playmate),
    personality: parseJsonObject(row.personality),
    health: parseJsonObject(row.health),
    imageUrl: publicImageUrlForStored(row.image_url as string | undefined, {
      petId: row.id as number,
    }),
    photoModerationStatus: parsePhotoModerationStatus(row.photo_moderation_status),
    city: row.city as string | undefined,
    neighborhood: row.neighborhood as string | undefined,
    ownerProvince: (row.owner_province as string | undefined) ?? undefined,
    ownerCity: (row.owner_city as string | undefined) ?? undefined,
    ownerName: (row.owner_name as string | undefined) ?? undefined,
    ownerVerified: row.owner_verified != null ? Boolean(row.owner_verified) : undefined,
    ownerAvatarUrl: (() => {
      const raw = (row.owner_avatar_url as string | undefined) ?? undefined;
      if (!raw?.trim()) return undefined;
      const status = parsePhotoModerationStatus(
        row.owner_avatar_moderation_status ?? 'approved'
      );
      return status === 'approved' ? raw : undefined;
    })(),
    ownerLastSeenAt:
      (row.owner_location_updated_at as string | undefined) ||
      (row.owner_last_seen_at as string | undefined) ||
      undefined,
    distanceKm,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** فاصله تقریبی دو نقطه روی کره زمین (کیلومتر) — فرمول هاورساین */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapPlaydate(row: Record<string, unknown>): PlaydateRequest {
  const id = row.id as number;
  return {
    id,
    publicId: playdatePublicIdOf({ id, publicId: row.public_id as string | undefined }),
    fromPetId: row.from_pet_id as number,
    toPetId: row.to_pet_id as number,
    fromUserId: row.from_user_id as number,
    toUserId: row.to_user_id == null ? undefined : Number(row.to_user_id),
    message: row.message as string | undefined,
    status: row.status as PlaydateStatus,
    scheduledAt: row.scheduled_at as string | undefined,
    location: row.location as string | undefined,
    chatSecure: Boolean(row.chat_secure),
    chatEnded: Boolean(row.chat_ended),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}


function mediaPlaceholder(kind: PlaydateChatMessage['mediaKind']): string {
  switch (kind) {
    case 'photo':
      return '[تصویر]';
    case 'video':
    case 'animation':
    case 'video_note':
      return '[ویدیو]';
    case 'voice':
      return '[پیام صوتی]';
    case 'audio':
      return '[فایل صوتی]';
    case 'document':
      return '[فایل]';
    case 'sticker':
      return '[استیکر]';
    default:
      return '[رسانه]';
  }
}

function mapPlaydateChatMessage(row: Record<string, unknown>): PlaydateChatMessage {
  return {
    id: row.id as number,
    playdateId: row.playdate_id as number,
    senderUserId: row.sender_user_id as number,
    text: row.text as string,
    mediaKind: (row.media_kind as PlaydateChatMessage['mediaKind']) ?? null,
    telegramFileId: (row.telegram_file_id as string | undefined) ?? null,
    storageKey: (row.storage_key as string | undefined) ?? null,
    mimeType: (row.mime_type as string | undefined) ?? null,
    fileName: (row.file_name as string | undefined) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapPaymentOrder(row: Record<string, unknown>): PaymentOrder {
  const id = row.id as number;
  return {
    id,
    publicId: paymentPublicIdOf({ id, publicId: row.public_id as string | undefined }),
    userId: row.user_id as number,
    packageId: row.package_id as string,
    coins: Number(row.coins),
    amountToman: row.amount_toman != null ? Number(row.amount_toman) : undefined,
    amountStars: row.amount_stars != null ? Number(row.amount_stars) : undefined,
    method: row.method as PaymentMethod,
    status: row.status as PaymentOrderStatus,
    receiptFileId: (row.receipt_file_id as string | undefined) ?? undefined,
    telegramPaymentChargeId: (row.telegram_payment_charge_id as string | undefined) ?? undefined,
    adminNote: (row.admin_note as string | undefined) ?? undefined,
    createdAt: row.created_at as string,
    reviewedAt: (row.reviewed_at as string | undefined) ?? undefined,
    userName: (row.user_name as string | undefined) ?? undefined,
    userTelegramId:
      row.user_telegram_id != null && String(row.user_telegram_id).trim() !== ''
        ? String(row.user_telegram_id).trim()
        : undefined,
    userUsername: (row.user_username as string | undefined) ?? undefined,
    userAvatarUrl: (row.user_avatar_url as string | undefined) ?? undefined,
  };
}

function mapVetConsultChatMessage(row: Record<string, unknown>): VetConsultChatMessage {
  return {
    id: row.id as number,
    consultId: row.consult_id as number,
    senderUserId: row.sender_user_id as number,
    text: row.text as string,
    mediaKind: (row.media_kind as VetConsultChatMessage['mediaKind']) ?? null,
    telegramFileId: (row.telegram_file_id as string | undefined) ?? null,
    storageKey: (row.storage_key as string | undefined) ?? null,
    mimeType: (row.mime_type as string | undefined) ?? null,
    fileName: (row.file_name as string | undefined) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapVetConsultation(row: Record<string, unknown>): VetConsultation {
  const id = row.id as number;
  return {
    id,
    publicId: consultPublicIdOf({ id, publicId: row.public_id as string | undefined }),
    vetUserId: row.vet_user_id as number,
    patientUserId: row.patient_user_id as number,
    petId: row.pet_id != null ? Number(row.pet_id) : undefined,
    serviceKind: parseConsultServiceKind(row.service_kind),
    status: row.status as VetConsultStatus,
    notes: (row.notes as string | undefined) ?? undefined,
    feeCoins:
      row.fee_coins != null && Number.isFinite(Number(row.fee_coins))
        ? Math.max(0, Math.floor(Number(row.fee_coins)))
        : undefined,
    providerShareCoins:
      row.provider_share_coins != null && Number.isFinite(Number(row.provider_share_coins))
        ? Math.max(0, Math.floor(Number(row.provider_share_coins)))
        : undefined,
    vetPaidAt: (row.vet_paid_at as string | undefined) ?? undefined,
    chatSecure: Boolean(row.chat_secure),
    chatEnded: Boolean(row.chat_ended),
    createdAt: row.created_at as string,
    lastActivityAt:
      (row.last_activity_at as string | undefined) ??
      (row.created_at as string | undefined),
    patientName: (row.patient_name as string | undefined) ?? undefined,
    patientCity: (row.patient_city as string | undefined) ?? undefined,
    patientAvatarUrl: (row.patient_avatar_url as string | undefined) ?? undefined,
    vetName: (row.vet_name as string | undefined) ?? undefined,
    vetAvatarUrl: (row.vet_avatar_url as string | undefined) ?? undefined,
    petName: (row.pet_name as string | undefined) ?? undefined,
    petSpecies: (row.pet_species as string | undefined) ?? undefined,
    petBreed: (row.pet_breed as string | undefined) ?? undefined,
    petImageUrl: (row.pet_image_url as string | undefined) ?? undefined,
  };
}

function parseLastSeenMs(lastSeenAt: string | null | undefined): number | null {
  if (!lastSeenAt) return null;
  const raw = lastSeenAt.trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function presenceFromLastSeen(
  userId: number,
  lastSeenAt: string | null | undefined
): { userId: number; lastSeenAt: string | null; online: boolean } {
  const seen = lastSeenAt?.trim() || null;
  const ms = parseLastSeenMs(seen);
  const online = ms != null && Date.now() - ms <= USER_PRESENCE_ONLINE_MS;
  return { userId, lastSeenAt: seen, online };
}

function mapSection(row: Record<string, unknown>): Section {
  const memberCount = db
    .prepare('SELECT COUNT(*) as c FROM users WHERE section_id = ?')
    .get(row.id) as { c: number };
  return {
    id: row.id as number,
    name: row.name as string,
    description: row.description as string | undefined,
    city: row.city as string | undefined,
    memberCount: memberCount.c,
    createdAt: row.created_at as string,
  };
}

function mapGame(row: Record<string, unknown>): Game {
  const players = db
    .prepare('SELECT COUNT(*) as c FROM game_players WHERE game_id = ?')
    .get(row.id) as { c: number };
  const section = row.section_id
    ? (db.prepare('SELECT name FROM sections WHERE id = ?').get(row.section_id) as { name: string } | undefined)
    : undefined;
  const host = db
    .prepare('SELECT name FROM users WHERE id = ?')
    .get(row.host_user_id) as { name: string } | undefined;
  return {
    id: row.id as number,
    title: row.title as string,
    gameType: row.game_type as GameType,
    sectionId: row.section_id as number | undefined,
    sectionName: section?.name,
    hostUserId: row.host_user_id as number,
    hostName: host?.name,
    location: row.location as string,
    scheduledAt: row.scheduled_at as string,
    maxPlayers: row.max_players as number,
    currentPlayers: players.c,
    status: row.status as GameStatus,
    description: row.description as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapCoinSellRequestSummary(row: Record<string, unknown>): CoinSellRequestSummary {
  const statusRaw = String(row.status ?? 'open');
  const status: CoinSellRequestStatus =
    statusRaw === 'paid' || statusRaw === 'rejected' || statusRaw === 'cancelled'
      ? statusRaw
      : 'open';
  return {
    id: Number(row.id),
    coins: Number(row.coins),
    rateToman: Number(row.rate_toman),
    amountToman: Number(row.amount_toman),
    cardMasked: maskCardNumber(String(row.card_number ?? '')),
    status,
    createdAt: String(row.created_at),
    reviewedAt: (row.reviewed_at as string | null | undefined) ?? null,
    adminNote: (row.admin_note as string | null | undefined) ?? null,
  };
}

export const dbService = {
  findOrCreateUser(data: {
    telegramId?: string;
    name: string;
    username?: string;
  }): { user: User; created: boolean } {
    if (data.telegramId) {
      const existing = db
        .prepare('SELECT * FROM users WHERE telegram_id = ?')
        .get(data.telegramId) as Record<string, unknown> | undefined;
      if (existing) {
        if (data.name && existing.name !== data.name) {
          db.prepare('UPDATE users SET name = ?, username = ? WHERE id = ?').run(
            data.name,
            data.username ?? existing.username,
            existing.id
          );
        }
        return {
          user: mapUser(
            (db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(data.telegramId) as Record<
              string,
              unknown
            >) ?? existing
          ),
          created: false,
        };
      }
    }
    const result = db
      .prepare('INSERT INTO users (telegram_id, name, username) VALUES (?, ?, ?)')
      .run(data.telegramId ?? null, data.name, data.username ?? null);
    const newId = Number(result.lastInsertRowid);
    db.prepare('UPDATE users SET public_id = ? WHERE id = ?').run(makeUserPublicId(newId), newId);
    return {
      user: mapUser(
        db.prepare('SELECT * FROM users WHERE id = ?').get(newId) as Record<
          string,
          unknown
        >
      ),
      created: true,
    };
  },

  getUserById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  getUserAiToneJson(userId: number): string | null {
    const row = db
      .prepare('SELECT ai_tone_json FROM users WHERE id = ?')
      .get(userId) as { ai_tone_json?: string | null } | undefined;
    return row?.ai_tone_json ?? null;
  },

  setUserAiToneJson(userId: number, json: string): void {
    db.prepare('UPDATE users SET ai_tone_json = ? WHERE id = ?').run(json, userId);
  },

  getUserByTelegramId(telegramId: string): User | null {
    const row = db
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .get(telegramId) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  setUserSection(userId: number, sectionId: number | null): User | null {
    db.prepare('UPDATE users SET section_id = ? WHERE id = ?').run(sectionId, userId);
    return this.getUserById(userId);
  },

  setUserRole(userId: number, role: UserRole): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const current = existing.roles?.length
      ? existing.roles
      : existing.role
        ? [existing.role]
        : [];
    // سوییچ نقش فعال بدون حذف نقش‌های دیگر
    if (current.includes(role) && current.length > 0) {
      return this.setUserPrimaryRole(userId, role);
    }
    return this.setUserRoles(userId, [role]);
  },

  /** فقط نقش فعال را عوض می‌کند؛ لیست roles حفظ می‌شود */
  setUserPrimaryRole(userId: number, role: UserRole): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const current = existing.roles?.length
      ? existing.roles
      : existing.role
        ? [existing.role]
        : [];
    if (!current.includes(role)) return null;
    const reordered = [role, ...current.filter((r) => r !== role)];
    db.prepare('UPDATE users SET role = ?, roles = ? WHERE id = ?').run(
      role,
      JSON.stringify(reordered),
      userId
    );
    return this.getUserById(userId);
  },

  setUserRoles(userId: number, roles: UserRole[]): User | null {
    const normalized = [...new Set(roles.filter(Boolean))];
    if (normalized.length === 0) return null;
    const existing = this.getUserById(userId);
    const keepPrimary =
      existing?.role && normalized.includes(existing.role) ? existing.role : undefined;
    const primary =
      keepPrimary ?? (normalized.includes('pet_owner') ? 'pet_owner' : normalized[0]!);
    // افزودن/ویرایش نقش نباید آنبوردینگ کامل‌شده را به عقب برگرداند
    const onboarding =
      existing?.onboarding === 'profile_complete' || existing?.onboarding === 'profile_incomplete'
        ? existing.onboarding
        : 'role_selected';
    db.prepare('UPDATE users SET role = ?, roles = ?, onboarding = ? WHERE id = ?').run(
      primary,
      JSON.stringify(normalized),
      onboarding,
      userId
    );
    return this.getUserById(userId);
  },

  setUserOnboarding(userId: number, onboarding: OnboardingStatus): User | null {
    db.prepare('UPDATE users SET onboarding = ? WHERE id = ?').run(onboarding, userId);
    return this.getUserById(userId);
  },

  setUserOnboardingByTelegramId(telegramId: string, onboarding: OnboardingStatus): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setUserOnboarding(user.id, onboarding);
  },

  setUserRoleByTelegramId(telegramId: string, role: UserRole): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setUserRole(user.id, role);
  },

  setUserPrimaryRoleByTelegramId(telegramId: string, role: UserRole): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setUserPrimaryRole(user.id, role);
  },

  setUserRolesByTelegramId(telegramId: string, roles: UserRole[]): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setUserRoles(user.id, roles);
  },

  updateUserProfile(
    userId: number,
    patch: Partial<{
      name: string;
      username: string;
      age: number;
      gender: UserGender;
      country: string;
      city: string;
      province: string;
      phone: string;
      email: string;
      bio: string;
      interests: string[];
      avatarUrl: string;
      avatarCustom: boolean;
      avatarModerationStatus: PhotoModerationStatus;
      coins: number;
      onboarding: OnboardingStatus;
      isActive: boolean;
      silentChatRequests: boolean;
    }>
  ): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
    if (patch.username !== undefined) { fields.push('username = ?'); values.push(patch.username); }
    if (patch.age !== undefined) { fields.push('age = ?'); values.push(patch.age); }
    if (patch.gender !== undefined) { fields.push('gender = ?'); values.push(patch.gender); }
    if (patch.country !== undefined) { fields.push('country = ?'); values.push(patch.country); }
    if (patch.city !== undefined) { fields.push('city = ?'); values.push(patch.city); }
    if (patch.province !== undefined) { fields.push('province = ?'); values.push(patch.province); }
    if (patch.phone !== undefined) {
      fields.push('phone = ?');
      values.push(patch.phone);
      // تغییر شماره بدون OTP → لغو تأیید قبلی
      if (patch.phone !== existing.phone) {
        fields.push('phone_verified = ?');
        values.push(0);
        fields.push('phone_verified_at = ?');
        values.push(null);
      }
    }
    if (patch.email !== undefined) {
      fields.push('email = ?');
      values.push(patch.email);
    }
    if (patch.bio !== undefined) { fields.push('bio = ?'); values.push(patch.bio); }
    if (patch.interests !== undefined) {
      fields.push('interests = ?');
      values.push(JSON.stringify(patch.interests));
    }
    if (patch.avatarUrl !== undefined) {
      fields.push('avatar_url = ?');
      values.push(patch.avatarUrl);
      if (patch.avatarModerationStatus === undefined) {
        // New/changed profile photo must be re-moderated before public display.
        // Callers that only rematerialize storage can pass avatarModerationStatus to keep status.
        if (String(patch.avatarUrl || '').trim()) {
          fields.push("avatar_moderation_status = 'pending'");
        } else {
          fields.push("avatar_moderation_status = 'approved'");
        }
      }
    }
    if (patch.avatarModerationStatus !== undefined) {
      fields.push('avatar_moderation_status = ?');
      values.push(patch.avatarModerationStatus);
    }
    if (patch.avatarCustom !== undefined) {
      fields.push('avatar_custom = ?');
      values.push(patch.avatarCustom ? 1 : 0);
    }
    if (patch.coins !== undefined) { fields.push('coins = ?'); values.push(patch.coins); }
    if (patch.onboarding !== undefined) { fields.push('onboarding = ?'); values.push(patch.onboarding); }
    if (patch.isActive !== undefined) { fields.push('is_active = ?'); values.push(patch.isActive ? 1 : 0); }
    if (patch.silentChatRequests !== undefined) {
      fields.push('silent_chat_requests = ?');
      values.push(patch.silentChatRequests ? 1 : 0);
    }

    if (fields.length === 0) return existing;
    values.push(userId);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    const updated = this.getUserById(userId);
    if (!updated) return null;
    const awards = this.claimProfileSectionRewards(existing, updated);
    if (!awards.length) return updated;
    const fresh = this.getUserById(userId) ?? updated;
    return { ...fresh, awardedRewards: awards };
  },

  updateUserProfileByTelegramId(
    telegramId: string,
    patch: Partial<{
      name: string;
      username: string;
      age: number;
      gender: UserGender;
      country: string;
      city: string;
      province: string;
      phone: string;
      bio: string;
      interests: string[];
      avatarUrl: string;
      avatarCustom: boolean;
      avatarModerationStatus: PhotoModerationStatus;
      coins: number;
      onboarding: OnboardingStatus;
      isActive: boolean;
      silentChatRequests: boolean;
    }>
  ): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.updateUserProfile(user.id, patch);
  },

  setUserActiveByTelegramId(telegramId: string, isActive: boolean): User | null {
    return this.updateUserProfileByTelegramId(telegramId, { isActive });
  },

  /** Soft-delete shell + hard-purge pets/sessions/identity so re-register is clean. */
  deleteUserByTelegramId(telegramId: string): boolean {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return false;
    return this.deleteUserById(user.id);
  },

  /**
   * Account deletion:
   * - Hard-deletes owned pets (and playdates tied to those pets)
   * - Clears web sessions, contacts, blocks, OTPs, attach/login tokens
   * - Ends/removes vet consults involving the user
   * - Zeros wallet/coins and strips email/phone/telegram so merge cannot resurrect data
   * - Leaves an inactive anonymized users row (FK-safe for historic payment rows)
   */
  deleteUserById(userId: number): boolean {
    const user = this.getUserById(userId);
    if (!user) return false;

    const run = db.transaction(() => {
      // 1) Pets first — re-register must not inherit profile pets
      const ownedPets = this.listPets({ ownerId: userId });
      for (const pet of ownedPets) {
        this.deletePet(pet.id, userId);
      }
      // Belt-and-suspenders: listPets/deletePet can miss rows on some PG paths
      try {
        const leftover = db
          .prepare('SELECT id FROM pets WHERE owner_id = ?')
          .all(userId) as { id: number }[];
        for (const row of leftover) {
          db.prepare(
            'DELETE FROM playdate_requests WHERE from_pet_id = ? OR to_pet_id = ?'
          ).run(row.id, row.id);
          try {
            db.prepare('UPDATE vet_consultations SET pet_id = NULL WHERE pet_id = ?').run(row.id);
          } catch {
            /* older schemas */
          }
          db.prepare('DELETE FROM pets WHERE id = ?').run(row.id);
        }
      } catch {
        /* ignore */
      }

      // 2) Playdates still pointing at this user (no owned pets)
      try {
        db.prepare(
          'DELETE FROM playdate_requests WHERE from_user_id = ? OR to_user_id = ?'
        ).run(userId, userId);
      } catch {
        /* older schemas */
      }

      // 3) Vet consults / ratings involving this user
      try {
        const consultIds = (
          db
            .prepare(
              `SELECT id FROM vet_consultations
               WHERE patient_user_id = ? OR vet_user_id = ?`
            )
            .all(userId, userId) as { id: number }[]
        ).map((r) => r.id);
        for (const cid of consultIds) {
          try {
            db.prepare('DELETE FROM vet_ratings WHERE consult_id = ?').run(cid);
          } catch {
            /* ignore */
          }
          try {
            db.prepare('DELETE FROM prescriptions WHERE consult_id = ?').run(cid);
          } catch {
            /* ignore */
          }
          db.prepare('DELETE FROM vet_consultations WHERE id = ?').run(cid);
        }
      } catch {
        /* older schemas */
      }

      // 4) Sessions + social graph + OTP / attach tokens
      this.deleteWebSessionsForUser(userId);
      db.prepare('DELETE FROM phone_otps WHERE user_id = ?').run(userId);
      try {
        db.prepare('DELETE FROM web_otps WHERE user_id = ?').run(userId);
      } catch {
        /* ignore */
      }
      try {
        db.prepare(
          'DELETE FROM user_contacts WHERE user_id = ? OR contact_user_id = ?'
        ).run(userId, userId);
      } catch {
        /* ignore */
      }
      try {
        db.prepare(
          'DELETE FROM user_blocks WHERE user_id = ? OR blocked_user_id = ?'
        ).run(userId, userId);
      } catch {
        /* ignore */
      }
      try {
        db.prepare('DELETE FROM telegram_attach_tokens WHERE user_id = ?').run(userId);
      } catch {
        /* ignore */
      }
      try {
        if (user.telegramId) {
          db.prepare('DELETE FROM telegram_login_pending WHERE telegram_id = ?').run(
            user.telegramId
          );
        }
        db.prepare('DELETE FROM telegram_login_pending WHERE user_id = ?').run(userId);
      } catch {
        /* ignore */
      }
      try {
        db.prepare('DELETE FROM game_players WHERE user_id = ?').run(userId);
      } catch {
        /* ignore */
      }
      try {
        db.prepare(
          `UPDATE coin_sell_requests SET status = 'rejected', reviewed_at = datetime('now'),
             admin_note = COALESCE(admin_note, 'account_deleted')
           WHERE user_id = ? AND status = 'open'`
        ).run(userId);
      } catch {
        /* ignore */
      }

      // 5) Anonymize — clear EVERY mergeable identity field (email was previously left behind)
      db.prepare(
        `UPDATE users SET
           telegram_id = NULL,
           username = NULL,
           name = ?,
           phone = NULL,
           phone_verified = 0,
           phone_verified_at = NULL,
           email = NULL,
           email_verified = 0,
           bio = NULL,
           avatar_url = NULL,
           avatar_custom = 0,
           avatar_moderation_status = 'approved',
           interests = '[]',
           roles = '[]',
           role = NULL,
           coins = 0,
           wallet_ton = 0,
           wallet_stars = 0,
           wallet_toman = 0,
           is_active = 0,
           onboarding = 'role_selected',
           verification_status = 'none',
           verification_photo_file_id = NULL,
           verified_at = NULL,
           verification_note = NULL,
           vet_credential_file_id = NULL,
           vet_credential_status = 'none',
           vet_online = 0
         WHERE id = ?`
      ).run(`[حذف‌شده #${user.id}]`, user.id);
    });

    run();
    return true;
  },

  upsertPhoneOtp(data: {
    userId: number;
    phone: string;
    codeHash: string;
    expiresAt: string;
  }): void {
    db.prepare(
      `INSERT INTO phone_otps (user_id, phone, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         phone = excluded.phone,
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = datetime('now')`
    ).run(data.userId, data.phone, data.codeHash, data.expiresAt);
  },

  getActivePhoneOtp(userId: number): {
    userId: number;
    phone: string;
    codeHash: string;
    expiresAt: string;
    attempts: number;
    createdAt: string;
  } | null {
    const row = db
      .prepare('SELECT * FROM phone_otps WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      userId: row.user_id as number,
      phone: row.phone as string,
      codeHash: row.code_hash as string,
      expiresAt: row.expires_at as string,
      attempts: Number(row.attempts ?? 0),
      createdAt: row.created_at as string,
    };
  },

  bumpPhoneOtpAttempts(userId: number): number {
    db.prepare('UPDATE phone_otps SET attempts = attempts + 1 WHERE user_id = ?').run(userId);
    const row = this.getActivePhoneOtp(userId);
    return row?.attempts ?? 0;
  },

  deletePhoneOtpsForUser(userId: number): void {
    db.prepare('DELETE FROM phone_otps WHERE user_id = ?').run(userId);
  },

  markPhoneVerified(userId: number, phone: string): User | null {
    return this.linkPhoneIdentity(userId, phone);
  },

  listPendingVerifications(): User[] {
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE verification_status = 'pending'
           ORDER BY id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  listPendingVetCredentials(): User[] {
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE vet_credential_status = 'pending'
           ORDER BY id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  /** آرشیو مدارک دامپزشک تأییدشده (فایل مدرک حفظ می‌شود). */
  listVerifiedVetCredentials(): User[] {
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE vet_credential_status = 'verified'
             AND vet_credential_file_id IS NOT NULL
             AND TRIM(vet_credential_file_id) != ''
           ORDER BY id DESC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  submitVetCredential(
    userId: number,
    fileId: string
  ): { ok: true; user: User } | { ok: false; reason: 'missing' | 'no_file' } {
    const existing = this.getUserById(userId);
    if (!existing) return { ok: false, reason: 'missing' };
    const file = fileId?.trim();
    if (!file) return { ok: false, reason: 'no_file' };
    db.prepare(
      `UPDATE users SET
         vet_credential_status = 'pending',
         vet_credential_file_id = ?
       WHERE id = ?`
    ).run(file, userId);
    return { ok: true, user: this.getUserById(userId)! };
  },

  approveVetCredential(userId: number): User | null {
    const existing = this.getUserById(userId);
    if (!existing || existing.vetCredentialStatus !== 'pending') return null;
    db.prepare(`UPDATE users SET vet_credential_status = 'verified' WHERE id = ?`).run(userId);
    return this.getUserById(userId);
  },

  rejectVetCredential(userId: number): User | null {
    const existing = this.getUserById(userId);
    if (!existing || existing.vetCredentialStatus !== 'pending') return null;
    db.prepare(
      `UPDATE users SET
         vet_credential_status = 'none',
         vet_credential_file_id = NULL
       WHERE id = ?`
    ).run(userId);
    return this.getUserById(userId);
  },

  listPendingProviderCredentials(kind: 'trainer' | 'sitter'): User[] {
    const col =
      kind === 'trainer' ? 'trainer_credential_status' : 'sitter_credential_status';
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE ${col} = 'pending'
           ORDER BY id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  /** آرشیو مدارک مربی / پرستار تأییدشده. */
  listVerifiedProviderCredentials(kind: 'trainer' | 'sitter'): User[] {
    const statusCol =
      kind === 'trainer' ? 'trainer_credential_status' : 'sitter_credential_status';
    const fileCol =
      kind === 'trainer' ? 'trainer_credential_file_id' : 'sitter_credential_file_id';
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE ${statusCol} = 'verified'
             AND ${fileCol} IS NOT NULL
             AND TRIM(${fileCol}) != ''
           ORDER BY id DESC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  submitProviderCredential(
    userId: number,
    kind: 'trainer' | 'sitter',
    fileId: string
  ): { ok: true; user: User } | { ok: false; reason: 'missing' | 'no_file' } {
    const existing = this.getUserById(userId);
    if (!existing) return { ok: false, reason: 'missing' };
    const file = fileId?.trim();
    if (!file) return { ok: false, reason: 'no_file' };
    if (kind === 'trainer') {
      db.prepare(
        `UPDATE users SET
           trainer_credential_status = 'pending',
           trainer_credential_file_id = ?
         WHERE id = ?`
      ).run(file, userId);
    } else {
      db.prepare(
        `UPDATE users SET
           sitter_credential_status = 'pending',
           sitter_credential_file_id = ?
         WHERE id = ?`
      ).run(file, userId);
    }
    return { ok: true, user: this.getUserById(userId)! };
  },

  approveProviderCredential(
    userId: number,
    kind: 'trainer' | 'sitter'
  ): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const status =
      kind === 'trainer'
        ? existing.trainerCredentialStatus
        : existing.sitterCredentialStatus;
    if (status !== 'pending') return null;
    const col =
      kind === 'trainer' ? 'trainer_credential_status' : 'sitter_credential_status';
    db.prepare(`UPDATE users SET ${col} = 'verified' WHERE id = ?`).run(userId);
    return this.getUserById(userId);
  },

  rejectProviderCredential(
    userId: number,
    kind: 'trainer' | 'sitter'
  ): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const status =
      kind === 'trainer'
        ? existing.trainerCredentialStatus
        : existing.sitterCredentialStatus;
    if (status !== 'pending') return null;
    if (kind === 'trainer') {
      db.prepare(
        `UPDATE users SET
           trainer_credential_status = 'none',
           trainer_credential_file_id = NULL
         WHERE id = ?`
      ).run(userId);
    } else {
      db.prepare(
        `UPDATE users SET
           sitter_credential_status = 'none',
           sitter_credential_file_id = NULL
         WHERE id = ?`
      ).run(userId);
    }
    return this.getUserById(userId);
  },

  listPendingPetPhotos(): PetProfile[] {
    return (
      db
        .prepare(
          `SELECT pets.*,
                  users.province AS owner_province,
                  users.city AS owner_city,
                  users.name AS owner_name
           FROM pets
           LEFT JOIN users ON users.id = pets.owner_id
           WHERE COALESCE(pets.photo_moderation_status, 'approved') = 'pending'
           ORDER BY pets.id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapPet);
  },

  setPetPhotoModerationStatus(
    petId: number,
    status: PhotoModerationStatus
  ): PetProfile | null {
    const existing = this.getPet(petId);
    if (!existing) return null;
    db.prepare(
      `UPDATE pets SET photo_moderation_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, petId);
    return this.getPet(petId);
  },

  listPendingUserAvatars(): User[] {
    return (
      db
        .prepare(
          `SELECT * FROM users
           WHERE COALESCE(avatar_moderation_status, 'approved') = 'pending'
             AND avatar_url IS NOT NULL
             AND TRIM(avatar_url) != ''
           ORDER BY id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapUser);
  },

  setAvatarModerationStatus(
    userId: number,
    status: PhotoModerationStatus
  ): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    if (status === 'rejected') {
      db.prepare(
        `UPDATE users SET
           avatar_moderation_status = 'rejected',
           avatar_url = NULL,
           avatar_custom = 0
         WHERE id = ?`
      ).run(userId);
    } else {
      db.prepare(`UPDATE users SET avatar_moderation_status = ? WHERE id = ?`).run(
        status,
        userId
      );
    }
    return this.getUserById(userId);
  },

  submitVerification(
    userId: number,
    photoFileId: string
  ): { ok: true; user: User } | { ok: false; reason: 'missing' | 'already_verified' | 'no_photo' } {
    const existing = this.getUserById(userId);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.verificationStatus === 'verified') {
      return { ok: false, reason: 'already_verified' };
    }
    const photo = photoFileId?.trim();
    if (!photo) return { ok: false, reason: 'no_photo' };
    db.prepare(
      `UPDATE users SET
         verification_status = 'pending',
         verification_photo_file_id = ?,
         verification_note = NULL,
         verified_at = NULL
       WHERE id = ?`
    ).run(photo, userId);
    // Keep avatar in sync when submitting profile photo for review
    if (!existing.avatarUrl || existing.avatarUrl !== photo) {
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(photo, userId);
    }
    return { ok: true, user: this.getUserById(userId)! };
  },

  approveVerification(userId: number, rewardCoins = FACE_VERIFY_REWARD): User | null {
    const existing = this.getUserById(userId);
    if (!existing || existing.verificationStatus !== 'pending') return null;
    const reward = Math.max(0, Number.isFinite(rewardCoins) ? rewardCoins : FACE_VERIFY_REWARD);
    const tx = db.transaction(() => {
      const upd = db
        .prepare(
          `UPDATE users SET
             verification_status = 'verified',
             verified_at = datetime('now'),
             verification_note = NULL
           WHERE id = ? AND verification_status = 'pending'`
        )
        .run(userId);
      if (upd.changes === 0) return null;
      const awards: CoinAward[] = [];
      if (reward > 0) {
        const credited = this.creditCoinsOnce(userId, reward, COIN_REASON.faceVerify);
        if (credited.awarded) {
          awards.push({ reason: COIN_REASON.faceVerify, amount: reward });
        }
      }
      const user = this.getUserById(userId);
      if (!user) return null;
      return { ...user, awardedRewards: awards };
    });
    return tx();
  },

  /**
   * دامپزشک‌های واجد شرایط برای اتصال سریع.
   * احراز چهره الزامی نیست.
   * ترجیح: نقش vet + phone_verified؛ اگر هنوز کسی موبایل تأیید نکرده،
   * همهٔ کاربران فعال با نقش vet برمی‌گردند (برای تست/rollout پیامک).
   */
  listVerifiedVets(): User[] {
    const rows = db
      .prepare(
        `SELECT * FROM users
         WHERE is_active = 1
           AND COALESCE(vet_enabled, 1) = 1
           AND COALESCE(vet_online, 0) = 1
           AND (
             role = 'vet'
             OR roles LIKE '%"vet"%'
           )
         ORDER BY
           CASE WHEN COALESCE(phone_verified, 0) = 1 THEN 0 ELSE 1 END,
           id DESC`
      )
      .all() as Record<string, unknown>[];
    const vets = rows
      .map(mapUser)
      .filter((u) => {
        const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
        return roles.includes('vet');
      });
    const phoneOk = vets.filter((v) => Boolean(v.phoneVerified));
    return phoneOk.length > 0 ? phoneOk : vets;
  },

  /**
   * هدف‌های اتصال سریع وب/دسکتاپ:
   * فقط دامپزشک‌هایی که صریحاً آنلاین شده‌اند (vet_online=1) —
   * مدرک تأییدشده + فعال بودن ادمین الزامی است.
   */
  listOnlineVetsForQuickConnect(): User[] {
    const rows = db
      .prepare(
        `SELECT u.*
         FROM users u
         WHERE u.is_active = 1
           AND COALESCE(u.vet_enabled, 1) = 1
           AND COALESCE(u.vet_online, 0) = 1
           AND COALESCE(u.vet_credential_status, 'none') = 'verified'
           AND (
             u.role = 'vet'
             OR u.roles LIKE '%"vet"%'
           )
         ORDER BY
           CASE WHEN COALESCE(u.phone_verified, 0) = 1 THEN 0 ELSE 1 END,
           u.id DESC`
      )
      .all() as Record<string, unknown>[];
    return rows
      .map(mapUser)
      .filter((u) => {
        const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
        return roles.includes('vet') && u.vetCredentialStatus === 'verified';
      });
  },

  /** ارائه‌دهندگان آنلاین تأییدشده برای مربی / پرستار */
  listOnlineProvidersForQuickConnect(kind: 'trainer' | 'sitter'): User[] {
    const role = kind === 'trainer' ? 'trainer' : 'pet_sitter';
    const onlineCol = kind === 'trainer' ? 'trainer_online' : 'sitter_online';
    const enabledCol = kind === 'trainer' ? 'trainer_enabled' : 'sitter_enabled';
    const credCol =
      kind === 'trainer' ? 'trainer_credential_status' : 'sitter_credential_status';
    const rows = db
      .prepare(
        `SELECT u.*
         FROM users u
         WHERE u.is_active = 1
           AND COALESCE(u.${enabledCol}, 1) = 1
           AND COALESCE(u.${onlineCol}, 0) = 1
           AND COALESCE(u.${credCol}, 'none') = 'verified'
           AND (
             u.role = ?
             OR u.roles LIKE ?
           )
         ORDER BY u.id DESC`
      )
      .all(role, `%"${role}"%`) as Record<string, unknown>[];
    return rows
      .map(mapUser)
      .filter((u) => {
        const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
        if (!roles.includes(role)) return false;
        if (kind === 'trainer') return u.trainerCredentialStatus === 'verified';
        return u.sitterCredentialStatus === 'verified';
      });
  },

  /** صاحبان پت که مشورت خرید از دنبال‌کننده را پذیرفته‌اند */
  listOwnersAcceptingSeekerAdvice(): User[] {
    const rows = db
      .prepare(
        `SELECT u.*
         FROM users u
         WHERE u.is_active = 1
           AND COALESCE(u.accept_seeker_advice, 0) = 1
           AND (
             u.role = 'pet_owner'
             OR u.roles LIKE '%"pet_owner"%'
           )
         ORDER BY u.id DESC`
      )
      .all() as Record<string, unknown>[];
    return rows
      .map(mapUser)
      .filter((u) => {
        const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
        return roles.includes('pet_owner') && u.acceptSeekerAdvice === true;
      });
  },

  /** همهٔ کاربران با نقش دامپزشک (فعال و غیرفعال ادمین) */
  listAllVets(): User[] {
    const rows = db
      .prepare(
        `SELECT * FROM users
         WHERE role = 'vet' OR roles LIKE '%"vet"%'
         ORDER BY
           CASE WHEN COALESCE(vet_enabled, 1) = 1 THEN 0 ELSE 1 END,
           id DESC`
      )
      .all() as Record<string, unknown>[];
    return rows
      .map(mapUser)
      .filter((u) => {
        const roles = u.roles?.length ? u.roles : u.role ? [u.role] : [];
        return roles.includes('vet');
      });
  },

  setVetEnabled(userId: number, enabled: boolean): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const roles = existing.roles?.length
      ? existing.roles
      : existing.role
        ? [existing.role]
        : [];
    if (!roles.includes('vet')) return null;

    db.prepare(
      `UPDATE users SET
         vet_enabled = ?,
         vet_online = CASE WHEN ? = 0 THEN 0 ELSE vet_online END
       WHERE id = ?`
    ).run(enabled ? 1 : 0, enabled ? 1 : 0, userId);
    return this.getUserById(userId);
  },

  setVetOnline(userId: number, online: boolean): User | null {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const existing = this.getUserById(id);
    if (!existing) return null;
    if (online && existing.vetEnabled === false) {
      return null;
    }
    // Panel stays inactive until credential is uploaded; receiving requests needs verified.
    if (online) {
      const status = existing.vetCredentialStatus ?? 'none';
      if (status === 'none') return null;
      if (status !== 'verified') return null;
    }
    // Already in the requested state — success (avoids false failures when
    // pg-compat/SQLite reports changes=0 for a no-op UPDATE).
    if (Boolean(existing.vetOnline) === online) {
      return existing;
    }
    db.prepare(`UPDATE users SET vet_online = ? WHERE id = ?`).run(online ? 1 : 0, id);
    const updated = this.getUserById(id);
    if (!updated) return null;
    // Trust read-after-write over changes count (Postgres rowCount can be flaky).
    if (Boolean(updated.vetOnline) !== online) return null;
    return updated;
  },

  setVetOnlineByTelegramId(telegramId: string, online: boolean): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setVetOnline(user.id, online);
  },

  setProviderOnline(
    userId: number,
    kind: 'trainer' | 'sitter',
    online: boolean
  ): User | null {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const existing = this.getUserById(id);
    if (!existing) return null;
    const enabled =
      kind === 'trainer' ? existing.trainerEnabled !== false : existing.sitterEnabled !== false;
    if (online && !enabled) return null;
    const cred =
      kind === 'trainer'
        ? existing.trainerCredentialStatus ?? 'none'
        : existing.sitterCredentialStatus ?? 'none';
    if (online && cred !== 'verified') return null;
    const current =
      kind === 'trainer' ? Boolean(existing.trainerOnline) : Boolean(existing.sitterOnline);
    if (current === online) return existing;
    const col = kind === 'trainer' ? 'trainer_online' : 'sitter_online';
    db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(online ? 1 : 0, id);
    const updated = this.getUserById(id);
    if (!updated) return null;
    const next =
      kind === 'trainer' ? Boolean(updated.trainerOnline) : Boolean(updated.sitterOnline);
    if (next !== online) return null;
    return updated;
  },

  setAcceptSeekerAdvice(userId: number, accept: boolean): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    if (Boolean(existing.acceptSeekerAdvice) === accept) return existing;
    db.prepare(`UPDATE users SET accept_seeker_advice = ? WHERE id = ?`).run(
      accept ? 1 : 0,
      userId
    );
    return this.getUserById(userId);
  },

  setReadyToAdopt(userId: number, ready: boolean): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const result = db
      .prepare(`UPDATE users SET ready_to_adopt = ? WHERE id = ?`)
      .run(ready ? 1 : 0, userId);
    if (result.changes === 0) return null;
    return this.getUserById(userId);
  },

  setReadyToAdoptByTelegramId(telegramId: string, ready: boolean): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setReadyToAdopt(user.id, ready);
  },

  setVisitFeeCoins(userId: number, feeCoins: number): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    const fee = Math.min(500, Math.max(1, Math.floor(Number(feeCoins) || 1)));
    db.prepare(`UPDATE users SET visit_fee_coins = ? WHERE id = ?`).run(fee, userId);
    return this.getUserById(userId);
  },

  setVisitFeeCoinsByTelegramId(telegramId: string, feeCoins: number): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setVisitFeeCoins(user.id, feeCoins);
  },

  listPreviousVetsForPatient(patientUserId: number): PreviousVet[] {
    const rows = db
      .prepare(
        `SELECT
           u.id AS id,
           u.name AS name,
           u.city AS city,
           u.telegram_id AS telegram_id,
           MAX(vc.created_at) AS last_consult_at,
           (
             SELECT ROUND(AVG(vr.rating) * 10) / 10
             FROM vet_ratings vr
             WHERE vr.vet_user_id = vc.vet_user_id
           ) AS avg_rating,
           (
             SELECT COUNT(*)
             FROM vet_ratings vr
             WHERE vr.vet_user_id = vc.vet_user_id
           ) AS rating_count
         FROM vet_consultations vc
         INNER JOIN users u ON u.id = vc.vet_user_id
         WHERE vc.patient_user_id = ?
         GROUP BY vc.vet_user_id
         ORDER BY last_consult_at DESC, vc.vet_user_id DESC`
      )
      .all(patientUserId) as Record<string, unknown>[];
    return rows.map((row) => {
      const ratingCount = Number(row.rating_count ?? 0);
      return {
        id: Number(row.id),
        name: String(row.name ?? 'دامپزشک'),
        city: (row.city as string | undefined) ?? undefined,
        telegramId: (row.telegram_id as string | undefined) ?? undefined,
        lastConsultAt: String(row.last_consult_at ?? ''),
        avgRating:
          ratingCount > 0 && row.avg_rating != null
            ? Number(row.avg_rating)
            : undefined,
        ratingCount: ratingCount > 0 ? ratingCount : undefined,
      };
    });
  },

  getVetRatingByConsultId(consultId: number): VetRating | null {
    const row = db
      .prepare(`SELECT * FROM vet_ratings WHERE consult_id = ?`)
      .get(consultId) as Record<string, unknown> | undefined;
    return row ? mapVetRating(row) : null;
  },

  getVetRatingStats(vetUserId: number): VetRatingStats {
    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS rating_count,
           AVG(rating) AS avg_rating
         FROM vet_ratings
         WHERE vet_user_id = ?`
      )
      .get(vetUserId) as { rating_count?: number; avg_rating?: number } | undefined;
    const ratingCount = Number(row?.rating_count ?? 0);
    const avg =
      ratingCount > 0 && row?.avg_rating != null ? Number(row.avg_rating) : 0;
    return {
      vetUserId,
      avgRating: ratingCount > 0 ? Math.round(avg * 10) / 10 : 0,
      ratingCount,
    };
  },

  upsertVetRating(input: {
    consultId: number;
    patientUserId: number;
    rating: number;
    comment?: string;
  }):
    | { ok: true; rating: VetRating; created: boolean }
    | { ok: false; reason: 'missing_consult' | 'forbidden' | 'invalid_rating' } {
    const rating = Math.floor(Number(input.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return { ok: false, reason: 'invalid_rating' };
    }
    const consult = this.getVetConsultation(input.consultId);
    if (!consult) return { ok: false, reason: 'missing_consult' };
    if (consult.patientUserId !== input.patientUserId) {
      return { ok: false, reason: 'forbidden' };
    }

    const existing = this.getVetRatingByConsultId(input.consultId);
    if (existing) {
      const comment =
        typeof input.comment === 'string' && input.comment.trim()
          ? input.comment.trim().slice(0, 500)
          : existing.comment;
      if (comment && comment !== existing.comment) {
        db.prepare(`UPDATE vet_ratings SET comment = ? WHERE id = ?`).run(
          comment,
          existing.id
        );
        return {
          ok: true,
          rating: this.getVetRatingByConsultId(input.consultId)!,
          created: false,
        };
      }
      return { ok: true, rating: existing, created: false };
    }

    const comment =
      typeof input.comment === 'string' && input.comment.trim()
        ? input.comment.trim().slice(0, 500)
        : null;
    const result = db
      .prepare(
        `INSERT INTO vet_ratings (
          consult_id, vet_user_id, patient_user_id, rating, comment
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.consultId,
        consult.vetUserId,
        input.patientUserId,
        rating,
        comment
      );
    const row = db
      .prepare(`SELECT * FROM vet_ratings WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
    return { ok: true, rating: mapVetRating(row), created: true };
  },
  /** کم کردن سکه اتمیک؛ اگر موجودی کافی نباشد null */
  debitCoins(userId: number, amount: number, meta?: WalletLedgerMeta): User | null {
    if (amount <= 0) return this.getUserById(userId);
    const result = db
      .prepare(
        `UPDATE users SET coins = coins - ?
         WHERE id = ? AND COALESCE(coins, 0) >= ?`
      )
      .run(amount, userId, amount);
    if (result.changes === 0) return null;
    if (!meta?.skipLedger) {
      this.appendWalletLedger({
        userId,
        currency: 'coins',
        amount,
        direction: 'debit',
        reason: meta?.reason ?? 'کسر سکه',
        refType: meta?.refType,
        refId: meta?.refId,
      });
    }
    return this.getUserById(userId);
  },

  appendWalletLedger(input: {
    userId: number | null;
    currency: WalletCurrency;
    amount: number;
    direction: WalletLedgerDirection;
    reason: string;
    refType?: string | null;
    refId?: string | number | null;
  }): void {
    const amount = Math.floor(Math.abs(Number(input.amount)));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const direction = input.direction === 'debit' ? 'debit' : 'credit';
    const reason = walletLedgerLabelFa(input.reason);
    const refId =
      input.refId == null || input.refId === ''
        ? null
        : String(input.refId);
    db.prepare(
      `INSERT INTO wallet_ledger (user_id, currency, amount, direction, reason, ref_type, ref_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.userId,
      input.currency,
      amount,
      direction,
      reason,
      input.refType ?? null,
      refId
    );
  },

  listUserWalletTransactions(
    userId: number,
    opts?: { limit?: number; offset?: number }
  ): WalletTransaction[] {
    const limit = Math.min(100, Math.max(1, Math.floor(Number(opts?.limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(opts?.offset) || 0));
    const rows = db
      .prepare(
        `SELECT id, currency, amount, direction, reason, ref_type, ref_id, created_at
         FROM wallet_ledger
         WHERE user_id = ?
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, limit, offset) as Array<{
      id: number;
      currency: string;
      amount: number;
      direction: string;
      reason: string;
      ref_type: string | null;
      ref_id: string | null;
      created_at: string;
    }>;

    return rows.map((row) => {
      const currency = (
        row.currency === 'ton' ||
        row.currency === 'stars' ||
        row.currency === 'coins' ||
        row.currency === 'toman'
          ? row.currency
          : 'coins'
      ) as WalletCurrency;
      const direction: WalletLedgerDirection =
        row.direction === 'debit' ? 'debit' : 'credit';
      const amount = Math.abs(Number(row.amount) || 0);
      const reason = String(row.reason || '');
      return {
        id: Number(row.id),
        currency,
        amount,
        direction,
        reason,
        labelFa: walletLedgerLabelFa(reason),
        refType: row.ref_type != null ? String(row.ref_type) : null,
        refId: row.ref_id != null ? String(row.ref_id) : null,
        createdAt: String(row.created_at),
        delta: direction === 'debit' ? -amount : amount,
      };
    });
  },

  /** کم کردن ستاره کیف پول (wallet_stars) اتمیک؛ اگر موجودی کافی نباشد null */
  debitStars(userId: number, amount: number, meta?: WalletLedgerMeta): User | null {
    if (amount <= 0) return this.getUserById(userId);
    const result = db
      .prepare(
        `UPDATE users SET wallet_stars = wallet_stars - ?
         WHERE id = ? AND COALESCE(wallet_stars, 0) >= ?`
      )
      .run(amount, userId, amount);
    if (result.changes === 0) return null;
    if (!meta?.skipLedger) {
      this.appendWalletLedger({
        userId,
        currency: 'stars',
        amount,
        direction: 'debit',
        reason: meta?.reason ?? 'کسر ستاره',
        refType: meta?.refType,
        refId: meta?.refId,
      });
    }
    return this.getUserById(userId);
  },

  creditCoins(
    userId: number,
    amount: number,
    reason?: string,
    meta?: WalletLedgerMeta
  ): User | null {
    if (amount <= 0) return this.getUserById(userId);
    if (reason) {
      const once = this.creditCoinsOnce(userId, amount, reason);
      return once.user;
    }
    db.prepare(`UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?`).run(amount, userId);
    if (!meta?.skipLedger) {
      this.appendWalletLedger({
        userId,
        currency: 'coins',
        amount,
        direction: 'credit',
        reason: meta?.reason ?? 'واریز سکه',
        refType: meta?.refType,
        refId: meta?.refId,
      });
    }
    return this.getUserById(userId);
  },

  /** موجودی کیف پول چندارزی (سکه = users.coins) */
  getWallet(userId: number) {
    const user = this.getUserById(userId);
    if (!user) return null;
    return user.wallet ?? walletFromUserFields(user);
  },

  getTelegramBusinessConnection(userId: number): {
    connectionId: string | null;
    isEnabled: boolean;
    canViewStars: boolean;
    cachedStars: number | null;
    syncedAt: string | null;
  } | null {
    const row = db
      .prepare(
        `SELECT tg_business_connection_id, tg_business_enabled, tg_business_can_view_stars,
                tg_stars_cached, tg_stars_synced_at
         FROM users WHERE id = ?`
      )
      .get(userId) as
      | {
          tg_business_connection_id: string | null;
          tg_business_enabled: number | null;
          tg_business_can_view_stars: number | null;
          tg_stars_cached: number | null;
          tg_stars_synced_at: string | null;
        }
      | undefined;
    if (!row) return null;
    const connectionId =
      row.tg_business_connection_id != null && String(row.tg_business_connection_id).trim()
        ? String(row.tg_business_connection_id).trim()
        : null;
    return {
      connectionId,
      isEnabled: Boolean(row.tg_business_enabled),
      canViewStars: Boolean(row.tg_business_can_view_stars),
      cachedStars:
        row.tg_stars_cached != null && Number.isFinite(Number(row.tg_stars_cached))
          ? Math.floor(Number(row.tg_stars_cached))
          : null,
      syncedAt: row.tg_stars_synced_at ? String(row.tg_stars_synced_at) : null,
    };
  },

  upsertTelegramBusinessConnection(input: {
    telegramId: string;
    connectionId: string;
    isEnabled: boolean;
    canViewStars: boolean;
  }): { ok: true; userId: number } | { ok: false; reason: 'user_missing' } {
    const user = this.getUserByTelegramId(String(input.telegramId));
    if (!user) return { ok: false, reason: 'user_missing' };
    db.prepare(
      `UPDATE users SET
         tg_business_connection_id = ?,
         tg_business_enabled = ?,
         tg_business_can_view_stars = ?
       WHERE id = ?`
    ).run(
      String(input.connectionId).trim(),
      input.isEnabled ? 1 : 0,
      input.canViewStars ? 1 : 0,
      user.id
    );
    return { ok: true, userId: user.id };
  },

  cacheTelegramAccountStars(userId: number, amount: number): void {
    const safe = Math.floor(Number(amount));
    if (!Number.isFinite(safe)) return;
    db.prepare(
      `UPDATE users SET tg_stars_cached = ?, tg_stars_synced_at = datetime('now') WHERE id = ?`
    ).run(safe, userId);
  },

  /**
   * افزایش/کاهش موجودی یک ارز کیف پول.
   * coins → ستون coins؛ بقیه → wallet_*
   */
  creditWallet(
    userId: number,
    currency: WalletCurrency,
    amount: number,
    meta?: WalletLedgerMeta
  ): { ok: true; user: User } | { ok: false; reason: 'missing_user' | 'bad_amount' } {
    const safe = Math.floor(Number(amount));
    if (!Number.isFinite(safe) || safe === 0) {
      return { ok: false, reason: 'bad_amount' };
    }
    if (!this.getUserById(userId)) return { ok: false, reason: 'missing_user' };

    const defaultReason =
      safe > 0 ? 'واریز ادمین' : 'برداشت ادمین';
    const ledgerMeta: WalletLedgerMeta = {
      reason: meta?.reason ?? defaultReason,
      refType: meta?.refType ?? 'admin',
      refId: meta?.refId,
      skipLedger: meta?.skipLedger,
    };

    if (currency === 'coins') {
      if (safe > 0) {
        db.prepare(`UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?`).run(safe, userId);
        if (!ledgerMeta.skipLedger) {
          this.appendWalletLedger({
            userId,
            currency: 'coins',
            amount: safe,
            direction: 'credit',
            reason: ledgerMeta.reason!,
            refType: ledgerMeta.refType,
            refId: ledgerMeta.refId,
          });
        }
      } else {
        const debited = this.debitCoins(userId, Math.abs(safe), ledgerMeta);
        if (!debited) return { ok: false, reason: 'bad_amount' };
      }
      return { ok: true, user: this.getUserById(userId)! };
    }

    if (currency === 'stars') {
      if (safe > 0) {
        db.prepare(`UPDATE users SET wallet_stars = COALESCE(wallet_stars, 0) + ? WHERE id = ?`).run(
          safe,
          userId
        );
        if (!ledgerMeta.skipLedger) {
          this.appendWalletLedger({
            userId,
            currency: 'stars',
            amount: safe,
            direction: 'credit',
            reason: ledgerMeta.reason!,
            refType: ledgerMeta.refType,
            refId: ledgerMeta.refId,
          });
        }
      } else {
        const debited = this.debitStars(userId, Math.abs(safe), ledgerMeta);
        if (!debited) return { ok: false, reason: 'bad_amount' };
      }
      return { ok: true, user: this.getUserById(userId)! };
    }

    const col = currency === 'ton' ? 'wallet_ton' : 'wallet_toman';
    if (safe > 0) {
      db.prepare(`UPDATE users SET ${col} = COALESCE(${col}, 0) + ? WHERE id = ?`).run(safe, userId);
      if (!ledgerMeta.skipLedger) {
        this.appendWalletLedger({
          userId,
          currency,
          amount: safe,
          direction: 'credit',
          reason: ledgerMeta.reason!,
          refType: ledgerMeta.refType,
          refId: ledgerMeta.refId,
        });
      }
    } else {
      const abs = Math.abs(safe);
      const result = db
        .prepare(
          `UPDATE users SET ${col} = ${col} - ?
           WHERE id = ? AND COALESCE(${col}, 0) >= ?`
        )
        .run(abs, userId, abs);
      if (result.changes === 0) return { ok: false, reason: 'bad_amount' };
      if (!ledgerMeta.skipLedger) {
        this.appendWalletLedger({
          userId,
          currency,
          amount: abs,
          direction: 'debit',
          reason: ledgerMeta.reason!,
          refType: ledgerMeta.refType,
          refId: ledgerMeta.refId,
        });
      }
    }
    return { ok: true, user: this.getUserById(userId)! };
  },

  /**
   * واریز idempotent با کلید یکتا در coin_ledger.
   * اگر reason قبلاً ثبت شده باشد، سکه اضافه نمی‌شود.
   */
  creditCoinsOnce(
    userId: number,
    amount: number,
    reason: string
  ): { awarded: boolean; user: User | null; amount: number } {
    const user = this.getUserById(userId);
    if (!user) return { awarded: false, user: null, amount: 0 };
    const safeAmount = Math.floor(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0 || !reason.trim()) {
      return { awarded: false, user, amount: 0 };
    }
    const insert = db
      .prepare(
        `INSERT OR IGNORE INTO coin_ledger (user_id, reason, amount) VALUES (?, ?, ?)`
      )
      .run(userId, reason.trim(), safeAmount);
    if (insert.changes === 0) {
      return { awarded: false, user, amount: 0 };
    }
    db.prepare(`UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?`).run(
      safeAmount,
      userId
    );
    this.appendWalletLedger({
      userId,
      currency: 'coins',
      amount: safeAmount,
      direction: 'credit',
      reason: reason.trim(),
      refType: 'coin_ledger',
      refId: reason.trim(),
    });
    if (reason.trim() === COIN_REASON.signup) {
      db.prepare('UPDATE users SET signup_bonus_claimed = 1 WHERE id = ?').run(userId);
    }
    if (reason.trim().startsWith('profile:')) {
      const section = reason.trim().slice('profile:'.length);
      const rewards = new Set(user.profileRewards ?? []);
      rewards.add(section);
      db.prepare('UPDATE users SET profile_rewards = ? WHERE id = ?').run(
        JSON.stringify([...rewards]),
        userId
      );
    }
    return { awarded: true, user: this.getUserById(userId), amount: safeAmount };
  },

  claimSignupBonus(userId: number): { awarded: boolean; user: User | null; award?: CoinAward } {
    const result = this.creditCoinsOnce(userId, SIGNUP_BONUS, COIN_REASON.signup);
    if (!result.awarded || !result.user) {
      return { awarded: false, user: result.user };
    }
    return {
      awarded: true,
      user: result.user,
      award: { reason: COIN_REASON.signup, amount: SIGNUP_BONUS },
    };
  },

  /**
   * جایزه دعوت: به معرف واریز می‌شود وقتی کاربر جدید از لینک ref_ ثبت‌نام کند.
   * یک‌بار برای هر دعوت‌شده (coin_ledger + referred_by).
   */
  applyReferralBonus(
    invitedUserId: number,
    referrerId: number
  ): {
    awarded: boolean;
    referrer: User | null;
    invited: User | null;
    award?: CoinAward;
    reason?: 'missing' | 'self' | 'already' | 'referrer_missing';
  } {
    const invited = this.getUserById(invitedUserId);
    if (!invited) {
      return { awarded: false, referrer: null, invited: null, reason: 'missing' };
    }
    if (!Number.isFinite(referrerId) || referrerId <= 0 || referrerId === invitedUserId) {
      return { awarded: false, referrer: null, invited, reason: 'self' };
    }
    if (invited.referredBy != null) {
      return {
        awarded: false,
        referrer: this.getUserById(referrerId),
        invited,
        reason: 'already',
      };
    }
    const referrer = this.getUserById(referrerId);
    if (!referrer) {
      return { awarded: false, referrer: null, invited, reason: 'referrer_missing' };
    }

    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL').run(
        referrerId,
        invitedUserId
      );
      const after = this.getUserById(invitedUserId);
      if (!after || after.referredBy !== referrerId) {
        return {
          awarded: false as const,
          referrer,
          invited: after ?? invited,
          reason: 'already' as const,
        };
      }
      const credited = this.creditCoinsOnce(
        referrerId,
        REFERRAL_BONUS_COINS,
        COIN_REASON.referral(invitedUserId)
      );
      return {
        awarded: credited.awarded,
        referrer: credited.user,
        invited: after,
        award: credited.awarded
          ? ({ reason: COIN_REASON.referral(invitedUserId), amount: REFERRAL_BONUS_COINS } as CoinAward)
          : undefined,
        reason: credited.awarded ? undefined : ('already' as const),
      };
    });
    return tx();
  },

  /** جایزه بخش‌هایی که تازه از خالی → پر شده‌اند */
  claimProfileSectionRewards(before: User, after: User): CoinAward[] {
    const awards: CoinAward[] = [];
    const claimed = new Set(after.profileRewards ?? before.profileRewards ?? []);
    for (const section of PROFILE_REWARD_SECTIONS) {
      if (claimed.has(section)) continue;
      const wasEmpty = !isProfileSectionFilled(section, before);
      const nowFilled = isProfileSectionFilled(section, after);
      if (!wasEmpty || !nowFilled) continue;
      const result = this.creditCoinsOnce(
        after.id,
        PROFILE_SECTION_REWARD,
        COIN_REASON.profile(section)
      );
      if (result.awarded) {
        awards.push({
          reason: COIN_REASON.profile(section),
          amount: PROFILE_SECTION_REWARD,
          section,
        });
        claimed.add(section);
      }
    }
    return awards;
  },

  rejectVerification(userId: number, note?: string): User | null {
    const existing = this.getUserById(userId);
    if (!existing || existing.verificationStatus !== 'pending') return null;
    db.prepare(
      `UPDATE users SET
         verification_status = 'rejected',
         verified_at = NULL,
         verification_note = ?
       WHERE id = ?`
    ).run(note?.trim() || null, userId);
    return this.getUserById(userId);
  },

  /** Admin override — set verification status without pending-only gate. */
  setVerificationStatusAdmin(userId: number, status: VerificationStatus): User | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    if (status === 'verified') {
      db.prepare(
        `UPDATE users SET
           verification_status = 'verified',
           verified_at = COALESCE(verified_at, datetime('now')),
           verification_note = NULL
         WHERE id = ?`
      ).run(userId);
    } else if (status === 'pending') {
      db.prepare(
        `UPDATE users SET
           verification_status = 'pending',
           verified_at = NULL,
           verification_note = NULL
         WHERE id = ?`
      ).run(userId);
    } else if (status === 'rejected') {
      db.prepare(
        `UPDATE users SET
           verification_status = 'rejected',
           verified_at = NULL
         WHERE id = ?`
      ).run(userId);
    } else {
      db.prepare(
        `UPDATE users SET
           verification_status = 'none',
           verified_at = NULL,
           verification_note = NULL,
           verification_photo_file_id = NULL
         WHERE id = ?`
      ).run(userId);
    }
    return this.getUserById(userId);
  },

  listSections(): Section[] {
    return (db.prepare('SELECT * FROM sections ORDER BY name').all() as Record<string, unknown>[]).map(
      mapSection
    );
  },

  getSection(id: number): Section | null {
    const row = db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapSection(row) : null;
  },

  createSection(data: { name: string; description?: string; city?: string }): Section {
    const result = db
      .prepare('INSERT INTO sections (name, description, city) VALUES (?, ?, ?)')
      .run(data.name, data.description ?? null, data.city ?? null);
    return mapSection(
      db.prepare('SELECT * FROM sections WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>
    );
  },

  listGames(filters?: { sectionId?: number; status?: GameStatus; gameType?: GameType }): Game[] {
    let sql = `
      SELECT g.* FROM games g
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.sectionId) {
      sql += ' AND g.section_id = ?';
      params.push(filters.sectionId);
    }
    if (filters?.status) {
      sql += ' AND g.status = ?';
      params.push(filters.status);
    }
    if (filters?.gameType) {
      sql += ' AND g.game_type = ?';
      params.push(filters.gameType);
    }

    sql += ' ORDER BY g.scheduled_at ASC';
    return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapGame);
  },

  getGame(id: number): Game | null {
    const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapGame(row) : null;
  },

  createGame(data: {
    title: string;
    gameType: GameType;
    sectionId?: number;
    hostUserId: number;
    location: string;
    scheduledAt: string;
    maxPlayers: number;
    description?: string;
  }): Game {
    const result = db
      .prepare(
        `INSERT INTO games (title, game_type, section_id, host_user_id, location, scheduled_at, max_players, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.title,
        data.gameType,
        data.sectionId ?? null,
        data.hostUserId,
        data.location,
        data.scheduledAt,
        data.maxPlayers,
        data.description ?? null
      );
    const gameId = result.lastInsertRowid as number;
    db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)').run(gameId, data.hostUserId);
    return mapGame(db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as Record<string, unknown>);
  },

  joinGame(gameId: number, userId: number): { game: Game; error?: string } {
    const game = this.getGame(gameId);
    if (!game) return { game: game!, error: 'بازی پیدا نشد' };
    if (game.status !== 'open') return { game, error: 'این بازی دیگر باز نیست' };
    if (game.currentPlayers >= game.maxPlayers) return { game, error: 'ظرفیت بازی تکمیل شده' };

    const existing = db
      .prepare('SELECT id FROM game_players WHERE game_id = ? AND user_id = ?')
      .get(gameId, userId);
    if (existing) return { game, error: 'شما قبلاً عضو این بازی هستید' };

    db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)').run(gameId, userId);
    const updated = this.getGame(gameId)!;
    if (updated.currentPlayers >= updated.maxPlayers) {
      db.prepare("UPDATE games SET status = 'full' WHERE id = ?").run(gameId);
    }
    return { game: this.getGame(gameId)! };
  },

  getGamePlayers(gameId: number): GamePlayer[] {
    const rows = db
      .prepare(
        `SELECT gp.*, u.name as user_name FROM game_players gp
         JOIN users u ON u.id = gp.user_id
         WHERE gp.game_id = ?
         ORDER BY gp.joined_at`
      )
      .all(gameId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as number,
      gameId: row.game_id as number,
      userId: row.user_id as number,
      userName: row.user_name as string,
      joinedAt: row.joined_at as string,
    }));
  },

  listPets(filters?: {
    ownerId?: number;
    lookingForPlaymate?: boolean;
    species?: string;
    city?: string;
    province?: string;
    breed?: string;
    /** چند نژاد (هم‌نژاد با پت‌های کاربر) */
    breeds?: string[];
    excludeOwnerId?: number;
    /** newest = جدیدترین؛ popular = لایک صاحب؛ پیش‌فرض updated */
    sort?: 'newest' | 'popular' | 'updated';
    /** وقتی true فقط عکس‌های تأییدشده (لیست عمومی) */
    publicOnly?: boolean;
  }): PetProfile[] {
    let sql = `
      SELECT pets.*,
             users.province AS owner_province,
             users.city AS owner_city,
             users.name AS owner_name,
             users.likes_count AS owner_likes_count,
             CASE WHEN users.verification_status = 'verified' THEN 1 ELSE 0 END AS owner_verified
      FROM pets
      LEFT JOIN users ON users.id = pets.owner_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (filters?.ownerId) {
      sql += ' AND pets.owner_id = ?';
      params.push(filters.ownerId);
    }
    if (filters?.excludeOwnerId) {
      sql += ' AND pets.owner_id != ?';
      params.push(filters.excludeOwnerId);
    }
    if (filters?.publicOnly) {
      sql += " AND COALESCE(pets.photo_moderation_status, 'approved') = 'approved'";
    }
    if (filters?.lookingForPlaymate !== undefined) {
      sql += ' AND pets.looking_for_playmate = ?';
      params.push(filters.lookingForPlaymate ? 1 : 0);
    }
    if (filters?.species) {
      sql += ' AND pets.species = ?';
      params.push(filters.species);
    }
    if (filters?.city) {
      sql +=
        " AND (LOWER(TRIM(COALESCE(pets.city, ''))) = LOWER(TRIM(?)) OR LOWER(TRIM(COALESCE(users.city, ''))) = LOWER(TRIM(?)))";
      params.push(filters.city, filters.city);
    }
    if (filters?.province) {
      sql += " AND LOWER(TRIM(COALESCE(users.province, ''))) = LOWER(TRIM(?))";
      params.push(filters.province);
    }
    if (filters?.breed) {
      sql += " AND LOWER(TRIM(COALESCE(pets.breed, ''))) = LOWER(TRIM(?))";
      params.push(filters.breed);
    }
    const breeds = (filters?.breeds ?? [])
      .map((b) => String(b ?? '').trim())
      .filter((b) => b.length > 0);
    if (breeds.length > 0) {
      const placeholders = breeds.map(() => '?').join(', ');
      sql += ` AND LOWER(TRIM(COALESCE(pets.breed, ''))) IN (${placeholders})`;
      for (const b of breeds) params.push(b.toLowerCase());
    }
    const sort = filters?.sort ?? 'updated';
    if (sort === 'newest') {
      sql += ' ORDER BY pets.created_at DESC';
    } else if (sort === 'popular') {
      sql += ' ORDER BY COALESCE(users.likes_count, 0) DESC, pets.created_at DESC';
    } else {
      sql += ' ORDER BY pets.updated_at DESC';
    }
    return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapPet);
  },

  /**
   * پت‌های نزدیک بر اساس lat/lng صاحب‌ها.
   * اگر radiusKm داده شود فقط داخل همان شعاع؛ وگرنه نزدیک‌ترین‌ها تا limit.
   */
  listNearbyPets(opts: {
    lat: number;
    lng: number;
    excludeOwnerId?: number;
    limit?: number;
    radiusKm?: number;
  }): PetProfile[] {
    const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? 30)), 80);
    const radiusKm =
      opts.radiusKm != null && Number.isFinite(opts.radiusKm) && opts.radiusKm > 0
        ? opts.radiusKm
        : undefined;
    let sql = `
      SELECT pets.*,
             users.province AS owner_province,
             users.city AS owner_city,
             users.name AS owner_name,
             users.avatar_url AS owner_avatar_url,
             users.avatar_moderation_status AS owner_avatar_moderation_status,
             users.lat AS owner_lat,
             users.lng AS owner_lng,
             users.location_updated_at AS owner_location_updated_at,
             users.last_seen_at AS owner_last_seen_at,
             CASE WHEN users.verification_status = 'verified' THEN 1 ELSE 0 END AS owner_verified
      FROM pets
      INNER JOIN users ON users.id = pets.owner_id
      WHERE users.lat IS NOT NULL
        AND users.lng IS NOT NULL
        AND COALESCE(users.is_active, 1) = 1
        AND COALESCE(pets.photo_moderation_status, 'approved') = 'approved'`;
    const params: unknown[] = [];
    if (opts.excludeOwnerId) {
      sql += ' AND pets.owner_id != ?';
      params.push(opts.excludeOwnerId);
    }
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const scored = rows
      .map((row) => {
        const oLat = Number(row.owner_lat);
        const oLng = Number(row.owner_lng);
        if (!Number.isFinite(oLat) || !Number.isFinite(oLng)) return null;
        const distanceKm = haversineKm(opts.lat, opts.lng, oLat, oLng);
        if (radiusKm != null && distanceKm > radiusKm) return null;
        return { ...row, distance_km: distanceKm };
      })
      .filter((r): r is Record<string, unknown> & { distance_km: number } => r != null)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return scored.map(mapPet);
  },

  /** ذخیره موقعیت GPS کاربر (از دکمه ارسال موقعیت ربات) */
  setUserLocation(userId: number, lat: number, lng: number): User | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const existing = this.getUserById(userId);
    if (!existing) return null;
    db.prepare(
      `UPDATE users
       SET lat = ?, lng = ?, location_updated_at = datetime('now')
       WHERE id = ?`
    ).run(lat, lng, userId);
    return this.getUserById(userId);
  },

  setUserLocationByTelegramId(telegramId: string, lat: number, lng: number): User | null {
    const user = this.getUserByTelegramId(telegramId);
    if (!user) return null;
    return this.setUserLocation(user.id, lat, lng);
  },

  getPet(id: number): PetProfile | null {
    const row = db
      .prepare(
        `SELECT pets.*,
                users.province AS owner_province,
                users.city AS owner_city,
                users.name AS owner_name,
                users.avatar_url AS owner_avatar_url,
                users.avatar_moderation_status AS owner_avatar_moderation_status,
                users.location_updated_at AS owner_location_updated_at,
                users.last_seen_at AS owner_last_seen_at,
                CASE WHEN users.verification_status = 'verified' THEN 1 ELSE 0 END AS owner_verified
         FROM pets
         LEFT JOIN users ON users.id = pets.owner_id
         WHERE pets.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapPet(row) : null;
  },

  /** Mark stale pending playmate requests as expired (TTL from created_at). */
  expireStalePlaydateRequests(): number {
    const ttlSec = Math.max(1, Math.round(PLAYDATE_REQUEST_TTL_MS / 1000));
    const result = db
      .prepare(
        `UPDATE playdate_requests
         SET status = 'expired', updated_at = datetime('now')
         WHERE status = 'pending'
           AND datetime(created_at) <= datetime('now', ?)`
      )
      .run(`-${ttlSec} seconds`);
    return result.changes;
  },

  /** Mark stale requested vet consults as expired. */
  expireStaleVetConsultRequests(): number {
    const ttlSec = Math.max(1, Math.round(VET_CONSULT_REQUEST_TTL_MS / 1000));
    const result = db
      .prepare(
        `UPDATE vet_consultations
         SET status = 'expired'
         WHERE status = 'requested'
           AND datetime(created_at) <= datetime('now', ?)`
      )
      .run(`-${ttlSec} seconds`);
    return result.changes;
  },

  /** If this pending request is past TTL, persist expired and return updated row. */
  ensurePlaydateNotStale(req: PlaydateRequest | null): PlaydateRequest | null {
    if (!req) return null;
    if (req.status !== 'pending') return req;
    if (!isPendingRequestExpired(req.createdAt, PLAYDATE_REQUEST_TTL_MS)) return req;
    return this.updatePlaydateStatus(req.id, 'expired') ?? { ...req, status: 'expired' };
  },

  ensureVetConsultNotStale(c: VetConsultation | null): VetConsultation | null {
    if (!c) return null;
    if (c.status !== 'requested') return c;
    if (!isPendingRequestExpired(c.createdAt, VET_CONSULT_REQUEST_TTL_MS)) return c;
    return this.updateVetConsultationStatus(c.id, 'expired') ?? { ...c, status: 'expired' };
  },

  hasPendingPlaydate(fromPetId: number, toPetId: number): boolean {
    this.expireStalePlaydateRequests();
    const row = db
      .prepare(
        `SELECT id FROM playdate_requests
         WHERE from_pet_id = ? AND to_pet_id = ? AND status = 'pending'
         LIMIT 1`
      )
      .get(fromPetId, toPetId) as Record<string, unknown> | undefined;
    return Boolean(row);
  },

  /** Any pending request from this sender to this recipient (any of their pets). */
  hasPendingPlaydateBetweenUsers(fromUserId: number, toUserId: number): boolean {
    this.expireStalePlaydateRequests();
    const row = db
      .prepare(
        `SELECT id FROM playdate_requests
         WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
         LIMIT 1`
      )
      .get(fromUserId, toUserId) as Record<string, unknown> | undefined;
    return Boolean(row);
  },

  findPendingPlaydateBetweenUsers(
    fromUserId: number,
    toUserId: number
  ): PlaydateRequest | null {
    this.expireStalePlaydateRequests();
    const row = db
      .prepare(
        `SELECT * FROM playdate_requests
         WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(fromUserId, toUserId) as Record<string, unknown> | undefined;
    return row ? mapPlaydate(row) : null;
  },

  /** True when a prior expired request exists between the same pets (for resend confirm). */
  hasExpiredPlaydate(fromPetId: number, toPetId: number): boolean {
    const row = db
      .prepare(
        `SELECT id FROM playdate_requests
         WHERE from_pet_id = ? AND to_pet_id = ? AND status = 'expired'
         LIMIT 1`
      )
      .get(fromPetId, toPetId) as Record<string, unknown> | undefined;
    return Boolean(row);
  },

  /** True when patient has any expired quick-consult (for resend confirm). */
  hasExpiredVetConsultForPatient(
    patientUserId: number,
    serviceKind: ConsultServiceKind = 'vet'
  ): boolean {
    this.expireStaleVetConsultRequests();
    const row = db
      .prepare(
        `SELECT id FROM vet_consultations
         WHERE patient_user_id = ? AND status = 'expired'
           AND COALESCE(service_kind, 'vet') = ?
         LIMIT 1`
      )
      .get(patientUserId, serviceKind) as Record<string, unknown> | undefined;
    return Boolean(row);
  },

  /** True when patient still has an open requested consult. */
  hasPendingVetConsultForPatient(
    patientUserId: number,
    serviceKind: ConsultServiceKind = 'vet'
  ): boolean {
    this.expireStaleVetConsultRequests();
    const row = db
      .prepare(
        `SELECT id FROM vet_consultations
         WHERE patient_user_id = ? AND status = 'requested'
           AND COALESCE(service_kind, 'vet') = ?
         LIMIT 1`
      )
      .get(patientUserId, serviceKind) as Record<string, unknown> | undefined;
    return Boolean(row);
  },

  listSpecies(): PetSpecies[] {
    const rows = db
      .prepare('SELECT code, label_fa, emoji FROM pet_species ORDER BY sort_order, code')
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      code: row.code as PetSpecies['code'],
      labelFa: row.label_fa as string,
      emoji: (row.emoji as string) || '🐾',
    }));
  },

  listBreeds(speciesCode?: string): PetBreed[] {
    let sql = 'SELECT id, species_code, name_fa, name_en, sort_order FROM pet_breeds';
    const params: unknown[] = [];
    if (speciesCode) {
      sql += ' WHERE species_code = ?';
      params.push(speciesCode);
    }
    sql += ' ORDER BY sort_order ASC, name_fa ASC';
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: row.id as number,
      speciesCode: row.species_code as PetBreed['speciesCode'],
      nameFa: row.name_fa as string,
      nameEn: (row.name_en as string | null) ?? undefined,
      sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined,
    }));
  },

  createPet(data: {
    ownerId: number;
    name: string;
    species: string;
    breed?: string;
    gender?: PetGender;
    ageMonths?: number;
    size?: PetSize;
    color?: string;
    bio?: string;
    vaccinated?: boolean;
    neutered?: boolean;
    lookingForPlaymate?: boolean;
    personality?: Record<string, unknown>;
    health?: Record<string, unknown>;
    imageUrl?: string;
    city?: string;
    neighborhood?: string;
  }): PetProfile {
    const hasPhoto = Boolean(data.imageUrl?.trim());
    const moderation: PhotoModerationStatus = hasPhoto ? 'pending' : 'approved';
    const result = db
      .prepare(
        `INSERT INTO pets (
          owner_id, name, species, breed, gender, age_months, size, color, bio,
          vaccinated, neutered, looking_for_playmate, personality, health,
          image_url, city, neighborhood, photo_moderation_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.ownerId,
        data.name,
        data.species,
        data.breed ?? null,
        data.gender ?? null,
        data.ageMonths ?? null,
        data.size ?? null,
        data.color ?? null,
        data.bio ?? null,
        data.vaccinated ? 1 : 0,
        data.neutered ? 1 : 0,
        data.lookingForPlaymate !== false ? 1 : 0,
        JSON.stringify(data.personality ?? {}),
        JSON.stringify(data.health ?? {}),
        data.imageUrl ?? null,
        data.city ?? null,
        data.neighborhood ?? null,
        moderation
      );
    const petId = Number(result.lastInsertRowid);
    db.prepare('UPDATE pets SET public_id = ? WHERE id = ?').run(makePetPublicId(petId), petId);
    return mapPet(db.prepare('SELECT * FROM pets WHERE id = ?').get(petId) as Record<string, unknown>);
  },

  updatePet(id: number, patch: Partial<{
    name: string;
    species: string;
    breed: string;
    gender: PetGender;
    ageMonths: number;
    size: PetSize;
    color: string;
    bio: string;
    vaccinated: boolean;
    neutered: boolean;
    lookingForPlaymate: boolean;
    personality: Record<string, unknown>;
    health: Record<string, unknown>;
    imageUrl: string;
    city: string;
    neighborhood: string;
  }>): PetProfile | null {
    const existing = this.getPet(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
    if (patch.species !== undefined) { fields.push('species = ?'); values.push(patch.species); }
    if (patch.breed !== undefined) { fields.push('breed = ?'); values.push(patch.breed); }
    if (patch.gender !== undefined) { fields.push('gender = ?'); values.push(patch.gender); }
    if (patch.ageMonths !== undefined) { fields.push('age_months = ?'); values.push(patch.ageMonths); }
    if (patch.size !== undefined) { fields.push('size = ?'); values.push(patch.size); }
    if (patch.color !== undefined) { fields.push('color = ?'); values.push(patch.color); }
    if (patch.bio !== undefined) { fields.push('bio = ?'); values.push(patch.bio); }
    if (patch.vaccinated !== undefined) { fields.push('vaccinated = ?'); values.push(patch.vaccinated ? 1 : 0); }
    if (patch.neutered !== undefined) { fields.push('neutered = ?'); values.push(patch.neutered ? 1 : 0); }
    if (patch.lookingForPlaymate !== undefined) { fields.push('looking_for_playmate = ?'); values.push(patch.lookingForPlaymate ? 1 : 0); }
    if (patch.personality !== undefined) { fields.push('personality = ?'); values.push(JSON.stringify(patch.personality)); }
    if (patch.health !== undefined) { fields.push('health = ?'); values.push(JSON.stringify(patch.health)); }
    if (patch.imageUrl !== undefined) {
      fields.push('image_url = ?');
      values.push(patch.imageUrl);
      // New/changed photo must be re-moderated before public listing.
      if (String(patch.imageUrl || '').trim()) {
        fields.push("photo_moderation_status = 'pending'");
      }
    }
    if (patch.city !== undefined) { fields.push('city = ?'); values.push(patch.city); }
    if (patch.neighborhood !== undefined) { fields.push('neighborhood = ?'); values.push(patch.neighborhood); }

    if (fields.length === 0) return existing;

    fields.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE pets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getPet(id);
  },

  deletePet(id: number, ownerId?: number): boolean {
    const pet = this.getPet(id);
    if (!pet) return false;
    if (ownerId !== undefined && pet.ownerId !== ownerId) return false;

    db.prepare(
      'DELETE FROM playdate_requests WHERE from_pet_id = ? OR to_pet_id = ?'
    ).run(id, id);
    // vet_consultations.pet_id has NO ACTION — detach before pet row delete
    try {
      db.prepare('UPDATE vet_consultations SET pet_id = NULL WHERE pet_id = ?').run(id);
    } catch {
      /* older schemas */
    }
    const result = db.prepare('DELETE FROM pets WHERE id = ?').run(id);
    return result.changes > 0;
  },

  listPlaydateRequests(filters?: {
    userId?: number;
    petId?: number;
    status?: PlaydateStatus;
  }): PlaydateRequest[] {
    this.expireStalePlaydateRequests();
    let sql = 'SELECT * FROM playdate_requests WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.userId) {
      // Match by user ids OR by pets owned by this user (covers bot→web identity edge cases)
      sql += ` AND (
        from_user_id = ? OR to_user_id = ?
        OR from_pet_id IN (SELECT id FROM pets WHERE owner_id = ?)
        OR to_pet_id IN (SELECT id FROM pets WHERE owner_id = ?)
      )`;
      params.push(filters.userId, filters.userId, filters.userId, filters.userId);
    }
    if (filters?.petId) {
      sql += ' AND (from_pet_id = ? OR to_pet_id = ?)';
      params.push(filters.petId, filters.petId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY updated_at DESC, id DESC';
    return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapPlaydate);
  },

  getPlaydateRequest(id: number): PlaydateRequest | null {
    const row = db.prepare('SELECT * FROM playdate_requests WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return this.ensurePlaydateNotStale(row ? mapPlaydate(row) : null);
  },

  createPlaydateRequest(data: {
    fromPetId: number;
    toPetId: number;
    fromUserId: number;
    toUserId?: number;
    message?: string;
    scheduledAt?: string;
    location?: string;
  }): PlaydateRequest {
    const result = db
      .prepare(
        `INSERT INTO playdate_requests (
          from_pet_id, to_pet_id, from_user_id, to_user_id, message, scheduled_at, location
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.fromPetId,
        data.toPetId,
        data.fromUserId,
        data.toUserId ?? null,
        data.message ?? null,
        data.scheduledAt ?? null,
        data.location ?? null
      );
    const newId = Number(result.lastInsertRowid);
    db.prepare('UPDATE playdate_requests SET public_id = ? WHERE id = ?').run(
      makePlaydatePublicId(newId),
      newId
    );
    return mapPlaydate(
      db.prepare('SELECT * FROM playdate_requests WHERE id = ?').get(newId) as Record<string, unknown>
    );
  },

  updatePlaydateStatus(id: number, status: PlaydateStatus): PlaydateRequest | null {
    db.prepare("UPDATE playdate_requests SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return this.getPlaydateRequest(id);
  },

  isPlaydateParticipant(req: PlaydateRequest, userId: number): boolean {
    if (req.fromUserId === userId || req.toUserId === userId) return true;
    const fromPet = this.getPet(req.fromPetId);
    const toPet = this.getPet(req.toPetId);
    return fromPet?.ownerId === userId || toPet?.ownerId === userId;
  },

  listPlaydateChatMessages(
    playdateId: number,
    opts?: { afterId?: number; limit?: number }
  ): PlaydateChatMessage[] {
    const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
    const afterId = opts?.afterId;
    if (afterId != null && Number.isFinite(afterId)) {
      return (
        db
          .prepare(
            `SELECT * FROM playdate_chat_messages
             WHERE playdate_id = ? AND id > ?
             ORDER BY id ASC
             LIMIT ?`
          )
          .all(playdateId, afterId, limit) as Record<string, unknown>[]
      ).map(mapPlaydateChatMessage);
    }
    return (
      db
        .prepare(
          `SELECT * FROM playdate_chat_messages
           WHERE playdate_id = ?
           ORDER BY id ASC
           LIMIT ?`
        )
        .all(playdateId, limit) as Record<string, unknown>[]
    ).map(mapPlaydateChatMessage);
  },

  createPlaydateChatMessage(data: {
    playdateId: number;
    senderUserId: number;
    text?: string;
    mediaKind?: PlaydateChatMessage['mediaKind'];
    telegramFileId?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
  }): PlaydateChatMessage {
    const text = (data.text ?? '').trim();
    const hasMedia = Boolean(
      data.mediaKind && (data.telegramFileId || data.storageKey)
    );
    if (!text && !hasMedia) throw new Error('EMPTY_TEXT');
    if (text.length > 4000) throw new Error('TEXT_TOO_LONG');
    const result = db
      .prepare(
        `INSERT INTO playdate_chat_messages (
          playdate_id, sender_user_id, text, media_kind, telegram_file_id,
          mime_type, file_name, storage_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.playdateId,
        data.senderUserId,
        text || mediaPlaceholder(data.mediaKind),
        data.mediaKind ?? null,
        data.telegramFileId ?? null,
        data.mimeType ?? null,
        data.fileName ?? null,
        data.storageKey ?? null
      );
    db.prepare(
      `UPDATE playdate_requests SET updated_at = datetime('now') WHERE id = ?`,
    ).run(data.playdateId);
    return mapPlaydateChatMessage(
      db
        .prepare('SELECT * FROM playdate_chat_messages WHERE id = ?')
        .get(result.lastInsertRowid) as Record<string, unknown>
    );
  },

  getPlaydateChatMessage(id: number): PlaydateChatMessage | null {
    const row = db
      .prepare('SELECT * FROM playdate_chat_messages WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapPlaydateChatMessage(row) : null;
  },

  setPlaydateChatSecure(id: number, secure: boolean): PlaydateRequest | null {
    db.prepare(
      `UPDATE playdate_requests SET chat_secure = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(secure ? 1 : 0, id);
    return this.getPlaydateRequest(id);
  },

  endPlaydateChat(id: number): PlaydateRequest | null {
    db.prepare(
      `UPDATE playdate_requests SET chat_ended = 1, chat_secure = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
    // File cleanup is handled by the route (imports fs helpers outside db).
    this.clearPlaydateChatMessages(id);
    return this.getPlaydateRequest(id);
  },

  reopenPlaydateChat(id: number): PlaydateRequest | null {
    db.prepare(
      `UPDATE playdate_requests SET chat_ended = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
    return this.getPlaydateRequest(id);
  },

  listPlaydateChatStorageKeys(playdateId: number): string[] {
    const rows = db
      .prepare(
        `SELECT storage_key FROM playdate_chat_messages
         WHERE playdate_id = ? AND storage_key IS NOT NULL AND storage_key != ''`
      )
      .all(playdateId) as { storage_key: string }[];
    return rows.map((r) => r.storage_key).filter(Boolean);
  },

  clearPlaydateChatMessages(playdateId: number): number {
    const result = db
      .prepare('DELETE FROM playdate_chat_messages WHERE playdate_id = ?')
      .run(playdateId);
    return Number(result.changes ?? 0);
  },

  recordPlaydateChatTgRef(
    playdateId: number,
    telegramChatId: string,
    messageId: number
  ): void {
    if (!telegramChatId || !Number.isFinite(messageId) || messageId <= 0) return;
    db.prepare(
      `INSERT OR IGNORE INTO playdate_chat_tg_refs (playdate_id, telegram_chat_id, message_id)
       VALUES (?, ?, ?)`
    ).run(playdateId, String(telegramChatId), Math.trunc(messageId));
  },

  recordPlaydateChatTgRefs(
    playdateId: number,
    refs: Array<{ telegramChatId: string; messageId: number }>
  ): number {
    let n = 0;
    const insert = db.prepare(
      `INSERT OR IGNORE INTO playdate_chat_tg_refs (playdate_id, telegram_chat_id, message_id)
       VALUES (?, ?, ?)`
    );
    const tx = db.transaction((rows: Array<{ telegramChatId: string; messageId: number }>) => {
      for (const row of rows) {
        if (!row.telegramChatId || !Number.isFinite(row.messageId) || row.messageId <= 0) continue;
        const r = insert.run(playdateId, String(row.telegramChatId), Math.trunc(row.messageId));
        n += Number(r.changes ?? 0);
      }
    });
    tx(refs);
    return n;
  },

  listPlaydateChatTgRefs(
    playdateId: number
  ): Array<{ telegramChatId: string; messageId: number }> {
    const rows = db
      .prepare(
        `SELECT telegram_chat_id, message_id FROM playdate_chat_tg_refs WHERE playdate_id = ?`
      )
      .all(playdateId) as { telegram_chat_id: string; message_id: number }[];
    return rows.map((r) => ({
      telegramChatId: r.telegram_chat_id,
      messageId: Number(r.message_id),
    }));
  },

  clearPlaydateChatTgRefs(playdateId: number): number {
    const result = db
      .prepare('DELETE FROM playdate_chat_tg_refs WHERE playdate_id = ?')
      .run(playdateId);
    return Number(result.changes ?? 0);
  },

  createAppErrorLog(data: {
    level?: 'error' | 'warn' | 'info';
    source?: string;
    message: string;
    stack?: string | null;
    path?: string | null;
    method?: string | null;
    statusCode?: number | null;
    meta?: Record<string, unknown> | null;
  }): { id: number } {
    const result = db
      .prepare(
        `INSERT INTO app_error_logs (
          level, source, message, stack, path, method, status_code, meta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.level ?? 'error',
        data.source ?? 'api',
        data.message.slice(0, 4000),
        data.stack?.slice(0, 8000) ?? null,
        data.path ?? null,
        data.method ?? null,
        data.statusCode ?? null,
        data.meta ? JSON.stringify(data.meta).slice(0, 4000) : null
      );
    return { id: Number(result.lastInsertRowid) };
  },

  listAppErrorLogs(opts?: {
    level?: string;
    source?: string;
    limit?: number;
    beforeId?: number;
  }): Array<{
    id: number;
    level: string;
    source: string;
    message: string;
    stack: string | null;
    path: string | null;
    method: string | null;
    statusCode: number | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
  }> {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts?.level) {
      clauses.push('level = ?');
      params.push(opts.level);
    }
    if (opts?.source) {
      clauses.push('source = ?');
      params.push(opts.source);
    }
    if (opts?.beforeId && Number.isFinite(opts.beforeId)) {
      clauses.push('id < ?');
      params.push(opts.beforeId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT * FROM app_error_logs ${where} ORDER BY id DESC LIMIT ?`
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map((row) => {
      let meta: Record<string, unknown> | null = null;
      if (typeof row.meta === 'string' && row.meta) {
        try {
          meta = JSON.parse(row.meta) as Record<string, unknown>;
        } catch {
          meta = { raw: row.meta };
        }
      }
      return {
        id: row.id as number,
        level: row.level as string,
        source: row.source as string,
        message: row.message as string,
        stack: (row.stack as string | null) ?? null,
        path: (row.path as string | null) ?? null,
        method: (row.method as string | null) ?? null,
        statusCode: (row.status_code as number | null) ?? null,
        meta,
        createdAt: row.created_at as string,
      };
    });
  },

  getAppErrorLogStats(): {
    total: number;
    errors24h: number;
    warns24h: number;
    lastErrorAt: string | null;
  } {
    const total = (
      db.prepare('SELECT COUNT(*) as c FROM app_error_logs').get() as { c: number }
    ).c;
    const errors24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM app_error_logs
           WHERE level = 'error' AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const warns24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM app_error_logs
           WHERE level = 'warn' AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const last = db
      .prepare(
        `SELECT created_at FROM app_error_logs WHERE level = 'error' ORDER BY id DESC LIMIT 1`
      )
      .get() as { created_at: string } | undefined;
    return {
      total: Number(total ?? 0),
      errors24h: Number(errors24h ?? 0),
      warns24h: Number(warns24h ?? 0),
      lastErrorAt: last?.created_at ?? null,
    };
  },

  clearAppErrorLogs(olderThanDays?: number): number {
    if (olderThanDays && olderThanDays > 0) {
      const result = db
        .prepare(
          `DELETE FROM app_error_logs WHERE created_at < datetime('now', ?)`
        )
        .run(`-${Math.trunc(olderThanDays)} days`);
      return Number(result.changes ?? 0);
    }
    const result = db.prepare('DELETE FROM app_error_logs').run();
    return Number(result.changes ?? 0);
  },

  getOpsCounts(): {
    users: number;
    pets: number;
    playdates: number;
    playdatesAccepted: number;
    chatMessages: number;
    openGames: number;
  } {
    const q = (sql: string) =>
      Number((db.prepare(sql).get() as { c: number } | undefined)?.c ?? 0);
    return {
      users: q('SELECT COUNT(*) as c FROM users'),
      pets: q('SELECT COUNT(*) as c FROM pets'),
      playdates: q('SELECT COUNT(*) as c FROM playdate_requests'),
      playdatesAccepted: q(
        `SELECT COUNT(*) as c FROM playdate_requests WHERE status = 'accepted'`
      ),
      chatMessages: q('SELECT COUNT(*) as c FROM playdate_chat_messages'),
      openGames: q(`SELECT COUNT(*) as c FROM games WHERE status = 'open'`),
    };
  },

  /** سکه روزانه — یک‌بار در هر روز UTC */
  claimDailyCoins(
    userId: number,
    amount: number
  ):
    | { ok: true; user: User; awarded: number }
    | { ok: false; reason: 'missing' | 'already'; user?: User } {
    const user = this.getUserById(userId);
    if (!user) return { ok: false, reason: 'missing' };

    if (user.lastDailyCoinAt) {
      const last = new Date(user.lastDailyCoinAt);
      const now = new Date();
      if (
        !Number.isNaN(last.getTime()) &&
        last.getUTCFullYear() === now.getUTCFullYear() &&
        last.getUTCMonth() === now.getUTCMonth() &&
        last.getUTCDate() === now.getUTCDate()
      ) {
        return { ok: false, reason: 'already', user };
      }
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      'UPDATE users SET coins = COALESCE(coins, 0) + ?, last_daily_coin_at = ? WHERE id = ?'
    ).run(amount, nowIso, userId);
    const updated = this.getUserById(userId)!;
    return { ok: true, user: updated, awarded: amount };
  },

  userHasOpenCoinSell(userId: number): boolean {
    const row = db
      .prepare(
        `SELECT COUNT(*) as c FROM coin_sell_requests WHERE user_id = ? AND status = 'open'`
      )
      .get(userId) as { c: number };
    return Number(row?.c ?? 0) > 0;
  },

  getOpenCoinSellRequest(userId: number): CoinSellRequestSummary | null {
    const row = db
      .prepare(
        `SELECT * FROM coin_sell_requests
         WHERE user_id = ? AND status = 'open'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      )
      .get(userId) as Record<string, unknown> | undefined;
    return row ? mapCoinSellRequestSummary(row) : null;
  },

  listCoinSellRequests(userId: number, limit = 20): CoinSellRequestSummary[] {
    const lim = Math.min(50, Math.max(1, Math.floor(limit) || 20));
    return (
      db
        .prepare(
          `SELECT * FROM coin_sell_requests
           WHERE user_id = ?
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        )
        .all(userId, lim) as Record<string, unknown>[]
    ).map(mapCoinSellRequestSummary);
  },

  listVetConsultations(filters: {
    vetUserId?: number;
    patientUserId?: number;
    status?: VetConsultStatus;
    serviceKind?: ConsultServiceKind;
    /** When true, allow listing without vet/patient filter (admin) */
    all?: boolean;
  }): VetConsultation[] {
    this.expireStaleVetConsultRequests();
    if (
      !filters.all &&
      filters.vetUserId == null &&
      filters.patientUserId == null
    ) {
      return [];
    }
    let sql = `
      SELECT vc.*,
             COALESCE(
               (SELECT MAX(m.created_at) FROM vet_consult_chat_messages m WHERE m.consult_id = vc.id),
               vc.created_at
             ) AS last_activity_at,
             patient.name AS patient_name,
             patient.city AS patient_city,
             patient.avatar_url AS patient_avatar_url,
             vet.name AS vet_name,
             vet.avatar_url AS vet_avatar_url,
             pets.name AS pet_name,
             pets.species AS pet_species,
             pets.breed AS pet_breed,
             pets.image_url AS pet_image_url
      FROM vet_consultations vc
      LEFT JOIN users patient ON patient.id = vc.patient_user_id
      LEFT JOIN users vet ON vet.id = vc.vet_user_id
      LEFT JOIN pets ON pets.id = vc.pet_id
      WHERE 1 = 1
    `;
    const params: unknown[] = [];
    if (filters.vetUserId != null) {
      sql += ' AND vc.vet_user_id = ?';
      params.push(filters.vetUserId);
    }
    if (filters.patientUserId != null) {
      sql += ' AND vc.patient_user_id = ?';
      params.push(filters.patientUserId);
    }
    if (filters.status) {
      sql += ' AND vc.status = ?';
      params.push(filters.status);
    }
    if (filters.serviceKind) {
      sql += " AND COALESCE(vc.service_kind, 'vet') = ?";
      params.push(filters.serviceKind);
    }
    sql += ` ORDER BY COALESCE(
      (SELECT MAX(m.created_at) FROM vet_consult_chat_messages m WHERE m.consult_id = vc.id),
      vc.created_at
    ) DESC, vc.id DESC`;
    return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(mapVetConsultation);
  },

  createVetConsultation(data: {
    vetUserId: number;
    patientUserId: number;
    petId?: number;
    status?: VetConsultStatus;
    notes?: string;
    feeCoins?: number;
    serviceKind?: ConsultServiceKind;
    providerShareCoins?: number;
  }): VetConsultation {
    const fee =
      data.feeCoins != null && Number.isFinite(Number(data.feeCoins))
        ? Math.max(0, Math.floor(Number(data.feeCoins)))
        : null;
    const kind = data.serviceKind ?? 'vet';
    const share =
      data.providerShareCoins != null && Number.isFinite(Number(data.providerShareCoins))
        ? Math.max(0, Math.floor(Number(data.providerShareCoins)))
        : kind === 'vet'
          ? fee
          : consultFeeSplit(kind).providerShare;
    const result = db
      .prepare(
        `INSERT INTO vet_consultations (
          vet_user_id, patient_user_id, pet_id, status, notes, fee_coins,
          service_kind, provider_share_coins
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.vetUserId,
        data.patientUserId,
        data.petId ?? null,
        data.status ?? 'requested',
        data.notes ?? null,
        fee,
        kind,
        share
      );
    const newId = Number(result.lastInsertRowid);
    db.prepare('UPDATE vet_consultations SET public_id = ? WHERE id = ?').run(
      makeConsultPublicId(newId),
      newId
    );
    const created = this.getVetConsultation(newId);
    return (
      created ?? {
        id: newId,
        publicId: makeConsultPublicId(newId),
        vetUserId: data.vetUserId,
        patientUserId: data.patientUserId,
        petId: data.petId,
        serviceKind: kind,
        status: data.status ?? 'requested',
        notes: data.notes,
        feeCoins: fee ?? undefined,
        providerShareCoins: share ?? undefined,
        createdAt: new Date().toISOString(),
      }
    );
  },

  getVetConsultation(id: number): VetConsultation | null {
    const rows = db
      .prepare(
        `SELECT vc.*,
                pu.name AS patient_name,
                pu.city AS patient_city,
                pu.avatar_url AS patient_avatar_url,
                vu.name AS vet_name,
                vu.avatar_url AS vet_avatar_url,
                p.name AS pet_name,
                p.species AS pet_species,
                p.breed AS pet_breed,
                p.image_url AS pet_image_url
         FROM vet_consultations vc
         LEFT JOIN users pu ON pu.id = vc.patient_user_id
         LEFT JOIN users vu ON vu.id = vc.vet_user_id
         LEFT JOIN pets p ON p.id = vc.pet_id
         WHERE vc.id = ?`
      )
      .all(id) as Record<string, unknown>[];
    if (!rows.length) return null;
    return this.ensureVetConsultNotStale(mapVetConsultation(rows[0]!));
  },

  /**
   * Ongoing AI fallback consult for a patient (active, chat not ended).
   * Newest by last message / created_at when duplicates exist from older bugs.
   */
  findActiveAiConsultForPatient(
    patientUserId: number,
    serviceKind: ConsultServiceKind,
    aiUserId: number
  ): VetConsultation | null {
    this.expireStaleVetConsultRequests();
    const row = db
      .prepare(
        `SELECT vc.*,
                pu.name AS patient_name,
                pu.city AS patient_city,
                pu.avatar_url AS patient_avatar_url,
                vu.name AS vet_name,
                vu.avatar_url AS vet_avatar_url,
                p.name AS pet_name,
                p.species AS pet_species,
                p.breed AS pet_breed,
                p.image_url AS pet_image_url
         FROM vet_consultations vc
         LEFT JOIN users pu ON pu.id = vc.patient_user_id
         LEFT JOIN users vu ON vu.id = vc.vet_user_id
         LEFT JOIN pets p ON p.id = vc.pet_id
         WHERE vc.patient_user_id = ?
           AND vc.vet_user_id = ?
           AND vc.status = 'active'
           AND COALESCE(vc.chat_ended, 0) = 0
           AND COALESCE(vc.service_kind, 'vet') = ?
         ORDER BY COALESCE(
           (SELECT MAX(m.created_at) FROM vet_consult_chat_messages m WHERE m.consult_id = vc.id),
           vc.created_at
         ) DESC, vc.id DESC
         LIMIT 1`
      )
      .get(patientUserId, aiUserId, serviceKind) as Record<string, unknown> | undefined;
    return row ? this.ensureVetConsultNotStale(mapVetConsultation(row)) : null;
  },

  /**
   * Close orphan active AI sessions of the same kind (chat_ended + completed),
   * keeping `keepId` open. Avoids clearing message history.
   */
  closeActiveAiConsultsForPatient(
    patientUserId: number,
    serviceKind: ConsultServiceKind,
    aiUserId: number,
    keepId?: number | null
  ): number {
    // Split keepId paths: Postgres rejects unbound typed `? IS NULL` when keepId is null
    // ("could not determine data type of parameter $4").
    const baseWhere = `WHERE patient_user_id = ?
           AND vet_user_id = ?
           AND status = 'active'
           AND COALESCE(chat_ended, 0) = 0
           AND COALESCE(service_kind, 'vet') = ?`;
    const setSql = `UPDATE vet_consultations
         SET status = 'completed', chat_ended = 1, chat_secure = 0
         ${baseWhere}`;
    const keep = keepId != null && Number.isFinite(Number(keepId)) ? Number(keepId) : null;
    const result =
      keep == null
        ? db.prepare(setSql).run(patientUserId, aiUserId, serviceKind)
        : db
            .prepare(`${setSql}
           AND id != ?`)
            .run(patientUserId, aiUserId, serviceKind, keep);
    return result.changes;
  },

  updateVetConsultationStatus(
    id: number,
    status: VetConsultStatus
  ): VetConsultation | null {
    const row = db
      .prepare(
        `SELECT vc.*,
                pu.name AS patient_name,
                pu.city AS patient_city,
                pu.avatar_url AS patient_avatar_url,
                vu.name AS vet_name,
                vu.avatar_url AS vet_avatar_url,
                p.name AS pet_name,
                p.species AS pet_species,
                p.breed AS pet_breed,
                p.image_url AS pet_image_url
         FROM vet_consultations vc
         LEFT JOIN users pu ON pu.id = vc.patient_user_id
         LEFT JOIN users vu ON vu.id = vc.vet_user_id
         LEFT JOIN pets p ON p.id = vc.pet_id
         WHERE vc.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    db.prepare(`UPDATE vet_consultations SET status = ? WHERE id = ?`).run(status, id);
    const updated = db
      .prepare(
        `SELECT vc.*,
                pu.name AS patient_name,
                pu.city AS patient_city,
                pu.avatar_url AS patient_avatar_url,
                vu.name AS vet_name,
                vu.avatar_url AS vet_avatar_url,
                p.name AS pet_name,
                p.species AS pet_species,
                p.breed AS pet_breed,
                p.image_url AS pet_image_url
         FROM vet_consultations vc
         LEFT JOIN users pu ON pu.id = vc.patient_user_id
         LEFT JOIN users vu ON vu.id = vc.vet_user_id
         LEFT JOIN pets p ON p.id = vc.pet_id
         WHERE vc.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return updated ? mapVetConsultation(updated) : null;
  },

  /** وقتی یک ارائه‌دهنده قبول می‌کند، بقیهٔ درخواست‌های هم‌زمان همان بیمار (همان kind) لغو شوند */
  cancelSiblingVetConsultations(
    patientUserId: number,
    keepId: number,
    serviceKind?: ConsultServiceKind
  ): number {
    const keep = this.getVetConsultation(keepId);
    const kind = serviceKind ?? keep?.serviceKind ?? 'vet';
    const result = db
      .prepare(
        `UPDATE vet_consultations
         SET status = 'cancelled'
         WHERE patient_user_id = ? AND id != ? AND status = 'requested'
           AND COALESCE(service_kind, 'vet') = ?`
      )
      .run(patientUserId, keepId, kind);
    return result.changes;
  },

  /**
   * واریز درآمد ارائه‌دهنده بعد از قبول مشاوره (idempotent).
   * دامپزشک: کل fee_coins؛ مربی/پرستار/مشورت: فقط سهم ارائه‌دهنده + لجر کارمزد پلتفرم.
   */
  payVetForAcceptedConsult(consultId: number): {
    paid: boolean;
    amount: number;
    alreadyPaid: boolean;
    consult: VetConsultation | null;
  } {
    const consult = this.getVetConsultation(consultId);
    if (!consult) {
      return { paid: false, amount: 0, alreadyPaid: false, consult: null };
    }
    if (consult.status !== 'active' && consult.status !== 'completed') {
      return { paid: false, amount: 0, alreadyPaid: false, consult };
    }
    if (consult.vetPaidAt) {
      return {
        paid: false,
        amount: consult.providerShareCoins ?? consult.feeCoins ?? 0,
        alreadyPaid: true,
        consult,
      };
    }

    const provider = this.getUserById(consult.vetUserId);
    if (!provider) {
      return { paid: false, amount: 0, alreadyPaid: false, consult };
    }

    const kind = consult.serviceKind ?? 'vet';
    const split = consultFeeSplit(kind);
    const totalFee = Math.max(
      0,
      Math.floor(
        Number(
          consult.feeCoins != null && consult.feeCoins > 0
            ? consult.feeCoins
            : kind === 'vet'
              ? vetVisitFeeCoins(provider)
              : split.cost
        )
      )
    );
    const providerAmount =
      kind === 'vet'
        ? totalFee
        : Math.max(
            0,
            Math.floor(
              Number(
                consult.providerShareCoins != null && consult.providerShareCoins > 0
                  ? consult.providerShareCoins
                  : split.providerShare
              )
            )
          );
    const systemFee =
      kind === 'vet' ? 0 : Math.max(0, totalFee - providerAmount);

    if (totalFee <= 0 && providerAmount <= 0) {
      db.prepare(
        `UPDATE vet_consultations
         SET vet_paid_at = datetime('now'),
             fee_coins = COALESCE(fee_coins, 0)
         WHERE id = ? AND vet_paid_at IS NULL`
      ).run(consultId);
      return {
        paid: false,
        amount: 0,
        alreadyPaid: false,
        consult: this.getVetConsultation(consultId),
      };
    }

    const marked = db
      .prepare(
        `UPDATE vet_consultations
         SET vet_paid_at = datetime('now'),
             fee_coins = COALESCE(fee_coins, ?),
             provider_share_coins = COALESCE(provider_share_coins, ?)
         WHERE id = ? AND vet_paid_at IS NULL`
      )
      .run(totalFee, providerAmount, consultId);
    if (marked.changes === 0) {
      return {
        paid: false,
        amount: providerAmount,
        alreadyPaid: true,
        consult: this.getVetConsultation(consultId),
      };
    }

    if (providerAmount > 0) {
      this.creditCoins(consult.vetUserId, providerAmount, undefined, {
        reason: split.payoutReason,
        refType: split.payoutRefType,
        refId: consultId,
      });
    }

    if (systemFee > 0 && split.systemReason) {
      // Platform fee: ledger only (null user) — do not credit a fake user.
      this.appendWalletLedger({
        userId: null,
        currency: 'coins',
        amount: systemFee,
        direction: 'credit',
        reason: split.systemReason,
        refType: 'system_fee',
        refId: consultId,
      });
    }

    return {
      paid: true,
      amount: providerAmount,
      alreadyPaid: false,
      consult: this.getVetConsultation(consultId),
    };
  },

  listVetConsultChatMessages(
    consultId: number,
    opts?: { afterId?: number; limit?: number }
  ): VetConsultChatMessage[] {
    const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
    const afterId = opts?.afterId;
    if (afterId != null && Number.isFinite(afterId)) {
      return (
        db
          .prepare(
            `SELECT * FROM vet_consult_chat_messages
             WHERE consult_id = ? AND id > ?
             ORDER BY id ASC
             LIMIT ?`
          )
          .all(consultId, afterId, limit) as Record<string, unknown>[]
      ).map(mapVetConsultChatMessage);
    }
    return (
      db
        .prepare(
          `SELECT * FROM vet_consult_chat_messages
           WHERE consult_id = ?
           ORDER BY id ASC
           LIMIT ?`
        )
        .all(consultId, limit) as Record<string, unknown>[]
    ).map(mapVetConsultChatMessage);
  },

  createVetConsultChatMessage(data: {
    consultId: number;
    senderUserId: number;
    text?: string;
    mediaKind?: VetConsultChatMessage['mediaKind'];
    telegramFileId?: string | null;
    storageKey?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
  }): VetConsultChatMessage {
    const text = (data.text ?? '').trim();
    const hasMedia = Boolean(
      data.mediaKind && (data.telegramFileId || data.storageKey)
    );
    if (!text && !hasMedia) throw new Error('EMPTY_TEXT');
    if (text.length > 4000) throw new Error('TEXT_TOO_LONG');
    const result = db
      .prepare(
        `INSERT INTO vet_consult_chat_messages (
          consult_id, sender_user_id, text, media_kind, telegram_file_id,
          mime_type, file_name, storage_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.consultId,
        data.senderUserId,
        text || mediaPlaceholder(data.mediaKind),
        data.mediaKind ?? null,
        data.telegramFileId ?? null,
        data.mimeType ?? null,
        data.fileName ?? null,
        data.storageKey ?? null
      );
    // Touch parent consult so inbox can surface latest chats first via message time.
    // (listVetConsultations already sorts by last message / created_at)
    return mapVetConsultChatMessage(
      db
        .prepare('SELECT * FROM vet_consult_chat_messages WHERE id = ?')
        .get(result.lastInsertRowid) as Record<string, unknown>
    );
  },

  getVetConsultChatMessage(id: number): VetConsultChatMessage | null {
    const row = db
      .prepare('SELECT * FROM vet_consult_chat_messages WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapVetConsultChatMessage(row) : null;
  },

  /** Replace message text (e.g. after voice transcription). Keeps media fields. */
  updateVetConsultChatMessageText(
    id: number,
    text: string
  ): VetConsultChatMessage | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.length > 4000) throw new Error('TEXT_TOO_LONG');
    db.prepare('UPDATE vet_consult_chat_messages SET text = ? WHERE id = ?').run(
      trimmed,
      id
    );
    return this.getVetConsultChatMessage(id);
  },

  setVetConsultChatSecure(id: number, secure: boolean): VetConsultation | null {
    db.prepare(
      `UPDATE vet_consultations SET chat_secure = ? WHERE id = ?`
    ).run(secure ? 1 : 0, id);
    return this.getVetConsultation(id);
  },

  endVetConsultChat(id: number): VetConsultation | null {
    db.prepare(
      `UPDATE vet_consultations SET chat_ended = 1, chat_secure = 0 WHERE id = ?`
    ).run(id);
    this.clearVetConsultChatMessages(id);
    return this.getVetConsultation(id);
  },

  listVetConsultChatStorageKeys(consultId: number): string[] {
    const rows = db
      .prepare(
        `SELECT storage_key FROM vet_consult_chat_messages
         WHERE consult_id = ? AND storage_key IS NOT NULL AND storage_key != ''`
      )
      .all(consultId) as { storage_key: string }[];
    return rows.map((r) => r.storage_key).filter(Boolean);
  },


  ensureSupportThread(userId: number): { id: number; userId: number } {
    const existing = db
      .prepare('SELECT id, user_id FROM support_threads WHERE user_id = ?')
      .get(userId) as { id: number; user_id: number } | undefined;
    if (existing) {
      return { id: existing.id, userId: existing.user_id };
    }
    const result = db
      .prepare('INSERT INTO support_threads (user_id) VALUES (?)')
      .run(userId);
    return { id: Number(result.lastInsertRowid), userId };
  },

  listSupportMessages(userId: number, limit = 80): Array<{
    id: number;
    role: 'user' | 'assistant';
    text: string;
    createdAt: string;
  }> {
    const thread = db
      .prepare('SELECT id FROM support_threads WHERE user_id = ?')
      .get(userId) as { id: number } | undefined;
    if (!thread) return [];
    const lim = Math.min(Math.max(1, limit), 200);
    const rows = db
      .prepare(
        `SELECT id, role, text, created_at FROM support_messages
         WHERE thread_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(thread.id, lim) as Array<{ id: number; role: string; text: string; created_at: string }>;
    rows.reverse();
    return rows.map((r) => ({
      id: r.id,
      role: r.role === 'assistant' ? 'assistant' : 'user',
      text: r.text,
      createdAt: r.created_at,
    }));
  },

  addSupportMessage(
    userId: number,
    role: 'user' | 'assistant',
    text: string
  ): { id: number; role: 'user' | 'assistant'; text: string; createdAt: string } {
    const thread = this.ensureSupportThread(userId);
    const body = text.trim();
    if (!body) throw new Error('EMPTY_TEXT');
    if (body.length > 4000) throw new Error('TEXT_TOO_LONG');
    const result = db
      .prepare(
        `INSERT INTO support_messages (thread_id, role, text) VALUES (?, ?, ?)`
      )
      .run(thread.id, role, body);
    db.prepare(
      `UPDATE support_threads SET updated_at = datetime('now') WHERE id = ?`
    ).run(thread.id);
    const row = db
      .prepare('SELECT id, role, text, created_at FROM support_messages WHERE id = ?')
      .get(result.lastInsertRowid) as {
      id: number;
      role: string;
      text: string;
      created_at: string;
    };
    return {
      id: row.id,
      role: row.role === 'assistant' ? 'assistant' : 'user',
      text: row.text,
      createdAt: row.created_at,
    };
  },

  clearVetConsultChatMessages(consultId: number): number {
    const result = db
      .prepare('DELETE FROM vet_consult_chat_messages WHERE consult_id = ?')
      .run(consultId);
    return Number(result.changes ?? 0);
  },

  touchUserLastSeen(userId: number): string | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;
    db.prepare(
      `UPDATE users SET last_seen_at = datetime('now') WHERE id = ?`
    ).run(userId);
    const row = db
      .prepare('SELECT last_seen_at FROM users WHERE id = ?')
      .get(userId) as { last_seen_at: string | null } | undefined;
    return row?.last_seen_at ?? null;
  },

  getUserPresence(userId: number): {
    userId: number;
    lastSeenAt: string | null;
    online: boolean;
  } | null {
    const row = db
      .prepare('SELECT id, last_seen_at FROM users WHERE id = ?')
      .get(userId) as { id: number; last_seen_at: string | null } | undefined;
    if (!row) return null;
    return presenceFromLastSeen(row.id, row.last_seen_at);
  },

  getUsersPresence(ids: number[]): Array<{
    userId: number;
    lastSeenAt: string | null;
    online: boolean;
  }> {
    const unique = [...new Set(ids.filter((id) => Number.isFinite(id) && id > 0))];
    if (!unique.length) return [];
    const placeholders = unique.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT id, last_seen_at FROM users WHERE id IN (${placeholders})`)
      .all(...unique) as Array<{ id: number; last_seen_at: string | null }>;
    const byId = new Map(
      rows.map((r) => [r.id, presenceFromLastSeen(r.id, r.last_seen_at)] as const)
    );
    return unique.map(
      (id) => byId.get(id) ?? { userId: id, lastSeenAt: null, online: false }
    );
  },

  submitCoinSell(input: {
    userId: number;
    coins: number;
    rateToman: number;
    cardNumber: string;
    minCoins: number;
  }):
    | { ok: true; requestId: number; amountToman: number; rateToman: number; user: User }
    | { ok: false; reason: 'min' | 'balance' | 'pending' | 'missing' } {
    const coins = Math.floor(input.coins);
    if (!Number.isFinite(coins) || coins < input.minCoins) {
      return { ok: false, reason: 'min' };
    }
    const user = this.getUserById(input.userId);
    if (!user) return { ok: false, reason: 'missing' };
    if (this.userHasOpenCoinSell(input.userId)) return { ok: false, reason: 'pending' };
    if ((user.coins ?? 0) < coins) return { ok: false, reason: 'balance' };

    const amountToman = coins * input.rateToman;
    const tx = db.transaction(() => {
      const debited = db
        .prepare(
          `UPDATE users SET coins = coins - ? WHERE id = ? AND COALESCE(coins, 0) >= ?`
        )
        .run(coins, input.userId, coins);
      if (debited.changes !== 1) throw new Error('BALANCE');
      const result = db
        .prepare(
          `INSERT INTO coin_sell_requests (
            user_id, coins, rate_toman, amount_toman, card_number, status
          ) VALUES (?, ?, ?, ?, ?, 'open')`
        )
        .run(input.userId, coins, input.rateToman, amountToman, input.cardNumber);
      const requestId = Number(result.lastInsertRowid);
      this.appendWalletLedger({
        userId: input.userId,
        currency: 'coins',
        amount: coins,
        direction: 'debit',
        reason: 'فروش سکه',
        refType: 'coin_sell',
        refId: requestId,
      });
      return requestId;
    });

    try {
      const requestId = tx();
      return {
        ok: true,
        requestId,
        amountToman,
        rateToman: input.rateToman,
        user: this.getUserById(input.userId)!,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'BALANCE') {
        return { ok: false, reason: 'balance' };
      }
      throw err;
    }
  },

  createPaymentOrder(input: {
    userId: number;
    packageId: string;
    coins: number;
    amountToman?: number;
    amountStars?: number;
    method: PaymentMethod;
    status: PaymentOrderStatus;
    adminNote?: string;
  }): PaymentOrder {
    const result = db
      .prepare(
        `INSERT INTO payment_orders (
          user_id, package_id, coins, amount_toman, amount_stars, method, status, admin_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.packageId,
        input.coins,
        input.amountToman ?? null,
        input.amountStars ?? null,
        input.method,
        input.status,
        input.adminNote?.trim() || null
      );
    const newId = Number(result.lastInsertRowid);
    db.prepare('UPDATE payment_orders SET public_id = ? WHERE id = ?').run(
      makePaymentPublicId(newId),
      newId
    );
    return this.getPaymentOrder(newId)!;
  },

  updatePaymentOrderAdminNote(orderId: number, adminNote: string): void {
    db.prepare(`UPDATE payment_orders SET admin_note = ? WHERE id = ?`).run(
      adminNote,
      orderId
    );
  },

  getPaymentOrder(id: number): PaymentOrder | null {
    const row = db
      .prepare(
        `SELECT po.*,
                u.name AS user_name,
                u.telegram_id AS user_telegram_id,
                u.username AS user_username,
                u.avatar_url AS user_avatar_url
         FROM payment_orders po
         LEFT JOIN users u ON u.id = po.user_id
         WHERE po.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapPaymentOrder(row) : null;
  },

  listPendingCardPayments(): PaymentOrder[] {
    return (
      db
        .prepare(
          `SELECT po.*,
                  u.name AS user_name,
                  u.telegram_id AS user_telegram_id,
                  u.username AS user_username,
                  u.avatar_url AS user_avatar_url
           FROM payment_orders po
           LEFT JOIN users u ON u.id = po.user_id
           WHERE po.method = 'card' AND po.status = 'pending'
           ORDER BY po.created_at ASC, po.id ASC`
        )
        .all() as Record<string, unknown>[]
    ).map(mapPaymentOrder);
  },

  attachPaymentReceipt(
    orderId: number,
    receiptFileId: string
  ):
    | { ok: true; order: PaymentOrder }
    | { ok: false; reason: 'missing' | 'bad_status' | 'no_file' } {
    const fileId = receiptFileId.trim();
    if (!fileId) return { ok: false, reason: 'no_file' };
    const existing = this.getPaymentOrder(orderId);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.method !== 'card' || existing.status !== 'awaiting_receipt') {
      return { ok: false, reason: 'bad_status' };
    }
    db.prepare(
      `UPDATE payment_orders
       SET receipt_file_id = ?, status = 'pending'
       WHERE id = ? AND status = 'awaiting_receipt'`
    ).run(fileId, orderId);
    const order = this.getPaymentOrder(orderId);
    if (!order || order.status !== 'pending') return { ok: false, reason: 'bad_status' };
    return { ok: true, order };
  },

  approveCardPayment(
    orderId: number,
    note?: string
  ):
    | { ok: true; order: PaymentOrder; user: User }
    | { ok: false; reason: 'missing' | 'bad_status' } {
    const existing = this.getPaymentOrder(orderId);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.method !== 'card' || existing.status !== 'pending') {
      return { ok: false, reason: 'bad_status' };
    }

    const tx = db.transaction(() => {
      const updated = db
        .prepare(
          `UPDATE payment_orders
           SET status = 'approved',
               admin_note = ?,
               reviewed_at = datetime('now')
           WHERE id = ? AND status = 'pending'`
        )
        .run(note?.trim() || null, orderId);
      if (updated.changes !== 1) throw new Error('BAD_STATUS');
      db.prepare(`UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?`).run(
        existing.coins,
        existing.userId
      );
      this.appendWalletLedger({
        userId: existing.userId,
        currency: 'coins',
        amount: existing.coins,
        direction: 'credit',
        reason: 'خرید سکه (کارت به کارت)',
        refType: 'payment_order',
        refId: orderId,
      });
    });

    try {
      tx();
    } catch (err) {
      if (err instanceof Error && err.message === 'BAD_STATUS') {
        return { ok: false, reason: 'bad_status' };
      }
      throw err;
    }

    const order = this.getPaymentOrder(orderId)!;
    const user = this.getUserById(existing.userId)!;
    return { ok: true, order, user };
  },

  rejectCardPayment(
    orderId: number,
    note?: string
  ):
    | { ok: true; order: PaymentOrder; user: User | null }
    | { ok: false; reason: 'missing' | 'bad_status' } {
    const existing = this.getPaymentOrder(orderId);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.method !== 'card' || existing.status !== 'pending') {
      return { ok: false, reason: 'bad_status' };
    }
    let adminNote = note?.trim() || null;
    if (String(existing.packageId) === 'shopcard' && existing.adminNote?.trim().startsWith('{')) {
      try {
        const meta = JSON.parse(existing.adminNote) as Record<string, unknown>;
        meta.rejectNote = note?.trim() || undefined;
        meta.rejected = true;
        adminNote = JSON.stringify(meta);
      } catch {
        /* keep plain note */
      }
    }
    const updated = db
      .prepare(
        `UPDATE payment_orders
         SET status = 'rejected',
             admin_note = ?,
             reviewed_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      )
      .run(adminNote, orderId);
    if (updated.changes !== 1) return { ok: false, reason: 'bad_status' };
    return {
      ok: true,
      order: this.getPaymentOrder(orderId)!,
      user: this.getUserById(existing.userId),
    };
  },

  completeStarsPayment(input: {
    orderId: number;
    telegramPaymentChargeId: string;
  }):
    | { ok: true; order: PaymentOrder; user: User; credited: boolean; creditKind: 'coins' | 'wallet_stars' }
    | { ok: false; reason: 'missing' | 'bad_status' | 'already' } {
    const existing = this.getPaymentOrder(input.orderId);
    if (!existing) return { ok: false, reason: 'missing' };
    if (existing.method !== 'stars') return { ok: false, reason: 'bad_status' };
    if (existing.status === 'paid') {
      return {
        ok: true,
        order: existing,
        user: this.getUserById(existing.userId)!,
        credited: false,
        creditKind: String(existing.packageId || '').startsWith('wstars:') ? 'wallet_stars' : 'coins',
      };
    }
    if (existing.status !== 'awaiting_stars') return { ok: false, reason: 'bad_status' };

    const isWalletStarsTopUp = String(existing.packageId || '').startsWith('wstars:');
    const starsAmount = Math.max(0, Math.floor(Number(existing.amountStars ?? 0)));
    const coinsAmount = Math.max(0, Math.floor(Number(existing.coins ?? 0)));

    const chargeId = input.telegramPaymentChargeId.trim();
    const tx = db.transaction(() => {
      const updated = db
        .prepare(
          `UPDATE payment_orders
           SET status = 'paid',
               telegram_payment_charge_id = ?,
               reviewed_at = datetime('now')
           WHERE id = ? AND status = 'awaiting_stars'`
        )
        .run(chargeId || null, input.orderId);
      if (updated.changes !== 1) throw new Error('BAD_STATUS');

      if (isWalletStarsTopUp) {
        const credit = starsAmount > 0 ? starsAmount : coinsAmount;
        if (credit <= 0) throw new Error('BAD_AMOUNT');
        db.prepare(
          `UPDATE users SET wallet_stars = COALESCE(wallet_stars, 0) + ? WHERE id = ?`
        ).run(credit, existing.userId);
        this.appendWalletLedger({
          userId: existing.userId,
          currency: 'stars',
          amount: credit,
          direction: 'credit',
          reason: 'شارژ ستاره با Telegram Stars (واریز به ربات)',
          refType: 'payment_order',
          refId: input.orderId,
        });
      } else {
        db.prepare(`UPDATE users SET coins = COALESCE(coins, 0) + ? WHERE id = ?`).run(
          coinsAmount,
          existing.userId
        );
        this.appendWalletLedger({
          userId: existing.userId,
          currency: 'coins',
          amount: coinsAmount,
          direction: 'credit',
          reason: 'خرید سکه (ستاره‌های تلگرام)',
          refType: 'payment_order',
          refId: input.orderId,
        });
      }
    });

    try {
      tx();
    } catch (err) {
      if (err instanceof Error && err.message === 'BAD_STATUS') {
        const again = this.getPaymentOrder(input.orderId);
        if (again?.status === 'paid') {
          return {
            ok: true,
            order: again,
            user: this.getUserById(existing.userId)!,
            credited: false,
            creditKind: isWalletStarsTopUp ? 'wallet_stars' : 'coins',
          };
        }
        return { ok: false, reason: 'bad_status' };
      }
      throw err;
    }

    return {
      ok: true,
      order: this.getPaymentOrder(input.orderId)!,
      user: this.getUserById(existing.userId)!,
      credited: true,
      creditKind: isWalletStarsTopUp ? 'wallet_stars' : 'coins',
    };
  },

  getPetMedicalRecord(petId: number): PetMedicalRecord {
    const row = db
      .prepare(`SELECT * FROM pet_medical_records WHERE pet_id = ?`)
      .get(petId) as Record<string, unknown> | undefined;
    if (!row) {
      return {
        petId,
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      petId: Number(row.pet_id),
      notes: (row.notes as string) || undefined,
      vaccinations: (row.vaccinations as string) || undefined,
      allergies: (row.allergies as string) || undefined,
      chronicConditions: (row.chronic_conditions as string) || undefined,
      lastCheckup: (row.last_checkup as string) || undefined,
      medications: (row.medications as string) || undefined,
      lastUpdatedByUserId:
        row.last_updated_by_user_id != null
          ? Number(row.last_updated_by_user_id)
          : undefined,
      lastUpdatedByName: (row.last_updated_by_name as string) || undefined,
      updatedAt: String(row.updated_at),
    };
  },

  upsertPetMedicalRecord(
    petId: number,
    patch: Partial<Omit<PetMedicalRecord, 'petId' | 'updatedAt'>>,
    author?: { userId: number; name?: string; consultId?: number; appendEntries?: boolean }
  ): PetMedicalRecord {
    const current = this.getPetMedicalRecord(petId);
    const next = {
      notes: patch.notes !== undefined ? patch.notes : current.notes,
      vaccinations: patch.vaccinations !== undefined ? patch.vaccinations : current.vaccinations,
      allergies: patch.allergies !== undefined ? patch.allergies : current.allergies,
      chronicConditions:
        patch.chronicConditions !== undefined
          ? patch.chronicConditions
          : current.chronicConditions,
      lastCheckup: patch.lastCheckup !== undefined ? patch.lastCheckup : current.lastCheckup,
      medications: patch.medications !== undefined ? patch.medications : current.medications,
    };

    let authorUserId: number | null =
      author?.userId ??
      (patch.lastUpdatedByUserId !== undefined
        ? patch.lastUpdatedByUserId
        : current.lastUpdatedByUserId ?? null);
    let authorName: string | null =
      (author?.name && author.name.trim()) ||
      (patch.lastUpdatedByName !== undefined
        ? patch.lastUpdatedByName || null
        : current.lastUpdatedByName ?? null);

    if (author?.userId != null && !authorName) {
      const u = this.getUserById(author.userId);
      authorName = u?.name ?? null;
      authorUserId = author.userId;
    }

    db.prepare(
      `INSERT INTO pet_medical_records (
         pet_id, notes, vaccinations, allergies, chronic_conditions, last_checkup, medications,
         last_updated_by_user_id, last_updated_by_name, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(pet_id) DO UPDATE SET
         notes = excluded.notes,
         vaccinations = excluded.vaccinations,
         allergies = excluded.allergies,
         chronic_conditions = excluded.chronic_conditions,
         last_checkup = excluded.last_checkup,
         medications = excluded.medications,
         last_updated_by_user_id = COALESCE(excluded.last_updated_by_user_id, pet_medical_records.last_updated_by_user_id),
         last_updated_by_name = COALESCE(excluded.last_updated_by_name, pet_medical_records.last_updated_by_name),
         updated_at = datetime('now')`
    ).run(
      petId,
      next.notes ?? null,
      next.vaccinations ?? null,
      next.allergies ?? null,
      next.chronicConditions ?? null,
      next.lastCheckup ?? null,
      next.medications ?? null,
      authorUserId,
      authorName
    );

    const shouldAppend = author?.appendEntries !== false && author?.userId != null;
    if (shouldAppend) {
      const fields: PetMedicalField[] = [
        'notes',
        'vaccinations',
        'allergies',
        'chronicConditions',
        'lastCheckup',
        'medications',
      ];
      for (const field of fields) {
        if (patch[field] === undefined) continue;
        const before = (current[field] || '').trim();
        const after = (next[field] || '').trim();
        if (before === after) continue;
        const label = PET_MEDICAL_FIELD_LABELS[field];
        const body = after || '— (پاک شد)';
        this.addPetMedicalEntry({
          petId,
          authorUserId: author!.userId,
          authorName: authorName || undefined,
          consultId: author?.consultId,
          text: `✏️ به‌روزرسانی «${label}»:\n${body}`,
        });
      }
    }

    return this.getPetMedicalRecord(petId);
  },

  listPetMedicalEntries(petId: number, limit = 20): PetMedicalEntry[] {
    const rows = db
      .prepare(
        `SELECT e.*,
                COALESCE(NULLIF(trim(e.author_name), ''), u.name) AS author_name
         FROM pet_medical_entries e
         LEFT JOIN users u ON u.id = e.author_user_id
         WHERE e.pet_id = ?
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT ?`
      )
      .all(petId, limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      petId: Number(row.pet_id),
      authorUserId: Number(row.author_user_id),
      authorName: (row.author_name as string) || undefined,
      consultId: row.consult_id != null ? Number(row.consult_id) : undefined,
      text: String(row.text),
      createdAt: String(row.created_at),
    }));
  },

  addPetMedicalEntry(input: {
    petId: number;
    authorUserId: number;
    text: string;
    consultId?: number;
    authorName?: string;
  }): PetMedicalEntry {
    let authorName = (input.authorName || '').trim();
    if (!authorName) {
      const u = this.getUserById(input.authorUserId);
      authorName = u?.name?.trim() || '';
    }
    const result = db
      .prepare(
        `INSERT INTO pet_medical_entries (pet_id, author_user_id, author_name, consult_id, text)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        input.petId,
        input.authorUserId,
        authorName || null,
        input.consultId ?? null,
        input.text.trim()
      );
    const rows = this.listPetMedicalEntries(input.petId, 5);
    return (
      rows.find((e) => e.id === Number(result.lastInsertRowid)) ?? {
        id: Number(result.lastInsertRowid),
        petId: input.petId,
        authorUserId: input.authorUserId,
        authorName: authorName || undefined,
        consultId: input.consultId,
        text: input.text.trim(),
        createdAt: new Date().toISOString(),
      }
    );
  },

  /** آیا کاربر (دامپزشک با سابقه مشاوره یا صاحب پت) به پرونده دسترسی دارد */
  canAccessPetMedical(
    petId: number,
    viewerUserId: number,
    opts?: { write?: boolean }
  ): { ok: true; asOwner: boolean; asVet: boolean } | { ok: false } {
    const pet = this.getPet(petId);
    if (!pet) return { ok: false };
    if (pet.ownerId === viewerUserId) {
      return { ok: true, asOwner: true, asVet: false };
    }
    const write = Boolean(opts?.write);
    // Write: only during an active consult. Read: any prior consult so history stays with the pet file.
    const statusClause = write
      ? `status = 'active'`
      : `status IN ('active', 'requested', 'completed', 'cancelled', 'expired') OR chat_ended = 1`;
    const active = db
      .prepare(
        `SELECT id FROM vet_consultations
         WHERE pet_id = ? AND vet_user_id = ? AND (${statusClause})
         LIMIT 1`
      )
      .get(petId, viewerUserId);
    if (active) return { ok: true, asOwner: false, asVet: true };
    const byPatient = db
      .prepare(
        `SELECT id FROM vet_consultations
         WHERE patient_user_id = ? AND vet_user_id = ? AND (${statusClause})
         LIMIT 1`
      )
      .get(pet.ownerId, viewerUserId);
    if (byPatient) return { ok: true, asOwner: false, asVet: true };
    return { ok: false };
  },

  createPrescription(input: {
    consultId?: number;
    petId: number;
    vetUserId: number;
    patientUserId: number;
    text: string;
    pdfPath?: string;
  }): Prescription {
    const result = db
      .prepare(
        `INSERT INTO prescriptions (
           consult_id, pet_id, vet_user_id, patient_user_id, text, pdf_path
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.consultId ?? null,
        input.petId,
        input.vetUserId,
        input.patientUserId,
        input.text.trim(),
        input.pdfPath ?? null
      );
    return this.getPrescription(Number(result.lastInsertRowid))!;
  },

  updatePrescriptionPdfPath(id: number, pdfPath: string): Prescription | null {
    const existing = this.getPrescription(id);
    if (!existing) return null;
    db.prepare(`UPDATE prescriptions SET pdf_path = ? WHERE id = ?`).run(pdfPath, id);
    return this.getPrescription(id);
  },

  getPrescription(id: number): Prescription | null {
    const row = db
      .prepare(
        `SELECT pr.*,
                vet.name AS vet_name,
                patient.name AS patient_name,
                pets.name AS pet_name,
                pets.species AS pet_species,
                pets.breed AS pet_breed
         FROM prescriptions pr
         LEFT JOIN users vet ON vet.id = pr.vet_user_id
         LEFT JOIN users patient ON patient.id = pr.patient_user_id
         LEFT JOIN pets ON pets.id = pr.pet_id
         WHERE pr.id = ?`
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return mapPrescription(row);
  },

  listPrescriptionsForPet(petId: number, limit = 20): Prescription[] {
    const rows = db
      .prepare(
        `SELECT pr.*,
                vet.name AS vet_name,
                patient.name AS patient_name,
                pets.name AS pet_name,
                pets.species AS pet_species,
                pets.breed AS pet_breed
         FROM prescriptions pr
         LEFT JOIN users vet ON vet.id = pr.vet_user_id
         LEFT JOIN users patient ON patient.id = pr.patient_user_id
         LEFT JOIN pets ON pets.id = pr.pet_id
         WHERE pr.pet_id = ?
         ORDER BY pr.created_at DESC, pr.id DESC
         LIMIT ?`
      )
      .all(petId, limit) as Record<string, unknown>[];
    return rows.map(mapPrescription);
  },

  listPetWishlist(petId: number): PetProfile[] {
    const rows = db
      .prepare(
        `SELECT target_pet_id FROM pet_wishlists WHERE pet_id = ? ORDER BY created_at DESC, id DESC`
      )
      .all(petId) as { target_pet_id: number }[];
    return rows
      .map((r) => this.getPet(Number(r.target_pet_id)))
      .filter((p): p is PetProfile => Boolean(p));
  },

  addPetWishlist(
    petId: number,
    targetPetId: number
  ): { ok: true; created: boolean } | { ok: false; reason: string } {
    if (petId === targetPetId) return { ok: false, reason: 'self' };
    if (!this.getPet(petId) || !this.getPet(targetPetId)) return { ok: false, reason: 'missing' };
    try {
      const info = db
        .prepare(
          `INSERT INTO pet_wishlists (pet_id, target_pet_id) VALUES (?, ?)`
        )
        .run(petId, targetPetId);
      return { ok: true, created: info.changes > 0 };
    } catch {
      return { ok: true, created: false };
    }
  },

  removePetWishlist(petId: number, targetPetId: number): boolean {
    const info = db
      .prepare(`DELETE FROM pet_wishlists WHERE pet_id = ? AND target_pet_id = ?`)
      .run(petId, targetPetId);
    return info.changes > 0;
  },

  addUserContact(
    userId: number,
    contactUserId: number
  ): { ok: true; created: boolean; contact: { id: number; userId: number; contactUserId: number; createdAt: string } } | { ok: false; reason: 'self' | 'missing_user' | 'missing_contact' } {
    if (userId === contactUserId) return { ok: false, reason: 'self' };
    if (!this.getUserById(userId)) return { ok: false, reason: 'missing_user' };
    if (!this.getUserById(contactUserId)) return { ok: false, reason: 'missing_contact' };

    const existing = db
      .prepare(
        `SELECT id, user_id, contact_user_id, created_at
         FROM user_contacts
         WHERE user_id = ? AND contact_user_id = ?`
      )
      .get(userId, contactUserId) as
      | { id: number; user_id: number; contact_user_id: number; created_at: string }
      | undefined;
    if (existing) {
      return {
        ok: true,
        created: false,
        contact: {
          id: existing.id,
          userId: existing.user_id,
          contactUserId: existing.contact_user_id,
          createdAt: existing.created_at,
        },
      };
    }

    const result = db
      .prepare(
        `INSERT INTO user_contacts (user_id, contact_user_id) VALUES (?, ?)`
      )
      .run(userId, contactUserId);
    const row = db
      .prepare(
        `SELECT id, user_id, contact_user_id, created_at FROM user_contacts WHERE id = ?`
      )
      .get(Number(result.lastInsertRowid)) as {
      id: number;
      user_id: number;
      contact_user_id: number;
      created_at: string;
    };
    return {
      ok: true,
      created: true,
      contact: {
        id: row.id,
        userId: row.user_id,
        contactUserId: row.contact_user_id,
        createdAt: row.created_at,
      },
    };
  },

  listUserContacts(userId: number): Array<{
    id: number;
    userId: number;
    contactUserId: number;
    createdAt: string;
    contactName?: string;
    contactUsername?: string;
  }> {
    const rows = db
      .prepare(
        `SELECT c.id, c.user_id, c.contact_user_id, c.created_at,
                u.name AS contact_name, u.username AS contact_username
         FROM user_contacts c
         LEFT JOIN users u ON u.id = c.contact_user_id
         WHERE c.user_id = ?
         ORDER BY c.created_at DESC, c.id DESC`
      )
      .all(userId) as Array<{
      id: number;
      user_id: number;
      contact_user_id: number;
      created_at: string;
      contact_name: string | null;
      contact_username: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      contactUserId: row.contact_user_id,
      createdAt: row.created_at,
      contactName: row.contact_name || undefined,
      contactUsername: row.contact_username || undefined,
    }));
  },

  countUserContacts(userId: number): number {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM user_contacts WHERE user_id = ?`)
      .get(userId) as { c: number } | undefined;
    return Number(row?.c ?? 0);
  },

  countUserBlocks(userId: number): number {
    const row = db
      .prepare(`SELECT COUNT(*) AS c FROM user_blocks WHERE user_id = ?`)
      .get(userId) as { c: number } | undefined;
    return Number(row?.c ?? 0);
  },

  /** غنی‌سازی آمار کارت پروفایل (مخاطب / بلاک / تعاملات) */
  getProfileCardExtras(userId: number): {
    contactsCount: number;
    blockedCount: number;
    interactions: {
      likes: number;
      views: number;
      playdatesTotal: number;
      playdatesPending: number;
      playdatesAccepted: number;
    };
  } | null {
    const user = this.getUserById(userId);
    if (!user) return null;
    const playdates = this.listPlaydateRequests({ userId });
    return {
      contactsCount: this.countUserContacts(userId),
      blockedCount: this.countUserBlocks(userId),
      interactions: {
        likes: user.likesCount ?? 0,
        views: user.profileViews ?? 0,
        playdatesTotal: playdates.length,
        playdatesPending: playdates.filter((p) => p.status === 'pending').length,
        playdatesAccepted: playdates.filter((p) => p.status === 'accepted').length,
      },
    };
  },

  enrichUserProfileCard(user: User): User {
    const extras = this.getProfileCardExtras(user.id);
    if (!extras) return user;
    return {
      ...user,
      contactsCount: extras.contactsCount,
      blockedCount: extras.blockedCount,
    };
  },

  listUserBlocks(userId: number): Array<{
    id: number;
    userId: number;
    blockedUserId: number;
    createdAt: string;
    blockedName?: string;
    blockedUsername?: string;
  }> {
    const rows = db
      .prepare(
        `SELECT b.id, b.user_id, b.blocked_user_id, b.created_at,
                u.name AS blocked_name, u.username AS blocked_username
         FROM user_blocks b
         LEFT JOIN users u ON u.id = b.blocked_user_id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC, b.id DESC`
      )
      .all(userId) as Array<{
      id: number;
      user_id: number;
      blocked_user_id: number;
      created_at: string;
      blocked_name: string | null;
      blocked_username: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      blockedUserId: row.blocked_user_id,
      createdAt: row.created_at,
      blockedName: row.blocked_name || undefined,
      blockedUsername: row.blocked_username || undefined,
    }));
  },

  addUserBlock(
    userId: number,
    blockedUserId: number
  ):
    | { ok: true; created: boolean; block: { id: number; userId: number; blockedUserId: number; createdAt: string } }
    | { ok: false; reason: 'self' | 'missing_user' | 'missing_blocked' } {
    if (userId === blockedUserId) return { ok: false, reason: 'self' };
    if (!this.getUserById(userId)) return { ok: false, reason: 'missing_user' };
    if (!this.getUserById(blockedUserId)) return { ok: false, reason: 'missing_blocked' };

    const existing = db
      .prepare(
        `SELECT id, user_id, blocked_user_id, created_at
         FROM user_blocks WHERE user_id = ? AND blocked_user_id = ?`
      )
      .get(userId, blockedUserId) as
      | { id: number; user_id: number; blocked_user_id: number; created_at: string }
      | undefined;
    if (existing) {
      return {
        ok: true,
        created: false,
        block: {
          id: existing.id,
          userId: existing.user_id,
          blockedUserId: existing.blocked_user_id,
          createdAt: existing.created_at,
        },
      };
    }
    const result = db
      .prepare(`INSERT INTO user_blocks (user_id, blocked_user_id) VALUES (?, ?)`)
      .run(userId, blockedUserId);
    const row = db
      .prepare(`SELECT id, user_id, blocked_user_id, created_at FROM user_blocks WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as {
      id: number;
      user_id: number;
      blocked_user_id: number;
      created_at: string;
    };
    return {
      ok: true,
      created: true,
      block: {
        id: row.id,
        userId: row.user_id,
        blockedUserId: row.blocked_user_id,
        createdAt: row.created_at,
      },
    };
  },

  removeUserBlock(userId: number, blockedUserId: number): boolean {
    const result = db
      .prepare(`DELETE FROM user_blocks WHERE user_id = ? AND blocked_user_id = ?`)
      .run(userId, blockedUserId);
    return result.changes > 0;
  },

  isUserBlocked(userId: number, otherUserId: number): boolean {
    const row = db
      .prepare(
        `SELECT 1 AS ok FROM user_blocks
         WHERE (user_id = ? AND blocked_user_id = ?)
            OR (user_id = ? AND blocked_user_id = ?)
         LIMIT 1`
      )
      .get(userId, otherUserId, otherUserId, userId) as { ok: number } | undefined;
    return Boolean(row);
  },

  getUserByPhone(phone: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE phone = ? ORDER BY id DESC LIMIT 1').get(phone) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  getUserByEmail(email: string): User | null {
    const row = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY id DESC LIMIT 1')
      .get(email) as Record<string, unknown> | undefined;
    return row ? mapUser(row) : null;
  },

  /**
   * Merge bot↔web identity onto one users row so pets/chats/matches stay shared.
   * Prefer the account that already has telegramId; otherwise keep the older id.
   */
  mergeUsers(survivorId: number, absorbedId: number): User | null {
    if (survivorId === absorbedId) return this.getUserById(survivorId);
    const survivor = this.getUserById(survivorId);
    const absorbed = this.getUserById(absorbedId);
    if (!survivor || !absorbed) return survivor ?? absorbed ?? null;

    const patch: Record<string, unknown> = {};
    if (!survivor.telegramId && absorbed.telegramId) patch.telegram_id = absorbed.telegramId;
    if (!survivor.phone && absorbed.phone) {
      patch.phone = absorbed.phone;
      patch.phone_verified = absorbed.phoneVerified ? 1 : 0;
      patch.phone_verified_at = absorbed.phoneVerifiedAt ?? null;
    }
    if (!survivor.email && absorbed.email) {
      patch.email = absorbed.email;
      patch.email_verified = absorbed.emailVerified ? 1 : 0;
    }
    if ((!survivor.name || survivor.name === 'کاربر petdate') && absorbed.name) {
      patch.name = absorbed.name;
    }
    if (!survivor.age && absorbed.age) patch.age = absorbed.age;
    if (!survivor.gender && absorbed.gender) patch.gender = absorbed.gender;
    if (!survivor.city && absorbed.city) patch.city = absorbed.city;
    if (!survivor.province && absorbed.province) patch.province = absorbed.province;
    if (!survivor.country && absorbed.country) patch.country = absorbed.country;
    if (!survivor.bio && absorbed.bio) patch.bio = absorbed.bio;
    if (
      (!survivor.roles || survivor.roles.length === 0) &&
      absorbed.roles &&
      absorbed.roles.length
    ) {
      patch.roles = JSON.stringify(absorbed.roles);
      patch.role = absorbed.role ?? absorbed.roles[0] ?? null;
    }
    if (
      survivor.onboarding !== 'profile_complete' &&
      absorbed.onboarding === 'profile_complete'
    ) {
      patch.onboarding = 'profile_complete';
    }

    const fields = Object.keys(patch);
    if (fields.length) {
      db.prepare(
        `UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`
      ).run(...fields.map((f) => patch[f]), survivorId);
    }

    // Sum multi-currency wallets so web↔Telegram link does not drop balances.
    const absCoins = Math.max(0, Math.floor(Number(absorbed.coins ?? 0)));
    const absTon = Math.max(0, Math.floor(Number(absorbed.walletTon ?? absorbed.wallet?.ton ?? 0)));
    const absStars = Math.max(
      0,
      Math.floor(Number(absorbed.walletStars ?? absorbed.wallet?.stars ?? 0))
    );
    const absToman = Math.max(
      0,
      Math.floor(Number(absorbed.walletToman ?? absorbed.wallet?.toman ?? 0))
    );
    if (absCoins || absTon || absStars || absToman) {
      db.prepare(
        `UPDATE users SET
           coins = COALESCE(coins, 0) + ?,
           wallet_ton = COALESCE(wallet_ton, 0) + ?,
           wallet_stars = COALESCE(wallet_stars, 0) + ?,
           wallet_toman = COALESCE(wallet_toman, 0) + ?
         WHERE id = ?`
      ).run(absCoins, absTon, absStars, absToman, survivorId);
      db.prepare(
        `UPDATE users SET coins = 0, wallet_ton = 0, wallet_stars = 0, wallet_toman = 0 WHERE id = ?`
      ).run(absorbedId);
      const syncRef = `merge:${absorbedId}->${survivorId}`;
      if (absCoins) {
        this.appendWalletLedger({
          userId: survivorId,
          currency: 'coins',
          amount: absCoins,
          direction: 'credit',
          reason: 'همگام‌سازی حساب',
          refType: 'account_merge',
          refId: syncRef,
        });
      }
      if (absStars) {
        this.appendWalletLedger({
          userId: survivorId,
          currency: 'stars',
          amount: absStars,
          direction: 'credit',
          reason: 'همگام‌سازی حساب',
          refType: 'account_merge',
          refId: syncRef,
        });
      }
      if (absTon) {
        this.appendWalletLedger({
          userId: survivorId,
          currency: 'ton',
          amount: absTon,
          direction: 'credit',
          reason: 'همگام‌سازی حساب',
          refType: 'account_merge',
          refId: syncRef,
        });
      }
      if (absToman) {
        this.appendWalletLedger({
          userId: survivorId,
          currency: 'toman',
          amount: absToman,
          direction: 'credit',
          reason: 'همگام‌سازی حساب',
          refType: 'account_merge',
          refId: syncRef,
        });
      }
    }

    // Reassign owned data so web + bot share the same pets / requests / sessions.
    db.prepare('UPDATE pets SET owner_id = ? WHERE owner_id = ?').run(survivorId, absorbedId);
    try {
      db.prepare('UPDATE playdate_requests SET from_user_id = ? WHERE from_user_id = ?').run(
        survivorId,
        absorbedId
      );
      db.prepare('UPDATE playdate_requests SET to_user_id = ? WHERE to_user_id = ?').run(
        survivorId,
        absorbedId
      );
    } catch {
      /* older schemas */
    }
    try {
      db.prepare('UPDATE web_sessions SET user_id = ? WHERE user_id = ?').run(survivorId, absorbedId);
    } catch {
      /* ignore */
    }

    // Free unique identity fields on absorbed row and deactivate.
    db.prepare(
      `UPDATE users SET
         telegram_id = CASE WHEN telegram_id IS NOT NULL THEN telegram_id || '_merged_' || id ELSE NULL END,
         phone = NULL,
         email = NULL,
         phone_verified = 0,
         email_verified = 0,
         is_active = 0
       WHERE id = ?`
    ).run(absorbedId);

    return this.getUserById(survivorId);
  },

  pickIdentitySurvivor(a: User, b: User): { survivor: User; absorbed: User } {
    if (a.telegramId && !b.telegramId) return { survivor: a, absorbed: b };
    if (b.telegramId && !a.telegramId) return { survivor: b, absorbed: a };
    if (a.id <= b.id) return { survivor: a, absorbed: b };
    return { survivor: b, absorbed: a };
  },

  /** Attach phone to userId; merge if another row already owns that phone. */
  linkPhoneIdentity(userId: number, phone: string): User | null {
    const other = this.getUserByPhone(phone);
    if (other && other.id !== userId) {
      const me = this.getUserById(userId);
      if (!me) return null;
      const { survivor, absorbed } = this.pickIdentitySurvivor(me, other);
      const merged = this.mergeUsers(survivor.id, absorbed.id);
      if (!merged) return null;
      db.prepare(
        `UPDATE users SET phone = ?, phone_verified = 1, phone_verified_at = datetime('now') WHERE id = ?`
      ).run(phone, merged.id);
      return this.getUserById(merged.id);
    }
    db.prepare(
      `UPDATE users SET phone = ?, phone_verified = 1, phone_verified_at = datetime('now') WHERE id = ?`
    ).run(phone, userId);
    return this.getUserById(userId);
  },

  /**
   * Attach Telegram id to a web user; merge if another row already owns that telegram_id.
   * Used by wallet «همگام‌سازی تلگرام» deep-link completion.
   */
  linkTelegramIdentity(
    userId: number,
    telegramId: string,
    opts?: { username?: string; name?: string }
  ):
    | { ok: true; user: User; merged: boolean }
    | { ok: false; reason: string; error: string } {
    const tg = String(telegramId ?? '').trim();
    if (!/^\d{3,20}$/.test(tg)) {
      return { ok: false, reason: 'invalid_tg', error: 'شناسه تلگرام نامعتبر است' };
    }
    const me = this.getUserById(userId);
    if (!me) {
      return { ok: false, reason: 'missing_user', error: 'کاربر پیدا نشد' };
    }
    if (me.telegramId && me.telegramId !== tg) {
      return {
        ok: false,
        reason: 'already_linked_other',
        error: 'این حساب وب قبلاً به تلگرام دیگری وصل است',
      };
    }
    if (me.telegramId === tg) {
      return { ok: true, user: me, merged: false };
    }

    const other = this.getUserByTelegramId(tg);
    if (other && other.id !== me.id) {
      const { survivor, absorbed } = this.pickIdentitySurvivor(me, other);
      const merged = this.mergeUsers(survivor.id, absorbed.id);
      if (!merged) {
        return { ok: false, reason: 'merge_failed', error: 'ادغام حساب‌ها ممکن نشد' };
      }
      if (!merged.telegramId) {
        db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(tg, merged.id);
      }
      if (opts?.username) {
        db.prepare(`UPDATE users SET username = COALESCE(username, ?) WHERE id = ?`).run(
          opts.username,
          merged.id
        );
      }
      return { ok: true, user: this.getUserById(merged.id)!, merged: true };
    }

    db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(tg, me.id);
    if (opts?.username) {
      db.prepare(`UPDATE users SET username = COALESCE(username, ?) WHERE id = ?`).run(
        opts.username,
        me.id
      );
    }
    if (opts?.name && (!me.name || me.name === 'کاربر petdate')) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(opts.name, me.id);
    }
    return { ok: true, user: this.getUserById(me.id)!, merged: false };
  },

  createTelegramAttachToken(userId: number, token: string, expiresAt: string) {
    db.prepare(
      `INSERT INTO telegram_attach_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
    ).run(token, userId, expiresAt);
  },

  createTelegramLoginPending(id: string, nextPath: string, expiresAt: string) {
    db.prepare(
      `INSERT INTO telegram_login_pending (id, next_path, status, expires_at)
       VALUES (?, ?, 'pending', ?)`
    ).run(id, nextPath, expiresAt);
  },

  getTelegramLoginPending(id: string): {
    id: string;
    nextPath: string;
    status: string;
    telegramId: string | null;
    userId: number | null;
    sessionToken: string | null;
    expiresAt: string;
    consumedAt: string | null;
  } | null {
    const row = db
      .prepare(
        `SELECT id, next_path, status, telegram_id, user_id, session_token, expires_at, consumed_at
         FROM telegram_login_pending WHERE id = ?`
      )
      .get(id) as
      | {
          id: string;
          next_path: string;
          status: string;
          telegram_id: string | null;
          user_id: number | null;
          session_token: string | null;
          expires_at: string;
          consumed_at: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      nextPath: String(row.next_path || '/home'),
      status: String(row.status),
      telegramId: row.telegram_id != null ? String(row.telegram_id) : null,
      userId: row.user_id != null ? Number(row.user_id) : null,
      sessionToken: row.session_token != null ? String(row.session_token) : null,
      expiresAt: String(row.expires_at),
      consumedAt: row.consumed_at != null ? String(row.consumed_at) : null,
    };
  },

  /** Mark pending login ready with a one-time session token (bot confirm). */
  markTelegramLoginPendingReady(input: {
    id: string;
    telegramId: string;
    userId: number;
    sessionToken: string;
  }): boolean {
    const upd = db
      .prepare(
        `UPDATE telegram_login_pending
         SET status = 'ready',
             telegram_id = ?,
             user_id = ?,
             session_token = ?
         WHERE id = ? AND status = 'pending' AND consumed_at IS NULL
           AND datetime(expires_at) >= datetime('now')`
      )
      .run(input.telegramId, input.userId, input.sessionToken, input.id);
    return upd.changes > 0;
  },

  /** One-time consume of a ready pending login (browser poll). */
  consumeTelegramLoginPending(id: string): {
    sessionToken: string;
    userId: number;
    nextPath: string;
  } | null {
    const row = this.getTelegramLoginPending(id);
    if (!row) return null;
    if (row.consumedAt || row.status === 'consumed') return null;
    const expMs = Date.parse(row.expiresAt);
    if (!Number.isFinite(expMs) || expMs < Date.now()) {
      db.prepare(
        `UPDATE telegram_login_pending SET status = 'expired' WHERE id = ? AND status = 'pending'`
      ).run(id);
      return null;
    }
    if (row.status !== 'ready' || !row.sessionToken || row.userId == null) return null;
    const upd = db
      .prepare(
        `UPDATE telegram_login_pending
         SET status = 'consumed', consumed_at = datetime('now'), session_token = NULL
         WHERE id = ? AND status = 'ready' AND consumed_at IS NULL`
      )
      .run(id);
    if (upd.changes === 0) return null;
    return {
      sessionToken: row.sessionToken,
      userId: row.userId,
      nextPath: row.nextPath,
    };
  },

  cancelTelegramLoginPending(id: string): boolean {
    const upd = db
      .prepare(
        `UPDATE telegram_login_pending
         SET status = 'expired'
         WHERE id = ? AND status IN ('pending', 'ready') AND consumed_at IS NULL`
      )
      .run(id);
    return upd.changes > 0;
  },

  /** Consume a one-time attach token if still valid; returns owning web userId. */
  consumeTelegramAttachToken(token: string): { userId: number } | null {
    const row = db
      .prepare(
        `SELECT token, user_id, expires_at, used_at FROM telegram_attach_tokens WHERE token = ?`
      )
      .get(token) as
      | { token: string; user_id: number; expires_at: string; used_at: string | null }
      | undefined;
    if (!row) return null;
    if (row.used_at) return null;
    const expMs = Date.parse(row.expires_at);
    if (!Number.isFinite(expMs) || expMs < Date.now()) return null;
    const upd = db
      .prepare(
        `UPDATE telegram_attach_tokens
         SET used_at = datetime('now')
         WHERE token = ? AND used_at IS NULL`
      )
      .run(token);
    if (upd.changes === 0) return null;
    return { userId: Number(row.user_id) };
  },

  /** Attach email to userId; merge if another row already owns that email. */
  linkEmailIdentity(userId: number, email: string): User | null {
    const other = this.getUserByEmail(email);
    if (other && other.id !== userId) {
      const me = this.getUserById(userId);
      if (!me) return null;
      const { survivor, absorbed } = this.pickIdentitySurvivor(me, other);
      const merged = this.mergeUsers(survivor.id, absorbed.id);
      if (!merged) return null;
      db.prepare(`UPDATE users SET email = ?, email_verified = 1 WHERE id = ?`).run(email, merged.id);
      return this.getUserById(merged.id);
    }
    db.prepare(`UPDATE users SET email = ?, email_verified = 1 WHERE id = ?`).run(email, userId);
    return this.getUserById(userId);
  },

  findOrCreateWebUser(opts: { phone?: string; email?: string; name?: string }): User {
    let byPhone = opts.phone ? this.getUserByPhone(opts.phone) : null;
    let byEmail = opts.email ? this.getUserByEmail(opts.email) : null;

    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      const { survivor, absorbed } = this.pickIdentitySurvivor(byPhone, byEmail);
      const merged = this.mergeUsers(survivor.id, absorbed.id);
      byPhone = merged;
      byEmail = merged;
    }

    const existing = byPhone ?? byEmail;
    if (existing) {
      if (opts.phone && existing.phone !== opts.phone) {
        return this.linkPhoneIdentity(existing.id, opts.phone) ?? existing;
      }
      if (opts.email && existing.email !== opts.email) {
        return this.linkEmailIdentity(existing.id, opts.email) ?? existing;
      }
      return existing;
    }

    const name = (opts.name && opts.name.trim()) || 'کاربر petdate';
    const result = db
      .prepare(
        `INSERT INTO users (name, phone, email, phone_verified, email_verified, onboarding, roles, role)
         VALUES (?, ?, ?, ?, ?, 'profile_incomplete', '[]', NULL)`
      )
      .run(
        name,
        opts.phone ?? null,
        opts.email ?? null,
        opts.phone ? 1 : 0,
        opts.email ? 1 : 0
      );
    const newId = Number(result.lastInsertRowid);
    db.prepare('UPDATE users SET public_id = ? WHERE id = ?').run(makeUserPublicId(newId), newId);
    const user = this.getUserById(newId);
    if (!user) throw new Error('failed to create web user');
    return user;
  },

  markEmailVerified(userId: number, email: string): User | null {
    return this.linkEmailIdentity(userId, email);
  },

  upsertWebOtp(data: { channel: string; target: string; codeHash: string; expiresAt: string }) {
    db.prepare('DELETE FROM web_otps WHERE channel = ? AND target = ?').run(data.channel, data.target);
    db.prepare(
      `INSERT INTO web_otps (channel, target, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)`
    ).run(data.channel, data.target, data.codeHash, data.expiresAt);
  },

  getWebOtp(channel: string, target: string): { channel: string; target: string; codeHash: string; expiresAt: string; attempts: number; createdAt: string } | null {
    const row = db
      .prepare('SELECT * FROM web_otps WHERE channel = ? AND target = ?')
      .get(channel, target) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      channel: String(row.channel),
      target: String(row.target),
      codeHash: String(row.code_hash),
      expiresAt: String(row.expires_at),
      attempts: Number(row.attempts ?? 0),
      createdAt: String(row.created_at),
    };
  },

  bumpWebOtpAttempts(channel: string, target: string): number {
    db.prepare('UPDATE web_otps SET attempts = attempts + 1 WHERE channel = ? AND target = ?').run(channel, target);
    const row = this.getWebOtp(channel, target);
    return row?.attempts ?? 99;
  },

  deleteWebOtp(channel: string, target: string) {
    db.prepare('DELETE FROM web_otps WHERE channel = ? AND target = ?').run(channel, target);
  },

  listPendingWebOtps(channel?: string, limit = 40): Array<{
    channel: string;
    target: string;
    expiresAt: string;
    attempts: number;
    createdAt: string;
  }> {
    const lim = Math.min(Math.max(limit, 1), 100);
    const nowIso = new Date().toISOString();
    const rows = channel
      ? (db
          .prepare(
            `SELECT channel, target, expires_at, attempts, created_at
             FROM web_otps
             WHERE channel = ? AND expires_at > ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(channel, nowIso, lim) as Record<string, unknown>[])
      : (db
          .prepare(
            `SELECT channel, target, expires_at, attempts, created_at
             FROM web_otps
             WHERE expires_at > ?
             ORDER BY created_at DESC LIMIT ?`
          )
          .all(nowIso, lim) as Record<string, unknown>[]);
    return rows.map((row) => ({
      channel: String(row.channel),
      target: String(row.target),
      expiresAt: String(row.expires_at),
      attempts: Number(row.attempts ?? 0),
      createdAt: String(row.created_at),
    }));
  },

  createEmailSendLog(data: {
    to: string;
    subject: string;
    purpose?: string;
    ok: boolean;
    error?: string | null;
  }): { id: number } {
    const result = db
      .prepare(
        `INSERT INTO email_send_logs (to_addr, subject, purpose, ok, error)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        data.to.slice(0, 320),
        data.subject.slice(0, 240),
        (data.purpose || 'mail').slice(0, 64),
        data.ok ? 1 : 0,
        data.error ? data.error.slice(0, 500) : null
      );
    return { id: Number(result.lastInsertRowid) };
  },

  /** Subscribe email to newsletter (idempotent). Returns whether newly inserted. */
  upsertNewsletterSubscriber(
    email: string,
    source = 'footer'
  ): { id: number; created: boolean } {
    const addr = email.trim().toLowerCase().slice(0, 320);
    const existing = db
      .prepare(`SELECT id FROM newsletter_subscribers WHERE email = ? COLLATE NOCASE`)
      .get(addr) as { id: number } | undefined;
    if (existing) {
      return { id: Number(existing.id), created: false };
    }
    const result = db
      .prepare(
        `INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)`
      )
      .run(addr, (source || 'footer').slice(0, 64));
    return { id: Number(result.lastInsertRowid), created: true };
  },

  listNewsletterSubscribers(opts?: { limit?: number }): Array<{
    id: number;
    email: string;
    source: string;
    createdAt: string;
  }> {
    const lim = Math.min(Math.max(opts?.limit ?? 200, 1), 2000);
    const rows = db
      .prepare(
        `SELECT id, email, source, created_at
         FROM newsletter_subscribers
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(lim) as Array<{ id: number; email: string; source: string; created_at: string }>;
    return rows.map((r) => ({
      id: Number(r.id),
      email: String(r.email),
      source: String(r.source || 'footer'),
      createdAt: String(r.created_at),
    }));
  },

  countNewsletterSubscribers(): number {
    const row = db.prepare(`SELECT COUNT(*) as c FROM newsletter_subscribers`).get() as {
      c: number;
    };
    return Number(row?.c ?? 0);
  },

  listEmailSendLogs(opts?: { limit?: number; ok?: boolean }): Array<{
    id: number;
    to: string;
    subject: string;
    purpose: string | null;
    ok: boolean;
    error: string | null;
    createdAt: string;
  }> {
    const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 300);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (typeof opts?.ok === 'boolean') {
      clauses.push('ok = ?');
      params.push(opts.ok ? 1 : 0);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT * FROM email_send_logs ${where} ORDER BY id DESC LIMIT ?`
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      to: String(row.to_addr),
      subject: String(row.subject),
      purpose: (row.purpose as string | null) ?? null,
      ok: Number(row.ok) === 1,
      error: (row.error as string | null) ?? null,
      createdAt: String(row.created_at),
    }));
  },

  getEmailSendLogStats(): {
    total: number;
    ok24h: number;
    fail24h: number;
    lastAt: string | null;
    otpOk24h: number;
    otpFail24h: number;
  } {
    const total = (
      db.prepare('SELECT COUNT(*) as c FROM email_send_logs').get() as { c: number }
    ).c;
    const ok24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM email_send_logs
           WHERE ok = 1 AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const fail24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM email_send_logs
           WHERE ok = 0 AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const otpOk24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM email_send_logs
           WHERE purpose = 'login_otp' AND ok = 1
             AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const otpFail24h = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM email_send_logs
           WHERE purpose = 'login_otp' AND ok = 0
             AND created_at >= datetime('now', '-1 day')`
        )
        .get() as { c: number }
    ).c;
    const last = db
      .prepare(`SELECT created_at FROM email_send_logs ORDER BY id DESC LIMIT 1`)
      .get() as { created_at: string } | undefined;
    return {
      total: Number(total ?? 0),
      ok24h: Number(ok24h ?? 0),
      fail24h: Number(fail24h ?? 0),
      lastAt: last?.created_at ?? null,
      otpOk24h: Number(otpOk24h ?? 0),
      otpFail24h: Number(otpFail24h ?? 0),
    };
  },

  createWebSession(userId: number, token: string, expiresAt: string) {
    db.prepare('INSERT INTO web_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  },

  getWebSession(token: string): { token: string; userId: number; expiresAt: string } | null {
    const row = db.prepare('SELECT * FROM web_sessions WHERE token = ?').get(token) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { token: String(row.token), userId: Number(row.user_id), expiresAt: String(row.expires_at) };
  },

  deleteWebSession(token: string) {
    db.prepare('DELETE FROM web_sessions WHERE token = ?').run(token);
  },

  deleteWebSessionsForUser(userId: number) {
    db.prepare('DELETE FROM web_sessions WHERE user_id = ?').run(userId);
  },

};

function mapPrescription(row: Record<string, unknown>): Prescription {
  return {
    id: Number(row.id),
    consultId: row.consult_id != null ? Number(row.consult_id) : undefined,
    petId: Number(row.pet_id),
    vetUserId: Number(row.vet_user_id),
    patientUserId: Number(row.patient_user_id),
    text: String(row.text),
    pdfPath: (row.pdf_path as string) || undefined,
    createdAt: String(row.created_at),
    vetName: (row.vet_name as string) || undefined,
    patientName: (row.patient_name as string) || undefined,
    petName: (row.pet_name as string) || undefined,
    petSpecies: (row.pet_species as string) || undefined,
    petBreed: (row.pet_breed as string) || undefined,
  };
}
