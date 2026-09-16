/**
 * Launch playmate population: 15 pet_owner + pet per Iranian province.
 * Idempotent via telegram_id launch_pm_{pp}_{nn}. Photos stored locally.
 * Never runs on boot — call seedLaunchPlaymates() from the CLI script.
 */
import { createHash } from 'crypto';
import { IRAN_CITIES_BY_PROVINCE, IRAN_PROVINCES } from '@petdate/shared';
import { getDb, dbService } from './db';
import { saveUserAvatar } from './services/user-avatar-store';
import { savePetPhoto } from './services/pet-photo-store';

export const LAUNCH_PM_PREFIX = 'launch_pm_';
export const PER_PROVINCE = 15;

const MALE_FIRST = [
  'امیر', 'رضا', 'محمد', 'علی', 'حسین', 'مهدی', 'سعید', 'حامد', 'کیان', 'پارسا',
  'نیما', 'آرش', 'بهراد', 'سامان', 'پویا', 'کسری', 'یاسین', 'عرفان', 'شایان', 'رادین',
];
const FEMALE_FIRST = [
  'سارا', 'نگار', 'مریم', 'فاطمه', 'زهرا', 'نازنین', 'هستی', 'آوا', 'یاسمن', 'نیکی',
  'ترانه', 'مهسا', 'الناز', 'پریسا', 'ستاره', 'دریا', 'رها', 'کیانا', 'نرگس', 'آتوسا',
];
const LAST = [
  'محمدی', 'حسینی', 'رضایی', 'کریمی', 'موسوی', 'احمدی', 'جعفری', 'نوری', 'کاظمی', 'صادقی',
  'مرادی', 'رحیمی', 'اکبری', 'شریفی', 'عباسی', 'یوسفی', 'قاسمی', 'نجفی', 'حیدری', 'اسدی',
  'باقری', 'طاهری', 'کرمی', 'سلطانی', 'امینی',
];

const NEIGHBORHOODS = [
  'مرکز شهر', 'بلوار اصلی', 'فرهنگ‌شهر', 'شهرک غرب', 'فاز یک', 'فاز دو',
  'کیان‌شهر', 'گلشهر', 'باغ‌ملی', 'میدان امام', 'جاده کمربندی', 'شهرک نفت',
  'پونک محلی', 'ستارخان محلی', 'الهیه محلی',
];

