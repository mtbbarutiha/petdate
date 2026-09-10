/**
 * Admin pets list enrichment — owner join, 6-month spend (Toman), VIP, last event, dossier.
 * Kept separate from db.ts / admin-platform to limit merge conflicts.
 *
 * Date filters (`lastEventFrom` / `lastEventTo`):
 * - Prefer Gregorian `YYYY-MM-DD` (UI converts from Jalali picker).
 * - Also accepts Jalali `YYYY/MM/DD` (or dash form with year 1300–1600) and converts.
 */
import {
  COIN_PRICE_TOMAN,
  userPublicIdOf,
  type PetMedicalEntry,
  type PetMedicalRecord,
  type PetProfile,
} from '@petdate/shared';
import { getDb, dbService } from './db';
import { adminPlatform, type ShopOrderRow } from './admin-platform';

export const ADMIN_PETS_VIP_THRESHOLD_TOMAN = 50_000_000;
export const ADMIN_PETS_SPEND_WINDOW_MONTHS = 6;

/** Paid shop statuses counted toward owner spend. */
export const ADMIN_PETS_PAID_ORDER_STATUSES = ['paid', 'shipped', 'completed'] as const;

export type AdminPetLastEvent = {
  at: string;
  kind: 'purchase' | 'service';
  label: string;
  amountToman?: number;
};

export type AdminPetListRow = PetProfile & {
  ownerName?: string;
  ownerPhone?: string;
  ownerPublicId?: string;
  spendToman6m: number;
  vipOwner: boolean;
  lastEvent: AdminPetLastEvent | null;
};

export type AdminPetsListFilters = {
  q?: string;
  species?: string;
  ownerName?: string;
  ownerPhone?: string;
  lastEventFrom?: string;
  lastEventTo?: string;
};

export type AdminPetDossier = {
  pet: PetProfile;
  owner: {
    id: number;
    name?: string;
    phone?: string;
    publicId: string;
  };
  medicalRecord: PetMedicalRecord;
  medicalEntries: PetMedicalEntry[];
  shopOrders: ShopOrderRow[];
  consults: Array<{
    id: number;
    publicId?: string;
    petId?: number;
    status: string;
    feeCoins?: number;
    feeToman: number;
    notes?: string;
    createdAt: string;
  }>;
  spendToman6m: number;
  vipOwner: boolean;
  lastEvent: AdminPetLastEvent | null;
};

function db() {
  return getDb();
}

/** Convert shop order amount to Toman based on payment_currency. */
export function orderAmountToToman(
  amount: number,
  paymentCurrency?: string | null
): number {
  const n = Number(amount) || 0;
  const cur = String(paymentCurrency || 'toman').trim().toLowerCase();
  if (cur === 'rial' || cur === 'irr') {
    return Math.round(n / 10);
  }
  // toman, irt, or unknown → treat as Toman
  return Math.round(n);
}

/** Consult fee in Toman from fee_coins. */
export function consultFeeToToman(feeCoins?: number | null): number {
  const coins = Number(feeCoins);
  if (!Number.isFinite(coins) || coins <= 0) return 0;
  return Math.round(coins * COIN_PRICE_TOMAN);
}

/**
 * Parse filter date to Gregorian bound string for comparison.
 * Accepts Gregorian `YYYY-MM-DD` or Jalali `YYYY/MM/DD`.
 */
