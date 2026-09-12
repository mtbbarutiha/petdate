import { createHash, timingSafeEqual } from 'crypto';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { dbService, getDb, haversineKm } from '../db';
import { infra } from '../config/infra';
import {
  MAX_PET_PHOTO_BYTES,
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
  savePetPhoto,
} from '../services/pet-photo-store';
import { renderNearbyListCard, renderPetProfileCard } from '../services/nearby-cards';
import { ensureWebAccessibleAvatar } from '../services/telegram-profile-sync';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
  materializePetTelegramPhoto,
  petPhotoStorageKeyFromUrl,
  readLocalPetPhoto,
} from '../services/telegram-media';
import { getUserFromBearer } from '../services/web-otp';
import type { PetProfile } from '@petdate/shared';

export const petsRouter = Router();

function viewerUserId(req: { header: (name: string) => string | undefined }): number | undefined {
  const session = getUserFromBearer(req.header('authorization') ?? undefined);
  return session?.user?.id;
}

function tokensEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Internal Telegram bot (X-PetDate-Bot-Token === TELEGRAM_BOT_TOKEN). */
function isInternalBot(req: { header: (name: string) => string | undefined }): boolean {
  const expected = infra.telegram.botToken?.trim();
  const got = String(req.header('x-petdate-bot-token') ?? '').trim();
  if (!expected || !got) return false;
  return tokensEqual(expected, got);
}

/** Hide unapproved pet/owner photos from non-owners. */
function sanitizePetForViewer(pet: PetProfile, viewerId?: number): PetProfile {
  const isOwner = viewerId != null && viewerId === pet.ownerId;
  if (isOwner) return pet;
  const out = { ...pet };
  if ((pet.photoModerationStatus ?? 'approved') !== 'approved') {
    out.imageUrl = undefined;
  }
  return out;
}

/**
 * Public discovery card — playmate matching needs species/city/ownerId de-dupe.
 * Never include medical `health`, neighborhood, owner avatar, or last-seen.
 */
export function toPublicPetCard(pet: PetProfile): PetProfile {
  return {
    id: pet.id,
    publicId: pet.publicId,
    slug: pet.slug,
    ownerId: pet.ownerId,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    gender: pet.gender,
    ageMonths: pet.ageMonths,
    size: pet.size,
    color: pet.color,
    bio: pet.bio,
    vaccinated: pet.vaccinated,
    neutered: pet.neutered,
    lookingForPlaymate: pet.lookingForPlaymate,
    personality: pet.personality ?? {},
    health: {},
    imageUrl: pet.imageUrl,
    city: pet.city,
    ownerProvince: pet.ownerProvince,
    ownerCity: pet.ownerCity,
    ownerName: pet.ownerName,
    ownerVerified: pet.ownerVerified,
    distanceKm: pet.distanceKm,
    createdAt: pet.createdAt,
    updatedAt: pet.updatedAt,
  };
}

function presentPet(
  pet: PetProfile,
  viewerId?: number,
  opts?: { privileged?: boolean }
): PetProfile {
  const visible = sanitizePetForViewer(pet, viewerId);
  if (opts?.privileged || (viewerId != null && viewerId === pet.ownerId)) {
    return visible;
  }
  return toPublicPetCard(visible);
}

const petPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PET_PHOTO_BYTES, files: 1 },
});