/** Weighted toward breeds commonly kept in Iran. */
const PET_POOL: Array<{
  species: 'dog' | 'cat';
  breed: string;
  size: 'small' | 'medium' | 'large';
  colors: string[];
  names: string[];
  /** dog.ceo breed path — cats leave this empty and use Cataas. */
  ceo?: string;
}> = [
  {
    species: 'dog',
    breed: 'میکس / دورگه',
    size: 'medium',
    colors: ['قهوه‌ای', 'سفید-قهوه‌ای', 'مشکی'],
    names: ['بارون', 'جسی', 'لوکی', 'نیکو'],
    ceo: 'mix',
  },
  {
    species: 'dog',
    breed: 'ژرمن شپرد',
    size: 'large',
    colors: ['سیاه-قهوه‌ای', 'sable'],
    names: ['رکس', 'ماکس', 'شاتو', 'کیان'],
    ceo: 'german/shepherd',
  },
  {
    species: 'dog',
    breed: 'سگ نگهبان ایرانی',
    size: 'large',
    colors: ['کرم', 'خاکستری'],
    names: ['قهرمان', 'شیر', 'رستم', 'آرش'],
    ceo: 'ovcharka/caucasian',
  },
  {
    species: 'dog',
    breed: 'سگ گله ایرانی',
    size: 'large',
    colors: ['سفید', 'کرم'],
    names: ['چوپان', 'گل', 'سفید'],
    ceo: 'sheepdog/english',
  },
  {
    species: 'dog',
    breed: 'سالوکی / تازی',
    size: 'large',
    colors: ['کرم', 'طلایی'],
    names: ['تازی', 'باد', 'صحرا'],
    ceo: 'saluki',
  },
  {
    species: 'dog',
    breed: 'پامرانین',
    size: 'small',
    colors: ['نارنجی', 'کرم'],
    names: ['تدی', 'موچی', 'پام'],
    ceo: 'pomeranian',
  },
  {
    species: 'dog',
    breed: 'شیتزو',
    size: 'small',
    colors: ['سفید', 'کرم-سفید'],
    names: ['ملوس', 'کیتی', 'شیتی'],
    ceo: 'shihtzu',
  },
  {
    species: 'dog',
    breed: 'مالتیز',
    size: 'small',
    colors: ['سفید'],
    names: ['برفی', 'مالی', 'پنبه'],
    ceo: 'maltese',
  },
  {
    species: 'dog',
    breed: 'اسپیتز',
    size: 'small',
    colors: ['سفید', 'کرم'],
    names: ['پوفی', 'ابر', 'برفک'],
    ceo: 'samoyed',
  },
  {
    species: 'dog',
    breed: 'تریر',
    size: 'small',
    colors: ['قهوه‌ای', 'سفید-قهوه‌ای'],
    names: ['جک', 'تیکو', 'فندق'],
    ceo: 'terrier/yorkshire',
  },
  {
    species: 'dog',
    breed: 'گلدن رتریور',
    size: 'large',
    colors: ['طلایی'],
    names: ['گلدن', 'ساندی', 'هانی'],
    ceo: 'retriever/golden',
  },
  {
    species: 'dog',
    breed: 'لابرادور',
    size: 'large',
    colors: ['شکلاتی', 'مشکی', 'کرم'],
    names: ['لاب', 'کوکو', 'بلا'],
    ceo: 'labrador',
  },
  {
    species: 'dog',
    breed: 'هاسکی سیبری',
    size: 'large',
    colors: ['خاکستری-سفید'],
    names: ['لونا', 'سایه', 'برف'],
    ceo: 'husky',
  },
  {
    species: 'dog',
    breed: 'مالینویز',
    size: 'large',
    colors: ['قهوه‌ای'],
    names: ['مالی', 'گارد', 'آتاش'],
    ceo: 'malinois',
  },
  {
    species: 'cat',
    breed: 'موکوتاه ایرانی',
    size: 'small',
    colors: ['خاکستری', 'نارنجی', 'سه‌رنگ'],
    names: ['پیشی', 'ملوس', 'نارنج'],
  },
  {
    species: 'cat',
    breed: 'پرشین',
    size: 'small',
    colors: ['سفید', 'کرم'],
    names: ['شاهین', 'پرنسس', 'ابر'],
  },
  {
    species: 'cat',
    breed: 'بریتیش شورت‌هیر',
    size: 'medium',
    colors: ['خاکستری'],
    names: ['دودی', 'میشا', 'گرافیت'],
  },
  {
    species: 'cat',
    breed: 'موبلند ایرانی',
    size: 'medium',
    colors: ['سفید', 'کرم'],
    names: ['کرکی', 'پشمک', 'برفی'],
  },
];

/** Overflow dog.ceo paths if a breed list runs out. All real dogs. */
const EXTRA_DOG_CEO = [
  'mix',
  'labrador',
  'beagle',
  'boxer',
  'husky',
  'pug',
  'chihuahua',
  'samoyed',
  'akita',
  'retriever/golden',
  'german/shepherd',
  'pomeranian',
  'maltese',
  'shihtzu',
  'saluki',
  'malinois',
];

function uniquePicsumUrl(kind: string, unique: number, size = 800): string {
  const n = Math.abs(Math.floor(unique)) + 1;
  return `https://picsum.photos/seed/petdate-${kind}-${n}/${size}/${size}`;
}

const imageCache = new Map<string, Buffer>();
/** SHA-1 of raw bytes — ensure no two launch pets share identical photo content. */
const usedPetPhotoDigests = new Set<string>();
const usedPhotoUrls = new Set<string>();
const dogCeoUrlCache = new Map<string, string[]>();
let catUrlPool: string[] | null = null;

function digestOf(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex');
}

function isStillPhotoUrl(url: string): boolean {
  const path = url.split('?')[0]!.toLowerCase();
  if (/\.(mp4|webm|mov|gif)$/.test(path)) return false;
  return /\.(jpe?g|png|webp)$/.test(path) || /images\.dog\.ceo|cataas\.com\/cat|thecatapi|cdn2\.thecatapi|placedog\.net/.test(path);
}

function isJpegOrPng(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true; // JPEG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    return true;
  }
  return false;
}

