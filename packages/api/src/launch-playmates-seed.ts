/**
 * Launch playmate population: 15 pet_owner + pet per Iranian province.
 * Idempotent via telegram_id launch_pm_{pp}_{nn}. Photos stored locally.
 * Never runs on boot — call seedLaunchPlaymates() from the CLI script.
 */
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
  photo: string;
}> = [
  {
    species: 'dog',
    breed: 'میکس / دورگه',
    size: 'medium',
    colors: ['قهوه‌ای', 'سفید-قهوه‌ای', 'مشکی'],
    names: ['بارون', 'جسی', 'لوکی', 'نیکو'],
    photo: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'ژرمن شپرد',
    size: 'large',
    colors: ['سیاه-قهوه‌ای', 'sable'],
    names: ['رکس', 'ماکس', 'شاتو', 'کیان'],
    photo: 'https://images.unsplash.com/photo-1589941013453-ec89f0b5b5c5?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'سگ نگهبان ایرانی',
    size: 'large',
    colors: ['کرم', 'خاکستری'],
    names: ['قهرمان', 'شیر', 'رستم', 'آرش'],
    photo: 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'سگ گله ایرانی',
    size: 'large',
    colors: ['سفید', 'کرم'],
    names: ['چوپان', 'گل', 'سفید'],
    photo: 'https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'سالوکی / تازی',
    size: 'large',
    colors: ['کرم', 'طلایی'],
    names: ['تازی', 'باد', 'صحرا'],
    photo: 'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'پامرانین',
    size: 'small',
    colors: ['نارنجی', 'کرم'],
    names: ['تدی', 'موچی', 'پام'],
    photo: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'شیتزو',
    size: 'small',
    colors: ['سفید', 'کرم-سفید'],
    names: ['ملوس', 'کیتی', 'شیتی'],
    photo: 'https://images.unsplash.com/photo-1583511655826-05700d52f4d9?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'مالتیز',
    size: 'small',
    colors: ['سفید'],
    names: ['برفی', 'مالی', 'پنبه'],
    photo: 'https://images.unsplash.com/photo-1611003228941-98852ba28263?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'اسپیتز',
    size: 'small',
    colors: ['سفید', 'کرم'],
    names: ['پوفی', 'ابر', 'برفک'],
    photo: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'تریر',
    size: 'small',
    colors: ['قهوه‌ای', 'سفید-قهوه‌ای'],
    names: ['جک', 'تیکو', 'فندق'],
    photo: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'گلدن رتریور',
    size: 'large',
    colors: ['طلایی'],
    names: ['گلدن', 'ساندی', 'هانی'],
    photo: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'لابرادور',
    size: 'large',
    colors: ['شکلاتی', 'مشکی', 'کرم'],
    names: ['لاب', 'کوکو', 'بلا'],
    photo: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'هاسکی سیبری',
    size: 'large',
    colors: ['خاکستری-سفید'],
    names: ['لونا', 'سایه', 'برف'],
    photo: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'dog',
    breed: 'مالینویز',
    size: 'large',
    colors: ['قهوه‌ای'],
    names: ['مالی', 'گارد', 'آتاش'],
    photo: 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'cat',
    breed: 'موکوتاه ایرانی',
    size: 'small',
    colors: ['خاکستری', 'نارنجی', 'سه‌رنگ'],
    names: ['پیشی', 'ملوس', 'نارنج'],
    photo: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'cat',
    breed: 'پرشین',
    size: 'small',
    colors: ['سفید', 'کرم'],
    names: ['شاهین', 'پرنسس', 'ابر'],
    photo: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'cat',
    breed: 'بریتیش شورت‌هیر',
    size: 'medium',
    colors: ['خاکستری'],
    names: ['دودی', 'میشا', 'گرافیت'],
    photo: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=800&q=80',
  },
  {
    species: 'cat',
    breed: 'موبلند ایرانی',
    size: 'medium',
    colors: ['سفید', 'کرم'],
    names: ['کرکی', 'پشمک', 'برفی'],
    photo: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=800&q=80',
  },
];

/** Stock portraits (Unsplash) — West/Central Asian appearance, mixed gender. */
const PEOPLE_MALE = [
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1501196353401-2c3d9fce69a1?auto=format&fit=crop&w=600&q=80',
];
const PEOPLE_FEMALE = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f89b6d3f0e3?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=600&q=80',
];

const imageCache = new Map<string, Buffer>();

async function fetchImage(url: string): Promise<Buffer> {
  const hit = imageCache.get(url);
  if (hit) return hit;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PetDateLaunchSeed/1.0 (playmate catalog)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) throw new Error(`tiny image ${url}`);
  imageCache.set(url, buf);
  return buf;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[Math.abs(i) % arr.length]!;
}

export type LaunchPlaymateSeedResult = {
  created: number;
  skipped: number;
  provinces: number;
  errors: string[];
};

export async function seedLaunchPlaymates(opts?: {
  perProvince?: number;
  provinces?: readonly string[];
}): Promise<LaunchPlaymateSeedResult> {
  getDb();
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
      const personUrl = gender === 'male' ? pick(PEOPLE_MALE, pi + ui) : pick(PEOPLE_FEMALE, pi + ui);

      try {
        const { user } = dbService.findOrCreateUser({
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

        const avatarBuf = await fetchImage(personUrl);
        const avatar = await saveUserAvatar({
          userId: user.id,
          originalName: 'avatar.jpg',
          mimeType: 'image/jpeg',
          buffer: avatarBuf,
        });
        d.prepare(
          `UPDATE users SET avatar_url = ?, avatar_custom = 1, avatar_moderation_status = 'approved' WHERE id = ?`
        ).run(avatar.urlPath, user.id);

        const petBuf = await fetchImage(petKind.photo);
        const petPhoto = await savePetPhoto({
          ownerId: user.id,
          originalName: 'pet.jpg',
          mimeType: 'image/jpeg',
          buffer: petBuf,
        });
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
          imageUrl: petPhoto.urlPath,
          city,
          neighborhood,
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