/** Upload a pet profile photo (multipart field: `file`). Returns a public URL path. */
petsRouter.post('/photos/upload', (req, res) => {
  petPhotoUpload.single('file')(req, res, (uploadErr) => {
    void (async () => {
      if (uploadErr) {
        const tooLarge =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
        res.status(tooLarge ? 413 : 400).json({
          error: tooLarge
            ? 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)'
            : 'آپلود عکس ناموفق بود',
        });
        return;
      }

      const session = getUserFromBearer(req.header('authorization') ?? undefined);
      if (!session) {
        res.status(401).json({ error: 'وارد نشده‌اید' });
        return;
      }

      const ownerId = Number(
        (req.body as { ownerId?: string })?.ownerId ?? req.query.ownerId ?? session.user.id
      );
      const file = req.file;

      if (!Number.isFinite(ownerId) || ownerId <= 0) {
        res.status(400).json({ error: 'ownerId الزامی است' });
        return;
      }
      if (ownerId !== session.user.id && !isInternalBot(req)) {
        res.status(403).json({ error: 'فقط صاحب حساب می‌تواند عکس آپلود کند' });
        return;
      }
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'فایل عکس الزامی است' });
        return;
      }

      const owner = dbService.getUserById(ownerId);
      if (!owner) {
        res.status(404).json({ error: 'صاحب پت پیدا نشد' });
        return;
      }

      try {
        const saved = await savePetPhoto({
          ownerId,
          originalName: file.originalname || 'pet.jpg',
          mimeType: file.mimetype,
          buffer: file.buffer,
        });
        res.status(201).json({
          ok: true,
          url: saved.urlPath,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'FILE_TOO_LARGE') {
          res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
          return;
        }
        if (code === 'INVALID_MIME' || code === 'INVALID_IMAGE') {
          res.status(400).json({
            error:
              code === 'INVALID_IMAGE'
                ? 'فایل عکس قابل پردازش نیست. یک عکس دیگر انتخاب کن'
                : 'فقط عکس مجاز است (JPG، PNG، WebP، HEIC، GIF)',
          });
          return;
        }
        console.warn('pet photo upload failed:', (err as Error).message);
        res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
      }
    })();
  });
});

/**
 * Serve an uploaded pet photo by storage key `ownerId/filename`.
 * UUID filenames are unguessable; pending URLs are omitted from public JSON,
 * so we always stream the bytes for <img> (no Bearer — browsers can't send it).
 */
