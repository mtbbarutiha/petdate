import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { dbService, haversineKm } from '../db';
import {
  MAX_PET_PHOTO_BYTES,
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
  savePetPhoto,
} from '../services/pet-photo-store';
import { renderNearbyListCard, renderPetProfileCard } from '../services/nearby-cards';
import { ensureWebAccessibleAvatar } from '../services/telegram-profile-sync';

export const petsRouter = Router();

const petPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PET_PHOTO_BYTES, files: 1 },
});

/** Upload a pet profile photo (multipart field: `file`). Returns a public URL path. */
petsRouter.post('/photos/upload', (req, res) => {
  petPhotoUpload.single('file')(req, res, (uploadErr) => {
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

    const ownerId = Number(
      (req.body as { ownerId?: string })?.ownerId ?? req.query.ownerId
    );
    const file = req.file;

    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      res.status(400).json({ error: 'ownerId الزامی است' });
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
      const saved = savePetPhoto({
        ownerId,
        originalName: file.originalname || 'pet.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      res.status(201).json({
        ok: true,
        url: saved.urlPath,
        storageKey: saved.storageKey,
        mimeType: file.mimetype,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط عکس (JPG، PNG، WebP، GIF) مجاز است' });
        return;
      }
      console.warn('pet photo upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
    }
  });
});

/** Serve an uploaded pet photo by storage key `ownerId/filename`. */
petsRouter.get('/photos/:ownerId/:filename', (req, res) => {
  const ownerId = String(req.params.ownerId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${ownerId}/${filename}`;
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'عکس پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', mimeFromPetPhotoKey(storageKey));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fs.readFileSync(abs));
});

petsRouter.get('/', (req, res) => {
  const ownerId = req.query.ownerId ? Number(req.query.ownerId) : undefined;
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

  const pets = dbService.listPets({
    ownerId,
    excludeOwnerId,
    lookingForPlaymate,
    species,
    city,
    province,
    breed,
    breeds,
    sort,
  });
  res.json(pets);
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
  const pets = dbService.listNearbyPets({
    lat,
    lng,
    excludeOwnerId: Number.isFinite(excludeOwnerId) ? excludeOwnerId : undefined,
    limit: Number.isFinite(limit) ? limit : 30,
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
  });
  res.json(pets);
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

/** کارت پروفایل پت با عکس دایره‌ای صاحب در بالا-چپ — قبل از /:id */
petsRouter.get('/:id/profile-card', async (req, res) => {
  try {
    const pet = dbService.getPet(Number(req.params.id));
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

petsRouter.get('/:id', (req, res) => {
  const pet = dbService.getPet(Number(req.params.id));
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(pet);
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

  if (!ownerId || !name || !species) {
    res.status(400).json({ error: 'ownerId، name و species الزامی هستند' });
    return;
  }

  const owner = dbService.getUserById(Number(ownerId));
  if (!owner) {
    res.status(404).json({ error: 'صاحب پت پیدا نشد' });
    return;
  }

  const healthPayload =
    health && typeof health === 'object'
      ? { ...health }
      : {};
  if (typeof diseases === 'string' && diseases.trim()) {
    healthPayload.diseases = diseases.trim();
  }

  const pet = dbService.createPet({
    ownerId: Number(ownerId),
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
    health: healthPayload,
    imageUrl,
    city,
    neighborhood,
  });

  dbService.setUserOnboarding(Number(ownerId), 'profile_complete');
  res.status(201).json(pet);
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

  const pet = dbService.updatePet(petId, body);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
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