async function fetchImage(url: string): Promise<Buffer> {
  const hit = imageCache.get(url);
  if (hit) return hit;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PetDateLaunchSeed/1.0 (playmate catalog)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`);
  const ctype = (res.headers.get('content-type') || '').toLowerCase();
  if (ctype.includes('video') || ctype.includes('gif')) throw new Error(`not a still image ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) throw new Error(`tiny image ${url}`);
  if (!isJpegOrPng(buf)) throw new Error(`not jpeg/png ${url}`);
  imageCache.set(url, buf);
  return buf;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PetDateLaunchSeed/1.0 (playmate catalog)', Accept: 'application/json' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`json ${res.status} ${url}`);
  return (await res.json()) as T;
}

function ceoPathForBreed(breed: string): string {
  const hit = PET_POOL.find((p) => p.breed === breed && p.species === 'dog');
  return hit?.ceo || 'mix';
}

async function dogCeoImageUrls(breedPath: string): Promise<string[]> {
  const cached = dogCeoUrlCache.get(breedPath);
  if (cached) return cached;
  const data = await fetchJson<{ status?: string; message?: string[] | string }>(
    `https://dog.ceo/api/breed/${breedPath}/images`
  );
  const list = Array.isArray(data.message) ? data.message : [];
  const urls = list.filter((u) => typeof u === 'string' && isStillPhotoUrl(u));
  dogCeoUrlCache.set(breedPath, urls);
  return urls;
}