petsRouter.get('/photos/:ownerId/:filename', (req, res) => {
  const ownerId = String(req.params.ownerId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${ownerId}/${filename}`;
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', mimeFromPetPhotoKey(storageKey));
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(fs.readFileSync(abs));
});

petsRouter.get('/', (req, res) => {
  const viewerId = viewerUserId(req);
  const privileged = isInternalBot(req);
  const ownerIdRaw = req.query.ownerId ? Number(req.query.ownerId) : undefined;
  const ownerId = Number.isFinite(ownerIdRaw) && ownerIdRaw! > 0 ? ownerIdRaw : undefined;
  const excludeOwnerId = req.query.excludeOwnerId ? Number(req.query.excludeOwnerId) : undefined;
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;
  const province = typeof req.query.province === 'string' ? req.query.province : undefined;
  const breed = typeof req.query.breed === 'string' ? req.query.breed : undefined;
  const breedsRaw = typeof req.query.breeds === 'string' ? req.query.breeds : undefined;
  const breeds = breedsRaw
    ? breedsRaw
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 40)
    : undefined;
  const sortRaw = typeof req.query.sort === 'string' ? req.query.sort : undefined;
  const sort =
    sortRaw === 'newest' || sortRaw === 'popular' || sortRaw === 'updated'
      ? sortRaw
      : undefined;
  const lookingForPlaymate =
    req.query.lookingForPlaymate === 'true'
      ? true
      : req.query.lookingForPlaymate === 'false'
        ? false
        : undefined;

  // ownerId filter is a roster of one account — guests cannot scrape it.
  if (ownerId != null && !privileged && viewerId == null) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }

  // Unauthenticated discovery is playmate cards only — not a full pet roster.
  const playmateFilter =
    !privileged && viewerId == null && lookingForPlaymate === undefined
      ? true
      : lookingForPlaymate;

  const pets = dbService.listPets({
    ownerId,
    excludeOwnerId: Number.isFinite(excludeOwnerId) ? excludeOwnerId : undefined,
    lookingForPlaymate: playmateFilter,
    species,
    city,
    province,
    breed,
    breeds,
    sort,
    // Public discovery hides pending/rejected photos; owners always see their pets.
    publicOnly: ownerId == null || ownerId !== viewerId,
  });
  res.json(pets.map((pet) => presentPet(pet, viewerId, { privileged })));
});

/** پت‌های نزدیک بر اساس مختصات — قبل از /:id ثبت شود */
petsRouter.get('/nearby', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'lat و lng الزامی است' });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'مختصات نامعتبر است' });
    return;
  }
  const excludeOwnerId = req.query.excludeOwnerId
    ? Number(req.query.excludeOwnerId)
    : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const radiusKm = req.query.radiusKm != null ? Number(req.query.radiusKm) : undefined;
  const viewerId = viewerUserId(req);
  const privileged = isInternalBot(req);
  const pets = dbService.listNearbyPets({
    lat,
    lng,
    excludeOwnerId: Number.isFinite(excludeOwnerId) ? excludeOwnerId : undefined,
    limit: Number.isFinite(limit) ? limit : 30,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
  });
  res.json(pets.map((pet) => presentPet(pet, viewerId, { privileged })));
});

/** کارت تصویری لیست نزدیک (سبک دوردوریا) — قبل از /:id */
petsRouter.get('/nearby/list-card', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat و lng الزامی است' });
      return;
    }
    const radiusKm = Number(req.query.radiusKm ?? 5);
    const excludeOwnerId = req.query.excludeOwnerId
      ? Number(req.query.excludeOwnerId)
      : undefined;
    const page = Math.max(0, Number(req.query.page ?? 0) || 0);
    const pageSize = Math.min(12, Math.max(1, Number(req.query.pageSize ?? 8) || 8));
    const all = dbService.listNearbyPets({
      lat,
      lng,
      excludeOwnerId: Number.isFinite(excludeOwnerId) ? excludeOwnerId : undefined,
      limit: 80,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : 5,
    });
    const slice = all.slice(page * pageSize, page * pageSize + pageSize);
    const buf = await renderNearbyListCard({
      pets: slice,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : 5,
      page,
      totalCount: all.length,
    });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.send(buf);
  } catch (err) {
    console.warn('nearby list-card failed:', (err as Error).message);
    res.status(500).json({ error: 'ساخت لیست تصویری ناموفق بود' });
  }
});

/** پت‌های صاحب فعلی (Bearer) — قبل از /:id تا «mine» به Number() نرود */
petsRouter.get('/mine', (req, res) => {
  const ownerId = viewerUserId(req);
  if (!ownerId) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  const pets = dbService.listPets({ ownerId, publicOnly: false });
  res.json(pets);
});

/** کارت پروفایل پت با عکس دایره‌ای صاحب در بالا-چپ — قبل از /:id */
petsRouter.get('/:id/profile-card', async (req, res) => {
  try {
    const petId = Number(req.params.id);
    if (!Number.isFinite(petId) || petId <= 0) {
      res.status(400).json({ error: 'شناسه پت نامعتبر است' });
      return;
    }
    const pet = dbService.getPet(petId);
    if (!pet) {
      res.status(404).json({ error: 'پت پیدا نشد' });
      return;
    }
    const viewerLat = req.query.viewerLat != null ? Number(req.query.viewerLat) : undefined;
    const viewerLng = req.query.viewerLng != null ? Number(req.query.viewerLng) : undefined;
    let distanceKm = pet.distanceKm;
    if (
      distanceKm == null &&
      viewerLat != null &&
      viewerLng != null &&
      Number.isFinite(viewerLat) &&
      Number.isFinite(viewerLng)
    ) {
      const owner = dbService.getUserById(pet.ownerId);
      if (owner?.lat != null && owner?.lng != null) {
        distanceKm = Math.round(haversineKm(viewerLat, viewerLng, owner.lat, owner.lng) * 10) / 10;
      }
    }
    // Materialize Telegram file_id → /api/auth/avatar/... so sharp can load the face.
    // Does not expose phone / telegramId on the image or response.
    let ownerAvatarUrl = pet.ownerAvatarUrl;
    try {
      const ensured = await ensureWebAccessibleAvatar(pet.ownerId);
      if (ensured?.avatarUrl) ownerAvatarUrl = ensured.avatarUrl;
    } catch (err) {
      console.warn('profile-card owner avatar ensure failed:', (err as Error).message);
    }
    const buf = await renderPetProfileCard({
      pet: { ...pet, distanceKm, ownerAvatarUrl },
      corner: 'tl',
    });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(buf);
  } catch (err) {
    console.warn('pet profile-card failed:', (err as Error).message);
    res.status(500).json({ error: 'ساخت کارت پروفایل ناموفق بود' });
  }
});


/**
 * Stream pet photo for web <img>.
 * Local `/api/pets/photos/...` is served from disk; Telegram file_id is
 * materialized into pet-photos (best effort) or proxied once.
 */
petsRouter.get('/:id/image', async (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const row = getDb()
    .prepare('SELECT id, owner_id, image_url, photo_moderation_status FROM pets WHERE id = ?')
    .get(petId) as
    | {
        id: number;
        owner_id: number;
        image_url: string | null;
        photo_moderation_status: string | null;
      }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const viewerId = viewerUserId(req);
  if (
    String(row.photo_moderation_status ?? 'approved') !== 'approved' &&
    viewerId !== row.owner_id
  ) {
    res.status(403).json({ error: 'عکس هنوز تأیید نشده است' });
    return;
  }

  const raw = String(row.image_url ?? '').trim();
  if (!raw) {
    res.status(404).json({ error: 'عکس پیدا نشد' });
    return;
  }

  const sendLocal = (urlPath: string): boolean => {
    const key = petPhotoStorageKeyFromUrl(urlPath);
    if (!key) return false;
    const local = readLocalPetPhoto(key);
    if (!local) return false;
    res.setHeader('Content-Type', local.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(local.buffer);
    return true;
  };

  if (raw.startsWith('/api/pets/photos/') && sendLocal(raw)) return;

  if (/^https?:\/\//i.test(raw)) {
    res.redirect(302, raw);
    return;
  }

  if (looksLikeTelegramFileId(raw)) {
    const saved = await materializePetTelegramPhoto(petId, row.owner_id, raw);
    if (saved && sendLocal(saved)) return;

    const bytes = await fetchTelegramFileBytes(raw);
    if (!bytes) {
      res.status(404).json({ error: 'عکس تلگرام در دسترس نیست' });
      return;
    }
    res.setHeader('Content-Type', bytes.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(bytes.buffer);
    return;
  }

  if (sendLocal(raw)) return;

  res.status(404).json({ error: 'عکس پیدا نشد' });
});

petsRouter.get('/:id', (req, res) => {
  const raw = String(req.params.id ?? '').trim();
  if (!raw) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }
  // Legacy numeric ids still work; name slugs (e.g. teddy) resolve too.
  // Pure non-slug garbage (empty after trim) already rejected above.
  const pet = dbService.getPetByIdOrSlug(raw);
  if (!pet) {
    // Keep old 400 for clearly invalid tokens that are neither id nor plausible slug
    if (!/^\d+$/.test(raw) && !/^[a-z0-9-]{1,64}$/i.test(raw)) {
      res.status(400).json({ error: 'شناسه پت نامعتبر است' });
      return;
    }
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (!pet.slug) {
    dbService.ensurePetSlug(pet.id);
  }
  const fresh = dbService.getPet(pet.id) ?? pet;
  const viewerId = viewerUserId(req);
  res.json(presentPet(fresh, viewerId, { privileged: isInternalBot(req) }));
});

/** دفتر خاطرات پت — خواندن عمومی */
petsRouter.get('/:id/diary', (req, res) => {
  const pet = dbService.getPetByIdOrSlug(String(req.params.id ?? '').trim());
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  const limitRaw = req.query.limit != null ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
  res.json({
    petId: pet.id,
    slug: pet.slug,
    title: `دفتر خاطرات ${pet.name}`,
    entries: dbService.listPetDiaryEntries(pet.id, limit),
  });
});

/** دفتر خاطرات — فقط صاحب پت می‌نویسد */
petsRouter.post('/:id/diary', (req, res) => {
  const pet = dbService.getPetByIdOrSlug(String(req.params.id ?? '').trim());
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  const sessionUserId = viewerUserId(req);
  const bodyOwnerId = req.body?.ownerId != null ? Number(req.body.ownerId) : undefined;
  const authorUserId = sessionUserId ?? bodyOwnerId;
  if (authorUserId == null || !Number.isFinite(authorUserId)) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (pet.ownerId !== authorUserId) {
    res.status(403).json({ error: 'فقط صاحب پت می‌تواند در دفتر خاطرات بنویسد' });
    return;
  }
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) {
    res.status(400).json({ error: 'متن خاطره الزامی است' });
    return;
  }
  if (body.length > 4000) {
    res.status(400).json({ error: 'متن خاطره خیلی طولانی است' });
    return;
  }
  const entry = dbService.addPetDiaryEntry({
    petId: pet.id,
    authorUserId,
    body,
  });
  if (!entry) {
    res.status(400).json({ error: 'ثبت خاطره ناموفق بود' });
    return;
  }
  res.status(201).json(entry);
});

petsRouter.delete('/:id/diary/:entryId', (req, res) => {
  const pet = dbService.getPetByIdOrSlug(String(req.params.id ?? '').trim());
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  const sessionUserId = viewerUserId(req);
  const bodyOwnerId =
    req.body?.ownerId != null
      ? Number(req.body.ownerId)
      : req.query.ownerId != null
        ? Number(req.query.ownerId)
        : undefined;
  const authorUserId = sessionUserId ?? bodyOwnerId;
  if (authorUserId == null || !Number.isFinite(authorUserId)) {
    res.status(401).json({ error: 'وارد نشده‌اید' });
    return;
  }
  if (pet.ownerId !== authorUserId) {
    res.status(403).json({ error: 'اجازه نداری' });
    return;
  }
  const entryId = Number(req.params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    res.status(400).json({ error: 'شناسه خاطره نامعتبر است' });
    return;
  }
  const ok = dbService.deletePetDiaryEntry(entryId, authorUserId);
  if (!ok) {
    res.status(404).json({ error: 'خاطره پیدا نشد' });
    return;
  }
  res.json({ ok: true });
});

petsRouter.post('/', (req, res) => {
  const {
    ownerId,
    name,
    species,
    breed,
    gender,
    ageMonths,
    size,
    color,
    bio,
    vaccinated,
    neutered,
    lookingForPlaymate,
    personality,
    health,
    diseases,
    imageUrl,
    city,
    neighborhood,
  } = req.body;

  const nameTrim = typeof name === 'string' ? name.trim() : '';
  const speciesTrim = typeof species === 'string' ? species.trim() : '';
  const breedTrim = typeof breed === 'string' ? breed.trim() : '';

  if (!ownerId || !nameTrim || !speciesTrim) {
    res.status(400).json({ error: 'ownerId، name و species الزامی هستند' });
    return;
  }
  if (!breedTrim) {
    res.status(400).json({ error: 'نژاد پت الزامی است — از لیست انتخاب کن' });
    return;
  }

  const owner = dbService.getUserById(Number(ownerId));
  if (!owner) {
    res.status(404).json({ error: 'صاحب پت پیدا نشد' });
    return;
  }

  const catalogBreed = dbService.findBreedByName(speciesTrim, breedTrim);
  if (!catalogBreed) {
    res.status(400).json({ error: 'نژاد باید از لیست نژادهای همین نوع حیوان انتخاب شود' });
    return;
  }

  const healthPayload =
    health && typeof health === 'object'
      ? { ...health }
      : {};
  if (typeof diseases === 'string' && diseases.trim()) {
    healthPayload.diseases = diseases.trim();
  }

  // Only store real uploaded / telegram / http URLs — never stock placeholders.
  const rawImage = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  const safeImageUrl =
    rawImage &&
    (rawImage.startsWith('/api/pets/photos/') ||
      looksLikeTelegramFileId(rawImage) ||
      /^https?:\/\//i.test(rawImage))
      ? rawImage
      : undefined;

  const pet = dbService.createPet({
    ownerId: Number(ownerId),
    name: nameTrim,
    species: speciesTrim,
    breed: catalogBreed.nameFa,
    gender,
    ageMonths,
    size,
    color,
    bio,
    vaccinated,
    neutered,
    lookingForPlaymate,
    personality,
    health: healthPayload,
    imageUrl: safeImageUrl,
    city,
    neighborhood,
  });

  if (safeImageUrl && looksLikeTelegramFileId(safeImageUrl)) {
    void materializePetTelegramPhoto(pet.id, pet.ownerId, safeImageUrl).catch((err) => {
      console.warn('background pet photo materialize failed:', (err as Error).message);
    });
  }

  dbService.setUserOnboarding(Number(ownerId), 'profile_complete');
  const updatedOwner = dbService.getUserById(Number(ownerId));
  res.status(201).json({ ...pet, owner: updatedOwner ?? undefined });
});

petsRouter.patch('/:id', (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const existing = dbService.getPet(petId);
  if (!existing) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const ownerId = req.query.ownerId
    ? Number(req.query.ownerId)
    : req.body?.ownerId
      ? Number(req.body.ownerId)
      : undefined;
  if (ownerId !== undefined && existing.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه ویرایش این پت را نداری' });
    return;
  }

  const body = { ...req.body };
  delete body.ownerId;
  if (typeof body.diseases === 'string') {
    body.health = {
      ...existing.health,
      ...(body.health && typeof body.health === 'object' ? body.health : {}),
      diseases: body.diseases.trim() || undefined,
    };
    delete body.diseases;
  }

  const nextSpecies =
    typeof body.species === 'string' && body.species.trim()
      ? body.species.trim()
      : existing.species;
  if (body.breed !== undefined) {
    const breedTrim = typeof body.breed === 'string' ? body.breed.trim() : '';
    if (!breedTrim) {
      res.status(400).json({ error: 'نژاد پت الزامی است — از لیست انتخاب کن' });
      return;
    }
    const catalogBreed = dbService.findBreedByName(nextSpecies, breedTrim);
    if (!catalogBreed) {
      res.status(400).json({ error: 'نژاد باید از لیست نژادهای همین نوع حیوان انتخاب شود' });
      return;
    }
    body.breed = catalogBreed.nameFa;
    body.species = nextSpecies;
  }
  if (typeof body.name === 'string' && !body.name.trim()) {
    res.status(400).json({ error: 'نام پت الزامی است' });
    return;
  }

  const pet = dbService.updatePet(petId, body);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const patchedImage =
    typeof body.imageUrl === 'string' ? String(body.imageUrl).trim() : '';
  if (patchedImage && looksLikeTelegramFileId(patchedImage)) {
    void materializePetTelegramPhoto(petId, existing.ownerId, patchedImage).catch((err) => {
      console.warn('background pet photo materialize failed:', (err as Error).message);
    });
  }

  res.json(pet);
});

petsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ownerId = req.query.ownerId
    ? Number(req.query.ownerId)
    : req.body?.ownerId
      ? Number(req.body.ownerId)
      : undefined;

  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const existing = dbService.getPet(id);
  if (!existing) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  if (ownerId !== undefined && existing.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه حذف این پت را نداری' });
    return;
  }

  const ok = dbService.deletePet(id, ownerId);
  if (!ok) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json({ ok: true, id });
});

petsRouter.get('/:id/medical-record', (req, res) => {
  try {
    const petId = Number(req.params.id);
    const viewerId = req.query.viewerId ? Number(req.query.viewerId) : undefined;
    if (!Number.isFinite(petId) || petId <= 0) {
      res.status(400).json({ error: 'شناسه پت نامعتبر' });
      return;
    }
    const pet = dbService.getPet(petId);
    if (!pet) {
      res.status(404).json({ error: 'پت پیدا نشد' });
      return;
    }
    if (viewerId == null || !Number.isFinite(viewerId)) {
      res.status(401).json({ error: 'viewerId الزامی است' });
      return;
    }
    const access = dbService.canAccessPetMedical(petId, viewerId);
    if (!access.ok) {
      res.status(403).json({ error: 'دسترسی به پرونده نداری' });
      return;
    }
    const record = dbService.getPetMedicalRecord(petId);
    const entries = dbService.listPetMedicalEntries(petId);
    const prescriptions = dbService.listPrescriptionsForPet(petId, 30);
    res.json({ record, entries, prescriptions, pet });
  } catch (err) {
    console.error('GET medical-record failed:', err);
    res.status(500).json({ error: 'خطا در بارگذاری پرونده پزشکی' });
  }
});

petsRouter.get('/:id/prescriptions', (req, res) => {
  const petId = Number(req.params.id);
  const viewerId = req.query.viewerId ? Number(req.query.viewerId) : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (viewerId == null || !Number.isFinite(viewerId)) {
    res.status(401).json({ error: 'viewerId الزامی است' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, viewerId);
  if (!access.ok) {
    res.status(403).json({ error: 'دسترسی به نسخه‌ها نداری' });
    return;
  }
  res.json(dbService.listPrescriptionsForPet(petId, 40));
});

petsRouter.get('/:id/wishlist', (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  if (!dbService.getPet(petId)) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(dbService.listPetWishlist(petId));
});

petsRouter.post('/:id/wishlist', (req, res) => {
  const petId = Number(req.params.id);
  const targetPetId = Number(req.body?.targetPetId);
  const ownerId = Number(req.body?.ownerId);
  if (!Number.isFinite(petId) || !Number.isFinite(targetPetId)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (Number.isFinite(ownerId) && pet.ownerId !== ownerId) {
    res.status(403).json({ error: 'فقط صاحب پت می‌تواند ویش‌لیست را تغییر دهد' });
    return;
  }
  const result = dbService.addPetWishlist(petId, targetPetId);
  if (!result.ok) {
    res.status(400).json({
      error:
        result.reason === 'self'
          ? 'نمی‌توانی پت را به ویش‌لیست خودش اضافه کنی'
          : 'پت پیدا نشد',
    });
    return;
  }
  res.status(result.created ? 201 : 200).json({ ok: true, created: result.created });
});

petsRouter.delete('/:id/wishlist/:targetPetId', (req, res) => {
  const petId = Number(req.params.id);
  const targetPetId = Number(req.params.targetPetId);
  const ownerId = req.query.ownerId ? Number(req.query.ownerId) : undefined;
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (ownerId != null && pet.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه نداری' });
    return;
  }
  dbService.removePetWishlist(petId, targetPetId);
  res.json({ ok: true });
});

petsRouter.put('/:id/medical-record', (req, res) => {
  const petId = Number(req.params.id);
  const viewerId = req.body?.viewerId != null ? Number(req.body.viewerId) : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (viewerId == null) {
    res.status(400).json({ error: 'viewerId الزامی است' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, viewerId, { write: true });
  if (!access.ok) {
    res.status(403).json({ error: 'دسترسی به پرونده نداری' });
    return;
  }
  const patch = {
    notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    vaccinations: typeof req.body?.vaccinations === 'string' ? req.body.vaccinations : undefined,
    allergies: typeof req.body?.allergies === 'string' ? req.body.allergies : undefined,
    chronicConditions:
      typeof req.body?.chronicConditions === 'string' ? req.body.chronicConditions : undefined,
    lastCheckup: typeof req.body?.lastCheckup === 'string' ? req.body.lastCheckup : undefined,
    medications: typeof req.body?.medications === 'string' ? req.body.medications : undefined,
  };
  const authorUser = dbService.getUserById(viewerId);
  const consultId =
    req.body?.consultId != null && Number.isFinite(Number(req.body.consultId))
      ? Number(req.body.consultId)
      : undefined;
  const record = dbService.upsertPetMedicalRecord(petId, patch, {
    userId: viewerId,
    name: authorUser?.name,
    consultId,
    appendEntries: true,
  });
  res.json(record);
});

petsRouter.post('/:id/medical-entries', (req, res) => {
  const petId = Number(req.params.id);
  const authorUserId = req.body?.authorUserId != null ? Number(req.body.authorUserId) : undefined;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const consultId = req.body?.consultId != null ? Number(req.body.consultId) : undefined;
  const authorName =
    typeof req.body?.authorName === 'string' ? req.body.authorName.trim() : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  if (!authorUserId || !text) {
    res.status(400).json({ error: 'authorUserId و text الزامی هستند' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, authorUserId, { write: true });
  if (!access.ok) {
    res.status(403).json({ error: 'اجازه ثبت در پرونده را نداری' });
    return;
  }
  const entry = dbService.addPetMedicalEntry({
    petId,
    authorUserId,
    authorName,
    text,
    consultId: Number.isFinite(consultId) ? consultId : undefined,
  });
  res.status(201).json(entry);
});