export function parseAdminPetsFilterDate(
  raw: string | undefined,
  bound: 'start' | 'end'
): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const mSlash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  const mDash = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const m = mSlash || mDash;
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  // Jalali years are typically 1300–1500; convert to Gregorian
  if (y >= 1300 && y <= 1600) {
    const g = jalaliToGregorian(y, mo, d);
    y = g.gy;
    mo = g.gm;
    d = g.gd;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${y}-${pad(mo)}-${pad(d)}`;
  if (bound === 'start') return `${day}T00:00:00.000Z`;
  return `${day}T23:59:59.999Z`;
}

/** Jalali → Gregorian (compact). */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  let jy2 = jy <= 979 ? jy : jy - 979;
  let days =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = days > 79 ? 1600 : 621;
  days = days > 79 ? days - 79 : days - (-19 + 365);
  const gy2 = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += gy2 + 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && days >= sal_a[gm]!; gm++) days -= sal_a[gm]!;
  return { gy, gm, gd: days + 1 };
}

function sixMonthsAgoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - ADMIN_PETS_SPEND_WINDOW_MONTHS);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizePhoneDigits(phone: string): string {
  return String(phone || '')
    .replace(/[^\d]/g, '')
    .replace(/^98/, '0');
}

function toIso(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return new Date(0).toISOString();
  if (s.includes('T')) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : s;
  }
  const ms = Date.parse(s.replace(' ', 'T') + 'Z');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : s;
}

/**
 * Batch-compute 6-month Toman spend per owner (shop + consult fees).
 * Shop: convert rial/IRR → /10; consult: fee_coins * COIN_PRICE_TOMAN.
 */
export function batchOwnerSpendToman6m(ownerIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (!ownerIds.length) return map;
  for (const id of ownerIds) map.set(id, 0);

  const since = sixMonthsAgoIso();
  const placeholders = ownerIds.map(() => '?').join(',');
  const paidList = ADMIN_PETS_PAID_ORDER_STATUSES.map((s) => `'${s}'`).join(',');

  const orderRows = db()
    .prepare(
      `SELECT user_id AS owner_id,
              total_toman,
              COALESCE(payment_currency, 'toman') AS payment_currency
       FROM shop_orders
       WHERE user_id IN (${placeholders})
         AND status IN (${paidList})
         AND created_at >= ?`
    )
    .all(...ownerIds, since) as Array<{
    owner_id: number;
    total_toman: number;
    payment_currency: string;
  }>;

  for (const r of orderRows) {
    const add = orderAmountToToman(r.total_toman, r.payment_currency);
    map.set(Number(r.owner_id), (map.get(Number(r.owner_id)) || 0) + add);
  }

  const consultRows = db()
    .prepare(
      `SELECT patient_user_id AS owner_id,
              COALESCE(fee_coins, 0) AS fee_coins
       FROM vet_consultations
       WHERE patient_user_id IN (${placeholders})
         AND created_at >= ?`
    )
    .all(...ownerIds, since) as Array<{ owner_id: number; fee_coins: number }>;

  for (const r of consultRows) {
    const add = consultFeeToToman(r.fee_coins);
    map.set(Number(r.owner_id), (map.get(Number(r.owner_id)) || 0) + add);
  }

  return map;
}

/**
 * Batch latest event per owner + pet-linked consult events.
 */
export function batchOwnerLastEvents(ownerIds: number[]): {
  byOwner: Map<number, AdminPetLastEvent>;
  byPet: Map<number, AdminPetLastEvent>;
} {
  const byOwner = new Map<number, AdminPetLastEvent>();
  const byPet = new Map<number, AdminPetLastEvent>();
  if (!ownerIds.length) return { byOwner, byPet };

  const placeholders = ownerIds.map(() => '?').join(',');
  const paidList = ADMIN_PETS_PAID_ORDER_STATUSES.map((s) => `'${s}'`).join(',');

  const orderRows = db()
    .prepare(
      `SELECT user_id AS owner_id,
              created_at AS at,
              total_toman AS raw_amount,
              COALESCE(payment_currency, 'toman') AS payment_currency
       FROM shop_orders
       WHERE user_id IN (${placeholders})
         AND status IN (${paidList})`
    )
    .all(...ownerIds) as Array<{
    owner_id: number;
    at: string;
    raw_amount: number;
    payment_currency: string;
  }>;

  const consultRows = db()
    .prepare(
      `SELECT patient_user_id AS owner_id,
              pet_id,
              created_at AS at,
              COALESCE(fee_coins, 0) AS fee_coins
       FROM vet_consultations
       WHERE patient_user_id IN (${placeholders})`
    )
    .all(...ownerIds) as Array<{
    owner_id: number;
    pet_id: number | null;
    at: string;
    fee_coins: number;
  }>;

  const consider = (ownerId: number, ev: AdminPetLastEvent, petId?: number | null) => {
    const prev = byOwner.get(ownerId);
    if (!prev || String(ev.at) >= String(prev.at)) {
      byOwner.set(ownerId, ev);
    }
    if (petId != null && Number.isFinite(Number(petId))) {
      const pid = Number(petId);
      const prevPet = byPet.get(pid);
      if (!prevPet || String(ev.at) >= String(prevPet.at)) {
        byPet.set(pid, ev);
      }
    }
  };

  for (const r of orderRows) {
    consider(Number(r.owner_id), {
      at: toIso(r.at),
      kind: 'purchase',
      label: 'خرید فروشگاه',
      amountToman: orderAmountToToman(r.raw_amount, r.payment_currency),
    });
  }
  for (const r of consultRows) {
    consider(
      Number(r.owner_id),
      {
        at: toIso(r.at),
        kind: 'service',
        label: 'مشاوره دامپزشکی',
        amountToman: consultFeeToToman(r.fee_coins),
      },
      r.pet_id
    );
  }

  return { byOwner, byPet };
}

function pickLastEventForPet(
  petId: number,
  ownerId: number,
  byOwner: Map<number, AdminPetLastEvent>,
  byPet: Map<number, AdminPetLastEvent>
): AdminPetLastEvent | null {
  const petEv = byPet.get(petId) ?? null;
  const ownerEv = byOwner.get(ownerId) ?? null;
  if (petEv && ownerEv) {
    if (String(petEv.at) >= String(ownerEv.at)) return petEv;
    return ownerEv;
  }
  return petEv || ownerEv;
}

function batchOwnerMeta(
  ownerIds: number[]
): Map<number, { name?: string; phone?: string; publicId: string }> {
  const map = new Map<number, { name?: string; phone?: string; publicId: string }>();
  if (!ownerIds.length) return map;
  const placeholders = ownerIds.map(() => '?').join(',');
  const rows = db()
    .prepare(
      `SELECT id, name, phone, public_id FROM users WHERE id IN (${placeholders})`
    )
    .all(...ownerIds) as Array<{
    id: number;
    name: string | null;
    phone: string | null;
    public_id: string | null;
  }>;
  for (const r of rows) {
    map.set(Number(r.id), {
      name: r.name || undefined,
      phone: r.phone || undefined,
      publicId: userPublicIdOf({ id: Number(r.id), publicId: r.public_id }),
    });
  }
  return map;
}

export function listAdminPets(filters: AdminPetsListFilters = {}): {
  total: number;
  pets: AdminPetListRow[];
} {
  const species = filters.species?.trim() || undefined;
  const q = filters.q?.trim() || '';
  const ownerNameQ = filters.ownerName?.trim().toLowerCase() || '';
  const ownerPhoneQ = filters.ownerPhone?.trim() || '';
  const fromBound = parseAdminPetsFilterDate(filters.lastEventFrom, 'start');
  const toBound = parseAdminPetsFilterDate(filters.lastEventTo, 'end');

  let pets = dbService.listPets(species ? { species } : undefined);
  const ownerIdsAll = [...new Set(pets.map((p) => p.ownerId))];
  const ownerMeta = batchOwnerMeta(ownerIdsAll);

  if (q) {
    const lower = q.toLowerCase();
    pets = pets.filter((p) => {
      const meta = ownerMeta.get(p.ownerId);
      return (
        p.name.toLowerCase().includes(lower) ||
        (p.breed || '').toLowerCase().includes(lower) ||
        (p.city || '').toLowerCase().includes(lower) ||
        String(p.id) === q ||
        (p.publicId || '').toLowerCase().includes(lower) ||
        `pd-p${String(p.id).padStart(5, '0')}` === lower ||
        (meta?.name || '').toLowerCase().includes(lower) ||
        (meta?.phone || '').includes(q) ||
        (meta?.publicId || '').toLowerCase().includes(lower)
      );
    });
  }

  if (ownerNameQ) {
    pets = pets.filter((p) => {
      const meta = ownerMeta.get(p.ownerId);
      const name = (meta?.name || p.ownerName || '').toLowerCase();
      return name.includes(ownerNameQ);
    });
  }

  if (ownerPhoneQ) {
    const digits = normalizePhoneDigits(ownerPhoneQ);
    pets = pets.filter((p) => {
      const phone = ownerMeta.get(p.ownerId)?.phone || '';
      const phoneDigits = normalizePhoneDigits(phone);
      return phone.includes(ownerPhoneQ) || (digits.length > 0 && phoneDigits.includes(digits));
    });
  }

  const ownerIds = [...new Set(pets.map((p) => p.ownerId))];
  const spendMap = batchOwnerSpendToman6m(ownerIds);
  const { byOwner, byPet } = batchOwnerLastEvents(ownerIds);

  let rows: AdminPetListRow[] = pets.map((pet) => {
    const meta = ownerMeta.get(pet.ownerId);
    const spendToman6m = spendMap.get(pet.ownerId) || 0;
    const lastEvent = pickLastEventForPet(pet.id, pet.ownerId, byOwner, byPet);
    return {
      ...pet,
      ownerName: meta?.name || pet.ownerName,
      ownerPhone: meta?.phone,
      ownerPublicId: meta?.publicId || userPublicIdOf({ id: pet.ownerId }),
      spendToman6m,
      vipOwner: spendToman6m > ADMIN_PETS_VIP_THRESHOLD_TOMAN,
      lastEvent,
    };
  });

  if (fromBound || toBound) {
    const fromMs = fromBound ? Date.parse(fromBound) : null;
    const toMs = toBound ? Date.parse(toBound) : null;
    rows = rows.filter((p) => {
      if (!p.lastEvent?.at) return false;
      const atMs = Date.parse(p.lastEvent.at);
      if (!Number.isFinite(atMs)) return false;
      if (fromMs != null && atMs < fromMs) return false;
      if (toMs != null && atMs > toMs) return false;
      return true;
    });
  }

  return { total: rows.length, pets: rows };
}

export function getAdminPetDossier(petId: number): AdminPetDossier | null {
  const pet = dbService.getPet(petId);
  if (!pet) return null;
  const owner = dbService.getUserById(pet.ownerId);
  const spendMap = batchOwnerSpendToman6m([pet.ownerId]);
  const { byOwner, byPet } = batchOwnerLastEvents([pet.ownerId]);
  const spendToman6m = spendMap.get(pet.ownerId) || 0;
  const lastEvent = pickLastEventForPet(pet.id, pet.ownerId, byOwner, byPet);

  const consults = dbService
    .listVetConsultations({ patientUserId: pet.ownerId })
    .filter((c) => c.petId == null || c.petId === pet.id)
    .slice(0, 40)
    .map((c) => ({
      id: c.id,
      publicId: c.publicId,
      petId: c.petId,
      status: c.status,
      feeCoins: c.feeCoins,
      feeToman: consultFeeToToman(c.feeCoins),
      notes: c.notes,
      createdAt: c.createdAt,
    }));

  return {
    pet,
    owner: {
      id: pet.ownerId,
      name: owner?.name || pet.ownerName,
      phone: owner?.phone,
      publicId: userPublicIdOf({ id: pet.ownerId, publicId: owner?.publicId }),
    },
    medicalRecord: dbService.getPetMedicalRecord(petId),
    medicalEntries: dbService.listPetMedicalEntries(petId, 30),
    shopOrders: adminPlatform.listShopOrdersForUser(pet.ownerId, { limit: 30 }),
    consults,
    spendToman6m,
    vipOwner: spendToman6m > ADMIN_PETS_VIP_THRESHOLD_TOMAN,
    lastEvent,
  };
}

export function adminUpdatePet(
  id: number,
  patch: Partial<{
    name: string;
    species: string;
    breed: string;
    gender: PetProfile['gender'];
    ageMonths: number;
    size: PetProfile['size'];
    color: string;
    bio: string;
    vaccinated: boolean;
    neutered: boolean;
    lookingForPlaymate: boolean;
    imageUrl: string;
    city: string;
    neighborhood: string;
  }>
): PetProfile | null {
  return dbService.updatePet(id, patch);
}

export function adminCreatePet(data: {
  ownerId: number;
  name: string;
  species: string;
  breed?: string;
  gender?: PetProfile['gender'];
  ageMonths?: number;
  size?: PetProfile['size'];
  color?: string;
  bio?: string;
  vaccinated?: boolean;
  neutered?: boolean;
  lookingForPlaymate?: boolean;
  imageUrl?: string;
  city?: string;
  neighborhood?: string;
}): PetProfile {
  return dbService.createPet(data);
}