async function loadCatUrlPool(): Promise<string[]> {
  if (catUrlPool) return catUrlPool;
  const urls: string[] = [];
  const seen = new Set<string>();
  for (let skip = 0; skip < 800; skip += 100) {
    try {
      const rows = await fetchJson<Array<{ id?: string; mimetype?: string }>>(
        `https://cataas.com/api/cats?limit=100&skip=${skip}`
      );
      if (!Array.isArray(rows) || !rows.length) break;
      for (const row of rows) {
        const mime = String(row.mimetype || '').toLowerCase();
        if (mime && !mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png')) continue;
        const id = String(row.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        urls.push(`https://cataas.com/cat/${id}`);
      }
      if (rows.length < 100) break;
    } catch {
      break;
    }
  }
  for (let page = 0; page < 20; page++) {
    try {
      const rows = await fetchJson<Array<{ url?: string }>>(
        `https://api.thecatapi.com/v1/images/search?limit=10&page=${page}&order=ASC&mime_types=jpg,png`
      );
      if (!Array.isArray(rows) || !rows.length) break;
      for (const row of rows) {
        const u = String(row.url || '');
        if (!u || !isStillPhotoUrl(u) || seen.has(u)) continue;
        seen.add(u);
        urls.push(u);
      }
    } catch {
      break;
    }
  }
  catUrlPool = urls;
  return urls;
}

async function takeUnusedUrl(candidates: string[], startAt: number): Promise<string | null> {
  if (!candidates.length) return null;
  const n = candidates.length;
  const origin = Math.abs(startAt) % n;
  for (let i = 0; i < n; i++) {
    const url = candidates[(origin + i) % n]!;
    if (usedPhotoUrls.has(url)) continue;
    usedPhotoUrls.add(url);
    return url;
  }
  return null;
}

async function claimPetPhotoBuffer(url: string): Promise<Buffer | null> {
  try {
    const buf = await fetchImage(url);
    const dig = digestOf(buf);
    if (usedPetPhotoDigests.has(dig)) return null;
    usedPetPhotoDigests.add(dig);
    return buf;
  } catch {
    return null;
  }
}

/**
 * Real dog or cat photos only — dog.ceo + Cataas/TheCatAPI.
 * Never loremflickr/picsum (those returned hangers, furniture, etc.).
 */
async function fetchUniquePetImage(
  species: 'dog' | 'cat',
  breed: string,
  unique: number
): Promise<Buffer> {
  const primaryPools: string[][] = [];
  if (species === 'cat') {
    primaryPools.push(await loadCatUrlPool());
  } else {
    primaryPools.push(await dogCeoImageUrls(ceoPathForBreed(breed)));
  }

  let lastErr: Error | null = null;
  const tryPools = async (pools: string[][]): Promise<Buffer | null> => {
    for (const pool of pools) {
      for (let n = 0; n < 6; n++) {
        const url = await takeUnusedUrl(pool, unique + n * 17);
        if (!url) break;
        const buf = await claimPetPhotoBuffer(url);
        if (buf) return buf;
      }
    }
    return null;
  };

  const hit = await tryPools(primaryPools);
  if (hit) return hit;

  if (species === 'dog') {
    const extra: string[][] = [];
    const primary = ceoPathForBreed(breed);
    for (const path of EXTRA_DOG_CEO) {
      if (path === primary) continue;
      extra.push(await dogCeoImageUrls(path));
    }
    const extraHit = await tryPools(extra);
    if (extraHit) return extraHit;
    const placedog = `https://placedog.net/800/800?id=${Math.abs(Math.floor(unique)) + 1}`;
    if (!usedPhotoUrls.has(placedog)) {
      usedPhotoUrls.add(placedog);
      const buf = await claimPetPhotoBuffer(placedog);
      if (buf) return buf;
    }
  }

  for (let i = 0; i < 12; i++) {
    try {
      const url =
        species === 'cat'
          ? (
              await fetchJson<Array<{ url?: string }>>(
                'https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png'
              )
            )[0]?.url
          : (await fetchJson<{ message?: string }>('https://dog.ceo/api/breeds/image/random')).message;
      if (!url || !isStillPhotoUrl(url) || usedPhotoUrls.has(url)) continue;
      usedPhotoUrls.add(url);
      const buf = await claimPetPhotoBuffer(url);
      if (buf) return buf;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error(`no unique ${species} photo for ${breed}/${unique}`);
}

async function fetchUniquePersonImage(gender: 'male' | 'female', unique: number): Promise<Buffer> {
  try {
    return await fetchImage(uniquePicsumUrl(`person-${gender}`, unique, 600));
  } catch {
    return fetchImage(uniquePicsumUrl(`person-fallback-${gender}`, unique + 9000, 600));
  }
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[Math.abs(i) % arr.length]!;
}

function resetPetPhotoCaches(): void {
  usedPetPhotoDigests.clear();
  usedPhotoUrls.clear();
  imageCache.clear();
  dogCeoUrlCache.clear();
  catUrlPool = null;
}

export type LaunchPlaymateSeedResult = {
  created: number;
  skipped: number;
  provinces: number;
  errors: string[];
};

export type LaunchPlaymatePhotoRefreshResult = {
  updated: number;
  failed: number;
  errors: string[];
};

/** Re-download a distinct photo for every existing launch playmate pet. */
export async function refreshLaunchPlaymatePetPhotos(): Promise<LaunchPlaymatePhotoRefreshResult> {
  getDb();
  resetPetPhotoCaches();
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT p.id AS pet_id, p.owner_id, p.breed, p.species, u.telegram_id
       FROM pets p
       JOIN users u ON u.id = p.owner_id
       WHERE u.telegram_id LIKE ?
       ORDER BY p.id ASC`
    )
    .all(`${LAUNCH_PM_PREFIX}%`) as Array<{
    pet_id: number;
    owner_id: number;
    breed: string;
    species: string;
    telegram_id: string;
  }>;

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const unique = Number(row.pet_id);
    const species: 'dog' | 'cat' = row.species === 'cat' ? 'cat' : 'dog';
    try {
      const buf = await fetchUniquePetImage(species, String(row.breed || ''), unique);
      const saved = await savePetPhoto({
        ownerId: Number(row.owner_id),
        originalName: `pet-${row.pet_id}.jpg`,
        mimeType: 'image/jpeg',
        buffer: buf,
      });
      d.prepare(
        `UPDATE pets SET image_url = ?, photo_moderation_status = 'approved', updated_at = datetime('now') WHERE id = ?`
      ).run(saved.urlPath, row.pet_id);
      updated += 1;
      if ((i + 1) % 25 === 0 || i + 1 === rows.length) {
        console.log(`refresh-photos: ${i + 1}/${rows.length} (ok=${updated} fail=${failed})`);
      }
    } catch (err) {
      failed += 1;
      errors.push(`${row.telegram_id}/pet:${row.pet_id}: ${(err as Error).message}`);
    }
  }

  return { updated, failed, errors };
}

export async function seedLaunchPlaymates(opts?: {
  perProvince?: number;
  provinces?: readonly string[];
}): Promise<LaunchPlaymateSeedResult> {
  getDb();
  resetPetPhotoCaches();
  const per = opts?.perProvince ?? PER_PROVINCE;
  const provinces = opts?.provinces ?? IRAN_PROVINCES;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let pi = 0; pi < provinces.length; pi++) {
    const province = provinces[pi]!;
    const cities = IRAN_CITIES_BY_PROVINCE[province] ?? [province];
    for (let ui = 1; ui <= per; ui++) {
      const telegramId = `${LAUNCH_PM_PREFIX}${pad(pi + 1)}_${pad(ui)}`;
      const existing = dbService.getUserByTelegramId(telegramId);
      const existingPets = existing ? dbService.listPets({ ownerId: existing.id }) : [];
      if (existing && existingPets.length) {
        skipped += 1;
        continue;
      }
      const gender: 'male' | 'female' = ui % 2 === 1 ? 'male' : 'female';
      const first = gender === 'male' ? pick(MALE_FIRST, pi * 17 + ui) : pick(FEMALE_FIRST, pi * 13 + ui);
      const last = pick(LAST, pi * 11 + ui * 3);
      const name = `${first} ${last}`;
      const city = pick(cities, ui - 1);
      const neighborhood = `${pick(NEIGHBORHOODS, pi * 5 + ui)}، ${city}`;
      const age = 23 + ((pi * 7 + ui) % 16);
      const petKind = ui % 5 === 0 ? pick(PET_POOL.filter((p) => p.species === 'cat'), ui) : pick(
        PET_POOL.filter((p) => p.species === 'dog'),
        pi + ui
      );
      const petName = pick(petKind.names, ui + pi);
      const petGender: 'male' | 'female' = ui % 3 === 0 ? 'female' : 'male';
      const color = pick(petKind.colors, ui);
      const uniqueKey = pi * 100 + ui;

      try {
        const { user } = existing
          ? { user: existing }
          : dbService.findOrCreateUser({
              telegramId,
              name,
              username: `pm_${pad(pi + 1)}${pad(ui)}`,
            });
        const d = getDb();
        d.prepare(
          `UPDATE users SET
             role = 'pet_owner',
             roles = ?,
             onboarding = 'profile_complete',
             age = ?,
             gender = ?,
             city = ?,
             province = ?,
             country = 'ایران',
             bio = ?,
             coins = 40,
             is_active = 1,
             avatar_custom = 1,
             avatar_moderation_status = 'approved'
           WHERE id = ?`
        ).run(
          JSON.stringify(['pet_owner']),
          age,
          gender,
          city,
          province,
          `صاحب پت در ${city}، دنبال همبازی برای ${petName}`,
          user.id
        );

        const avatarBuf = await fetchUniquePersonImage(gender, uniqueKey);
        const avatar = await saveUserAvatar({
          userId: user.id,
          originalName: 'avatar.jpg',
          mimeType: 'image/jpeg',
          buffer: avatarBuf,
        });
        d.prepare(
          `UPDATE users SET avatar_url = ?, avatar_custom = 1, avatar_moderation_status = 'approved' WHERE id = ?`
        ).run(avatar.urlPath, user.id);

        const pet = dbService.createPet({
          ownerId: user.id,
          name: petName,
          species: petKind.species,
          breed: petKind.breed,
          gender: petGender,
          ageMonths: 10 + ((ui * 5 + pi) % 60),
          size: petKind.size,
          color,
          bio: `${petKind.breed} مهربون در ${city} — دنبال همبازی`,
          vaccinated: true,
          neutered: ui % 2 === 0,
          lookingForPlaymate: true,
          imageUrl: undefined,
          city,
          neighborhood,
        });
        const petBuf = await fetchUniquePetImage(petKind.species, petKind.breed, pet.id);
        const petPhoto = await savePetPhoto({
          ownerId: user.id,
          originalName: `pet-${pet.id}.jpg`,
          mimeType: 'image/jpeg',
          buffer: petBuf,
        });
        d.prepare(
          `UPDATE pets SET photo_moderation_status = 'approved', looking_for_playmate = 1, image_url = ? WHERE id = ?`
        ).run(petPhoto.urlPath, pet.id);
        created += 1;
      } catch (err) {
        errors.push(`${telegramId}: ${(err as Error).message}`);
      }
    }
  }

  return { created, skipped, provinces: provinces.length, errors };
}
